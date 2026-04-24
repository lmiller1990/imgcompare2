import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs/promises";
import { createApp } from "./app.ts";
import * as schema from "../src/db/schema.ts";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import type { Result } from "./domain.ts";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import pino from "pino";
import { rootBucket, S3SnapshotService } from "./services/s3.ts";
import { insertComparison } from "./db/queries.ts";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export const logger = pino({ level: "debug" });

const db =
  process.argv[1] === fileURLToPath(import.meta.url)
    ? drizzle(process.env.DATABASE_URL!, { schema, logger: true })
    : null;

export function getDb(): DB {
  if (!db) {
    throw new Error(`DB should not be undefined when running as a module.`);
  }
  return db;
}

export const services = {
  snapshotService: new S3SnapshotService(rootBucket, logger),
} as const;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!db) {
    throw new Error(`DB should not be undefined when running as a module.`);
  }
  const { fastify } = await createApp({ db });

  try {
    await fastify.listen({ port: 8070 });
    console.info("=== Routes ===\n\n", fastify.printRoutes());
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const connection = new IORedis.default({ maxRetriesPerRequest: null });

export interface SnapshotComparisonWorkerPayload {
  result: Result;
  runId: string;
}

const worker = new Worker<SnapshotComparisonWorkerPayload>(
  "diff",
  async (job) => {
    const base = job.data.result.baseline;
    const incoming = job.data.result.snapshot;
    logger.child({ "job.data": job.data }).debug(`Processing diff`);

    console.log({ base, incoming });
    if (!base || !incoming) {
      logger
        .child({ base, incoming })
        .debug("expected base and incoming to be defined.");
      return;
    }

    try {
      const [baseStream, incomingStream] = await Promise.all([
        services.snapshotService.get(base.imagePath),
        services.snapshotService.get(incoming.imagePath),
      ]);

      const img1 = PNG.sync.read(baseStream);
      const img2 = PNG.sync.read(incomingStream);
      const { width, height } = img1;
      const diff = new PNG({ width, height });

      logger.debug("comparing pixels");
      const pxDiff = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        {
          threshold: 0.1,
        },
      );

      await fs.writeFile("out.png", PNG.sync.write(diff));
      const uuid = randomUUID();

      const key = `${job.data.runId}/${uuid}.png`;
      await services.snapshotService.store(key, {
        file: Readable.from(PNG.sync.write(diff)),
        mimetype: "image/png",
      });

      const comparison = await insertComparison(getDb(), {
        id: uuid,
        baselineSnapshotId: base.id,
        currentSnapshotId: incoming.id,
        difference: pxDiff / (width * height),
        imageS3Path: key,
      });

      logger.debug(
        `Stored comparison for ${base.id} and ${incoming.id} in ${key} with id ${comparison.id}`,
      );
    } catch (e) {
      logger.error(`Error.. ${e}`);
    }
  },
  { connection },
);

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

export type DB = ReturnType<typeof drizzle<typeof schema>>;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = drizzle(process.env.DATABASE_URL!, { schema });
  const { fastify } = await createApp({ db });

  try {
    await fastify.listen({ port: 8070 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const connection = new IORedis.default({ maxRetriesPerRequest: null });

import pino from "pino";
import { rootBucket, S3SnapshotService } from "./services/s3.ts";

const logger = pino({ level: "debug" });

const worker = new Worker<{ result: Result }>(
  "diff",
  async (job) => {
    const snapshotService = new S3SnapshotService(rootBucket, logger);
    const base = job.data.result.baseline;
    const incoming = job.data.result.snapshot;
    // console.log({ "job.data": job.data });
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
        snapshotService.get(base.url),
        snapshotService.get(incoming.url),
      ]);

      const img1 = PNG.sync.read(baseStream);
      const img2 = PNG.sync.read(incomingStream);
      const { width, height } = img1;
      const diff = new PNG({ width, height });

      logger.debug("comparing pixels");
      pixelmatch(img1.data, img2.data, diff.data, width, height, {
        threshold: 0.1,
      });

      logger.debug("writing output png");
      await fs.writeFile("out.png", PNG.sync.write(diff));
    } catch (e) {
      logger.error(`Error.. ${e}`);
    }
  },
  { connection },
);

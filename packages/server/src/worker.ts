import fs from "node:fs/promises";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type { Result } from "./domain.ts";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import {
  getTotalSnapshotCount,
  incrementSnapshotsProcessed,
  insertComparison,
  insertRunCompletion,
  patchRun,
} from "./db/queries.ts";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { services } from "./services/index.ts";
import { getDb } from "./db/index.ts";

export const logger = pino({ level: "debug" });

const connection = new IORedis.default({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  maxRetriesPerRequest: null,
});

export const queue = new Queue<SnapshotComparisonWorkerPayload>("diff", { connection });

export interface SnapshotComparisonWorkerPayload {
  result: Result;
  runId: string;
}

logger.info("Initializing snapshot comparison worker");

const worker = new Worker<SnapshotComparisonWorkerPayload>(
  "diff",
  async (job) => {
    const base = job.data.result.baseline;
    const incoming = job.data.result.snapshot;
    logger.debug({ "job.data": job.data }, `Processing diff`);

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

      const db = getDb();
      const comparison = await insertComparison(db, {
        id: uuid,
        baselineSnapshotId: base.id,
        currentSnapshotId: incoming.id,
        difference: pxDiff / (width * height),
        imageS3Path: key,
      });

      logger.debug(
        `Stored comparison for ${base.id} and ${incoming.id} in ${key} with id ${comparison.id}`,
      );

      const inserted = await insertRunCompletion(db, {
        runId: job.data.runId,
        jobId: job.id!,
      });
      if (!inserted) return;

      const [processed, total] = await Promise.all([
        incrementSnapshotsProcessed(db, job.data.runId),
        getTotalSnapshotCount(db, job.data.runId),
      ]);

      if (processed >= total) {
        logger.info(
          `All snapshots processed (${processed}/${total}). Setting run[id=${job.data.runId}] to completed`,
        );
        await patchRun(db, job.data.runId, { status: "completed" });
        return;
      }

      logger.info(
        `Snapshots processed (${processed}/${total}). run[id=${job.data.runId}]`,
      );
    } catch (e) {
      logger.error(`Error.. ${e}`);
    }
  },
  { connection },
);

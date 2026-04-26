import { rootBucket, S3SnapshotService } from "./s3.ts";
import pino from "pino";

export const logger = pino({ level: "debug" });

export const services = {
  snapshotService: new S3SnapshotService(rootBucket, logger),
} as const;

import { rootBucket, S3SnapshotService } from "./s3.ts";
import pino from "pino";
import { getDb } from "../db/index.ts";
import { ProjectService } from "./projectService.ts";

export const logger = pino({ level: "debug" });

export const services = {
  snapshotService: new S3SnapshotService(rootBucket, logger),
  projectService: new ProjectService(getDb()),
} as const;

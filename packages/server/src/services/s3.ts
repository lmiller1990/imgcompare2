import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { FastifyLogFn, FastifyRegister, FastifyRequest } from "fastify";

const s3 = new S3Client({ region: "ap-southeast-2", profile: "terraform" });

interface SnapshotService {
  store(key: string, file: MultipartFile): Promise<void>;
  ensureDirExists(): Promise<void>;
}

export class S3SnapshotService implements SnapshotService {
  dir: string;
  logger: FastifyRequest["log"];

  constructor(_dir: string, _logger: FastifyRequest["log"]) {
    this.dir = _dir;
    this.logger = _logger;
  }

  async ensureDirExists() {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: this.dir }));
    } catch (err) {
      this.logger.error(`Failed to create S3 bucket: ${err}`);
    }
  }

  async store(key: string, data: MultipartFile) {
    await new Upload({
      client: s3,
      params: {
        Bucket: path.join(this.dir),
        Key: key,
        Body: data.file,
        ContentType: data.mimetype,
      },
    }).done();
  }
}

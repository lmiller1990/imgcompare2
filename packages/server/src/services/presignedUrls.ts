import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Snapshot } from "../domain.ts";

export class PresignedUrlService {
  s3Client: S3Client;

  constructor(_s3Client: S3Client) {
    this.s3Client = _s3Client;
    //
  }

  async generateBatchPresignedUrls(keys: string[], config: { bucket: string }) {
    return Promise.all(
      keys.map((key) => {
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        });

        return getSignedUrl(this.s3Client, command, {
          expiresIn: 60 * 5, // 5 minutes
        });
      }),
    );
  }
}

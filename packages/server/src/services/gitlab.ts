import {
  Gitlab,
  type CommitablePipelineStatus,
  type EditPipelineStatusOptions,
} from "@gitbeaker/rest";
import type { DB } from "../db/index.ts";
import { getCiToken } from "../db/queries.ts";
import type { LocalSecretService } from "./encryption.ts";
import pino from "pino";

const logger = pino({ level: "info" });

export class GitlabService {
  #client: Gitlab;
  #ciMetadata: Record<string, string>; // GitLabCiMetadata;

  // constructor(ciMetadata: GitLabCiMetadata, token: string) {
  constructor(ciMetadata: Record<string, string>, token: string) {
    this.#client = new Gitlab({
      token,
    });
    this.#ciMetadata = ciMetadata;
  }

  setPipelineStatus(
    status: CommitablePipelineStatus,
    options: EditPipelineStatusOptions,
  ) {
    logger.info(this.#ciMetadata, "using ciMetadata to update job status");
    return this.#client.Commits.editStatus(
      this.#ciMetadata.ciProjectId!,
      this.#ciMetadata.commitHash!,
      status,
      options,
    );
  }
}

export async function resolveGitlabService(
  db: DB,
  secrets: LocalSecretService,
  projectId: string,
  ciMetadata: Record<string, string>, // GitLabCiMetadata,
): Promise<GitlabService | undefined> {
  const tokenRow = await getCiToken(db, projectId, "gitlab");
  if (!tokenRow) {
    return undefined;
  }
  const token = await secrets.decrypt(tokenRow.ciphertext, projectId);
  return new GitlabService(ciMetadata, token);
}

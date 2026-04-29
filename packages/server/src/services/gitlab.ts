import {
  Gitlab,
  type CommitablePipelineStatus,
  type EditPipelineStatusOptions,
} from "@gitbeaker/rest";
import type { GitLabCiMetadata } from "@packages/domain/src/domain.ts";

export class GitlabService {
  #client: Gitlab;
  #ciMetadata: GitLabCiMetadata;

  constructor(ciMetadata: GitLabCiMetadata, token: string) {
    this.#client = new Gitlab({
      token,
    });
    this.#ciMetadata = ciMetadata;
  }

  setPipelineStatus(
    status: CommitablePipelineStatus,
    options: EditPipelineStatusOptions,
  ) {
    return this.#client.Commits.editStatus(
      this.#ciMetadata.ciProjectId,
      this.#ciMetadata.commitHash,
      status,
      options,
    );
  }
}

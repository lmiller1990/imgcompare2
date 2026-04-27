import {
  Gitlab,
  type CommitablePipelineStatus,
  type EditPipelineStatusOptions,
} from "@gitbeaker/rest";
import type { GitInfo, GitLabCiMetadata } from "@packages/domain/src/domain.ts";

export class GitlabService {
  #client: Gitlab;
  #gitInfo: GitInfo;
  #ciMetadata: GitLabCiMetadata;

  constructor(gitInfo: GitInfo, ciMetadata: GitLabCiMetadata, token: string) {
    this.#client = new Gitlab({
      token,
    });
    this.#gitInfo = gitInfo;
    this.#ciMetadata = ciMetadata;
  }

  setPipelineStatus(
    status: CommitablePipelineStatus,
    options: EditPipelineStatusOptions,
  ) {
    return this.#client.Commits.editStatus(
      this.#ciMetadata.ci_project_id,
      this.#gitInfo.hash,
      status,
      options,
    );
  }
}

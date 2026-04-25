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

  constructor(gitInfo: GitInfo, ciMetadata: GitLabCiMetadata) {
    if (!process.env.GITLAB_TOKEN) {
      throw new Error("Where is the gitlab token? You need it");
    }

    this.#client = new Gitlab({
      token: process.env.GITLAB_TOKEN,
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

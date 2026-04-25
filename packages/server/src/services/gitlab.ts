import { Gitlab } from "@gitbeaker/rest";

export class GitlabService {
  #client: Gitlab;

  constructor() {
    if (!process.env.GITLAB_TOKEN) {
      throw new Error("Where is the gitlab token? You need it");
    }

    this.#client = new Gitlab({
      token: process.env.GITLAB_TOKEN,
    });
  }

  async updateGitlabPipeline() {
    // this.#client.Commits.editStatus()
  }
}

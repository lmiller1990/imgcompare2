export type GitInfo = {
  hash: string;
  authorName: string;
  authorEmail: string;
  branch: string;
};

export interface RunManifest {
  screenshots: Array<{
    name: string;
    fullPath: string;
  }>;
}

export interface GitLabCiMetadata {
  provider: "gitlab";
  ci_project_id: string;
}

export type CiMetadata = GitLabCiMetadata;

export type GitInfo = {
  hash: string;
  authorName: string | undefined;
  authorEmail: string | undefined;
  branch: string | undefined;
};

export interface RunManifest {
  screenshots: Array<{
    name: string;
    fullPath: string;
  }>;
}

export interface GitLabCiMetadata {
  provider: "gitlab";
  ciProjectId: string;
  commitHash: string;
}

export type CiMetadata = GitLabCiMetadata;

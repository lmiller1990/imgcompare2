export interface RunManifest {
  screenshots: Array<{
    name: string;
    fullPath: string;
  }>;
}

export interface GitLabCiMetadata {
  provider: "gitlab";
  ciProjectId: string;
  commitSha: string;
  commitRefName: string;
  commitAuthor: string;
}

export type CiMetadata = GitLabCiMetadata;

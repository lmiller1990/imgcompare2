export interface Snapshot {
  id: string;
  runId: string;
  name: string;
  imagePath: string;
  status: string;
}

export interface Result {
  name: string;
  baseline?: {
    snapshotId: string;
    url: string;
  };
  snapshot?: {
    snapshotId: string;
    url: string;
  };
}

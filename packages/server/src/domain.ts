export interface Run {
  id: string;
  createdAt: string;
  runNumber: number;
}

export interface RunSource {
  id: string;
  branch: string | undefined;
  commitHash: string | undefined;
  authorEmail: string | undefined;
  authorName: string | undefined;
}

export interface RunStateTransition {
  id: string;
  runId: string;
  transitionedFrom: string | undefined;
  transitionedTo: "pending" | "approved" | "rejected" | "unreviewed";
  transitionedAt: string;
  transitionedByUserId: string | undefined;
  transitionedByService: string | undefined;
}

export interface RunWithSource extends Run {
  source: RunSource | undefined;
  stateTransitions: RunStateTransition[];
}

export interface Project {
  id: string;
  name: string;
  runs: Run[];
}

export interface Snapshot {
  id: string;
  runId: string;
  name: string;
  imagePath: string;
  status: string;
}

export interface Result {
  name: string;
  baseline?: Snapshot;
  snapshot?: Snapshot;
  // comparison?: Snapshot;
}

export interface CompletedResult {
  name: string;
  baseline: Snapshot;
  snapshot: Snapshot;
  comparison: Snapshot;
}

export interface Diff {
  id: string;
  /**
   * 0 - 1 (percentage). Number of changed pixels.
   */
  difference: number;
  imagePath: string;
}

export interface Comparison {
  id: string;
  baseline: Snapshot;
  current: Snapshot;
  diff: Diff;
}

// We should probably use a class to model these instead of interfaces
export function isCompleteResult(result: Result): result is Required<Result> {
  return result.baseline != null && result.snapshot != null;
}

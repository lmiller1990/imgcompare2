import type { RunStateTransition } from "@packages/server/src/domain";
import { DateTime } from "luxon";

export function getLatestStateTransition(
  stateTransitions: RunStateTransition[],
): RunStateTransition {
  const st = stateTransitions.sort((x, y) =>
    DateTime.fromISO(y.transitionedAt, { zone: "utc" }) <
    DateTime.fromISO(x.transitionedAt, { zone: "utc" })
      ? -1
      : 1,
  );
  if (!st[0]) {
    throw new Error(
      `All runs should at least have a pending state. This should not happen.`,
    );
  }
  return st[0];
}

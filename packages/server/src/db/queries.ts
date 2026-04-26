import { and, eq, sql } from "drizzle-orm";
import {
  baselines,
  comparisons,
  runApprovals,
  runCompletions,
  runs,
  runSources,
  runManifests,
  snapshots,
} from "./schema.ts";
import type {
  Comparison,
  CompletedResult,
  Result,
  Run,
  RunApproval,
  RunSource,
  RunWithSource,
  Snapshot,
} from "../domain.ts";
import { alias } from "drizzle-orm/pg-core";
import pRetry from "p-retry";
import type { CiMetadata, GitInfo } from "@packages/domain/src/domain.ts";
import type { DB } from "./index.ts";

type SnapshotTuple = [string, string];

export async function findComparisonsForCompleteResults(
  db: DB,
  tuples: SnapshotTuple[],
): Promise<Comparison[]> {
  const res = await db
    .select({
      comparison: comparisons,
      baseline: alias(snapshots, "baseline"),
      current: alias(snapshots, "current"),
    })
    .from(comparisons)
    .innerJoin(
      alias(snapshots, "baseline"),
      eq(alias(snapshots, "baseline").id, comparisons.baselineSnapshotId),
    )
    .innerJoin(
      alias(snapshots, "current"),
      eq(alias(snapshots, "current").id, comparisons.currentSnapshotId),
    ).where(sql`
      (baseline_snapshot_id, current_snapshot_id) IN (
        ${sql.join(
          tuples.map(([b, c]) => sql`(${b}, ${c})`),
          sql`, `,
        )}
      )
    `);

  return res.map(mapComparison);
}

export async function getActiveBaselineForProject(db: DB, projectId: string) {
  const latestBaseline = await db.query.baselines.findFirst({
    columns: { id: true },
    where: (b, { eq }) => eq(b.projectId, projectId),
    orderBy: (b, { desc }) => desc(b.createdAt),
  });
  if (!latestBaseline) return null;

  const bl = await db.query.baselines.findFirst({
    where: (b, { eq }) => eq(b.id, latestBaseline.id),
    with: {
      run: {
        with: {
          snapshots: {
            with: {
              baselineComparisons: true,
            },
          },
        },
      },
    },
  });

  return bl;
}

export async function getProjectWithRunsAndBaseline(db: DB, projectId: string) {
  return db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, projectId),
    with: {
      runs: {
        with: {
          approval: true,
          snapshots: {
            with: {
              baselineComparisons: true,
            },
          },
        },
        orderBy: (b, { desc }) => desc(b.createdAt),
      },
      baselines: {
        where: (b, { eq }) => eq(b.isActive, true),
        orderBy: (b, { desc }) => desc(b.createdAt),
        limit: 1,
      },
    },
  });
}

export async function getRunsForProject(
  db: DB,
  projectId: string,
): Promise<RunWithSource[]> {
  const runs = await db.query.runs.findMany({
    where: (b, { eq, and }) => {
      return and(eq(b.projectId, projectId));
    },
    with: {
      approval: true,
      source: true,
    },
  });

  return runs.map((run) => {
    return {
      ...mapRun(run),
      source: run.source ? mapRunSource(run.source) : undefined,
      approval: run.approval ? mapRunApproval(run.approval) : undefined,
    };
  });
}

export async function getRunById(db: DB, runId: string) {
  const run = await db.query.runs.findFirst({
    where: (b, { eq, and }) => {
      return eq(b.id, runId);
    },
    with: {
      snapshots: {
        with: {
          baselineComparisons: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error(`Could not find run with id ${runId}`);
  }

  return run;
}

export async function getComparisonByResult(db: DB, result: CompletedResult) {
  const res = await db.query.comparisons.findFirst({
    where: (b, { eq, and }) => {
      return and(
        eq(b.currentSnapshotId, result.snapshot.id),
        eq(b.baselineSnapshotId, result.baseline.id),
      );
    },
  });

  return res;
}

export async function patchRun(
  db: DB,
  runId: string,
  params: Partial<typeof runs.$inferInsert>,
) {
  await db.update(runs).set(params).where(eq(runs.id, runId));
}

/**
 * need to retry to avoid race condition of two runs querying at same time return same run number.
 */
export async function insertRun(db: DB, projectId: string): Promise<Run> {
  return pRetry(
    async () => {
      const result = await db
        .select({
          nextRunNumber: sql<number>`coalesce(max(${runs.runNumber}), 0) + 1`,
        })
        .from(runs)
        .where(eq(runs.projectId, projectId));

      const nextRunNumber = result[0]?.nextRunNumber ?? 1;

      const inserted = await db
        .insert(runs)
        .values({
          projectId,
          runNumber: nextRunNumber,
        })
        .returning();

      if (!inserted[0]) {
        throw new Error(`Inserted run for ${projectId} but failed to return`);
      }

      return mapRun(inserted[0]);
    },
    { retries: 3 },
  );
}

export async function insertRunSource(
  db: DB,
  run: Run,
  gitinfo: GitInfo,
  ciMetadata?: CiMetadata,
): Promise<RunSource> {
  const inserted = await db
    .insert(runSources)
    .values({
      runId: run.id,
      branch: gitinfo.branch,
      commitHash: gitinfo.hash,
      authorEmail: gitinfo.authorEmail,
      authorName: gitinfo.authorName,
      ciMetadata: ciMetadata,
    })
    .returning();

  if (!inserted[0]) {
    throw new Error(`Inserted run source for ${run.id} but failed to return`);
  }

  return mapRunSource(inserted[0]);
}

export async function getTotalSnapshotCount(
  db: DB,
  runId: string,
): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`jsonb_array_length(${runManifests.manifest}->'screenshots')`,
    })
    .from(runManifests)
    .where(eq(runManifests.runId, runId));

  return result[0]?.count ?? 0;
}

export async function insertRunCompletion(
  db: DB,
  params: typeof runCompletions.$inferInsert,
): Promise<boolean> {
  const result = await db
    .insert(runCompletions)
    .values(params)
    .onConflictDoNothing()
    .returning();
  return result.length > 0;
}

export async function incrementSnapshotsProcessed(
  db: DB,
  runId: string,
): Promise<number> {
  const result = await db
    .update(runs)
    .set({ snapshotsProcessed: sql`${runs.snapshotsProcessed} + 1` })
    .where(eq(runs.id, runId))
    .returning({ snapshotsProcessed: runs.snapshotsProcessed });
  return result[0]?.snapshotsProcessed ?? 0;
}

export async function insertRunManifest(
  db: DB,
  params: typeof runManifests.$inferInsert,
) {
  const record = await db.insert(runManifests).values(params).returning();
  return record[0]!;
}

export async function insertComparison(
  db: DB,
  params: typeof comparisons.$inferInsert,
) {
  const record = await db.insert(comparisons).values(params).returning();
  return record[0]!;
}

export async function insertSnapshot(
  db: DB,
  params: { runId: string; name: string; imageS3Path: string },
): Promise<Snapshot> {
  const inserted = await db
    .insert(snapshots)
    .values({
      runId: params.runId,
      name: params.name,
      status: "pending",
      imageS3Path: params.imageS3Path,
    })
    .returning();

  if (!inserted[0]) {
    throw new Error(
      `Inserted snapshot for run ${params.runId} but failed to return`,
    );
  }

  return mapSnapshot(inserted[0]);
}

type SnapshotRow = typeof snapshots.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type RunSourceRow = typeof runSources.$inferSelect;
type RunApprovalRow = typeof runApprovals.$inferSelect;
type ComparisonRow = {
  comparison: typeof comparisons.$inferSelect;
  baseline: typeof snapshots.$inferSelect;
  current: typeof snapshots.$inferSelect;
};

export const mappers = {
  run: {
    toDomain(row: RunRow) {
      //
    },
  },
  snapshot: {
    toDomain: mapSnapshot,
  },

  comparison: {
    toDomain: mapComparison,
  },
};

function mapComparison(row: ComparisonRow): Comparison {
  return {
    id: row.comparison.id,
    baseline: mapSnapshot(row.baseline),
    current: mapSnapshot(row.current),
    diff: {
      id: row.comparison.id,
      imagePath: row.comparison.imageS3Path,
      difference: row.comparison.difference,
    },
  };
}

function mapSnapshot(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    runId: row.runId,
    name: row.name,
    imagePath: row.imageS3Path,
    status: row.status,
  };
}

export function mapRun(row: RunRow): Run {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    runNumber: row.runNumber,
  };
}

export function mapRunSource(row: RunSourceRow): RunSource {
  return {
    id: row.id,
    branch: row.branch ?? undefined,
    commitHash: row.commitHash ?? undefined,
    authorEmail: row.authorEmail ?? undefined,
    authorName: row.authorEmail ?? undefined,
  };
}

export function mapRunApproval(row: RunApprovalRow): RunApproval {
  return {
    id: row.id,
    approvedAt: row.approvedAt.toISOString(),
    approvedByUser: row.approvedByUserId,
  };
}

export type RunsForProject = Awaited<ReturnType<typeof getRunsForProject>>;
export type ProjectWithRunsAndBaseline = Awaited<
  ReturnType<typeof getProjectWithRunsAndBaseline>
>;

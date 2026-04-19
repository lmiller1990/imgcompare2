import { and, eq, sql } from "drizzle-orm";
import type { DB, GitInfo } from "../index.ts";
import {
  baselines,
  comparisons,
  runs,
  runSources,
  snapshots,
} from "./schema.ts";
import type {
  Comparison,
  CompletedResult,
  Result,
  Run,
  RunSource,
  RunWithSource,
  Snapshot,
} from "../domain.ts";
import { alias } from "drizzle-orm/pg-core";

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
      source: true,
    },
  });

  return runs.map((run) => {
    return {
      ...mapRun(run),
      source: run.source ? mapRunSource(run.source) : undefined,
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

export async function insertRun(db: DB, projectId: string): Promise<Run> {
  const inserted = await db
    .insert(runs)
    .values({
      projectId,
    })
    .returning();

  if (!inserted[0]) {
    throw new Error(`Inserted run for ${projectId} but failed to return`);
  }

  return mapRun(inserted[0]);
}

export async function insertRunSource(
  db: DB,
  run: Run,
  gitinfo: GitInfo,
): Promise<RunSource> {
  const inserted = await db
    .insert(runSources)
    .values({
      runId: run.id,
      branch: gitinfo.branch,
      commitHash: gitinfo.hash,
      authorEmail: gitinfo.authorEmail,
      authorName: gitinfo.authorName,
    })
    .returning();

  if (!inserted[0]) {
    throw new Error(`Inserted run source for ${run.id} but failed to return`);
  }

  return mapRunSource(inserted[0]);
}

export async function insertComparison(
  db: DB,
  params: typeof comparisons.$inferInsert,
) {
  const record = await db.insert(comparisons).values(params).returning();
  return record[0]!;
}

type SnapshotRow = typeof snapshots.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type RunSourceRow = typeof runSources.$inferSelect;
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

export type RunsForProject = Awaited<ReturnType<typeof getRunsForProject>>;
export type ProjectWithRunsAndBaseline = Awaited<
  ReturnType<typeof getProjectWithRunsAndBaseline>
>;

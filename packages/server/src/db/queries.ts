import { and, eq, sql } from "drizzle-orm";
import type { DB } from "../index.ts";
import { baselines, comparisons, runs, snapshots } from "./schema.ts";
import type {
  Comparison,
  CompletedResult,
  Result,
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

export async function getRunsForProject(db: DB, projectId: string) {
  const baseline = await getProjectWithRunsAndBaseline(db, projectId);

  const runs = await db.query.runs.findMany({
    where: (b, { eq, and }) => {
      return and(eq(b.projectId, projectId));
    },
    with: {
      snapshots: {
        with: {
          baselineComparisons: true,
        },
      },
    },
  });

  return runs.map();
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

export async function insertComparison(
  db: DB,
  params: typeof comparisons.$inferInsert,
) {
  const record = await db.insert(comparisons).values(params).returning();
  return record[0]!;
}

type SnapshotRow = typeof snapshots.$inferSelect;
type RunRow = typeof runs.$inferSelect;
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

export type RunsForProject = Awaited<ReturnType<typeof getRunsForProject>>;
export type ProjectWithRunsAndBaseline = Awaited<
  ReturnType<typeof getProjectWithRunsAndBaseline>
>;

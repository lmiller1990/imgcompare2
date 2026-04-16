import { and, eq } from "drizzle-orm";
import type { DB } from "../index.ts";
import { baselines, runs, snapshots } from "./schema.ts";
import type { Snapshot } from "../domain.ts";

export async function getActiveBaselineForProject(db: DB, projectId: string) {
  const bl = await db.query.baselines.findFirst({
    where: (b, { eq, and }) => {
      return and(eq(b.projectId, projectId), eq(b.isActive, true));
    },
    with: {
      run: {
        with: {
          snapshots: {
            with: {
              comparison: true,
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
              comparison: true,
            },
          },
        },
      },
      baselines: {
        where: (b, { eq }) => eq(b.isActive, true),
        limit: 1,
      },
    },
  });
}

export async function getRunsForProject(db: DB, projectId: string) {
  const bl = await db.query.runs.findMany({
    where: (b, { eq, and }) => {
      return and(eq(b.projectId, projectId));
    },
    with: {
      snapshots: {
        with: {
          comparison: true,
        },
      },
    },
  });

  return bl;
}

export async function getRunById(db: DB, runId: string) {
  return db.query.runs.findFirst({
    where: (b, { eq, and }) => {
      return eq(b.id, runId);
    },
    with: {
      snapshots: {
        with: {
          comparison: true,
        },
      },
    },
  });
}

export async function patchRun(
  db: DB,
  runId: string,
  params: Partial<typeof runs.$inferInsert>,
) {
  await db.update(runs).set(params).where(eq(runs.id, runId));
}

type SnapshotRow = typeof snapshots.$inferSelect;
type RunRow = typeof runs.$inferSelect;

export const mappers = {
  run: {
    toDomain(row: RunRow) {
      //
    },
  },
  snapshot: {
    toDomain: (row: SnapshotRow): Snapshot => {
      return {
        id: row.id,
        runId: row.runId,
        name: row.name,
        imagePath: row.imageS3Path,
        status: row.status,
      };
    },
  },
};

export type RunsForProject = Awaited<ReturnType<typeof getRunsForProject>>;
export type ProjectWithRunsAndBaseline = Awaited<
  ReturnType<typeof getProjectWithRunsAndBaseline>
>;

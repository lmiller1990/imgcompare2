import { and, eq } from "drizzle-orm";
import type { DB } from "../index.ts";
import { baselines, runs, snapshots } from "./schema.ts";

export async function getActiveBaselineForProject(db: DB, projectId: string) {
  // const bl = await db
  //   .select()
  //   .from(baselines)
  //   .innerJoin(runs, eq(baselines.sourceRunId, runs.id))
  //   .leftJoin(snapshots, eq(snapshots.runId, runs.id))
  //   .where(
  //     and(eq(baselines.projectId, projectId), eq(baselines.isActive, true)),
  //   );

  const bl = await db.query.baselines.findFirst({
    where: (b, { eq, and }) => {
      and(eq(b.projectId, projectId), eq(b.isActive, true));
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

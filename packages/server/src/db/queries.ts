import { and, eq } from "drizzle-orm";
import type { DB } from "../index.ts";
import { baselines, runs, snapshots } from "./schema.ts";

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

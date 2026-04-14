import { and, eq } from "drizzle-orm";
import type { DB } from "../index.ts";
import { baselines, runs, snapshots } from "./schema.ts";

export async function getProjectsForUser(db: DB, userId: string) {
  const q = await db.query.projects.findMany({
    where: (b, { eq, and }) => {
      return eq(b.ownerUserId, userId);
    },
  });

  return q;
}

export type ProjectsForUser = Awaited<ReturnType<typeof getProjectsForUser>>;

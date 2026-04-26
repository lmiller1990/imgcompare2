import { projects, users } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import type { DB } from "../db/index.ts";

export class ProjectService {
  #db: DB;
  constructor(db: DB) {
    this.#db = db;
  }

  async createProject(name: string, email: string) {
    const q = await this.#db.select().from(users).where(eq(users.email, email));
    const user = q[0];
    if (!user) {
      return undefined;
    }

    const inserted = await this.#db
      .insert(projects)
      .values({ name, ownerUserId: user.id })
      .returning();

    return inserted[0];
  }
}

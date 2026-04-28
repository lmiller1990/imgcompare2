import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

export type DB = NodePgDatabase<typeof schema>;

const db = drizzle(process.env.DATABASE_URL!, { schema, logger: true });

export function getDb(): DB {
  if (!db) {
    throw new Error(`DB should not be undefined when running as a module.`);
  }
  return db;
}

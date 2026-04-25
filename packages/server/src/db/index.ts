import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

const db =
  process.argv[1] === fileURLToPath(import.meta.url)
    ? drizzle(process.env.DATABASE_URL!, { schema, logger: true })
    : null;

export function getDb(): DB {
  if (!db) {
    throw new Error(`DB should not be undefined when running as a module.`);
  }
  return db;
}

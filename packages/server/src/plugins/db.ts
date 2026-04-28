import fp from "fastify-plugin";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.ts";
import type { DB } from "../db/index.ts";

export const dbPlugin = fp(async (fastify, opts: { db: DB }) => {
  fastify.decorate("db", opts.db);
});

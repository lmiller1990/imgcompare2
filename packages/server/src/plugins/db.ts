import fp from "fastify-plugin";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.ts";

export const dbPlugin = fp(
  async (fastify, opts: { db: NodePgDatabase<typeof schema> }) => {
    fastify.decorate("db", opts.db);
  },
);

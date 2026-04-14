import fp from "fastify-plugin";
import { projects, users } from "../db/schema.ts";
import { eq } from "drizzle-orm";

// export const userRoutesPlugin = fp(async (fastify) => {});

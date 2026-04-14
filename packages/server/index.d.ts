import type { FastifyRequest, FastifyReply } from "fastify";
import type { DB } from "./src/index.ts";
import type { users } from "./src/db/schema.ts";

declare module "fastify" {
  interface FastifyRequest {
    dbUser: typeof users.$inferSelect;
  }

  interface FastifyInstance {
    db: DB;
    verifyJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    verifyProjectAccess: (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

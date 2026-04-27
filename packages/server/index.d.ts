import type { FastifyRequest, FastifyReply } from "fastify";
import type { users } from "./src/db/schema.ts";
import type { LocalSecretService } from "./src/services/encryption.ts";
import type { DB } from "./src/db/index.ts";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { email: string } | { projectId: string; type: "service" };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    dbUser: typeof users.$inferSelect;
  }

  interface FastifyInstance {
    db: DB;
    secrets: LocalSecretService;
    verifyJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    verifyProjectAccess: (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

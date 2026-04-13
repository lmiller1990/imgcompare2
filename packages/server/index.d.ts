import { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    verifyJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

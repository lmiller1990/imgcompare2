import type { FastifyInstance } from "fastify";
import { getProjectsForUser } from "../db/queries.ts";

export const userRoutesPlugin = async (fastify: FastifyInstance) => {
  fastify.get(
    "/me",
    { preHandler: [fastify.verifyUser] },
    async (req, reply) => {
      const projects = await getProjectsForUser(fastify.db, req.dbUser.id);
      reply.send(projects);
    },
  );
};

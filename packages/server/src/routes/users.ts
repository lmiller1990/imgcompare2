import { getProjectsForUser } from "../db/projects.ts";
import type { FastifyInstance } from "fastify";

export const userRoutesPlugin = async (fastify: FastifyInstance) => {
  fastify.get(
    "/me",
    { preHandler: [fastify.verifyUser] },
    async (req, reply) => {
      const projects = await getProjectsForUser(fastify.db, req.dbUser.id);
      reply.send({ projects });
    },
  );
};

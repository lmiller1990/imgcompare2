import type { FastifyInstance } from "fastify";
import { services } from "../services/index.ts";

export const projectRoutesPlugin = async (fastify: FastifyInstance) => {
  fastify.post<{ Body: { name: string } }>(
    "/projects",
    {
      preHandler: [fastify.verifyJwt],
    },
    async (req, reply) => {
      const { email } = req.user as { email: string };
      const project = await services.projectService.createProject(
        req.body.name,
        email,
      );
      if (!project) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      reply.code(201).send(project);
    },
  );
};

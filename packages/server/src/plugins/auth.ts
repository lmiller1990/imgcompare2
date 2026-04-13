import fp from "fastify-plugin";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { projects, users } from "../db/schema.ts";
import { and, eq } from "drizzle-orm";

export const verifyProjectAccessPlugin = fp(async (fastify) => {
  fastify.decorate(
    "verifyProjectAccess",
    async function (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) {
      const { email } = request.user as { email: string };
      const q = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email));
      const user = q?.[0];
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const p = await fastify.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.ownerUserId, user.id),
            eq(projects.id, request.params.projectId),
          ),
        );

      const project = p?.[0];
      if (!project) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
  );
});

export const verifyJwtPlugin = fp(async (fastify) => {
  fastify.decorate(
    "verifyJwt",
    async function (request: FastifyRequest, reply: FastifyReply) {
      await request.jwtVerify();
    },
  );
});

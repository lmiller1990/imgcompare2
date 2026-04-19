import fp from "fastify-plugin";
import { projects, users } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { getProjectWithRunsAndBaseline } from "../db/queries.ts";

export const projectRoutesPlugin = fp(async (fastify) => {
  fastify.post<{ Body: { name: string } }>(
    "/projects",
    {
      preHandler: [fastify.verifyJwt],
    },
    async (req, reply) => {
      const { email } = req.user as { email: string };
      const q = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email));
      const user = q?.[0];
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const inserted = await fastify.db
        .insert(projects)
        .values({
          name: req.body.name,
          ownerUserId: user.id,
        })
        .returning();

      reply.code(201).send(inserted[0]);
    },
  );

  // fastify.get<{ Params: { projectId: string } }>(
  //   "/projects/:projectId",
  //   {
  //     preHandler: [fastify.verifyJwt],
  //   },
  //   async (req, reply) => {
  //     const project = await getProjectWithRunsAndBaseline(
  //       fastify.db,
  //       req.params.projectId,
  //     );

  //     if (!project) {
  //       return reply.code(404).send({ error: "Not found" });
  //     }

  //     reply.send(project);
  //   },
  // );
});

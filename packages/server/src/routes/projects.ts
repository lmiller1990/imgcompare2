import { projects, users } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export const projectRoutesPlugin = async (fastify: FastifyInstance) => {
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

  fastify.post<{ Params: { id: string }; Body: { token: string } }>(
    "/projects/:id/token",
    { preHandler: [fastify.verifyJwt] },
    async (req, reply) => {
      const ciphertext = await fastify.secrets.encrypt(
        req.body.token,
        req.params.id,
      );

      await fastify.db
        .update(projects)
        .set({ ciTokenCiphertext: ciphertext })
        .where(eq(projects.id, req.params.id));

      reply.code(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/token",
    { preHandler: [fastify.verifyJwt] },
    async (req, reply) => {
      const rows = await fastify.db
        .select({ ciTokenCiphertext: projects.ciTokenCiphertext })
        .from(projects)
        .where(eq(projects.id, req.params.id));

      const row = rows[0];
      if (!row || !row.ciTokenCiphertext) {
        return reply.code(404).send({ error: "Not found" });
      }

      const token = await fastify.secrets.decrypt(
        row.ciTokenCiphertext,
        req.params.id,
      );
      reply.send({ token });
    },
  );
};

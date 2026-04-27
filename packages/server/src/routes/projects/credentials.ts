import { ciTokens } from "../../db/schema.ts";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CredentialService } from "../../services/credentialService.ts";

export const projectCredentialsRoutesPlugin = async (
  fastify: FastifyInstance,
) => {
  const credentialService = new CredentialService(fastify.db);

  fastify.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/credentials",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const existing = await credentialService.getActive(req.params.projectId);
      if (existing) {
        return reply.code(409).send({
          error:
            "An active credential already exists. Revoke it before generating a new one.",
        });
      }

      const credential = await credentialService.create(req.params.projectId);
      reply.code(201).send({
        clientId: credential.clientId,
        clientSecret: credential.clientSecret,
      });
    },
  );

  fastify.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/credentials",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const credential = await credentialService.getActive(
        req.params.projectId,
      );
      if (!credential) {
        return reply.code(404).send({ error: "Not found" });
      }
      reply.send({ clientId: credential.clientId });
    },
  );

  fastify.delete<{ Params: { projectId: string } }>(
    "/projects/:projectId/credentials",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const revoked = await credentialService.revoke(req.params.projectId);
      if (!revoked) {
        return reply.code(404).send({ error: "Not found" });
      }
      reply.code(204).send();
    },
  );

  fastify.post<{
    Params: { projectId: string };
    Body: { provider: string; token: string };
  }>(
    "/projects/:projectId/token",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const { projectId } = req.params;
      const { provider, token } = req.body;

      const ciphertext = await fastify.secrets.encrypt(token, projectId);

      await fastify.db
        .insert(ciTokens)
        .values({ projectId, provider, ciphertext })
        .onConflictDoUpdate({
          target: [ciTokens.projectId, ciTokens.provider],
          set: { ciphertext },
        });

      reply.code(204).send();
    },
  );

  fastify.get<{ Params: { projectId: string; provider: string } }>(
    "/projects/:projectId/token/:provider",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const { projectId, provider } = req.params;

      const rows = await fastify.db
        .select({ ciphertext: ciTokens.ciphertext })
        .from(ciTokens)
        .where(
          and(
            eq(ciTokens.projectId, projectId),
            eq(ciTokens.provider, provider),
          ),
        );

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({ error: "Not found" });
      }

      const token = await fastify.secrets.decrypt(row.ciphertext, projectId);
      const hint = token.slice(0, 6) + "..." + token.slice(-4);
      reply.send({ hint, provider });
    },
  );

  fastify.delete<{ Params: { projectId: string; provider: string } }>(
    "/projects/:projectId/token/:provider",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const { projectId, provider } = req.params;

      const deleted = await fastify.db
        .delete(ciTokens)
        .where(
          and(
            eq(ciTokens.projectId, projectId),
            eq(ciTokens.provider, provider),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        return reply.code(404).send({ error: "Not found" });
      }

      reply.code(204).send();
    },
  );
};

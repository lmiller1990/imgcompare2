import { projects } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
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
      const ciphertext = await fastify.secrets.encrypt(
        req.body.token,
        req.params.projectId,
      );

      await fastify.db
        .update(projects)
        .set({
          ciTokenCiphertext: ciphertext,
          ciTokenProvider: req.body.provider,
        })
        .where(eq(projects.id, req.params.projectId));

      reply.code(204).send();
    },
  );

  fastify.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/token",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const rows = await fastify.db
        .select({
          ciTokenCiphertext: projects.ciTokenCiphertext,
          ciTokenProvider: projects.ciTokenProvider,
        })
        .from(projects)
        .where(eq(projects.id, req.params.projectId));

      const row = rows[0];
      if (!row || !row.ciTokenCiphertext) {
        return reply.code(404).send({ error: "Not found" });
      }

      const token = await fastify.secrets.decrypt(
        row.ciTokenCiphertext,
        req.params.projectId,
      );
      const hint = token.slice(0, 6) + "..." + token.slice(-4);
      reply.send({ hint, provider: row.ciTokenProvider });
    },
  );

  fastify.delete<{ Params: { projectId: string } }>(
    "/projects/:projectId/token",
    { preHandler: [fastify.verifyJwt, fastify.verifyProjectAccess] },
    async (req, reply) => {
      const rows = await fastify.db
        .select({ ciTokenCiphertext: projects.ciTokenCiphertext })
        .from(projects)
        .where(eq(projects.id, req.params.projectId));

      const row = rows[0];
      if (!row || !row.ciTokenCiphertext) {
        return reply.code(404).send({ error: "Not found" });
      }

      await fastify.db
        .update(projects)
        .set({ ciTokenCiphertext: null, ciTokenProvider: null })
        .where(eq(projects.id, req.params.projectId));

      reply.code(204).send();
    },
  );
};

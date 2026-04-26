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
};

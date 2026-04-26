import type { FastifyInstance } from "fastify";
import { CredentialService } from "../services/credentialService.ts";

export const authRoutesPlugin = async (fastify: FastifyInstance) => {
  const credentialService = new CredentialService(fastify.db);

  fastify.post<{ Body: { clientId: string; clientSecret: string } }>(
    "/auth/token",
    async (req, reply) => {
      const credential = await credentialService.verifySecret(
        req.body.clientId,
        req.body.clientSecret,
      );

      if (!credential) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const token = fastify.jwt.sign(
        { projectId: credential.projectId, type: "service" },
        { expiresIn: "15m" },
      );

      reply.send({ token });
    },
  );
};

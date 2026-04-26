import fp from "fastify-plugin";
import { LocalSecretService } from "../services/encryption.ts";

export const secretsPlugin = fp(async (fastify) => {
  fastify.decorate("secrets", LocalSecretService.fromEnv());
});

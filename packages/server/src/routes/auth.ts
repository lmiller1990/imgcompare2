import bcrypt from "bcrypt";
import { users } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CredentialService } from "../services/credentialService.ts";

const SALT_ROUNDS = 12;
const cookieOpts = { httpOnly: true, sameSite: "strict", path: "/" } as const;

export const authRoutesPlugin = async (fastify: FastifyInstance) => {
  const credentialService = new CredentialService(fastify.db);

  fastify.post<{ Body: { email: string; password: string } }>(
    "/signup",
    async (req, reply) => {
      const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      await fastify.db
        .insert(users)
        .values({ email: req.body.email, password: hash });
      const token = fastify.jwt.sign({ email: req.body.email });
      reply.setCookie("token", token, cookieOpts);
      reply.send({ token });
    },
  );

  fastify.post<{ Body: { email: string; password: string } }>(
    "/login",
    async (req, reply) => {
      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, req.body.email))
        .limit(1);

      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(req.body.password, user.password);
      if (!ok) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const token = fastify.jwt.sign({ email: req.body.email });
      reply.setCookie("token", token, cookieOpts);
      reply.send({ token });
    },
  );

  fastify.post("/logout", async (req, reply) => {
    reply.clearCookie("token", cookieOpts);
    reply.send({ ok: true });
  });

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
        { expiresIn: "1h" },
      );

      reply.send({ token });
    },
  );
};

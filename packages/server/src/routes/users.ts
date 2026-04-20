import fp from "fastify-plugin";
import bcrypt from "bcrypt";
import { users } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { getProjectsForUser } from "../db/projects.ts";

const salt = 12;

const cookieOpts = { httpOnly: true, sameSite: "strict", path: "/" } as const;

export const userRoutesPlugin = fp(async (fastify) => {
  fastify.post<{ Body: { email: string; password: string } }>(
    "/signup",
    async (req, reply) => {
      const token = fastify.jwt.sign({ email: req.body.email });
      const hash = await bcrypt.hash(req.body.password, salt);
      await fastify.db
        .insert(users)
        .values({ email: req.body.email, password: hash });
      reply.setCookie("token", token, cookieOpts);
      reply.send({ token });
    },
  );

  fastify.post<{ Body: { email: string; password: string } }>(
    "/login",
    async (req, reply) => {
      const q = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, req.body.email));
      const user = q?.[0];
      if (!user) {
        return reply.code(401).send({
          error: "Invalid credentials",
        });
      }

      const ok = await bcrypt.compare(req.body.password, user.password);
      if (!ok) {
        return reply.code(401).send({
          error: "Invalid credentials",
        });
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

  fastify.get<{ Body: { name: string } }>(
    "/me",
    {
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const projects = await getProjectsForUser(fastify.db, req.dbUser.id);

      reply.send({ projects });
    },
  );
});

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import "dotenv/config";
import fastifyAuth from "@fastify/auth";
import {
  verifyJwtPlugin,
  verifyProjectAccessPlugin,
  verifyUserPlugin,
} from "./plugins/auth.ts";
import { userRoutesPlugin } from "./routes/users.ts";
import { projectRoutesPlugin } from "./routes/projects.ts";
import { dbPlugin } from "./plugins/db.ts";
import { projectRunsRoutesPlugin } from "./routes/projects/runs.ts";
import type { DB } from "./index.ts";

interface CreateAppOptions {
  db: DB;
}

export async function createApp(
  options: CreateAppOptions,
): Promise<{ fastify: FastifyInstance }> {
  const { db } = options;

  const fastify = Fastify({ logger: { level: "debug" } })
    .register(dbPlugin, { db })
    .register(fastifyCookie)
    .register(fastifyJwt, {
      secret: "secret123",
      cookie: { cookieName: "token", signed: false },
    })
    .register(fastifyAuth)
    .register(verifyUserPlugin)
    .register(verifyJwtPlugin)
    .register(verifyProjectAccessPlugin)
    .register(multipart)
    .register(userRoutesPlugin)
    .register(projectRoutesPlugin)
    .register(projectRunsRoutesPlugin);

  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  return { fastify };
}

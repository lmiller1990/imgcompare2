import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import "dotenv/config";
import fastifyAuth from "@fastify/auth";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyJwtPlugin,
  verifyProjectAccessPlugin,
  verifyUserPlugin,
} from "./plugins/auth.ts";
import { userRoutesPlugin } from "./routes/users.ts";
import { projectRoutesPlugin } from "./routes/projects.ts";
import { dbPlugin } from "./plugins/db.ts";
import { secretsPlugin } from "./plugins/secrets.ts";
import { projectRunsRoutesPlugin } from "./routes/projects/runs.ts";
import { projectCredentialsRoutesPlugin } from "./routes/projects/credentials.ts";
import { authRoutesPlugin } from "./routes/auth.ts";
import type { DB } from "./db/index.ts";

interface CreateAppOptions {
  db: DB;
}

export async function createApp(
  options: CreateAppOptions,
): Promise<{ fastify: FastifyInstance }> {
  const { db } = options;

  const fastify = Fastify({ logger: { level: "debug" } })
    .register(dbPlugin, { db })
    .register(secretsPlugin)
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
    // routes
    .register(userRoutesPlugin, { prefix: "/api" })
    .register(projectRoutesPlugin, { prefix: "/api" })
    .register(projectRunsRoutesPlugin, { prefix: "/api" })
    .register(projectCredentialsRoutesPlugin, { prefix: "/api" })
    .register(authRoutesPlugin, { prefix: "/api" });

  fastify.addContentTypeParser(
    "image/png",
    { parseAs: "buffer" },
    (req, body, done) => {
      done(null, body);
    },
  );

  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  // In production the built Vue app is copied to ./public (see Dockerfile) and
  // served from the same origin as the API, so there is no separate frontend
  // or nginx container. In dev the folder is absent and Vite serves the app.
  const publicDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../public",
  );
  if (fs.existsSync(publicDir)) {
    fastify.register(fastifyStatic, { root: publicDir, wildcard: false });

    // SPA fallback: any non-API GET that didn't match a static file or route
    // returns index.html so client-side routing works on deep links/refresh.
    fastify.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not Found" });
    });
  }

  return { fastify };
}

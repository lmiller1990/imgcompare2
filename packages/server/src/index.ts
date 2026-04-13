import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import multipart, { type MultipartFile } from "@fastify/multipart";
import fastifyJwt from "@fastify/jwt";
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcrypt";
import { users, projects, runs, snapshots } from "./db/schema.ts";
import { and, eq } from "drizzle-orm";
import { S3SnapshotService } from "./services/s3.ts";
import path from "node:path";
import fastifyAuth from "@fastify/auth";
import { fileURLToPath } from "node:url";

const salt = 12;
const db = drizzle(process.env.DATABASE_URL!);
const rootBucket = "lcm-au-imgcompare-screenshots";

// Export for testing
export const fastify = Fastify({ logger: { level: "debug" } })
  .register(multipart)
  .register(fastifyJwt, { secret: "secret123" })
  .register(fastifyAuth);

fastify.decorate(
  "verifyJwt",
  async function (request: FastifyRequest, reply: FastifyReply) {
    await request.jwtVerify();
    console.log(">>>>>>>>>>>>",request.user)
  },
);

fastify.decorate(
  "verifyProjectAccess",
  async function (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) {
    const { email } = request.user as { email: string };
    const q = await db.select().from(users).where(eq(users.email, email));
    const user = q?.[0];
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const p = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.ownerUserId, user.id), eq(projects.id, request.params.projectId)),
      );

    const project = p?.[0];
    if (!project) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  },
);


fastify.get("/health", async () => {
  return { status: "ok" };
});

export const logger = fastify.log;

fastify.post<{ Body: { email: string; password: string } }>(
  "/signup",
  async (req, reply) => {
    const token = fastify.jwt.sign({ email: req.body.email });
    const hash = await bcrypt.hash(req.body.password, salt);
    await db.insert(users).values({ email: req.body.email, password: hash });
    reply.send({ token });
  },
);

fastify.post<{ Body: { email: string; password: string } }>(
  "/login",
  async (req, reply) => {
    const q = await db
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
    reply.send({ token });
  },
);

fastify.post<{ Body: { name: string } }>(
  "/projects",
  {
    preHandler: [fastify.verifyJwt],
  },
  async (req, reply) => {
    const { email } = req.user as { email: string };
    const q = await db.select().from(users).where(eq(users.email, email));
    const user = q?.[0];
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const inserted = await db
      .insert(projects)
      .values({
        name: req.body.name,
        ownerUserId: user.id,
      })
      .returning();

    reply.code(201).send(inserted[0]);
  },
);

fastify.post<{ Params: { projectId: string } }>(
  "/projects/:projectId/runs",
  {
    preHandler: [fastify.verifyJwt],
  },
  async (req, reply) => {
    const { email } = req.user as { email: string };

    const q = await db.select().from(users).where(eq(users.email, email));
    console.log(q, email)
    const user = q?.[0];
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const p = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.ownerUserId, user.id), eq(projects.id, req.params.projectId)),
      );

    const project = p?.[0];
    if (!project) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const inserted = await db
      .insert(runs)
      .values({
        projectId: req.params.projectId,
      })
      .returning();

    reply.code(201).send(inserted[0]);
  },
);

type RunUpdate = Partial<typeof runs.$inferInsert>;

fastify.patch<{
  Params: { projectId: string; runId: string };
  Body: RunUpdate;
}>(
  "/projects/:projectId/run/:runId",
  {
    preHandler: [fastify.verifyJwt],
  },
  async (req, reply) => {
    const { id, projectId, ...rest } = req.body;

    await db
      .update(runs)
      .set(rest)
      .where(
        and(
          eq(runs.id, req.params.runId),
          eq(runs.projectId, req.params.projectId),
        ),
      );

    reply.code(202).send();
  },
);

fastify.post<{ Params: { projectId: string; runId: string } }>(
  "/projects/:projectId/run/:runId/finalize",

  {
    preHandler: [fastify.verifyJwt],
  },
  async (req, reply) => {
    const snapshotService = new S3SnapshotService(path.join(rootBucket));
    await snapshotService.ensureDirExists();

    let manifest: string[] = [];
    const files: MultipartFile[] = [];

    for await (const part of req.parts()) {
      if (part.type === "field" && part.fieldname === "manifest") {
        manifest = JSON.parse(part.value as string);
        continue;
      }

      if (part.type === "file" && part.fieldname === "screenshots") {
        files.push(part);
      }
    }

    if (manifest.length !== files.length) {
      throw Error(
        `Expected manifest to have exactly one entry per file. Got manifest.length ${manifest.length} files.length ${files.length}`,
      );
    }

    // now process once you have both
    for (let i = 0; i < files.length; i++) {
      const fullPath = manifest?.[i]!;
      const file = files[i]!;
      req.log.info(`File with path ${fullPath} received. File is %o`, file);

      req.log.debug(`Received screenshot ${file.filename}`);
      const imageS3Path = `${req.params.runId}/${file.filename}`;
      await snapshotService.store(imageS3Path, file);
      req.log.child({ file: file.filename }).debug("Uploaded file");

      await db.insert(snapshots).values({
        runId: req.params.runId,
        name: fullPath,
        status: "pending",
        diffS3Path: undefined,
        imageS3Path,
      });
    }

    reply.send();
  },
);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await fastify.listen({ port: 8070 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

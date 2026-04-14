import fp from "fastify-plugin";
import { type MultipartFile } from "@fastify/multipart";
import "dotenv/config";
import {
  users,
  snapshots,
  runs,
  projects,
  runApprovals,
  baselines,
} from "../../db/schema.ts";
import { and, eq } from "drizzle-orm";
import { S3SnapshotService } from "../../services/s3.ts";
import path from "node:path";

const rootBucket = "lcm-au-imgcompare-screenshots";

export const projectRunsRoutesPlugin = fp(async (fastify) => {
  fastify.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/runs",
    {
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const { email } = req.user as { email: string };

      const q = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email));
      const user = q?.[0];
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const p = await fastify.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.ownerUserId, user.id),
            eq(projects.id, req.params.projectId),
          ),
        );

      const project = p?.[0];
      if (!project) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const inserted = await fastify.db
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
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const { id, projectId, ...rest } = req.body;

      await fastify.db
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
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const snapshotService = new S3SnapshotService(
        path.join(rootBucket),
        req.log,
      );
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

        await fastify.db.insert(snapshots).values({
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

  fastify.post<{ Params: { projectId: string; runId: string } }>(
    "/projects/:projectId/run/:runId/approve",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      const ra = await fastify.db
        .insert(runApprovals)
        .values({
          runId: req.params.runId,
          approvedByUserId: req.dbUser.id,
        })
        .returning()
        .then((res) => res?.[0]!);

      const bl = await fastify.db.insert(baselines).values({
        sourceRunId: req.params.runId,
        createdByUserId: req.dbUser.id,
        isActive: true,
      });
      reply.send();
    },
  );
});

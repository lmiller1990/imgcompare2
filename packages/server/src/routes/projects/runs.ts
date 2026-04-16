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
import { s3, S3SnapshotService } from "../../services/s3.ts";
import path from "node:path";
import {
  getActiveBaselineForProject,
  getRunById,
  getRunsForProject,
  mappers,
  patchRun,
} from "../../db/queries.ts";
import { PresignedUrlService } from "../../services/presignedUrls.ts";
import type { Result, Snapshot } from "../../domain.ts";

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
          imageS3Path,
        });
      }

      await patchRun(fastify.db, req.params.runId, {
        completedAt: new Date(),
        status: "completed",
      });

      // find project baseline
      const bl = await getActiveBaselineForProject(
        fastify.db,
        req.params.projectId,
      );

      if (!bl) {
        // no baseline - UI shall prompt user to simply "accept all"
        return reply.send();
      }
    },
  );

  fastify.post<{ Params: { projectId: string; runId: string } }>(
    "/projects/:projectId/runs/:runId/approve",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      await fastify.db.insert(runApprovals).values({
        runId: req.params.runId,
        approvedByUserId: req.dbUser.id,
      });

      await fastify.db.insert(baselines).values({
        projectId: req.params.projectId,
        sourceRunId: req.params.runId,
        createdByUserId: req.dbUser.id,
        isActive: true,
      });

      reply.send();
    },
  );

  fastify.get<{
    Params: { projectId: string };
  }>(
    "/projects/:projectId/runs",
    {
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const runs = await getRunsForProject(fastify.db, req.params.projectId);

      reply.send(runs);
    },
  );

  fastify.get<{
    Params: { projectId: string; runId: string };
    Reply: RunWithResultDto | undefined;
  }>(
    "/projects/:projectId/runs/:runId",
    {
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const baseline = await getActiveBaselineForProject(
        fastify.db,
        req.params.projectId,
      );
      const run = await getRunById(fastify.db, req.params.runId);
      if (!run) {
        return reply.status(401).send(undefined);
      }

      const presignedUrlService = new PresignedUrlService(s3);

      const snapshotInputs = run.snapshots.map((s) => ({
        original: s,
        domain: mappers.snapshot.toDomain(s),
      }));

      const baselineInputs = baseline
        ? baseline.run.snapshots.map((s) => ({
            original: s,
            domain: mappers.snapshot.toDomain(s),
          }))
        : [];

      const snapshotUrls = await presignedUrlService.generateBatchPresignedUrls(
        snapshotInputs.map((i) => i.domain),
        { bucket: rootBucket },
      );

      const baselineUrls = baseline
        ? await presignedUrlService.generateBatchPresignedUrls(
            baselineInputs.map((i) => i.domain),
            { bucket: rootBucket },
          )
        : [];

      // can these be missing??
      const snapshotsWithUrls: Snapshot[] = snapshotInputs.map((input, i) => ({
        ...input.original,
        imagePath: snapshotUrls[i]!,
      }));

      const baselineWithUrls: Snapshot[] = baselineInputs.map((input, i) => ({
        ...input.original,
        imagePath: baselineUrls[i]!,
      }));

      const results = mergeByName(baselineWithUrls, snapshotsWithUrls);

      reply.send({ run, results });
    },
  );
});

function mergeByName(baseline: Snapshot[], snapshots: Snapshot[]): Result[] {
  const baselineMap = new Map(baseline.map((i) => [i.name, i]));
  const snapshotMap = new Map(snapshots.map((i) => [i.name, i]));

  const allNames = new Set([...baselineMap.keys(), ...snapshotMap.keys()]);

  return Array.from(allNames).map((name) => {
    const baseline = baselineMap.get(name);
    const snapshot = snapshotMap.get(name);

    let result: Result = { name };
    if (baseline) {
      result.baseline = { snapshotId: baseline.id, url: baseline.imagePath };
    }

    if (snapshot) {
      result.snapshot = { snapshotId: snapshot.id, url: snapshot.imagePath };
    }

    return result;
  });
}

export interface RunWithResultDto {
  results: Result[];
  run: Awaited<ReturnType<typeof getRunById>>;
}

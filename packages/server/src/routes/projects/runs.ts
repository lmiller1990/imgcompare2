import "dotenv/config";
import {
  snapshots,
  runs,
  projects,
  runApprovals,
  baselines,
} from "../../db/schema.ts";
import { and, eq } from "drizzle-orm";
import { rootBucket, s3 } from "../../services/s3.ts";
import {
  findComparisonsForCompleteResults,
  getActiveBaselineForProject,
  getProjectWithRunsAndBaseline,
  getRunById,
  getRunsForProject,
  insertRun,
  insertRunManifest,
  insertRunSource,
  mappers,
  mapRun,
  patchRun,
} from "../../db/queries.ts";
import { PresignedUrlService } from "../../services/presignedUrls.ts";
import {
  isCompleteResult,
  type Comparison,
  type Result,
  type Run,
  type RunWithSource,
  type Snapshot,
} from "../../domain.ts";
import type { GitInfo, RunManifest } from "@packages/domain/src/domain.ts";
import { Queue } from "bullmq";
import {
  getDb,
  services,
  type SnapshotComparisonWorkerPayload,
} from "../../index.ts";
import { DateTime } from "luxon";
import pino from "pino";
import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";

const queue = new Queue<SnapshotComparisonWorkerPayload>("diff");

const logger = pino({
  level: "debug",
});

export const projectRunsRoutesPlugin = async (fastify: FastifyInstance) => {
  fastify.post<{ Params: { projectId: string }; Body: { gitinfo: GitInfo } }>(
    "/projects/:projectId/runs",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      logger.info({ gitinfo: req.body.gitinfo }, "got new run");
      const p = await fastify.db
        .select()
        .from(projects)
        .where(and(eq(projects.id, req.params.projectId)));

      const run = await insertRun(fastify.db, req.params.projectId);

      if (req.body.gitinfo) {
        await insertRunSource(fastify.db, run, req.body.gitinfo);
      }

      reply.code(201).send(run);
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

  // we need to know how many screenshots we *expect*
  // so we know when we've got them all.
  fastify.post<{
    Params: { projectId: string; runId: string };
    Body: RunManifest;
  }>(
    "/projects/:projectId/run/:runId/precommit",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      req.log.debug({ manifest: req.body }, `Got manifest`);
      await insertRunManifest(fastify.db, {
        runId: req.params.runId,
        manifest: req.body,
      });
      reply.status(203).send();
    },
  );

  fastify.post<{
    Params: { projectId: string; runId: string };
    Body: Buffer;
    Headers: {
      "content-type": string;
      "x-path": string;
      "x-name": string;
    };
  }>(
    "/projects/:projectId/run/:runId/screenshots",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      await services.snapshotService.ensureDirExists();
      const fpath = req.headers["x-path"];
      const fname = req.headers["x-name"];

      logger.info(`Received screenshot ${fpath}`);
      const imageS3Path = `${req.params.runId}/${req.headers["x-name"]}`;

      // logger.info(
      //   `File with path ${fullPath} received. File is ${JSON.stringify(file)}`,
      // );

      logger.info(`Received screenshot. name: ${fname} path: ${fpath}`);

      // const imageS3Path = `${req.params.runId}/${file.filename}`;

      try {
        await services.snapshotService.store(imageS3Path, {
          mimetype: req.headers["content-type"],
          file: Readable.from(req.body),
        });

        await fastify.db.insert(snapshots).values({
          runId: req.params.runId,
          name: fpath,
          status: "pending",
          imageS3Path,
        });
      } catch (e) {
        logger.error(
          `Failed to upload ${fpath} to ${imageS3Path} with error ${e}`,
        );
      }
    },
  );

  fastify.post<{ Params: { projectId: string; runId: string } }>(
    "/projects/:projectId/run/:runId/finalize",
    {
      preHandler: [fastify.verifyUser, fastify.verifyProjectAccess],
    },
    async (req, reply) => {
      logger.info(`Received finalize request for run ${req.params.runId}`);

      await patchRun(fastify.db, req.params.runId, {
        completedAt: new Date(),
      });

      // find project baseline
      const bl = await getActiveBaselineForProject(
        fastify.db,
        req.params.projectId,
      );

      if (!bl) {
        logger.info("No baseline - skipping comparison!");
        // no baseline - UI shall prompt user to simply "accept all"
        return reply.send();
      }

      const run = await getRunById(fastify.db, req.params.runId);
      // comparison time
      const blSnapshots = bl.run.snapshots.map(mappers.snapshot.toDomain);
      const incomingSnapshots = run.snapshots.map(mappers.snapshot.toDomain);
      const results = mergeByName(blSnapshots, incomingSnapshots);

      for (const result of results) {
        req.log.child({ result }).debug("Running comparison");
        queue.add("comparison", {
          result,
          runId: req.params.runId,
        });
      }

      return reply.send();
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
    Reply: ProjectView;
  }>(
    "/projects/:projectId/runs",
    {
      preHandler: [fastify.verifyUser],
    },
    async (req, reply) => {
      const project = await getProjectWithRunsAndBaseline(
        fastify.db,
        req.params.projectId,
      );
      const runs = await getRunsForProject(fastify.db, req.params.projectId);
      const activeBaseline = await getActiveBaselineForProject(
        fastify.db,
        req.params.projectId,
      );

      const sortedRuns = runs.toSorted(
        (x, y) =>
          +DateTime.fromISO(y.createdAt, { zone: "utc" }) -
          +DateTime.fromISO(x.createdAt, { zone: "utc" }),
      );
      reply.send({
        name: project!.name,
        runs: sortedRuns,
        activeBaseline: activeBaseline ? mapRun(activeBaseline.run) : undefined,
      });
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
        snapshotInputs.map((i) => i.domain.imagePath),
        { bucket: rootBucket },
      );

      const baselineUrls = baseline
        ? await presignedUrlService.generateBatchPresignedUrls(
            baselineInputs.map((i) => i.domain.imagePath),
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
      const comparisons = await mergeComparisonForCompletedResults(results);
      const presigned = await presignedUrlService.generateBatchPresignedUrls(
        comparisons.map((x) => x.diff.imagePath),
        { bucket: rootBucket },
      );

      comparisons.forEach((comparison, i) => {
        if (!comparison.diff) {
          throw new Error("Comparison always expected to have `diff`");
        }
        if (!presigned[i]) {
          throw new Error("Failed to generate presigned URL");
        }
        comparison.diff.imagePath = presigned[i];
      });

      const reviewableResult = createReviewableRun(results, comparisons);

      reply.send({
        run,
        reviewableResult,
      });
    },
  );
};

export interface ProjectView {
  name: string;
  activeBaseline: Run | undefined;
  runs: RunWithSource[];
}

type NullableComparison = Partial<Comparison> & { name: string };

export interface ReviewableResult {
  name: string;
  baseline: Snapshot | undefined;
  snapshot: Snapshot | undefined;
  comparison: Comparison | undefined;
}

function createReviewableRun(
  results: Result[],
  comparisons: Comparison[],
): ReviewableResult[] {
  const comparisonByName = new Map<string, Comparison>();

  for (const c of comparisons) {
    comparisonByName.set(c.baseline.name, c);
  }

  return results.map((r) => {
    const comparison = comparisonByName.get(r.name);

    return {
      name: r.name,
      baseline: r.baseline,
      snapshot: r.snapshot,
      comparison,
    };
  });
}

async function mergeComparisonForCompletedResults(
  results: Result[],
): Promise<Comparison[]> {
  const completeResults = results.filter(isCompleteResult);
  const tuples = completeResults.map(
    (x) => [x.baseline.id, x.snapshot.id] as [string, string],
  );
  logger
    .child({ tuples })
    .debug("findComparisonsForCompleteResults with tuplse");
  if (!tuples.length) {
    return [];
  }
  return await findComparisonsForCompleteResults(getDb(), tuples);
}

function mergeByName(baseline: Snapshot[], snapshots: Snapshot[]): Result[] {
  const baselineMap = new Map(baseline.map((i) => [i.name, i]));
  const snapshotMap = new Map(snapshots.map((i) => [i.name, i]));

  const allNames = new Set([...baselineMap.keys(), ...snapshotMap.keys()]);

  return Array.from(allNames).map((name) => {
    const baseline = baselineMap.get(name);
    const snapshot = snapshotMap.get(name);

    let result: Result = { name };

    if (baseline) {
      result.baseline = baseline;
    }

    if (snapshot) {
      result.snapshot = snapshot;
    }

    return result;
  });
}

export interface RunWithResultDto {
  reviewableResult: ReviewableResult[];
  run: Awaited<ReturnType<typeof getRunById>>;
}

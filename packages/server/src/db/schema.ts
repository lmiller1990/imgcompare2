import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  primaryKey,
  unique,
  numeric,
  integer,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  s3BucketUuid: uuid("s3_bucket_uuid").defaultRandom().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    runNumber: integer().notNull(),
    snapshotsProcessed: integer().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    {
      projectRunUnique: unique().on(t.projectId, t.runNumber),
    },
  ],
);

export const runSources = pgTable("run_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .unique()
    .references(() => runs.id, { onDelete: "cascade" }),

  // Git metadata
  branch: text("branch"),
  // For all -> provier. Supported: "gitlab"
  //  For gitlab -> CI_PROJECT_ID
  // Null when run locally
  ciMetadata: jsonb("ci_metadata"),
  commitHash: text("commit_hash"),
  authorEmail: text("author_email"),
  authorName: text("author_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imageS3Path: text("image_s3_path").notNull(),
  status: text("status").notNull(),
});

export const runApprovals = pgTable("run_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  approvedByUserId: uuid("approved_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Idempotent guard
export const runCompletions = pgTable(
  "run_completions",
  {
    runId: text("run_id").notNull(),
    jobId: text("job_id").notNull(),
  },
  (t) => [
    {
      pk: primaryKey({ columns: [t.runId, t.jobId] }),
    },
  ],
);

export const runManifests = pgTable("run_manifests", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  manifest: jsonb("manifest").notNull(),
});

export const baselines = pgTable("baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceRunId: uuid("source_run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "restrict" }),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const comparisons = pgTable(
  "comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baselineSnapshotId: uuid("baseline_snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "restrict" }),
    currentSnapshotId: uuid("current_snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "restrict" }),

    imageS3Path: text("image_s3_path").notNull(),
    difference: numeric({
      precision: 5,
      scale: 4,
      mode: "number",
    }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.baselineSnapshotId, t.currentSnapshotId)],
);

export const ciTokens = pgTable(
  "ci_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.projectId, t.provider)],
);

export const clientCredentials = pgTable("client_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  baselines: many(baselines),
  runs: many(runs),
}));

export const baselinesRelations = relations(baselines, ({ one }) => ({
  project: one(projects, {
    fields: [baselines.projectId],
    references: [projects.id],
  }),
  run: one(runs, {
    fields: [baselines.sourceRunId],
    references: [runs.id],
  }),
}));

export const runSourcesRelations = relations(runSources, ({ one }) => ({
  run: one(runs, {
    fields: [runSources.runId],
    references: [runs.id],
  }),
}));

export const runManifestRelations = relations(runSources, ({ one }) => ({
  run: one(runs, {
    fields: [runSources.runId],
    references: [runs.id],
  }),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, {
    fields: [runs.projectId],
    references: [projects.id],
  }),
  snapshots: many(snapshots),
  source: one(runSources),
  manifest: one(runManifests),
  approval: one(runApprovals),
}));

export const runApprovalsRelationss = relations(
  runApprovals,
  ({ one, many }) => ({
    run: one(runs, {
      fields: [runApprovals.runId],
      references: [runs.id],
    }),
  }),
);

export const snapshotsRelations = relations(snapshots, ({ one, many }) => ({
  run: one(runs, {
    fields: [snapshots.runId],
    references: [runs.id],
  }),
  baselineComparisons: many(comparisons, { relationName: "baselineSnapshot" }),
  currentComparisons: many(comparisons, { relationName: "currentSnapshot" }),
}));

export const comparisonsRelations = relations(comparisons, ({ one }) => ({
  baselineSnapshot: one(snapshots, {
    relationName: "baselineSnapshot",
    fields: [comparisons.baselineSnapshotId],
    references: [snapshots.id],
  }),
  currentSnapshot: one(snapshots, {
    relationName: "currentSnapshot",
    fields: [comparisons.currentSnapshotId],
    references: [snapshots.id],
  }),
}));

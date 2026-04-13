import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core'


export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  s3BucketUuid: uuid('s3_bucket_uuid').defaultRandom().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// export const usersRelations = relations(users, ({ many }) => ({
//   ownedProjects: many(projects),
// }))

// export const relations = define

// export const projectMembers = pgTable(
//   'project_members',
//   {
//     projectId: uuid('project_id')
//       .notNull()
//       .references(() => projects.id, { onDelete: 'cascade' }),
//     userId: uuid('user_id')
//       .notNull()
//       .references(() => users.id, { onDelete: 'cascade' }),
//     role: text('role').notNull().default('viewer'),
//     createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
//   },
//   (table) => [primaryKey({ columns: [table.projectId, table.userId] })]
// )

// export const apiKeys = pgTable('api_keys', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   projectId: uuid('project_id')
//     .notNull()
//     .references(() => projects.id, { onDelete: 'cascade' }),
//   keyHash: text('key_hash').unique().notNull(),
//   name: text('name').notNull(),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
//   revokedAt: timestamp('revoked_at', { withTimezone: true }),
// })

// export const runs = pgTable('runs', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   projectId: uuid('project_id')
//     .notNull()
//     .references(() => projects.id, { onDelete: 'cascade' }),
//   createdByApiKeyId: uuid('created_by_api_key_id').references(() => apiKeys.id, {
//     onDelete: 'set null',
//   }),
//   status: text('status').notNull().default('pending'),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
//   completedAt: timestamp('completed_at', { withTimezone: true }),
// })

// export const snapshots = pgTable('snapshots', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   runId: uuid('run_id')
//     .notNull()
//     .references(() => runs.id, { onDelete: 'cascade' }),
//   name: text('name').notNull(),
//   imageS3Path: text('image_s3_path').notNull(),
//   diffS3Path: text('diff_s3_path'),
//   status: text('status').notNull(),
// })

// export const baselines = pgTable('baselines', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   projectId: uuid('project_id')
//     .notNull()
//     .references(() => projects.id, { onDelete: 'cascade' }),
//   sourceRunId: uuid('source_run_id')
//     .notNull()
//     .references(() => runs.id, { onDelete: 'restrict' }),
//   createdByUserId: uuid('created_by_user_id')
//     .notNull()
//     .references(() => users.id, { onDelete: 'restrict' }),
//   isActive: boolean('is_active').notNull().default(false),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
// })

// export const runApprovals = pgTable('run_approvals', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   runId: uuid('run_id')
//     .notNull()
//     .references(() => runs.id, { onDelete: 'cascade' }),
//   approvedByUserId: uuid('approved_by_user_id')
//     .notNull()
//     .references(() => users.id, { onDelete: 'restrict' }),
//   approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow().notNull(),
// })

// export const sessions = pgTable('sessions', {
//   id: text('id').primaryKey(),
//   userId: uuid('user_id')
//     .notNull()
//     .references(() => users.id, { onDelete: 'cascade' }),
//   data: text('data').notNull(),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
//   expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
// })

// // Relations

// export const usersRelations = relations(users, ({ many }) => ({
//   ownedProjects: many(projects),
//   projectMemberships: many(projectMembers),
//   apiKeys: many(apiKeys),
//   baselines: many(baselines),
//   runApprovals: many(runApprovals),
// }))

// export const projectsRelations = relations(projects, ({ one, many }) => ({
//   owner: one(users, {
//     fields: [projects.ownerUserId],
//     references: [users.id],
//   }),
//   members: many(projectMembers),
//   runs: many(runs),
//   apiKeys: many(apiKeys),
//   baselines: many(baselines),
// }))

// export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
//   project: one(projects, {
//     fields: [projectMembers.projectId],
//     references: [projects.id],
//   }),
//   user: one(users, {
//     fields: [projectMembers.userId],
//     references: [users.id],
//   }),
// }))

// export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [apiKeys.projectId],
//     references: [projects.id],
//   }),
//   runs: many(runs),
// }))

// export const runsRelations = relations(runs, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [runs.projectId],
//     references: [projects.id],
//   }),
//   createdByApiKey: one(apiKeys, {
//     fields: [runs.createdByApiKeyId],
//     references: [apiKeys.id],
//   }),
//   snapshots: many(snapshots),
//   approval: one(runApprovals, {
//     fields: [runs.id],
//     references: [runApprovals.runId],
//   }),
//   baseline: one(baselines, {
//     fields: [runs.id],
//     references: [baselines.sourceRunId],
//   }),
// }))

// export const snapshotsRelations = relations(snapshots, ({ one }) => ({
//   run: one(runs, {
//     fields: [snapshots.runId],
//     references: [runs.id],
//   }),
// }))

// export const baselinesRelations = relations(baselines, ({ one }) => ({
//   project: one(projects, {
//     fields: [baselines.projectId],
//     references: [projects.id],
//   }),
//   sourceRun: one(runs, {
//     fields: [baselines.sourceRunId],
//     references: [runs.id],
//   }),
//   createdByUser: one(users, {
//     fields: [baselines.createdByUserId],
//     references: [users.id],
//   }),
// }))

// export const runApprovalsRelations = relations(runApprovals, ({ one }) => ({
//   run: one(runs, {
//     fields: [runApprovals.runId],
//     references: [runs.id],
//   }),
//   approvedByUser: one(users, {
//     fields: [runApprovals.approvedByUserId],
//     references: [users.id],
//   }),
// }))

// export const sessionsRelations = relations(sessions, ({ one }) => ({
//   user: one(users, {
//     fields: [sessions.userId],
//     references: [users.id],
//   }),
// }))

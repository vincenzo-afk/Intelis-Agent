import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const researchCollections = mysqlTable("research_collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 16 }).default("#6E82FB").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("collections_user_idx").on(table.userId)]);

export const researchTasks = mysqlTable("research_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  collectionId: int("collectionId"),
  name: varchar("name", { length: 160 }).notNull(),
  naturalLanguageRequest: text("naturalLanguageRequest").notNull(),
  sources: json("sources").$type<string[]>().notNull(),
  keywords: json("keywords").$type<string[]>().notNull(),
  topics: json("topics").$type<string[]>().notNull(),
  sourceFilters: json("sourceFilters").$type<{ include?: string[]; exclude?: string[] }>().notNull(),
  cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  executionProfile: mysqlEnum("executionProfile", ["scheduled", "high_throughput"]).default("scheduled").notNull(),
  status: mysqlEnum("status", ["active", "paused", "archived"]).default("active").notNull(),
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  deliveryEmail: varchar("deliveryEmail", { length: 320 }),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("tasks_user_idx").on(table.userId),
  index("tasks_collection_idx").on(table.collectionId),
  index("tasks_schedule_uid_idx").on(table.scheduleCronTaskUid),
]);

export const followedEntities = mysqlTable("followed_entities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  collectionId: int("collectionId"),
  name: varchar("name", { length: 180 }).notNull(),
  entityType: mysqlEnum("entityType", ["company", "person", "topic"]).notNull(),
  aliases: json("aliases").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  lastObservedAt: timestamp("lastObservedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("entities_user_idx").on(table.userId), index("entities_collection_idx").on(table.collectionId)]);

export const entityChangeEvents = mysqlTable("entity_change_events", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId").notNull(),
  taskId: int("taskId").notNull(),
  runId: int("runId").notNull(),
  userId: int("userId").notNull(),
  changeType: mysqlEnum("changeType", ["new_signal", "updated_signal", "anomaly"]).notNull(),
  evidenceSummary: text("evidenceSummary").notNull(),
  significance: int("significance").notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
}, table => [index("entity_changes_entity_idx").on(table.entityId), index("entity_changes_task_idx").on(table.taskId), index("entity_changes_run_idx").on(table.runId)]);

export const researchRuns = mysqlTable("research_runs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  trigger: mysqlEnum("trigger", ["scheduled", "manual", "retry"]).notNull(),
  executionProfile: mysqlEnum("executionProfile", ["scheduled", "high_throughput"]).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "partial"]).default("queued").notNull(),
  currentStage: varchar("currentStage", { length: 40 }),
  stageStates: json("stageStates").$type<Record<string, { status: string; completedAt?: string; detail?: string }>>().notNull(),
  sourceCount: int("sourceCount").default(0).notNull(),
  findingCount: int("findingCount").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("runs_task_idx").on(table.taskId), index("runs_user_idx").on(table.userId)]);

export const researchFindings = mysqlTable("research_findings", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  sourceName: varchar("sourceName", { length: 160 }).notNull(),
  publishedAt: timestamp("publishedAt"),
  contentExcerpt: text("contentExcerpt").notNull(),
  summary: text("summary").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  entities: json("entities").$type<{ name: string; type: string }[]>().notNull(),
  qualityScore: int("qualityScore").notNull(),
  relevanceScore: int("relevanceScore").notNull(),
  credibilityScore: int("credibilityScore").notNull(),
  noveltyScore: int("noveltyScore").notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["verified", "partially_verified", "unverified"]).notNull(),
  fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("findings_task_idx").on(table.taskId),
  index("findings_run_idx").on(table.runId),
  index("findings_fingerprint_idx").on(table.fingerprint),
]);

export const sourceSnapshots = mysqlTable("source_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  contentExcerpt: text("contentExcerpt").notNull(),
  changeSummary: text("changeSummary"),
  significantChange: boolean("significantChange").default(false).notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
}, table => [index("snapshots_task_idx").on(table.taskId)]);

export const intelligenceTrends = mysqlTable("intelligence_trends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  collectionId: int("collectionId"),
  label: varchar("label", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  momentum: int("momentum").notNull(),
  findingCount: int("findingCount").notNull(),
  analysis: text("analysis").notNull(),
  status: mysqlEnum("status", ["emerging", "rising", "watching"]).notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
}, table => [index("trends_user_idx").on(table.userId), index("trends_collection_idx").on(table.collectionId)]);

export const intelligenceReports = mysqlTable("intelligence_reports", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  runId: int("runId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  reportType: mysqlEnum("reportType", ["summary", "digest", "alert"]).notNull(),
  content: text("content").notNull(),
  format: mysqlEnum("format", ["markdown", "html"]).default("markdown").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("reports_task_idx").on(table.taskId), index("reports_run_idx").on(table.runId)]);

export const askConversations = mysqlTable("ask_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("conversations_user_idx").on(table.userId)]);

export const askMessages = mysqlTable("ask_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  citations: json("citations").$type<{ findingId: number; title: string; url: string }[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("messages_conversation_idx").on(table.conversationId)]);

export const deliveryEvents = mysqlTable("delivery_events", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["in_app", "email"]).notNull(),
  recipient: varchar("recipient", { length: 320 }),
  status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
  detail: text("detail"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("delivery_report_idx").on(table.reportId), index("delivery_user_idx").on(table.userId)]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: int("resourceId"),
  detail: json("detail").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_user_idx").on(table.userId), index("audit_resource_idx").on(table.resourceType, table.resourceId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ResearchTask = typeof researchTasks.$inferSelect;
export type ResearchRun = typeof researchRuns.$inferSelect;
export type ResearchFinding = typeof researchFindings.$inferSelect;

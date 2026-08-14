import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  askConversations,
  askMessages,
  deliveryEvents,
  entityChangeEvents,
  followedEntities,
  intelligenceReports,
  intelligenceTrends,
  researchCollections,
  researchFindings,
  researchRuns,
  researchTasks,
  sourceSnapshots,
} from "../../drizzle/schema";
import { getDb } from "../db";
import type { AnalyzedFinding, StageStates } from "./contracts";

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}

export async function listResearchTasks(userId: number) {
  const db = await requireDb();
  return db.select().from(researchTasks).where(eq(researchTasks.userId, userId)).orderBy(desc(researchTasks.updatedAt));
}

export async function listActiveTaskRuns(userId: number) {
  const db = await requireDb();
  return db.select().from(researchRuns).where(and(eq(researchRuns.userId, userId), inArray(researchRuns.status, ["queued", "running"]))).orderBy(desc(researchRuns.createdAt));
}

export async function findResearchTask(taskId: number, userId: number) {
  const db = await requireDb();
  return (await db.select().from(researchTasks).where(and(eq(researchTasks.id, taskId), eq(researchTasks.userId, userId))).limit(1))[0];
}

export async function findTaskByScheduleUid(taskUid: string) {
  const db = await requireDb();
  return (await db.select().from(researchTasks).where(eq(researchTasks.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function updateTaskSchedule(taskId: number, taskUid: string | null, nextRunAt?: Date | null) {
  const db = await requireDb();
  await db.update(researchTasks).set({ scheduleCronTaskUid: taskUid, nextRunAt: nextRunAt ?? null }).where(eq(researchTasks.id, taskId));
}

export async function createPipelineRun(input: {
  taskId: number;
  userId: number;
  trigger: "scheduled" | "manual" | "retry";
  executionProfile: "scheduled" | "high_throughput";
  stageStates: StageStates;
}) {
  const db = await requireDb();
  const result = await db.insert(researchRuns).values({ ...input, status: "queued" });
  return Number(result[0].insertId);
}

export async function updatePipelineRun(
  runId: number,
  values: Partial<{
    status: "queued" | "running" | "completed" | "failed" | "partial";
    currentStage: string | null;
    stageStates: StageStates;
    sourceCount: number;
    findingCount: number;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>
) {
  const db = await requireDb();
  await db.update(researchRuns).set(values).where(eq(researchRuns.id, runId));
}

export async function saveFindings(runId: number, taskId: number, userId: number, findings: AnalyzedFinding[]) {
  if (!findings.length) return [];
  const db = await requireDb();
  await db.insert(researchFindings).values(findings.map(finding => ({ ...finding, runId, taskId, userId })));
  return db.select().from(researchFindings).where(eq(researchFindings.runId, runId));
}

export async function priorFingerprints(taskId: number) {
  const db = await requireDb();
  return db.select({ fingerprint: researchFindings.fingerprint }).from(researchFindings).where(eq(researchFindings.taskId, taskId));
}

export async function historicalEntityNames(taskId: number, take = 160) {
  const db = await requireDb();
  const rows = await db.select({ entities: researchFindings.entities }).from(researchFindings).where(eq(researchFindings.taskId, taskId)).orderBy(desc(researchFindings.createdAt)).limit(take);
  return Array.from(new Set(rows.flatMap(row => row.entities.map(entity => entity.name.trim().toLowerCase())).filter(Boolean)));
}

export async function markFollowedEntitiesObserved(userId: number, findings: AnalyzedFinding[]) {
  if (!findings.length) return;
  const db = await requireDb();
  const followed = await db.select().from(followedEntities).where(and(eq(followedEntities.userId, userId), eq(followedEntities.status, "active")));
  const observedNames = new Set(findings.flatMap(finding => finding.entities.map(entity => entity.name.trim().toLowerCase())));
  const observedIds = followed.filter(entity => {
    const names = [entity.name, ...entity.aliases].map(value => value.trim().toLowerCase());
    return names.some(name => observedNames.has(name));
  }).map(entity => entity.id);
  if (observedIds.length) await db.update(followedEntities).set({ lastObservedAt: new Date() }).where(inArray(followedEntities.id, observedIds));
}

export function signalSimilarity(left: string, right: string) {
  const leftTerms = new Set(left.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const rightTerms = new Set(right.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const overlap = Array.from(leftTerms).filter(term => rightTerms.has(term)).length;
  return overlap / Math.max(1, leftTerms.size + rightTerms.size - overlap);
}

function lastAfterEvidence(value: string) {
  const marker = "\nAfter: ";
  const index = value.lastIndexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

export async function recordEntityChangeEvents(input: { userId: number; taskId: number; runId: number; findings: AnalyzedFinding[] }) {
  if (!input.findings.length) return { anomalies: [] as Array<{ label: string; significance: number; evidence: string }> };
  const db = await requireDb();
  const followed = await db.select().from(followedEntities).where(and(eq(followedEntities.userId, input.userId), eq(followedEntities.status, "active")));
  const previousEvents = await db.select().from(entityChangeEvents).where(eq(entityChangeEvents.userId, input.userId)).orderBy(desc(entityChangeEvents.observedAt));
  const latestByEntity = new Map<number, typeof previousEvents[number]>();
  for (const event of previousEvents) if (!latestByEntity.has(event.entityId)) latestByEntity.set(event.entityId, event);
  const anomalies: Array<{ label: string; significance: number; evidence: string }> = [];
  const events = followed.flatMap(entity => {
    const names = [entity.name, ...entity.aliases].map(value => value.trim().toLowerCase());
    const matches = input.findings.filter(finding => finding.entities.some(found => names.includes(found.name.trim().toLowerCase())));
    if (!matches.length) return [];
    const averageSignificance = Math.round(matches.reduce((total, finding) => total + finding.noveltyScore + finding.relevanceScore, 0) / (matches.length * 2));
    const currentEvidence = matches.map(finding => `${finding.title}: ${finding.summary}`).join(" ").slice(0, 4800);
    const prior = latestByEntity.get(entity.id);
    const priorEvidence = prior ? lastAfterEvidence(prior.evidenceSummary) : "No prior observed signal.";
    const changed = !prior || signalSimilarity(priorEvidence, currentEvidence) < 0.72;
    if (!changed) return [];
    const changeType = !prior ? "new_signal" as const : averageSignificance >= 75 ? "anomaly" as const : "updated_signal" as const;
    const evidenceSummary = `Before: ${priorEvidence}\nAfter: ${currentEvidence}`;
    if (changeType === "anomaly") anomalies.push({ label: entity.name, significance: averageSignificance, evidence: evidenceSummary });
    return [{
      entityId: entity.id,
      taskId: input.taskId,
      runId: input.runId,
      userId: input.userId,
      changeType,
      evidenceSummary: evidenceSummary.slice(0, 10000),
      significance: averageSignificance,
    }];
  });
  if (events.length) await db.insert(entityChangeEvents).values(events);
  return { anomalies };
}

export async function saveSnapshots(taskId: number, findings: AnalyzedFinding[], previousFingerprints: Set<string>) {
  if (!findings.length) return;
  const db = await requireDb();
  await db.insert(sourceSnapshots).values(findings.map(finding => ({
    taskId,
    sourceUrl: finding.sourceUrl,
    contentHash: finding.fingerprint,
    contentExcerpt: finding.contentExcerpt.slice(0, 10000),
    changeSummary: previousFingerprints.has(finding.fingerprint) ? "Previously observed content." : "New source content observed.",
    significantChange: !previousFingerprints.has(finding.fingerprint),
  })));
}

export async function saveReport(input: { taskId: number; runId: number; userId: number; title: string; content: string; reportType: "summary" | "digest" | "alert" }) {
  const db = await requireDb();
  const result = await db.insert(intelligenceReports).values({ ...input, format: "markdown" });
  return Number(result[0].insertId);
}

export async function recordDelivery(input: { reportId: number; userId: number; channel: "in_app" | "email"; recipient?: string | null; status: "queued" | "sent" | "failed"; detail?: string | null; sentAt?: Date | null }) {
  const db = await requireDb();
  await db.insert(deliveryEvents).values(input);
}

export async function saveTrend(input: { userId: number; collectionId: number | null; label: string; category: string; momentum: number; findingCount: number; analysis: string; status: "emerging" | "rising" | "watching" }) {
  const db = await requireDb();
  await db.insert(intelligenceTrends).values(input);
}

export async function listCollections(userId: number) {
  const db = await requireDb();
  return db.select().from(researchCollections).where(eq(researchCollections.userId, userId)).orderBy(desc(researchCollections.updatedAt));
}

export async function listEntities(userId: number) {
  const db = await requireDb();
  return db.select().from(followedEntities).where(eq(followedEntities.userId, userId)).orderBy(desc(followedEntities.updatedAt));
}

export async function listRecentRuns(userId: number, take = 8) {
  const db = await requireDb();
  return db.select().from(researchRuns).where(eq(researchRuns.userId, userId)).orderBy(desc(researchRuns.createdAt)).limit(take);
}

export async function listRecentFindings(userId: number, take = 12) {
  const db = await requireDb();
  return db.select().from(researchFindings).where(eq(researchFindings.userId, userId)).orderBy(desc(researchFindings.createdAt)).limit(take);
}

export async function listRecentTrends(userId: number, take = 6) {
  const db = await requireDb();
  return db.select().from(intelligenceTrends).where(eq(intelligenceTrends.userId, userId)).orderBy(desc(intelligenceTrends.detectedAt)).limit(take);
}

export async function listKnowledgeCandidates(userId: number, take = 60) {
  const db = await requireDb();
  const [findings, reports] = await Promise.all([
    db.select().from(researchFindings).where(eq(researchFindings.userId, userId)).orderBy(desc(researchFindings.createdAt), desc(researchFindings.relevanceScore)).limit(take),
    db.select().from(intelligenceReports).where(eq(intelligenceReports.userId, userId)).orderBy(desc(intelligenceReports.createdAt)).limit(24),
  ]);
  return [
    ...findings.map(finding => ({ id: finding.id, title: finding.title, summary: finding.summary, sourceUrl: finding.sourceUrl, sourceName: finding.sourceName })),
    ...reports.map(report => ({ id: -report.id, title: report.title, summary: report.content.slice(0, 6000), sourceUrl: `/reports#report-${report.id}`, sourceName: `Intelis ${report.reportType} report` })),
  ];
}

export async function createConversation(userId: number, title: string) {
  const db = await requireDb();
  const result = await db.insert(askConversations).values({ userId, title });
  return Number(result[0].insertId);
}

export async function saveConversationMessage(input: { conversationId: number; role: "user" | "assistant"; content: string; citations: { findingId: number; title: string; url: string }[] }) {
  const db = await requireDb();
  await db.insert(askMessages).values(input);
}

export async function taskDashboard(userId: number) {
  const db = await requireDb();
  const [taskStats] = await db.select({ active: sql<number>`sum(case when ${researchTasks.status} = 'active' then 1 else 0 end)`, total: sql<number>`count(*)` }).from(researchTasks).where(eq(researchTasks.userId, userId));
  const [findingStats] = await db.select({ total: sql<number>`count(*)`, averageQuality: sql<number>`coalesce(round(avg(${researchFindings.qualityScore})), 0)` }).from(researchFindings).where(eq(researchFindings.userId, userId));
  const [runStats] = await db.select({ total: sql<number>`count(*)`, successful: sql<number>`sum(case when ${researchRuns.status} = 'completed' then 1 else 0 end)` }).from(researchRuns).where(eq(researchRuns.userId, userId));
  return { activeTasks: Number(taskStats?.active ?? 0), totalTasks: Number(taskStats?.total ?? 0), totalFindings: Number(findingStats?.total ?? 0), averageQuality: Number(findingStats?.averageQuality ?? 0), totalRuns: Number(runStats?.total ?? 0), successfulRuns: Number(runStats?.successful ?? 0) };
}

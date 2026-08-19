import { parse as parseCookie } from "cookie";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  followedEntities,
  intelligenceReports,
  researchCollections,
  researchTasks,
} from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import { deriveTaskSignals, answerKnowledgeQuestion, rankKnowledgeCandidates } from "../intelis/groq";
import { runResearchPipeline } from "../intelis/pipeline";
import { isValidSixFieldCron, normalizeCronExpression } from "../intelis/validators";
import {
  createConversation,
  findResearchTask,
  listCollections,
  listEntities,
  listRecentFindings,
  listRecentRuns,
  listRecentTrends,
  listResearchTasks,
  listActiveTaskRuns,
  requireDb,
  saveConversationMessage,
  listKnowledgeCandidates,
  taskDashboard,
  updateTaskSchedule,
} from "../intelis/repository";

const sourceEnum = z.enum(["web", "rss", "news_api"]);
const cronExpression = z.string().trim().transform(normalizeCronExpression).refine(isValidSixFieldCron, "Use a valid cron expression with five fields (min hour day month weekday) or six fields (sec min hour day month weekday).");
const taskInput = z.object({
  name: z.string().trim().min(2).max(160),
  naturalLanguageRequest: z.string().trim().min(12).max(6000),
  collectionId: z.number().int().positive().nullable().optional(),
  sources: z.array(sourceEnum).min(1),
  keywords: z.array(z.string().trim().min(1).max(120)).max(15).default([]),
  topics: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  sourceFilters: z.object({ include: z.array(z.string().trim().min(1).max(500)).max(20).default([]), exclude: z.array(z.string().trim().min(1).max(255)).max(20).default([]) }).default({ include: [], exclude: [] }),
  cronExpression,
  executionProfile: z.enum(["scheduled", "high_throughput"]),
  emailEnabled: z.boolean().default(false),
  deliveryEmail: z.string().email().max(320).nullable().optional(),
});

function sessionToken(cookieHeader?: string) {
  return parseCookie(cookieHeader ?? "")[COOKIE_NAME] ?? "";
}

async function getOwnedTask(taskId: number, userId: number) {
  const task = await findResearchTask(taskId, userId);
  if (!task) throw new Error("Research task not found");
  return task;
}

export const intelligenceRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => ({
    metrics: await taskDashboard(ctx.user.id),
    tasks: await listResearchTasks(ctx.user.id),
    findings: await listRecentFindings(ctx.user.id),
    runs: await listRecentRuns(ctx.user.id),
    trends: await listRecentTrends(ctx.user.id),
  })),

  tasks: router({
    list: protectedProcedure.query(({ ctx }) => listResearchTasks(ctx.user.id)),
    activity: protectedProcedure.query(({ ctx }) => listActiveTaskRuns(ctx.user.id)),
    create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
      const signals = input.keywords.length || input.topics.length ? { keywords: input.keywords, topics: input.topics } : await deriveTaskSignals(input.naturalLanguageRequest);
      const db = await requireDb();
      const result = await db.insert(researchTasks).values({
        userId: ctx.user.id,
        collectionId: input.collectionId ?? null,
        name: input.name,
        naturalLanguageRequest: input.naturalLanguageRequest,
        sources: input.sources,
        keywords: signals.keywords,
        topics: signals.topics,
        sourceFilters: input.sourceFilters,
        cronExpression: input.cronExpression,
        executionProfile: input.executionProfile,
        emailEnabled: input.emailEnabled,
        deliveryEmail: input.emailEnabled ? input.deliveryEmail ?? ctx.user.email ?? null : null,
      });
      const taskId = Number(result[0].insertId);
      let task = await getOwnedTask(taskId, ctx.user.id);
      if (process.env.NODE_ENV === "production") {
        try {
          const job = await createHeartbeatJob({
            name: `intelis-task-${task.id}`,
            cron: task.cronExpression,
            path: "/api/scheduled/research-run",
            payload: {},
            description: `Intelis research task: ${task.name}`,
          }, sessionToken(ctx.req.headers.cookie));
          await updateTaskSchedule(task.id, job.taskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
          task = await getOwnedTask(taskId, ctx.user.id);
        } catch (error) {
          // Scheduling services (e.g. the platform heartbeat) may not be available on
          // every host (self-hosted or third-party deployments). The task still works
          // perfectly for manual runs; mark it so the UI can show "needs activation".
          console.warn("[Intelligence] Scheduling service unavailable; task created without a cron job:", error);
        }
      }
      return { task, scheduleState: task.scheduleCronTaskUid ? "active" as const : "needs_activation" as const };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), values: taskInput.partial() })).mutation(async ({ ctx, input }) => {
      const existing = await getOwnedTask(input.id, ctx.user.id);
      const db = await requireDb();
      const values = { ...input.values, collectionId: input.values.collectionId === undefined ? undefined : input.values.collectionId ?? null };
      await db.update(researchTasks).set(values).where(and(eq(researchTasks.id, input.id), eq(researchTasks.userId, ctx.user.id)));
      const updated = await getOwnedTask(input.id, ctx.user.id);
      // Keep the scheduled heartbeat job in sync when the schedule, status, or name changes.
      if (updated.scheduleCronTaskUid && (values.cronExpression !== undefined || values.name !== undefined || (input.values as Record<string, unknown>).status !== undefined)) {
        try {
          const job = await updateHeartbeatJob(
            updated.scheduleCronTaskUid,
            {
              cron: updated.cronExpression,
              enable: updated.status === "active",
              description: `Intelis research task: ${updated.name}`,
            },
            sessionToken(ctx.req.headers.cookie)
          );
          await updateTaskSchedule(updated.id, updated.scheduleCronTaskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
        } catch (error) {
          console.warn("[Intelligence] Failed to sync heartbeat job on task update:", error);
        }
      }
      return updated;
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getOwnedTask(input.id, ctx.user.id);
      if (task.scheduleCronTaskUid) { try { await deleteHeartbeatJob(task.scheduleCronTaskUid, sessionToken(ctx.req.headers.cookie)); } catch (error) { console.warn("[Intelligence] Failed to delete heartbeat job:", error); } }
      const db = await requireDb();
      await db.delete(researchTasks).where(and(eq(researchTasks.id, task.id), eq(researchTasks.userId, ctx.user.id)));
      return { success: true };
    }),
    activateSchedule: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "production") throw new Error("Publish the project before activating a scheduled research task.");
      const task = await getOwnedTask(input.id, ctx.user.id);
      const token = sessionToken(ctx.req.headers.cookie);
      if (task.scheduleCronTaskUid) {
        const job = await updateHeartbeatJob(task.scheduleCronTaskUid, { cron: task.cronExpression, enable: true, description: `Intelis research task: ${task.name}` }, token);
        await updateTaskSchedule(task.id, task.scheduleCronTaskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
      } else {
        const job = await createHeartbeatJob({ name: `intelis-task-${task.id}`, cron: task.cronExpression, path: "/api/scheduled/research-run", payload: {}, description: `Intelis research task: ${task.name}` }, token);
        await updateTaskSchedule(task.id, job.taskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
      }
      return getOwnedTask(task.id, ctx.user.id);
    }),
    pause: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getOwnedTask(input.id, ctx.user.id);
      if (task.scheduleCronTaskUid) {
        try {
          await updateHeartbeatJob(task.scheduleCronTaskUid, { enable: false }, sessionToken(ctx.req.headers.cookie));
        } catch (error) {
          console.warn("[Intelligence] Failed to pause heartbeat job:", error);
        }
      }
      const db = await requireDb();
      await db.update(researchTasks).set({ status: "paused", nextRunAt: null }).where(eq(researchTasks.id, task.id));
      return getOwnedTask(task.id, ctx.user.id);
    }),
    resume: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getOwnedTask(input.id, ctx.user.id);
      if (task.scheduleCronTaskUid) {
        try {
          const job = await updateHeartbeatJob(task.scheduleCronTaskUid, { enable: true, cron: task.cronExpression, description: `Intelis research task: ${task.name}` }, sessionToken(ctx.req.headers.cookie));
          await updateTaskSchedule(task.id, task.scheduleCronTaskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
        } catch (error) {
          console.warn("[Intelligence] Failed to resume heartbeat job:", error);
        }
      }
      const db = await requireDb();
      await db.update(researchTasks).set({ status: "active" }).where(eq(researchTasks.id, task.id));
      return getOwnedTask(task.id, ctx.user.id);
    }),
    runNow: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getOwnedTask(input.id, ctx.user.id);
      return runResearchPipeline(task, "manual");
    }),
  }),

  collections: router({
    list: protectedProcedure.query(({ ctx }) => listCollections(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6E82FB") })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(researchCollections).values({ ...input, userId: ctx.user.id, description: input.description ?? null });
      return listCollections(ctx.user.id);
    }),
  }),

  entities: router({
    list: protectedProcedure.query(({ ctx }) => listEntities(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180), entityType: z.enum(["company", "person", "topic"]), collectionId: z.number().int().positive().nullable().optional(), aliases: z.array(z.string().trim().min(1).max(180)).max(12).default([]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.insert(followedEntities).values({ ...input, userId: ctx.user.id, collectionId: input.collectionId ?? null });
      return listEntities(ctx.user.id);
    }),
    toggle: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "paused"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(followedEntities).set({ status: input.status }).where(and(eq(followedEntities.id, input.id), eq(followedEntities.userId, ctx.user.id)));
      return listEntities(ctx.user.id);
    }),
  }),

  reports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(intelligenceReports).where(eq(intelligenceReports.userId, ctx.user.id)).orderBy(desc(intelligenceReports.createdAt)).limit(24);
    }),
  }),

  ask: router({
    query: protectedProcedure.input(z.object({ question: z.string().trim().min(3).max(3000), conversationId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const candidates = await listKnowledgeCandidates(ctx.user.id);
      const rankedIds = await rankKnowledgeCandidates(input.question, candidates.map(finding => ({ id: finding.id, title: finding.title, summary: finding.summary, sourceName: finding.sourceName })));
      const findings = rankedIds.length
        ? rankedIds.map(id => candidates.find(finding => finding.id === id)).filter((finding): finding is typeof candidates[number] => Boolean(finding))
        : candidates.slice(0, 12);
      const response = await answerKnowledgeQuestion(input.question, findings.map(finding => ({ id: finding.id, title: finding.title, summary: finding.summary, sourceUrl: finding.sourceUrl, sourceName: finding.sourceName })));
      const conversationId = input.conversationId ?? await createConversation(ctx.user.id, input.question.slice(0, 120));
      const citations = findings.filter(finding => response.citedFindingIds.includes(finding.id)).map(finding => ({ findingId: finding.id, title: finding.title, url: finding.sourceUrl }));
      await saveConversationMessage({ conversationId, role: "user", content: input.question, citations: [] });
      await saveConversationMessage({ conversationId, role: "assistant", content: response.answer, citations });
      return { conversationId, answer: response.answer, citations };
    }),
  }),
});

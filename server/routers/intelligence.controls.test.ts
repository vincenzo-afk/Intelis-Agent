import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";

const mocks = vi.hoisted(() => {
  const set = vi.fn(() => ({ where: vi.fn() }));
  return {
    db: { update: vi.fn(() => ({ set })) },
    set,
    findResearchTask: vi.fn(),
    requireDb: vi.fn(),
    updateTaskSchedule: vi.fn(),
    updateHeartbeatJob: vi.fn(),
    runResearchPipeline: vi.fn(),
  };
});

vi.mock("../intelis/repository", () => ({
  createConversation: vi.fn(),
  findResearchTask: mocks.findResearchTask,
  listCollections: vi.fn(),
  listEntities: vi.fn(),
  listRecentFindings: vi.fn(),
  listRecentRuns: vi.fn(),
  listRecentTrends: vi.fn(),
  listResearchTasks: vi.fn(),
  listActiveTaskRuns: vi.fn(),
  requireDb: mocks.requireDb,
  saveConversationMessage: vi.fn(),
  listKnowledgeCandidates: vi.fn(),
  taskDashboard: vi.fn(),
  updateTaskSchedule: mocks.updateTaskSchedule,
}));
vi.mock("../_core/heartbeat", () => ({
  createHeartbeatJob: vi.fn(),
  deleteHeartbeatJob: vi.fn(),
  updateHeartbeatJob: mocks.updateHeartbeatJob,
}));
vi.mock("../intelis/pipeline", () => ({ runResearchPipeline: mocks.runResearchPipeline }));

const task = {
  id: 42,
  userId: 1,
  name: "Market monitor",
  cronExpression: "0 0 9 * * *",
  scheduleCronTaskUid: "research-42",
  status: "active",
};
const ctx = {
  user: { id: 1, openId: "test-user", role: "user" },
  req: { headers: { cookie: "" } },
  res: {},
};

describe("intelligence task controls", () => {
  beforeEach(() => {
    mocks.db.update.mockClear();
    mocks.set.mockClear();
    mocks.findResearchTask.mockResolvedValue(task);
    mocks.requireDb.mockResolvedValue(mocks.db);
    mocks.updateTaskSchedule.mockReset();
    mocks.updateHeartbeatJob.mockReset();
    mocks.runResearchPipeline.mockReset();
  });

  it("pauses the scheduler and clears its displayed next-run time", async () => {
    const caller = appRouter.createCaller(ctx as never);
    await caller.intelligence.tasks.pause({ id: 42 });

    expect(mocks.updateHeartbeatJob).toHaveBeenCalledWith("research-42", { enable: false }, "");
    expect(mocks.set).toHaveBeenCalledWith({ status: "paused", nextRunAt: null });
  });

  it("resumes the scheduler, persists its next execution, and marks the task active", async () => {
    mocks.updateHeartbeatJob.mockResolvedValue({ nextExecutionAt: "2026-08-14T09:00:00.000Z" });
    const caller = appRouter.createCaller(ctx as never);
    await caller.intelligence.tasks.resume({ id: 42 });

    expect(mocks.updateHeartbeatJob).toHaveBeenCalledWith("research-42", expect.objectContaining({ enable: true }), "");
    expect(mocks.updateTaskSchedule).toHaveBeenCalledWith(42, "research-42", expect.any(Date));
    expect(mocks.set).toHaveBeenCalledWith({ status: "active" });
  });

  it("allows an on-demand research run from the interface", async () => {
    mocks.runResearchPipeline.mockResolvedValue({ runId: 9, findingCount: 3, sourceCount: 4 });
    const caller = appRouter.createCaller(ctx as never);
    await expect(caller.intelligence.tasks.runNow({ id: 42 })).resolves.toMatchObject({ runId: 9, findingCount: 3 });
    expect(mocks.runResearchPipeline).toHaveBeenCalledWith(task, "manual");
  });
});

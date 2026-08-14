import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updatePipelineRun: vi.fn() }));

vi.mock("./repository", () => ({
  createPipelineRun: vi.fn(),
  historicalEntityNames: vi.fn(),
  markFollowedEntitiesObserved: vi.fn(),
  priorFingerprints: vi.fn(),
  recordDelivery: vi.fn(),
  recordEntityChangeEvents: vi.fn(),
  saveFindings: vi.fn(),
  saveReport: vi.fn(),
  saveSnapshots: vi.fn(),
  saveTrend: vi.fn(),
  updatePipelineRun: mocks.updatePipelineRun,
}));

import { pendingStageStates } from "./contracts";
import { persistStage } from "./pipeline";

describe("pipeline live progress", () => {
  beforeEach(() => mocks.updatePipelineRun.mockReset());

  it("persists each active stage for polling clients", async () => {
    const states = pendingStageStates();
    await persistStage(17, states, "summarize", "running", "Groq analysis started");

    expect(states.summarize).toMatchObject({ status: "running", detail: "Groq analysis started" });
    expect(mocks.updatePipelineRun).toHaveBeenCalledWith(17, {
      currentStage: "summarize",
      stageStates: states,
    });
  });
});

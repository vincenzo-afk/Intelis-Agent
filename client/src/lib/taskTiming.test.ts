import { describe, expect, it } from "vitest";
import { describeTaskTiming, friendlyPipelineStage } from "./taskTiming";

describe("task schedule timing", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");

  it("renders a concise live countdown for active scheduled tasks", () => {
    expect(describeTaskTiming({ status: "active", nextRunAt: new Date("2026-08-13T14:30:00.000Z") }, now)).toBe("Runs in 2h 30m");
  });

  it("handles paused and unactivated schedules clearly", () => {
    expect(describeTaskTiming({ status: "paused", nextRunAt: null }, now)).toBe("Paused");
    expect(describeTaskTiming({ status: "active", nextRunAt: null }, now)).toBe("Schedule activates on publish");
  });

  it("names the current Groq pipeline stage for the interface", () => {
    expect(friendlyPipelineStage("summarize")).toBe("Summarize with Groq");
  });
});

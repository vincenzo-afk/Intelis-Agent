import { describe, expect, it } from "vitest";
import { filterScheduledTasks } from "./taskFilters";

const tasks = [
  { name: "AI market scan", status: "active" as const, sources: ["web", "news_api"], keywords: ["agents"], topics: ["AI"] },
  { name: "Company watch", status: "paused" as const, sources: ["rss"], keywords: ["funding"], topics: ["startups"] },
];

describe("filterScheduledTasks", () => {
  it("filters by search phrase, lifecycle state, and source channel", () => {
    expect(filterScheduledTasks(tasks, { query: "agents", status: "all", source: "all" })).toHaveLength(1);
    expect(filterScheduledTasks(tasks, { query: "", status: "paused", source: "rss" })[0]?.name).toBe("Company watch");
    expect(filterScheduledTasks(tasks, { query: "", status: "active", source: "rss" })).toHaveLength(0);
  });
});

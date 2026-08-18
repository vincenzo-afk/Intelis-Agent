import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveTaskSignals, rankKnowledgeCandidates, synthesizeDigest, synthesizeTrendAnalysis } from "./groq";

const originalFetch = globalThis.fetch;
const originalGroqApiKey = process.env.GROQ_API_KEY;

beforeEach(() => {
  process.env.GROQ_API_KEY = originalGroqApiKey ?? "fake-groq-api-key-for-testing";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqApiKey;
});

function mockGroqJson(payload: Record<string, unknown>) {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
}

describe("Groq intelligence analysis", () => {
  it("derives structured research signals from a natural-language brief", async () => {
    mockGroqJson({ keywords: ["AI agents", "enterprise"], topics: ["automation"] });
    await expect(deriveTaskSignals("Monitor enterprise AI automation developments.")).resolves.toEqual({ keywords: ["AI agents", "enterprise"], topics: ["automation"] });
  });

  it("keeps semantic retrieval IDs constrained to supplied knowledge records", async () => {
    mockGroqJson({ relevantFindingIds: [2, 999, 1] });
    await expect(rankKnowledgeCandidates("What changed?", [
      { id: 1, title: "A", summary: "First", sourceName: "Source" },
      { id: 2, title: "B", summary: "Second", sourceName: "Source" },
    ])).resolves.toEqual([2, 1]);
  });

  it("returns structured digest and trend outputs for the delivery pipeline", async () => {
    mockGroqJson({ title: "Weekly digest", content: "## What changed\nA material signal." });
    await expect(synthesizeDigest("Watch", "Monitor changes", [])).resolves.toMatchObject({ title: "Weekly digest" });

    mockGroqJson({ trends: [{ label: "Agent adoption", category: "Market", analysis: "New signals increased.", momentum: 78, status: "rising" }], anomalies: [] });
    await expect(synthesizeTrendAnalysis("Monitor changes", [{ title: "Signal", category: "Market", summary: "A signal", entities: [] }], [])).resolves.toMatchObject({ trends: [{ label: "Agent adoption", status: "rising" }] });
  });
});

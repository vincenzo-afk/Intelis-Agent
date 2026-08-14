import { describe, expect, it } from "vitest";
import { findingCsv, reportCsv } from "./researchExport";

describe("reportCsv", () => {
  it("creates a UTF-8 CSV with escaped report content", () => {
    const csv = reportCsv([{ id: 7, title: "Market, outlook", reportType: "summary", content: "The \"signal\" is rising.", createdAt: "2026-08-13T00:00:00.000Z" }]);
    expect(csv).toContain('"Market, outlook"');
    expect(csv).toContain('"The ""signal"" is rising."');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("exports Groq research findings with scores and source evidence", () => {
    const csv = findingCsv([{ id: 9, title: "AI market signal", sourceName: "Source desk", sourceUrl: "https://example.com/signal", summary: "A new signal.", category: "market", qualityScore: 87, relevanceScore: 93, credibilityScore: 82, createdAt: "2026-08-13T00:00:00.000Z" }]);
    expect(csv).toContain("Quality score");
    expect(csv).toContain('"87"');
    expect(csv).toContain('"https://example.com/signal"');
  });
});

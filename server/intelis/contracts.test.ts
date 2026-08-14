import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, pendingStageStates } from "./contracts";
import { independentSourceAgreement } from "./pipeline";
import { signalSimilarity } from "./repository";

describe("research pipeline contracts", () => {
  it("initializes every required pipeline stage as pending", () => {
    const states = pendingStageStates();
    expect(Object.keys(states)).toEqual(PIPELINE_STAGES);
    expect(Object.values(states).every(stage => stage.status === "pending")).toBe(true);
  });

  it("corroborates materially overlapping content only when it comes from independent sources", () => {
    const agreement = independentSourceAgreement([
      { url: "https://source-a.test/1", sourceName: "source-a.test", title: "Enterprise agents reach deployment", text: "Enterprise agent deployments accelerated after a new partner launch and customer rollout." },
      { url: "https://source-b.test/1", sourceName: "source-b.test", title: "Customers deploy enterprise agents", text: "A customer rollout and new partner launch accelerated enterprise agent deployments." },
      { url: "https://source-a.test/2", sourceName: "source-a.test", title: "A separate report", text: "Unrelated material from the same publisher should not be independent corroboration." },
    ]);
    expect(agreement.get("https://source-a.test/1")).toBeGreaterThan(0);
    expect(agreement.get("https://source-b.test/1")).toBeGreaterThan(0);
    expect(agreement.get("https://source-a.test/2")).toBe(0);
  });

  it("distinguishes materially changed entity evidence from a repeated observation", () => {
    const prior = "Product launch: The company introduced a customer analytics platform.";
    expect(signalSimilarity(prior, "Product launch: The company introduced a customer analytics platform.")).toBe(1);
    expect(signalSimilarity(prior, "Regulatory inquiry: The company faces a material enforcement action.")).toBeLessThan(0.25);
  });
});

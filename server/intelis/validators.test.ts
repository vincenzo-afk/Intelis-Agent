import { describe, expect, it } from "vitest";
import { isValidSixFieldCron, normalizeCronExpression } from "./validators";

describe("research schedule validation", () => {
  it("accepts six-field UTC cron expressions", () => {
    expect(isValidSixFieldCron("0 0 * * * *")).toBe(true);
    expect(isValidSixFieldCron("0 */15 9-17 * * MON-FRI")).toBe(true);
  });

  it("accepts familiar five-field cron expressions and normalizes seconds to zero", () => {
    expect(isValidSixFieldCron("0 * * * *")).toBe(true);
    expect(normalizeCronExpression("0 9 * * MON-FRI")).toBe("0 0 9 * * MON-FRI");
  });

  it("rejects incomplete or malformed schedules", () => {
    expect(isValidSixFieldCron("0 * * *")).toBe(false);
    expect(isValidSixFieldCron("0 0 * * * ; rm -rf /")).toBe(false);
  });
});

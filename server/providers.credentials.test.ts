import { describe, expect, it } from "vitest";

describe.skipIf(
  !process.env.NEWS_API_KEY ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
)("external provider credentials", () => {
  it("authenticates with NewsAPI without exposing the API key", async () => {
    expect(process.env.NEWS_API_KEY).toBeTruthy();
    const response = await fetch(
      "https://newsapi.org/v2/everything?q=intelligence&pageSize=1",
      {
        headers: { "X-Api-Key": process.env.NEWS_API_KEY! },
      }
    );
    expect(response.ok).toBe(true);
  }, 20_000);

  it("authenticates with Resend without exposing the API key", async () => {
    expect(process.env.RESEND_API_KEY).toBeTruthy();
    expect(process.env.RESEND_FROM_EMAIL).toBeTruthy();
    const response = await fetch("https://api.resend.com/domains?limit=1", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    expect(response.ok).toBe(true);
  }, 20_000);
});

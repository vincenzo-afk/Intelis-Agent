import { describe, expect, it } from "vitest";
import { isSafePublicHttpUrl } from "./sources";

describe("research source URL safeguards", () => {
  it("accepts public HTTP(S) sources", () => {
    expect(isSafePublicHttpUrl("https://www.example.com/news")).toBe(true);
  });

  it("rejects local, private, and non-web source targets", () => {
    expect(isSafePublicHttpUrl("http://127.0.0.1:3000/admin")).toBe(false);
    expect(isSafePublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafePublicHttpUrl("http://192.168.1.1/private")).toBe(false);
    expect(isSafePublicHttpUrl("file:///etc/passwd")).toBe(false);
  });
});


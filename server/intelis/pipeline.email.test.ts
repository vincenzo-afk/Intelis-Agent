import { describe, expect, it } from "vitest";
import { renderResearchEmailHtml } from "./pipeline";

describe("report email formatting", () => {
  it("escapes report content before turning line breaks into HTML", () => {
    expect(renderResearchEmailHtml("Signal <script>alert(1)</script>\nSecond line")).toContain("Signal &lt;script&gt;alert(1)&lt;/script&gt;<br/>");
  });
});

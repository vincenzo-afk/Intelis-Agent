import type { Express } from "express";
import { sdk } from "../_core/sdk";
import { findTaskByScheduleUid } from "./repository";
import { runResearchPipeline } from "./pipeline";

export function registerScheduledResearchHandler(app: Express) {
  app.post("/api/scheduled/research-run", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const task = await findTaskByScheduleUid(user.taskUid);
      if (!task || task.status !== "active") return res.json({ ok: true, skipped: "orphan-or-inactive" });
      const result = await runResearchPipeline(task, "scheduled");
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scheduled research failure";
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
    }
  });
}

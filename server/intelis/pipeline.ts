import crypto from "node:crypto";
import type { ResearchTask } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { PIPELINE_STAGES, type AnalyzedFinding, type PipelineStage, type StageStates, pendingStageStates } from "./contracts";
import { analyzeCandidate, synthesizeDigest, synthesizeReport, synthesizeTrendAnalysis } from "./groq";
import {
  createPipelineRun,
  historicalEntityNames,
  markFollowedEntitiesObserved,
  priorFingerprints,
  recordDelivery,
  recordEntityChangeEvents,
  saveFindings,
  saveReport,
  saveSnapshots,
  saveTrend,
  updatePipelineRun,
} from "./repository";
import { collectSourceCandidates, crawlSourceCandidates } from "./sources";

function fingerprint(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceTerms(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter(term => !["that", "this", "with", "from", "have", "will", "their", "about"].includes(term)) ?? []);
}

export function independentSourceAgreement(candidates: Array<{ url: string; sourceName: string; title: string; text: string }>) {
  const agreements = new Map<string, number>();
  for (const candidate of candidates) {
    const candidateTerms = sourceTerms(`${candidate.title} ${candidate.text.slice(0, 1200)}`);
    let corroboratingSources = 0;
    for (const other of candidates) {
      if (other.url === candidate.url || other.sourceName === candidate.sourceName) continue;
      const otherTerms = sourceTerms(`${other.title} ${other.text.slice(0, 1200)}`);
      const overlap = Array.from(candidateTerms).filter(term => otherTerms.has(term)).length;
      const denominator = Math.max(1, Math.min(candidateTerms.size, otherTerms.size));
      if (overlap >= 3 && overlap / denominator >= 0.22) corroboratingSources += 1;
    }
    agreements.set(candidate.url, corroboratingSources);
  }
  return agreements;
}

function updateStage(states: StageStates, stage: PipelineStage, status: "running" | "completed" | "failed", detail?: string) {
  states[stage] = { status, completedAt: status === "completed" ? new Date().toISOString() : undefined, detail };
}

export async function persistStage(runId: number, states: StageStates, stage: PipelineStage, status: "running" | "completed" | "failed", detail?: string) {
  updateStage(states, stage, status, detail);
  await updatePipelineRun(runId, { currentStage: stage, stageStates: states });
}

async function sendWithRetry(fn: () => Promise<Response>, attempts = 3, baseDelayMs = 1200): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fn();
      if (response.ok || response.status < 500) return response;
      if (attempt === attempts) return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown request failure");
    }
    await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt));
  }
  throw lastError ?? new Error("Research provider request failed after retries");
}

async function sendResearchEmail(input: { email: string; subject: string; markdown: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { sent: false, detail: "Email provider is not configured." };
  }
  const response = await sendWithRetry(() =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [input.email],
        subject: input.subject,
        html: renderResearchEmailHtml(input.markdown),
      }),
    })
  ).catch(error => ({ ok: false, status: 0, text: () => Promise.resolve(error instanceof Error ? error.message : "Unknown error") }));
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { sent: false, detail: response.status ? `Email provider rejected delivery (${response.status}).` : `Email provider unreachable (${detail.slice(0, 180)}).` };
  }
  return { sent: true, detail: "Delivered by email provider." };
}

export function renderResearchEmailHtml(markdown: string) {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/^###\s+(.+)$/gm, "<h4 style=\"margin:14px 0 4px;font-size:14px;\">$1</h4>")
    .replace(/^##\s+(.+)$/gm, "<h3 style=\"margin:18px 0 6px;font-size:16px;\">$1</h3>")
    .replace(/^#\s+(.+)$/gm, "<h2 style=\"margin:22px 0 8px;font-size:20px;\">$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*\*(.+)$/gm, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#4252fb">$1</a>');
  const rendered = escaped.split(/\n\n+/).map(paragraph => (paragraph.startsWith("<h") ? paragraph : `<p style="margin:8px 0">${paragraph.replace(/\n/g, "<br/>")}</p>`)).join("");
  return `<article style="font-family:ui-sans-serif,system-ui;line-height:1.6;max-width:680px">${rendered}</article>`;
}

export async function runResearchPipeline(task: ResearchTask, trigger: "scheduled" | "manual" | "retry") {
  const states = pendingStageStates();
  const runId = await createPipelineRun({ taskId: task.id, userId: task.userId, trigger, executionProfile: task.executionProfile, stageStates: states });
  const maximumCandidates = task.executionProfile === "high_throughput" ? 18 : 8;

  try {
    await updatePipelineRun(runId, { status: "running", currentStage: "search", stageStates: states, startedAt: new Date() });
    await persistStage(runId, states, "search", "running");
    const candidates = await collectSourceCandidates(task, maximumCandidates);
    await persistStage(runId, states, "search", "completed", `${candidates.length} candidate source items discovered`);

    await persistStage(runId, states, "crawl", "running");
    const crawled = await crawlSourceCandidates(candidates);
    await persistStage(runId, states, "crawl", "completed", `${crawled.length} source URLs responded to a live crawl request`);

    await persistStage(runId, states, "scrape", "running");
    const extracted = crawled.filter(candidate => candidate.text.length > 80);
    await persistStage(runId, states, "scrape", "completed", `${extracted.length} usable document extracts`);

    await persistStage(runId, states, "clean", "running");
    const cleaned = extracted.map(candidate => ({ ...candidate, text: candidate.text.replace(/\s+/g, " ").trim().slice(0, 12000) }));
    await persistStage(runId, states, "clean", "completed", `${cleaned.length} normalized document extracts`);

    await persistStage(runId, states, "deduplicate", "running");
    const seen = new Set<string>();
    const deduplicated = cleaned.filter(candidate => {
      const key = normalizeTitle(candidate.title) || fingerprint(candidate.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await persistStage(runId, states, "deduplicate", "completed", `${cleaned.length - deduplicated.length} duplicate items removed`);

    await persistStage(runId, states, "verify", "running");
    const corroboration = independentSourceAgreement(deduplicated);
    const corroboratedCount = Array.from(corroboration.values()).filter(value => value > 0).length;
    await persistStage(runId, states, "verify", "completed", `${corroboratedCount} items corroborated by independently crawled source material`);

    await persistStage(runId, states, "summarize", "running");
    const previous = new Set((await priorFingerprints(task.id)).map(item => item.fingerprint));
    const historicalEntities = await historicalEntityNames(task.id);
    const analyzed = (await Promise.allSettled(deduplicated.map(async candidate => {
      const ai = await analyzeCandidate(candidate, task.naturalLanguageRequest);
      const itemFingerprint = fingerprint(`${normalizeTitle(candidate.title)}|${candidate.url}`);
      const agreement = corroboration.get(candidate.url) ?? 0;
      const verificationStatus = agreement > 0 && ai.verificationStatus === "unverified" ? "partially_verified" : ai.verificationStatus;
      return {
        title: candidate.title,
        sourceUrl: candidate.url,
        sourceName: candidate.sourceName,
        publishedAt: candidate.publishedAt,
        contentExcerpt: candidate.text.slice(0, 3000),
        ...ai,
        credibilityScore: Math.min(100, ai.credibilityScore + Math.min(20, agreement * 10)),
        verificationStatus,
        fingerprint: itemFingerprint,
      } satisfies AnalyzedFinding;
    }))).flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    await persistStage(runId, states, "summarize", "completed", `${analyzed.length} documents analyzed by the intelligence model`);

    const savedFindings = await saveFindings(runId, task.id, task.userId, analyzed);
    await saveSnapshots(task.id, analyzed, previous);
    const entityChanges = await recordEntityChangeEvents({ userId: task.userId, taskId: task.id, runId, findings: analyzed });
    await markFollowedEntitiesObserved(task.userId, analyzed);

    const trendSynthesis = await synthesizeTrendAnalysis(task.naturalLanguageRequest, analyzed, historicalEntities);
    const emerging = analyzed.filter(item => !previous.has(item.fingerprint));
    for (const trend of [...trendSynthesis.trends, ...trendSynthesis.anomalies]) {
      await saveTrend({ userId: task.userId, collectionId: task.collectionId, label: trend.label, category: trend.category, momentum: trend.momentum, findingCount: emerging.length, analysis: trend.analysis, status: trend.status });
    }
    for (const anomaly of entityChanges.anomalies) {
      await saveTrend({ userId: task.userId, collectionId: task.collectionId, label: anomaly.label, category: "Entity monitoring", momentum: anomaly.significance, findingCount: 1, analysis: anomaly.evidence, status: "watching" });
    }

    await persistStage(runId, states, "format", "running");
    const report = await synthesizeReport(task.name, task.naturalLanguageRequest, analyzed);
    const digest = await synthesizeDigest(task.name, task.naturalLanguageRequest, analyzed);
    const reports: Array<{ id: number; title: string; content: string; reportType: "summary" | "digest" | "alert" }> = [
      { id: await saveReport({ taskId: task.id, runId, userId: task.userId, title: report.title, content: report.content, reportType: "summary" as const }), title: report.title, content: report.content, reportType: "summary" as const },
      { id: await saveReport({ taskId: task.id, runId, userId: task.userId, title: digest.title, content: digest.content, reportType: "digest" as const }), title: digest.title, content: digest.content, reportType: "digest" as const },
    ];
    if (trendSynthesis.trends.length || trendSynthesis.anomalies.length) {
      const alert = await synthesizeReport(`Alert · ${task.name}`, task.naturalLanguageRequest, analyzed);
      reports.push({ id: await saveReport({ taskId: task.id, runId, userId: task.userId, title: alert.title, content: alert.content, reportType: "alert" as const }), title: alert.title, content: alert.content, reportType: "alert" as const });
    }
    await persistStage(runId, states, "format", "completed", `${reports.length} structured intelligence report formats generated`);

    await persistStage(runId, states, "deliver", "running");
    const emailDeliveryNotes: string[] = [];
    for (const prepared of reports) {
      await recordDelivery({ reportId: prepared.id, userId: task.userId, channel: "in_app", status: "sent", detail: "Available in the Intelis dashboard.", sentAt: new Date() });
      const shouldEmail = task.emailEnabled && task.deliveryEmail && (prepared.reportType === "digest" || prepared.reportType === "alert");
      if (shouldEmail) {
        const email = await sendResearchEmail({ email: task.deliveryEmail!, subject: prepared.title, markdown: prepared.content });
        await recordDelivery({ reportId: prepared.id, userId: task.userId, channel: "email", recipient: task.deliveryEmail, status: email.sent ? "sent" : "failed", detail: email.detail, sentAt: email.sent ? new Date() : null });
        if (!email.sent) emailDeliveryNotes.push(`"${prepared.title}" email delivery failed (${email.detail.slice(0, 120)}); the report remains available in the dashboard.`);
      }
    }
    await persistStage(runId, states, "deliver", "completed", task.emailEnabled ? "Dashboard delivery completed; digest and alert emails attempted" : "Delivered to the Intelis dashboard");

    const pipelineStatus = candidates.length && !analyzed.length ? "partial" : "completed";
    await updatePipelineRun(runId, { status: pipelineStatus, currentStage: null, stageStates: states, sourceCount: candidates.length, findingCount: savedFindings.length, completedAt: new Date() });

    // Notify the owner so completed research actually reaches the user.
    const completionSignal = trigger === "scheduled" ? "A scheduled research run" : "A research run";
    const headline = analyzed.length ? `${analyzed.length} verified finding${analyzed.length === 1 ? "" : "s"} analyzed` : "no verified findings were produced this run";
    const emailSummary = emailDeliveryNotes.length ? ` Email issues: ${emailDeliveryNotes.join(" ")}` : "";
    void notifyOwner({
      title: `Intelis: ${task.name} — research run completed`,
      content: `${completionSignal} for "${task.name}" finished with ${headline}. ${reports.length} report${reports.length === 1 ? "" : "s"} are available in the Intelis dashboard under Reports. ${pipelineStatus === "partial" ? "Some sources returned no usable findings this cycle." : ""}${emailSummary}`,
    }).catch(notificationError => console.warn("[Pipeline] Owner notification failed:", notificationError));

    return { runId, findingCount: savedFindings.length, sourceCount: candidates.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    const current = PIPELINE_STAGES.find(stage => states[stage].status === "running");
    if (current) await persistStage(runId, states, current, "failed", message);
    await updatePipelineRun(runId, { status: "failed", currentStage: current ?? null, stageStates: states, errorMessage: message, completedAt: new Date() });

    // Alert the owner about failed runs so silent failures never go unnoticed.
    const failureSignal = trigger === "scheduled" ? "A scheduled research run" : "A research run";
    void notifyOwner({
      title: `Intelis: ${task.name} — research run failed`,
      content: `${failureSignal} for "${task.name}" failed and was marked as failed in the pipeline history. Reason: ${message.slice(0, 900)}. Open the task on the dashboard to inspect the failed stage, or trigger a manual run to retry.`,
    }).catch(notificationError => console.warn("[Pipeline] Owner failure notification failed:", notificationError));

    throw error;
  }
}

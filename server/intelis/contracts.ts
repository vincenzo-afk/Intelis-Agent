export const PIPELINE_STAGES = [
  "search",
  "crawl",
  "scrape",
  "clean",
  "deduplicate",
  "verify",
  "summarize",
  "format",
  "deliver",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageState = {
  status: "pending" | "running" | "completed" | "failed";
  completedAt?: string;
  detail?: string;
};

export type StageStates = Record<PipelineStage, StageState>;

export type SourceCandidate = {
  title: string;
  url: string;
  sourceName: string;
  publishedAt?: Date;
  text: string;
};

export type AnalyzedFinding = {
  title: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt?: Date;
  contentExcerpt: string;
  summary: string;
  category: string;
  entities: { name: string; type: string }[];
  qualityScore: number;
  relevanceScore: number;
  credibilityScore: number;
  noveltyScore: number;
  verificationStatus: "verified" | "partially_verified" | "unverified";
  fingerprint: string;
};

export function pendingStageStates(): StageStates {
  return Object.fromEntries(
    PIPELINE_STAGES.map(stage => [stage, { status: "pending" }])
  ) as StageStates;
}

export function describeTaskTiming(input: { status: string; nextRunAt?: Date | string | null }, now = new Date()) {
  if (input.status !== "active") return "Paused";
  if (!input.nextRunAt) return "Schedule activates on publish";
  const next = new Date(input.nextRunAt);
  const remainingMs = next.getTime() - now.getTime();
  if (!Number.isFinite(next.getTime())) return "Schedule pending";
  if (remainingMs <= 0) return "Due now";
  const seconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean);
  return `Runs in ${parts.join(" ") || "< 1m"}`;
}

export function friendlyPipelineStage(stage?: string | null) {
  if (!stage) return "Preparing intelligence run";
  return `${stage.charAt(0).toUpperCase()}${stage.slice(1)} with Groq`;
}

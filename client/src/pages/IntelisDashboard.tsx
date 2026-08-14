import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportFindingsCsv, exportFindingsPdf } from "@/lib/researchExport";
import { trpc } from "@/lib/trpc";
import TaskScheduleBoard from "@/components/TaskScheduleBoard";
import { ArrowUpRight, BrainCircuit, CalendarClock, CheckCircle2, FileDown, FileSearch, Play, Radar, Sparkles, TableProperties } from "lucide-react";
import { useLocation } from "wouter";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function IntelisDashboard() {
  const [, navigate] = useLocation();
  const dashboard = trpc.intelligence.dashboard.useQuery();
  const runNow = trpc.intelligence.tasks.runNow.useMutation({ onSuccess: () => dashboard.refetch() });
  const data = dashboard.data;

  const metrics = data?.metrics ?? { activeTasks: 0, totalFindings: 0, averageQuality: 0, successfulRuns: 0, totalRuns: 0, totalTasks: 0 };
  const cards = [
    { label: "Active research", value: metrics.activeTasks, detail: `${metrics.totalTasks} configured tasks`, icon: Radar, tint: "bg-violet-500/10 text-violet-600" },
    { label: "Knowledge signals", value: metrics.totalFindings, detail: "analyzed source records", icon: FileSearch, tint: "bg-sky-500/10 text-sky-600" },
    { label: "Source quality", value: `${metrics.averageQuality}%`, detail: "average intelligence score", icon: Sparkles, tint: "bg-amber-500/10 text-amber-600" },
    { label: "Pipeline health", value: `${metrics.successfulRuns}/${metrics.totalRuns}`, detail: "completed research runs", icon: CheckCircle2, tint: "bg-emerald-500/10 text-emerald-600" },
  ];

  return <div className="mx-auto max-w-[1440px] space-y-8 px-1 pb-12">
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200/70 pb-7 md:flex-row md:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Intelligence overview</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-slate-950 md:text-4xl">Your research, in focus.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">A living view of the questions you are monitoring, the sources arriving, and the changes worth your attention.</p>
        {dashboard.error && <p className="mt-3 text-xs font-medium text-rose-600">The overview could not refresh. Your existing intelligence remains available in the workspace.</p>}
      </div>
      <Button onClick={() => navigate("/research")} className="h-10 rounded-xl bg-slate-950 px-4 text-white shadow-sm hover:bg-slate-800"><BrainCircuit className="mr-2 h-4 w-4" /> New research task</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, tint }) => <Card key={label} className="border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}><Icon className="h-4 w-4" /></span></CardContent></Card>)}
    </section>

    <TaskScheduleBoard />

    <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
      <Card className="overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]"><CardHeader className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5"><div><CardTitle className="text-base font-semibold text-slate-900">Active research</CardTitle><p className="mt-1 text-xs text-slate-500">Run on demand or review the next scheduled window.</p></div><button onClick={() => navigate("/research")} className="text-xs font-medium text-violet-600 hover:text-violet-700">Manage all</button></CardHeader><CardContent className="p-0">
        {data?.tasks.length ? <div className="divide-y divide-slate-100">{data.tasks.slice(0, 5).map(task => <div key={task.id} className="group flex items-center gap-4 px-6 py-4"><span className={`h-2 w-2 shrink-0 rounded-full ${task.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{task.name}</p><p className="mt-1 truncate text-xs text-slate-500">{task.cronExpression} UTC · {task.executionProfile === "high_throughput" ? "High throughput" : "Scheduled"}</p></div><Badge variant="secondary" className="hidden rounded-full bg-slate-100 px-2.5 text-[10px] font-medium text-slate-500 sm:inline-flex">{task.sources.join(" · ")}</Badge><Button variant="ghost" size="icon" aria-label={`Run ${task.name}`} disabled={runNow.isPending} onClick={() => runNow.mutate({ id: task.id })} className="h-8 w-8 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-700"><Play className="h-3.5 w-3.5" /></Button></div>)}</div> : <EmptyPanel icon={Radar} title="No research tasks yet" detail="Create a task to begin continuously collecting intelligence." action="Create a task" onAction={() => navigate("/research")} />}
      </CardContent></Card>

      <Card className="border-slate-200/80 bg-[#10142a] text-white shadow-[0_12px_30px_rgb(15_23_42/0.12)]"><CardHeader className="pb-3"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Ask mode</p><CardTitle className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">Your private research desk.</CardTitle></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Sparkles className="h-4 w-4 text-violet-200" /></span></div></CardHeader><CardContent><p className="text-sm leading-6 text-slate-300">Interrogate the intelligence already gathered, trace each answer to its evidence, and keep the conversation grounded in your own knowledge base.</p><Button onClick={() => navigate("/ask")} variant="secondary" className="mt-5 rounded-xl bg-white text-slate-900 hover:bg-violet-50">Open Ask Mode <ArrowUpRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_1.15fr_0.9fr]">
      <Card className="border-slate-200/80 bg-white"><CardHeader className="pb-2"><CardTitle className="text-base text-slate-900">Emerging signals</CardTitle></CardHeader><CardContent className="space-y-4">{data?.trends.length ? data.trends.slice(0, 4).map(trend => <div key={trend.id}><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium text-slate-700">{trend.label}</p><span className="text-xs font-semibold text-violet-600">+{trend.momentum}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${trend.momentum}%` }} className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" /></div><p className="mt-1.5 line-clamp-1 text-xs text-slate-400">{trend.findingCount} new signals · {trend.status}</p></div>) : <p className="py-7 text-center text-sm text-slate-400">Trends surface after recurring research runs.</p>}</CardContent></Card>
      <Card className="border-slate-200/80 bg-white"><CardHeader className="flex-row items-center justify-between gap-3 pb-2"><CardTitle className="text-base text-slate-900">Latest intelligence</CardTitle><div className="flex items-center gap-1.5"><Button variant="ghost" size="sm" disabled={!data?.findings.length} onClick={() => { if (data?.findings.length) void exportFindingsPdf(data.findings); }} className="h-7 px-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800"><FileDown className="mr-1 h-3.5 w-3.5" />PDF</Button><Button variant="ghost" size="sm" disabled={!data?.findings.length} onClick={() => { if (data?.findings.length) exportFindingsCsv(data.findings); }} className="h-7 px-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"><TableProperties className="mr-1 h-3.5 w-3.5" />CSV</Button><button onClick={() => navigate("/reports")} className="ml-1 text-xs font-medium text-violet-600">Reports</button></div></CardHeader><CardContent className="space-y-3">{data?.findings.length ? data.findings.slice(0, 3).map(finding => <a key={finding.id} href={finding.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-xl p-3 transition-colors hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">{finding.title}</p><span className="shrink-0 text-xs font-semibold text-emerald-600">{finding.qualityScore}</span></div><p className="mt-1.5 line-clamp-1 text-xs text-slate-400">{finding.sourceName} · {finding.category}</p></a>) : <p className="py-7 text-center text-sm text-slate-400">Findings will appear when a task completes.</p>}</CardContent></Card>
      <Card className="border-slate-200/80 bg-white"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-base text-slate-900">Run history</CardTitle><CalendarClock className="h-4 w-4 text-slate-400" /></CardHeader><CardContent className="space-y-3">{data?.runs.length ? data.runs.slice(0, 4).map(run => <div key={run.id} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 rounded-full ${run.status === "completed" ? "bg-emerald-500" : run.status === "failed" ? "bg-rose-500" : "bg-amber-400"}`} /><div className="min-w-0"><p className="text-xs font-medium capitalize text-slate-700">{run.status} · {run.findingCount} findings</p><p className="mt-1 text-[11px] text-slate-400">{dateFormat.format(new Date(run.createdAt))}</p></div></div>) : <p className="py-7 text-center text-sm text-slate-400">No pipeline history yet.</p>}</CardContent></Card>
    </section>
  </div>;
}

function EmptyPanel({ icon: Icon, title, detail, action, onAction }: { icon: typeof Radar; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-slate-700">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{detail}</p><Button variant="outline" size="sm" onClick={onAction} className="mt-4 rounded-lg border-slate-200 text-xs">{action}</Button></div>;
}

function DashboardSkeleton() { return <div className="mx-auto max-w-[1440px] space-y-6"><Skeleton className="h-28 w-full rounded-2xl" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div><div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></div>; }

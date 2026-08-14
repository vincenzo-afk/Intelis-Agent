import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeTaskTiming, friendlyPipelineStage } from "@/lib/taskTiming";
import { trpc } from "@/lib/trpc";
import { CalendarClock, CirclePause, Loader2, Play, Radio, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function TaskScheduleBoard() {
  const utils = trpc.useUtils();
  const [clock, setClock] = useState(() => new Date());
  const [startingTaskId, setStartingTaskId] = useState<number | null>(null);
  const tasks = trpc.intelligence.tasks.list.useQuery();
  const activity = trpc.intelligence.tasks.activity.useQuery(undefined, { refetchInterval: 1500 });

  const refresh = () => {
    utils.intelligence.tasks.list.invalidate();
    utils.intelligence.tasks.activity.invalidate();
    utils.intelligence.dashboard.invalidate();
  };
  const pause = trpc.intelligence.tasks.pause.useMutation({
    onSuccess: () => { refresh(); toast.success("Scheduled research paused"); },
    onError: error => toast.error(error.message),
  });
  const resume = trpc.intelligence.tasks.resume.useMutation({
    onSuccess: () => { refresh(); toast.success("Scheduled research resumed"); },
    onError: error => toast.error(error.message),
  });
  const runNow = trpc.intelligence.tasks.runNow.useMutation({
    onMutate: ({ id }) => setStartingTaskId(id),
    onSuccess: result => { refresh(); toast.success(`Research complete — ${result.findingCount} findings analyzed.`); },
    onError: error => toast.error(error.message),
    onSettled: () => setStartingTaskId(null),
  });

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const runningByTask = new Map((activity.data ?? []).map(run => [run.taskId, run]));

  return (
    <Card className="border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <CardHeader className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">Scheduled task control</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Live cadence, pipeline status, and controls in one place.</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><CalendarClock className="h-4 w-4" /></span>
      </CardHeader>
      <CardContent className="p-0">
        {tasks.data?.length ? (
          <div className="divide-y divide-slate-100">
            {tasks.data.map(task => {
              const run = runningByTask.get(task.id);
              const isStarting = startingTaskId === task.id;
              const isProcessing = Boolean(run) || isStarting;
              const isQueued = isStarting && !run;
              const controlPending = pause.isPending || resume.isPending || isProcessing;

              return (
                <div key={task.id} className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center">
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isProcessing ? "animate-pulse bg-violet-500" : task.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{task.name}</p>
                      {isProcessing ? (
                        <Badge className="rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> {isQueued ? "Queued" : "Processing"}</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-slate-200 text-[10px] font-medium capitalize text-slate-500">{task.status}</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={isProcessing ? "font-medium text-violet-700" : task.status === "active" ? "font-medium text-emerald-700" : "font-medium text-slate-400"}>
                        {isProcessing ? (isQueued ? "Queued · starting the Groq research pipeline" : friendlyPipelineStage(run?.currentStage)) : describeTaskTiming({ status: task.status, nextRunAt: task.nextRunAt }, clock)}
                      </span>
                      <span className="text-slate-400">{task.executionProfile === "high_throughput" ? "High throughput" : "Scheduled"}</span>
                      {task.nextRunAt && !isProcessing && <span className="text-slate-400">· {new Date(task.nextRunAt).toLocaleString()}</span>}
                    </div>
                    {isProcessing && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" /></div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" disabled={controlPending} onClick={() => runNow.mutate({ id: task.id })} className="h-9 rounded-lg bg-slate-950 text-xs text-white hover:bg-slate-800">
                      {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                      {isProcessing ? "Running" : "Run now"}
                    </Button>
                    {task.status === "active" ? (
                      <Button variant="outline" size="sm" disabled={controlPending} onClick={() => pause.mutate({ id: task.id })} className="h-9 rounded-lg border-slate-200 text-xs"><CirclePause className="mr-1.5 h-3.5 w-3.5" /> Pause</Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={controlPending} onClick={() => resume.mutate({ id: task.id })} className="h-9 rounded-lg border-slate-200 text-xs"><Rocket className="mr-1.5 h-3.5 w-3.5" /> Resume</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Radio className="h-4 w-4" /></span>
            <p className="mt-3 text-sm font-medium text-slate-700">No scheduled research yet</p>
            <p className="mt-1 text-xs text-slate-400">Create a research task to see its live cadence and controls here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

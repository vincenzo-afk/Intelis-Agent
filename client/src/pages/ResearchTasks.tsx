import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CalendarClock, CirclePause, Copy, Loader2, Play, Plus, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const sources = ["web", "rss", "news_api"] as const;
const weekdays = [
  ["MON", "Monday"], ["TUE", "Tuesday"], ["WED", "Wednesday"], ["THU", "Thursday"], ["FRI", "Friday"], ["SAT", "Saturday"], ["SUN", "Sunday"],
] as const;

type Frequency = "hourly" | "daily" | "weekly" | "custom";
type CustomUnit = "minutes" | "hours" | "days";

function scheduleCron(frequency: Frequency, time: string, weekday: string, every: string, unit: CustomUnit) {
  const [hours = "09", minutes = "00"] = time.split(":");
  const interval = Math.max(1, Math.min(unit === "minutes" ? 59 : unit === "hours" ? 23 : 30, Number.parseInt(every, 10) || 1));
  if (frequency === "hourly") return `0 ${minutes} * * * *`;
  if (frequency === "daily") return `0 ${minutes} ${hours} * * *`;
  if (frequency === "weekly") return `0 ${minutes} ${hours} * * ${weekday}`;
  if (unit === "minutes") return `0 */${interval} * * * *`;
  if (unit === "hours") return `0 ${minutes} */${interval} * * *`;
  return `0 ${minutes} ${hours} */${interval} * *`;
}

function scheduleSummary(frequency: Frequency, time: string, weekday: string, every: string, unit: CustomUnit) {
  const [, minutes = "00"] = time.split(":");
  if (frequency === "hourly") return `Every hour at :${minutes} UTC`;
  if (frequency === "daily") return `Every day at ${time} UTC`;
  if (frequency === "weekly") return `Every ${weekdays.find(day => day[0] === weekday)?.[1] ?? "Monday"} at ${time} UTC`;
  return `Every ${Math.max(1, Number.parseInt(every, 10) || 1)} ${unit} UTC`;
}

export default function ResearchTasks() {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const tasks = trpc.intelligence.tasks.list.useQuery();
  const create = trpc.intelligence.tasks.create.useMutation({
    onSuccess: () => {
      utils.intelligence.tasks.list.invalidate();
      utils.intelligence.dashboard.invalidate();
      setShowCreate(false);
      toast.success("Research task created");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.intelligence.tasks.remove.useMutation({
    onSuccess: () => { utils.intelligence.tasks.list.invalidate(); utils.intelligence.dashboard.invalidate(); toast.success("Research task deleted"); },
    onError: error => toast.error(error.message),
  });
  const run = trpc.intelligence.tasks.runNow.useMutation({
    onSuccess: result => { utils.intelligence.dashboard.invalidate(); utils.intelligence.tasks.list.invalidate(); toast.success(`Pipeline complete — ${result.findingCount} findings analyzed.`); },
    onError: error => toast.error(error.message),
  });
  const pause = trpc.intelligence.tasks.pause.useMutation({ onSuccess: () => utils.intelligence.tasks.list.invalidate() });
  const resume = trpc.intelligence.tasks.resume.useMutation({ onSuccess: () => utils.intelligence.tasks.list.invalidate() });

  return <div className="mx-auto max-w-[1280px] space-y-7 pb-12">
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200/70 pb-7 md:flex-row md:items-end">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Research operations</p><h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-slate-950">Research tasks</h1><p className="mt-2 text-sm text-slate-500">Define a question once, then let Intelis keep watch over the sources that matter.</p></div>
      <Button onClick={() => setShowCreate(value => !value)} className="h-10 rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Plus className="mr-2 h-4 w-4" /> New task</Button>
    </header>
    {showCreate && <TaskComposer busy={create.isPending} onCancel={() => setShowCreate(false)} onSubmit={values => create.mutate(values)} />}
    <div className="space-y-3">
      {tasks.isLoading ? <TaskRows /> : tasks.data?.length ? tasks.data.map(task => <Card key={task.id} className="border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-slate-700 dark:bg-slate-800"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${task.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-slate-800">{task.name}</h2><Badge className="rounded-full bg-violet-50 text-[10px] font-medium text-violet-700 hover:bg-violet-50">{task.executionProfile === "high_throughput" ? "High throughput" : "Scheduled"}</Badge><Badge variant="outline" className="rounded-full border-slate-200 text-[10px] font-medium text-slate-500">{task.status}</Badge></div><p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-500">{task.naturalLanguageRequest}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400"><span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {task.cronExpression} UTC</span><span>{task.sources.map(value => value.replace("_", " ")).join(" · ")}</span>{task.scheduleCronTaskUid ? <span className="text-emerald-600">Schedule active</span> : <span className="text-amber-600">Schedule activates on publish</span>}</div></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ id: task.id })} className="h-9 rounded-lg border-slate-200 text-xs"><Play className="mr-1.5 h-3.5 w-3.5" /> Run</Button>{task.status === "active" ? <Button size="icon" variant="ghost" aria-label="Pause task" onClick={() => pause.mutate({ id: task.id })} className="h-9 w-9 rounded-lg text-slate-400"><CirclePause className="h-4 w-4" /></Button> : <Button size="icon" variant="ghost" aria-label="Resume task" onClick={() => resume.mutate({ id: task.id })} className="h-9 w-9 rounded-lg text-slate-400"><Rocket className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" aria-label="Delete task" onClick={() => remove.mutate({ id: task.id })} className="h-9 w-9 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>) : <div className="rounded-2xl border border-dashed border-slate-200 py-24 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><Copy className="h-5 w-5" /></span><p className="mt-4 text-sm font-medium text-slate-700">Start with a research question.</p><p className="mt-1 text-xs text-slate-400">Your task determines what Intelis searches, evaluates, and reports.</p></div>}
    </div>
  </div>;
}

function TaskComposer({ onCancel, onSubmit, busy }: { busy: boolean; onCancel: () => void; onSubmit: (value: { name: string; naturalLanguageRequest: string; sources: (typeof sources)[number][]; keywords: string[]; topics: string[]; sourceFilters: { include: string[]; exclude: string[] }; cronExpression: string; executionProfile: "scheduled" | "high_throughput"; emailEnabled: boolean; deliveryEmail?: string }) => void }) {
  const [name, setName] = useState("");
  const [request, setRequest] = useState("");
  const [selectedSources, setSelectedSources] = useState<(typeof sources)[number][]>(["web"]);
  const [urls, setUrls] = useState("");
  const [keywords, setKeywords] = useState("");
  const [topics, setTopics] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [time, setTime] = useState("09:00");
  const [weekday, setWeekday] = useState("MON");
  const [every, setEvery] = useState("2");
  const [customUnit, setCustomUnit] = useState<CustomUnit>("hours");
  const [profile, setProfile] = useState<"scheduled" | "high_throughput">("scheduled");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const cronExpression = scheduleCron(frequency, time, weekday, every, customUnit);

  const submit = () => onSubmit({ name, naturalLanguageRequest: request, sources: selectedSources, keywords: keywords.split(",").map(value => value.trim()).filter(Boolean), topics: topics.split(",").map(value => value.trim()).filter(Boolean), sourceFilters: { include: urls.split(/\n|,/).map(value => value.trim()).filter(Boolean), exclude: [] }, cronExpression, executionProfile: profile, emailEnabled, deliveryEmail: email || undefined });

  return <Card className="border-violet-100 bg-violet-50/40 shadow-[0_8px_28px_rgb(109_89_255/0.07)]"><CardContent className="p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-800">Define your intelligence brief</p><p className="mt-1 text-xs text-slate-500">Choose when Intelis should refresh your research. All times are stored in UTC.</p></div><button onClick={onCancel} className="text-xs font-medium text-slate-500 hover:text-slate-800">Cancel</button></div><div className="grid gap-5 md:grid-cols-2"><Field label="Task name"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Competitive landscape watch" className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></Field><div><p className="mb-2 text-xs font-medium text-slate-600">Schedule</p><div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">{(["hourly", "daily", "weekly", "custom"] as Frequency[]).map(option => <button key={option} type="button" onClick={() => setFrequency(option)} className={`rounded-lg px-2 py-2 text-[11px] font-medium capitalize transition-colors ${frequency === option ? "bg-[#11162e] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>{option}</button>)}</div></div><div className="md:col-span-2 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-end">{frequency !== "custom" && <Field label={frequency === "hourly" ? "Minute past the hour" : "Time (UTC)"}><Input type={frequency === "hourly" ? "number" : "time"} min={frequency === "hourly" ? 0 : undefined} max={frequency === "hourly" ? 59 : undefined} value={frequency === "hourly" ? time.split(":")[1] : time} onChange={event => frequency === "hourly" ? setTime(`00:${String(Math.min(59, Math.max(0, Number(event.target.value) || 0))).padStart(2, "0")}`) : setTime(event.target.value)} className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-40" /></Field>}{frequency === "weekly" && <Field label="Day"><select value={weekday} onChange={event => setWeekday(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-3 text-sm text-slate-700 sm:w-40">{weekdays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}{frequency === "custom" && <><Field label="Repeat every"><Input type="number" min={1} value={every} onChange={event => setEvery(event.target.value)} className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-28" /></Field><Field label="Unit"><select value={customUnit} onChange={event => setCustomUnit(event.target.value as CustomUnit)} className="h-9 w-full rounded-lg border border-input bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-3 text-sm text-slate-700 sm:w-36"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></Field>{customUnit !== "minutes" && <Field label="At (UTC)"><Input type="time" value={time} onChange={event => setTime(event.target.value)} className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-40" /></Field>}</>}<div className="sm:ml-auto"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-violet-600">Next cadence</p><p className="mt-1 text-xs font-medium text-slate-700">{scheduleSummary(frequency, time, weekday, every, customUnit)}</p></div></div></div><div className="md:col-span-2"><Field label="What should Intelis research?"><Textarea value={request} onChange={event => setRequest(event.target.value)} placeholder="Monitor material developments, funding, partnerships, and strategic moves among..." className="min-h-24 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></Field></div><Field label="Source channels"><div className="flex flex-wrap gap-4 pt-2">{sources.map(source => <label key={source} className="flex items-center gap-2 text-xs capitalize text-slate-600"><Checkbox checked={selectedSources.includes(source)} onCheckedChange={checked => setSelectedSources(current => checked ? [...current, source] : current.filter(value => value !== source))} />{source.replace("_", " ")}</label>)}</div></Field><Field label="Keywords (optional)"><Input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="market, partnership, launch" className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></Field><Field label="Topics (optional)"><Input value={topics} onChange={event => setTopics(event.target.value)} placeholder="AI agents, enterprise software" className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></Field><Field label="RSS feeds or web URLs"><Input value={urls} onChange={event => setUrls(event.target.value)} placeholder="https://example.com/feed.xml" className="bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></Field><div className="md:col-span-2"><p className="mb-2 text-xs font-medium text-slate-600">Execution profile</p><div className="grid gap-3 md:grid-cols-2"><ProfileButton selected={profile === "scheduled"} title="Scheduled" detail="Focused runs that gather and analyze a bounded set of sources." onClick={() => setProfile("scheduled")} /><ProfileButton selected={profile === "high_throughput"} title="High throughput" detail="Larger per-run discovery set for denser monitoring workflows." onClick={() => setProfile("high_throughput")} /></div></div><div className="md:col-span-2 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70 p-4 sm:flex-row sm:items-center"><Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} /><div className="flex-1"><p className="text-xs font-medium text-slate-700">Email intelligence delivery</p><p className="mt-0.5 text-[11px] text-slate-400">Send a report when this scheduled task completes or detects a change.</p></div>{emailEnabled && <Input value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" type="email" className="sm:max-w-64 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />}</div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onCancel} className="rounded-lg">Cancel</Button><Button disabled={busy || !name.trim() || !request.trim() || !selectedSources.length} onClick={submit} className="rounded-lg bg-slate-950 text-white hover:bg-slate-800">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create research task</Button></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-600">{label}</span>{children}</label>; }
function ProfileButton({ title, detail, selected, onClick }: { title: string; detail: string; selected: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"}`}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">{title}</p><span className={`h-3 w-3 rounded-full border-2 ${selected ? "border-violet-600 bg-violet-600 shadow-[0_0_0_3px_rgb(237_233_254)]" : "border-slate-300"}`} /></div><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></button>; }
function TaskRows() { return <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>; }

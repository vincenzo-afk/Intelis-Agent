import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportReportPdf, exportReportsCsv } from "@/lib/researchExport";
import { trpc } from "@/lib/trpc";
import { Download, FileDown, FileText, Inbox, Loader2, TableProperties } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const formatDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function Reports() {
  const reports = trpc.intelligence.reports.list.useQuery();
  const [exportingId, setExportingId] = useState<number | null>(null);
  const items = reports.data ?? [];
  const exportPdf = async (report: typeof items[number]) => {
    setExportingId(report.id);
    try {
      await exportReportPdf(report);
      toast.success("PDF export is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the PDF export.");
    } finally {
      setExportingId(null);
    }
  };

  return <div className="mx-auto max-w-[1100px] space-y-7 pb-12">
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200/70 pb-7 md:flex-row md:items-end">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Delivery archive</p><h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-slate-950">Intelligence reports</h1><p className="mt-2 text-sm text-slate-500">Structured summaries, digests, and alerts produced by completed research runs.</p></div>
      <Button variant="outline" disabled={!items.length} onClick={() => { exportReportsCsv(items); toast.success("Research-result CSV export is ready."); }} className="rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><TableProperties className="mr-2 h-4 w-4 text-emerald-600" /> Export all CSV</Button>
    </header>
    <div className="space-y-3">{items.length ? items.map(report => <Card key={report.id} id={`report-${report.id}`} className="scroll-mt-6 border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800"><CardContent className="p-5"><div className="flex items-start gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-slate-800">{report.title}</h2><Badge className="rounded-full bg-slate-100 text-[10px] font-medium capitalize text-slate-500 hover:bg-slate-100">{report.reportType}</Badge></div><Button size="sm" variant="outline" disabled={exportingId === report.id} onClick={() => exportPdf(report)} className="h-8 shrink-0 rounded-lg border-slate-200 text-xs"><>{exportingId === report.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}</>PDF</Button></div><p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-500">{report.content}</p><p className="mt-3 text-[11px] text-slate-400">{formatDate.format(new Date(report.createdAt))}</p></div></div></CardContent></Card>) : <div className="rounded-2xl border border-dashed border-slate-200 py-24 text-center"><Inbox className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-4 text-sm font-medium text-slate-600">No reports have been generated.</p><p className="mt-1 text-xs text-slate-400">Completed runs will format and deliver reports here.</p></div>}</div>
  </div>;
}

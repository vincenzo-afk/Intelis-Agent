import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportableReport = {
  id: number;
  title: string;
  reportType: string;
  content: string;
  createdAt: Date | string;
};

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72) || "intelis-report";
}

function downloadFile(data: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function reportCsv(reports: ExportableReport[]) {
  const header = ["Report ID", "Title", "Type", "Generated at", "Content"];
  const rows = reports.map(report => [report.id, report.title, report.reportType, new Date(report.createdAt).toISOString(), report.content]);
  return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function exportReportsCsv(reports: ExportableReport[]) {
  downloadFile(reportCsv(reports), "text/csv;charset=utf-8", `intelis-research-results-${new Date().toISOString().slice(0, 10)}.csv`);
}

export type ExportableFinding = {
  id: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  summary: string;
  category: string;
  qualityScore: number;
  relevanceScore: number;
  credibilityScore: number;
  createdAt: Date | string;
};

export function findingCsv(findings: ExportableFinding[]) {
  const header = ["Finding ID", "Title", "Source", "Source URL", "Category", "Quality score", "Relevance score", "Credibility score", "Generated at", "Groq summary"];
  const rows = findings.map(finding => [finding.id, finding.title, finding.sourceName, finding.sourceUrl, finding.category, finding.qualityScore, finding.relevanceScore, finding.credibilityScore, new Date(finding.createdAt).toISOString(), finding.summary]);
  return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function exportFindingsCsv(findings: ExportableFinding[]) {
  downloadFile(findingCsv(findings), "text/csv;charset=utf-8", `intelis-research-findings-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportFindingsPdf(findings: ExportableFinding[]) {
  const content = findings.map((finding, index) => [
    `${index + 1}. ${finding.title}`,
    `${finding.category} · Quality ${finding.qualityScore}/100 · Relevance ${finding.relevanceScore}/100 · Credibility ${finding.credibilityScore}/100`,
    `Source: ${finding.sourceName} — ${finding.sourceUrl}`,
    finding.summary,
    "",
  ].join("\n")).join("\n");
  return exportReportPdf({
    id: 0,
    title: "Groq research findings",
    reportType: "research findings",
    content: content || "No research findings were available at the time of export.",
    createdAt: new Date(),
  });
}

function wrapText(value: string, maxCharacters: number) {
  const paragraphs = value.replace(/\r/g, "").split("\n");
  return paragraphs.flatMap(paragraph => {
    if (!paragraph.trim()) return [""];
    const words = paragraph.trim().split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxCharacters && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  });
}

export async function exportReportPdf(report: ExportableReport) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursor = pageHeight - margin;

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    cursor = pageHeight - margin;
  };
  const drawLine = (line: string, size = 10, font = regular, color = rgb(0.22, 0.25, 0.33)) => {
    if (cursor < margin + 18) addPage();
    page.drawText(line, { x: margin, y: cursor, size, font, color, maxWidth: pageWidth - margin * 2 });
    cursor -= size + 5;
  };

  page.drawText("INTELIS / RESEARCH SYSTEM", { x: margin, y: cursor, size: 8, font: bold, color: rgb(0.42, 0.24, 0.82) });
  cursor -= 30;
  for (const line of wrapText(report.title, 45)) drawLine(line, 21, bold, rgb(0.07, 0.09, 0.18));
  cursor -= 8;
  drawLine(`${report.reportType.toUpperCase()}  •  ${new Date(report.createdAt).toLocaleString()}`, 8, bold, rgb(0.42, 0.46, 0.55));
  cursor -= 18;
  for (const line of wrapText(report.content, 92)) drawLine(line);

  const bytes = await pdf.save();
  const binary = new Uint8Array(bytes).buffer as ArrayBuffer;
  downloadFile(binary, "application/pdf", `${safeFilename(report.title)}.pdf`);
}

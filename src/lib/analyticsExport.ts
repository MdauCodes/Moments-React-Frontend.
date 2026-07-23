// ----------------------------------------------------------------------------
// Generic export for the admin analytics dashboards — CSV, Excel (.xlsx via
// exceljs), and PDF (jspdf, see downloadAnalyticsReportPdf in ./pdf.ts).
//
// Every analytics page has the same basic shape: a handful of KPIs plus zero
// or more named tables (top sellers, revenue by county, etc). Rather than
// hand-write an exporter per page, each page just builds an
// AnalyticsExportPayload from its own already-fetched state and hands it to
// one of the three functions below.
// ----------------------------------------------------------------------------

import ExcelJS from "exceljs";
import { downloadCsv } from "@/lib/csv";
import type { DateRange } from "@/components/admin/DateRangePicker";

const RANGE_PRESET_LABELS: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 days",
  month: "This month",
  year: "This year",
};

/** Every analytics page's DateRangePicker state, turned into a human label for exports. */
export function formatRangeLabel(range: DateRange | null): string {
  if (!range) return "";
  if (range.preset !== "custom") return RANGE_PRESET_LABELS[range.preset] ?? range.preset;
  const fmt = (d: Date) => d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

// Re-exported so every analytics page has one import location for all three
// formats — the PDF builder itself lives in pdf.ts since it reuses that
// module's masthead/KPI-card/table design system (see downloadAnalyticsReportPdf).
export { downloadAnalyticsReportPdf as downloadAnalyticsPdf } from "@/lib/pdf";

export interface AnalyticsExportKpi {
  label: string;
  value: string;
}

export interface AnalyticsExportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface AnalyticsExportPayload {
  /** e.g. "Rewards & Referrals" — used as the PDF doc title and Excel summary sheet heading. */
  pageTitle: string;
  /** e.g. "This month" or "01 Jul – 23 Jul 2026" — shown under the title. */
  rangeLabel: string;
  kpis: AnalyticsExportKpi[];
  tables: AnalyticsExportTable[];
  /** Base filename, no extension, no date — e.g. "analytics-rewards". */
  filenamePrefix: string;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV file: a KPI section, then one section per table, blank-line separated. */
export function downloadAnalyticsCsv(payload: AnalyticsExportPayload): void {
  const lines: string[] = [];
  lines.push(csvEscape(payload.pageTitle));
  lines.push(csvEscape(payload.rangeLabel));
  lines.push("");

  if (payload.kpis.length > 0) {
    lines.push("Metric,Value");
    for (const kpi of payload.kpis) {
      lines.push(`${csvEscape(kpi.label)},${csvEscape(kpi.value)}`);
    }
    lines.push("");
  }

  for (const table of payload.tables) {
    lines.push(csvEscape(table.title));
    lines.push(table.columns.map(csvEscape).join(","));
    for (const row of table.rows) {
      lines.push(row.map(csvEscape).join(","));
    }
    lines.push("");
  }

  downloadCsv(`${payload.filenamePrefix}-${dateStamp()}.csv`, lines.join("\n"));
}

/**
 * One workbook, multiple sheets — a "Summary" sheet with the KPIs, plus one
 * sheet per table. This (not CSV) is the actual reason to offer a real .xlsx:
 * CSV can't hold more than one table per file.
 */
export async function downloadAnalyticsExcel(payload: AnalyticsExportPayload): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Moments Packaging admin";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.addRow([payload.pageTitle]).font = { bold: true, size: 14 };
  summary.addRow([payload.rangeLabel]).font = { italic: true, color: { argb: "FF666666" } };
  summary.addRow([]);
  if (payload.kpis.length > 0) {
    const header = summary.addRow(["Metric", "Value"]);
    header.font = { bold: true };
    for (const kpi of payload.kpis) {
      summary.addRow([kpi.label, kpi.value]);
    }
  }
  summary.columns.forEach((col) => {
    col.width = 32;
  });

  for (const table of payload.tables) {
    // Sheet names can't exceed 31 chars or contain []:*?/\ — sanitize defensively.
    const sheetName = table.title.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Table";
    const sheet = workbook.addWorksheet(sheetName);
    const header = sheet.addRow(table.columns);
    header.font = { bold: true };
    for (const row of table.rows) {
      sheet.addRow(row);
    }
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${payload.filenamePrefix}-${dateStamp()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

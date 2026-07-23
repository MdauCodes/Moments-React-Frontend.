import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadAnalyticsCsv, downloadAnalyticsExcel, downloadAnalyticsPdf, type AnalyticsExportPayload } from "@/lib/analyticsExport";

/**
 * Three export buttons (CSV / Excel / PDF) for an admin analytics page — same
 * admin-btn styling as the Orders page's existing Export CSV/PDF buttons, so
 * it reads as the same feature rather than a second export pattern.
 */
export function AnalyticsExportButtons({ getPayload }: { getPayload: () => AnalyticsExportPayload }) {
  const [busy, setBusy] = useState<"csv" | "excel" | "pdf" | null>(null);

  async function run(kind: "csv" | "excel" | "pdf") {
    setBusy(kind);
    try {
      const payload = getPayload();
      if (kind === "csv") downloadAnalyticsCsv(payload);
      else if (kind === "excel") await downloadAnalyticsExcel(payload);
      else await downloadAnalyticsPdf(payload);
      toast.success(`Exported ${payload.pageTitle} (${kind.toUpperCase()})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button className="admin-btn admin-btn-ghost" disabled={busy !== null} onClick={() => run("csv")}>
        <Download size={14} style={{ marginRight: 6 }} />
        {busy === "csv" ? "Exporting…" : "CSV"}
      </button>
      <button className="admin-btn admin-btn-ghost" disabled={busy !== null} onClick={() => run("excel")}>
        <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
        {busy === "excel" ? "Exporting…" : "Excel"}
      </button>
      <button className="admin-btn admin-btn-ghost" disabled={busy !== null} onClick={() => run("pdf")}>
        <FileText size={14} style={{ marginRight: 6 }} />
        {busy === "pdf" ? "Exporting…" : "PDF"}
      </button>
    </div>
  );
}

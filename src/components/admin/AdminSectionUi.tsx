import type { ReactNode } from "react";

/** Tiny shared presentational helpers — used by OrderDetailModal and all three
 *  per-fulfillment-mode panels, so the visual language stays identical across them. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-lg border bg-card p-4 space-y-1">{children}</div>
    </section>
  );
}

export function Row({ label, value, bold }: { label: string; value: ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

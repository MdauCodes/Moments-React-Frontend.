import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Tiny shared presentational helpers — used by OrderDetailModal and all three
 *  per-fulfillment-mode panels, so the visual language stays identical across them. */
export function Section({
  title,
  children,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  /** Opt-in — every existing call site keeps today's always-expanded behavior unless it
   *  explicitly passes this. Used to keep the admin order modal compact by default: only the
   *  sections an admin needs at a glance stay expanded, the rest are a click away. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <section>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between text-left"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          {open ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </button>
      ) : (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      )}
      {showBody && <div className="rounded-lg border bg-card p-4 space-y-1">{children}</div>}
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

import type { ComponentType, ReactNode } from "react";

export interface StatCardProps {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "accent";
}

/** A single Stripe-style metric tile: icon chip, uppercase label, large tabular value. */
export function StatCard({ icon: Icon, label, value, caption, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
              tone === "accent" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** Responsive grid wrapper — 2 columns on mobile, auto-fit wider tiles from sm up. */
export function StatCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

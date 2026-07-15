import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";

/**
 * Small explanatory block used inside dashboard tabs — reuses the same
 * Info-icon + muted-note visual pattern CreditReadinessCard already
 * established, so it doesn't look like a new one-off design.
 */
export function HowItWorksCard({
  icon: Icon = Info,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-kraft/25 bg-kraft/[0.04] p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-kraft/15 text-kraft">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

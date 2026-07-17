import type { ComponentType, ReactNode } from "react";

/**
 * Plain, neutral account-identity line above the stat cards — replaces the old dark green
 * banner. Icon chip + name + optional status/tier badge, with a small muted meta line beneath.
 */
export function DashboardIdentityRow({
  icon: Icon,
  name,
  badge,
  meta,
}: {
  icon: ComponentType<{ className?: string }>;
  name: string;
  badge?: ReactNode;
  meta?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold leading-tight text-foreground">{name}</p>
          {badge}
        </div>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
    </div>
  );
}

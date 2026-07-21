import { useEffect, useState } from "react";

export type DateRangePreset = "today" | "7d" | "month" | "year" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: Date;
  to: Date;
}

const PRESET_LABELS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function computeRange(preset: DateRangePreset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "7d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: now };
    }
    case "month": {
      const from = startOfDay(now);
      from.setDate(1);
      return { from, to: now };
    }
    case "year": {
      const from = startOfDay(now);
      from.setMonth(0, 1);
      return { from, to: now };
    }
    case "custom":
      return { from: customFrom ?? startOfDay(now), to: customTo ?? now };
  }
}

/** Date-range picker for the analytics dashboard — every section reuses this so "the same
 *  period" always means the same concrete [from, to) instants across every chart/KPI. */
export function DateRangePicker({ onChange }: { onChange: (range: DateRange) => void }) {
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Fire once on mount with the default preset so the parent has a range to load before the
  // admin touches anything — the effect intentionally only runs once (mount), not on every
  // onChange identity change, since onChange is expected to be a fresh function each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const { from, to } = computeRange("month");
    onChange({ preset: "month", from, to });
  }, []);

  function apply(nextPreset: DateRangePreset, fromStr?: string, toStr?: string) {
    setPreset(nextPreset);
    const customFromDate = fromStr ? new Date(fromStr) : undefined;
    const customToDate = toStr ? new Date(`${toStr}T23:59:59`) : undefined;
    const { from, to } = computeRange(nextPreset, customFromDate, customToDate);
    onChange({ preset: nextPreset, from, to });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {PRESET_LABELS.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`admin-btn ${preset === p.value ? "admin-btn-primary" : "admin-btn-ghost"}`}
          onClick={() => apply(p.value, customFrom, customTo)}
        >
          {p.label}
        </button>
      ))}
      {preset === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            className="admin-input"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              apply("custom", e.target.value, customTo);
            }}
          />
          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>to</span>
          <input
            type="date"
            className="admin-input"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              apply("custom", customFrom, e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}

export { computeRange as computeDateRange };

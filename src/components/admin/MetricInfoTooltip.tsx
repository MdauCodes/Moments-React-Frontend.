import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
}

/**
 * Small inline "explain this metric" affordance — unlike HelpPanel (one "?" fixed to the
 * viewport's bottom-right corner for whole-page help), this anchors to whatever KPI/table/chart
 * heading it's placed next to, so every metric can carry its own explanation. Closes on outside
 * click or Escape.
 */
export function MetricInfoTooltip({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`About: ${title}`}
        title={title}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "1px solid var(--admin-border)",
          background: open ? "var(--admin-accent)" : "transparent",
          color: open ? "var(--cream)" : "var(--admin-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Info size={12} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          style={{
            position: "absolute",
            top: 26,
            right: 0,
            zIndex: 30,
            width: "min(320px, calc(100vw - 32px))",
            background: "var(--admin-surface, #fff)",
            border: "1px solid var(--admin-border)",
            borderRadius: 12,
            padding: 14,
            boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
            color: "var(--admin-text)",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13.5,
              fontWeight: 600,
              marginBottom: 6,
              color: "var(--admin-text)",
            }}
          >
            {title}
          </div>
          <div style={{ color: "var(--admin-muted)" }}>{children}</div>
        </div>
      )}
    </div>
  );
}

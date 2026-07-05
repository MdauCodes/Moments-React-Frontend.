import { useState, type ReactNode } from "react";
import { HelpCircle, X } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
}

/**
 * Floating "?" helper fixed to the bottom-right of the viewport. Deliberately
 * NOT anchored to page content (top-right there is where per-page toolbars —
 * search, filters, view toggles — already live, and a relative-to-content
 * anchor collided with those). Bottom-right of the viewport stays clear on
 * every admin page regardless of what that page puts in its own toolbar.
 * Click to expand into a popover with role-specific guidance.
 */
export function HelpPanel({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 40 }}>
      <button
        type="button"
        aria-label="Page help"
        title="What is this page?"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid var(--admin-border)",
          background: open ? "var(--admin-accent)" : "var(--admin-surface, #fff)",
          color: open ? "var(--cream)" : "var(--admin-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {open ? <X size={15} /> : <HelpCircle size={16} />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          style={{
            position: "absolute",
            bottom: 40,
            right: 0,
            width: "min(360px, calc(100vw - 32px))",
            background: "var(--admin-surface, #fff)",
            border: "1px solid var(--admin-border)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
            color: "var(--admin-text)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 8,
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

/** No-op wrapper kept for call-site compatibility — HelpPanel now fixed-positions to the viewport, not to this anchor. */
export function HelpAnchor({ children }: { children: ReactNode }) {
  return <div style={{ position: "relative" }}>{children}</div>;
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

import { matchNavItems, type NavSection } from "@/layouts/adminNav";

// The rail-mode/mobile fallback for AdminSidebarNav's own inline Ctrl+K filter, which only exists
// (and only wires up its own shortcut) in expanded desktop mode — see that file's own comment.
// Collapsing the sidebar to a clean icon rail, or opening it as a mobile drawer, previously meant
// losing fast keyboard/typed navigation entirely; this is the one search surface that works
// regardless of sidebar mode, rendered at the AdminLayout level so it isn't tied to either.

export interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  onNavigate: (to: string) => void;
}

export function AdminCommandPalette({ open, onClose, sections, onNavigate }: AdminCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
      // Portal content isn't mounted yet on the same tick this effect fires — next frame is
      // enough for the input to exist and be focusable.
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => (trimmed ? matchNavItems(sections, trimmed) : []), [sections, trimmed]);

  useEffect(() => setHighlightIndex(0), [trimmed]);

  if (!open) return null;

  function go(to: string) {
    onNavigate(to);
    onClose();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matches[highlightIndex];
      if (target) go(target.item.to);
    }
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 300,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "12vh 16px 16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search admin navigation"
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--admin-sidebar)",
          border: "1px solid var(--admin-sidebar-border)",
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--admin-sidebar-border)" }}>
          <Search size={15} style={{ color: "var(--admin-sidebar-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page…"
            aria-label="Search admin navigation"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "var(--admin-sidebar-text)",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div style={{ overflowY: "auto", padding: 6 }}>
          {trimmed === "" ? (
            <div style={{ padding: "20px 14px", fontSize: 12.5, color: "var(--admin-sidebar-muted)", textAlign: "center" }}>
              Start typing to search every page you can access.
            </div>
          ) : matches.length === 0 ? (
            <div style={{ padding: "20px 14px", fontSize: 12.5, color: "var(--admin-sidebar-muted)", textAlign: "center" }}>
              No matches for "{query.trim()}".
            </div>
          ) : (
            matches.map((m, i) => {
              const Icon = m.item.icon;
              const highlighted = i === highlightIndex;
              return (
                <button
                  key={m.item.to}
                  type="button"
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => go(m.item.to)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    background: highlighted ? "var(--admin-sidebar-surface)" : "transparent",
                    color: "oklch(0.88 0.02 84)",
                    font: "inherit",
                    fontSize: 13,
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0, color: "var(--admin-sidebar-muted)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{m.item.label}</span>
                  <span style={{ fontSize: 10.5, color: "var(--admin-sidebar-muted)", flexShrink: 0 }}>{m.section.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

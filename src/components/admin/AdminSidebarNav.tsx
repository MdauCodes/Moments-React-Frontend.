import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";

import {
  countVisibleItems,
  DENSE_ITEM_THRESHOLD,
  matchNavItems,
  resolveActiveNav,
  type NavItem,
  type NavMatch,
  type NavSection,
} from "@/layouts/adminNav";
import { readSidebarPrefs, writeSidebarSectionOpen } from "@/lib/adminSidebarPrefs";

// Sidebar drawer flips to the fixed mobile overlay below this width (styles.css's own
// `@media (max-width: 920px)` on .admin-sidebar) — kept as a local constant rather than reusing
// use-mobile.tsx's hook, which is scoped to a different 768px breakpoint for a different purpose.
const MOBILE_BREAKPOINT = 920;

export interface SidebarBadge {
  /** Distinct source identifier — e.g. the fulfillment-type key, or the item's own `to` when
   *  there's no shared source. Two items sharing a key (Manual Delivery and CBD/Hand Delivery
   *  both map to MANUAL_DELIVERY) must resolve to the SAME key so a collapsed section's roll-up
   *  can dedupe them instead of double-counting one real count as two. */
  key: string;
  count: number;
}

export interface AdminSidebarNavProps {
  sections: NavSection[]; // already permission-filtered — this component only narrows further
  pathname: string;
  userId: string | undefined | null;
  badgeFor: (item: NavItem) => SidebarBadge | undefined;
  /** True while the onboarding tour is running — forces every section open so the tour's
   *  data-tour selectors can always find their target, overriding even an explicit user
   *  collapse. */
  forceExpandAll: boolean;
  /** Fired on any navigation via this nav (click or keyboard-select) — lets the mobile drawer
   *  close itself, which today only happens by accident when AdminLayout remounts. */
  onNavigate?: () => void;
}

const styles: Record<string, CSSProperties> = {
  nav: { flex: 1, overflowY: "auto", padding: "10px 8px" },
  filterWrap: { position: "relative", margin: "0 4px 10px", display: "flex", alignItems: "center" },
  filterIcon: { position: "absolute", left: 10, color: "var(--admin-sidebar-muted)", pointerEvents: "none" },
  filterClear: {
    position: "absolute",
    right: 6,
    background: "transparent",
    border: "none",
    color: "var(--admin-sidebar-muted)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  sectionHeader: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
    marginTop: 6,
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
  },
  sectionHeaderLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--admin-sidebar-muted)",
    opacity: 0.85,
  },
  sectionHeaderRight: { display: "flex", alignItems: "center", gap: 6 },
  sectionCount: { fontSize: 10, color: "var(--admin-sidebar-muted)", opacity: 0.75 },
  chevron: { color: "var(--admin-sidebar-muted)", transition: "transform 150ms", flexShrink: 0 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    borderRadius: 6,
    borderLeft: "3px solid transparent",
    color: "var(--admin-sidebar-muted)",
    fontSize: 13,
    textDecoration: "none",
    cursor: "pointer",
  },
  navItemActive: {
    background: "var(--admin-sidebar-surface)",
    borderLeft: "3px solid var(--admin-accent)",
    color: "var(--admin-sidebar-text)",
    fontWeight: 600,
  },
  badge: {
    marginLeft: "auto",
    background: "var(--admin-clay)",
    color: "var(--cream)",
    fontSize: 9,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 999,
    lineHeight: 1.2,
  },
  sectionBadge: {
    background: "var(--admin-clay)",
    color: "var(--cream)",
    fontSize: 9,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 999,
    lineHeight: 1.2,
  },
};

// AdminLayout is instantiated fresh per admin page (not a shared route layout), so this nav's DOM
// is destroyed and recreated on every navigation — resetting scroll to the top and forcing staff
// to re-scroll down to reach lower items. This module-level value survives that remount (persists
// for the SPA session) so scroll position carries across page changes. Now that most sections
// collapse, the redesign makes this matter far less than it used to, but it's kept for the cases
// that still scroll (a dense, all-matching filter result; a very long expanded section).
let sidebarScrollTop = 0;

function badgeAriaLabel(count: number): string {
  return `${count} new`;
}

/** Sum of DISTINCT badge sources across a section's items — several items can legitimately share
 *  one underlying count (Manual Delivery / CBD Hand Delivery both read MANUAL_DELIVERY), so this
 *  dedupes by `key` before summing rather than adding every item's raw count. */
function sectionBadgeTotal(section: NavSection, badgeFor: (item: NavItem) => SidebarBadge | undefined): number {
  const bySource = new Map<string, number>();
  for (const item of section.items) {
    const b = badgeFor(item);
    if (b) bySource.set(b.key, b.count);
  }
  let total = 0;
  for (const count of bySource.values()) total += count;
  return total;
}

export function AdminSidebarNav({ sections, pathname, userId, badgeFor, forceExpandAll, onNavigate }: AdminSidebarNavProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  // In-memory mirror of explicit user toggles, seeded from localStorage once per userId — reading
  // localStorage on every render would be wasteful, and this also survives AdminLayout's
  // per-navigation remount within the same userId for the rest of the session even if storage
  // itself becomes unwritable partway through (private-mode edge case).
  const [toggled, setToggled] = useState<Record<string, boolean>>(() => readSidebarPrefs(userId).sections);

  useEffect(() => {
    setToggled(readSidebarPrefs(userId).sections);
  }, [userId]);

  const { activeTo, activeSectionLabel } = useMemo(() => resolveActiveNav(pathname, sections), [pathname, sections]);
  const dense = useMemo(() => countVisibleItems(sections) > DENSE_ITEM_THRESHOLD, [sections]);

  const trimmedQuery = query.trim();
  const searching = dense && trimmedQuery.length > 0;
  const matches = useMemo(() => (searching ? matchNavItems(sections, trimmedQuery) : []), [searching, sections, trimmedQuery]);

  // Query is never persisted, and stays scoped to whatever page you were on when you typed it —
  // clearing it on navigation means correct behaviour never depends on remembering to clear it
  // yourself, and a stale query can't silently hide sections after you've already jumped away.
  useEffect(() => {
    setQuery("");
    setHighlightIndex(0);
  }, [pathname]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [trimmedQuery]);

  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = sidebarScrollTop;
  }, []);

  // A stale scroll offset from a much longer, previously-expanded list would otherwise scroll a
  // now-much-shorter one to the bottom and show blank space above it.
  useLayoutEffect(() => {
    sidebarScrollTop = 0;
    if (navRef.current) navRef.current.scrollTop = 0;
  }, [searching, activeSectionLabel]);

  // Ctrl/Cmd+K focuses the filter — desktop only. On the mobile drawer this would fight the soft
  // keyboard popping up over the menu the instant it opens, so the shortcut (not the box itself,
  // which stays visible and tappable) is suppressed below the drawer breakpoint.
  useEffect(() => {
    if (!dense) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && window.innerWidth > MOBILE_BREAKPOINT) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dense]);

  function isSectionOpen(section: NavSection): boolean {
    if (searching) return true; // only ever asked for sections that already have ≥1 match
    if (forceExpandAll) return true;
    const explicit = toggled[section.label];
    if (explicit !== undefined) return explicit;
    if (section.label === activeSectionLabel) return true;
    if (!dense) return true;
    if (section.items.length === 1) return true;
    return false;
  }

  function toggleSection(section: NavSection) {
    const next = !isSectionOpen(section);
    setToggled((prev) => ({ ...prev, [section.label]: next }));
    writeSidebarSectionOpen(userId, section.label, next);
  }

  function go(to: string) {
    navigate(to);
    onNavigate?.();
  }

  function onFilterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!searching) {
      if (e.key === "Escape") {
        (e.currentTarget as HTMLInputElement).blur();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matches[highlightIndex];
      if (target) {
        setQuery("");
        go(target.item.to);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  }

  // Grouped for display (sections keep their natural top-to-bottom order; items within a
  // matching section follow relevance, filtered to only the items that actually matched — that's
  // the point of a filter, not a highlight over an unchanged list), but the keyboard-navigable
  // flat list follows the global relevance order in `matches` regardless of grouping, so Enter
  // always jumps to the single best match on the page.
  const matchesBySection = useMemo(() => {
    const map = new Map<string, NavMatch[]>();
    for (const m of matches) {
      const list = map.get(m.section.label) ?? [];
      list.push(m);
      map.set(m.section.label, list);
    }
    return map;
  }, [matches]);

  return (
    <nav
      style={styles.nav}
      ref={navRef}
      onScroll={(e) => { sidebarScrollTop = e.currentTarget.scrollTop; }}
    >
      {dense && (
        <div style={styles.filterWrap}>
          <Search size={13} style={styles.filterIcon} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFilterKeyDown}
            placeholder="Jump to…"
            aria-label="Filter navigation"
            className="admin-nav-filter"
          />
          {query ? (
            <button type="button" aria-label="Clear filter" style={styles.filterClear} onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
              <X size={13} />
            </button>
          ) : (
            <span className="admin-nav-filter-hint" aria-hidden="true">Ctrl K</span>
          )}
          <span aria-live="polite" className="admin-visually-hidden">
            {searching ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : ""}
          </span>
        </div>
      )}

      {sections.map((section) => {
        const sectionMatches = searching ? matchesBySection.get(section.label) : undefined;
        if (searching && (!sectionMatches || sectionMatches.length === 0)) return null;

        const open = isSectionOpen(section);
        const itemsToRender = searching ? sectionMatches!.map((m) => m.item) : section.items;
        const collapsedBadgeTotal = !open ? sectionBadgeTotal(section, badgeFor) : 0;
        const sectionId = `admin-nav-section-${section.label.replace(/\s+/g, "-").toLowerCase()}`;

        return (
          <div key={section.label}>
            <button
              type="button"
              className="admin-nav-section-btn"
              style={styles.sectionHeader}
              onClick={() => toggleSection(section)}
              aria-expanded={open}
              aria-controls={sectionId}
            >
              <span style={styles.sectionHeaderLabel}>{section.label}</span>
              <span style={styles.sectionHeaderRight}>
                {searching && sectionMatches && <span style={styles.sectionCount}>{sectionMatches.length}</span>}
                {collapsedBadgeTotal > 0 && (
                  <span style={styles.sectionBadge} aria-label={badgeAriaLabel(collapsedBadgeTotal)}>{collapsedBadgeTotal}</span>
                )}
                <ChevronDown size={14} style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
              </span>
            </button>
            {open && (
              <div id={sectionId}>
                {itemsToRender.map((item) => {
                  const Icon = item.icon;
                  const active = item.to === activeTo;
                  const badge = badgeFor(item);
                  const tourKey = item.to.split("/").filter(Boolean).slice(-1)[0] ?? item.to;
                  const isHighlighted = searching && matches[highlightIndex]?.item.to === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      data-tour={`nav-${tourKey}`}
                      title={item.disabledNote}
                      onClick={() => onNavigate?.()}
                      aria-current={active ? "page" : undefined}
                      className={`admin-nav-item${isHighlighted ? " admin-nav-item-highlighted" : ""}`}
                      style={{
                        ...styles.navItem,
                        ...(active ? styles.navItemActive : {}),
                        ...(item.disabledNote ? { opacity: 0.55 } : {}),
                      }}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                      {badge !== undefined && badge.count > 0 && (
                        <span style={styles.badge} aria-label={badgeAriaLabel(badge.count)}>{badge.count}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Pin, Search, X } from "lucide-react";

import {
  countVisibleItems,
  DENSE_ITEM_THRESHOLD,
  findVisibleNavItem,
  matchNavItems,
  resolveActiveNav,
  type NavItem,
  type NavMatch,
  type NavSection,
} from "@/layouts/adminNav";
import { readSidebarPrefs, toggleSidebarPin, writeSidebarSectionOpen } from "@/lib/adminSidebarPrefs";

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
   *  collapse. Has no effect in rail mode (`collapsed`) — the tour needs the full list, so
   *  AdminLayout forces `collapsed` off itself while a tour runs (see its own comment). */
  forceExpandAll: boolean;
  /** Whole-sidebar rail mode: 64px, one icon per section, click for a flyout of its items —
   *  instead of the default expanded accordion. AdminLayout owns the persisted preference; this
   *  component just renders whichever mode it's told. */
  collapsed: boolean;
  /** Fired on any navigation via this nav (click or keyboard-select) — lets the mobile drawer
   *  close itself, which today only happens by accident when AdminLayout remounts. */
  onNavigate?: () => void;
  /** Rail mode only: opens AdminLayout's global command palette. Rail mode has no room for its
   *  own filter box (see AdminSidebarRail's own comment), so this is its one search entry point —
   *  the palette itself lives in AdminLayout since it also has to work for mobile, independent of
   *  whatever mode the sidebar is in. Omitted in expanded mode, which keeps its own inline filter. */
  onRequestSearch?: () => void;
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
  // A real, obviously-clickable header bar — not just uppercase text floating in the list. The
  // always-on surface + border is what reads as "this is a control" at a glance; hover then
  // brightens the border (same affordance .admin-board-scroll-btn already uses elsewhere in this
  // file's own CSS, reused here rather than inventing a second hover language).
  sectionHeader: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 12px",
    marginTop: 8,
    background: "var(--admin-sidebar-surface)",
    border: "1px solid var(--admin-sidebar-border)",
    borderRadius: 8,
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "oklch(0.88 0.02 84)",
  },
  sectionHeaderRight: { display: "flex", alignItems: "center", gap: 6 },
  sectionCount: { fontSize: 10, color: "var(--admin-sidebar-muted)", opacity: 0.75 },
  chevron: { color: "var(--admin-sidebar-muted)", transition: "transform 150ms", flexShrink: 0 },
  // A section's items previously started at nearly the same left edge as their own header (12px
  // header padding vs. 10px item padding) — no visual cue that the rows below actually belong to
  // the header above, especially with several collapsed sections stacked in a row. This modest
  // indent (kept small since the whole sidebar is only 248px wide) makes that parent/child
  // relationship read at a glance without needing to trace the accordion state.
  sectionItemsWrap: { paddingLeft: 8 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    borderRadius: 6,
    borderLeft: "3px solid transparent",
    // Brighter than --admin-sidebar-muted (the shared, dimmer tone used elsewhere in the admin
    // shell for genuinely secondary text — timestamps, placeholders) — nav item labels are a
    // primary reading task done dozens of times a session, not incidental metadata, so they get
    // their own, brighter-than-muted shade rather than reusing that one.
    color: "oklch(0.88 0.02 84)",
    fontSize: 13,
    textDecoration: "none",
    cursor: "pointer",
  },
  navItemActive: {
    background: "var(--admin-sidebar-surface)",
    borderLeft: "3px solid var(--admin-accent)",
    // Brighter still than the already-bright inactive state above — including past
    // --admin-sidebar-text's own 0.96 lightness, which reads as merely "not dim" next to a truly
    // bright active row.
    color: "oklch(0.98 0.015 84)",
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
  pinBtn: {
    marginLeft: "auto",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: 20,
    height: 20,
    borderRadius: 5,
    border: "none",
    background: "transparent",
    color: "var(--admin-sidebar-muted)",
    cursor: "pointer",
  },
  pinnedWrap: { marginBottom: 10 },
  pinnedLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--admin-sidebar-muted)",
    padding: "0 10px 4px",
  },
  // Rail mode (collapsed=true)
  rail: { flex: 1, overflowY: "auto", padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  railDivider: { width: 28, height: 1, background: "var(--admin-sidebar-border)", margin: "4px 0" },
  railBtn: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    position: "relative",
  },
  railBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    background: "var(--admin-clay)",
    color: "var(--cream)",
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 999,
    minWidth: 15,
    height: 15,
    display: "grid",
    placeItems: "center",
    padding: "0 3px",
  },
  // position/top/left are set inline per-open from the trigger button's real screen position (see
  // AdminSidebarRail) — this is rendered through a portal straight into document.body specifically
  // so it can never be clipped by the sidebar's own `overflow: hidden` (needed to keep the 64px/
  // 248px width transition clean) or caught in some other ancestor's stacking context.
  flyout: {
    position: "fixed",
    width: 224,
    // Belt-and-braces alongside the JS clamp in `toggle()`/the post-mount reposition effect below:
    // if a section ever gets long enough that even a clamped top still can't fit it above the
    // viewport edge, this keeps it scrollable in place instead of running off-screen anyway.
    maxHeight: "calc(100vh - 16px)",
    overflowY: "auto",
    background: "var(--admin-sidebar)",
    border: "1px solid var(--admin-sidebar-border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    padding: 6,
    zIndex: 200,
  },
  flyoutLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--admin-sidebar-muted)",
    padding: "6px 10px",
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

/** Rail mode: one icon per section (its first item's icon stands in for the section), click opens
 *  a flyout with that section's real items. No inline filter box here — there's no room for one
 *  at 64px — but `onRequestSearch` gives it the same global command palette expanded mode's
 *  Ctrl+K reaches, via a dedicated icon button, so collapsing the sidebar no longer means losing
 *  fast navigation entirely. */
function AdminSidebarRail({ sections, pathname, badgeFor, onNavigate, onRequestSearch, pinned, onTogglePin }: {
  sections: NavSection[];
  pathname: string;
  badgeFor: (item: NavItem) => SidebarBadge | undefined;
  onNavigate?: () => void;
  onRequestSearch?: () => void;
  pinned: string[];
  onTogglePin: (to: string) => void;
}) {
  const navigate = useNavigate();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { activeTo, activeSectionLabel } = useMemo(() => resolveActiveNav(pathname, sections), [pathname, sections]);
  const pinnedItems = useMemo(
    () => pinned.map((to) => findVisibleNavItem(sections, to)).filter((i): i is NavItem => !!i),
    [pinned, sections],
  );

  // Clamps the flyout's top so it can never render past the bottom of the viewport — a section
  // near the end of a long list (Reports, Sales, System) opened from a shorter screen would
  // otherwise position its flyout using only the trigger's own top, with no regard for how tall
  // the flyout's actual content is, running its last items off-screen with no way to reach them.
  // Runs after mount/content-change (useLayoutEffect, not effect) so the reposition happens
  // before the browser paints the first frame in the wrong place.
  useLayoutEffect(() => {
    if (!openLabel || !flyoutRef.current) return;
    const el = flyoutRef.current;
    function reclamp() {
      const height = el.getBoundingClientRect().height;
      setFlyoutPos((prev) => {
        if (!prev) return prev;
        const maxTop = Math.max(8, window.innerHeight - height - 8);
        const clampedTop = Math.min(prev.top, maxTop);
        return clampedTop === prev.top ? prev : { ...prev, top: clampedTop };
      });
    }
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLabel]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      // The flyout itself is portaled to document.body, outside rootRef entirely — a click inside
      // it (e.g. a Link) must not count as "outside" or it would close before the Link's own
      // onClick (go()) ever runs.
      if (rootRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      setOpenLabel(null);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpenLabel(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => setOpenLabel(null), [pathname]);

  function toggle(label: string) {
    if (openLabel === label) {
      setOpenLabel(null);
      return;
    }
    const btn = btnRefs.current[label];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 8 });
    }
    setOpenLabel(label);
  }

  function go(to: string) {
    setOpenLabel(null);
    navigate(to);
    onNavigate?.();
  }

  const openSection = sections.find((s) => s.label === openLabel);

  return (
    <div ref={rootRef} style={styles.rail}>
      {onRequestSearch && (
        <button
          type="button"
          title="Search navigation (Ctrl K)"
          aria-label="Search navigation"
          onClick={onRequestSearch}
          className="admin-nav-rail-btn"
          style={{ ...styles.railBtn, color: "oklch(0.88 0.02 84)" }}
        >
          <Search size={18} />
        </button>
      )}

      {pinnedItems.length > 0 && (
        <>
          {pinnedItems.map((item) => {
            const Icon = item.icon;
            const active = item.to === activeTo;
            const badge = badgeFor(item);
            return (
              <button
                key={item.to}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => go(item.to)}
                className="admin-nav-rail-btn"
                style={{
                  ...styles.railBtn,
                  background: active ? "var(--admin-sidebar-surface)" : "transparent",
                  color: active ? "oklch(0.98 0.015 84)" : "oklch(0.88 0.02 84)",
                }}
              >
                <Icon size={18} />
                {badge !== undefined && badge.count > 0 && (
                  <span style={styles.railBadge} aria-label={badgeAriaLabel(badge.count)}>{badge.count}</span>
                )}
              </button>
            );
          })}
          <div style={styles.railDivider} aria-hidden="true" />
        </>
      )}

      {sections.map((section) => {
        const RepIcon = section.items[0].icon;
        const isOpen = openLabel === section.label;
        const isActiveSection = section.label === activeSectionLabel;
        const badgeTotal = sectionBadgeTotal(section, badgeFor);
        return (
          <button
            key={section.label}
            ref={(el) => { btnRefs.current[section.label] = el; }}
            type="button"
            title={section.label}
            aria-expanded={isOpen}
            aria-label={section.label}
            onClick={() => toggle(section.label)}
            className="admin-nav-rail-btn"
            style={{
              ...styles.railBtn,
              background: isOpen || isActiveSection ? "var(--admin-sidebar-surface)" : "transparent",
              color: isActiveSection ? "oklch(0.98 0.015 84)" : "oklch(0.88 0.02 84)",
            }}
          >
            <RepIcon size={20} />
            {badgeTotal > 0 && (
              <span style={styles.railBadge} aria-label={badgeAriaLabel(badgeTotal)}>{badgeTotal}</span>
            )}
          </button>
        );
      })}

      {openSection && flyoutPos && createPortal(
        <div ref={flyoutRef} style={{ ...styles.flyout, top: flyoutPos.top, left: flyoutPos.left }}>
          <div style={styles.flyoutLabel}>{openSection.label}</div>
          {openSection.items.map((item) => {
            const Icon = item.icon;
            const active = item.to === activeTo;
            const badge = badgeFor(item);
            const isPinned = pinned.includes(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={(e) => { e.preventDefault(); go(item.to); }}
                style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}), borderLeft: "none" }}
              >
                <Icon size={16} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge !== undefined && badge.count > 0 && (
                  <span style={styles.badge} aria-label={badgeAriaLabel(badge.count)}>{badge.count}</span>
                )}
                <button
                  type="button"
                  title={isPinned ? "Unpin" : "Pin to top of sidebar"}
                  aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label} to top of sidebar`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(item.to); }}
                  style={{ ...styles.pinBtn, marginLeft: badge ? 4 : "auto", color: isPinned ? "var(--admin-accent)" : "var(--admin-sidebar-muted)" }}
                >
                  <Pin size={12} fill={isPinned ? "currentColor" : "none"} />
                </button>
              </Link>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function AdminSidebarNav({ sections, pathname, userId, badgeFor, forceExpandAll, collapsed, onNavigate, onRequestSearch }: AdminSidebarNavProps) {
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
  // Same in-memory-mirror-of-localStorage pattern as `toggled` above, for pinned nav items.
  const [pinned, setPinned] = useState<string[]>(() => readSidebarPrefs(userId).pinned ?? []);

  useEffect(() => {
    setToggled(readSidebarPrefs(userId).sections);
    setPinned(readSidebarPrefs(userId).pinned ?? []);
  }, [userId]);

  function togglePin(to: string) {
    setPinned(toggleSidebarPin(userId, to));
  }

  const pinnedItems = useMemo(
    () => pinned.map((to) => findVisibleNavItem(sections, to)).filter((i): i is NavItem => !!i),
    [pinned, sections],
  );

  const { activeTo, activeSectionLabel } = useMemo(() => resolveActiveNav(pathname, sections), [pathname, sections]);
  const dense = useMemo(() => countVisibleItems(sections) > DENSE_ITEM_THRESHOLD, [sections]);

  const trimmedQuery = query.trim();
  const searching = !collapsed && dense && trimmedQuery.length > 0;
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

  // Ctrl/Cmd+K focuses the filter — desktop, expanded mode only. On the mobile drawer this would
  // fight the soft keyboard popping up over the menu the instant it opens; in rail mode there's no
  // filter box to focus at all.
  useEffect(() => {
    if (!dense || collapsed) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && window.innerWidth > MOBILE_BREAKPOINT) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dense, collapsed]);

  // Grouped for display (sections keep their natural top-to-bottom order; items within a
  // matching section follow relevance, filtered to only the items that actually matched — that's
  // the point of a filter, not a highlight over an unchanged list), but the keyboard-navigable
  // flat list follows the global relevance order in `matches` regardless of grouping, so Enter
  // always jumps to the single best match on the page. Computed before the collapsed early return
  // below (even though rail mode never reads it) — every hook in this component must run on every
  // render regardless of `collapsed`, or React sees a different hook count between renders and
  // throws "Rendered fewer hooks than expected."
  const matchesBySection = useMemo(() => {
    const map = new Map<string, NavMatch[]>();
    for (const m of matches) {
      const list = map.get(m.section.label) ?? [];
      list.push(m);
      map.set(m.section.label, list);
    }
    return map;
  }, [matches]);

  if (collapsed) {
    return (
      <AdminSidebarRail
        sections={sections}
        pathname={pathname}
        badgeFor={badgeFor}
        onNavigate={onNavigate}
        onRequestSearch={onRequestSearch}
        pinned={pinned}
        onTogglePin={togglePin}
      />
    );
  }

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

  return (
    <nav
      style={styles.nav}
      ref={navRef}
      onScroll={(e) => { sidebarScrollTop = e.currentTarget.scrollTop; }}
    >
      {pinnedItems.length > 0 && !searching && (
        <div style={styles.pinnedWrap}>
          <div style={styles.pinnedLabel}>Pinned</div>
          <div style={styles.sectionItemsWrap}>
            {pinnedItems.map((item) => {
              const Icon = item.icon;
              const active = item.to === activeTo;
              const badge = badgeFor(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => onNavigate?.()}
                  aria-current={active ? "page" : undefined}
                  className="admin-nav-item"
                  style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {badge !== undefined && badge.count > 0 && (
                    <span style={styles.badge} aria-label={badgeAriaLabel(badge.count)}>{badge.count}</span>
                  )}
                  <button
                    type="button"
                    title="Unpin"
                    aria-label={`Unpin ${item.label}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.to); }}
                    style={{ ...styles.pinBtn, marginLeft: badge ? 4 : "auto", color: "var(--admin-accent)" }}
                  >
                    <Pin size={12} fill="currentColor" />
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
              <div id={sectionId} style={styles.sectionItemsWrap}>
                {itemsToRender.map((item) => {
                  const Icon = item.icon;
                  const active = item.to === activeTo;
                  const badge = badgeFor(item);
                  const tourKey = item.to.split("/").filter(Boolean).slice(-1)[0] ?? item.to;
                  const isHighlighted = searching && matches[highlightIndex]?.item.to === item.to;
                  const isPinned = pinned.includes(item.to);
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
                      <button
                        type="button"
                        title={isPinned ? "Unpin" : "Pin to top of sidebar"}
                        aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label} to top of sidebar`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.to); }}
                        className={`admin-nav-item-pin${isPinned ? " admin-nav-item-pin-active" : ""}`}
                        style={{ ...styles.pinBtn, marginLeft: badge ? 4 : "auto", color: isPinned ? "var(--admin-accent)" : "var(--admin-sidebar-muted)" }}
                      >
                        <Pin size={12} fill={isPinned ? "currentColor" : "none"} />
                      </button>
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

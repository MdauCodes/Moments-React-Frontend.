// Sidebar collapse/expand preferences — localStorage only, mirroring onboardingTours.ts's own
// storage pattern (guard for SSR/no-window, silent no-op on read/write failure — private
// browsing, quota, etc.). Keyed per user since admin machines get shared; a global key would
// mean one person's collapsed Analytics greets the next person to log in on the same machine.
// Frontend-only, by design — nothing here ever reaches the backend.

export interface SidebarPrefs {
  v: 1;
  /** Only sections the user has explicitly toggled — never a full snapshot. An absent label
   *  falls through to the derived default (see resolveSectionOpen in AdminSidebarNav), so adding,
   *  renaming, or removing a section later degrades gracefully instead of inheriting a stale
   *  value for a section that no longer means the same thing. */
  sections: Record<string, boolean>;
  /** Whole-sidebar rail mode (icon-only + flyouts) vs. the default expanded accordion. Desktop
   *  only — AdminLayout ignores this on the mobile drawer, where collapsing to a 64px rail inside
   *  an already-temporary overlay defeats the point of opening it. Absent/false = expanded. */
  collapsed?: boolean;
  /** Nav item `to` paths the user has pinned to the top of the sidebar, in the order pinned
   *  (newest last) — rendered oldest-first so a freshly pinned item doesn't jump above ones
   *  already there. A pinned item whose route no longer exists (renamed/removed since) is simply
   *  never matched against the current nav tree and quietly drops out of the rendered list,
   *  without needing to prune this array. */
  pinned?: string[];
}

const EMPTY_PREFS: SidebarPrefs = { v: 1, sections: {} };

function storageKey(userId: string): string {
  return `admin_sidebar_prefs_v1_${userId}`;
}

export function readSidebarPrefs(userId: string | undefined | null): SidebarPrefs {
  if (!userId || typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    if (parsed.v !== 1 || typeof parsed.sections !== "object" || parsed.sections === null) return EMPTY_PREFS;
    const pinned = Array.isArray(parsed.pinned) ? parsed.pinned.filter((p): p is string => typeof p === "string") : undefined;
    return { v: 1, sections: parsed.sections, collapsed: parsed.collapsed === true, pinned };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeSidebarSectionOpen(userId: string | undefined | null, sectionLabel: string, open: boolean): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const current = readSidebarPrefs(userId);
    const next: SidebarPrefs = { v: 1, sections: { ...current.sections, [sectionLabel]: open }, collapsed: current.collapsed };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* private mode, quota, etc. — the toggle still works for the rest of this session via
     * AdminSidebarNav's own in-memory state; it just won't survive a reload. */
  }
}

export function writeSidebarCollapsed(userId: string | undefined | null, collapsed: boolean): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const current = readSidebarPrefs(userId);
    const next: SidebarPrefs = { v: 1, sections: current.sections, collapsed, pinned: current.pinned };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* same as above — collapse still works for this session, just doesn't survive a reload. */
  }
}

/** Toggles one nav item's pinned state and returns the resulting list (so the caller can update
 *  its own in-memory state without a second read). Newly-pinned items append to the end — see the
 *  `pinned` field's own comment on why render order stays oldest-first rather than newest-first. */
export function toggleSidebarPin(userId: string | undefined | null, to: string): string[] {
  if (!userId || typeof window === "undefined") return [];
  const current = readSidebarPrefs(userId);
  const existing = current.pinned ?? [];
  const next = existing.includes(to) ? existing.filter((p) => p !== to) : [...existing, to];
  try {
    const nextPrefs: SidebarPrefs = { v: 1, sections: current.sections, collapsed: current.collapsed, pinned: next };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(nextPrefs));
  } catch {
    /* pin still applies for the rest of this session via the caller's own state; won't persist. */
  }
  return next;
}

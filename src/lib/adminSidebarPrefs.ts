// Sidebar collapse/expand preferences — localStorage only, mirroring onboardingTours.ts's own
// storage pattern (guard for SSR/no-window, silent no-op on read/write failure — private
// browsing, quota, etc.). Keyed per user since admin machines get shared; a global key would
// mean one person's collapsed Analytics greets the next person to log in on the same machine.

export interface SidebarPrefs {
  v: 1;
  /** Only sections the user has explicitly toggled — never a full snapshot. An absent label
   *  falls through to the derived default (see resolveSectionOpen in AdminSidebarNav), so adding,
   *  renaming, or removing a section later degrades gracefully instead of inheriting a stale
   *  value for a section that no longer means the same thing. */
  sections: Record<string, boolean>;
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
    return { v: 1, sections: parsed.sections };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeSidebarSectionOpen(userId: string | undefined | null, sectionLabel: string, open: boolean): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const current = readSidebarPrefs(userId);
    const next: SidebarPrefs = { v: 1, sections: { ...current.sections, [sectionLabel]: open } };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* private mode, quota, etc. — the toggle still works for the rest of this session via
     * AdminSidebarNav's own in-memory state; it just won't survive a reload. */
  }
}

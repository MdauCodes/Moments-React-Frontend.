import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, BellRing, HelpCircle, LogOut, Menu, RefreshCw, Search, X } from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { resolveStaffRole, STAFF_ROLE_DISPLAY } from "@/lib/roles";
import { OnboardingTour } from "@/components/admin/OnboardingTour";
import { isOnboardingDone, ROLE_TOURS } from "@/lib/onboardingTours";
import { useMockModeState } from "@/lib/mockMode";
import { adminResources, type AdminNotificationDto } from "@/services/adminResources";
import { subscribeToAdminOrderEvents } from "@/services/commerceApi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPushPermissionState, subscribeToPush } from "@/lib/pushNotifications";
import { navSections, NAV_PATH_TO_FULFILLMENT_TYPE, visibleSectionsFor, type NavItem } from "@/layouts/adminNav";
import { AdminSidebarNav, type SidebarBadge } from "@/components/admin/AdminSidebarNav";

function MockModeBanner() {
  const { enabled, message } = useMockModeState();
  if (!enabled) return null;
  return (
    <div
      role="alert"
      style={{
        background: "repeating-linear-gradient(45deg, #fde68a, #fde68a 12px, #fcd34d 12px, #fcd34d 24px)",
        color: "#7c2d12",
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        borderBottom: "2px solid #b45309",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      ⚠ Mock / Test Mode is ACTIVE — all data created here is test data. {message ?? ""}
    </div>
  );
}

interface AdminLayoutProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  onReload?: () => void | Promise<void>;
  children: ReactNode;
}

// Sidebar nav structure (navSections, NAV_PATH_TO_FULFILLMENT_TYPE, permission filtering, active-
// route resolution, search matching) now lives in @/layouts/adminNav — extracted so it's reusable
// and independently testable, and so this file's own diff for the sidebar redesign stays reviewable.

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "row",
    minHeight: "100vh",
    height: "100dvh",
    width: "100vw",
    overflow: "hidden",
    background: "var(--admin-bg-texture)",
    color: "var(--admin-text)",
    fontFamily: "var(--font-sans)",
  },
  sidebar: {
    width: 248,
    height: "100dvh",
    background: "var(--admin-sidebar)",
    borderRight: "1px solid var(--admin-sidebar-border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarTop: {
    padding: "18px 16px",
    borderBottom: "1px solid var(--admin-sidebar-border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "var(--admin-accent)",
    color: "var(--cream)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1,
  },
  brandLink: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 },
  brandName: { fontSize: 15, fontWeight: 700, color: "var(--admin-sidebar-text)", lineHeight: 1.1, fontFamily: "var(--font-display)" },
  brandSub: { fontSize: 10, color: "var(--admin-sidebar-muted)", lineHeight: 1.2 },
  sidebarBottom: {
    marginTop: "auto",
    borderTop: "1px solid var(--admin-sidebar-border)",
    padding: "12px 8px",
  },
  userPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--admin-sidebar-border)",
    background: "var(--admin-sidebar-surface)",
    cursor: "pointer",
    transition: "background 120ms",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--admin-accent)",
    color: "var(--cream)",
    fontSize: 11,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userName: { fontSize: 12, color: "var(--admin-sidebar-text)", lineHeight: 1.2 },
  userRole: { fontSize: 10, color: "var(--admin-sidebar-muted)", lineHeight: 1.2 },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  topbar: {
    minHeight: 64,
    background: "var(--admin-topbar)",
    borderBottom: "1px solid var(--admin-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
  },
  topbarTitle: { fontSize: 24, fontWeight: 650, color: "var(--admin-text)", fontFamily: "var(--font-display)", letterSpacing: 0 },
  topbarRight: { display: "flex", alignItems: "center", gap: 12 },
  searchWrap: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: {
    position: "absolute",
    left: 10,
    color: "var(--admin-muted)",
    pointerEvents: "none",
  },
  searchInput: {
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "6px 12px 6px 32px",
    fontSize: 12,
    color: "var(--admin-text)",
    width: 200,
    outline: "none",
    fontFamily: "inherit",
  },
  bellBtn: {
    position: "relative",
    width: 32,
    height: 32,
    background: "var(--admin-surface-2)",
    borderRadius: 8,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--admin-muted)",
  },
  bellDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    background: "var(--admin-clay)",
    borderRadius: "50%",
    border: "1.5px solid var(--admin-surface)",
  },
  actionBtn: {
    background: "var(--admin-accent)",
    color: "var(--cream)",
    border: "none",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-display)",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: 24,
    background: "transparent",
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminLayout({ title, actionLabel, onAction, onReload, children }: AdminLayoutProps) {
  const { user, logout, permissions } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [headerSearch, setHeaderSearch] = useState("");

  const runHeaderSearch = () => {
    const q = headerSearch.trim();
    if (!q) return;
    navigate(`/admin/enquiries?q=${encodeURIComponent(q)}`);
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const staffRole = resolveStaffRole(user);

  // Permission filtering happens once here — AdminSidebarNav (rendering) and the tax-doc poll
  // gate below both read this same filtered set, so a role that can't see an item also can't
  // trigger a background request for its data.
  const visibleSections = useMemo(() => visibleSectionsFor(navSections, permissions, staffRole), [permissions, staffRole]);
  const canViewTaxDocuments = useMemo(
    () => visibleSections.some((s) => s.items.some((i) => i.to === "/admin/tax-documents")),
    [visibleSections],
  );

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  // Bell was previously purely decorative — a static dot, no real data behind it at all (no
  // notification system existed anywhere in the backend before this). Polls the unread count
  // rather than the full list, so the topbar doesn't pay for a list fetch on every page just to
  // show a badge.
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<AdminNotificationDto[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      adminResources.notifications.unreadCount()
        .then((res) => { if (!cancelled) setUnreadCount(res.count); })
        .catch(() => {});
    }
    // Also re-polls on every route change (location.pathname dep below) — visiting a board page
    // clears that tab's own notifications server-side almost immediately (see board.$mode.tsx),
    // so re-checking right on navigation picks that up within a moment instead of leaving the
    // count visibly stale until the next 30s tick.
    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Per-tab sidebar badges (new orders only — the only AdminNotificationType that carries a
  // fulfillmentType). CBD/Hand Delivery orders share FulfillmentType.MANUAL_DELIVERY with regular
  // Manual Delivery (see board.$mode.tsx's own note on this) — the notification itself can't tell
  // them apart, so both nav entries show the same combined count rather than one silently
  // under-counting.
  const [tabUnreadCounts, setTabUnreadCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    function poll() {
      adminResources.notifications.unreadCountByTab()
        .then((res) => { if (!cancelled) setTabUnreadCounts(res); })
        .catch(() => {});
    }
    // Small delay (not an immediate poll()) specifically so a route change into a board page
    // gives that page's own mark-read-for-this-tab call (fired from the same navigation) a
    // moment to land server-side first — otherwise this can race it and still show the
    // about-to-be-cleared count for one extra tick.
    const t = setTimeout(poll, 400);
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // "Not yet handled" tax invoices (PENDING = requested, not yet generated/uploaded/emailed —
  // see TaxDocumentStatus) — reuses the existing list endpoint rather than a new count-only one:
  // size=1 still returns the real totalElements for the full PENDING count. Less time-sensitive
  // than order/refund activity, so a slower 60s poll (vs. 30s above) is enough. Gated on the same
  // permission the sidebar item itself requires — previously this polled unconditionally for
  // every signed-in staff member, including roles that can't see the item (or call the endpoint),
  // failing silently forever via the empty catch below.
  const [pendingTaxDocCount, setPendingTaxDocCount] = useState(0);
  useEffect(() => {
    if (!canViewTaxDocuments) return;
    let cancelled = false;
    function poll() {
      adminResources.taxDocuments.list({ status: "PENDING", size: 1 })
        .then((res) => { if (!cancelled) setPendingTaxDocCount(res.totalElements ?? 0); })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [canViewTaxDocuments]);

  // Live push (AdminOrderEventStreamService) the instant a new order is placed — both badge
  // counts above otherwise only catch up on their own 30s tick or the next route change. This is
  // what makes "the numbers are real and really updating" actually true rather than "eventually
  // true, within half a minute" — a new order shows up in the bell/sidebar the moment it lands,
  // same event AdminOrdersContext already uses to refresh the order list itself.
  useEffect(() => {
    const unsubscribe = subscribeToAdminOrderEvents(() => {
      adminResources.notifications.unreadCount()
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
      adminResources.notifications.unreadCountByTab()
        .then((res) => setTabUnreadCounts(res))
        .catch(() => {});
    });
    return unsubscribe;
  }, []);

  async function toggleNotifPanel() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening) {
      setNotifLoading(true);
      try {
        const res = await adminResources.notifications.list();
        setNotifItems(res.content);
      } catch {
        // Silently leave the panel empty on failure — this is a convenience surface, not
        // critical-path; a broken fetch here shouldn't produce an error toast on every page.
      } finally {
        setNotifLoading(false);
      }
    }
  }

  async function handleMarkRead(id: string) {
    setNotifItems((items) => items.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await adminResources.notifications.markRead(id);
    } catch {
      // Best-effort — the next poll/list fetch will reconcile if this silently failed.
    }
  }

  async function handleMarkAllRead() {
    setNotifItems((items) => items.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await adminResources.notifications.markAllRead();
    } catch {
      // Best-effort, same reasoning as handleMarkRead.
    }
  }

  // Deliberately opt-in, not auto-prompted on load — an unsolicited browser permission prompt on
  // every login is an instant-dismiss pattern. Only shown when permission is still "default"
  // (never asked) — once granted there's nothing more to do, and once denied the browser itself
  // blocks re-prompting from JS, so there'd be nothing for the button to do at that point either.
  const [pushState, setPushState] = useState(() => getPushPermissionState());
  const [enablingPush, setEnablingPush] = useState(false);
  async function enablePush() {
    setEnablingPush(true);
    try {
      const { publicKey } = await adminResources.push.vapidPublicKey();
      if (!publicKey) throw new Error("Push isn't configured on this environment yet.");
      const subscription = await subscribeToPush(publicKey);
      await adminResources.push.subscribe(subscription);
      setPushState(getPushPermissionState());
      toast.success("Push notifications enabled on this device.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't enable push notifications.");
    } finally {
      setEnablingPush(false);
    }
  }

  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      if (onReload) await onReload();
      window.dispatchEvent(new CustomEvent("admin:reload", { detail: { pathname } }));
    } finally {
      setTimeout(() => setReloading(false), 400);
    }
  };

  const displayName = user?.name ?? "Admin User";
  const displayEmail = user?.email ?? "Signed in";

  // Sidebar visibility is permission-driven only (see navSections[].requiresAny).
  // Role names are never consulted for nav gating. Active-route highlighting and which section
  // that implies should be open both live in AdminSidebarNav (resolveActiveNav), so they can
  // never disagree with each other the way two separate ad hoc checks could.

  const badgeFor = (item: NavItem): SidebarBadge | undefined => {
    const fulfillmentType = NAV_PATH_TO_FULFILLMENT_TYPE[item.to];
    if (fulfillmentType) {
      const count = tabUnreadCounts[fulfillmentType];
      return count > 0 ? { key: fulfillmentType, count } : undefined;
    }
    if (item.to === "/admin/tax-documents") {
      return pendingTaxDocCount > 0 ? { key: item.to, count: pendingTaxDocCount } : undefined;
    }
    return undefined;
  };

  // --- Onboarding tour state ---
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepFilter, setTourStepFilter] = useState<((s: { targetSelector: string | null }) => boolean) | undefined>(undefined);

  // Auto-launch on first login (once per user, per browser)
  useEffect(() => {
    if (!user?.id || !staffRole) return;
    if (!ROLE_TOURS[staffRole]) return;
    if (isOnboardingDone(user.id)) return;
    // small delay so DOM targets (sidebar, role badge) are painted
    const t = window.setTimeout(() => {
      setTourStepFilter(undefined);
      setTourOpen(true);
    }, 350);
    return () => window.clearTimeout(t);
  }, [user?.id, staffRole]);

  const openHelp = (e: React.MouseEvent) => {
    if (!staffRole || !ROLE_TOURS[staffRole]) return;
    if (e.shiftKey) {
      // Shift+click → re-trigger tour for steps whose target exists on current page
      setTourStepFilter(() => (s: { targetSelector: string | null }) => {
        if (!s.targetSelector) return true;
        return !!document.querySelector(s.targetSelector);
      });
    } else {
      setTourStepFilter(undefined);
    }
    setTourOpen(true);
  };

  return (
    <div className="admin-shell" style={styles.root}>
      {sidebarOpen && <button className="admin-sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside data-tour="sidebar" className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`} style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <Link to="/" style={styles.brandLink} aria-label="Back to Moments website">
            <div style={styles.logoMark}>m</div>
            <div>
              <div style={styles.brandName}>Moments</div>
              <div style={styles.brandSub}>Back to website</div>
            </div>
          </Link>
          <button type="button" className="admin-sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <AdminSidebarNav
          sections={visibleSections}
          pathname={pathname}
          userId={user?.id}
          badgeFor={badgeFor}
          forceExpandAll={tourOpen}
          onNavigate={() => setSidebarOpen(false)}
        />

        <div style={styles.sidebarBottom}>
          <div style={styles.userPill}>
            <div style={styles.avatar}>{getInitials(displayName)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={styles.userName}>{displayName}</div>
              <div style={styles.userRole}>{displayEmail}</div>
              {staffRole && (
                <div data-tour="role-badge" style={{ marginTop: 4 }}>
                  <RoleBadge role={staffRole} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Logout"
              title={`Sign out${staffRole ? ` (${STAFF_ROLE_DISPLAY[staffRole]})` : ""}`}
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--admin-sidebar-muted)", cursor: "pointer", padding: 4, alignSelf: "flex-start" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>


      <div style={styles.main}>
        <MockModeBanner />
        <div style={styles.topbar}>
          <div className="admin-topbar-left">
            <button type="button" className="admin-menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <div style={styles.topbarTitle} data-admin-topbar-title>{title}</div>
          </div>
          <div style={styles.topbarRight} data-admin-topbar-right>
            <div style={styles.searchWrap} data-admin-search>
              <Search size={14} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search enquiries..."
                style={styles.searchInput}
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runHeaderSearch();
                  }
                }}
              />
            </div>
            <button
              type="button"
              style={{ ...styles.bellBtn, opacity: reloading ? 0.6 : 1 }}
              aria-label="Reload this page's data"
              title="Reload"
              onClick={handleReload}
              disabled={reloading}
            >
              <RefreshCw size={15} style={{ animation: reloading ? "admin-spin 0.8s linear infinite" : "none" }} />
            </button>
            <button
              type="button"
              style={styles.bellBtn}
              aria-label="Help (Shift+click to replay tour for this page)"
              title="Help — Shift+click to replay tour for this page"
              onClick={openHelp}
            >
              <HelpCircle size={15} />
            </button>
            {pushState === "default" && (
              <button
                type="button"
                style={{ ...styles.bellBtn, opacity: enablingPush ? 0.6 : 1 }}
                aria-label="Enable push notifications"
                title="Enable push notifications on this device"
                onClick={() => void enablePush()}
                disabled={enablingPush}
              >
                <BellRing size={15} />
              </button>
            )}
            <div style={{ position: "relative" }}>
              <button type="button" style={styles.bellBtn} aria-label="Notifications" onClick={toggleNotifPanel}>
                <Bell size={15} />
                {unreadCount > 0 && <span style={styles.bellDot} />}
              </button>
              {notifOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 40,
                    width: 340,
                    maxHeight: 420,
                    overflowY: "auto",
                    background: "var(--admin-surface)",
                    border: "1px solid var(--admin-border, rgba(0,0,0,0.1))",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 50,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--admin-border, rgba(0,0,0,0.08))" }}>
                    <span style={{ fontSize: 13, fontWeight: 650 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button type="button" onClick={handleMarkAllRead} style={{ fontSize: 11, color: "var(--admin-accent)", background: "none", border: "none", cursor: "pointer" }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifLoading ? (
                    <div style={{ padding: 16, fontSize: 12, color: "var(--admin-muted)" }}>Loading…</div>
                  ) : notifItems.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12, color: "var(--admin-muted)" }}>Nothing yet.</div>
                  ) : (
                    notifItems.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.read) void handleMarkRead(n.id);
                          if (n.type === "REFUND_REQUESTED") {
                            navigate("/admin/refund-requests");
                            setNotifOpen(false);
                          } else if (n.orderReference) {
                            // The orders list has no query-param-driven initial search yet, so
                            // this can't deep-link straight to the order — the reference is
                            // already in the notification text above for the admin to search
                            // manually.
                            navigate("/admin/orders");
                            setNotifOpen(false);
                          }
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          background: n.read ? "transparent" : "var(--admin-surface-2)",
                          border: "none",
                          borderBottom: "1px solid var(--admin-border, rgba(0,0,0,0.06))",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 650 }}>{n.title}</div>
                        <div style={{ fontSize: 11.5, color: "var(--admin-muted)", marginTop: 2 }}>{n.message}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {actionLabel && (
              <button type="button" style={styles.actionBtn} onClick={onAction}>
                {actionLabel}
              </button>
            )}
          </div>
        </div>
        <main style={styles.content}>{children}</main>
      </div>
      {user?.id && staffRole && (
        <OnboardingTour
          role={staffRole}
          userId={user.id}
          open={tourOpen}
          stepFilter={tourStepFilter}
          onClose={() => { setTourOpen(false); setTourStepFilter(undefined); }}
        />
      )}
    </div>
  );
}

export default AdminLayout;

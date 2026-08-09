import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  LayoutList,
  Package,
  Star,
  Users,
  Settings,
  Bell,
  Search,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  
  BarChart3,
  Truck,
  RefreshCw,
  CheckCircle2,
  PackageCheck,
  Send,
  ShieldCheck,
  Boxes,
  HelpCircle,
  Briefcase,
  TicketPercent,
  Landmark,
  HandCoins,
  Gift,
  TrendingUp,
  BookOpen,
  Share2,
  Receipt,
  FileCheck2,
  ClipboardCheck,
  Wrench,
  ScrollText,
  Coins,
  ListTree,
  LayoutGrid,
  MapPin,
  UserPlus,
  AlertTriangle,
  Layers,
} from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { hasAnyPerm, PERM, type PermissionCode } from "@/lib/permissions";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { resolveStaffRole, STAFF_ROLE_DISPLAY } from "@/lib/roles";
import { OnboardingTour } from "@/components/admin/OnboardingTour";
import { isOnboardingDone, ROLE_TOURS } from "@/lib/onboardingTours";
import { useMockModeState } from "@/lib/mockMode";
import { Link, useLocation, useNavigate } from "react-router-dom";

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

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutList;
  badge?: number;
  /** Item is visible when user has ANY of these permissions. Omit = always visible. */
  requiresAny?: PermissionCode[];
  /** Item is only ever visible to the Super Admin staff role, regardless of permissions. */
  superAdminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      // Dashboard adapts internally — show whenever there's anything to show.
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, requiresAny: [PERM.ANALYTICS_VIEW, PERM.ORDER_VIEW, PERM.USER_MANAGE_ROLES, PERM.PRODUCT_MANAGE, PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.USER_VIEW] },
    ],
  },
  {
    label: "Queues",
    items: [
      { label: "Payment Queue", to: "/admin/queues/payment", icon: CheckCircle2, requiresAny: [PERM.ORDER_VERIFY_PAYMENT] },
      { label: "Preparation Queue", to: "/admin/queues/preparation", icon: PackageCheck, requiresAny: [PERM.ORDER_PREPARE] },
      { label: "Dispatch Queue", to: "/admin/queues/dispatch", icon: Send, requiresAny: [PERM.ORDER_DISPATCH] },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", to: "/admin/orders", icon: ShoppingCart, requiresAny: [PERM.ORDER_VIEW] },
      { label: "TumaBoda Settlements", to: "/admin/tumaboda-settlements", icon: HandCoins, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Tax Documents", to: "/admin/tax-documents", icon: Receipt, requiresAny: [PERM.ORDER_VIEW] },
      { label: "Documents/PDFs", to: "/admin/document-bundles", icon: FileCheck2, requiresAny: [PERM.ORDER_VIEW] },
      { label: "Promo Codes", to: "/admin/promo-codes", icon: TicketPercent, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Rewards Tiers", to: "/admin/rewards-tiers", icon: Gift, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Referral Payout Tiers", to: "/admin/referral-tiers", icon: Share2, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Rewards Report", to: "/admin/rewards-report", icon: TrendingUp, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Rewards Settings", to: "/admin/rewards-settings", icon: Coins, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", to: "/admin/products", icon: Package, requiresAny: [PERM.PRODUCT_VIEW, PERM.PRODUCT_MANAGE] },
      { label: "Stock Levels", to: "/admin/inventory", icon: Boxes, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Classifications", to: "/admin/catalog", icon: ListTree, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Classify Products", to: "/admin/classify-products", icon: LayoutList, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Delivery Zones", to: "/admin/delivery-zones", icon: Truck, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    label: "Audience",
    items: [
      { label: "Customers", to: "/admin/customers", icon: Users, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Business Accounts", to: "/admin/business-accounts", icon: Briefcase, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Credit Accounts", to: "/admin/credit-accounts", icon: Landmark, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Change Requests", to: "/admin/change-requests", icon: ClipboardCheck, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Enquiries", to: "/admin/enquiries", icon: LayoutList, requiresAny: [PERM.ENQUIRY_VIEW] },
      { label: "Reviews", to: "/admin/reviews", icon: Star, requiresAny: [PERM.REVIEW_MODERATE] },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Blogs", to: "/admin/blogs", icon: FileText, requiresAny: [PERM.BLOG_MANAGE] },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users", to: "/admin/users", icon: Users, requiresAny: [PERM.USER_VIEW, PERM.USER_CREATE, PERM.USER_MANAGE_ROLES] },
      { label: "Roles", to: "/admin/roles", icon: ShieldCheck, requiresAny: [PERM.USER_MANAGE_ROLES] },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: FileText, requiresAny: [PERM.AUDIT_VIEW] },
      { label: "Changelog", to: "/admin/changelog", icon: BookOpen, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Settings", to: "/admin/settings", icon: Settings, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Feature Guide", to: "/admin/feature-guide", icon: BookOpen },
      { label: "System Architecture", to: "/admin/architecture", icon: Layers, superAdminOnly: true },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Overview", to: "/admin/analytics", icon: BarChart3, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Needs Attention", to: "/admin/analytics/needs-attention", icon: AlertTriangle, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Customers", to: "/admin/analytics/customers", icon: Users, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Signups & Demographics", to: "/admin/analytics/signups-demographics", icon: UserPlus, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Geographic", to: "/admin/analytics/geographic", icon: MapPin, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Delivery", to: "/admin/analytics/delivery", icon: Truck, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Products & Inventory", to: "/admin/analytics/products", icon: Boxes, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Profitability", to: "/admin/analytics/profitability", icon: TrendingUp, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Tax & Compliance", to: "/admin/analytics/tax", icon: Receipt, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Rewards & Referrals", to: "/admin/analytics/rewards", icon: Gift, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Data Visualization", to: "/admin/analytics/data-visualization", icon: LayoutGrid, requiresAny: [PERM.ANALYTICS_VIEW] },
    ],
  },
  {
    label: "Developer",
    items: [
      { label: "Developer Tools", to: "/admin/dev-tools", icon: Wrench, superAdminOnly: true },
      { label: "Dev Logs", to: "/admin/dev-logs", icon: ScrollText, superAdminOnly: true },
    ],
  },
];

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
  nav: { flex: 1, overflowY: "auto", padding: "10px 8px" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--admin-sidebar-muted)",
    padding: "14px 16px 6px",
    opacity: 0.75,
  },
  sectionDivider: {
    height: 1,
    margin: "4px 12px 0",
    background: "var(--admin-sidebar-border)",
    opacity: 0.6,
    border: "none",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "10px 12px",
    borderRadius: 6,
    borderLeft: "3px solid transparent",
    color: "var(--admin-sidebar-muted)",
    fontSize: 13,
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 120ms, color 120ms",
  },
  navItemActive: {
    background: "var(--admin-sidebar-surface)",
    borderLeft: "3px solid var(--admin-accent)",
    color: "var(--admin-sidebar-text)",
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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const tourKey = item.to.split("/").filter(Boolean).slice(-1)[0] ?? item.to;
  return (
    <Link
      to={item.to}
      data-tour={`nav-${tourKey}`}
      style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!active) {
          e.currentTarget.style.background = "var(--admin-sidebar-surface)";
          e.currentTarget.style.color = "var(--admin-sidebar-text)";
        }
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--admin-sidebar-muted)";
        }
      }}
    >
      <Icon size={16} />
      <span>{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span style={styles.badge}>{item.badge}</span>
      )}
    </Link>
  );
}

// AdminLayout is instantiated fresh inside every admin page (not a shared
// route layout), so its <nav> DOM node is destroyed and recreated on every
// navigation — resetting scroll to the top and forcing staff to re-scroll
// down to reach lower nav items. This module-level value survives that
// remount (persists for the SPA session) so scroll position carries across
// page changes.
let sidebarScrollTop = 0;

export function AdminLayout({ title, actionLabel, onAction, onReload, children }: AdminLayoutProps) {
  const { user, logout, permissions } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");

  const runHeaderSearch = () => {
    const q = headerSearch.trim();
    if (!q) return;
    navigate(`/admin/enquiries?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    if (sidebarNavRef.current) sidebarNavRef.current.scrollTop = sidebarScrollTop;
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const staffRole = resolveStaffRole(user);

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

  const isActive = (to: string): boolean => {
    if (to === "/admin/dashboard") {
      return pathname === "/admin" || pathname === "/admin/" || pathname === to;
    }
    if (to === "/admin/enquiries") {
      return pathname === to || pathname.startsWith("/admin/enquiries/");
    }
    return pathname === to;
  };

  const displayName = user?.name ?? "Admin User";
  const displayEmail = user?.email ?? "Signed in";

  // Sidebar visibility is permission-driven only (see navSections[].requiresAny).
  // Role names are never consulted for nav gating.

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

        <nav
          style={styles.nav}
          ref={sidebarNavRef}
          onScroll={(e) => { sidebarScrollTop = e.currentTarget.scrollTop; }}
        >
          {navSections.map((section, sectionIdx) => {
            const visible = section.items.filter((item) => {
              if (item.superAdminOnly) return staffRole === "SUPER_ADMIN";
              if (!item.requiresAny) return true;
              if (hasAnyPerm(permissions, item.requiresAny)) return true;
              // SUPER_ADMIN sees audit logs even without explicit AUDIT_VIEW perm.
              if (staffRole === "SUPER_ADMIN" && item.requiresAny.includes(PERM.AUDIT_VIEW)) return true;
              return false;
            });
            if (visible.length === 0) return null;
            return (
              <div key={section.label} style={{ marginBottom: 4 }}>
                {sectionIdx > 0 && <hr style={styles.sectionDivider} />}
                <div style={styles.sectionLabel}>{section.label}</div>
                {visible.map((item) => (
                  <NavLink key={item.to} item={item} active={isActive(item.to)} />
                ))}
              </div>
            );
          })}
        </nav>

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
            <button type="button" style={styles.bellBtn} aria-label="Notifications">
              <Bell size={15} />
              <span style={styles.bellDot} />
            </button>
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

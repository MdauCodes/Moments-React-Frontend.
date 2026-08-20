import { Link } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { ArrowRight, Boxes, Briefcase, CheckCircle2, PackageCheck, Plus, Send, ShoppingCart, Users as UsersIcon } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { MockBanner, formatKes } from "@/components/admin/commerceUi";
import { getDashboardStats, type DashboardResult } from "@/services/commerceApi";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { adminResources } from "@/services/adminResources";
import { PERM } from "@/lib/permissions";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";



type ApiStats = DashboardResult & {
  revenueMTD?: number;
  topSellingProducts?: string[];
};

export function AdminDashboardPage() {
  const { hasPermission, user } = useAuth();
  const { orders, refresh } = useAdminOrders();
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bizAccountCount, setBizAccountCount] = useState<number | null>(null);

  // Permission shortcuts
  const showRevenue = hasPermission(PERM.ANALYTICS_VIEW);
  const showOrderCounts = hasPermission(PERM.ORDER_VIEW) || hasPermission(PERM.ANALYTICS_VIEW);
  const showTopProducts = hasPermission(PERM.ANALYTICS_VIEW) || hasPermission(PERM.PRODUCT_VIEW);
  const showPaymentBlock = hasPermission(PERM.ORDER_VERIFY_PAYMENT);
  const showPrepBlock = hasPermission(PERM.ORDER_PREPARE);
  const showDispatchBlock = hasPermission(PERM.ORDER_DISPATCH);
  const showStaffOverview = hasPermission(PERM.USER_VIEW);
  const showBusinessAccounts = hasPermission(PERM.CUSTOMER_VIEW);
  const showQuickActions =
    hasPermission(PERM.USER_CREATE) || hasPermission(PERM.PRODUCT_MANAGE) || hasPermission(PERM.ORDER_MANAGE_ALL);

  const needStats = showRevenue || showOrderCounts || showTopProducts;

  useEffect(() => { document.title = "Dashboard · Moments admin"; }, []);

  useEffect(() => {
    if (!needStats) return;
    let cancelled = false;
    setLoadingStats(true);
    getDashboardStats()
      .then((res) => { if (!cancelled) setStats(res as ApiStats); })
      .catch((err) => reportAdminError(err, "Failed to load dashboard"))
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [needStats]);

  useEffect(() => {
    if (!showBusinessAccounts) return;
    let cancelled = false;
    adminResources.businessAccounts
      .list({ page: 0, size: 1 })
      .then((res) => { if (!cancelled) setBizAccountCount(res.totalElements ?? 0); })
      .catch(() => { if (!cancelled) setBizAccountCount(null); });
    return () => { cancelled = true; };
  }, [showBusinessAccounts]);

  const queueCounts = useMemo(() => ({
    paid: orders.filter((o) => o.status === "PAID").length,
    prep: orders.filter((o) => o.status === "PAYMENT_VERIFIED" || o.status === "IN_PRODUCTION").length,
    dispatch: orders.filter((o) => o.status === "READY_FOR_DISPATCH").length,
    mine: user?.id ? orders.filter((o) => o.assignedToId === user.id).length : 0,
  }), [orders, user?.id]);

  const tiles = stats ? [
    showRevenue && typeof stats.revenueToday === "number" && {
      label: "Revenue today", value: formatKes(stats.revenueToday), sub: "Confirmed paid orders",
      tone: "default" as const,
    },
    showRevenue && typeof stats.revenueMTD === "number" && {
      label: "Revenue MTD", value: formatKes(stats.revenueMTD), sub: "Confirmed paid orders",
      tone: "default" as const,
    },
    showOrderCounts && typeof stats.ordersPending === "number" && {
      label: "Pending orders value", value: String(stats.ordersPending), sub: "orders awaiting payment",
      note: "Revenue confirmed once paid",
      tone: "muted" as const,
    },
    showOrderCounts && typeof stats.ordersToday === "number" && {
      label: "Orders today", value: String(stats.ordersToday),
      sub: typeof stats.ordersPending === "number" ? `${stats.ordersPending} pending` : "",
      tone: "default" as const,
    },
  ].filter(Boolean) as { label: string; value: string; sub: string; note?: string; tone?: "default" | "muted" }[] : [];

  const topProducts = stats?.topSellingProducts ?? [];

  return (
    <AdminLayout title="Dashboard" onReload={() => void refresh()}>
      <HelpAnchor>
        <HelpPanel title="Your dashboard">
          <p style={{ margin: 0 }}>
            This dashboard adapts to what you can do. Each card and action shown below
            corresponds to a permission your account has — you'll never see options you
            can't use.
          </p>
        </HelpPanel>

        <div className="admin-page-stack">
          {stats && <MockBanner source={stats.source} />}

          {tiles.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }} data-admin-stats>
              {(loadingStats && tiles.length === 0
                ? Array.from({ length: 3 }).map(() => ({ label: "Loading…", value: "—", sub: "", note: undefined as string | undefined, tone: "default" as const }))
                : tiles
              ).map((t, i) => (
                <div key={i} className="admin-panel" style={{ padding: 16, opacity: t.tone === "muted" ? 0.95 : 1 }}>
                  <div className="admin-label">{t.label}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 30, marginTop: 8, lineHeight: 1.1, color: t.tone === "muted" ? "var(--admin-muted)" : undefined }}>{t.value}</div>
                  {t.sub && <div style={{ fontSize: 11, marginTop: 6, color: "var(--admin-muted)" }}>{t.sub}</div>}
                  {t.note && <div style={{ fontSize: 10, marginTop: 4, color: "var(--admin-muted)", fontStyle: "italic" }}>{t.note}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Queue-specific blocks */}
          {(showPaymentBlock || showPrepBlock || showDispatchBlock) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }} data-admin-grid>
              {/* These three used to link to /admin/queues/{payment,preparation,dispatch}, which no
                  longer exist since the queue-page -> per-mode-board redesign. Now deep-link to
                  the Orders page pre-filtered by the matching status (see its ?status= handling)
                  rather than a bare, unfiltered /admin/orders. "Orders to prepare" covers two
                  statuses (PAYMENT_VERIFIED, IN_PRODUCTION) but the Orders page's status filter is
                  single-select — links to IN_PRODUCTION, the one orders actually sit at for a
                  meaningful stretch (PAYMENT_VERIFIED is a brief manual-check pass-through). */}
              {showPaymentBlock && (
                <QueueCard icon={CheckCircle2} label="Payments to verify" count={queueCounts.paid} to="/admin/orders?status=PAID" cta="View orders" />
              )}
              {showPrepBlock && (
                <QueueCard icon={PackageCheck} label="Orders to prepare" count={queueCounts.prep} to="/admin/orders?status=IN_PRODUCTION" cta="View orders" />
              )}
              {showDispatchBlock && (
                <QueueCard icon={Send} label="Ready to dispatch" count={queueCounts.dispatch} to="/admin/orders?status=READY_FOR_DISPATCH" cta="View orders" />
              )}
              {/* "Assigned to me" card deliberately removed for now, per explicit request — keep
                  this dashboard simple until "assigned to me" scoping is actually wanted. The
                  underlying assignedToId persistence it depended on is already fixed and ready
                  whenever this comes back. */}
            </div>
          )}

          {showTopProducts && (
            <div className="admin-panel" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Top products (30d)</h2>
                {hasPermission(PERM.PRODUCT_VIEW) || hasPermission(PERM.PRODUCT_MANAGE) ? (
                  <Link to="/admin/products" className="admin-btn admin-btn-ghost">All products</Link>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {topProducts.map((name, idx) => (
                  <div key={`${name}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center", padding: 10, border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{idx + 1}. {name}</div>
                  </div>
                ))}
                {!loadingStats && topProducts.length === 0 && (
                  <div className="admin-empty" style={{ padding: 16 }}>No sales data yet.</div>
                )}
              </div>
            </div>
          )}

          {showBusinessAccounts && (
            <div className="admin-panel" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Briefcase size={16} />
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>Business accounts</h2>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>
                  {bizAccountCount === null ? "—" : bizAccountCount}
                </div>
                <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>opened to date</div>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
                Trade profiles, welcome codes and credit readiness — the foundation for trade credit accounts (coming soon).
              </p>
              <div style={{ marginTop: 10 }}>
                <Link to="/admin/business-accounts" className="admin-btn admin-btn-ghost">Manage business accounts</Link>
              </div>
            </div>
          )}

          {showStaffOverview && (
            <div className="admin-panel" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <UsersIcon size={16} />
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>Staff overview</h2>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--admin-muted)" }}>
                Manage staff accounts, reset passwords, and review roles.
              </p>
              <div style={{ marginTop: 10 }}>
                <Link to="/admin/users" className="admin-btn admin-btn-ghost">Open users</Link>
                {hasPermission(PERM.USER_MANAGE_ROLES) && (
                  <Link to="/admin/roles" className="admin-btn admin-btn-ghost" style={{ marginLeft: 8 }}>Manage roles</Link>
                )}
              </div>
            </div>
          )}

          {showQuickActions && (
            <div className="admin-panel" style={{ padding: 18 }}>
              <h2 style={{ margin: 0, marginBottom: 10, fontFamily: "var(--font-display)", fontSize: 18 }}>Quick actions</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {hasPermission(PERM.PRODUCT_MANAGE) && (
                  <Link to="/admin/products/new" className="admin-btn admin-btn-primary"><Plus size={14} /> New product</Link>
                )}
                {hasPermission(PERM.USER_CREATE) && (
                  <Link to="/admin/users" className="admin-btn admin-btn-ghost"><Plus size={14} /> Add staff</Link>
                )}
                {hasPermission(PERM.ORDER_MANAGE_ALL) && (
                  <Link to="/admin/orders" className="admin-btn admin-btn-ghost"><ShoppingCart size={14} /> Manage orders</Link>
                )}
                {hasPermission(PERM.PRODUCT_MANAGE) && (
                  <Link to="/admin/inventory" className="admin-btn admin-btn-ghost"><Boxes size={14} /> Inventory</Link>
                )}
              </div>
            </div>
          )}

          {/* Truly minimal account — nothing matched any permission block */}
          {!tiles.length && !showPaymentBlock && !showPrepBlock && !showDispatchBlock
            && !showTopProducts && !showStaffOverview && !showQuickActions && !showBusinessAccounts && (
            <div className="admin-panel" style={{ padding: 24, textAlign: "center" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20 }}>Welcome</h2>
              <p style={{ marginTop: 8, color: "var(--admin-muted)", fontSize: 13 }}>
                Your account doesn't have any permissions assigned yet. Please contact your administrator.
              </p>
            </div>
          )}
        </div>
      </HelpAnchor>
    </AdminLayout>
  );
}

function QueueCard({
  icon: Icon, label, count, to, cta,
}: {
  icon: typeof CheckCircle2;
  label: string;
  count: number;
  to: string;
  cta: string;
}) {
  return (
    <div className="admin-panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--admin-muted)" }}>
        <Icon size={16} />
        <div className="admin-label" style={{ margin: 0 }}>{label}</div>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1.05 }}>{count}</div>
      <div>
        <Link to={to} className="admin-btn admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {cta} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboardPage;

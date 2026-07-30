
import { useEffect, useMemo, useState } from "react";
import { OrderDetailDrawer } from "@/components/admin/OrderDetailDrawer";
import { AssignSelect } from "@/components/admin/AssignSelect";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  AgeBadge,
  GatewayChip,
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatDateShort,
  formatKes,
} from "@/components/admin/commerceUi";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { resolveStaffRole } from "@/lib/roles";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { downloadCsv, toCsv } from "@/lib/csv";
import { downloadOrdersListPdf } from "@/lib/pdf";
import { Download, FileText } from "lucide-react";



const PAGE_SIZE = 20;
type Scope = "ALL" | "MINE" | "UNASSIGNED";

// Age/urgency coloring makes no sense once an order is done — don't show a
// red "3d ago" badge on something already delivered.
const TERMINAL_STATUSES = new Set(["DELIVERED", "CANCELLED", "REFUNDED"]);

function AdminOrdersPage() {
  const allowed = useRequirePermission([PERM.ORDER_VIEW, PERM.ORDER_MANAGE_ALL, PERM.ORDER_ASSIGN]);
  const { orders, initialLoading, error, refresh, applyOrderPatch } = useAdminOrders();
  const { user, hasPermission } = useAuth();
  const staffRole = resolveStaffRole(user);

  // Permission-derived scope (no role-name checks for visibility logic).
  const canSeeAll = hasPermission(PERM.ORDER_MANAGE_ALL) || hasPermission(PERM.ORDER_ASSIGN);
  const canAssign = hasPermission(PERM.ORDER_ASSIGN) || hasPermission(PERM.ORDER_MANAGE_ALL);
  const canSeePayment = hasPermission(PERM.PAYMENT_VIEW) || hasPermission(PERM.ORDER_VERIFY_PAYMENT);
  const isAssignedOnly = !canSeeAll; // ORDER_VIEW only
  const currentUserId = user?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState<Scope>(isAssignedOnly ? "MINE" : "ALL");
  const [hideTestOrders, setHideTestOrders] = useState(false);

  useEffect(() => { document.title = "Orders · Moments admin"; }, []);
  useEffect(() => { if (isAssignedOnly) setScope("MINE"); }, [isAssignedOnly]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { if (error) toast.error(error); }, [error]);

  const filteredRows = useMemo(() => {
    const needle = debouncedQ.toLowerCase();
    return orders.filter((o) => {
      // Permission-only orders: hard-locked to their own assignments.
      if (isAssignedOnly && (!currentUserId || o.assignedToId !== currentUserId)) return false;
      if (!isAssignedOnly) {
        if (scope === "MINE" && (!currentUserId || o.assignedToId !== currentUserId)) return false;
        if (scope === "UNASSIGNED" && o.assignedToId) return false;
      }
      if (status !== "ALL" && o.status !== status) return false;
      if (hideTestOrders && o.isTestOrder) return false;
      if (!needle) return true;
      return [o.reference, o.customerName, o.customerEmail, o.customerPhone, o.city, o.trackingNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [orders, isAssignedOnly, scope, currentUserId, status, debouncedQ, hideTestOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  useEffect(() => { if (page > 0 && page >= totalPages) setPage(0); }, [page, totalPages]);

  const totals = useMemo(
    () => ({
      revenue: filteredRows.reduce((s, o) => s + Number(o.total ?? 0), 0),
      orders: filteredRows.length,
    }),
    [filteredRows],
  );

  if (!allowed) return null;
  void canSeePayment;

  return (
    <AdminLayout title="Orders" onReload={() => void refresh()}>
      <HelpAnchor>
        <HelpPanel title={helpTitle(staffRole)}>
          {helpContent(staffRole)}
        </HelpPanel>

        <div className="admin-page-stack">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }} data-admin-stats>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Total orders</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{initialLoading ? "—" : totals.orders}</div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Revenue (visible)</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{initialLoading ? "—" : formatKes(totals.revenue)}</div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Filtered status</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
                {ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label}
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <QueueFreshness />
            <div className="admin-toolbar" data-admin-toolbar>
              <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
                <input
                  className="admin-input"
                  placeholder="Search by reference, customer, email…"
                  value={q}
                  onChange={(e) => { setPage(0); setQ(e.target.value); }}
                  style={{ maxWidth: 320, minWidth: 200 }}
                  data-admin-search-input
                />
                <select
                  className="admin-select"
                  value={status}
                  onChange={(e) => { setPage(0); setStatus(e.target.value); }}
                  style={{ maxWidth: 200 }}
                >
                  {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--admin-muted)", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={hideTestOrders}
                    onChange={(e) => { setPage(0); setHideTestOrders(e.target.checked); }}
                  />
                  Hide test orders
                </label>
                {canAssign && currentUserId && (
                  <div role="tablist" aria-label="Assignment scope" style={{ display: "inline-flex", border: "1px solid var(--admin-border)", borderRadius: 8, overflow: "hidden" }}>
                    {(["ALL", "MINE", "UNASSIGNED"] as const).map((s) => {
                      const active = scope === s;
                      const label = s === "ALL" ? "All orders" : s === "MINE" ? "Assigned to me" : "Unassigned";
                      return (
                        <button
                          key={s}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => { setPage(0); setScope(s); }}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            background: active ? "var(--admin-accent)" : "transparent",
                            color: active ? "var(--cream)" : "var(--admin-text)",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: active ? 600 : 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {!isAssignedOnly && (
                <>
                  <button
                    className="admin-btn admin-btn-ghost"
                    onClick={() => {
                      downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filteredRows.map((o) => ({
                        reference: o.reference, status: o.status, payment: o.paymentStatus, gateway: o.paymentGateway,
                        customer: o.customerName, email: o.customerEmail, phone: o.customerPhone, city: o.city,
                        items: o.items.length, subtotal: o.subtotal, shipping: o.shippingFee, total: o.total,
                        createdAt: o.createdAt, tracking: o.trackingNumber ?? "",
                      }))));
                      toast.success(`Exported ${filteredRows.length} orders`);
                    }}
                  ><Download size={14} style={{ marginRight: 6 }} />Export CSV</button>
                  <button
                    className="admin-btn admin-btn-ghost"
                    onClick={() => {
                      downloadOrdersListPdf(filteredRows, {
                        filterLabel: ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label,
                      });
                      toast.success(`PDF report for ${filteredRows.length} orders`);
                    }}
                  ><FileText size={14} style={{ marginRight: 6 }} />Export PDF</button>
                </>
              )}
            </div>

            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    {canAssign && <th>Assigned</th>}
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    <tr><td colSpan={canAssign ? 9 : 8}><div className="admin-empty">Loading orders…</div></td></tr>
                  ) : pageRows.length === 0 ? (
                    <tr><td colSpan={canAssign ? 9 : 8}>
                      <div className="admin-empty">
                        {isAssignedOnly
                          ? "No orders assigned to you yet. Your supervisor will assign orders when ready."
                          : "No orders match your filters."}
                      </div>
                    </td></tr>
                  ) : (
                    pageRows.map((o) => (
                      <tr key={o.id}>
                        <td><b>{o.reference}</b>{o.isTestOrder && <TestBadge />}</td>
                        <td>
                          <div>{o.customerName}</div>
                          <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{o.city}</div>
                        </td>
                        <td>{o.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)} units · {o.items.length} SKU{o.items.length === 1 ? "" : "s"}</td>
                        <td><b>{formatKes(o.total)}</b></td>
                        <td><OrderStatusBadge status={o.status} /></td>
                        <td style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <PaymentStatusBadge status={o.paymentStatus} />
                          <GatewayChip gateway={o.paymentGateway} />
                        </td>
                        {canAssign && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <AssignSelect
                              orderId={o.id}
                              assignedTo={o.assignedTo}
                              assignedToId={o.assignedToId}
                              paymentStatus={o.paymentStatus}
                              orderStatus={o.status}
                              compact
                              onAssigned={(patch) => applyOrderPatch(o.id, patch)}
                            />

                          </td>
                        )}
                        <td>
                          {formatDateShort(o.createdAt)}{" "}
                          {!TERMINAL_STATUSES.has(o.status) && <AgeBadge since={o.createdAt} />}
                        </td>
                        <td>
                          <button className="admin-btn admin-btn-ghost" onClick={() => setOpenId(o.id)}>View</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="admin-show-mobile admin-card-list" style={{ padding: 12 }}>
              {initialLoading ? (
                <div className="admin-empty">Loading orders…</div>
              ) : pageRows.length === 0 ? (
                <div className="admin-empty">
                  {isAssignedOnly ? "No orders assigned to you yet." : "No orders match your filters."}
                </div>
              ) : pageRows.map((o) => (
                <div key={o.id} className="admin-card">
                  <div className="admin-card-row">
                    <span><b>{o.reference}</b>{o.isTestOrder && <TestBadge />}</span>
                    <b>{formatKes(o.total)}</b>
                  </div>
                  <div className="admin-card-row">
                    <span>{o.customerName}</span>
                    <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>{o.city}</span>
                  </div>
                  <div className="admin-card-row" style={{ flexWrap: "wrap", gap: 6 }}>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <GatewayChip gateway={o.paymentGateway} />
                  </div>
                  <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                    <span>{o.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)} units · {o.items.length} SKU{o.items.length === 1 ? "" : "s"}</span>
                    <span>{formatDateShort(o.createdAt)}</span>
                    {!TERMINAL_STATUSES.has(o.status) && <AgeBadge since={o.createdAt} />}
                  </div>
                  {canAssign && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AssignSelect
                        orderId={o.id}
                        assignedTo={o.assignedTo}
                        assignedToId={o.assignedToId}
                        paymentStatus={o.paymentStatus}
                        orderStatus={o.status}
                        compact
                        onAssigned={(patch) => applyOrderPatch(o.id, patch)}
                      />

                    </div>
                  )}
                  <div className="admin-card-actions">
                    <button className="admin-btn admin-btn-ghost" onClick={() => setOpenId(o.id)} style={{ flex: 1 }}>View order</button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, flexWrap: "wrap", gap: 10 }} data-admin-pagination>
                <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                  Page {page + 1} of {totalPages} · {filteredRows.length} orders
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                  <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </HelpAnchor>
      <OrderDetailDrawer orderId={openId} onClose={() => setOpenId(null)} onChanged={() => void refresh()} />
    </AdminLayout>
  );
}

function helpTitle(role: ReturnType<typeof resolveStaffRole>): string {
  if (role === "STAFF") return "Your assigned orders";
  if (role === "SUPERVISOR") return "Supervisor — orders";
  return "Orders";
}

function helpContent(role: ReturnType<typeof resolveStaffRole>) {
  if (role === "STAFF") {
    return (
      <div>
        <p style={{ marginTop: 0 }}>Your role: <b>Staff</b>.</p>
        <p>Orders assigned to you by your supervisor appear here. You can view order details but cannot change order status. Contact your supervisor if you need to make changes.</p>
      </div>
    );
  }
  if (role === "SUPERVISOR") {
    return (
      <div>
        <p style={{ marginTop: 0 }}>As <b>Supervisor</b> you can:</p>
        <ul style={{ paddingLeft: 18, margin: "4px 0" }}>
          <li>View all orders regardless of status</li>
          <li>Assign orders to the right team member</li>
          <li>Override order status when needed</li>
          <li>Filter orders assigned to you or unassigned</li>
        </ul>
        <p style={{ marginBottom: 0, fontSize: 12 }}>
          <b>Assignment rules:</b> you can only assign to staff at your level or below — not to Admin or Super Admin.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p style={{ marginTop: 0 }}>The Orders page lists every order in the system.</p>
      <ul style={{ paddingLeft: 18, margin: "4px 0" }}>
        <li>Filter by status, search by reference / customer</li>
        <li>Assign orders to staff (Assigned column)</li>
        <li>Export the visible list to CSV or PDF</li>
        <li>Open any order for full details and history</li>
      </ul>
    </div>
  );
}

/** Sandbox/test-mode system — marks an order placed by a designated internal test account, so
 *  staff never confuse it with a real customer order while it flows through the same queues. */
function TestBadge() {
  return (
    <span
      style={{
        display: "inline-flex", marginLeft: 6, padding: "1px 6px", borderRadius: 999,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
        background: "rgba(234, 179, 8, 0.18)", color: "#a16207",
      }}
    >
      TEST
    </span>
  );
}

export default AdminOrdersPage;

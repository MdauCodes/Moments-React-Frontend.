
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { AssignSelect } from "@/components/admin/AssignSelect";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  AgeBadge,
  DeliveryFeeStatusBadge,
  FulfillmentBadge,
  GatewayChip,
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
  PAYMENT_STATUS_OPTIONS,
  PaymentStatusBadge,
  formatDateShort,
  formatKes,
} from "@/components/admin/commerceUi";
import { listOrders, assignOrder, listAssignableUsers, type AssignableUser } from "@/services/commerceApi";
import type { OrderRecord } from "@/services/commerceMock";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { resolveStaffRole, canAssignTo } from "@/lib/roles";
import { reportAdminError } from "@/lib/adminErrorToast";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { downloadCsv, toCsv } from "@/lib/csv";
import { downloadOrdersListPdf } from "@/lib/pdf";
import { Download, FileText } from "lucide-react";
import { FULFILLMENT_MODE_KEYS, FULFILLMENT_MODES, stageSortIndex } from "@/lib/fulfillmentModes";



const PAGE_SIZE = 20;
type Scope = "ALL" | "MINE" | "UNASSIGNED";
type DeliveryTab = "ALL" | "COMPLETED" | "FAILED_DROPPED" | (typeof FULFILLMENT_MODE_KEYS)[number];

// "ALL"/"COMPLETED"/"FAILED_DROPPED" are cross-mode views, not fulfillment modes themselves, so
// they stay hardcoded here; every actual mode tab comes from the registry — adding a future
// provider there adds its tab here automatically, no edit needed in this file.
const DELIVERY_TABS: { value: DeliveryTab; label: string }[] = [
  { value: "ALL", label: "Active" },
  ...FULFILLMENT_MODE_KEYS.map((key) => ({ value: key, label: FULFILLMENT_MODES[key].label })),
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED_DROPPED", label: "Failed / Dropped" },
];

// Every operational tab (everything but Completed/Failed-Dropped) only ever shows orders that
// are still actual work — an unpaid/abandoned checkout, a cancellation, or a refund is noise in
// a working queue, not something staff need to act on there (Failed/Dropped is where those
// live); a DELIVERED order is done and just as much noise once it's no longer actionable
// (Completed is where those live instead) — see DELIVERY_TABS's "Active" vs "Completed" split.
const NON_SUCCESSFUL_STATUSES = new Set(["PENDING_PAYMENT", "CANCELLED", "REFUNDED"]);
const DONE_STATUSES = new Set(["DELIVERED"]);

interface ClientFilterParams {
  isAssignedOnly: boolean;
  currentUserId: string | null;
  scope: Scope;
  deliveryTab: DeliveryTab;
  status: string;
  paymentStatus: string;
  hideTestOrders: boolean;
  needle: string;
}

// Every filter dimension this page applies beyond what the backend's list endpoint can express
// server-side (paymentStatus, hideTestOrders, assignment scope, and the delivery-tab's
// multi-status "active"/"completed"/"failed-dropped" buckets). Pulled out as a pure function so
// export can run the exact same logic over a larger backend-fetched set instead of just the
// shared 500-row cache, without duplicating the rules.
function applyClientFilters(list: OrderRecord[], p: ClientFilterParams): OrderRecord[] {
  return list.filter((o) => {
    // Permission-only orders: hard-locked to their own assignments.
    if (p.isAssignedOnly && (!p.currentUserId || o.assignedToId !== p.currentUserId)) return false;
    if (!p.isAssignedOnly) {
      if (p.scope === "MINE" && (!p.currentUserId || o.assignedToId !== p.currentUserId)) return false;
      if (p.scope === "UNASSIGNED" && o.assignedToId) return false;
    }

    // Delivery-mode tab: FAILED_DROPPED and COMPLETED are the two complements of the
    // active-work default below — FAILED_DROPPED is where a checkout never completed,
    // COMPLETED is where a delivered order goes once there's nothing left to do — both
    // surfaced separately rather than left to look like noise inside the working queues.
    if (p.deliveryTab === "FAILED_DROPPED") {
      // Broadened from PENDING_PAYMENT-only: a cancellation, a refund, and a TumaBoda order
      // that paid but never got a rider are just as much a "didn't complete" case as an
      // abandoned checkout — all three used to be invisible in this funnel.
      if (!(NON_SUCCESSFUL_STATUSES.has(o.status) || !!o.tumabodaBookingFailureReason)) return false;
    } else if (p.deliveryTab === "COMPLETED") {
      if (!DONE_STATUSES.has(o.status)) return false;
    } else {
      if (p.deliveryTab !== "ALL" && o.fulfillmentType !== p.deliveryTab) return false;
      // Every tab defaults to active orders only — see NON_SUCCESSFUL_STATUSES/DONE_STATUSES.
      // Skipped once either status filter is explicit: a failed-payment order sits at
      // status PENDING_PAYMENT (a payment failure never advances the order's own status), so
      // without this, filtering by paymentStatus=FAILED with status left on "ALL" would hit
      // this default and silently show zero rows — exactly the case the "Failed payments"
      // dashboard alert deep-links into.
      if (p.status === "ALL" && p.paymentStatus === "ALL" && (NON_SUCCESSFUL_STATUSES.has(o.status) || DONE_STATUSES.has(o.status))) return false;
    }

    if (p.status !== "ALL" && o.status !== p.status) return false;
    if (p.paymentStatus !== "ALL" && o.paymentStatus !== p.paymentStatus) return false;
    if (p.hideTestOrders && o.isTestOrder) return false;
    if (!p.needle) return true;
    return [o.reference, o.customerName, o.customerEmail, o.customerPhone, o.city, o.tumabodaTrackingCode]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(p.needle));
  });
}

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
  const [searchParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  // Seeded once from ?status= (e.g. a dashboard queue card deep-linking straight to a filtered
  // view) — deliberately a one-time initial value, not kept in sync with the URL afterward, same
  // as every other filter on this page.
  const [status, setStatus] = useState<string>(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && ORDER_STATUS_OPTIONS.some((o) => o.value === fromUrl) ? fromUrl : "ALL";
  });
  // Same deep-link pattern as ?status= above — lets the "Failed payments" dashboard alert (which
  // counts PaymentRecord failures, not an Order.status value) land on a real filtered view
  // instead of the generic order-status list.
  const [paymentStatus, setPaymentStatus] = useState<string>(() => {
    const fromUrl = searchParams.get("paymentStatus");
    return fromUrl && PAYMENT_STATUS_OPTIONS.some((o) => o.value === fromUrl) ? fromUrl : "ALL";
  });
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState<Scope>(isAssignedOnly ? "MINE" : "ALL");
  const [hideTestOrders, setHideTestOrders] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<DeliveryTab>("ALL");

  // Bulk assign — the only bulk action for now; reuses the same eligibility rules and endpoint
  // AssignSelect already applies per-row (must be PAID, not in a terminal status).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  useEffect(() => {
    if (!canAssign) return;
    listAssignableUsers().then(setAssignees).catch(() => {});
  }, [canAssign]);

  useEffect(() => { document.title = "Orders · Moments admin"; }, []);
  useEffect(() => { if (isAssignedOnly) setScope("MINE"); }, [isAssignedOnly]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { if (error) toast.error(error); }, [error]);

  // The shared order cache (AdminOrdersContext) caps at 500 most-recent orders — fine for
  // browsing, but a search for an older order silently reports "no results" even though the
  // order exists. When there's an active search term, fetch matches directly from the backend
  // (which now supports free-text search) instead of filtering the capped local cache, paging
  // through every match up to a generous cap so a broad query can't hang the page.
  const [searchResults, setSearchResults] = useState<OrderRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchGen = useRef(0);

  useEffect(() => {
    if (!debouncedQ) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    const SIZE = 200;
    const CAP = 2000;
    (async () => {
      try {
        const first = await listOrders({ q: debouncedQ, page: 0, size: SIZE });
        if (gen !== searchGen.current) return;
        let all = first.rows;
        const pagesToFetch = Math.min(first.totalPages, Math.ceil(CAP / SIZE));
        for (let page = 1; page < pagesToFetch && all.length < CAP; page++) {
          const res = await listOrders({ q: debouncedQ, page, size: SIZE });
          if (gen !== searchGen.current) return;
          all = all.concat(res.rows);
        }
        if (gen === searchGen.current) setSearchResults(all);
      } catch (err) {
        if (gen === searchGen.current) {
          toast.error(err instanceof Error ? err.message : "Search failed");
          setSearchResults([]);
        }
      } finally {
        if (gen === searchGen.current) setSearching(false);
      }
    })();
  }, [debouncedQ]);

  const sourceOrders = useMemo(() => searchResults ?? orders, [searchResults, orders]);

  const filteredRows = useMemo(
    () => applyClientFilters(sourceOrders, {
      isAssignedOnly, currentUserId, scope, deliveryTab, status, paymentStatus, hideTestOrders,
      needle: debouncedQ.toLowerCase(),
    }),
    [sourceOrders, isAssignedOnly, scope, currentUserId, status, paymentStatus, debouncedQ, hideTestOrders, deliveryTab],
  );

  // Export needs every matching order, not just what's in the shared 500-row cache. The search
  // box already solves this for itself (searchResults is a full backend-fetched match set) — this
  // reuses that same bypass for the export buttons specifically, for the common case where an
  // admin filtered by status/tab/payment-status without ever typing a search term. Narrows the
  // backend fetch by whichever single-value filters it can actually express (status,
  // fulfillmentType) and applies the rest (paymentStatus, hideTestOrders, scope, the delivery-tab
  // buckets) client-side afterward via the same applyClientFilters used for on-screen display.
  const [exporting, setExporting] = useState(false);
  async function fetchExportRows(): Promise<OrderRecord[]> {
    if (debouncedQ) return filteredRows; // already a complete backend-fetched match set
    const isRealMode = (FULFILLMENT_MODE_KEYS as readonly string[]).includes(deliveryTab);
    const backendParams = {
      status: status !== "ALL" ? status : undefined,
      fulfillmentType: isRealMode ? deliveryTab : undefined,
    };
    const SIZE = 200;
    const CAP = 5000;
    const first = await listOrders({ ...backendParams, page: 0, size: SIZE });
    let all = first.rows;
    const pagesToFetch = Math.min(first.totalPages, Math.ceil(CAP / SIZE));
    for (let page = 1; page < pagesToFetch && all.length < CAP; page++) {
      const res = await listOrders({ ...backendParams, page, size: SIZE });
      all = all.concat(res.rows);
    }
    return applyClientFilters(all, {
      isAssignedOnly, currentUserId, scope, deliveryTab, status, paymentStatus, hideTestOrders, needle: "",
    });
  }

  // Within a single fulfillment-mode tab, cluster orders by that mode's own journey stage
  // (see fulfillmentModes.ts's statusOrder) instead of leaving them in date order — the whole
  // point of a mode-specific tab is seeing where each order actually is, not just when it was
  // placed. "ALL"/"COMPLETED"/"FAILED_DROPPED" are cross-mode views with no single stage
  // sequence to sort by, so they keep the default (newest-first) order.
  const sortedRows = useMemo(() => {
    if (deliveryTab === "ALL" || deliveryTab === "COMPLETED" || deliveryTab === "FAILED_DROPPED") {
      return filteredRows;
    }
    return [...filteredRows].sort((a, b) => stageSortIndex(a) - stageSortIndex(b));
  }, [filteredRows, deliveryTab]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRows, page],
  );

  useEffect(() => { if (page > 0 && page >= totalPages) setPage(0); }, [page, totalPages]);

  const totals = useMemo(
    () => ({
      revenue: filteredRows.reduce((s, o) => s + Number(o.total ?? 0), 0),
      orders: filteredRows.length,
    }),
    [filteredRows],
  );

  // Selection is scoped to the current page's rows — clear it whenever the page or any filter
  // changes underneath it, so a stale selection can never silently apply to a different set of
  // orders than what's actually on screen.
  useEffect(() => { setSelectedIds(new Set()); }, [page, deliveryTab, status, paymentStatus, debouncedQ, scope, hideTestOrders]);

  const visibleAssignees = useMemo(
    () => assignees.filter((u) => canAssignTo(staffRole, u.staffRoleName)),
    [assignees, staffRole],
  );

  const TERMINAL_ASSIGN_STATUSES = new Set(["DISPATCHED", "DELIVERED", "CANCELLED", "REFUNDED"]);
  function isAssignEligible(o: OrderRecord & Record<string, any>): boolean {
    return o.paymentStatus === "PAID" && !TERMINAL_ASSIGN_STATUSES.has(String(o.status).toUpperCase());
  }

  const selectedRows = useMemo(
    () => pageRows.filter((o) => selectedIds.has(o.id)) as (OrderRecord & Record<string, any>)[],
    [pageRows, selectedIds],
  );
  const eligibleSelectedRows = useMemo(() => selectedRows.filter(isAssignEligible), [selectedRows]);

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const eligibleIds = (pageRows as (OrderRecord & Record<string, any>)[]).filter(isAssignEligible).map((o) => o.id);
      const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(eligibleIds);
    });
  }

  async function handleBulkAssign() {
    const target = visibleAssignees.find((u) => u.id === bulkAssignTo);
    if (!target || eligibleSelectedRows.length === 0) return;
    setBulkAssigning(true);
    let succeeded = 0;
    for (const o of eligibleSelectedRows) {
      try {
        await assignOrder(o.id, target.name, target.id);
        applyOrderPatch(o.id, { assignedTo: target.name, assignedToId: target.id });
        succeeded++;
      } catch (err) {
        reportAdminError(err, `Failed to assign ${o.reference}`);
      }
    }
    const skipped = selectedRows.length - eligibleSelectedRows.length;
    if (succeeded > 0) {
      toast.success(`Assigned ${succeeded} order${succeeded === 1 ? "" : "s"} to ${target.name}`
        + (skipped > 0 ? ` — ${skipped} skipped (not eligible)` : ""));
    }
    setSelectedIds(new Set());
    setBulkAssignTo("");
    setBulkAssigning(false);
  }

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
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{initialLoading || searching ? "—" : totals.orders}</div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Revenue (visible)</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{initialLoading || searching ? "—" : formatKes(totals.revenue)}</div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Filtered status</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
                {ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label}
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Delivery mode" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DELIVERY_TABS.map((t) => {
              const active = deliveryTab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setPage(0); setDeliveryTab(t.value); }}
                  className="admin-btn"
                  style={{
                    background: active ? "var(--admin-accent)" : undefined,
                    color: active ? "var(--cream)" : undefined,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
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
                <select
                  className="admin-select"
                  value={paymentStatus}
                  onChange={(e) => { setPage(0); setPaymentStatus(e.target.value); }}
                  style={{ maxWidth: 200 }}
                  aria-label="Filter by payment status"
                >
                  {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                    {/* "MINE" deliberately left out for now, per explicit request — keep this
                        view simple until "assigned to me" is actually wanted, even though the
                        underlying assignedToId persistence bug behind it is already fixed. */}
                    {(["ALL", "UNASSIGNED"] as const).map((s) => {
                      const active = scope === s;
                      const label = s === "ALL" ? "All orders" : "Unassigned";
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
              <Link to="/admin/orders/new" className="admin-btn">New order</Link>
              {!isAssignedOnly && (
                <>
                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const rows = await fetchExportRows();
                        downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((o) => ({
                          reference: o.reference, status: o.status, payment: o.paymentStatus, gateway: o.paymentGateway,
                          customer: o.customerName, email: o.customerEmail, phone: o.customerPhone, city: o.city,
                          items: o.items.length, subtotal: o.subtotal, shipping: o.shippingFee, total: o.total,
                          createdAt: o.createdAt, tracking: o.tumabodaTrackingCode ?? "",
                        }))));
                        toast.success(`Exported ${rows.length} orders`);
                      } catch (err) {
                        reportAdminError(err, "Export failed");
                      } finally {
                        setExporting(false);
                      }
                    }}
                  ><Download size={14} style={{ marginRight: 6 }} />{exporting ? "Preparing…" : "Export CSV"}</button>
                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const rows = await fetchExportRows();
                        downloadOrdersListPdf(rows, {
                          filterLabel: ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label,
                        });
                        toast.success(`PDF report for ${rows.length} orders`);
                      } catch (err) {
                        reportAdminError(err, "Export failed");
                      } finally {
                        setExporting(false);
                      }
                    }}
                  ><FileText size={14} style={{ marginRight: 6 }} />{exporting ? "Preparing…" : "Export PDF"}</button>
                </>
              )}
            </div>

            {canAssign && selectedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--admin-accent-soft, rgba(0,0,0,0.03))", borderBottom: "1px solid var(--admin-border)", flexWrap: "wrap" }} data-admin-bulk-bar>
                <span style={{ fontSize: 13 }}>
                  {selectedIds.size} selected{eligibleSelectedRows.length !== selectedIds.size ? ` (${eligibleSelectedRows.length} eligible)` : ""}
                </span>
                <select
                  className="admin-select"
                  value={bulkAssignTo}
                  onChange={(e) => setBulkAssignTo(e.target.value)}
                  style={{ maxWidth: 220 }}
                  disabled={bulkAssigning}
                >
                  <option value="" disabled>Assign selected to…</option>
                  {visibleAssignees.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={bulkAssigning || !bulkAssignTo || eligibleSelectedRows.length === 0}
                  onClick={() => void handleBulkAssign()}
                >
                  {bulkAssigning ? "Assigning…" : `Assign ${eligibleSelectedRows.length || ""}`}
                </button>
                <button className="admin-btn admin-btn-ghost" disabled={bulkAssigning} onClick={() => setSelectedIds(new Set())}>
                  Clear
                </button>
              </div>
            )}

            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    {canAssign && (
                      <th style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={(() => {
                            const eligibleIds = (pageRows as (OrderRecord & Record<string, any>)[]).filter(isAssignEligible).map((o) => o.id);
                            return eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));
                          })()}
                          onChange={toggleSelectAllOnPage}
                          disabled={pageRows.length === 0}
                        />
                      </th>
                    )}
                    <th>Reference</th>
                    <th>Delivery</th>
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
                  {initialLoading || searching ? (
                    <tr><td colSpan={canAssign ? 11 : 9}><div className="admin-empty">{searching ? "Searching…" : "Loading orders…"}</div></td></tr>
                  ) : pageRows.length === 0 ? (
                    <tr><td colSpan={canAssign ? 11 : 9}>
                      <div className="admin-empty">
                        {isAssignedOnly
                          ? "No orders assigned to you yet. Your supervisor will assign orders when ready."
                          : "No orders match your filters."}
                      </div>
                    </td></tr>
                  ) : (
                    pageRows.map((o) => (
                      <tr key={o.id}>
                        {canAssign && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(o.id)}
                              disabled={!isAssignEligible(o as OrderRecord & Record<string, any>)}
                              onChange={() => setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                                return next;
                              })}
                            />
                          </td>
                        )}
                        <td>
                          <b>{o.reference}</b>{o.isTestOrder && <TestBadge />}
                        </td>
                        <td style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                          <FulfillmentBadge fulfillmentType={o.fulfillmentType} />
                          {o.fulfillmentType === "MANUAL_DELIVERY" && (
                            <DeliveryFeeStatusBadge status={o.deliveryFeeStatus ?? "UNPAID"} />
                          )}
                          {o.fulfillmentType === "TUMABODA_DELIVERY" && o.paymentStatus === "PAID" && !o.tumabodaDeliveryId && (
                            <span
                              title="Paid, but the TumaBoda delivery was never created — open the order and retry"
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: "var(--admin-clay)",
                                color: "#fff",
                              }}
                            >
                              No delivery
                            </span>
                          )}
                        </td>
                        <td>
                          <div>{o.customerName}</div>
                          <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{o.city}</div>
                        </td>
                        <td>{o.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)} units · {o.items.length} SKU{o.items.length === 1 ? "" : "s"}</td>
                        <td><b>{formatKes(o.total)}</b></td>
                        <td><OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} /></td>
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
              {initialLoading || searching ? (
                <div className="admin-empty">{searching ? "Searching…" : "Loading orders…"}</div>
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
                    <OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} />
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
      <OrderDetailModal orderId={openId} onClose={() => setOpenId(null)} onChanged={() => void refresh()} />
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

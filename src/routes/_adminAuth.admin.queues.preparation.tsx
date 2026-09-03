
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { reportAdminError, reportTumaBodaBookingFailure } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { updateOrderStatus, groupBookTumaBodaDeliveries, getSuggestedTumaBodaGroups } from "@/services/commerceApi";
import { AgeBadge, formatDateShort, OrderStatusBadge } from "@/components/admin/commerceUi";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";



// TumaBoda's own auto-book (see OrderService.bookTumaBodaIfDueAndReload) fires the instant an
// order reaches READY_FOR_DISPATCH, so grouping has to intercept one step earlier, here at
// IN_PRODUCTION — an order already marked ready has already booked its own rider individually.
// See TumaBodaGroupBookingService's class Javadoc for the full reasoning.
function isGroupable(o: OrderRecord): boolean {
  return o.status === "IN_PRODUCTION" && o.fulfillmentType === "TUMABODA_DELIVERY";
}

function PreparationQueuePage() {
  const allowed = useRequirePermission([PERM.ORDER_PREPARE, PERM.ORDER_MANAGE_ALL]);
  const { user } = useAuth();
  const { orders, initialLoading, refresh } = useAdminOrders();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupBooking, setGroupBooking] = useState(false);
  const [suggestions, setSuggestions] = useState<OrderRecord[][]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await getSuggestedTumaBodaGroups();
      setSuggestions(res.groups);
    } catch (err) {
      reportAdminError(err, "Failed to load grouping suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Fetched once on load, then re-fetched after anything that changes which orders are
  // groupable (a group booking, or an order moving into/out of IN_PRODUCTION) — see the calls
  // in advance() and handleGroupBook() below. Not tied to useAdminOrders' own poll cycle: that
  // would mean re-clustering on every tick even when nothing groupable actually changed.
  useEffect(() => {
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentUserId = user?.id;
  const rows = useMemo(
    () =>
      orders
        .filter((o) =>
          ((o.status === "PAYMENT_VERIFIED" || o.status === "IN_PRODUCTION") && o.paymentStatus === "PAID") ||
          (!!currentUserId && o.assignedToId === currentUserId),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, currentUserId],
  );

  if (!allowed) return null;

  const advance = async (o: OrderRecord, next: OrderStatus, label: string) => {
    setBusyId(o.id);
    try {
      const res = await updateOrderStatus(o.id, next);
      if (res.order?.tumabodaBookingFailureReason) {
        reportTumaBodaBookingFailure(res.order.reference, res.order.tumabodaBookingFailureReason);
      } else {
        toast.success(`${label}: ${o.reference}`);
      }
      await refresh();
      // Started/finished production both change which orders are groupable.
      if (next === "IN_PRODUCTION" || next === "READY_FOR_DISPATCH") void loadSuggestions();
    } catch (err) {
      reportAdminError(err, "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectSuggestion = (group: OrderRecord[]) => {
    setSelectedIds(new Set(group.map((o) => o.id)));
  };

  const handleGroupBook = async () => {
    const ids = [...selectedIds];
    if (ids.length < 2) return;
    setGroupBooking(true);
    try {
      const res = await groupBookTumaBodaDeliveries(ids);
      const failed = res.orders.filter((o) => o.tumabodaBookingFailureReason);
      const succeeded = res.orders.length - failed.length;
      if (succeeded > 0) {
        toast.success(`${succeeded} order${succeeded === 1 ? "" : "s"} grouped into one TumaBoda delivery`);
      }
      failed.forEach((o) => reportTumaBodaBookingFailure(o.reference, o.tumabodaBookingFailureReason!));
      setSelectedIds(new Set());
      await refresh();
      void loadSuggestions();
    } catch (err) {
      reportAdminError(err, "Failed to book grouped delivery");
    } finally {
      setGroupBooking(false);
    }
  };

  return (
    <AdminLayout title="Preparation queue" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Preparation queue">
              <p>Verified orders land here. Click <b>Start Production</b> when you begin assembling, then <b>Mark Ready</b> once packed and labelled. Orders then flow to the Dispatch queue.</p>
            </HelpPanel>
            <QueueFreshness />

            {/* Grouping suggestions — orders TumaBoda could plausibly run as one multi-stop route
                (see TumaBodaGroupBookingService.suggestGroups), so staff don't have to manually
                cross-reference addresses to spot which ready orders are actually going the same
                direction. Purely a starting point: "Select these" only populates the checkboxes
                below — nothing books until Book N as one delivery is clicked. */}
            {!suggestionsLoading && suggestions.length > 0 && (
              <div className="admin-panel" style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-muted)", marginBottom: 6 }}>
                  Suggested groupings — orders close enough together to run as one delivery
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {suggestions.map((group, i) => {
                    const counties = [...new Set(group.map((o) => o.county ?? "Unknown area"))];
                    const alreadySelected = group.every((o) => selectedIds.has(o.id));
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          padding: "6px 10px", borderRadius: 8,
                          background: alreadySelected ? "color-mix(in oklab, var(--admin-accent, #2563eb) 10%, transparent)" : "var(--admin-surface-2, rgba(0,0,0,0.03))",
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          <b>{group.length} orders</b> in {counties.join(" / ")} —{" "}
                          <span style={{ color: "var(--admin-muted)" }}>{group.map((o) => o.reference).join(", ")}</span>
                        </span>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          style={{ whiteSpace: "nowrap" }}
                          onClick={() => selectSuggestion(group)}
                          disabled={alreadySelected}
                        >
                          {alreadySelected ? "Selected" : "Select these"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grouping action bar — only relevant once 2+ groupable TumaBoda orders are ticked. */}
            {selectedIds.size >= 2 && (
              <div
                className="admin-panel"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px" }}
              >
                <span style={{ fontSize: 13 }}>
                  {selectedIds.size} TumaBoda orders selected — book as one multi-stop delivery, closest stop to
                  farthest.
                </span>
                <button className="admin-btn admin-btn-primary" disabled={groupBooking} onClick={() => void handleGroupBook()}>
                  {groupBooking ? "Booking…" : `Book ${selectedIds.size} as one delivery`}
                </button>
              </div>
            )}

            {/* Desktop table */}
            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th />
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>County</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    <tr><td colSpan={8}><div className="admin-empty">Loading…</div></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={8}><div className="admin-empty"><b>Nothing to pack yet</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders appear here after the payments team verifies them. You'll see work as soon as it's ready.</div></div></td></tr>
                  ) : rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {isGroupable(o) && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(o.id)}
                            onChange={() => toggleSelected(o.id)}
                            title="Select to group with other TumaBoda orders into one delivery"
                          />
                        )}
                      </td>
                      <td><b>{o.reference}</b></td>
                      <td>{o.customerName}</td>
                      <td style={{ maxWidth: 340 }}>{o.items.map((i) => i.name).join(", ")}</td>
                      <td>{o.county ?? "—"}</td>
                      <td><OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} /></td>
                      <td>
                        {formatDateShort(o.createdAt)} <AgeBadge since={o.createdAt} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o.status === "PAYMENT_VERIFIED" && (
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={busyId === o.id}
                            onClick={() => void advance(o, "IN_PRODUCTION", "Started production")}
                          >
                            Start Production
                          </button>
                        )}
                        {o.status === "IN_PRODUCTION" && (
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={busyId === o.id}
                            onClick={() => void advance(o, "READY_FOR_DISPATCH", "Marked ready")}
                          >
                            Mark Ready
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8 }}>
              {initialLoading ? (
                <div className="admin-empty">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="admin-empty"><b>Nothing to pack yet</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders appear here after the payments team verifies them. You'll see work as soon as it's ready.</div></div>
              ) : rows.map((o) => (
                <div key={o.id} className="admin-card">
                  <div className="admin-card-row">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {isGroupable(o) && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelected(o.id)}
                          title="Select to group with other TumaBoda orders into one delivery"
                        />
                      )}
                      <b>{o.reference}</b>
                    </span>
                    <OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} />
                  </div>
                  <div className="admin-card-row"><span>{o.customerName}</span><span style={{ color: "var(--admin-muted)" }}>{o.county ?? "—"}</span></div>
                  <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>{o.items.map((i) => i.name).join(", ")}</div>
                  <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                    <span>Created {formatDateShort(o.createdAt)}</span>
                    <AgeBadge since={o.createdAt} />
                  </div>
                  <div className="admin-card-actions">
                    {o.status === "PAYMENT_VERIFIED" && (
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={busyId === o.id}
                        onClick={() => void advance(o, "IN_PRODUCTION", "Started production")}
                      >
                        Start Production
                      </button>
                    )}
                    {o.status === "IN_PRODUCTION" && (
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={busyId === o.id}
                        onClick={() => void advance(o, "READY_FOR_DISPATCH", "Marked ready")}
                      >
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default PreparationQueuePage;

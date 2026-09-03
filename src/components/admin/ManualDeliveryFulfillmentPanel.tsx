import { Loader2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { ItemChecklist } from "@/components/admin/ItemChecklist";
import { DeliveryConfirmationSection } from "@/components/admin/DeliveryConfirmationSection";
import { DeliveryNoteButton } from "@/components/admin/DeliveryNoteButton";
import { DeliveryFeeStatusBadge, HandDeliveryFeeBadge, formatDate } from "@/components/admin/commerceUi";
import { useOrderStatusAction } from "@/lib/useOrderStatusAction";
import {
  triggerDeliveryFeeStk,
  recordDeliveryFeePaid,
  listOrders,
  getOrder,
  linkManualDeliveryOrders,
  unlinkManualDeliveryOrder,
  getManualDeliveryGroup,
  advanceManualDeliveryGroup,
} from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";
import type { OrderRecord } from "@/services/commerceMock";

const MANUAL_DELIVERY_TERMINAL_STATUSES = new Set(["DELIVERED", "CANCELLED", "REFUNDED"]);

/**
 * Manual Delivery has no courier API (see the panel's own Javadoc-equivalent comment below), so
 * when staff hand 2+ orders to the same rider/courier in one trip, there's nothing external to
 * orchestrate — just a real gap that surfaced live: no way to RECORD that these orders went out
 * together, so each order's history looked like an independent, coincidentally-simultaneous
 * dispatch instead of one shared run. This section is that record: link/unlink, see who else is
 * in the trip, and (once linked) mark the whole group out for delivery or completed together
 * rather than clicking each order individually and hoping they stay in sync.
 */
function ManualDeliveryGroupSection({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord & Record<string, any>;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const [group, setGroup] = useState<(OrderRecord & Record<string, any>)[] | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [advanceBusy, setAdvanceBusy] = useState<"DISPATCHED" | "DELIVERED" | null>(null);

  async function loadGroup() {
    setLoadingGroup(true);
    try {
      const res = await getManualDeliveryGroup(order.id);
      setGroup(res.orders.length > 0 ? (res.orders as (OrderRecord & Record<string, any>)[]) : null);
    } catch {
      setGroup(null);
    } finally {
      setLoadingGroup(false);
    }
  }

  useEffect(() => {
    void loadGroup();
    // Re-check whenever this order's own group membership changes (e.g. after linking/unlinking
    // from THIS panel, or a refresh picking up a change made elsewhere).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.manualDeliveryGroupId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      listOrders({ fulfillmentType: "MANUAL_DELIVERY", q, page: 0, size: 6 })
        .then((res) => setResults(res.rows.filter((r) => r.id !== order.id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, order.id]);

  async function handleLink(otherId: string) {
    setLinkBusy(true);
    try {
      await linkManualDeliveryOrders([order.id, otherId]);
      toast.success("Linked as one delivery trip");
      setQuery("");
      setResults([]);
      const res = await getOrder(order.id);
      if (res.order) onOrderUpdated(res.order);
      await loadGroup();
    } catch (err) {
      reportAdminError(err, "Failed to link orders");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlink() {
    if (!window.confirm(`Unlink ${order.reference} from its shared delivery trip? The other order(s) stay linked to each other.`)) return;
    setUnlinkBusy(true);
    try {
      const res = await unlinkManualDeliveryOrder(order.id);
      if (res.order) onOrderUpdated(res.order);
      toast.success("Unlinked");
    } catch (err) {
      reportAdminError(err, "Failed to unlink order");
    } finally {
      setUnlinkBusy(false);
    }
  }

  async function handleAdvanceGroup(newStatus: "DISPATCHED" | "DELIVERED") {
    const groupId = order.manualDeliveryGroupId as string | undefined;
    if (!groupId) return;
    const label = newStatus === "DISPATCHED" ? "out for delivery" : "completed";
    if (!window.confirm(`Mark all ${group?.length ?? 0} linked orders as ${label} together?`)) return;
    setAdvanceBusy(newStatus);
    try {
      const res = await advanceManualDeliveryGroup(groupId, newStatus);
      toast.success(`Marked ${res.orders.length} linked orders as ${label}`);
      const mine = res.orders.find((o) => o.id === order.id);
      if (mine) onOrderUpdated(mine);
      await loadGroup();
    } catch (err) {
      reportAdminError(err, `Failed to mark the group ${label}`);
    } finally {
      setAdvanceBusy(null);
    }
  }

  const siblings = (group ?? []).filter((g) => g.id !== order.id);

  return (
    <Section title="Linked delivery trip" collapsible defaultOpen={!!group}>
      {loadingGroup ? (
        <div className="text-xs text-muted-foreground">Checking…</div>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {group
              ? "Going out with the same rider/courier as:"
              : "Not linked to any other order yet. If this is going out with another order on the same rider/courier run, search for it below — both orders' histories will show the shared trip."}
          </p>
          {group && (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {siblings.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium"
                  >
                    {g.reference} · {(g.status ?? "").toString().replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" className="admin-btn admin-btn-ghost" disabled={unlinkBusy} onClick={() => void handleUnlink()}>
                  {unlinkBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                  Unlink this order
                </button>
                {!MANUAL_DELIVERY_TERMINAL_STATUSES.has(order.status) && (
                  <>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      disabled={!!advanceBusy}
                      onClick={() => void handleAdvanceGroup("DISPATCHED")}
                      title="Mark every linked order out for delivery in one action, so they all move together"
                    >
                      {advanceBusy === "DISPATCHED" && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                      Mark whole trip out for delivery
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      disabled={!!advanceBusy}
                      onClick={() => void handleAdvanceGroup("DELIVERED")}
                      title="Mark every linked order completed in one action, so they all move together"
                    >
                      {advanceBusy === "DELIVERED" && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                      Mark whole trip completed
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          <input
            type="text"
            placeholder="Search by order reference to add another order to this trip…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="admin-input w-full text-sm"
          />
          {searching && <div className="mt-1 text-xs text-muted-foreground">Searching…</div>}
          {results.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={linkBusy}
                  onClick={() => void handleLink(r.id)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  <span className="font-medium">{r.reference}</span>
                  <span className="text-muted-foreground">{r.customerName}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * Manual Delivery's journey: staff arrange a courier by phone, no API integration, so every
 * step here is staff-attested. "Out for delivery" is the mode-specific equivalent of
 * "dispatched" — gated on the item checklist, same as Pickup's "Mark picked up."
 */
export function ManualDeliveryFulfillmentPanel({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Unused here — see PickupFulfillmentPanel's identical comment. */
  onClose?: () => void;
}) {
  const o = order as OrderRecord & Record<string, any>;
  const { busy, advance } = useOrderStatusAction(order, onOrderUpdated);
  const [allTicked, setAllTicked] = useState(false);
  const readyForHandoff = order.statusV2 === "READY_FOR_COURIER_HANDOFF";
  const dispatchedOrLater = order.status === "DISPATCHED" || order.status === "DELIVERED";
  // Hand Delivery's fee is charged upfront as part of the order total at checkout (see
  // HandDeliveryFeeBadge in the Orders list) — deliveryFeeAmount/Status/Method are never set for
  // it (checkout only populates them via the separate phone-negotiated-courier flow), so the
  // STK/record-paid actions below would just create confusing, meaningless data for this mode.
  const isHandDelivery = o.courierType === "HAND_DELIVERY";

  const [feeAmount, setFeeAmount] = useState("");
  const [feePhone, setFeePhone] = useState("");
  const [feeMethod, setFeeMethod] = useState<"SELF_PAID" | "ADMIN_STK" | "MANUAL_RECORD">("SELF_PAID");
  const [feeBusy, setFeeBusy] = useState(false);

  const handleTriggerFeeStk = async () => {
    const amount = Number(feeAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!feePhone.trim()) {
      toast.error("Enter the customer's phone number");
      return;
    }
    setFeeBusy(true);
    try {
      const res = await triggerDeliveryFeeStk(order.id, amount, feePhone.trim());
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("STK prompt sent — confirm once the customer enters their PIN");
      }
    } catch (err) {
      reportAdminError(err, "Failed to send STK prompt");
    } finally {
      setFeeBusy(false);
    }
  };

  const handleRecordFeePaid = async () => {
    const amount = Number(feeAmount || o.deliveryFeeAmount || 0);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setFeeBusy(true);
    try {
      const res = await recordDeliveryFeePaid(order.id, amount, feeMethod);
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("Delivery fee recorded as paid");
      }
    } catch (err) {
      reportAdminError(err, "Failed to record delivery fee");
    } finally {
      setFeeBusy(false);
    }
  };

  return (
    <>
      <Section title="1. Destination — where the customer collects">
        <div className="mb-2">
          <DeliveryNoteButton orderId={order.id} />
        </div>
        <Row label="Town" value={o.city || "—"} />
        <Row label="County" value={o.county || "—"} />
        <Row label="Nearest courier office (customer-side)" value={o.shippingAddress || "—"} />
        {o.postalCode && <Row label="Postal code" value={o.postalCode} />}
        <Row
          label="Collector's name (checked at pickup)"
          value={o.collectorName || "— not provided —"}
        />
      </Section>

      <Section title="2. Dispatch — sacco / courier we use">
        <Row label="Courier type" value={(o.courierType ?? "—").toString().replace(/_/g, " ")} />
        <Row label="Sacco / service name" value={o.courierServiceName || "— (to confirm with customer)"} />
        <Row label="Nairobi stage / office" value={o.courierStageOrOffice || "— (to confirm)"} />
        <Row
          label="Delivery fee"
          value={
            isHandDelivery ? (
              <span className="inline-flex items-center gap-2">
                <HandDeliveryFeeBadge shippingFee={order.shippingFee} />
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {o.deliveryFeeAmount != null ? `KES ${o.deliveryFeeAmount}` : "Not yet arranged"}
                <DeliveryFeeStatusBadge status={o.deliveryFeeStatus ?? "UNPAID"} />
              </span>
            )
          }
        />
        {isHandDelivery ? (
          <div className="mt-2 rounded-md border border-dashed bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            Hand Delivery's fee is charged upfront with the rest of the order — nothing to
            collect or record separately here.
          </div>
        ) : (
          <>
            <div className="mt-2 rounded-md border border-dashed bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Transport cost is paid by the customer directly to the sacco / courier on collection
              (or at dispatch, confirmed by phone). Not included in the order total.
            </div>

            {o.deliveryFeeStatus !== "PAID" && (
              <div className="mt-2.5 space-y-2">
                <input
                  type="number"
                  placeholder="Agreed fee amount (KES)"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="admin-input w-full text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Customer phone (for STK)"
                    value={feePhone}
                    onChange={(e) => setFeePhone(e.target.value)}
                    className="admin-input flex-1 text-sm"
                  />
                  <button type="button" className="admin-btn" disabled={feeBusy} onClick={() => void handleTriggerFeeStk()}>
                    Send STK prompt
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={feeMethod}
                    onChange={(e) => setFeeMethod(e.target.value as typeof feeMethod)}
                    className="admin-input text-sm"
                  >
                    <option value="SELF_PAID">Customer paid directly (e.g. paybill)</option>
                    <option value="ADMIN_STK">STK prompt confirmed paid</option>
                    <option value="MANUAL_RECORD">Cash / other — just record it</option>
                  </select>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={feeBusy}
                    onClick={() => void handleRecordFeePaid()}
                  >
                    Mark fee as paid
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {dispatchedOrLater ? (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 size={16} /> Out for delivery
          </div>
        ) : readyForHandoff ? (
          <div className="mt-3 space-y-3">
            <ItemChecklist orderId={order.id} items={order.items ?? []} onAllTickedChange={setAllTicked} />
            <button
              className="admin-btn admin-btn-primary w-full"
              disabled={busy || !allTicked}
              title={!allTicked ? "Tick every item before marking out for delivery" : undefined}
              onClick={() => void advance("DISPATCHED", "Order marked out for delivery")}
            >
              {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
              Mark out for delivery
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
          </div>
        )}
      </Section>

      {!MANUAL_DELIVERY_TERMINAL_STATUSES.has(order.status) && (
        <ManualDeliveryGroupSection order={o} onOrderUpdated={onOrderUpdated} />
      )}

      {dispatchedOrLater && (
        <DeliveryConfirmationSection order={order} onOrderUpdated={onOrderUpdated} />
      )}
    </>
  );
}

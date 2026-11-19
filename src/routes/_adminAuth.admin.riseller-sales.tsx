import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { HelpAnchor, HelpPanel } from "@/components/admin/HelpPanel";
import { formatKes } from "@/components/admin/commerceUi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AdminAuthContext";
import { reportAdminError } from "@/lib/adminErrorToast";
import { PERM } from "@/lib/permissions";
import { resolveStaffRole } from "@/lib/roles";
import { useRequirePermission } from "@/lib/useRequirePermission";
import {
  getRisellerSalesOverview,
  listRisellerSales,
  markRisellerOrderEntered,
  retryRisellerOrder,
  setRisellerSalesSwitch,
  type RisellerSaleRow,
  type RisellerSaleStatus,
  type RisellerSalesOverview,
} from "@/services/risellerSalesApi";

const STATUS: Record<RisellerSaleStatus, { label: string; tone: string }> = {
  NEEDS_ATTENTION: {
    label: "Needs you",
    tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  FAILED: {
    label: "Trying again",
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  PENDING: { label: "Waiting", tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  SENT: {
    label: "In Riseller",
    tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  ENTERED_BY_HAND: { label: "Entered by hand", tone: "bg-muted text-foreground" },
  NOT_NEEDED: { label: "Not needed", tone: "bg-muted text-muted-foreground" },
};

const ORDER: RisellerSaleStatus[] = [
  "NEEDS_ATTENTION",
  "FAILED",
  "PENDING",
  "SENT",
  "ENTERED_BY_HAND",
  "NOT_NEEDED",
];

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/**
 * Paid website orders going to Riseller by themselves (invoice, payment, stock off the Online
 * Store warehouse). Staff see each order's state here, retry ones Riseller refused, or say they
 * were entered by hand. Super admins turn the whole thing on or off.
 */
function RisellerSalesPage() {
  const allowed = useRequirePermission([PERM.RISELLER_RECORD]);
  const { user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";
  const [overview, setOverview] = useState<RisellerSalesOverview | null>(null);
  const [rows, setRows] = useState<RisellerSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<RisellerSaleStatus | "ALL">("ALL");

  const refresh = async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([getRisellerSalesOverview(), listRisellerSales(300)]);
      setOverview(o);
      setRows(r);
    } catch (err) {
      reportAdminError(err, "Couldn't load Riseller sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed]);

  if (!allowed) return null;

  const toggle = async (on: boolean) => {
    const msg = on
      ? "Turn on sending to Riseller?\n\nFrom now on every paid website order is recorded in Riseller (invoice, payment, stock) once its payment is checked. Orders paid before now are NOT sent: they are listed for staff to choose Sync or Already entered."
      : "Turn off sending to Riseller?\n\nNothing more is sent. New website sales go back to the hand-entry list.";
    if (!confirm(msg)) return;
    setBusy("switch");
    try {
      setOverview(await setRisellerSalesSwitch(on));
      toast.success(on ? "Website sales now go to Riseller." : "Sending to Riseller is off.");
    } catch (err) {
      reportAdminError(err, "Couldn't change the switch");
    } finally {
      setBusy(null);
    }
  };

  const act = async (row: RisellerSaleRow, action: "retry" | "entered") => {
    if (
      action === "entered" &&
      !confirm(
        `Is ${row.orderReference} already entered in Riseller by hand? It will never be sent.`,
      )
    )
      return;
    setBusy(`${row.orderId}:${action}`);
    try {
      const next =
        action === "retry"
          ? await retryRisellerOrder(row.orderId)
          : await markRisellerOrderEntered(row.orderId);
      if (next.status === "SENT")
        toast.success(`${row.orderReference} recorded in Riseller as ${next.invoiceNo}.`);
      else if (action === "entered")
        toast.success(`${row.orderReference} marked as entered by hand.`);
      else
        toast.message(
          `${row.orderReference}: ${STATUS[next.status].label}${next.lastError ? ` — ${next.lastError}` : ""}`,
        );
      await refresh();
    } catch (err) {
      reportAdminError(err, `Couldn't update ${row.orderReference}`);
    } finally {
      setBusy(null);
    }
  };

  const shown = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  const sorted = [...shown].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <AdminLayout title="Riseller sales" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Riseller sales">
              <p>
                Paid website orders are recorded in Riseller by themselves once the payment is
                checked: Riseller makes the invoice, records the M-Pesa payment and takes the stock
                off the Online Store warehouse. Delivery fees are not sent.
              </p>
              <p className="mt-2">
                <b>Needs you</b>: Riseller refused the order (its reason is shown) or kept not
                answering. Fix the cause, then <b>Try again</b>, or choose <b>Entered by hand</b> if
                you keyed it in yourself. <b>Trying again</b> orders retry on their own. Returns and
                refunds are not sent: enter those in Riseller as before.
              </p>
            </HelpPanel>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="riseller-sales-switch"
                  checked={!!overview?.enabled}
                  disabled={!isSuperAdmin || busy !== null || overview === null}
                  onCheckedChange={(on) => void toggle(on)}
                />
                <label htmlFor="riseller-sales-switch" className="text-sm">
                  <span className="font-medium">
                    {overview?.enabled ? "Sending to Riseller is on" : "Sending to Riseller is off"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {overview?.enabled && overview.enabledSince
                      ? `Since ${when(overview.enabledSince)}.`
                      : "Website sales are entered by hand from the reminder list."}
                    {!isSuperAdmin && " Only a super admin can change this."}
                  </span>
                </label>
              </div>
              {!!overview?.backlogOrders && (
                <span className="text-sm text-sky-800 dark:text-sky-300">
                  {overview.backlogOrders} earlier order{overview.backlogOrders === 1 ? "" : "s"} to
                  check (Sync / Already entered)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 py-3">
              {(["ALL", ...ORDER] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  {s === "ALL" ? "All" : STATUS[s].label}
                  {s !== "ALL" && overview ? ` (${overview.counts[s] ?? 0})` : ""}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="admin-empty">Loading…</div>
            ) : sorted.length === 0 ? (
              <div className="admin-empty">
                <b>Nothing here yet</b>
                <div className="mt-1 text-xs text-muted-foreground">
                  Orders show up once they are paid with sending switched on.
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {sorted.map((r) => (
                  <li
                    key={r.orderId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/orders/${r.orderId}`}
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {r.orderReference}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status].tone}`}
                        >
                          {STATUS[r.status].label}
                        </span>
                        {r.invoiceNo && (
                          <span className="text-sm tabular-nums">Invoice {r.invoiceNo}</span>
                        )}
                        {r.sentTotal != null && (
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {formatKes(r.sentTotal)}
                          </span>
                        )}
                      </div>
                      {r.lastError && (
                        <p
                          className={`mt-1 text-sm ${r.status === "NEEDS_ATTENTION" ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}
                        >
                          {r.lastError}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          r.origin === "BACKLOG" ? "Earlier order" : null,
                          r.sentAt ? `Sent ${when(r.sentAt)}` : `Updated ${when(r.updatedAt)}`,
                          r.attempts ? `${r.attempts} tr${r.attempts === 1 ? "y" : "ies"}` : null,
                          r.status === "FAILED" && r.nextAttemptAt
                            ? `next try ${when(r.nextAttemptAt)}`
                            : null,
                          r.decidedBy ? `by ${r.decidedBy}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {(r.status === "NEEDS_ATTENTION" || r.status === "FAILED") && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => void act(r, "entered")}
                        >
                          Entered by hand
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void act(r, "retry")}
                        >
                          {busy === `${r.orderId}:retry` ? "Sending…" : "Try again"}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default RisellerSalesPage;

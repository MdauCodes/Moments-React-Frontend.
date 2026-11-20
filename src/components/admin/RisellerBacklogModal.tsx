import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { showRisellerSaleResult } from "@/lib/risellerSaleToast";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { resolveStaffRole } from "@/lib/roles";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";
import { ApiError, serverNow } from "@/services/adminApi";
import {
  getRisellerSalesOverview,
  listRisellerBacklog,
  markRisellerOrderEntered,
  syncRisellerOrder,
  type RisellerBacklogOrder,
} from "@/services/risellerSalesApi";

// Paid website orders not yet entered in Riseller (all of them while automatic sending is off; only
// the ones paid before it went on, once it is on). Some were keyed into Riseller by hand and some
// were not, and only staff know which, so nothing here is sent until someone picks, per order:
// "Sync" (not in Riseller yet: send it now) or "Already entered" (never send it). Shows by itself
// while anything is left; "Later" hides it for 30 minutes.
const POLL_MS = 5 * 60_000;
const LATER_MS = 30 * 60_000;
const LATER_KEY = "riseller-backlog-later-until";

function readLater(): number {
  try {
    return Number(window.localStorage.getItem(LATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

function reason(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "the server could not be reached";
  return error instanceof Error ? error.message : "unknown problem";
}

const kes = (n: number | null) =>
  n == null
    ? ""
    : `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function RisellerBacklogModal() {
  const { hasPermission, user } = useAuth();
  const allowed = hasPermission(PERM.RISELLER_RECORD) || resolveStaffRole(user) === "SUPER_ADMIN";

  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState<RisellerBacklogOrder[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [laterUntil, setLaterUntil] = useState(readLater);
  const [openedByHand, setOpenedByHand] = useState(false);

  const check = useCallback(async () => {
    try {
      const o = await getRisellerSalesOverview();
      setCount(o.backlogOrders);
    } catch {
      /* no permission yet on an old token, or offline: next poll */
    }
  }, []);

  useEffect(() => {
    if (allowed) void check();
  }, [allowed, check]);
  useVisibilityInterval(() => {
    if (allowed) void check();
  }, POLL_MS);

  // Another pop-up (a staff notice, the new-order alert...) goes first: two stacked pop-ups send
  // clicks to the wrong one. This list opens by itself once the other is closed.
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  useEffect(() => {
    if (!allowed || count === 0) return;
    const look = () =>
      setOtherDialogOpen(
        [...document.querySelectorAll('[role="alertdialog"], [role="dialog"]')].some(
          (el) => !el.closest("[data-riseller-overlay]"),
        ),
      );
    look();
    const t = window.setInterval(look, 1500);
    return () => window.clearInterval(t);
  }, [allowed, count]);

  const open =
    allowed && count > 0 && (openedByHand || (serverNow() >= laterUntil && !otherDialogOpen));

  const load = useCallback(async () => {
    try {
      const list = await listRisellerBacklog();
      setOrders(list);
      setCount(list.length);
    } catch (e) {
      toast.error(`Couldn't load the orders to check: ${reason(e)}`);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
    else setOrders(null);
  }, [open, load]);

  const decide = async (o: RisellerBacklogOrder, choice: "sync" | "entered") => {
    setBusy(`${o.orderId}:${choice}`);
    try {
      const row =
        choice === "sync"
          ? await syncRisellerOrder(o.orderId)
          : await markRisellerOrderEntered(o.orderId);
      if (choice === "sync") showRisellerSaleResult(o.orderReference, row);
      else toast.success(`${o.orderReference} marked as already in Riseller.`);
      const rest = (orders ?? []).filter((x) => x.orderId !== o.orderId);
      setOrders(rest);
      setCount(rest.length);
      if (rest.length === 0) {
        setOpenedByHand(false);
        toast.success("Every website order is sorted for Riseller.");
      }
    } catch (e) {
      toast.error(`${o.orderReference}: ${reason(e)}`);
      void load();
    } finally {
      setBusy(null);
    }
  };

  const later = () => {
    const until = serverNow() + LATER_MS;
    try {
      window.localStorage.setItem(LATER_KEY, String(until));
    } catch {
      /* private mode: hidden for this page only */
    }
    setLaterUntil(until);
    setOpenedByHand(false);
  };

  if (!allowed || count === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenedByHand(true)}
        className="fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCcw className="h-4 w-4 text-sky-600" />
        {count === 1
          ? "1 website order to check for Riseller"
          : `${count} website orders to check for Riseller`}
      </button>
    );
  }

  return (
    <AlertDialog open>
      <AlertDialogContent
        data-riseller-overlay
        className="max-h-[92vh] overflow-hidden border-2 border-sky-500 sm:max-w-2xl"
        onEscapeKeyDown={later}
      >
        <div className="space-y-1">
          <AlertDialogTitle className="text-lg font-semibold">
            Website orders: are they in Riseller?
          </AlertDialogTitle>
          <AlertDialogDescription>
            These paid website orders are not marked as entered in Riseller yet. Some may already
            have been keyed in by hand. Check each one in Riseller, then choose:
          </AlertDialogDescription>
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Sync</span>: it is <em>not</em> in
              Riseller. It is sent now and the stock comes off.
            </li>
            <li>
              <span className="font-medium text-foreground">Already entered</span>: someone already
              took it off in Riseller. It is never sent.
            </li>
          </ul>
        </div>

        <div className="-mx-6 max-h-[55vh] overflow-y-auto border-y px-6">
          {orders === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.orderId} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Link
                      to={`/admin/orders/${o.orderId}`}
                      className="font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {o.orderReference}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {[o.customerName, when(o.paidAt), kes(o.orderTotal)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {o.tickedBy && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Ticked as entered by {o.tickedBy}
                      {o.tickedAt ? ` on ${when(o.tickedAt)}` : ""}. Please check Riseller again.
                    </p>
                  )}
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {l.productName}
                          {l.productCode && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Code {l.productCode}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-red-700 dark:text-red-400">
                          −{l.units.toLocaleString()} {l.unitName ?? "units"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void decide(o, "entered")}
                    >
                      {busy === `${o.orderId}:entered` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Already entered"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void decide(o, "sync")}
                    >
                      {busy === `${o.orderId}:sync` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Sync"
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AlertDialogFooter className="items-center gap-2 sm:justify-between">
          <Link
            to="/admin/riseller-sales"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={later}
          >
            See all Riseller sales
          </Link>
          <Button variant="outline" onClick={later}>
            Later (30 minutes)
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

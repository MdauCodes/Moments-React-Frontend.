import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { resolveStaffRole } from "@/lib/roles";
import { playReminderChime } from "@/lib/orderAlertSound";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";
import { ApiError } from "@/services/adminApi";
import {
  getRisellerRecordSummary,
  listRisellerPending,
  markRisellerRecorded,
  type RisellerPendingProduct,
} from "@/services/risellerRecordApi";

// Riseller never hears about website sales, so an admin keys them in by hand. This reminds them:
// every two hours through the day (dismissable until the next slot) and at 5 pm as a must-do that
// stays until every product is ticked. Only shows when something is actually waiting.
const REMINDER_HOURS = [9, 11, 13, 15];
const MUST_DO_HOUR = 17;
const POLL_MS = 5 * 60_000;
const DISMISS_KEY = "riseller-record-dismissed-slot";
/** When ticking fails, the 5 pm must-do can be put away for this long, so a server problem never locks the dashboard. */
const PARK_MS = 30 * 60_000;
const PARK_KEY = "riseller-record-parked-until";

function readParkedUntil(): number {
  try {
    return Number(window.localStorage.getItem(PARK_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Why a tick failed, in words an admin can pass on: the server's own message and its code, or no connection. */
function failureReason(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.status
      ? ` (error ${error.status}${error.traceId ? `, ref ${error.traceId}` : ""})`
      : "";
    return `${error.message}${code}`;
  }
  if (error instanceof TypeError) return "the server could not be reached";
  return error instanceof Error ? error.message : "unknown problem";
}

/** Nairobi has no daylight saving: always UTC+3. */
function nairobiNow(now = new Date()): { day: string; hour: number } {
  const shifted = new Date(now.getTime() + 3 * 3_600_000);
  return { day: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/** The reminder slot we are in right now, or null before the first one of the day. */
function currentSlot(): { key: string; mustDo: boolean } | null {
  const { day, hour } = nairobiNow();
  if (hour >= MUST_DO_HOUR) return { key: `${day}@${MUST_DO_HOUR}`, mustDo: true };
  const started = REMINDER_HOURS.filter((h) => h <= hour);
  if (started.length === 0) return null;
  return { key: `${day}@${started[started.length - 1]}`, mustDo: false };
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(slot: string) {
  try {
    window.localStorage.setItem(DISMISS_KEY, slot);
  } catch {
    /* private mode: the reminder just comes back on the next check */
  }
}

function units(n: number, unit: string | null) {
  return `${n.toLocaleString()} ${unit ?? "units"}`;
}

export function RisellerRecordReminder() {
  const { hasPermission, user } = useAuth();
  const allowed = hasPermission(PERM.RISELLER_RECORD) || resolveStaffRole(user) === "SUPER_ADMIN";

  const [pendingCount, setPendingCount] = useState(0);
  const [slot, setSlot] = useState(currentSlot);
  const [dismissedSlot, setDismissedSlot] = useState<string | null>(readDismissed);
  const [openedByHand, setOpenedByHand] = useState(false);
  const [items, setItems] = useState<RisellerPendingProduct[] | null>(null);
  const [ticking, setTicking] = useState<string | null>(null);
  const [tickError, setTickError] = useState<string | null>(null);
  const [parkedUntil, setParkedUntil] = useState<number>(readParkedUntil);
  const chimedFor = useRef<string | null>(null);

  const check = useCallback(async () => {
    setSlot(currentSlot());
    try {
      const s = await getRisellerRecordSummary();
      setPendingCount(s.products);
    } catch {
      // Older session token without the new permission, or offline: try again on the next poll.
    }
  }, []);

  useEffect(() => {
    if (allowed) void check();
  }, [allowed, check]);
  useVisibilityInterval(() => {
    if (allowed) void check();
  }, POLL_MS);

  const dueBySlot = !!slot && (slot.mustDo || dismissedSlot !== slot.key);
  const parked = Date.now() < parkedUntil;
  const open = allowed && pendingCount > 0 && (openedByHand || (dueBySlot && !parked));
  const mustDo = open && !!slot?.mustDo;

  const loadItems = useCallback(async () => {
    try {
      const list = await listRisellerPending();
      setItems(list);
      setPendingCount(list.length);
    } catch {
      toast.error("Couldn't load the Riseller list. It will try again in a few minutes.");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setItems(null);
      return;
    }
    void loadItems();
    const tag = `${slot?.key ?? "manual"}|${openedByHand}`;
    if (chimedFor.current !== tag) {
      chimedFor.current = tag;
      playReminderChime();
    }
  }, [open, loadItems, slot?.key, openedByHand]);

  // The 5 pm must-do chimes again every few minutes until it is cleared.
  useEffect(() => {
    if (!mustDo) return;
    const t = window.setInterval(playReminderChime, 3 * 60_000);
    return () => window.clearInterval(t);
  }, [mustDo]);

  const tick = async (p: RisellerPendingProduct) => {
    setTicking(p.productId);
    try {
      await markRisellerRecorded(p.productId, p.lineIds);
      const rest = (items ?? []).filter((i) => i.productId !== p.productId);
      setItems(rest);
      setPendingCount(rest.length);
      if (rest.length === 0) {
        setOpenedByHand(false);
        toast.success("All online sales are entered in Riseller.");
      }
      // Anything that sold while the list was open shows up on the next load.
      setTickError(null);
      void loadItems();
    } catch (error) {
      const reason = failureReason(error);
      console.error("Riseller tick failed", { productId: p.productId, lineIds: p.lineIds, error });
      setTickError(`${p.productName}: ${reason}`);
      toast.error(`Couldn't tick ${p.productName}: ${reason}`);
    } finally {
      setTicking(null);
    }
  };

  const later = () => {
    if (slot) {
      writeDismissed(slot.key);
      setDismissedSlot(slot.key);
    }
    setOpenedByHand(false);
  };

  const parkForNow = () => {
    const until = Date.now() + PARK_MS;
    try {
      window.localStorage.setItem(PARK_KEY, String(until));
    } catch {
      /* private mode: parked for this page only */
    }
    setParkedUntil(until);
    setOpenedByHand(false);
    setTickError(null);
  };

  if (!allowed || pendingCount === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenedByHand(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ClipboardCheck className="h-4 w-4 text-amber-600" />
        {pendingCount === 1
          ? "1 product to enter in Riseller"
          : `${pendingCount} products to enter in Riseller`}
      </button>
    );
  }

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="max-h-[90vh] overflow-hidden border-2 border-amber-500 sm:max-w-lg"
        onEscapeKeyDown={(e) => {
          if (mustDo) e.preventDefault();
          else later();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <AlertDialogTitle className="text-lg font-semibold">
              {mustDo
                ? "Before you close for the day: update Riseller"
                : "Online sales to enter in Riseller"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              These sold on the website and Riseller doesn't know yet. Enter each one in Riseller,
              then tick it here.
              {mustDo && " This stays open until every product is ticked."}
            </AlertDialogDescription>
          </div>
        </div>

        <div className="-mx-6 max-h-[55vh] overflow-y-auto border-y px-6">
          {items === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((p) => (
                <li key={p.productId} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">
                      {p.productName}
                      {p.productCode && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Code {p.productCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm tabular-nums">
                      {p.soldUnits > 0 && (
                        <span className="text-red-700 dark:text-red-400">
                          Take off {units(p.soldUnits, p.unitName)}
                        </span>
                      )}
                      {p.putBackUnits > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Put back {units(p.putBackUnits, p.unitName)}
                        </span>
                      )}
                    </div>
                    <div
                      className="truncate text-xs text-muted-foreground"
                      title={p.orderReferences.join(", ")}
                    >
                      Orders {p.orderReferences.join(", ")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void tick(p)}
                    disabled={ticking !== null}
                    className="shrink-0"
                  >
                    {ticking === p.productId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Entered"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {tickError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Couldn't save the tick for {tickError}</p>
            <p className="mt-0.5 text-xs">
              Nothing was lost: it stays on this list. Try again, or close this for 30 minutes and
              send the message above to support.
            </p>
          </div>
        )}
        {mustDo && tickError && (
          <AlertDialogFooter>
            <Button variant="outline" onClick={parkForNow}>
              Close for 30 minutes
            </Button>
          </AlertDialogFooter>
        )}
        {!mustDo && (
          <AlertDialogFooter>
            <Button variant="outline" onClick={later}>
              Remind me later
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

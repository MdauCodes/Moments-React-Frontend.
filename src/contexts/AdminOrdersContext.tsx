import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { listOrders } from "@/services/commerceApi";
import type { OrderRecord } from "@/services/commerceMock";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";

interface AdminOrdersContextValue {
  orders: OrderRecord[];
  /** True only on first load (before any data is in memory). */
  initialLoading: boolean;
  /** True during any background refetch — drives the small header spinner. */
  refreshing: boolean;
  lastUpdatedAt: number | null;
  error: string | null;
  /** Force a fresh fetch from the backend. */
  refresh: () => Promise<void>;
  /** Optimistically patch a single order in the in-memory cache. */
  applyOrderPatch: (id: string, patch: Partial<OrderRecord>) => void;
}

const AdminOrdersContext = createContext<AdminOrdersContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 120_000;
// Every consumer of this context (Orders page's delivery-mode tabs, dispatch/preparation/payment
// queues, the dashboard, dev-tools) filters client-side over this one fetched batch — past this
// many total orders, a filter can silently miss real matches sitting on a page never fetched.
// Bumped from 100 as an immediate mitigation; the real fix (server-side pagination per view,
// e.g. the Orders page's fulfillmentType tabs using the backend's already-supported query param
// instead of an in-memory filter) needs its own pass since this context is shared by 7+ pages —
// changing its fetch contract isn't safe to do as a drive-by.
const PAGE_SIZE = 500;

export function AdminOrdersProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    if (inflight.current) return inflight.current;
    setRefreshing(true);
    const p = (async () => {
      try {
        const res = await listOrders({ size: PAGE_SIZE, page: 0 });
        // Oldest first — the order staff should actually work through them in, not newest-first
        // (which buries the ones that have been waiting longest at the bottom of every queue).
        const sorted = [...res.rows].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setOrders(sorted);
        setLastUpdatedAt(Date.now());
        setError(null);
        hasLoadedRef.current = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load orders";
        setError(msg);
        if (!hasLoadedRef.current) toast.error(msg);
      } finally {
        setRefreshing(false);
        if (!hasLoadedRef.current) setInitialLoading(false);
        else setInitialLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setInitialLoading(true);
      hasLoadedRef.current = false;
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  // Background polling — pauses entirely while the tab is hidden instead of wastefully
  // refetching a backgrounded panel every 20s.
  useVisibilityInterval(() => {
    if (isAuthenticated) void refresh();
  }, POLL_INTERVAL_MS);

  // Refetch on tab focus
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isAuthenticated, refresh]);

  const applyOrderPatch = useCallback((id: string, patch: Partial<OrderRecord>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const value = useMemo<AdminOrdersContextValue>(
    () => ({ orders, initialLoading, refreshing, lastUpdatedAt, error, refresh, applyOrderPatch }),
    [orders, initialLoading, refreshing, lastUpdatedAt, error, refresh, applyOrderPatch],
  );

  return <AdminOrdersContext.Provider value={value}>{children}</AdminOrdersContext.Provider>;
}

export function useAdminOrders(): AdminOrdersContextValue {
  const ctx = useContext(AdminOrdersContext);
  if (!ctx) throw new Error("useAdminOrders must be used inside <AdminOrdersProvider>");
  return ctx;
}

/** "Updated 12s ago" — recomputes every 10s so the label stays fresh. */
export function useLastUpdatedLabel(lastUpdatedAt: number | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 10_000);
    return () => window.clearInterval(t);
  }, []);
  if (!lastUpdatedAt) return "Never updated";
  const diffSec = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  if (diffSec < 5) return "Updated just now";
  if (diffSec < 60) return `Updated ${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `Updated ${m}m ago`;
  const h = Math.floor(m / 60);
  return `Updated ${h}h ago`;
}

/** "Next update in 1:47" — counts down to the next background poll, ticking every second.
 *  Purely a countdown display; doesn't drive the actual poll (useVisibilityInterval does). */
export function useNextPollLabel(lastUpdatedAt: number | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1_000);
    return () => window.clearInterval(t);
  }, []);
  if (!lastUpdatedAt) return "";
  const remainingMs = lastUpdatedAt + POLL_INTERVAL_MS - Date.now();
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `Next update in ${m}:${String(s).padStart(2, "0")}`;
}

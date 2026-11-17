// The quantities a restaurant person is putting into a new PO (doc 15 §21), kept in this browser
// only as a draft until the order is placed. Storage can be missing or refuse, so every read and
// write is guarded and the draft still works for the visit.
import { useSyncExternalStore } from "react";

import { clampQty } from "@/lib/restaurantPortal";

const KEY = "mpk_restaurant_order_draft";
let quantities: Record<string, number> = read();
const listeners = new Set<() => void>();

function read(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [id, q] of Object.entries(parsed as Record<string, unknown>)) {
      const n = clampQty(typeof q === "number" ? q : 0);
      if (n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function write(next: Record<string, number>) {
  quantities = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

export const orderDraft = {
  get: () => quantities,
  set(productId: string, qty: number) {
    const n = clampQty(qty);
    const next = { ...quantities };
    if (n > 0) next[productId] = n;
    else delete next[productId];
    write(next);
  },
  clear: () => write({}),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useOrderDraft(): Record<string, number> {
  return useSyncExternalStore(orderDraft.subscribe, orderDraft.get, orderDraft.get);
}

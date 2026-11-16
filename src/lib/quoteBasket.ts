// The products a restaurant person is gathering for a quote request (doc 15 §21): picked in the
// browse view, sent from the catalogue page. Kept in this browser only (a convenience, like a
// draft); the request itself lives on the store once sent. Storage can be missing or refuse
// (private windows, full phones), so every read and write is guarded and the list still works
// for the visit.
import { useSyncExternalStore } from "react";

export interface BasketItem {
  id: string;
  name: string;
  image?: string;
}

const KEY = "mpk_restaurant_quote_basket";
const MAX = 50;
let items: BasketItem[] = read();
const listeners = new Set<() => void>();

function read(): BasketItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (x): x is BasketItem => !!x && typeof x.id === "string" && typeof x.name === "string",
          )
          .slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function write(next: BasketItem[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit only */
  }
  listeners.forEach((l) => l());
}

export const quoteBasket = {
  get: () => items,
  has: (id: string) => items.some((i) => i.id === id),
  add(item: BasketItem) {
    if (items.some((i) => i.id === item.id) || items.length >= MAX) return;
    write([...items, item]);
  },
  remove: (id: string) => write(items.filter((i) => i.id !== id)),
  clear: () => write([]),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useQuoteBasket(): BasketItem[] {
  return useSyncExternalStore(quoteBasket.subscribe, quoteBasket.get, quoteBasket.get);
}

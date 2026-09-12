import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiFetch } from "@/config/api";

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  primaryImageUrl: string;
  size: string;
  material: string;
  finish: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Optional variant selection — present when product has variants. */
  variantId?: string;
  variantLabel?: string;
  sku?: string;
  /** True when the line was placed beyond available stock. */
  isBackorder?: boolean;
  /** Pricing-tier (collection) selection. Null/undefined = individual units. */
  tierId?: string | null;
  collectionName?: string;
  collectionQuantity?: number;
  /** quantity * collectionQuantity (or quantity for individual units). */
  totalUnits?: number;
}

/** What to show in the just-added mini-cart (CartAddedSheet) — deliberately NOT the full merged
 *  CartItem (which reflects the line's new running total): a customer who already had 2 Cartons
 *  in cart and just added 1 more should see "1 Carton added", not "3 Cartons" masquerading as a
 *  single fresh add. `nonce` changes on every call so two identical adds in a row (same product,
 *  same tier) still each re-open the sheet — a referentially-fresh object alone isn't a reliable
 *  enough signal for a listener to key off. */
export interface LastAddedInfo {
  productName: string;
  primaryImageUrl: string;
  quantity: number;
  unitLabel: string;
  lineTotal: number;
  isBackorder?: boolean;
  nonce: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  cartTotal: number;
  cartId: string | null;
  cartLoading: boolean;
  lastAdded: LastAddedInfo | null;
  addItem: (item: Omit<CartItem, "id" | "lineTotal">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CART_ID_KEY = "mpk_cart";
const CART_ITEMS_KEY = "mpk_cart_items";

const CartContext = createContext<CartContextValue | undefined>(undefined);

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

/** Returns true only if the string is a standard UUID — i.e. came from the backend. */
function isBackendId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * The one formula every cart-line total must agree on. `unitPrice` is always PER PIECE (see
 * cart.tsx's "per unit" label and its "per {collectionName}" = unitPrice * collectionQuantity
 * display, which this mirrors); for a tier/collection line, `collectionQuantity` is pieces per
 * pack and `quantity` is the number of packs, so the real total is quantity packs × pieces/pack ×
 * price/piece. For a plain individual sale, collectionQuantity is undefined and this reduces to
 * the previous quantity * unitPrice.
 */
function computeLineTotal(quantity: number, unitPrice: number, collectionQuantity?: number): number {
  const packSize = collectionQuantity && collectionQuantity > 0 ? collectionQuantity : 1;
  return quantity * unitPrice * packSize;
}

/** Best-effort normalization of a backend cart payload into CartItem[]. */
function parseBackendCart(data: unknown): CartItem[] | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const rawItems = (obj.items ?? obj.lineItems ?? obj.cartItems) as unknown;
  if (!Array.isArray(rawItems)) return null;
  const items: CartItem[] = [];
  for (const r of rawItems) {
    if (!r || typeof r !== "object") continue;
    const it = r as Record<string, any>;
    const quantity = Number(it.quantity ?? it.qty ?? 0);
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
    const collectionQuantity = it.collectionQuantity != null ? Number(it.collectionQuantity) : undefined;
    items.push({
      id: String(it.id ?? it.itemId ?? genId()),
      productId: String(it.productId ?? it.product?.id ?? ""),
      productName: String(it.productName ?? it.product?.name ?? ""),
      primaryImageUrl: String(it.primaryImageUrl ?? it.product?.primaryImageUrl ?? it.imageUrl ?? ""),
      size: String(it.size ?? ""),
      material: String(it.material ?? ""),
      finish: String(it.finish ?? ""),
      quantity,
      unitPrice,
      lineTotal: Number(it.lineTotal ?? computeLineTotal(quantity, unitPrice, collectionQuantity)),
      variantId: it.variantId ?? undefined,
      variantLabel: it.variantLabel ?? undefined,
      sku: it.sku ?? undefined,
      isBackorder: it.isBackorder ?? undefined,
      tierId: it.tierId ?? null,
      collectionName: it.collectionName ?? undefined,
      collectionQuantity,
      totalUnits:
        it.totalUnits != null
          ? Number(it.totalUnits)
          : collectionQuantity != null
            ? quantity * collectionQuantity
            : quantity,
    });
  }
  return items;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [lastAdded, setLastAdded] = useState<LastAddedInfo | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(CART_ID_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!id) {
      id = genId();
      try {
        window.localStorage.setItem(CART_ID_KEY, id);
      } catch {
        // QuotaExceededError (phone low on storage) — the cart still works this session; the
        // id just isn't persisted, same graceful-degradation as the CART_ITEMS_KEY write below.
      }
    }
    setCartId(id);

    // 1) Hydrate immediately from localStorage so a reload never shows an empty cart.
    let localItems: CartItem[] = [];
    try {
      const stored = window.localStorage.getItem(CART_ITEMS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = parsed;
          setItems(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
    setCartLoading(false);

    // 2) Best-effort backend sync.
    void (async () => {
      try {
        const res = await apiFetch("/api/v1/cart", { session: true, auth: true });
        if (!res.ok) return;
        const data = await res.json();
        const parsed = parseBackendCart(data);
        if (!parsed) return;
        if (parsed.length > 0) {
          setItems(parsed);
        } else if (localItems.length > 0) {
          for (const it of localItems) {
            try {
              await apiFetch("/api/v1/cart/items", {
                method: "POST",
                session: true,
                auth: true,
                json: {
                  productId: it.productId,
                  variantId: it.variantId,
                  tierId: it.tierId ?? null,
                  quantity: it.quantity,
                  size: it.size,
                  material: it.material,
                  finish: it.finish,
                },
              });
            } catch {
              /* keep going — local cart is preserved either way */
            }
          }
        }
      } catch {
        /* keep local state */
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const addItem: CartContextValue["addItem"] = (input) => {
    const collectionQuantity = input.collectionQuantity;
    const totalUnits =
      input.totalUnits ?? (collectionQuantity != null ? input.quantity * collectionQuantity : input.quantity);
    setLastAdded({
      productName: input.productName,
      primaryImageUrl: input.primaryImageUrl,
      quantity: input.quantity,
      unitLabel: input.collectionName || (input.quantity === 1 ? "unit" : "units"),
      lineTotal: computeLineTotal(input.quantity, input.unitPrice, input.collectionQuantity),
      isBackorder: input.isBackorder,
      nonce: Date.now() + Math.random(),
    });
    setItems((prev) => {
      const idx = prev.findIndex(
        (it) =>
          it.productId === input.productId &&
          (it.variantId ?? "") === (input.variantId ?? "") &&
          (it.tierId ?? "") === (input.tierId ?? "") &&
          it.size === input.size &&
          it.material === input.material &&
          it.finish === input.finish,
      );
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].quantity + input.quantity;
        const merged = {
          ...next[idx],
          quantity: newQty,
          lineTotal: computeLineTotal(newQty, next[idx].unitPrice, next[idx].collectionQuantity),
          totalUnits: next[idx].collectionQuantity != null ? newQty * (next[idx].collectionQuantity as number) : newQty,
        };
        next[idx] = merged;
        return next;
      }
      return [
        ...prev,
        {
          ...input,
          id: genId(),
          lineTotal: computeLineTotal(input.quantity, input.unitPrice, input.collectionQuantity),
          totalUnits,
        },
      ];
    });
    // Sync to backend and replace local state with backend response (which carries real UUIDs)
    void apiFetch("/api/v1/cart/items", {
      method: "POST",
      session: true,
      auth: true,
      json: {
        productId: input.productId,
        variantId: input.variantId,
        tierId: input.tierId ?? null,
        quantity: input.quantity,
        size: input.size,
        material: input.material,
        finish: input.finish,
      },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const parsed = parseBackendCart(data);
        if (parsed) setItems(parsed);
      })
      .catch(() => {
        /* keep local cart even if backend rejects */
      });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    // Only call the backend if the id is a real UUID (confirmed by the server).
    // Local random ids (genId) mean the item was never persisted on the backend.
    if (!isBackendId(id)) return;
    void (async () => {
      try {
        const res = await apiFetch(`/api/v1/cart/items/${encodeURIComponent(id)}`, {
          method: "DELETE",
          session: true,
          auth: true,
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const parsed = parseBackendCart(data);
        if (parsed) setItems(parsed);
      } catch {
        /* keep local state */
      }
    })();
  };

  const updateQuantity = (id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, quantity, lineTotal: computeLineTotal(quantity, it.unitPrice, it.collectionQuantity) } : it,
      ),
    );
    // Only call the backend if the id is a real UUID from the server.
    if (!isBackendId(id)) return;
    void (async () => {
      try {
        const res = await apiFetch(`/api/v1/cart/items/${encodeURIComponent(id)}`, {
          method: "PUT",
          session: true,
          auth: true,
          json: { quantity },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const parsed = parseBackendCart(data);
        if (parsed) setItems(parsed);
      } catch {
        /* keep local state */
      }
    })();
  };

  const clearCart = () => {
    setItems([]);
    void apiFetch("/api/v1/cart", {
      method: "DELETE",
      session: true,
      auth: true,
    }).catch(() => {
      /* keep local clear */
    });
  };

  const { itemCount, cartTotal } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const it of items) {
      count += it.quantity;
      total += it.lineTotal;
    }
    return { itemCount: count, cartTotal: total };
  }, [items]);

  return (
    <CartContext.Provider
      value={{ items, itemCount, cartTotal, cartId, cartLoading, lastAdded, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

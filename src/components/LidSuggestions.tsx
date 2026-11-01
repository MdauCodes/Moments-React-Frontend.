import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Plus, Sparkles } from "lucide-react";
import { api } from "@/services/api";
import type { Product } from "@/data/products";
import {
  findMatchingContainers,
  findMatchingLids,
  isLidOnlyName,
  isNoLidName,
} from "@/lib/lidMatching";
import { getStockInfo } from "@/lib/stock";
import { getQuickAddOptions, isQuickAddEligible } from "@/lib/quickAdd";
import { useCart } from "@/contexts/CartContext";
import { cloudinaryOptimized } from "@/lib/cloudinaryImage";

let candidatePool: Promise<Product[]> | null = null;

/** One shared fetch for everything on the page: lids, plus the no-lid containers they fit. */
function loadCandidates(): Promise<Product[]> {
  if (!candidatePool) {
    candidatePool = Promise.all([api.searchProducts("lid", 100), api.searchProducts("no lid", 100)])
      .then(([a, b]) => {
        const seen = new Set<string>();
        return [...a, ...b].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      })
      .catch(() => {
        candidatePool = null;
        return [] as Product[];
      });
  }
  return candidatePool;
}

type Mode = "lids" | "containers" | null;

function modeFor(name: string): Mode {
  if (isNoLidName(name)) return "lids";
  if (isLidOnlyName(name)) return "containers";
  return null;
}

function useCompanions(productName: string, max: number): { mode: Mode; items: Product[] } {
  const mode = modeFor(productName);
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    if (!mode) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void loadCandidates().then((all) => {
      if (cancelled) return;
      setItems(
        mode === "lids"
          ? findMatchingLids(productName, all, max)
          : findMatchingContainers(productName, all, max),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [productName, mode, max]);
  return { mode, items };
}

/** One compact row: thumbnail, name, and a single add button (the product's first buying option). */
function CompanionChip({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const stock = getStockInfo(product, undefined, 1);
  const option = isQuickAddEligible(product, stock) ? getQuickAddOptions(product)[0] : undefined;

  const add = () => {
    if (!option || added) return;
    addItem({
      productId: product.id,
      productName: product.name,
      primaryImageUrl: product.primaryImageUrl ?? "",
      size: "",
      material: product.material || "Standard",
      finish: product.finish || "Standard",
      quantity: option.quantity,
      unitPrice: option.unitPrice,
      sku: product.sku,
      tierId: option.tierId,
      collectionName: option.tierId ? option.rawTier?.collectionName : undefined,
      collectionQuantity: option.tierId ? option.packQty : undefined,
      totalUnits: option.totalUnits,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <li className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white p-1.5 pr-2 shadow-sm">
      <img
        src={cloudinaryOptimized(product.primaryImageUrl ?? "", 80)}
        alt=""
        className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
      />
      <Link
        to={`/products/${product.slug}`}
        className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:underline"
        title={product.name}
      >
        {product.name}
      </Link>
      {option ? (
        <button
          type="button"
          onClick={add}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700"
        >
          {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {added ? "Added" : `Add ${option.label.toLowerCase()}`}
        </button>
      ) : (
        <Link
          to={`/products/${product.slug}`}
          className="flex-shrink-0 rounded-full border border-violet-300 px-3 py-1.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
        >
          Options
        </Link>
      )}
    </li>
  );
}

/**
 * Tells the customer a container is sold without its lid and offers the lids that fit, or — for a
 * lid — offers the no-lid containers it belongs on. Reminder only: nothing blocks checkout.
 */
export function LidSuggestions({
  productName,
  inCartProductIds,
  variant = "default",
}: {
  productName: string;
  compact?: boolean;
  /** "inline" sits inside a cart card beside the quantity and shows more suggestions. */
  variant?: "default" | "inline";
  /** Cart use: once a matching companion is already in the cart, the reminder is done. */
  inCartProductIds?: Set<string>;
}) {
  const { mode, items } = useCompanions(productName, variant === "inline" ? 4 : 3);
  if (!mode) return null;
  if (inCartProductIds && items.some((p) => inCartProductIds.has(p.id))) return null;
  if (mode === "containers" && items.length === 0) return null;

  const lidMode = mode === "lids";
  return (
    <div
      className={`rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-2.5 text-violet-950 ${
        variant === "inline" ? "min-w-[240px] flex-1" : "mt-3"
      }`}
      role="note"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900">
        {lidMode ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />
        )}
        {lidMode
          ? items.length > 0
            ? "No lid included. Add one that fits:"
            : "No lid included. Lids are sold separately."
          : "This is a lid only. Need the container?"}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((p) => (
            <CompanionChip key={p.id} product={p} />
          ))}
        </ul>
      ) : (
        lidMode && (
          <Link
            to="/products?category=Cups%20%26%20Lids"
            className="mt-1 inline-block text-xs font-semibold text-violet-800 underline"
          >
            Browse lids
          </Link>
        )
      )}
    </div>
  );
}

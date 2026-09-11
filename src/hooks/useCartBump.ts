import { useEffect, useRef, useState } from "react";
import { useCart } from "@/contexts/CartContext";

// Deliberately longer than CartAddedSheet's own ~3.2s visible lifetime (3000ms
// auto-dismiss + ~200ms slide-out) so the header cart icon is still visibly
// "lit up" for a moment after that sheet disappears — the visual handoff that
// keeps the cart obvious once its own toast is gone, especially on mobile
// where the sheet sits at the bottom, far from the header icon.
const BUMP_MS = 4000;

export function useCartBump(): boolean {
  const { itemCount } = useCart();
  const [bump, setBump] = useState(false);
  const prevItemCount = useRef(itemCount);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (itemCount > prevItemCount.current) {
      setBump(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBump(false), BUMP_MS);
    }
    prevItemCount.current = itemCount;
  }, [itemCount]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return bump;
}

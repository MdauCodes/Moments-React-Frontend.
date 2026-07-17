import { useEffect, useRef, useState } from "react";

/**
 * Animates a displayed number smoothly toward `value` whenever it changes — used for the cart
 * banner's "shop KES Y more" figures so a quantity change (add/remove item) reads as a live
 * recalculation instead of a jarring instant snap, reinforcing that the banner is reacting to
 * what's actually in the cart right now.
 */
export function useCountUp(value: number, durationMs = 500): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress); // ease-out
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return Math.round(display);
}

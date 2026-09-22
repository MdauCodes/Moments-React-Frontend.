import { useEffect, useState } from "react";
import { getActiveMs, startEngagementClock, subscribeActiveMs } from "@/lib/engagementSignals";

/** Cumulative *visible-tab* time this session, in ms, re-rendering roughly once a second.
 *  Starts the shared clock on first use — see engagementSignals.ts for why it lives outside React. */
export function useActiveMs(): number {
  const [ms, setMs] = useState(() => getActiveMs());
  useEffect(() => {
    startEngagementClock();
    setMs(getActiveMs());
    return subscribeActiveMs(setMs);
  }, []);
  return ms;
}

/** True once the visitor has been actively here for `afterMs`. Once true, stays true — a reveal,
 *  not a toggle, so persistent chrome never flickers back out while someone is reading. */
export function useRevealAfterActiveMs(afterMs: number): boolean {
  const [revealed, setRevealed] = useState(() => getActiveMs() >= afterMs);
  useEffect(() => {
    if (revealed) return;
    startEngagementClock();
    if (getActiveMs() >= afterMs) {
      setRevealed(true);
      return;
    }
    return subscribeActiveMs((ms) => {
      if (ms >= afterMs) setRevealed(true);
    });
  }, [afterMs, revealed]);
  return revealed;
}

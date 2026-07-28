import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { referralStore, type CelebratoryReward } from "@/services/referralStore";

const REFRESH_MS = 60_000;

function formatCountdown(expiresAt: string): string {
  const msRemaining = new Date(expiresAt).getTime() - Date.now();
  if (msRemaining <= 0) return "expiring now";
  const days = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m left`;
}

/**
 * Slim bar above the top nav — a birthday/anniversary reward is a use-it-or-lose-it deal, so
 * this is the FOMO nudge to actually order before it's forfeited. Falls back to a general "check
 * our deals" CTA (same slot, same look) whenever there's nothing active, rather than disappearing
 * — every visitor sees one banner or the other, never neither.
 */
export function CelebratoryRewardBanner() {
  const { isAuthenticated } = useAuth();
  const [reward, setReward] = useState<CelebratoryReward | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setReward(null); return; }
    let cancelled = false;
    function load() {
      void referralStore.getCelebratoryReward().then((r) => { if (!cancelled) setReward(r); });
    }
    load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [isAuthenticated]);

  const active = reward?.active && reward.expiresAt;

  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
      {active ? (
        <>
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{reward!.summary}</span>
          <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[11px] font-semibold">
            {formatCountdown(reward!.expiresAt!)}
          </span>
        </>
      ) : (
        <Link to="/products?deals=true" className="flex items-center gap-2 hover:underline">
          <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Check out today's deals
        </Link>
      )}
    </div>
  );
}

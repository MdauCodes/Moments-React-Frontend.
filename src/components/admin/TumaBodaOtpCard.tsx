import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.round(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Shared ticking-countdown logic between the full card (order detail modal) and the compact
 *  chip (board/queue card) — both need the same live "how long until this OTP dies" math, just
 *  rendered at different sizes. Stops ticking once verified or with no expiry to count down to. */
function useOtpCountdown(expiresAt?: string | null, verifiedAt?: string | null) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (verifiedAt || !expiresAtMs) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [verifiedAt, expiresAtMs]);

  const msRemaining = expiresAtMs != null ? expiresAtMs - now : null;
  const expired = msRemaining != null && msRemaining <= 0;
  // Last minute gets the same red urgency treatment as "expired" — reading a code out that's
  // about to die a few seconds from now is functionally the same problem for whoever's on the
  // phone with the rider.
  const urgent = msRemaining != null && msRemaining <= 60_000;

  return { expiresAtMs, msRemaining, expired, urgent };
}

/**
 * Staff-facing display for TumaBoda's pickup OTP (added to their API 2026-09) — the rider must
 * key this into TumaBoda's own app at pickup to prove they're actually the rider assigned to
 * this delivery. Staff read the code ALOUD to the rider, so it needs to be large, unambiguous,
 * and paired with a live sense of urgency (a ticking countdown, not just a static expiry
 * timestamp) since it's short-lived and useless to read out once expired.
 *
 * Used in the order detail modal (TumaBodaFulfillmentPanel) — see TumaBodaOtpChip below for the
 * condensed version shown on the smaller board/queue card.
 */
export function TumaBodaOtpCard({
  code,
  expiresAt,
  verifiedAt,
}: {
  code?: string | null;
  expiresAt?: string | null;
  verifiedAt?: string | null;
}) {
  const { expiresAtMs, msRemaining, expired, urgent } = useOtpCountdown(expiresAt, verifiedAt);

  if (!code) return null;

  if (verifiedAt) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-xs text-green-700">
        <CheckCircle2 size={14} className="shrink-0" />
        Pickup OTP verified by rider at {new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    );
  }

  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-xs ${
        expired
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : urgent
            ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
            : "border-border bg-secondary/30 text-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide">
          {expired ? <AlertTriangle size={13} /> : <KeyRound size={13} />}
          Pickup OTP — read to rider
        </span>
        {expiresAtMs != null && (
          <span className="font-mono">
            {expired ? "Expired" : `expires in ${formatCountdown(msRemaining!)}`}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-bold tracking-[0.15em]">{code}</span>
        {expiresAtMs != null && (
          <span className="text-[11px] text-muted-foreground">
            (expires {new Date(expiresAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })})
          </span>
        )}
      </div>
      {expired && (
        <p className="mt-1 text-[11px]">
          This code has expired and can no longer be entered. If the rider still hasn't collected the parcel, check with TumaBoda directly.
        </p>
      )}
    </div>
  );
}

/**
 * Condensed single-line version for the board/queue card (FulfillmentBoard's OrderCard) — staff
 * scanning a whole column of cards need the code at a glance without opening the full order
 * modal. Deliberately renders nothing once verified (unlike the full card's green confirmation
 * banner) — a queue card is about what still needs attention, and a verified OTP needs none.
 */
export function TumaBodaOtpChip({
  code,
  expiresAt,
  verifiedAt,
}: {
  code?: string | null;
  expiresAt?: string | null;
  verifiedAt?: string | null;
}) {
  const { msRemaining, expired, urgent } = useOtpCountdown(expiresAt, verifiedAt);

  if (!code || verifiedAt) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
        expired
          ? "bg-destructive/10 text-destructive"
          : urgent
            ? "bg-amber-500/15 text-amber-800"
            : "bg-secondary text-foreground"
      }`}
      title="TumaBoda pickup OTP — read this to the rider"
    >
      <KeyRound size={11} />
      {code}
      {msRemaining != null && <span>· {expired ? "expired" : formatCountdown(msRemaining)}</span>}
    </div>
  );
}

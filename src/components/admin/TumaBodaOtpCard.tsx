import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.round(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Staff-facing display for TumaBoda's pickup OTP (added to their API 2026-09) — the rider must
 * key this into TumaBoda's own app at pickup to prove they're actually the rider assigned to
 * this delivery. Staff read the code ALOUD to the rider, so it needs to be large, unambiguous,
 * and paired with a live sense of urgency (a ticking countdown, not just a static expiry
 * timestamp) since it's short-lived and useless to read out once expired.
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
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (verifiedAt || !expiresAtMs) return; // nothing left to count down to
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [verifiedAt, expiresAtMs]);

  if (!code) return null;

  if (verifiedAt) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-xs text-green-700">
        <CheckCircle2 size={14} className="shrink-0" />
        Pickup OTP verified by rider at {new Date(verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    );
  }

  const msRemaining = expiresAtMs != null ? expiresAtMs - now : null;
  const expired = msRemaining != null && msRemaining <= 0;
  // Last minute gets the same red urgency treatment as "expired" — reading a code out that's
  // about to die a few seconds from now is functionally the same problem for whoever's on the
  // phone with the rider.
  const urgent = msRemaining != null && msRemaining <= 60_000;

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

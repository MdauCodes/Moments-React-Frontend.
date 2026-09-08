/**
 * The single moment "pre-launch" ends across the whole stack — the /launch countdown page
 * (src/routes/launch.tsx), the LaunchBanner countdown (LaunchCountdown.tsx), this site-lock flag,
 * and the backend's own copy (SiteLockConfig.java) all resolve off this exact same instant.
 *
 * Read from VITE_LAUNCH_AT (a Render build-time env var — set per service: production carries the
 * real public launch instant, staging carries one already in the past), NOT hardcoded per branch.
 * Same source text on every branch now — a plain `git merge` has nothing left to silently carry
 * across between environments, which a hardcoded-per-branch value + a "don't merge this" comment
 * demonstrably didn't prevent (this exact line regressed four times across one day). Unset or
 * unparseable resolves to a far-future date (permanently locked) — a forgotten env var should
 * fail toward showing the pre-launch banner, not toward silently hiding it. Matches
 * SiteLockConfig.java's own LAUNCH_AT/fail-safe reasoning (the backend's own copy, and the one
 * that actually enforces the payment gate — this value is cosmetic only, see isSiteLocked below).
 */
function resolveLaunchAt(): number {
  const raw = import.meta.env.VITE_LAUNCH_AT;
  const fallback = new Date("2099-01-01T00:00:00Z").getTime();
  if (!raw) return fallback;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const LAUNCH_AT = resolveLaunchAt();

/**
 * Whether the pre-launch blur/lock banner should show. Time-based (not a static flag) so it
 * disappears on its own the instant LAUNCH_AT passes — no manual flip or redeploy needed at the
 * exact go-live second. Purely cosmetic on the frontend: the real payment gate is enforced
 * server-side (see PaymentService.initiatePayment / SiteLockConfig.isLocked() on the backend),
 * not by anything reading this.
 */
export function isSiteLocked(): boolean {
  return Date.now() < LAUNCH_AT;
}

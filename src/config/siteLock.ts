/**
 * The single moment "pre-launch" ends across the whole stack — the /launch countdown page
 * (src/routes/launch.tsx), the LaunchBanner countdown (LaunchCountdown.tsx), this site-lock flag,
 * and the backend's own copy (SiteLockConfig.java) all resolve off this exact same instant.
 *
 * Read from VITE_LAUNCH_AT (a Render build-time env var — set per service: production carries the
 * real public launch instant, staging carries one already in the past), NOT hardcoded per branch.
 * Same source text on every branch now — a plain `git merge` has nothing left to silently carry
 * across between environments, which a hardcoded-per-branch value + a "don't merge this" comment
 * demonstrably didn't prevent (this exact line regressed four times across one day).
 *
 * Unset or unparseable resolves to a date already in the past (no banner) — NOT to a far-future
 * placeholder. An incident on 2026-09-08 showed exactly why: this value isn't just a boolean gate
 * like SiteLockConfig.java's copy on the backend (where fail-toward-locked is correctly invisible
 * — an API call just gets rejected), it's a timestamp that gets rendered as a live countdown. A
 * 2099 placeholder didn't "fail locked," it rendered as a ~72-year countdown on the live
 * homepage — which reads as the site being broken/compromised, a worse outcome than the thing the
 * fallback was trying to prevent. The real payment gate is still enforced server-side regardless
 * of what this resolves to (see isSiteLocked's own comment below) — this file's only job is
 * cosmetic, so its fallback should fail toward "looks like a normal, launched site," not toward
 * whatever direction sounds safer in the abstract.
 */
function resolveLaunchAt(): number {
  const raw = import.meta.env.VITE_LAUNCH_AT;
  const fallback = new Date("2020-01-01T00:00:00Z").getTime();
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

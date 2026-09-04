/**
 * The single moment "pre-launch" ends across the whole stack — the /launch countdown page
 * (src/routes/launch.tsx), the LaunchBanner countdown (LaunchCountdown.tsx), this site-lock flag,
 * and the backend's own copy (SiteLockConfig.java) all resolve off this exact same instant.
 * Written with an explicit UTC+3 offset so it doesn't depend on the visitor's or the server's
 * local timezone.
 *
 * INTENTIONALLY DIFFERENT ON EACH BRANCH — do not merge this line between `main` and `staging`.
 * `main` carries the real public launch instant; `staging` keeps LAUNCH_AT in the past so
 * isSiteLocked() is always false there and real testing is never blocked. When merging one branch
 * into the other, keep the target branch's own value below. Matches SiteLockConfig.java's
 * LAUNCH_AT (the backend's own copy) — keep both in sync when changing this.
 */
// Staging's own value, per this file's doc comment above: an instant already in the past, so
// isSiteLocked() is always false here and real testing is never blocked.
export const LAUNCH_AT = new Date("2020-01-01T00:00:00+03:00").getTime();

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

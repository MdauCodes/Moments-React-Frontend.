/**
 * Toggle the full-site blur/lock overlay.
 *
 * Set to `true` to blur the entire site and block all customer interactions.
 * Set to `false` to disable the overlay and restore normal site usage.
 *
 * INTENTIONALLY DIFFERENT ON EACH BRANCH — do not merge this line between `main` and `staging`.
 * `main` stays `true` until the real public launch; `staging` is always `false` so real testing
 * here is never blocked. When merging one branch into the other, keep the target branch's own
 * value below. Matches SiteLockConfig.java (the backend's own copy of this same flag) — keep both
 * in sync when flipping this.
 */
export const SITE_LOCK_ENABLED = true;

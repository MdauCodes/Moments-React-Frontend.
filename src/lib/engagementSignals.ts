/**
 * Session-scoped engagement signals — the raw inputs the prompt coordinator
 * (`src/components/engagement/EngagementPrompts.tsx`) decides on.
 *
 * Deliberately a module-level singleton rather than a React hook or context value, for the same
 * reason CookieConsent keeps its clock in sessionStorage (see its own comment): this app renders
 * SiteLayout *inside* each route rather than as a stable parent above the router outlet, so every
 * in-app navigation fully unmounts and remounts the whole layout. Anything counted in a per-mount
 * `useEffect` timer restarts from zero on every page change, which means "has been on the site
 * long enough" could never actually become true for a visitor who is doing the one thing we want
 * them to do — browsing from page to page.
 *
 * So: one ticker, started once per document, accumulating into sessionStorage. That also makes the
 * total survive a hard reload within the same tab, while correctly resetting for a genuinely new
 * visit (sessionStorage is per-tab, per-session).
 *
 * "Active" means the tab is actually visible. A backgrounded tab left open all afternoon is not a
 * visitor who has spent the afternoon with us, and prompting them the instant they switch back
 * would be exactly the kind of ambush this whole mechanism exists to stop.
 */

const ACTIVE_MS_KEY = "mpk_active_ms";
const ORDER_PLACED_AT_KEY = "mpk_order_placed_at";
const LAST_PROMPT_AT_KEY = "mpk_last_prompt_at";

/** How much *visible-tab* time a visitor must spend before any engagement prompt may appear.
 *  One number, one place — this is the "stayed on the website long enough" threshold. */
export const ACTIVE_DWELL_MS = 60_000;

/** A freshly-placed order counts as an engagement moment for this long. Generous enough to
 *  survive the M-Pesa wait plus reading the confirmation page, short enough that it can't follow
 *  someone into a completely separate browsing session later the same day. */
export const POST_ORDER_WINDOW_MS = 30 * 60 * 1000;

/** Nothing may appear this soon after a navigation — a prompt landing on top of a page the
 *  visitor has not even had time to look at is the same ambush as one landing on arrival. */
export const NAV_SETTLE_MS = 4_000;

/** Minimum gap between two prompts, so the second one can't feel like the first one's sequel. */
export const BETWEEN_PROMPTS_MS = 45_000;

/** Floors for the persistent chrome that used to be on screen from the first frame. */
export const SIGNUP_FAB_REVEAL_MS = 20_000;
export const A2HS_REVEAL_MS = 45_000;

const TICK_MS = 1_000;

type Listener = (activeMs: number) => void;

let activeMs = 0;
let lastTickAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;
const listeners = new Set<Listener>();

function readNumber(key: string, store: Storage | undefined): number {
  try {
    const raw = store?.getItem(key);
    const n = raw === null || raw === undefined ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number, store: Storage | undefined): void {
  try {
    store?.setItem(key, String(value));
  } catch {
    // Private browsing / storage disabled — the in-memory counter still works for this page view.
  }
}

function emit(): void {
  listeners.forEach((fn) => fn(activeMs));
}

function accumulate(): void {
  const now = Date.now();
  if (document.visibilityState === "visible") {
    // Wall-clock deltas rather than `+= TICK_MS`: background throttling, a sleeping laptop or a
    // busy main thread all stretch the real interval, and counting ticks would quietly
    // under- or over-count time the visitor did or didn't actually spend here.
    const delta = now - lastTickAt;
    if (delta > 0 && delta < 5 * TICK_MS) activeMs += delta;
  }
  lastTickAt = now;
  write(ACTIVE_MS_KEY, activeMs, window.sessionStorage);
  emit();
}

/** Idempotent — safe to call from every mount; only the first call does anything. */
export function startEngagementClock(): void {
  if (started || typeof window === "undefined" || typeof document === "undefined") return;
  started = true;
  activeMs = readNumber(ACTIVE_MS_KEY, window.sessionStorage);
  lastTickAt = Date.now();
  timer = setInterval(accumulate, TICK_MS);
  document.addEventListener("visibilitychange", () => {
    // Bank whatever was earned up to the moment of hiding, and don't credit the hidden stretch.
    accumulate();
    lastTickAt = Date.now();
  });
  window.addEventListener("pagehide", () => write(ACTIVE_MS_KEY, activeMs, window.sessionStorage));
}

export function getActiveMs(): number {
  return activeMs;
}

export function subscribeActiveMs(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ── Post-order signal ───────────────────────────────────────────────────────
// Recorded purely client-side, next to the existing ORDER_PLACED funnel beacon in checkout.tsx.
// No new backend call and no new field: the moment we care about is "this browser just placed an
// order", which the checkout page already knows locally.

export function recordOrderPlaced(): void {
  if (typeof window === "undefined") return;
  write(ORDER_PLACED_AT_KEY, Date.now(), window.sessionStorage);
  emit();
}

export function orderPlacedRecently(): boolean {
  if (typeof window === "undefined") return false;
  const at = readNumber(ORDER_PLACED_AT_KEY, window.sessionStorage);
  return at > 0 && Date.now() - at < POST_ORDER_WINDOW_MS;
}

// ── One-prompt-at-a-time spacing ────────────────────────────────────────────

export function recordPromptShown(): void {
  if (typeof window === "undefined") return;
  write(LAST_PROMPT_AT_KEY, Date.now(), window.sessionStorage);
}

export function msSinceLastPrompt(): number {
  if (typeof window === "undefined") return Number.POSITIVE_INFINITY;
  const at = readNumber(LAST_PROMPT_AT_KEY, window.sessionStorage);
  return at > 0 ? Date.now() - at : Number.POSITIVE_INFINITY;
}

// ── Shared reveal hook for persistent chrome ────────────────────────────────

/** True once the visitor has been actively on the site for `afterMs`. Used by the sign-up FAB and
 *  the add-to-home-screen bar so neither is part of the first screen a stranger sees. */
export function hasBeenActiveFor(afterMs: number): boolean {
  return activeMs >= afterMs;
}

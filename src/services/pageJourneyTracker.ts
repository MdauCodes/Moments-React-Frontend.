import { apiFetch } from "@/config/api";

/**
 * Fire-and-forget beacon for the admin "page journeys" report (Developer > User Journeys,
 * super-admin only). Identified by the same anonymous mpk_session_id already used for the cart
 * and the checkout funnel (X-Session-Id, via apiFetch's `session: true`) — never blocks or
 * throws into actual navigation. See PageViewTracker.tsx for where this is called from.
 *
 * Views are BUFFERED and sent together: one request every FLUSH_INTERVAL_MS, as soon as
 * MAX_BATCH pile up, or the moment the visitor leaves or switches away (so the last pages of a
 * visit are not lost). That is roughly one request per visit instead of one per page. Each view
 * carries the time it happened so the server keeps their order, which the journey report needs.
 *
 * Compatibility: if the backend does not have the batch endpoint yet (a 404 or 405), this falls back
 * to one request per view for the rest of the page's life, so deploy order does not matter.
 */
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 20; // the backend accepts up to 25 per request

type BufferedView = { path: string; at: number };

let buffer: BufferedView[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let batchSupported = true;
let leaveListenersAttached = false;

function sendSingly(views: BufferedView[]): void {
  for (const view of views) {
    void apiFetch("/api/v1/public/page-journey/event", {
      method: "POST",
      session: true,
      json: { path: view.path },
    }).catch(() => {
      // Analytics beacon only — never surface a failure to the visitor.
    });
  }
}

function send(views: BufferedView[], leaving: boolean): void {
  if (!batchSupported) {
    sendSingly(views);
    return;
  }
  void apiFetch("/api/v1/public/page-journey/events", {
    method: "POST",
    session: true,
    json: { events: views },
    // Lets the request finish even while the page is being closed.
    keepalive: leaving,
  })
    .then((response) => {
      if (response.status === 404 || response.status === 405) {
        batchSupported = false;
        sendSingly(views);
      }
    })
    .catch(() => {
      // Analytics beacon only — never surface a failure to the visitor.
    });
}

function flush(leaving = false): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  while (buffer.length > 0) {
    send(buffer.splice(0, MAX_BATCH), leaving);
  }
}

function attachLeaveListeners(): void {
  if (leaveListenersAttached || typeof window === "undefined") return;
  leaveListenersAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  attachLeaveListeners();
  buffer.push({ path, at: Date.now() });
  if (buffer.length >= MAX_BATCH) {
    flush();
  } else if (timer === null) {
    timer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
  }
}

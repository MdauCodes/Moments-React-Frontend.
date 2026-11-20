// Must reload (owner, 19-20 Nov 2026): the store decides when an open page must or may reload.
//
// - Every call to the store carries X-App (site, admin or restaurant), X-App-Release (this build's stamp) and
//   X-Client-Id (this tab), added in one place by wrapping window.fetch.
// - The page asks the store every minute (staff pages) or three (the shop), and when it comes back to the front.
//   Every answer also says X-Must-Reload when this build is too old; a save refused with 426 means the same.
// - "Let them finish" (owner): someone in the middle of something (typing in a form, a save on its way) gets a
//   note and up to the store's 15 minutes before the box blocks the page.
// - Never a loop: after reloading, if the page is still the old build (a cache catching up), it waits and checks
//   again instead of reloading again.
import { API_BASE } from "@/config/api";

export const RELEASE: string = typeof __APP_RELEASE__ === "string" ? __APP_RELEASE__ : "dev";

export type AppName = "site" | "admin" | "restaurant";

export function currentApp(): AppName {
  const p = window.location.pathname;
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/restaurant")) return "restaurant";
  return "site";
}

export type ReloadState = {
  must: boolean;
  may: boolean;
  message: string | null;
  /** Until when someone busy may finish first (ms since epoch), or null. */
  finishBy: number | null;
  /** The person is in the middle of something. */
  busy: boolean;
  /** "Later" was chosen for this suggested release. */
  later: boolean;
  /** Just reloaded but still the old build: waiting before trying again. */
  waiting: boolean;
};

const LATER_KEY = "mr-later-release";
const RELOAD_KEY = "mr-reload";
const LOOP_GUARD_MS = 2 * 60_000;
const IDLE_MS = 60_000;

let state: ReloadState = {
  must: false,
  may: false,
  message: null,
  finishBy: null,
  busy: false,
  later: false,
  waiting: false,
};
let latestRelease: string | null = null;
const listeners = new Set<(s: ReloadState) => void>();
let started = false;
let lastTyped = 0;
let dirty = false;
let writesInFlight = 0;
let originalFetch: typeof window.fetch;

function set(patch: Partial<ReloadState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribe(listener: (s: ReloadState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getState(): ReloadState {
  return state;
}

function clientId(): string {
  try {
    let id = window.sessionStorage.getItem("mr-client-id");
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 64);
      window.sessionStorage.setItem("mr-client-id", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

function isStoreCall(url: string): boolean {
  return url.startsWith(API_BASE);
}

/** Busy: typing in the last minute, a form changed and not sent yet, or a save on its way. */
function computeBusy(): boolean {
  return writesInFlight > 0 || dirty || Date.now() - lastTyped < IDLE_MS;
}

/** Wraps fetch once: every call to the store says which app and build it is, and the answers are read. */
function wrapFetch() {
  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isStoreCall(url)) return originalFetch(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("X-App", currentApp());
    headers.set("X-App-Release", RELEASE);
    headers.set("X-Client-Id", clientId());
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const write = method !== "GET" && method !== "HEAD";
    if (write) writesInFlight++;
    try {
      const res = await originalFetch(input, { ...init, headers });
      if (res.status === 426 || res.headers.get("X-Must-Reload") === "true") {
        if (!state.must) {
          set({ must: true });
          void check();
        }
      } else if (write && res.ok) {
        dirty = false; // the form was sent
      }
      return res;
    } finally {
      if (write) writesInFlight--;
    }
  };
}

let checking = false;

/** Asks the store whether this page must or may reload. */
export async function check(): Promise<void> {
  if (checking || RELEASE === "dev") return;
  checking = true;
  try {
    const app = currentApp();
    const res = await originalFetch(
      `${API_BASE}/api/v1/system/client-status?app=${app}&release=${encodeURIComponent(RELEASE)}`,
      { credentials: "include", cache: "no-store", headers: { "X-Client-Id": clientId() } },
    );
    if (!res.ok) return;
    const s = (await res.json()) as {
      mustReload: boolean;
      mayReload: boolean;
      message: string | null;
      latestRelease: string | null;
      finishBy: string | null;
    };
    latestRelease = s.latestRelease;
    let later = false;
    try {
      later = window.localStorage.getItem(LATER_KEY) === s.latestRelease;
    } catch {
      /* no storage */
    }
    set({
      must: s.mustReload,
      may: s.mayReload,
      message: s.message,
      finishBy: s.finishBy ? Date.parse(s.finishBy) : null,
      later,
    });
    tick();
  } catch {
    /* offline: next time */
  } finally {
    checking = false;
  }
}

/** Runs often: decides whether a busy person is still finishing, and reloads a hidden tab quietly. */
function tick() {
  const busy = computeBusy();
  if (busy !== state.busy) set({ busy });
  if (state.must && !state.waiting && document.visibilityState === "hidden" && !busy) {
    void reloadNow();
  }
}

/** "Later" on a suggested reload: not asked again until there is a newer release. */
export function later() {
  try {
    if (latestRelease) window.localStorage.setItem(LATER_KEY, latestRelease);
  } catch {
    /* no storage */
  }
  set({ later: true });
}

/** Reloads now: updates the offline helper first, notes where it came from, never twice within two minutes. */
export async function reloadNow(): Promise<void> {
  let last: { from: string; at: number } | null = null;
  try {
    last = JSON.parse(window.localStorage.getItem(RELOAD_KEY) ?? "null");
  } catch {
    /* none */
  }
  if (last && last.from === RELEASE && Date.now() - last.at < LOOP_GUARD_MS) {
    set({ waiting: true });
    return;
  }
  try {
    window.localStorage.setItem(
      RELOAD_KEY,
      JSON.stringify({ from: RELEASE, at: Date.now(), app: currentApp() }),
    );
  } catch {
    /* no storage: still reload */
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.race([
      Promise.all(regs.map((r) => r.update().catch(() => undefined))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* no service worker */
  }
  window.location.reload();
}

/** After a reload: record it, or (still the old build) wait and check again instead of reloading again. */
function afterReload() {
  let last: { from: string; at: number; app: AppName } | null = null;
  try {
    last = JSON.parse(window.localStorage.getItem(RELOAD_KEY) ?? "null");
  } catch {
    /* none */
  }
  if (!last) return;
  if (last.from !== RELEASE) {
    try {
      window.localStorage.removeItem(RELOAD_KEY);
    } catch {
      /* none */
    }
    void originalFetch(`${API_BASE}/api/v1/system/client-reloads`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: last.app,
        fromRelease: last.from,
        toRelease: RELEASE,
        clientId: clientId(),
      }),
    }).catch(() => undefined);
  } else if (Date.now() - last.at < LOOP_GUARD_MS) {
    set({ waiting: true });
    window.setTimeout(
      () => {
        set({ waiting: false });
        void check();
      },
      LOOP_GUARD_MS - (Date.now() - last.at),
    );
  }
}

export function startMustReload() {
  if (started || typeof window === "undefined") return;
  started = true;
  wrapFetch();
  if (RELEASE === "dev") return;
  afterReload();
  const onType = (e: Event) => {
    lastTyped = Date.now();
    const t = e.target as HTMLElement | null;
    if (t && (t.closest("form") || t.isContentEditable) && e.type !== "keydown") dirty = true;
  };
  document.addEventListener("input", onType, true);
  document.addEventListener("change", onType, true);
  document.addEventListener("keydown", () => (lastTyped = Date.now()), true);
  document.addEventListener("submit", () => window.setTimeout(() => (dirty = false), 0), true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
    else tick();
  });
  window.addEventListener("online", () => void check());
  const every = () => (currentApp() === "site" ? 180_000 : 60_000);
  const loop = () => {
    void check();
    window.setTimeout(loop, every());
  };
  window.setTimeout(loop, 3_000);
  window.setInterval(tick, 5_000);
}

/** For tests only. */
export const __test = { set, computeBusy };

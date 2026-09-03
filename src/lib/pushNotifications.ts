// Shared browser-side Web Push mechanics (service worker registration, permission, subscribe) —
// deliberately decoupled from which audience is subscribing (admin vs. customer). Each caller
// fetches its own VAPID public key and POSTs the resulting subscription to its own endpoint
// (admin: adminResources.push.*, customer: the public push API), since those go through
// different auth/fetch conventions.

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

export function getPushPermissionState(): PushPermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission as PushPermissionState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushSubscriptionPayload = { endpoint: string; p256dh: string; auth: string };

/** Registers the shared /sw.js, requests permission (the one real browser prompt), and subscribes
 *  via the Push API. Throws if the user declines or the browser doesn't support push at all —
 *  callers should catch and show a normal error, not treat this as unexpected. */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionPayload> {
  if (getPushPermissionState() === "unsupported") {
    throw new Error("This browser doesn't support push notifications.");
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // TS's lib.dom types for PushManager.subscribe are stricter about the generic ArrayBufferLike
    // than Uint8Array.from actually produces — this is a plain byte array either way.
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

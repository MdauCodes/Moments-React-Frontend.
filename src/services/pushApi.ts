import { apiFetch } from "@/config/api";
import type { PushSubscriptionPayload } from "@/lib/pushNotifications";

export async function getPublicVapidPublicKey(): Promise<string> {
  const res = await apiFetch("/api/v1/public/push/vapid-public-key");
  if (!res.ok) throw new Error("Failed to fetch push configuration.");
  const data: { publicKey: string } = await res.json();
  return data.publicKey;
}

export async function subscribeCustomerPush(payload: PushSubscriptionPayload, orderReference?: string): Promise<void> {
  const res = await apiFetch("/api/v1/public/push/subscribe", {
    method: "POST",
    json: { ...payload, orderReference },
  });
  if (!res.ok) throw new Error("Failed to save push subscription.");
}

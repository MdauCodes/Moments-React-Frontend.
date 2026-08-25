// ----------------------------------------------------------------------------
// Guest "view/delete my data" — self-service, no login required. Mirrors the backend's
// PublicGuestDataController: email -> OTP -> short-lived session token, then the token gates
// reading a summary of what we hold and/or submitting a deletion request. The session token
// travels in a header (X-Guest-Session-Token), never a URL, same reasoning as the order-tracking
// access token.
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";

export interface GuestOrderSummary {
  reference: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  contactName: string;
  phone: string;
  deliveryAddress: string | null;
  city: string | null;
  county: string | null;
}

export interface GuestEnquirySummary {
  createdAt: string;
  contactName: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
}

export interface GuestDataSummary {
  email: string;
  orders: GuestOrderSummary[];
  enquiries: GuestEnquirySummary[];
  newsletterSubscribed: boolean;
}

async function post<T = unknown>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const guestDataApi = {
  async requestOtp(email: string, botFields: Record<string, unknown>): Promise<void> {
    await post("/api/v1/public/guest-data/request-otp", { email, ...botFields });
  },

  async verifyOtp(email: string, otp: string): Promise<{ sessionToken: string }> {
    return post<{ sessionToken: string }>("/api/v1/public/guest-data/verify-otp", { email, otp });
  },

  async getMyData(email: string, sessionToken: string): Promise<GuestDataSummary> {
    const res = await fetch(
      apiUrl(`/api/v1/public/guest-data/my-data?email=${encodeURIComponent(email)}`),
      { headers: { "X-Guest-Session-Token": sessionToken } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed to load your data");
    return data as GuestDataSummary;
  },

  async requestDeletion(email: string, sessionToken: string): Promise<{ message: string }> {
    return post<{ message: string }>(
      "/api/v1/public/guest-data/delete-request",
      { email },
      { "X-Guest-Session-Token": sessionToken },
    );
  },
};

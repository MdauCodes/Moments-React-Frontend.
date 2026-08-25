// ----------------------------------------------------------------------------
// Account deletion + data export requests (ODPC / Data Protection Act, 2019).
// Both route through admin-approval queues on the backend — see
// AccountDeletionController (/api/v1/customer/account/deletion/*) and
// DataExportController (/api/v1/customer/data-export/*).
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch } from "@/contexts/AuthContext";

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(apiUrl(path), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as { message?: string });
    throw new Error((err as any).message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const accountPrivacyStore = {
  async getDeletionStatus(): Promise<{ pending: boolean; scheduledDeletionAt: string | null; awaitingAdminApproval: boolean }> {
    const res = await authFetch(apiUrl("/api/v1/customer/account/deletion/status"));
    if (!res.ok) throw new Error("Failed to load deletion status.");
    return res.json();
  },

  /** Sends an OTP to the account's own email. */
  requestDeletion: () => postJson<{ message: string }>("/api/v1/customer/account/deletion/request"),

  /** OTP-confirm queues the deletion as a PENDING admin-approval request — doesn't start the
   *  grace period by itself. */
  confirmDeletion: (otp: string) => postJson<{ message: string }>("/api/v1/customer/account/deletion/confirm", { otp }),

  /** Cancels either a pending admin-review request or an approved-but-still-in-grace-period deletion. */
  cancelDeletion: () => postJson<{ message: string }>("/api/v1/customer/account/deletion/cancel"),

  /** Right of access / portability — queues for admin approval, delivered to the account's own
   *  registered email once approved. */
  requestDataExport: () => postJson<{ message: string }>("/api/v1/customer/data-export/request"),
};

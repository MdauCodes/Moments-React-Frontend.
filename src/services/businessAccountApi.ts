// ----------------------------------------------------------------------------
// Business Account (Phase 1) — self-service business profile, no localStorage
// fallback since this is a brand-new feature with no legacy local data.
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch } from "@/contexts/AuthContext";

export interface BusinessAccount {
  id: string;
  businessName: string;
  kraPin: string;
  location: string;
  road: string;
  buildingAddress: string;
  industryId?: string | null;
  industryName?: string | null;
  contactPersonName: string;
  contactPersonRole?: string | null;
  phone: string;
  status: "ACTIVE" | "SUSPENDED";
  /** Auto-issued on creation — a single-use promo code redeemable only by this account. */
  welcomeCode?: string | null;
  createdAt: string;
}

export interface BusinessAccountInput {
  businessName: string;
  kraPin: string;
  location: string;
  road: string;
  buildingAddress: string;
  industryId?: string;
  contactPersonName: string;
  contactPersonRole?: string;
  phone: string;
}

export const businessAccountApi = {
  /** Returns null when the customer has no business account yet (404). */
  async getMine(): Promise<BusinessAccount | null> {
    const res = await authFetch(apiUrl("/api/v1/business-accounts/me"));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load business account (${res.status})`);
    return (await res.json()) as BusinessAccount;
  },

  async create(input: BusinessAccountInput): Promise<BusinessAccount> {
    const res = await authFetch(apiUrl("/api/v1/business-accounts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string });
      throw new Error(err.message ?? `Failed to create business account (${res.status})`);
    }
    return (await res.json()) as BusinessAccount;
  },

  async update(input: BusinessAccountInput): Promise<BusinessAccount> {
    const res = await authFetch(apiUrl("/api/v1/business-accounts/me"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string });
      throw new Error(err.message ?? `Failed to update business account (${res.status})`);
    }
    return (await res.json()) as BusinessAccount;
  },
};

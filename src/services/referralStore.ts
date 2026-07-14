// Referral program client. Backend feature flag controls whether the program
// is exposed to customers; if disabled, the storefront shows a Coming Soon card.
import { apiFetch } from "@/config/api";

export interface ReferralStatus {
  featureUnlocked: boolean;
  programEnabled: boolean;
  message?: string;
}

export interface ReferralWallet {
  balance: number;
  currency: string;
  referralCode?: string;
  totalEarned?: number;
  totalRedeemed?: number;
  emailVerified: boolean;
  /** How many more redemptions are allowed before email verification is required. Null once verified (unlimited). */
  freeRedemptionsRemaining: number | null;
}

export interface ReferralTransaction {
  id: string;
  type: string; // EARN, REDEEM, ADJUSTMENT…
  amount: number;
  description?: string;
  createdAt: string;
}

export interface ReferralEntry {
  id: string;
  refereeName?: string;
  refereeEmail?: string;
  status: string; // PENDING, COMPLETED, EXPIRED…
  reward?: number;
  createdAt: string;
}

export interface RewardsTier {
  tierName: string;
  minLifetimePoints: number;
  discountPercent: number;
  perkDescription?: string;
}

async function getJson<T>(path: string, auth = false): Promise<T | null> {
  try {
    const res = await apiFetch(path, { auth, session: true });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const referralStore = {
  async getStatus(): Promise<ReferralStatus> {
    const data = await getJson<any>("/api/v1/referral/status", false);
    return {
      featureUnlocked: Boolean(data?.featureUnlocked),
      programEnabled: Boolean(data?.programEnabled),
      message: data?.message,
    };
  },

  async getWallet(): Promise<ReferralWallet | null> {
    const data = await getJson<any>("/api/v1/customer/referral/wallet", true);
    if (!data) return null;
    return {
      balance: Number(data.balance ?? 0),
      currency: data.currency ?? "KES",
      referralCode: data.referralCode,
      totalEarned: Number(data.lifetimeEarned ?? 0),
      totalRedeemed: Number(data.lifetimeRedeemed ?? 0),
      emailVerified: Boolean(data.emailVerified),
      freeRedemptionsRemaining: data.freeRedemptionsRemaining == null ? null : Number(data.freeRedemptionsRemaining),
    };
  },

  async getTransactions(): Promise<ReferralTransaction[]> {
    const data = await getJson<any>("/api/v1/customer/referral/transactions", true);
    const rows = Array.isArray(data) ? data : (data?.content ?? []);
    return rows.map((r: any) => ({
      id: String(r.id ?? r.transactionId ?? ""),
      type: String(r.type ?? "ADJUSTMENT"),
      amount: Number(r.amount ?? 0),
      description: r.description,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  },

  async getReferrals(): Promise<ReferralEntry[]> {
    const data = await getJson<any>("/api/v1/customer/referral/referrals", true);
    const rows = Array.isArray(data) ? data : (data?.content ?? []);
    return rows.map((r: any) => ({
      id: String(r.id ?? ""),
      refereeName: r.refereeName ?? r.name,
      refereeEmail: r.refereeEmail ?? r.email,
      status: String(r.status ?? "PENDING"),
      reward: r.reward != null ? Number(r.reward) : undefined,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  },

  /** Resolved VIP tier — null if no tier configured/qualified yet. */
  async getMyTier(): Promise<RewardsTier | null> {
    const data = await getJson<any>("/api/v1/customer/referral/tier", true);
    if (!data) return null;
    return {
      tierName: data.tierName,
      minLifetimePoints: Number(data.minLifetimePoints ?? 0),
      discountPercent: Number(data.discountPercent ?? 0),
      perkDescription: data.perkDescription,
    };
  },
};

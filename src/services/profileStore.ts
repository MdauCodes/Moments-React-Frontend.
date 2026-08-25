// ----------------------------------------------------------------------------
// Customer profile + addresses — mock-live hybrid.
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch, getAccessToken } from "@/contexts/AuthContext";

export interface CustomerAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  city: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
}

const PROFILE_KEY = "mpk_profile_v1";

function read(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as CustomerProfile) : null;
  } catch {
    return null;
  }
}

function write(p: CustomerProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function blank(): CustomerProfile {
  return { firstName: "", lastName: "", email: "", phone: "", addresses: [] };
}

async function tryLive<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await authFetch(apiUrl(path), init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

export const profileStore = {
  async get(): Promise<{ profile: CustomerProfile; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLive<CustomerProfile>("/api/v1/customer/profile");
      if (live) {
        live.addresses = live.addresses ?? [];
        write(live);
        return { profile: live, source: "live" };
      }
    }
    const local = read();
    if (local) local.addresses = local.addresses ?? [];
    return { profile: local ?? blank(), source: "mock" };
  },

  /**
   * Name edits don't apply directly — PATCH /api/v1/customer/profile queues them for admin
   * approval (ODPC / Data Protection Act, 2019 alignment) and returns just a confirmation
   * message, not the updated profile. So the locally-held `profile` is NOT replaced with the
   * submitted values here; it keeps showing what's actually saved until an admin approves the
   * change. Email isn't part of the queued-edit DTO at all (account-identity field, not a casual
   * profile edit) — never sent. Phone isn't sent here either — see updatePhone(), which applies
   * immediately since it's a low-fraud-risk convenience field, not something worth gating.
   */
  async save(profile: CustomerProfile): Promise<{ submitted: boolean; message: string }> {
    if (!getAccessToken()) {
      throw new Error("Sign in to update your profile.");
    }
    const res = await authFetch(apiUrl("/api/v1/customer/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string });
      throw new Error((err as any).message ?? "Failed to submit profile update.");
    }
    const data = (await res.json()) as { message: string };
    return { submitted: true, message: data.message };
  },

  /** Applies immediately, no admin review — see CustomerController.updatePhone on the backend. */
  async updatePhone(phone: string): Promise<CustomerProfile> {
    if (!getAccessToken()) {
      throw new Error("Sign in to update your phone number.");
    }
    const res = await authFetch(apiUrl("/api/v1/customer/phone"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string });
      throw new Error((err as any).message ?? "Failed to update phone number.");
    }
    const live = (await res.json()) as CustomerProfile;
    const { profile: current } = await this.get();
    const merged: CustomerProfile = { ...current, phone: live.phone, addresses: current.addresses };
    write(merged);
    return merged;
  },

  // Addresses have no backend persistence today (no address endpoint exists server-side) —
  // these three are, and always were, purely a local cache. They no longer round-trip through
  // save()'s network call now that save() is PATCH-based and its DTO doesn't carry addresses at
  // all — writing straight to the local cache is what was actually happening for addresses
  // either way, just without a pointless network call in front of it.
  async addAddress(addr: Omit<CustomerAddress, "id">): Promise<CustomerProfile> {
    const { profile } = await this.get();
    const newAddr: CustomerAddress = { ...addr, id: genId() };
    if (newAddr.isDefault) profile.addresses.forEach((a) => (a.isDefault = false));
    if (profile.addresses.length === 0) newAddr.isDefault = true;
    profile.addresses.push(newAddr);
    write(profile);
    return profile;
  },

  async removeAddress(id: string): Promise<CustomerProfile> {
    const { profile } = await this.get();
    profile.addresses = profile.addresses.filter((a) => a.id !== id);
    if (profile.addresses.length > 0 && !profile.addresses.some((a) => a.isDefault)) {
      profile.addresses[0].isDefault = true;
    }
    write(profile);
    return profile;
  },

  async setDefault(id: string): Promise<CustomerProfile> {
    const { profile } = await this.get();
    profile.addresses.forEach((a) => (a.isDefault = a.id === id));
    write(profile);
    return profile;
  },
};

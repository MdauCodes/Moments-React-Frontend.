import { DEFAULT_ADDRESSES, isStaffMode, type StaffAddresses } from "@/lib/staffLink";

const env = import.meta.env;

export const STAFF_ADDRESSES: StaffAddresses = {
  crmUrl: (env.VITE_CRM_URL as string | undefined) || DEFAULT_ADDRESSES.crmUrl,
  shopUrl: (env.VITE_SHOP_URL as string | undefined) || DEFAULT_ADDRESSES.shopUrl,
  staffUrl: (env.VITE_STAFF_URL as string | undefined) || DEFAULT_ADDRESSES.staffUrl,
};

export const CORE_API_URL: string =
  (env.VITE_CORE_API_URL as string | undefined) || "https://core.momentspackaging.com";

export function inStaffMode(): boolean {
  if (typeof window === "undefined") return false;
  return isStaffMode(window.location.hostname, env.VITE_APP_MODE as string | undefined);
}

/** "Switch app": the staff site's chooser. */
export function staffChooseUrl(): string {
  return `${STAFF_ADDRESSES.staffUrl.replace(/[/]+$/, "")}/choose`;
}

import { useEffect } from "react";
import { StaffOverlay } from "@/components/StaffOverlay";
import { STAFF_ADDRESSES } from "@/config/staff";
import { STAFF_LINK_USED_KEY, staffLinkUrl } from "@/lib/staffLink";

export function hasUsedStaffLink(): boolean {
  try {
    return window.localStorage.getItem(STAFF_LINK_USED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Where a signed-out staff person goes: the staff link, carrying the page they wanted. */
export function staffLinkFor(wantedPath?: string): string {
  return staffLinkUrl(STAFF_ADDRESSES.staffUrl, window.location.origin, wantedPath);
}

/**
 * Replaces the old staff sign-in forms: a returning staff-link user is sent to the staff site (with
 * the page they wanted in `next`); anyone else sees the staff overlay.
 */
export function StaffLinkGate({ wantedPath }: { wantedPath?: string }) {
  const returning = hasUsedStaffLink();
  useEffect(() => {
    if (returning) window.location.replace(staffLinkFor(wantedPath));
  }, [returning, wantedPath]);
  if (returning)
    return (
      <p role="status" className="p-6 text-sm">
        Taking you to the staff sign-in…
      </p>
    );
  return <StaffOverlay />;
}

import { useEffect } from "react";
import { STAFF_ADDRESSES } from "@/config/staff";
import { STAFF_LINK_USED_KEY, STAFF_REDIRECT_TEXT, staffLinkUrl } from "@/lib/staffLink";

export function hasUsedStaffLink(): boolean {
  try {
    return window.localStorage.getItem(STAFF_LINK_USED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Where a staff person goes: the staff sign-in, carrying the page they wanted (default /admin). */
export function staffLinkFor(wantedPath: string = "/admin"): string {
  return staffLinkUrl(STAFF_ADDRESSES.staffUrl, window.location.origin, wantedPath);
}

/** Send the browser to the staff sign-in straight away. */
export function redirectToStaffSignIn(wantedPath?: string): void {
  window.location.replace(staffLinkFor(wantedPath));
}

/** /login and /admin/login: no form, no overlay; an immediate redirect to the staff sign-in. */
export function StaffLinkGate({ wantedPath }: { wantedPath?: string }) {
  useEffect(() => {
    redirectToStaffSignIn(wantedPath);
  }, [wantedPath]);
  return (
    <p role="status" className="p-6 text-sm">
      {STAFF_REDIRECT_TEXT}
    </p>
  );
}

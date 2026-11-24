import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STAFF_ADDRESSES } from "@/config/staff";
import { STAFF_LINK_USED_KEY, parseCallbackHash, safeAdminNext } from "@/lib/staffLink";
import { redeemAdminHandoff } from "@/services/adminApi";

/** /admin/auth/callback#code=...&next=/admin/...: swaps the staff-site code for the store admin session. */
export default function AdminAuthCallbackPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; a code works once
    started.current = true;
    const { code, next } = parseCallbackHash(window.location.hash);
    // Take the code out of the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setFailed(true);
      return;
    }
    redeemAdminHandoff(code)
      .then(() => {
        try {
          window.localStorage.setItem(STAFF_LINK_USED_KEY, "1");
        } catch {
          /* storage blocked: still signed in for this tab */
        }
        navigate(safeAdminNext(next), { replace: true });
      })
      .catch(() => setFailed(true));
  }, [navigate]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        {failed ? (
          <>
            <h1 role="alert" className="font-display text-2xl">
              This sign-in link has expired
            </h1>
            <a
              href={`${STAFF_ADDRESSES.staffUrl.replace(/\/+$/, "")}/`}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to the staff site
            </a>
          </>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Signing you in…
          </p>
        )}
      </div>
    </main>
  );
}

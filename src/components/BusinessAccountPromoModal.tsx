import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Briefcase, X, TicketPercent, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { businessAccountApi } from "@/services/businessAccountApi";

// Shown once per browser session, a few seconds after the homepage loads —
// long enough to clear the branded splash, short enough to still read as
// "on load" rather than an exit-intent trigger (that's EmailInsiderPrompt's
// job). Dismissing (either button) lets the visitor keep browsing/buying as
// a guest — a Business Account is opt-in, never a gate.
const STORAGE_KEY = "moments_biz_promo_shown";
const SHOW_DELAY_MS = 3600;

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function BusinessAccountPromoModal() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldShow()) return;
    let cancelled = false;

    async function maybeShow() {
      // Signed-in visitors who already have a Business Account get nothing
      // to gain from this — skip it for them without blocking guests/new
      // sign-ups on the same check.
      if (isAuthenticated) {
        const existing = await businessAccountApi.getMine().catch(() => null);
        if (existing) {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          return;
        }
      }
      if (!cancelled) setOpen(true);
    }

    const t = setTimeout(() => void maybeShow(), SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAuthenticated]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="biz-promo-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-accent/15 via-accent/5 to-transparent px-6 pb-4 pt-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent">
            <Briefcase className="h-5 w-5" />
          </span>
          <p id="biz-promo-title" className="mt-3 font-display text-xl text-foreground">
            Ordering for your business?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a free Business Account — takes about a minute, no approval needed.
          </p>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="flex items-start gap-2.5 text-sm">
            <TicketPercent className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>A one-time welcome discount code on your first order.</p>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>A recognized order history tied to your business, not just your name.</p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Trade credit accounts aren&apos;t live yet — they&apos;re rolling out soon. A Business Account today is
              the starting point for that, once it launches.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-6 py-4">
          <Link
            to="/business-account"
            onClick={dismiss}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Get a free Business Account
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            No thanks, just browsing
          </button>
        </div>
      </div>
    </div>
  );
}

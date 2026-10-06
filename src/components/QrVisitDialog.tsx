import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, Star } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GOOGLE_REVIEW_URL } from "@/lib/businessLinks";

/**
 * The window a customer lands on after scanning our printed QR code (shop counter, order inserts).
 * The code points at the homepage with `?qr=1` plus ordinary utm tags, for example
 *   https://momentspackaging.com/?qr=1&utm_source=qr&utm_medium=print&utm_campaign=counter
 * The utm tags are picked up by MarketingAttributionCapture as usual, so visits and any order that
 * follows are credited to the QR code; `qr` itself only means "open this window".
 *
 * It offers the two things we want from that customer: shop online, or leave a Google review. It is a
 * normal dialog, so the engagement gate (EngagementPrompts) never opens the welcome offer on top of
 * it. It waits for the brand splash to finish rather than opening underneath it, and it is never
 * shown in staff, cart or checkout areas. The flag is removed from the address once it has been
 * dealt with, so a refresh does not show it again; the utm tags stay.
 */

const SKIP_PREFIXES = ["/admin", "/staff", "/cart", "/checkout", "/login"];
const SPLASH_SELECTOR = '[data-mpk-overlay="splash"]';
const SPLASH_WAIT_MS = 8000;
const POLL_MS = 250;

export function QrVisitDialog() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const flagged = new URLSearchParams(search).has("qr");
  const allowedHere = !SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const shouldOpen = flagged && allowedHere;

  useEffect(() => {
    if (!shouldOpen) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const splashShowing = document.querySelector(SPLASH_SELECTOR) !== null;
      if (!splashShowing || Date.now() - startedAt > SPLASH_WAIT_MS) {
        window.clearInterval(timer);
        setOpen(true);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldOpen]);

  function close() {
    setOpen(false);
    const params = new URLSearchParams(search);
    params.delete("qr");
    const rest = params.toString();
    navigate({ pathname, search: rest ? `?${rest}` : "" }, { replace: true });
  }

  function shop() {
    setOpen(false);
    navigate("/products");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-background p-6 sm:p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl font-medium text-foreground">
            Welcome to Moments Packaging
          </DialogTitle>
          <DialogDescription>
            Thank you for stopping by. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <button
            type="button"
            onClick={shop}
            className="flex w-full items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ShoppingBag className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-base font-medium">Shop online</span>
              <span className="block text-sm opacity-80">Packaging delivered across Kenya</span>
            </span>
          </button>

          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left text-foreground transition-colors hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Star className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <span>
              <span className="block text-base font-medium">Leave us a Google review</span>
              <span className="block text-sm text-muted-foreground">
                It takes a minute and helps other businesses find us
              </span>
            </span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

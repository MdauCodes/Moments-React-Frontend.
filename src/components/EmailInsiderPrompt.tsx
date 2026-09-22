import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Gift, Bell, Tag } from "lucide-react";
import { apiUrl } from "@/config/api";
import { markEmailPromptResolved } from "@/components/engagement/promptEligibility";

/**
 * Insider-led email capture.
 *
 * It no longer decides when to appear. It used to arm three triggers of its own — desktop exit
 * intent, 50% scroll depth, and a 30-second idle timer — the first of which won. Scroll depth in
 * particular meant a first-time visitor got this modal simply for reading down the homepage,
 * which is the one behaviour the page is asking for. All three are gone; the engagement gate
 * (components/engagement/EngagementPrompts.tsx) decides, and this component just renders when
 * mounted and reports the outcome.
 *
 * (Removed along with them: a `persona !== null` precondition inherited from a PersonaGate
 * component that is no longer mounted anywhere in the app. Because `persona` is only ever
 * non-null for someone carrying a `moments_persona` value in localStorage from an older build,
 * that condition had quietly made this prompt unreachable for every genuinely new visitor while
 * still firing for a long tail of returning ones — unpredictable in exactly the way a prompt
 * policy must not be.)
 *
 * Presentation is deliberately asymmetric with the welcome offer: a bottom sheet on phones and a
 * centered card on desktop, always with a visible ×, Escape and a backdrop click. That one is a
 * proposition worth a full stop; this is a newsletter ask, and a newsletter ask should never be
 * something a visitor has to work to get out of.
 *
 * Merge note: an earlier fix on main gave this component a 10-minute minimum time-on-site and a
 * checkout/cart skip list of its own. Neither is lost — the gate enforces both, and more strictly:
 * it measures *visible-tab* time rather than wall-clock (a tab left open in the background is not
 * a visitor spending time here), and its route exclusions are a superset that also covers sign-in,
 * registration, order tracking and admin. The sampling below is what now makes this prompt rare.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailInsiderPrompt({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);

  const handleDismiss = () => {
    markEmailPromptResolved("dismissed");
    onClose();
  };

  useEffect(() => {
    restoreFocusToRef.current = document.activeElement as HTMLElement | null;
    // The close button, not the email field: focusing the input pops the software keyboard on a
    // phone the instant the sheet slides up, which turns a dismissible ask into a screenful.
    panelRef.current?.querySelector<HTMLButtonElement>("button[data-dismiss]")?.focus({ preventScroll: true });
    return () => restoreFocusToRef.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let the thank-you land, then get out of the way on its own.
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [submitted, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 255) {
      setError("Please enter a valid email address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await fetch(apiUrl("/api/v1/public/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "popup", trigger: "newsletter" }),
      });
      markEmailPromptResolved("submitted");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insider-prompt-title"
      aria-describedby="insider-prompt-desc"
      data-mpk-overlay="insider-email"
      onClick={handleDismiss}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 motion-reduce:animate-none sm:items-center sm:bg-black/60 sm:p-4 sm:backdrop-blur-md"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        /* Bottom sheet on phones, centered card from sm up. The sheet clears the fixed bottom
           nav (--bottom-nav-height, set by BottomNav itself) so the site's own tab bar is never
           the thing this covers. */
        className="relative w-full animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl sm:max-w-sm sm:rounded-2xl sm:zoom-in-95"
        style={{ marginBottom: "var(--bottom-nav-height, 0px)" }}
      >
        {/* Decorative gradient header */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-5 pb-3 pt-5">
          {/* Grab handle — the affordance a sheet is expected to have on a phone. */}
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/15 sm:hidden"
          />
          {/* Explicit close button, in addition to Escape and the backdrop click above */}
          <button
            type="button"
            data-dismiss
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Insiders only</p>
              <h2 id="insider-prompt-title" className="text-base font-semibold leading-tight">
                Be first in line.
              </h2>
            </div>
          </div>
        </div>

        <div className="px-5 pb-6 sm:pb-5">
          {submitted ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">You&apos;re on the insider list.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll send the good stuff straight to your inbox.
              </p>
            </div>
          ) : (
            <>
              <p id="insider-prompt-desc" className="text-sm text-muted-foreground">
                Drop your email and be first to know about{" "}
                <span className="font-medium text-foreground">new arrivals</span>,{" "}
                <span className="font-medium text-foreground">trending packs</span>, and{" "}
                <span className="font-medium text-foreground">exclusive goodies</span> made for you.
              </p>

              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  Early access to new drops
                </li>
                <li className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Insider-only deals &amp; bulk pricing
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Trends &amp; packaging tips, no spam
                </li>
              </ul>

              <form onSubmit={handleSubmit} className="mt-4 space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  aria-label="Email address"
                  maxLength={255}
                  disabled={loading}
                  autoComplete="email"
                  className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {error && <p className="px-1 text-[11px] text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-70"
                >
                  {loading ? "Adding you..." : "Count me in"}
                </button>
                <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">
                  By subscribing you agree we may email you offers and updates. Unsubscribe
                  anytime — see our{" "}
                  <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

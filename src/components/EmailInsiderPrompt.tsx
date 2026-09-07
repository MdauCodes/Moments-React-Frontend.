import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Gift, Bell, Tag } from "lucide-react";
import { usePersona } from "@/contexts/PersonaContext";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { apiUrl } from "@/config/api";

/**
 * Proactive insider-led email capture.
 *
 * Triggers (first one wins, per session):
 *   1. Exit intent (desktop): mouseleave at top of viewport
 *   2. Scroll depth: user scrolls past 50% of page
 *   3. Idle: 30 seconds with no interaction
 *
 * Centered overlay (not a bottom-right corner card) — that corner is SignUpFab's permanent home
 * now (see SiteLayout.tsx), and this prompt firing at the same time as that FAB (a guest idling
 * or scrolling is exactly SignUpFab's audience too) used to mean the two fighting for the same
 * few square inches. A centered modal can't collide with a fixed-position FAB anywhere on screen.
 *
 * Dismiss: × button, Escape, or the backdrop. No "No thanks" text link — the difference from
 * WelcomeStarterModal (no close affordance at all) is deliberate: that one gates a first-visit
 * welcome offer worth actually reading, this one is a lower-stakes newsletter ask that shouldn't
 * trap anyone who just wants back to what they were doing.
 */

const STORAGE_KEY = "moments_insider_prompt";
const LEAD_KEY = "mpk_lead";
const IDLE_MS = 30_000;
const SCROLL_THRESHOLD = 0.5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(LEAD_KEY)) return false;
    return window.sessionStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return true;
  }
}

export function EmailInsiderPrompt() {
  const { persona } = usePersona();
  const { emailCaptureEnabled } = useSiteConfig();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!emailCaptureEnabled) return;
    setEligible(shouldShow());
  }, [persona, emailCaptureEnabled]);

  useEffect(() => {
    if (!eligible || open || submitted) return;
    if (typeof window === "undefined") return;
    if (persona === null) return;

    const trigger = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      if (!shouldShow()) return;
      setOpen(true);
    };

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio >= SCROLL_THRESHOLD) trigger();
    };

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(trigger, IDLE_MS);
    };
    const activityEvents: (keyof WindowEventMap)[] = ["mousemove", "keydown", "touchstart", "scroll", "click"];

    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    activityEvents.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetIdle));
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [eligible, open, submitted, persona]);

  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => setOpen(false), 3500);
    return () => clearTimeout(t);
  }, [submitted]);

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  // Escape closes it, same as any other centered dialog on this site (WelcomeStarterModal
  // excepted, deliberately, per its own comment) — expected now that this is true modal chrome
  // with a backdrop, not a dismissible corner card.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!emailCaptureEnabled) return null;
  if (!open) return null;

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
      try {
        window.localStorage.setItem(LEAD_KEY, "1");
        window.sessionStorage.setItem(STORAGE_KEY, "submitted");
      } catch {
        // ignore
      }
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
      onClick={handleDismiss}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm animate-in zoom-in-95 duration-300 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        {/* Decorative gradient header */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-5 pb-3 pt-5">
          {/* Explicit close button, in addition to Escape and the backdrop click above */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Insiders only</p>
              <h3 id="insider-prompt-title" className="text-base font-semibold leading-tight">
                Wait — be first in line.
              </h3>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
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

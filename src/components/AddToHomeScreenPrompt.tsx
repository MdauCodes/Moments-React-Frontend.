import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useRevealAfterActiveMs } from "@/hooks/useEngagementClock";
import { A2HS_REVEAL_MS } from "@/lib/engagementSignals";

const DISMISS_KEY = "moments_a2hs_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Slim, dismissible "Add to Home Screen" bar — the "Download" item from the
 * client's site-IA sketch, reinterpreted as a PWA install prompt since this
 * is a web app, not a native app. Chrome/Android fires `beforeinstallprompt`
 * and we surface it directly; iOS Safari has no such event, so we show
 * manual instructions instead. Dismissal is remembered so it doesn't nag.
 *
 * Held back for the first stretch of a visit, like SignUpFab. This bar sits in normal flow at
 * the very top of the page, so on a phone it doesn't merely sit near the hero — it pushes the
 * hero, and with it the browse path, further down the first screen. On iOS it rendered
 * unconditionally on arrival. "Install our app" is a fair thing to ask someone who is getting
 * value out of the site; it is a strange first thing to say to a stranger.
 */
export function AddToHomeScreenPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const revealed = useRevealAfterActiveMs(A2HS_REVEAL_MS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS never fires beforeinstallprompt — show a manual hint instead.
    if (isIos) {
      setShowIosHint(true);
      setDismissed(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!revealed || dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="relative z-30 flex animate-in fade-in duration-500 motion-reduce:animate-none items-center justify-between gap-3 bg-primary px-4 py-2.5 text-primary-foreground md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        <p className="truncate text-xs">
          {showIosHint
            ? "Add to Home Screen: tap Share, then “Add to Home Screen”"
            : "Add Moments Packaging to your home screen for quicker access"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!showIosHint && (
          <button
            type="button"
            onClick={install}
            className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium hover:bg-primary-foreground/25"
          >
            Add
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

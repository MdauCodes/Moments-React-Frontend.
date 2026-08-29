import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { LaunchBanner } from "@/components/LaunchBanner";

const DISMISSED_KEY = "mpk_site_lock_dismissed";

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Full-site lock overlay — blurs and blocks all interactions across the app, with a way out:
 * "Continue to site" dismisses it for this browser tab's session (sessionStorage, not
 * localStorage — this is a pre-launch gate for anonymous visitors, so a permanent dismissal would
 * defeat its purpose on a return visit days later) and swaps in a persistent, non-dismissible
 * countdown banner instead — checkout stays fully explorable, payments just don't fire (see
 * SiteLockConfig.SITE_LOCK_ENABLED on the backend, which is the actual enforcement).
 * Exempts /admin/* routes so staff can keep working while customers see either the overlay or
 * the banner.
 */
export function SiteLockOverlay() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  if (dismissed) {
    return <LaunchBanner />;
  }

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked (private mode, disabled) — still dismiss for this render, just won't
      // persist across a navigation/reload.
    }
    setDismissed(true);
  }

  return (
    <div
      aria-hidden="false"
      role="dialog"
      aria-label="Site under preparation"
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{
        backdropFilter: "blur(14px) saturate(120%)",
        WebkitBackdropFilter: "blur(14px) saturate(120%)",
        backgroundColor: "oklch(0.18 0.02 60 / 0.45)",
      }}
    >
      <div
        className="mx-4 max-w-md rounded-2xl border px-8 py-10 text-center shadow-2xl"
        style={{
          backgroundColor: "var(--cream)",
          borderColor: "color-mix(in oklab, var(--kraft) 35%, transparent)",
          color: "var(--ink)",
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{ color: "var(--forest)" }}
        >
          Moments Packaging
        </p>
        <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
          We're putting on the finishing touches.
        </h1>
        <p className="mt-4 text-sm" style={{ color: "color-mix(in oklab, var(--ink) 70%, transparent)" }}>
          Our new storefront is almost ready. Please check back shortly — for
          urgent enquiries, reach us on{" "}
          <a
            href="https://wa.me/254119556688"
            className="underline underline-offset-2"
            style={{ color: "var(--forest)" }}
          >
            WhatsApp
          </a>
          .
        </p>
        <LaunchCountdown />
        <button
          type="button"
          onClick={dismiss}
          className="mt-7 inline-flex items-center justify-center rounded-full border px-5 py-2 text-xs font-semibold transition-colors hover:bg-black/5"
          style={{ borderColor: "color-mix(in oklab, var(--kraft) 45%, transparent)", color: "var(--forest)" }}
        >
          Continue to site
        </button>
        <p className="mt-2 text-[11px]" style={{ color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}>
          You can look around and try checkout — payments won't charge you until launch.
        </p>
      </div>
    </div>
  );
}

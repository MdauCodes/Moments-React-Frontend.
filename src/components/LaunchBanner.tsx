import { useLayoutEffect, useRef } from "react";
import { LaunchCountdown } from "@/components/LaunchCountdown";

/** Set on <html> so any component (SiteHeader's sticky offset, the checkout modal's own
 *  padding) can read the banner's real, responsive height instead of guessing a fixed number —
 *  it wraps to two lines on narrow viewports, so a hardcoded height would be wrong at some
 *  breakpoint. Falls back to 0px via `var(--launch-banner-h, 0px)` wherever it's read, so nothing
 *  breaks if this component isn't mounted (post-launch, or on /admin routes). */
const BANNER_HEIGHT_VAR = "--launch-banner-h";

/**
 * Persistent, non-dismissible top bar shown for the entire pre-launch window (see
 * SiteLockOverlay — this replaced its old full-screen blocking modal entirely). Deliberately has
 * no close button: this is meant to stay visible as a constant reminder that the site (and
 * checkout) aren't fully live yet, for the whole visit.
 */
export function LaunchBanner() {
  const ref = useRef<HTMLDivElement>(null);

  // Being `fixed`, this banner is removed from document flow — without this, it simply overlaps
  // whatever's underneath (the site header, the checkout modal's own header) rather than pushing
  // it down, since nothing else on the page knows this banner exists.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${el.getBoundingClientRect().height}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      document.documentElement.style.removeProperty(BANNER_HEIGHT_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 top-0 z-[250] flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-center shadow-md"
      style={{
        backgroundColor: "var(--cream)",
        borderBottom: "1px solid color-mix(in oklab, var(--kraft) 35%, transparent)",
        color: "var(--ink)",
      }}
    >
      <p className="text-xs font-semibold sm:text-sm">
        <span style={{ color: "var(--forest)" }}>Moments Packaging</span> is putting on the
        finishing touches — checkout won't charge you until launch.
      </p>
      <LaunchCountdown />
      <a
        href="https://wa.me/254119556688"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#25D366" }}
      >
        WhatsApp us
      </a>
    </div>
  );
}

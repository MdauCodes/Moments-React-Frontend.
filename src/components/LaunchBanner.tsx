import { LaunchCountdown } from "@/components/LaunchCountdown";

/**
 * Persistent, non-dismissible top bar shown for the entire pre-launch window (see
 * SiteLockOverlay — this replaced its old full-screen blocking modal entirely). Deliberately has
 * no close button: this is meant to stay visible as a constant reminder that the site (and
 * checkout) aren't fully live yet, for the whole visit.
 */
export function LaunchBanner() {
  return (
    <div
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

import { LaunchCountdown } from "@/components/LaunchCountdown";

/**
 * Persistent, non-dismissible top bar shown once a visitor has dismissed SiteLockOverlay's full
 * block for this browser session. Deliberately has no close button — unlike the overlay itself,
 * this is meant to stay visible for as long as the pre-launch lock is on, as a constant reminder
 * that the site (and checkout) aren't fully live yet.
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
      <LaunchCountdown compact />
    </div>
  );
}

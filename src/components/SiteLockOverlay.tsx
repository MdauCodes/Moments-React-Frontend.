import { useLocation } from "react-router-dom";

/**
 * Full-site lock overlay — blurs and blocks all interactions across the app.
 * Used while the site is being prepared for launch. Exempts /admin/* routes so
 * staff can keep working (product/catalog edits, etc.) while customers are locked out.
 */
export function SiteLockOverlay() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) {
    return null;
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
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDownCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
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
      </div>
    </div>
  );
}

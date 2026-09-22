import { useEffect, useState } from "react";
import momentsBrandLogo from "@/assets/moments_logo_without_background.png";

/**
 * Branded app splash — forest-green stage with the Moments logo revealed
 * through two unfolding flaps in the same forest theme.
 *
 * Shortened from 2.75s (+0.45s fade) to 1.1s (+0.4s fade). It is a full-screen, opaque cover
 * over the homepage, so every millisecond of it is a millisecond a first-time visitor cannot
 * browse — and the flap animation itself completes in 700ms, so the old timing was mostly the
 * finished logo sitting still, holding the page hostage. The brand moment survives; the wait
 * doesn't. `data-mpk-overlay` keeps the engagement gate from ever opening a prompt behind it.
 */
const FLAP_HOLD_MS = 1100;
const FADE_MS = 400;

export function AppSplash() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const openTimer = requestAnimationFrame(() => setOpen(true));
    const fadeTimer = setTimeout(() => setHidden(true), FLAP_HOLD_MS);
    const removeTimer = setTimeout(() => setRemoved(true), FLAP_HOLD_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(openTimer);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      aria-hidden="true"
      data-mpk-overlay="splash"
      className="fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-500 ease-out"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, var(--forest) 0%, color-mix(in oklab, var(--forest) 70%, black) 70%, #04130c 100%)",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      <style>{`
        .mpk-splash-stage { perspective: 900px; }
        .mpk-flap {
          position: absolute;
          inset: 0;
          width: 50%;
          background:
            linear-gradient(135deg,
              color-mix(in oklab, var(--forest) 78%, black) 0%,
              var(--forest) 50%,
              color-mix(in oklab, var(--forest) 78%, white 6%) 100%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          transition: transform 700ms cubic-bezier(0.7, 0, 0.2, 1);
          transform-origin: left center;
          will-change: transform;
        }
        .mpk-flap.right {
          left: 50%;
          transform-origin: right center;
        }
        .mpk-flap.left.is-open  { transform: rotateY(-105deg); }
        .mpk-flap.right.is-open { transform: rotateY(105deg); }
        .mpk-flap::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(0,0,0,0.35);
        }
        .mpk-flap.left::after  { right: 0; }
        .mpk-flap.right::after { left: 0; }
        .mpk-splash-content {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 400ms ease-out 280ms, transform 400ms ease-out 280ms;
        }
        .mpk-splash-content.is-open { opacity: 1; transform: translateY(0); }
      `}</style>

      <div className="mpk-splash-stage relative w-[min(460px,86vw)] aspect-[16/9] overflow-hidden rounded-md">
        <div className={`mpk-flap left ${open ? "is-open" : ""}`} />
        <div className={`mpk-flap right ${open ? "is-open" : ""}`} />

        <div
          className={`mpk-splash-content absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 ${open ? "is-open" : ""}`}
        >
          <img
            src={momentsBrandLogo}
            alt=""
            width={360}
            height={120}
            className="h-24 w-auto sm:h-28"
            draggable={false}
            style={{ filter: "drop-shadow(0 6px 22px rgba(0,0,0,0.5))" }}
          />
          <p
            style={{ color: "#e8c878" }}
            className="text-[10px] uppercase tracking-[0.28em] font-medium"
          >
            Premium Packaging · Nairobi
          </p>
        </div>
      </div>
    </div>
  );
}


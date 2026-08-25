import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ROLE_TOURS, markOnboardingDone, type TourStep } from "@/lib/onboardingTours";
import type { StaffRoleName } from "@/lib/roles";

interface OnboardingTourProps {
  role: StaffRoleName;
  userId: string;
  open: boolean;
  /** When provided, restrict tour to just these steps (used by "?+Shift" page tip). */
  stepFilter?: (step: TourStep) => boolean;
  onClose: (completed: boolean) => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string | null): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPos(rect: Rect | null, position: TourStep["position"], tipW = 320, tipH = 180) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 12;
  if (!rect || position === "center") {
    return { top: Math.max(20, vh / 2 - tipH / 2), left: Math.max(20, vw / 2 - tipW / 2) };
  }
  let top = rect.top + rect.height + m;
  let left = rect.left;
  switch (position) {
    case "top": top = rect.top - tipH - m; left = rect.left; break;
    case "left": top = rect.top; left = rect.left - tipW - m; break;
    case "right": top = rect.top; left = rect.left + rect.width + m; break;
    case "bottom":
    default: top = rect.top + rect.height + m; left = rect.left; break;
  }
  // clamp to viewport
  left = Math.max(12, Math.min(left, vw - tipW - 12));
  top = Math.max(12, Math.min(top, vh - tipH - 12));
  return { top, left };
}

export function OnboardingTour({ role, userId, open, stepFilter, onClose }: OnboardingTourProps) {
  const tour = ROLE_TOURS[role];
  const allSteps = useMemo(() => {
    if (!tour) return [] as TourStep[];
    return stepFilter ? tour.steps.filter(stepFilter) : tour.steps;
  }, [tour, stepFilter]);

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [, setTick] = useState(0);
  const [done, setDone] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  // reset when reopening
  useEffect(() => {
    if (open) { setIdx(0); setDone(false); }
  }, [open]);

  const step: TourStep | undefined = allSteps[idx];

  // Track target rect (poll briefly for elements that mount async)
  useEffect(() => {
    if (!open || !step || done) return;
    let raf = 0;
    let tries = 0;
    const tick = () => {
      const r = getRect(step.targetSelector);
      setRect(r);
      tries++;
      if (!r && tries < 30) raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, step, done]);

  // Scroll target into view
  useEffect(() => {
    if (!open || !step?.targetSelector) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, step]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
      else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, done, allSteps.length]);

  if (!open || !tour || allSteps.length === 0) return null;

  const finish = (completed: boolean) => {
    // Any real dismissal — skip, Escape, backdrop click, or actually finishing — should stop the
    // tour from auto-launching again, not just close this one mount. Previously only `completed`
    // marked it done, so "Skip tour" (finish(false)) never persisted anything: the very next admin
    // page navigation remounted AdminLayout, isOnboardingDone was still false, and the tour
    // auto-launched again from step 1 — indistinguishable from never having been dismissed at all.
    // stepFilter still excluded: that's the "?"-triggered single-page replay, not a real tour run.
    if (!stepFilter) markOnboardingDone(userId);
    onClose(completed);
  };

  const next = () => {
    if (done) { finish(true); return; }
    if (idx >= allSteps.length - 1) {
      if (stepFilter) { finish(true); return; } // no final modal for single-page tip
      setDone(true);
    } else {
      setIdx((i) => i + 1);
    }
  };
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  const pos = tooltipPos(rect, step?.position);
  const pad = 6;

  // Final "You're all set!" modal
  if (done) {
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label="Onboarding complete" style={overlayStyle}>
        <div style={finalCardStyle}>
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: 22, color: "var(--admin-text)" }}>
            You're all set!
          </h2>
          <p style={{ margin: "0 0 6px", color: "var(--admin-text)", fontSize: 14, lineHeight: 1.5 }}>
            {tour.summary}
          </p>
          <p style={{ margin: "0 0 18px", color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Open the help panel anytime with the <strong>?</strong> button in the top right.
          </p>
          <button autoFocus type="button" className="admin-btn" onClick={() => finish(true)} style={primaryBtn}>
            Start working →
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Onboarding step ${idx + 1} of ${allSteps.length}`} style={overlayWrapStyle}>
      {/* Backdrop: SVG mask for a "hole" around the target */}
      <svg style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "auto" }} onClick={() => finish(false)}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={Math.max(0, rect.left - pad)}
                y={Math.max(0, rect.top - pad)}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tour-mask)" />
      </svg>

      {/* Glow ring around target */}
      {rect && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 10,
            boxShadow: "0 0 0 3px var(--admin-accent), 0 0 24px 4px color-mix(in oklab, var(--admin-accent) 50%, transparent)",
            pointerEvents: "none",
            transition: "all 180ms ease",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tipRef}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: 320,
          background: "var(--admin-surface, #fff)",
          color: "var(--admin-text)",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.45), 0 0 0 1px var(--admin-border)",
          fontFamily: "var(--font-sans)",
          zIndex: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Step {idx + 1} of {allSteps.length}
        </div>
        <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 17, color: "var(--admin-text)" }}>
          {step!.title}
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55, color: "var(--admin-text)" }}>
          {step!.body}
        </p>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {allSteps.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? "var(--admin-accent)" : "var(--admin-border)",
                transition: "width 180ms",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            onClick={() => finish(false)}
            style={{ background: "transparent", border: "none", color: "var(--admin-muted)", cursor: "pointer", fontSize: 12, padding: "6px 4px", textDecoration: "underline" }}
          >
            Skip tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {idx > 0 && (
              <button type="button" onClick={prev} style={ghostBtn}>← Back</button>
            )}
            <button autoFocus type="button" onClick={next} style={primaryBtn}>
              {idx >= allSteps.length - 1 ? (stepFilter ? "Done" : "Finish") : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const overlayWrapStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const finalCardStyle: React.CSSProperties = {
  background: "var(--admin-surface, #fff)",
  borderRadius: 14,
  padding: 28,
  maxWidth: 420,
  width: "100%",
  textAlign: "center",
  boxShadow: "0 25px 60px -10px rgba(0,0,0,0.5)",
  fontFamily: "var(--font-sans)",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--admin-accent)",
  color: "var(--cream, #fff)",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-display)",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
  color: "var(--admin-text)",
  fontFamily: "var(--font-display)",
};

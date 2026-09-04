import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { LAUNCH_AT } from "@/config/siteLock";

/**
 * Retired after the real launch (2026-09-04) — the ribbon-cut/confetti sequence and its
 * auto-redirect only make sense as a one-time pre-launch event. Kept in the codebase rather than
 * deleted in case a future re-launch, rebrand event, or similar TikTok-live moment wants it
 * again: flip this back to `true` (App.tsx reads it to decide whether to register the /launch
 * route at all) — no other code changes needed.
 */
export const LAUNCH_PAGE_ENABLED = false;

// How long to hold the "WE'RE LIVE" celebration + confetti before the ribbon-cut reveal starts.
const CELEBRATE_MS = 3200;
// How long the ribbon-cut wipe animation itself takes before navigating home.
const RIBBON_MS = 1900;

type Phase = "counting" | "imminent" | "celebrating" | "cutting";

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function getRemaining(): Remaining {
  const diff = Math.max(0, LAUNCH_AT - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    totalMs: diff,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** One big flipping digit-group (e.g. "04"). Each character re-mounts and slides up/in whenever
 *  the whole `value` string changes, giving a slot-machine tumble rather than an instant swap —
 *  legible from across a room / on a phone camera, which is the whole point of this page. */
function DigitGroup({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-3">
      <div
        className="relative flex overflow-hidden rounded-2xl px-2 py-3 sm:rounded-3xl sm:px-4 sm:py-6 md:px-6"
        style={{
          background: "linear-gradient(180deg, color-mix(in oklab, var(--cream) 14%, transparent), transparent)",
          boxShadow: "0 0 0 1px color-mix(in oklab, var(--kraft) 45%, transparent), 0 20px 60px -20px rgba(0,0,0,0.6)",
          // Every child below sizes itself in `em` off of this — keeps the flip-box and the glyph
          // it contains locked together at every breakpoint instead of drifting out of sync.
          fontSize: "clamp(2.25rem, 9vw, 5.5rem)",
        }}
      >
        {value.split("").map((char, i) => (
          <div key={i} className="relative h-[1.15em] w-[0.72em] overflow-hidden text-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={char}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-120%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="font-display absolute inset-0 flex items-center justify-center font-bold tabular-nums"
                style={{
                  fontSize: "1em",
                  color: "var(--cream)",
                  textShadow: "0 0 40px color-mix(in oklab, var(--kraft) 70%, transparent), 0 4px 0 rgba(0,0,0,0.35)",
                }}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </div>
        ))}
      </div>
      <span
        className="text-xs font-semibold uppercase tracking-[0.35em] sm:text-sm"
        style={{ color: "color-mix(in oklab, var(--cream) 65%, transparent)" }}
      >
        {label}
      </span>
    </div>
  );
}

function AnimatedBackground({ intensity }: { intensity: number }) {
  // Slow-drifting bokeh orbs, deterministic per-render so the layout doesn't jump on rerenders.
  const orbs = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      size: 80 + ((i * 37) % 180),
      left: (i * 53) % 100,
      top: (i * 29) % 100,
      delay: (i % 7) * 0.6,
      duration: 10 + (i % 5) * 3,
    })),
  ).current;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, color-mix(in oklab, var(--forest-bright) 45%, transparent), transparent 60%), radial-gradient(100% 80% at 50% 110%, color-mix(in oklab, var(--kraft) 30%, transparent), transparent 60%), var(--forest-deep)",
        }}
      />
      {orbs.map((o) => (
        <motion.div
          key={o.id}
          className="absolute rounded-full blur-2xl"
          style={{
            width: o.size,
            height: o.size,
            left: `${o.left}%`,
            top: `${o.top}%`,
            background: o.id % 2 === 0
              ? "color-mix(in oklab, var(--kraft) 55%, transparent)"
              : "color-mix(in oklab, var(--forest-bright) 55%, transparent)",
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.15, 0.4 + intensity * 0.3, 0.15],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: o.duration, delay: o.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Only mounted during the "cutting" phase. It appears already covering the full screen (a
 *  closed ribbon curtain) and immediately wipes apart in the same motion — the literal "cut the
 *  ribbon" launch moment — revealing the homepage underneath as it splits. Kept unmounted the
 *  rest of the time so it never obscures the countdown or celebration content beneath it. */
function RibbonCutOverlay() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/2"
        style={{ background: "linear-gradient(90deg, var(--kraft), color-mix(in oklab, var(--kraft) 60%, var(--forest-deep)))" }}
        initial={{ x: 0, rotate: 0 }}
        animate={{ x: "-105%", rotate: -3 }}
        transition={{ duration: RIBBON_MS / 1000, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1/2"
        style={{ background: "linear-gradient(270deg, var(--kraft), color-mix(in oklab, var(--kraft) 60%, var(--forest-deep)))" }}
        initial={{ x: 0, rotate: 0 }}
        animate={{ x: "105%", rotate: 3 }}
        transition={{ duration: RIBBON_MS / 1000, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 0.6, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-2xl sm:h-32 sm:w-32 sm:text-5xl"
          style={{ background: "var(--cream)", color: "var(--forest-deep)" }}
        >
          ✂️
        </div>
      </motion.div>
    </>
  );
}

export default function LaunchCountdownPage() {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState<Remaining>(getRemaining);
  const [phase, setPhase] = useState<Phase>("counting");
  const firedConfetti = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r.totalMs <= 0) {
        setPhase((p) => (p === "counting" || p === "imminent" ? "celebrating" : p));
      } else if (r.totalMs <= 10_000) {
        setPhase((p) => (p === "counting" ? "imminent" : p));
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "celebrating" || firedConfetti.current) return;
    firedConfetti.current = true;

    const colors = ["#c2650f", "#f4e8d0", "#2f5b3f", "#e8c07d"];
    const burst = () =>
      confetti({
        particleCount: 140,
        spread: 100,
        startVelocity: 55,
        origin: { y: 0.4 },
        colors,
        scalar: 1.1,
      });
    burst();
    timers.current.push(window.setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0 }, colors }), 300));
    timers.current.push(window.setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1 }, colors }), 300));
    timers.current.push(window.setTimeout(burst, 1000));
    timers.current.push(window.setTimeout(() => setPhase("cutting"), CELEBRATE_MS));

    return () => timers.current.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "cutting") return;
    const id = window.setTimeout(() => navigate("/", { replace: true }), RIBBON_MS);
    return () => clearTimeout(id);
  }, [phase, navigate]);

  const intensity = phase === "imminent" ? 0.6 : phase === "celebrating" ? 1 : 0.15;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <AnimatedBackground intensity={intensity} />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:gap-10">
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xs font-semibold uppercase tracking-[0.5em] sm:text-sm"
          style={{ color: "color-mix(in oklab, var(--kraft) 85%, var(--cream))" }}
        >
          Moments Packaging
        </motion.p>

        <AnimatePresence mode="wait">
          {phase !== "celebrating" && phase !== "cutting" ? (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.08 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-6 sm:gap-10"
            >
              <motion.h1
                animate={phase === "imminent" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.9, repeat: phase === "imminent" ? Infinity : 0 }}
                className="font-display text-2xl font-bold sm:text-4xl md:text-5xl"
                style={{ color: "var(--cream)" }}
              >
                We're launching in
              </motion.h1>

              <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-6 md:gap-10">
                <DigitGroup value={pad(remaining.days)} label="Days" />
                <DigitGroup value={pad(remaining.hours)} label="Hours" />
                <DigitGroup value={pad(remaining.minutes)} label="Minutes" />
                <DigitGroup value={pad(remaining.seconds)} label="Seconds" />
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="max-w-md text-sm sm:text-base"
                style={{ color: "color-mix(in oklab, var(--cream) 75%, transparent)" }}
              >
                Kenya's premium sustainable packaging, live in a moment. Stay tuned.
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex flex-col items-center gap-4 sm:gap-6"
            >
              <motion.h1
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="font-display text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl"
                style={{
                  color: "var(--cream)",
                  textShadow: "0 0 60px color-mix(in oklab, var(--kraft) 80%, transparent)",
                }}
              >
                WE'RE LIVE!
              </motion.h1>
              <p className="text-base font-semibold sm:text-xl" style={{ color: "var(--kraft)" }}>
                Moments Packaging has officially launched
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "cutting" && <RibbonCutOverlay />}

      {phase === "cutting" && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40"
          style={{ background: "var(--cream)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1] }}
          transition={{ duration: RIBBON_MS / 1000, times: [0, 0.7, 1] }}
        />
      )}
    </div>
  );
}

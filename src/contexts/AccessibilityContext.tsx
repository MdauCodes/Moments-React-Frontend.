import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface A11yPrefs {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableSpacing: boolean;
}

const STORAGE_KEY = "moments.a11yPrefs.v1";
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.5;
const FONT_SCALE_STEP = 0.125;

// Site loads at the smallest available size by default — visitors who want
// larger text can size up from here via the existing +/- controls, rather
// than the reverse (starting large, having to size down).
const DEFAULT_PREFS: A11yPrefs = {
  fontScale: FONT_SCALE_MIN,
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  readableSpacing: false,
};

function clampFontScale(n: unknown): number {
  const num = typeof n === "number" && Number.isFinite(n) ? n : DEFAULT_PREFS.fontScale;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, num));
}

function readPrefs(): A11yPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<A11yPrefs>;
    return {
      fontScale: clampFontScale(parsed.fontScale),
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
      underlineLinks: parsed.underlineLinks === true,
      readableSpacing: parsed.readableSpacing === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: A11yPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* noop */
  }
}

interface AccessibilityContextValue {
  prefs: A11yPrefs;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  toggleHighContrast: () => void;
  toggleReduceMotion: () => void;
  toggleUnderlineLinks: () => void;
  toggleReadableSpacing: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(() => readPrefs());

  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--a11y-font-scale", String(prefs.fontScale));
    html.classList.toggle("a11y-high-contrast", prefs.highContrast);
    html.classList.toggle("a11y-reduce-motion", prefs.reduceMotion);
    html.classList.toggle("a11y-underline-links", prefs.underlineLinks);
    html.classList.toggle("a11y-readable-spacing", prefs.readableSpacing);
    writePrefs(prefs);
  }, [prefs]);

  const increaseFontSize = () =>
    setPrefs((p) => ({ ...p, fontScale: clampFontScale(Math.round((p.fontScale + FONT_SCALE_STEP) * 1000) / 1000) }));
  const decreaseFontSize = () =>
    setPrefs((p) => ({ ...p, fontScale: clampFontScale(Math.round((p.fontScale - FONT_SCALE_STEP) * 1000) / 1000) }));
  const resetFontSize = () => setPrefs((p) => ({ ...p, fontScale: DEFAULT_PREFS.fontScale }));
  const toggleHighContrast = () => setPrefs((p) => ({ ...p, highContrast: !p.highContrast }));
  const toggleReduceMotion = () => setPrefs((p) => ({ ...p, reduceMotion: !p.reduceMotion }));
  const toggleUnderlineLinks = () => setPrefs((p) => ({ ...p, underlineLinks: !p.underlineLinks }));
  const toggleReadableSpacing = () => setPrefs((p) => ({ ...p, readableSpacing: !p.readableSpacing }));

  return (
    <AccessibilityContext.Provider
      value={{
        prefs,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        toggleHighContrast,
        toggleReduceMotion,
        toggleUnderlineLinks,
        toggleReadableSpacing,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within an AccessibilityProvider");
  return ctx;
}

export { FONT_SCALE_MIN, FONT_SCALE_MAX };

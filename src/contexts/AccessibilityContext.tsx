import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface A11yPrefs {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableSpacing: boolean;
  dyslexiaFont: boolean;
  hideImages: boolean;
  /** 0 = normal (no override), 1 = relaxed, 2 = loose. */
  lineHeightLevel: 0 | 1 | 2;
  forceLeftAlign: boolean;
  lowSaturation: boolean;
}

const STORAGE_KEY = "moments.a11yPrefs.v1";
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.5;
const FONT_SCALE_STEP = 0.125;
const LINE_HEIGHT_VALUES = [1.5, 1.8, 2.15] as const;
const DYSLEXIA_FONT_HREF = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible&display=swap";

// Site loads at the smallest available size by default — visitors who want
// larger text can size up from here via the existing +/- controls, rather
// than the reverse (starting large, having to size down).
const DEFAULT_PREFS: A11yPrefs = {
  fontScale: FONT_SCALE_MIN,
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  readableSpacing: false,
  dyslexiaFont: false,
  hideImages: false,
  lineHeightLevel: 0,
  forceLeftAlign: false,
  lowSaturation: false,
};

function clampFontScale(n: unknown): number {
  const num = typeof n === "number" && Number.isFinite(n) ? n : DEFAULT_PREFS.fontScale;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, num));
}

function clampLineHeightLevel(n: unknown): 0 | 1 | 2 {
  const num = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return (Math.min(2, Math.max(0, num)) as 0 | 1 | 2);
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
      dyslexiaFont: parsed.dyslexiaFont === true,
      hideImages: parsed.hideImages === true,
      lineHeightLevel: clampLineHeightLevel(parsed.lineHeightLevel),
      forceLeftAlign: parsed.forceLeftAlign === true,
      lowSaturation: parsed.lowSaturation === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// The dyslexia-friendly font is a real webfont — only fetched if a visitor
// actually turns the toggle on, so the other 99% of visitors never pay for it.
function ensureDyslexiaFontLoaded() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${DYSLEXIA_FONT_HREF}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = DYSLEXIA_FONT_HREF;
  document.head.appendChild(link);
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
  toggleDyslexiaFont: () => void;
  toggleHideImages: () => void;
  cycleLineHeight: () => void;
  toggleForceLeftAlign: () => void;
  toggleLowSaturation: () => void;
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
    html.classList.toggle("a11y-hide-images", prefs.hideImages);
    html.classList.toggle("a11y-force-left-align", prefs.forceLeftAlign);
    html.classList.toggle("a11y-low-saturation", prefs.lowSaturation);
    html.classList.toggle("a11y-line-height-boosted", prefs.lineHeightLevel > 0);
    html.style.setProperty("--a11y-line-height", String(LINE_HEIGHT_VALUES[prefs.lineHeightLevel]));
    if (prefs.dyslexiaFont) ensureDyslexiaFontLoaded();
    html.classList.toggle("a11y-dyslexia-font", prefs.dyslexiaFont);
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
  const toggleDyslexiaFont = () => setPrefs((p) => ({ ...p, dyslexiaFont: !p.dyslexiaFont }));
  const toggleHideImages = () => setPrefs((p) => ({ ...p, hideImages: !p.hideImages }));
  const cycleLineHeight = () => setPrefs((p) => ({ ...p, lineHeightLevel: clampLineHeightLevel((p.lineHeightLevel + 1) % 3) }));
  const toggleForceLeftAlign = () => setPrefs((p) => ({ ...p, forceLeftAlign: !p.forceLeftAlign }));
  const toggleLowSaturation = () => setPrefs((p) => ({ ...p, lowSaturation: !p.lowSaturation }));

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
        toggleDyslexiaFont,
        toggleHideImages,
        cycleLineHeight,
        toggleForceLeftAlign,
        toggleLowSaturation,
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

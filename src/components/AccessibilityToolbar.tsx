import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useAccessibility, FONT_SCALE_MIN, FONT_SCALE_MAX } from "@/contexts/AccessibilityContext";
import { ReadingMask } from "@/components/ReadingMask";

export function AccessibilityToolbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
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
    toggleReadingMask,
    toggleBigCursor,
  } = useAccessibility();

  const lineHeightLabel = ["Normal", "Relaxed", "Loose"][prefs.lineHeightLevel];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  // Sized generously on purpose — this panel is itself an accessibility
  // control, so its own text and touch targets shouldn't require the
  // visitor to already have working eyesight/dexterity to use it. Buttons
  // are ~48px tall to clear the WCAG 2.5.5 target-size guidance.
  const toggleCls = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-base font-medium transition-colors ${
      active
        ? "border-accent bg-accent/10 text-foreground"
        : "border-border bg-background text-foreground hover:bg-secondary"
    }`;

  return (
    <>
      <ReadingMask />
      {/* Moved from bottom-right to bottom-left to make room for SignUpFab (guests only), which
       *  now takes over bottom-right. Desktop uses bottom-28 (not WhatsAppFloat's bottom-6) to
       *  stack above WhatsAppFloat, which already occupies bottom-left there — both bottom-left
       *  FABs would otherwise overlap; mobile has no such conflict since WhatsAppFloat hides
       *  below md:. */}
      <div className="fixed bottom-20 left-4 z-50 md:bottom-28 md:left-6">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Accessibility options"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition-transform hover:scale-105 md:h-16 md:w-16"
      >
        <Accessibility className="h-5 w-5 md:h-7 md:w-7" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
          className="absolute bottom-full left-0 mb-3 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold text-foreground">Accessibility</p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close accessibility settings"
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Text size</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={prefs.fontScale <= FONT_SCALE_MIN}
                aria-label="Decrease text size"
                className="grid h-12 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetFontSize}
                aria-label="Reset text size"
                className="grid h-12 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={prefs.fontScale >= FONT_SCALE_MAX}
                aria-label="Increase text size"
                className="grid h-12 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <button type="button" onClick={toggleHighContrast} aria-pressed={prefs.highContrast} className={toggleCls(prefs.highContrast)}>
              High contrast
              <span className="text-sm font-semibold text-muted-foreground">{prefs.highContrast ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleReduceMotion} aria-pressed={prefs.reduceMotion} className={toggleCls(prefs.reduceMotion)}>
              Reduce motion
              <span className="text-sm font-semibold text-muted-foreground">{prefs.reduceMotion ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleUnderlineLinks} aria-pressed={prefs.underlineLinks} className={toggleCls(prefs.underlineLinks)}>
              Underline links
              <span className="text-sm font-semibold text-muted-foreground">{prefs.underlineLinks ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              onClick={toggleReadableSpacing}
              aria-pressed={prefs.readableSpacing}
              className={toggleCls(prefs.readableSpacing)}
            >
              Readable spacing
              <span className="text-sm font-semibold text-muted-foreground">{prefs.readableSpacing ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleDyslexiaFont} aria-pressed={prefs.dyslexiaFont} className={toggleCls(prefs.dyslexiaFont)}>
              Dyslexia-friendly font
              <span className="text-sm font-semibold text-muted-foreground">{prefs.dyslexiaFont ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleHideImages} aria-pressed={prefs.hideImages} className={toggleCls(prefs.hideImages)}>
              Hide images
              <span className="text-sm font-semibold text-muted-foreground">{prefs.hideImages ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              onClick={cycleLineHeight}
              aria-pressed={prefs.lineHeightLevel > 0}
              className={toggleCls(prefs.lineHeightLevel > 0)}
            >
              Line height
              <span className="text-sm font-semibold text-muted-foreground">{lineHeightLabel}</span>
            </button>
            <button
              type="button"
              onClick={toggleForceLeftAlign}
              aria-pressed={prefs.forceLeftAlign}
              className={toggleCls(prefs.forceLeftAlign)}
            >
              Left-align text
              <span className="text-sm font-semibold text-muted-foreground">{prefs.forceLeftAlign ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              onClick={toggleLowSaturation}
              aria-pressed={prefs.lowSaturation}
              className={toggleCls(prefs.lowSaturation)}
            >
              Low saturation
              <span className="text-sm font-semibold text-muted-foreground">{prefs.lowSaturation ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleReadingMask} aria-pressed={prefs.readingMask} className={toggleCls(prefs.readingMask)}>
              Reading mask
              <span className="text-sm font-semibold text-muted-foreground">{prefs.readingMask ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleBigCursor} aria-pressed={prefs.bigCursor} className={toggleCls(prefs.bigCursor)}>
              Big cursor
              <span className="text-sm font-semibold text-muted-foreground">{prefs.bigCursor ? "On" : "Off"}</span>
            </button>
          </div>

          <Link
            to="/accessibility-policy"
            onClick={() => setOpen(false)}
            className="mt-4 block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Read our Accessibility Policy
          </Link>
        </div>
      )}
      </div>
    </>
  );
}

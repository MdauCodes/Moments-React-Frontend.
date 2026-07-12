import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useAccessibility, FONT_SCALE_MIN, FONT_SCALE_MAX } from "@/contexts/AccessibilityContext";

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
  } = useAccessibility();

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

  const toggleCls = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
      active
        ? "border-accent bg-accent/10 text-foreground"
        : "border-border bg-background text-foreground hover:bg-secondary"
    }`;

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Accessibility options"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition-transform hover:scale-105"
      >
        <Accessibility className="h-5 w-5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
          className="absolute bottom-full right-0 mb-3 w-72 rounded-2xl border border-border bg-background p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold text-foreground">Accessibility</p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close accessibility settings"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Text size</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={prefs.fontScale <= FONT_SCALE_MIN}
                aria-label="Decrease text size"
                className="grid h-9 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetFontSize}
                aria-label="Reset text size"
                className="grid h-9 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={prefs.fontScale >= FONT_SCALE_MAX}
                aria-label="Increase text size"
                className="grid h-9 flex-1 place-items-center rounded-lg border border-border text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button type="button" onClick={toggleHighContrast} aria-pressed={prefs.highContrast} className={toggleCls(prefs.highContrast)}>
              High contrast
              <span className="text-xs text-muted-foreground">{prefs.highContrast ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleReduceMotion} aria-pressed={prefs.reduceMotion} className={toggleCls(prefs.reduceMotion)}>
              Reduce motion
              <span className="text-xs text-muted-foreground">{prefs.reduceMotion ? "On" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleUnderlineLinks} aria-pressed={prefs.underlineLinks} className={toggleCls(prefs.underlineLinks)}>
              Underline links
              <span className="text-xs text-muted-foreground">{prefs.underlineLinks ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              onClick={toggleReadableSpacing}
              aria-pressed={prefs.readableSpacing}
              className={toggleCls(prefs.readableSpacing)}
            >
              Readable spacing
              <span className="text-xs text-muted-foreground">{prefs.readableSpacing ? "On" : "Off"}</span>
            </button>
          </div>

          <Link
            to="/accessibility-policy"
            onClick={() => setOpen(false)}
            className="mt-3 block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Read our Accessibility Policy
          </Link>
        </div>
      )}
    </div>
  );
}

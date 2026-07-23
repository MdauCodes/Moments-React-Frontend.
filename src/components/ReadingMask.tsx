import { useEffect, useState } from "react";
import { useAccessibility } from "@/contexts/AccessibilityContext";

const BAND_HEIGHT = 90;

// Dims everything above and below a band that follows the cursor vertically,
// to help track a line of text — common in dyslexia/low-vision toolsets.
// The two dimming panels are pointer-events-none so clicks reach the page
// underneath unaffected.
export function ReadingMask() {
  const { prefs } = useAccessibility();
  const [y, setY] = useState<number | null>(null);

  useEffect(() => {
    if (!prefs.readingMask) {
      setY(null);
      return;
    }
    const handleMove = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [prefs.readingMask]);

  if (!prefs.readingMask || y === null) return null;

  const bandTop = Math.max(0, y - BAND_HEIGHT / 2);
  const bandBottom = y + BAND_HEIGHT / 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 bg-black/60" style={{ height: `${bandTop}px` }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/60" style={{ top: `${bandBottom}px` }} />
      <div
        className="absolute inset-x-0 border-y-2 border-primary/70"
        style={{ top: `${bandTop}px`, height: BAND_HEIGHT }}
      />
    </div>
  );
}

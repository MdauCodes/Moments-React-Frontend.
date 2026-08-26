import logoUrl from "@/assets/moments_logo_without_background.png";

// Source logo is 341x120px. This crops out just the sprouting leaf sitting above the
// recycling-circle "O" (the second character of "moments") — the leaf only, not the
// circle beneath it — exactly as it appears in the logo, rather than redrawing it, so
// it always matches the real mark pixel-for-pixel. Bounds found by scanning for
// leaf-green pixels (G channel well above both R and B, distinguishing it from both
// the dark-green wordmark and the gold recycling circle) against the live asset, then
// hand-verified against a zoomed render — not eyeballed.
const SOURCE_W = 341;
const SOURCE_H = 120;
const CROP = { left: 62, top: 6, width: 86, height: 40 };

/** The logo's sprouting-leaf glyph alone, cropped from the real logo file — used as a
 *  small symbolic mark wherever "Moments" is referenced.
 *
 *  `size` sets the rendered HEIGHT, not width — every call site uses this inline against
 *  text (`align-text-bottom`), where what actually needs to match is the line height, not
 *  a square footprint. The leaf's real shape is wide and short (86x40 in the source), so
 *  scaling by width would render it unexpectedly flat; width instead follows the leaf's
 *  own proportions from whatever height is requested. */
export function LogoLeafIcon({ size = 20, className }: { size?: number; className?: string }) {
  const scale = size / CROP.height;
  const bgWidth = SOURCE_W * scale;
  const bgHeight = SOURCE_H * scale;
  const bgPosX = -(CROP.left * scale);
  const bgPosY = -(CROP.top * scale);
  const displayWidth = CROP.width * scale;

  return (
    <span
      role="img"
      aria-label="Moments Packaging leaf mark"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: displayWidth,
        minWidth: displayWidth,
        height: size,
        backgroundImage: `url(${logoUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      }}
    />
  );
}

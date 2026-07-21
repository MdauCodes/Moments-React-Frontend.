import logoUrl from "@/assets/moments_logo_without_background.png";

// Source logo is 341x120px. This crops out just the sprouting-leaf-merged-with-"O"
// glyph (the second character of "moments") exactly as it appears in the logo,
// rather than redrawing it — so it always matches the real mark pixel-for-pixel.
// Coordinates found by pixel analysis (flood-fill from the recycling-circle glyph,
// cross-checked by RGB sampling against the neighbouring letters) against the live
// asset, not eyeballed — the glyph's true bounds are x:[76,146] y:[9,86].
const SOURCE_W = 341;
const SOURCE_H = 120;
const CROP = { left: 73, top: 7, width: 76, height: 82 };

/** The logo's sprouting-leaf + recycling-circle "O" glyph, cropped from the real
 *  logo file — used as a small symbolic mark wherever "Moments" is referenced. */
export function LogoLeafIcon({ size = 20, className }: { size?: number; className?: string }) {
  const scale = size / CROP.width;
  const bgWidth = SOURCE_W * scale;
  const bgHeight = SOURCE_H * scale;
  const bgPosX = -(CROP.left * scale);
  const bgPosY = -(CROP.top * scale);
  const displayHeight = CROP.height * scale;

  return (
    <span
      role="img"
      aria-label="Moments Packaging leaf mark"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        minWidth: size,
        height: displayHeight,
        backgroundImage: `url(${logoUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      }}
    />
  );
}

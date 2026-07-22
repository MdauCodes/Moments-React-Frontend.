// Validated against the admin panel's cream chart surface (~#fdfbf6) — see the
// dataviz skill's color-formula/palette references. Do not hand-pick new hexes
// here; if these ever need to change, re-run the validator against candidates.

export const CHART_SURFACE = "#fdfbf6";
export const CHART_GRID = "#e1e0d9";
export const CHART_AXIS = "#c3c2b7";
export const CHART_TEXT_SECONDARY = "#52514e";
export const CHART_TEXT_MUTED = "#898781";

/** Fixed scale, reserved meaning — never reused for a plain series ("series 4"). */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Fixed hue order — assign in sequence, never cycle or reorder per-chart. */
export const CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

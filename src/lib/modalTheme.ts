// Shared background for site-wide overlay modals (welcome starter modal, auth modal) —
// matches the cream hero section at the top of the products browsing page
// (products.index.tsx's "bg-cream" section) so switching between them feels like one
// consistent surface instead of every modal picking its own tint.
export const MODAL_BG = "var(--cream)";
export const MODAL_BORDER = "color-mix(in oklab, var(--cream) 80%, black 12%)";

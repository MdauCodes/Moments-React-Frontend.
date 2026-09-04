import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips supplier/brand-attribution sentences (e.g. "Supplied by Acme.")
 * that Riseller-synced product descriptions carry — customer-facing copy
 * shouldn't expose our upstream supplier names.
 */
export function sanitizeProductDescription(description?: string | null): string {
  if (!description) return "";
  return description
    .replace(/\s*Supplied by [^.]*\.\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

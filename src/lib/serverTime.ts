import { serverNow } from "@/services/adminApi";

/**
 * Time for the admin dashboard that never trusts the computer's clock or time zone (owner, 21 Oct 2026: a shop PC
 * 12 hours off broke sign-in renewal and showed the 5 pm reminder in the morning). "Now" is the server's time
 * (serverNow, learned from each sign-in token); days, hours and dates are Nairobi's, worked out by arithmetic
 * (Nairobi is UTC+3 all year), not from the computer's time-zone setting.
 */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export { serverNow };

/** The current year, month (0-11), day and hour in Nairobi. */
export function nairobiParts(ms: number = serverNow()): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const d = new Date(ms + NAIROBI_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
  };
}

/** Midnight in Nairobi at the start of that date (day may be out of range: 0 or negative steps back). */
export function nairobiMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - NAIROBI_OFFSET_MS);
}

/** "2026-10-21" for today in Nairobi, for file names. */
export function nairobiDateStamp(ms: number = serverNow()): string {
  return new Date(ms + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);
}

/** A readable Nairobi date and time, for reports sent to support. */
export function nairobiTimestamp(ms: number = serverNow()): string {
  return new Date(ms).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
}

/** Start of a "YYYY-MM-DD" date in Nairobi (as typed in a date field). */
export function nairobiStartOf(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return nairobiMidnight(y, m - 1, d);
}

/** The last second of a "YYYY-MM-DD" date in Nairobi. */
export function nairobiEndOf(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(nairobiMidnight(y, m - 1, d + 1).getTime() - 1000);
}

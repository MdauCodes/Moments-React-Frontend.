// Persists a referral code captured from a `?ref=` link across browsing, not just the exact page
// it was clicked on — the referral program's whole pitch ("browse and buy to get coupons
// together with the person that referred you") falls apart if the code is only honoured when
// registration happens to still have ?ref in the URL. Previously that WAS the only path
// (account.register.tsx read searchParams directly) — a referred visitor who browsed the
// catalogue first and registered later from a plain "Sign up" link lost the attribution entirely.

const STORAGE_KEY = "moments_referral_code";
const EXPIRY_DAYS = 30;

interface StoredReferral {
  code: string;
  capturedAt: number;
}

/** Called on every route change (see ReferralCapture) — a no-op unless the URL actually carries
 *  `?ref=`. Overwrites any previously stored code: the most recently clicked referral link wins,
 *  same "last touch" attribution convention most referral/affiliate programs use. */
export function captureReferralCode(ref: string | null): void {
  if (!ref) return;
  try {
    const record: StoredReferral = { code: ref, capturedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private browsing, quota full) — the ?ref param captured directly at
    // registration time (if still present in the URL then) still works as a fallback; this only
    // loses cross-page persistence for this one visitor's session.
  }
}

/** Read back a still-valid stored code, or undefined if there isn't one / it's expired. Expired
 *  entries are cleaned up on read rather than left to leak indefinitely in localStorage. */
export function getStoredReferralCode(): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const record = JSON.parse(raw) as StoredReferral;
    if (!record?.code) return undefined;
    const ageMs = Date.now() - record.capturedAt;
    if (ageMs > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return record.code;
  } catch {
    return undefined;
  }
}

/** Called once a registration actually uses the stored code — clears it so a second, unrelated
 *  account created later on the same device/browser never silently inherits the same referral. */
export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}

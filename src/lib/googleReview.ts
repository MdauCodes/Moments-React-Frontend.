export const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJUaca4EARLxgRwWPE9sEH2jg";

/** Copies the customer's words so they only have to paste on Google, then opens Google's review
 *  form in a small window over the site (Google blocks its page from being embedded in a frame,
 *  so a popup is the closest thing to staying on the site). Falls back to a new tab if the browser
 *  blocks the popup, and on phones the popup behaves as a tab the customer can swipe back from. */
export async function openGoogleReview(comment?: string): Promise<{ copied: boolean }> {
  let copied = false;
  const text = comment?.trim();
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      /* clipboard unavailable — the customer can still type their review on Google */
    }
  }
  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const popup = window.open(
    GOOGLE_REVIEW_URL,
    "momentsGoogleReview",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) window.open(GOOGLE_REVIEW_URL, "_blank", "noopener");
  return { copied };
}

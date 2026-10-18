import { useEffect, useState } from "react";

const POLL_MS = 500;
const GIVE_UP_MS = 60_000;

/** Anything else covering the page: Radix dialogs/sheets and our hand-rolled overlays (splash,
 *  welcome offer, post-order account prompt...). The cookie banner is left out on purpose: the
 *  pop-ups using this hook hold it back while they are open (holdCookieBanner) instead of waiting
 *  for an answer to it that may never come. Same probe as EngagementPrompts otherwise. */
function otherOverlayIsOpen(): boolean {
  return (
    document.querySelector(
      '[data-mpk-overlay]:not([data-mpk-overlay="cookie-consent"]), [aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

/**
 * For a one-off pop-up that must never land on top of another one: once `armed`, waits `delayMs`,
 * then returns true at the first moment nothing else covers the page. Gives up quietly after a
 * minute of something else being open, so the pop-up simply does not appear rather than
 * appearing long after the moment it belongs to.
 */
export function useOpenWhenClear(armed: boolean, delayMs: number): boolean {
  const [clear, setClear] = useState(false);

  useEffect(() => {
    if (!armed) {
      setClear(false);
      return;
    }
    let poll: number | undefined;
    const start = window.setTimeout(() => {
      const startedAt = Date.now();
      const check = () => {
        if (!otherOverlayIsOpen()) {
          window.clearInterval(poll);
          setClear(true);
        } else if (Date.now() - startedAt > GIVE_UP_MS) {
          window.clearInterval(poll);
        }
      };
      poll = window.setInterval(check, POLL_MS);
      check();
    }, delayMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(poll);
    };
  }, [armed, delayMs]);

  return clear;
}

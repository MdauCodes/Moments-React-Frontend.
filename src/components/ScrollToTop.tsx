import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router doesn't reset scroll position on navigation — without this,
 * clicking a link while scrolled down a long page (e.g. the shop grid)
 * lands you at the same scroll offset on the next page, which on a short
 * page like /privacy or /contact can put you right near the bottom.
 * Only fires on pathname changes, not on hash-only navigation, so in-page
 * anchors (legal page TOC, etc.) keep working normally.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

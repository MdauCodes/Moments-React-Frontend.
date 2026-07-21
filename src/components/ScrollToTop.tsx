import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router doesn't reset scroll position on navigation — without this,
 * clicking a link while scrolled down a long page (e.g. the shop grid)
 * lands you at the same scroll offset on the next page, which on a short
 * page like /privacy or /contact can put you right near the bottom.
 * Only fires on pathname changes, not on hash-only navigation, so in-page
 * anchors (legal page TOC, etc.) keep working normally.
 *
 * If the destination URL itself carries a hash (e.g. a "Learn more" link to
 * /account-options#business), client-side navigation doesn't get the
 * browser's native scroll-to-anchor behavior — so this scrolls to that
 * element instead of resetting to the top. Deferred a tick since the target
 * page's content may not have painted yet on the same render this runs in.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const t = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      }, 0);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

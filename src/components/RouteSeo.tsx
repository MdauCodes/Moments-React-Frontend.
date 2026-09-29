import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { STATIC_PAGES } from "@/seo/seoData";
import { applyDefaultHead, applyHead } from "@/hooks/useSeo";

declare global {
  interface Window {
    /** Set by the inline guard script in prerendered HTML when the file matches the URL. */
    __mpkPrerendered?: boolean;
  }
}

/**
 * Keeps <head> right across in-app navigation. On every pathname change it clears the previous
 * page's tags and applies this route's static copy (src/seo/seoData.js — the same copy baked into
 * the prerendered HTML) or the site defaults. Detail pages (products, blog posts) then set their
 * own via useSeo, whose passive effect always runs after this layout effect.
 *
 * On the very first render it leaves a prerendered head untouched — that HTML was built for
 * exactly this URL and already carries the right title, canonical and JSON-LD.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useLayoutEffect(() => {
    const isFirst = first.current;
    first.current = false;
    // The homepage is the exception: its prerendered HTML carries no canonical (that file is also
    // Render's fallback for unknown URLs — see renderPage in scripts/prerender-seo.mjs), so it gets
    // one here once the app has confirmed the URL really is "/".
    if (isFirst && window.__mpkPrerendered && pathname !== "/") return;

    document.head.querySelectorAll("script[data-prerender-ld]").forEach((n) => n.remove());
    const path = pathname.replace(/\/+$/, "") || "/";
    const page = (
      STATIC_PAGES as Record<string, { title: string; description: string } | undefined>
    )[path];
    if (page) applyHead({ title: page.title, description: page.description, path });
    else applyDefaultHead();
  }, [pathname]);

  return null;
}

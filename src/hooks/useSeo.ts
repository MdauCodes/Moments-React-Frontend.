import { useEffect } from "react";
import { DEFAULT_SEO, SITE_ORIGIN } from "@/seo/seoData";

const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;

export interface SeoOptions {
  title: string;
  description: string;
  /** Path only (e.g. "/products/kraft-bag"), joined with SITE_ORIGIN — never a full URL, so every
   *  call site can't accidentally point canonical/OG tags at the wrong host (staging vs prod). */
  path: string;
  /** Absolute image URL for OG/Twitter cards — falls back to the site-wide og-image.jpg when a
   *  page has nothing more specific (e.g. a product with no photo yet). */
  image?: string;
  /** Arbitrary JSON-LD object(s) — Product, Article/BlogPosting, FAQPage, BreadcrumbList, etc.
   *  Injected as an additional <script type="application/ld+json">, alongside (not replacing)
   *  the site-wide Organization block in index.html. */
  jsonLd?: object | object[];
  /** false = leave the head alone (e.g. while the product is still loading), so the prerendered
   *  tags stay in place instead of being overwritten with a "Loading…" placeholder. */
  enabled?: boolean;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Writes title/description/OG/Twitter/canonical in one go. `path: null` removes the canonical —
 * used for routes that shouldn't declare one (cart, account pages) or before a detail page has
 * loaded enough to know its own.
 */
export function applyHead({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string | null;
  image?: string;
}) {
  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("property", "og:image", image ?? DEFAULT_OG_IMAGE);
  setMeta("name", "twitter:image", image ?? DEFAULT_OG_IMAGE);
  setMeta("property", "og:url", `${SITE_ORIGIN}${path ?? "/"}`);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (path === null) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", `${SITE_ORIGIN}${path}`);
}

/** Resets the head to the site defaults — RouteSeo calls this on every in-app navigation. */
export function applyDefaultHead() {
  applyHead({ title: DEFAULT_SEO.title, description: DEFAULT_SEO.description, path: null });
}

/**
 * Per-page SEO for a detail page (product, blog post, FAQ). Route-level resets live in
 * RouteSeo.tsx, which runs on every navigation BEFORE this effect (layout effect vs passive
 * effect), so this hook only ever has to set its own values — it deliberately does not restore
 * the previous page's tags on unmount. (It used to, and that chained the wrong title forward:
 * land on a product, click to /cart, and the tab kept the product's name.)
 *
 * The build-time prerender (scripts/prerender-seo.mjs) writes the same values into each page's
 * raw HTML; product pages share their title/description logic via src/seo/seoData.js so the two
 * can never disagree.
 */
export function useSeo({ title, description, path, image, jsonLd, enabled = true }: SeoOptions) {
  useEffect(() => {
    if (!enabled) return;
    applyHead({ title, description, path, image });

    if (!jsonLd) return;
    // The prerendered copy of this page's schema is now superseded by the live one.
    document.head.querySelectorAll("script[data-prerender-ld]").forEach((n) => n.remove());
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.pageSeo = "true";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => script.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, title, description, path, image, JSON.stringify(jsonLd)]);
}

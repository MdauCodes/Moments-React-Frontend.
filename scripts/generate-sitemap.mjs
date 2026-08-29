#!/usr/bin/env node
// Regenerates public/sitemap.xml from the real product/blog catalog before every build.
//
// Why this exists: an SEO audit (2026-08-29) found the previous sitemap was a static,
// hand-written 12-URL file with ZERO product or category pages, and — worse — included pages
// that should never be indexed at all (/cart, /checkout, /login, /order-confirmation,
// /orders/track). Combined with product cards not being real crawlable <a href> links, Google
// had almost no path to any individual product page. This script fixes the sitemap half of that;
// ProductCard.tsx's Link fix fixes the crawlable-link half.
//
// INTENTIONALLY duplicates the API base URL rather than importing src/config/api.ts — matches
// that file's own "intentionally different per branch" convention, and a plain Node script can't
// import a .ts file without an extra build step. Keep this in sync with api.ts on this branch.
const API_BASE = "https://api-staging.momentspackaging.com";

// Sitemap URLs are always canonical production URLs regardless of which branch/backend this
// script pulls product data from — staging is never submitted to Search Console.
const SITE_ORIGIN = "https://momentspackaging.com";

const STATIC_PAGES = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/products", changefreq: "weekly", priority: "0.9" },
  { loc: "/company-profile", changefreq: "monthly", priority: "0.8" },
  { loc: "/industries", changefreq: "monthly", priority: "0.7" },
  { loc: "/sustainability", changefreq: "monthly", priority: "0.6" },
  { loc: "/contact", changefreq: "monthly", priority: "0.7" },
  { loc: "/enterprise-quote", changefreq: "monthly", priority: "0.6" },
  { loc: "/blog", changefreq: "weekly", priority: "0.6" },
  { loc: "/faq", changefreq: "monthly", priority: "0.5" },
  { loc: "/how-it-works", changefreq: "monthly", priority: "0.5" },
  { loc: "/payment-methods", changefreq: "monthly", priority: "0.4" },
  { loc: "/careers", changefreq: "monthly", priority: "0.4" },
  { loc: "/become-a-partner", changefreq: "monthly", priority: "0.4" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/refunds", changefreq: "yearly", priority: "0.3" },
  { loc: "/accessibility-policy", changefreq: "yearly", priority: "0.3" },
  { loc: "/rewards-terms", changefreq: "yearly", priority: "0.3" },
];

// Deliberately excluded, never add these back: /cart, /checkout, /login, /order-confirmation,
// /orders/track, /manage-my-data, /staff, /style-guide, /account-options and the account-type
// info pages — all either transactional/user-specific with no unique indexable content, or
// (for /staff, /style-guide) internal-only.

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAllProducts() {
  const urls = [];
  let page = 0;
  for (;;) {
    const res = await fetch(`${API_BASE}/api/v1/public/products?page=${page}&size=100`);
    if (!res.ok) throw new Error(`products page ${page} failed: ${res.status}`);
    const data = await res.json();
    for (const p of data.content ?? []) {
      // The public catalog has no "is this a real product" flag (checked Product.java — only
      // deleted/merchandising booleans exist) — at least one literal "TEST PRODUCT - Ksh 1 (A)"
      // is live in production right now, so filter obvious dev-test data out of the sitemap by
      // name/slug. This is a stopgap for the sitemap only; the underlying test product is still
      // live and purchasable on the real storefront — worth cleaning up separately in admin.
      const isObviousTestProduct = /test.product/i.test(p.slug ?? "") || /test product/i.test(p.name ?? "");
      if (p.slug && !isObviousTestProduct) {
        urls.push({ loc: `/products/${p.slug}`, lastmod: p.updatedAt, changefreq: "weekly", priority: "0.7" });
      }
    }
    if (data.last || !data.content?.length) break;
    page += 1;
  }
  return urls;
}

async function fetchAllBlogPosts() {
  const res = await fetch(`${API_BASE}/api/v1/public/blogs`);
  if (!res.ok) throw new Error(`blogs failed: ${res.status}`);
  const posts = await res.json();
  return (posts ?? [])
    .filter((b) => b.slug)
    .map((b) => ({
      loc: `/blog/${b.slug}`,
      lastmod: b.updatedAt ?? b.publishedAt,
      changefreq: "monthly",
      priority: "0.6",
    }));
}

function buildXml(urls) {
  const entries = urls
    .map((u) => {
      const lastmodTag = u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : "";
      return `  <url>
    <loc>${escapeXml(SITE_ORIGIN + u.loc)}</loc>${lastmodTag}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function main() {
  const { writeFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "sitemap.xml");

  let dynamicUrls = [];
  try {
    const [products, posts] = await Promise.all([fetchAllProducts(), fetchAllBlogPosts()]);
    dynamicUrls = [...products, ...posts];
  } catch (err) {
    // Never fail the whole build over a transient API hiccup — keep whatever sitemap.xml already
    // exists on disk (committed from the last successful run) rather than overwriting it with an
    // empty/partial one.
    console.warn(`[generate-sitemap] Couldn't fetch catalog (${err.message}) — leaving existing public/sitemap.xml untouched.`);
    return;
  }

  const xml = buildXml([...STATIC_PAGES, ...dynamicUrls]);
  await writeFile(outPath, xml, "utf8");
  console.log(`[generate-sitemap] Wrote ${STATIC_PAGES.length + dynamicUrls.length} URLs to public/sitemap.xml`);
}

main();

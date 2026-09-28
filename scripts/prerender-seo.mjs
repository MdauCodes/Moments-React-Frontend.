#!/usr/bin/env node
// Post-build step: turns the single client-rendered dist/index.html into one real HTML file per
// public URL (dist/products/<slug>/index.html, dist/contact/index.html, ...), each with its own
// <title>, meta description, canonical, Open Graph tags, JSON-LD and a plain-HTML body carrying the
// page's actual content (product name, price, pack sizes, stock, how to buy, related links).
//
// Why: before this, every URL on momentspackaging.com returned the SAME empty shell — identical
// title/description, an empty <div id="root">, and all content only appearing after JavaScript
// ran. Google renders JS late and inconsistently; Bing and the AI-assistant crawlers (ChatGPT's
// OAI-SearchBot, ClaudeBot, PerplexityBot) mostly don't run it at all. So 600+ product pages were,
// to them, one blank page repeated — the direct cause of Moments never being cited when shoppers
// ask an assistant where to buy packaging in Nairobi (2026-09-28 audit).
//
// How it stays honest: the prerendered block is the same facts the React page renders, it sits
// inside #root, and React's createRoot() replaces it the moment the app mounts — real visitors
// see the full app, crawlers that don't run JS see the same content in plain HTML. A tiny inline
// script removes the block (plus the canonical/JSON-LD) when dist/index.html is served as the
// SPA fallback for a URL it wasn't built for (/cart, a product added after the last deploy...).
//
// Data comes from the PRODUCTION backend, same as generate-sitemap.mjs. If the catalogue fetch
// fails, static pages are still prerendered and the build does NOT fail — an API hiccup must never
// block a deploy.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_ORIGIN,
  SITE_NAME,
  BUSINESS,
  STATIC_PAGES,
  productSeo,
  displayProductName,
  cleanProductDescription,
  formatKes,
  priceUnitLabel,
} from "../src/seo/seoData.js";

const API_BASE = "https://moments-packaging-latest-backend-production.up.railway.app";
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for inside <script> — escape "<" so a product description can never close the tag. */
function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function isObviousTestProduct(p) {
  return /test.product/i.test(p.slug ?? "") || /test product/i.test(p.name ?? "");
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchAllProducts() {
  const all = [];
  for (let page = 0; ; page += 1) {
    const data = await fetchJson(`${API_BASE}/api/v1/public/products?page=${page}&size=100`);
    all.push(...(data.content ?? []));
    if (data.last || !data.content?.length) break;
  }
  return all.filter((p) => p.slug && !isObviousTestProduct(p));
}

async function fetchBlogs() {
  const posts = await fetchJson(`${API_BASE}/api/v1/public/blogs`);
  // The public endpoint returns status "PUBLISHED"; compare case-insensitively.
  return (posts ?? []).filter(
    (b) => b.slug && (!b.status || String(b.status).toLowerCase() === "published"),
  );
}

function categoryOf(p) {
  return p.categoryName || p.category || "Packaging";
}

function availabilityText(p) {
  if (p.stockStatus === "OUT_OF_STOCK") return "Out of stock — ask us about restock dates";
  if (p.stockStatus === "LOW_STOCK") return "In stock — limited quantity";
  return "In stock";
}

function availabilitySchema(p) {
  return p.stockStatus === "OUT_OF_STOCK"
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
}

// ── shared page chrome (plain HTML, styled by the inline <style> below) ──────

const NAV_LINKS = [
  ["/products", "All products"],
  ["/industries", "Industries"],
  ["/contact", "Contact & visit"],
  ["/faq", "FAQ"],
];

function header() {
  return `<header class="mpk-pr-head"><a href="/" class="mpk-pr-brand">${esc(SITE_NAME)}</a><nav>${NAV_LINKS.map(
    ([href, label]) => `<a href="${href}">${esc(label)}</a>`,
  ).join("")}</nav></header>`;
}

function howToBuy() {
  return `<section><h2>How to buy</h2><ul>
<li><strong>Online:</strong> add to cart on this website and pay with M-Pesa. Same-day delivery within Nairobi for orders placed before the daily cutoff; countrywide delivery in about three business days.</li>
<li><strong>In store:</strong> ${esc(BUSINESS.streetAddress)}, ${esc(BUSINESS.locality)} — open ${esc(BUSINESS.hoursText)}.</li>
<li><strong>Ask first:</strong> call or WhatsApp <a href="tel:${BUSINESS.phoneIntl}">${esc(BUSINESS.phoneDisplay)}</a>, or email <a href="mailto:${BUSINESS.email}">${esc(BUSINESS.email)}</a>.</li>
</ul></section>`;
}

function footer() {
  return `<footer class="mpk-pr-foot"><p><strong>${esc(BUSINESS.legalName)}</strong> · ${esc(BUSINESS.streetAddress)}, ${esc(
    BUSINESS.locality,
  )} · <a href="tel:${BUSINESS.phoneIntl}">${esc(BUSINESS.phoneDisplay)}</a> · <a href="mailto:${BUSINESS.email}">${esc(
    BUSINESS.email,
  )}</a></p><p><a href="/company-profile">About us</a> · <a href="/payment-methods">Payment methods</a> · <a href="/how-it-works">How it works</a> · <a href="/refunds">Returns & refunds</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></footer>`;
}

function breadcrumbHtml(items) {
  return `<nav aria-label="Breadcrumb" class="mpk-pr-crumbs">${items
    .map(([href, label], i) =>
      i === items.length - 1 || !href
        ? `<span>${esc(label)}</span>`
        : `<a href="${href}">${esc(label)}</a>`,
    )
    .join(" / ")}</nav>`;
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([href, label], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: label,
      ...(href ? { item: `${SITE_ORIGIN}${href}` } : {}),
    })),
  };
}

function productLinkList(products) {
  return `<ul class="mpk-pr-list">${products
    .map((p) => {
      const price =
        p.basePrice != null ? ` — ${formatKes(p.basePrice)} per ${esc(priceUnitLabel(p))}` : "";
      return `<li><a href="/products/${esc(p.slug)}">${esc(displayProductName(p.name))}</a>${price}</li>`;
    })
    .join("")}</ul>`;
}

// Minimal, self-contained styling so a visitor on a slow connection who sees this block for a
// moment before the app mounts gets a readable page, not raw browser defaults on the dark shell.
const PRERENDER_STYLE = `<style id="mpk-pr-style">
#seo-prerender{background:#faf7f0;color:#1c2a22;font:16px/1.6 Inter,system-ui,sans-serif;min-height:100vh;padding:0 20px 40px}
#seo-prerender a{color:#2d5a3d}
#seo-prerender .mpk-pr-head{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;max-width:1080px;margin:0 auto;padding:18px 0;border-bottom:1px solid #e4dccb}
#seo-prerender .mpk-pr-brand{font-weight:700;text-decoration:none;font-size:18px}
#seo-prerender .mpk-pr-head nav{display:flex;flex-wrap:wrap;gap:16px;font-size:14px}
#seo-prerender main,#seo-prerender .mpk-pr-foot{max-width:1080px;margin:0 auto}
#seo-prerender h1{font:500 32px/1.2 Fraunces,Georgia,serif;margin:20px 0 12px}
#seo-prerender h2{font:500 22px/1.3 Fraunces,Georgia,serif;margin:28px 0 8px}
#seo-prerender img{max-width:min(100%,420px);height:auto;border-radius:12px;display:block;margin:12px 0}
#seo-prerender table{border-collapse:collapse;margin:8px 0}
#seo-prerender td,#seo-prerender th{border:1px solid #e4dccb;padding:6px 12px;text-align:left}
#seo-prerender .mpk-pr-price{font-size:22px;font-weight:600;margin:4px 0}
#seo-prerender .mpk-pr-crumbs{font-size:13px;margin-top:16px;color:#5b6b60}
#seo-prerender .mpk-pr-list{columns:2 280px;padding-left:18px}
#seo-prerender .mpk-pr-foot{border-top:1px solid #e4dccb;margin-top:40px;padding-top:16px;font-size:14px}
</style>`;

// Runs synchronously while the HTML parses, before the app bundle (a deferred module) executes.
// When this file is served for a URL other than the one it was built for (SPA fallback), strip
// the page-specific content + head tags so /cart never claims to be the homepage.
function guardScript() {
  return `<script>(function(){var e=document.getElementById("seo-prerender");if(!e)return;var p=location.pathname.replace(/\\/+$/,"")||"/";if(p===e.getAttribute("data-seo-path")){window.__mpkPrerendered=true;return}e.remove();var r=function(s){document.querySelectorAll(s).forEach(function(n){n.remove()})};r('link[rel="canonical"]');r("script[data-prerender-ld]");r("#mpk-pr-style")})();</script>`;
}

// ── head rewriting ───────────────────────────────────────────────────────────

function setMeta(html, attr, key, value) {
  const re = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="[^"]*"\\s*/?>`,
  );
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function renderPage(template, { urlPath, title, description, image, jsonLd = [], body }) {
  const canonical = `${SITE_ORIGIN}${urlPath === "/" ? "/" : urlPath}`;
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", canonical);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  if (image) {
    html = setMeta(html, "property", "og:image", image);
    html = setMeta(html, "name", "twitter:image", image);
  }
  const headExtra = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    ...jsonLd.map(
      (obj) =>
        `<script type="application/ld+json" data-prerender-ld>${jsonForScript(obj)}</script>`,
    ),
    PRERENDER_STYLE,
  ].join("\n    ");
  html = html.replace("</head>", `    ${headExtra}\n  </head>`);
  const block = `<div id="seo-prerender" data-seo-path="${esc(urlPath)}">${header()}<main>${body}</main>${footer()}</div>${guardScript()}`;
  if (!html.includes('<div id="root"></div>'))
    throw new Error('dist/index.html has no empty <div id="root"></div> to fill');
  return html.replace('<div id="root"></div>', `<div id="root">${block}</div>`);
}

// Each page is written twice — <path>/index.html AND <path>.html — because static hosts differ on
// how an extensionless URL like /contact maps to a file: some resolve the directory index, some
// the .html sibling, and a host that finds neither falls through to the SPA rewrite (serving the
// homepage HTML, which the guard script then strips). Both forms are tiny; writing both means
// the canonical, slash-free URL gets its real HTML whichever way the host resolves it.
async function writeRoute(urlPath, html) {
  if (urlPath === "/") {
    await writeFile(path.join(DIST, "index.html"), html, "utf8");
    return;
  }
  const segments = urlPath.split("/").filter(Boolean);
  const dirIndex = path.join(DIST, ...segments, "index.html");
  const flat = path.join(DIST, ...segments.slice(0, -1), `${segments.at(-1)}.html`);
  await mkdir(path.dirname(dirIndex), { recursive: true });
  await writeFile(dirIndex, html, "utf8");
  await writeFile(flat, html, "utf8");
}

// ── page builders ────────────────────────────────────────────────────────────

function productPage(p, related) {
  const { title, description, name } = productSeo(p);
  const urlPath = `/products/${p.slug}`;
  const category = categoryOf(p);
  const unit = priceUnitLabel(p);
  const image = p.primaryImageUrl || p.imageUrls?.[0] || undefined;
  const desc = cleanProductDescription(p.description);
  const tiers = (p.pricingTiers ?? []).filter((t) => t.enabled !== false);
  const crumbs = [
    ["/", "Home"],
    ["/products", "Products"],
    [null, category],
    [urlPath, name],
  ];

  const tierTable = tiers.length
    ? `<h2>Pack sizes and prices</h2><table><thead><tr><th>Pack</th><th>Price</th><th>Per piece</th></tr></thead><tbody>${tiers
        .map(
          (t) =>
            `<tr><td>${esc(t.collectionName || t.uomName)}</td><td>${esc(formatKes(t.collectionPrice))}</td><td>${esc(formatKes(t.pricePerUnit))}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  const minOrder = p.moq
    ? `<p>Minimum order: ${esc(Number(p.moq).toLocaleString("en-KE"))} ${esc(unit)}.</p>`
    : "";

  const body = `${breadcrumbHtml(crumbs)}
<article>
<h1>${esc(name)}</h1>
${image ? `<img src="${esc(image)}" alt="${esc(name)}" loading="lazy" />` : ""}
${p.basePrice != null ? `<p class="mpk-pr-price">${esc(formatKes(p.basePrice))} <small>per ${esc(unit)}</small></p>` : ""}
<p>${esc(availabilityText(p))} · Category: ${esc(category)}${p.sku ? ` · SKU: ${esc(p.sku)}` : ""}</p>
${minOrder}
${desc ? `<p>${esc(desc)}</p>` : ""}
${tierTable}
${p.customizable ? "<p>Custom branding with your logo is available on this product.</p>" : ""}
</article>
${howToBuy()}
${related.length ? `<section><h2>More ${esc(category)}</h2>${productLinkList(related)}</section>` : ""}`;

  const offer = {
    "@type": "Offer",
    url: `${SITE_ORIGIN}${urlPath}`,
    priceCurrency: "KES",
    ...(p.basePrice != null ? { price: Number(p.basePrice) } : {}),
    availability: availabilitySchema(p),
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: BUSINESS.legalName },
  };
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    ...(image ? { image } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    category,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: offer,
  };
  return {
    urlPath,
    title,
    description,
    image,
    jsonLd: [productLd, breadcrumbSchema(crumbs)],
    body,
  };
}

function staticPage(urlPath, extraBody = "") {
  const page = STATIC_PAGES[urlPath];
  const crumbs =
    urlPath === "/"
      ? null
      : [
          ["/", "Home"],
          [urlPath, page.h1],
        ];
  const body = `${crumbs ? breadcrumbHtml(crumbs) : ""}
<h1>${esc(page.h1)}</h1>
${page.intro.map((para) => `<p>${esc(para)}</p>`).join("\n")}
${extraBody}`;
  return {
    urlPath,
    title: page.title,
    description: page.description,
    jsonLd: crumbs ? [breadcrumbSchema(crumbs)] : [],
    body,
  };
}

function groupByCategory(products) {
  const groups = new Map();
  for (const p of products) {
    const c = categoryOf(p);
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(p);
  }
  for (const list of groups.values())
    list.sort((a, b) => displayProductName(a.name).localeCompare(displayProductName(b.name)));
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/** Ranked by real storefront clicks so the homepage links the products people actually open. */
function popular(products, n) {
  return [...products].sort((a, b) => (b.totalClicks ?? 0) - (a.totalClicks ?? 0)).slice(0, n);
}

function storeSection() {
  return `<section><h2>Visit the shop</h2>
<p>${esc(BUSINESS.streetAddress)}, ${esc(BUSINESS.locality)}, Nairobi. Open ${esc(BUSINESS.hoursText)}.</p>
<p>Call or WhatsApp <a href="tel:${BUSINESS.phoneIntl}">${esc(BUSINESS.phoneDisplay)}</a> · <a href="mailto:${BUSINESS.email}">${esc(BUSINESS.email)}</a></p>
</section>`;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const template = await readFile(path.join(DIST, "index.html"), "utf8");

  let products = [];
  let blogs = [];
  try {
    [products, blogs] = await Promise.all([fetchAllProducts(), fetchBlogs().catch(() => [])]);
  } catch (err) {
    console.warn(
      `[prerender-seo] Catalogue fetch failed (${err.message}) — prerendering static pages only.`,
    );
  }

  const groups = groupByCategory(products);
  const pages = [];

  // Products — each links up to 12 siblings in its category, so crawlers can walk the catalogue.
  for (const [, list] of groups) {
    list.forEach((p, i) => {
      const related = [...list.slice(i + 1), ...list.slice(0, i)].slice(0, 12);
      pages.push(productPage(p, related));
    });
  }

  // /products — every product as a real link, grouped by category.
  const catalogue = groups
    .map(
      ([cat, list]) =>
        `<section><h2>${esc(cat)} (${list.length})</h2>${productLinkList(list)}</section>`,
    )
    .join("\n");
  pages.push(staticPage("/products", catalogue + howToBuy()));

  // Homepage — categories, most-viewed products, the shop.
  const home = staticPage(
    "/",
    `${
      groups.length
        ? `<section><h2>Shop by category</h2><ul>${groups
            .map(([cat, list]) => `<li>${esc(cat)} — ${list.length} products</li>`)
            .join("")}</ul><p><a href="/products">Browse all products</a></p></section>`
        : ""
    }
${products.length ? `<section><h2>Popular right now</h2>${productLinkList(popular(products, 16))}</section>` : ""}
${howToBuy()}
${storeSection()}`,
  );
  pages.push(home);

  pages.push(staticPage("/contact", `${storeSection()}${howToBuy()}`));
  pages.push(staticPage("/company-profile", storeSection()));
  pages.push(
    staticPage(
      "/blog",
      blogs.length
        ? `<ul>${blogs.map((b) => `<li><a href="/blog/${esc(b.slug)}">${esc(b.seoTitle || b.title)}</a></li>`).join("")}</ul>`
        : "",
    ),
  );
  for (const urlPath of Object.keys(STATIC_PAGES)) {
    if (!pages.some((pg) => pg.urlPath === urlPath)) pages.push(staticPage(urlPath));
  }

  // Blog posts — title, excerpt, and the same BlogPosting schema blog.$slug.tsx sets client-side.
  for (const b of blogs) {
    const urlPath = `/blog/${b.slug}`;
    const title = `${b.seoTitle || b.title} — Moments Packaging Kenya`;
    const description = b.seoDescription || b.excerpt || "";
    const crumbs = [
      ["/", "Home"],
      ["/blog", "Blog"],
      [urlPath, b.title],
    ];
    pages.push({
      urlPath,
      title,
      description,
      image: b.coverImage?.url || undefined,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: b.seoTitle || b.title,
          description,
          ...(b.coverImage?.url ? { image: b.coverImage.url } : {}),
          author: { "@type": "Organization", name: b.author || SITE_NAME },
          ...(b.publishedAt ? { datePublished: b.publishedAt } : {}),
          ...(b.updatedAt ? { dateModified: b.updatedAt } : {}),
          mainEntityOfPage: `${SITE_ORIGIN}${urlPath}`,
        },
        breadcrumbSchema(crumbs),
      ],
      body: `${breadcrumbHtml(crumbs)}<article><h1>${esc(b.title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</article>`,
    });
  }

  // "/" overwrites the template file itself, so write it last.
  pages.sort((a, b) => (a.urlPath === "/") - (b.urlPath === "/"));
  for (const page of pages) await writeRoute(page.urlPath, renderPage(template, page));

  console.log(
    `[prerender-seo] Wrote ${pages.length} pages (${products.length} products, ${blogs.length} blog posts, ${Object.keys(STATIC_PAGES).length} static).`,
  );
}

main().catch((err) => {
  // Never fail the deploy over SEO output — the SPA still works without it.
  console.error(
    `[prerender-seo] Failed, shipping the plain SPA shell instead: ${err.stack || err.message}`,
  );
});

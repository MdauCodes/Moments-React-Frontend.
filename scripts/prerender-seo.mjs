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
  productPath,
  blogPath,
  FAQ_GROUPS,
  NOINDEX_PATH_PREFIXES,
} from "../src/seo/seoData.js";
import {
  SHOP_PAGES,
  INDUSTRY_PAGES,
  shopPath,
  industryPath,
  findShopPage,
  shopPageIncludes,
  shopPagesForProduct,
  landingFaqs,
} from "../src/seo/landingPages.js";
import {
  GUIDE_PAGES,
  GUIDE_DATA_PATH,
  GUIDE_SLASHLESS_PATHS,
  ECO_GROUPS,
  buildGuideData,
  findGuidePage,
  whatsappCustomUrl,
} from "../src/seo/guidePages.js";
import { countUnits } from "../src/lib/uomWords.js";

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
  )}</a></p><p><a href="/company-profile">About us</a> · <a href="/packaging-suppliers-nairobi/">Packaging suppliers in Nairobi</a> · <a href="/packaging/eco-friendly-packaging-kenya/">Eco-friendly packaging</a> · <a href="/custom-packaging-nairobi/">Custom packaging</a> · <a href="/payment-methods">Payment methods</a> · <a href="/how-it-works">How it works</a> · <a href="/refunds">Returns & refunds</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></footer>`;
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
      return `<li><a href="${esc(productPath(p.slug))}">${esc(displayProductName(p.name))}</a>${price}</li>`;
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
//  1. A slash-less detail URL (/products/x, /blog/x, /shop/x, /industries/x, or a guide page such
//     as /packaging-suppliers-nairobi) gets Render's SPA
//     fallback — the homepage file — so send it to the official slash form, whose own prerendered
//     file exists. Search engines treat this as a redirect. (A server-side redirect isn't possible
//     on Render's static hosting without looping — see productPath in src/seo/seoData.js.)
//  2. When this file is served for a URL other than the one it was built for (SPA fallback), strip
//     the page-specific content + head tags so /cart never claims to be the homepage, and mark
//     private paths (cart, checkout, account...) noindex.
// Written as a real function and serialized with toString() rather than as a string literal, so its
// regexes can't lose their backslashes to template-literal escaping (an earlier string version
// shipped /^/(products... — a syntax error that silently disabled the whole guard). ES5 only: it
// runs as-is in every browser, untranspiled.
function guard(noindexPrefixes, slashPaths) {
  var raw = location.pathname;
  if (/^\/(products|blog|shop|industries)\/[^/]+$/.test(raw) || slashPaths.indexOf(raw) !== -1) {
    location.replace(raw + "/" + location.search + location.hash);
    return;
  }
  var p = raw.replace(/\/+$/, "") || "/";
  var e = document.getElementById("seo-prerender");
  if (e && p === e.getAttribute("data-seo-path")) {
    window.__mpkPrerendered = true;
    return;
  }
  if (e) e.remove();
  var remove = function (sel) {
    document.querySelectorAll(sel).forEach(function (n) {
      n.remove();
    });
  };
  remove('link[rel="canonical"]');
  remove("script[data-prerender-ld]");
  remove("#mpk-pr-style");
  var isPrivate = noindexPrefixes.some(function (a) {
    return p === a || p.indexOf(a + "/") === 0;
  });
  if (isPrivate) {
    var m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
  }
}

function guardScript() {
  return `<script>(${guard.toString()})(${JSON.stringify(NOINDEX_PATH_PREFIXES)}, ${JSON.stringify(GUIDE_SLASHLESS_PATHS)});</script>`;
}

// ── head rewriting ───────────────────────────────────────────────────────────

function setMeta(html, attr, key, value) {
  const re = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="[^"]*"\\s*/?>`,
  );
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

// `canonicalPath` differs from `urlPath` only for product/blog detail pages, whose official URL
// carries a trailing slash (see productPath in src/seo/seoData.js). The homepage deliberately gets
// NO canonical tag in its raw HTML: dist/index.html is also what Render serves for every URL that
// has no file of its own (/cart, an old slash-less product link...), and a crawler that doesn't run
// the guard script must never read "this page is the homepage" off one of those. The app adds the
// homepage canonical after it loads (RouteSeo).
function renderPage(
  template,
  { urlPath, canonicalPath, title, description, image, jsonLd = [], body },
) {
  const isHome = urlPath === "/";
  const canonical = `${SITE_ORIGIN}${isHome ? "/" : (canonicalPath ?? urlPath)}`;
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
    ...(isHome ? [] : [`<link rel="canonical" href="${esc(canonical)}" />`]),
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

// Each page is written as <path>/index.html (what Render serves for /<path>/, and what the per-page
// Rewrite rules in the Render dashboard point /contact etc. at) and also as <path>.html, which
// costs nothing and keeps the output portable to hosts that resolve extensionless URLs that way.
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

// Mirrors /refunds: report a damaged or wrong item within 48 hours of delivery.
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "KE",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 2,
  merchantReturnLink: `${SITE_ORIGIN}/refunds`,
};

/** Plain-text paragraphs (CMS fields can hold blank-line-separated paragraphs). */
function paras(text) {
  return String(text ?? "")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p>${esc(t)}</p>`)
    .join("\n");
}

/** Only same-site paths or http(s) URLs become links — never a javascript: href from the CMS. */
function safeHref(href) {
  const h = String(href ?? "").trim();
  return /^\/(?!\/)/.test(h) || /^https?:\/\//i.test(h) ? h : null;
}

/**
 * The article itself, from the CMS's structured {template, data} body — the same fields
 * BlogBodyRenderer (src/components/blog/BlogTemplates.tsx) lays out. Before this, the raw HTML of
 * every post was just its title and excerpt (~100 words), so crawlers that don't run JavaScript —
 * the AI assistants' included — never saw a single article.
 */
function blogBodyHtml(body) {
  const d = body?.data ?? {};
  let html = "";
  switch (body?.template) {
    case "educative":
      html = `${paras(d.intro)}${(d.keyPoints ?? []).map((k) => `<h2>${esc(k.heading)}</h2>${paras(k.body)}`).join("")}${d.conclusion ? `<h2>In short</h2>${paras(d.conclusion)}` : ""}`;
      break;
    case "explanatory":
      html = `${d.problem ? `<h2>The problem</h2>${paras(d.problem)}` : ""}${d.mechanism ? `<h2>How it works</h2>${paras(d.mechanism)}` : ""}${d.takeaway ? `<h2>The takeaway</h2>${paras(d.takeaway)}` : ""}`;
      break;
    case "scenario":
      html = `${d.setup ? `<h2>The situation</h2>${paras(d.setup)}` : ""}${d.challenge ? `<h2>The challenge</h2>${paras(d.challenge)}` : ""}${d.resolution ? `<h2>What they did</h2>${paras(d.resolution)}` : ""}${d.callout ? `<blockquote>${paras(d.callout)}</blockquote>` : ""}`;
      break;
    case "storyline":
      html = `${paras(d.hook)}${(d.chapters ?? []).map((c) => `<h2>${esc(c.title)}</h2>${paras(c.body)}`).join("")}${paras(d.closing)}`;
      break;
    case "announcement": {
      const href = safeHref(d.ctaHref);
      html = `${d.headline ? `<p><strong>${esc(d.headline)}</strong></p>` : ""}${paras(d.body)}${href && d.ctaLabel ? `<p><a href="${esc(href)}">${esc(d.ctaLabel)}</a></p>` : ""}`;
      break;
    }
    default:
      html = "";
  }
  const ctaHref = safeHref(d.cta?.href);
  if (ctaHref && d.cta?.label) html += `<p><a href="${esc(ctaHref)}">${esc(d.cta.label)}</a></p>`;
  return html;
}

function faqHtml(items) {
  return items.map((it) => `<h3>${esc(it.q)}</h3><p>${esc(it.a)}</p>`).join("\n");
}

function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

/** Lowest base price among products, as "KES 5 per piece" — computed, never hand-written. */
function fromPrice(products) {
  const priced = products.filter((p) => p.basePrice != null && Number(p.basePrice) > 0);
  if (!priced.length) return null;
  const cheapest = priced.reduce((a, b) => (Number(b.basePrice) < Number(a.basePrice) ? b : a));
  return `${formatKes(cheapest.basePrice)} per ${priceUnitLabel(cheapest)}`;
}

/** One /shop/<slug>/ page: intro, every matching product as a link, how to buy, Q&A. */
function shopLandingPage(page, products) {
  const urlPath = shopPath(page.slug).replace(/\/$/, "");
  const canonicalPath = shopPath(page.slug);
  const crumbs = [
    ["/", "Home"],
    ["/products", "Products"],
    [canonicalPath, page.h1],
  ];
  const from = fromPrice(products);
  const faqs = landingFaqs(page, from);
  const related = page.related.map(findShopPage).filter(Boolean);
  const body = `${breadcrumbHtml(crumbs)}
<h1>${esc(page.h1)}</h1>
${page.intro.map((t) => `<p>${esc(t)}</p>`).join("\n")}
<p><strong>${products.length} products${from ? `, from ${esc(from)}` : ""}.</strong></p>
<section><h2>${esc(page.h1)} in stock</h2>${productLinkList(products)}</section>
${howToBuy()}
<section><h2>Questions</h2>${faqHtml(faqs)}</section>
${related.length ? `<section><h2>Related</h2><ul>${related.map((r) => `<li><a href="${shopPath(r.slug)}">${esc(r.h1)}</a></li>`).join("")}</ul></section>` : ""}`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.h1,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_ORIGIN}${productPath(p.slug)}`,
      name: displayProductName(p.name),
    })),
  };
  return {
    urlPath,
    canonicalPath,
    title: page.title,
    description: page.description,
    jsonLd: [breadcrumbSchema(crumbs), faqSchema(faqs), itemList],
    body,
  };
}

function industryHubPage(page, counts) {
  const urlPath = industryPath(page.slug).replace(/\/$/, "");
  const canonicalPath = industryPath(page.slug);
  const crumbs = [
    ["/", "Home"],
    ["/industries", "Industries"],
    [canonicalPath, page.h1],
  ];
  const hubs = page.shop.map(findShopPage).filter((h) => h && counts.get(h.slug));
  const body = `${breadcrumbHtml(crumbs)}
<h1>${esc(page.h1)}</h1>
${page.intro.map((t) => `<p>${esc(t)}</p>`).join("\n")}
<section><h2>What to shop</h2><ul>${hubs
    .map((h) => `<li><a href="${shopPath(h.slug)}">${esc(h.h1)}</a> — ${counts.get(h.slug)} products</li>`)
    .join("")}</ul><p><a href="/products?industry=${esc(page.slug)}">See every product for this industry</a></p></section>
${howToBuy()}
${storeSection()}`;
  return {
    urlPath,
    canonicalPath,
    title: page.title,
    description: page.description,
    jsonLd: [breadcrumbSchema(crumbs)],
    body,
  };
}

/**
 * A guide page (src/seo/guidePages.js): the direct answer first, then the live catalogue block
 * (hub table or eco product groups), the sections, the material table, Q&A and related links.
 */
function guidePage(page, data) {
  const urlPath = page.path.replace(/\/$/, "");
  const crumbs = [
    ["/", "Home"],
    [page.path, page.h1],
  ];
  let live = "";
  if (page.kind === "suppliers" && data.hubs.length) {
    live = `<section><h2>What we stock</h2><table><thead><tr><th>Packaging</th><th>Products</th><th>From</th></tr></thead><tbody>${data.hubs
      .map(
        (h) =>
          `<tr><td><a href="${shopPath(h.slug)}">${esc(h.name)}</a></td><td>${h.count}</td><td>${esc(h.from ?? "-")}</td></tr>`,
      )
      .join("")}</tbody></table></section>`;
  }
  if (page.kind === "eco") {
    live = ECO_GROUPS.map((g) => {
      const list = data.eco.find((e) => e.key === g.key)?.products ?? [];
      if (!list.length) return "";
      return `<section><h2>${esc(g.heading)}</h2><p>${esc(g.blurb)}</p><ul class="mpk-pr-list">${list
        .map(
          (p) =>
            `<li><a href="${productPath(p.slug)}">${esc(p.name)}</a>${p.basePrice != null ? ` — ${formatKes(p.basePrice)} per ${esc(p.unit)}` : ""}</li>`,
        )
        .join("")}</ul></section>`;
    }).join("\n");
  }
  if (page.kind === "custom") {
    live = `<p><a href="${esc(whatsappCustomUrl())}">WhatsApp us your logo</a> · <a href="tel:${BUSINESS.phoneIntl}">Call ${esc(BUSINESS.phoneDisplay)}</a></p>`;
  }
  const sections = page.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.heading)}</h2>${(s.paras ?? []).map((t) => `<p>${esc(t)}</p>`).join("")}${
          s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""
        }</section>`,
    )
    .join("\n");
  const table = page.table
    ? `<section><h2>${esc(page.table.caption)}</h2><table><thead><tr>${page.table.head
        .map((h) => `<th>${esc(h)}</th>`)
        .join("")}</tr></thead><tbody>${page.table.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></section>`
    : "";
  const related = [
    ...(page.links.shop ?? []).map(findShopPage).filter(Boolean).map((s) => [shopPath(s.slug), s.h1]),
    ...(page.links.industries ? INDUSTRY_PAGES.map((i) => [industryPath(i.slug), i.h1]) : []),
    ...(page.links.guides ?? []).map(findGuidePage).filter(Boolean).map((g) => [g.path, g.h1]),
    ...(page.links.extra ?? []),
  ];
  const body = `${breadcrumbHtml(crumbs)}
<h1>${esc(page.h1)}</h1>
<p>${esc(page.answer)}</p>
${live}
${sections}
${table}
<section><h2>Questions</h2>${faqHtml(page.faqs)}</section>
${related.length ? `<section><h2>Related</h2><ul>${related.map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul></section>` : ""}
${storeSection()}`;
  return {
    urlPath,
    canonicalPath: page.path,
    title: page.title,
    description: page.description,
    jsonLd: [breadcrumbSchema(crumbs), faqSchema(page.faqs)],
    body,
  };
}

/**
 * llms.txt gets a dated section with the live from-prices, so an assistant reading it has real
 * numbers to quote. The hand-written part stays in public/llms.txt.
 */
function llmsPriceSection(data) {
  if (!data.hubs.length) return "";
  const day = new Date().toISOString().slice(0, 10);
  return `
## Prices (from the live catalogue, ${day})

Lowest current price per kind of packaging. Check the linked page for today's prices and stock.

${data.hubs.map((h) => `- [${h.name}](${shopPath(h.slug)}): ${h.count} products${h.from ? `, from ${h.from}` : ""}`).join("\n")}
`;
}

// ── page builders ────────────────────────────────────────────────────────────

function productPage(p, related) {
  const { title, description, name } = productSeo(p);
  const urlPath = `/products/${p.slug}`;
  const canonicalPath = productPath(p.slug);
  const category = categoryOf(p);
  const unit = priceUnitLabel(p);
  const image = p.primaryImageUrl || p.imageUrls?.[0] || undefined;
  const desc = cleanProductDescription(p.description);
  const tiers = (p.pricingTiers ?? []).filter((t) => t.enabled !== false);
  // Breadcrumb's middle step is the buyer-language hub this product sits in (a real, indexable
  // page) rather than the raw category name, which had no URL and left a BreadcrumbList item
  // without an `item` (Google reports that as an error).
  const hubs = shopPagesForProduct(p);
  const crumbs = [
    ["/", "Home"],
    ["/products", "Products"],
    ...(hubs[0] ? [[shopPath(hubs[0].slug), hubs[0].h1]] : []),
    [canonicalPath, name],
  ];

  const tierTable = tiers.length
    ? `<h2>Pack sizes and prices</h2><table><thead><tr><th>Pack</th><th>Price</th><th>Per ${esc(unit)}</th></tr></thead><tbody>${tiers
        .map(
          (t) =>
            `<tr><td>${esc(t.collectionName || t.uomName)}</td><td>${esc(formatKes(t.collectionPrice))}</td><td>${esc(formatKes(t.pricePerUnit))}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  const minOrder = p.moq
    ? `<p>Minimum order: ${esc(countUnits(p.moq, unit))}.</p>`
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
${hubs.length ? `<p>Find similar: ${hubs.map((h) => `<a href="${shopPath(h.slug)}">${esc(h.h1)}</a>`).join(" · ")}</p>` : ""}
</article>
${howToBuy()}
${related.length ? `<section><h2>More ${esc(category)}</h2>${productLinkList(related)}</section>` : ""}`;

  const offer = {
    "@type": "Offer",
    url: `${SITE_ORIGIN}${canonicalPath}`,
    priceCurrency: "KES",
    ...(p.basePrice != null ? { price: Number(p.basePrice) } : {}),
    availability: availabilitySchema(p),
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: BUSINESS.legalName },
    hasMerchantReturnPolicy: RETURN_POLICY,
  };
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    ...(image ? { image } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    category,
    // No `brand`: most of the catalogue is other makers' stock (Tech, Adix, Heinz...) and supplier
    // names are deliberately kept off the site, so labelling every item "Moments Packaging Kenya"
    // was a false claim. Brand is optional for Product rich results.
    offers: offer,
  };
  return {
    urlPath,
    canonicalPath,
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
  // Buyer-intent hubs (/shop/<slug>/) and industry hubs (/industries/<slug>/).
  const hubCounts = new Map();
  for (const page of SHOP_PAGES) {
    const list = products
      .filter((p) => shopPageIncludes(page, p))
      .sort((a, b) => displayProductName(a.name).localeCompare(displayProductName(b.name)));
    hubCounts.set(page.slug, list.length);
    // Skipped when nothing matches (or the catalogue fetch failed) — an empty hub is a thin page.
    if (list.length) pages.push(shopLandingPage(page, list));
  }
  for (const page of INDUSTRY_PAGES) pages.push(industryHubPage(page, hubCounts));
  const liveHubs = SHOP_PAGES.filter((pg) => hubCounts.get(pg.slug));
  const shopByNeed = liveHubs.length
    ? `<section><h2>Shop by what you need</h2><ul>${liveHubs
        .map((pg) => `<li><a href="${shopPath(pg.slug)}">${esc(pg.h1)}</a> — ${hubCounts.get(pg.slug)} products</li>`)
        .join("")}</ul></section>`
    : "";
  const shopByBusiness = `<section><h2>Shop by type of business</h2><ul>${INDUSTRY_PAGES.map(
    (pg) => `<li><a href="${industryPath(pg.slug)}">${esc(pg.h1)}</a></li>`,
  ).join("")}</ul></section>`;

  // Guide pages, and the data file their browser pages read (same numbers as the HTML).
  const guideData = buildGuideData(products);
  for (const page of GUIDE_PAGES) pages.push(guidePage(page, guideData));
  await writeFile(path.join(DIST, GUIDE_DATA_PATH.replace(/^\//, "")), JSON.stringify(guideData), "utf8");
  const llmsFile = path.join(DIST, "llms.txt");
  const llms = await readFile(llmsFile, "utf8").catch(() => null);
  if (llms != null) await writeFile(llmsFile, llms.trimEnd() + "\n" + llmsPriceSection(guideData), "utf8");
  const guides = `<section><h2>Guides</h2><ul>${GUIDE_PAGES.map(
    (g) => `<li><a href="${g.path}">${esc(g.h1)}</a></li>`,
  ).join("")}</ul></section>`;

  pages.push(staticPage("/products", shopByNeed + catalogue + howToBuy()));
  pages.push(staticPage("/industries", shopByBusiness + shopByNeed));

  const faqPage = staticPage(
    "/faq",
    FAQ_GROUPS.map((g) => `<section><h2>${esc(g.heading)}</h2>${faqHtml(g.items)}</section>`).join("\n"),
  );
  faqPage.jsonLd.push(faqSchema(FAQ_GROUPS.flatMap((g) => g.items)));
  pages.push(faqPage);

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
${shopByNeed}
${shopByBusiness}
${guides}
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
        ? `<ul>${blogs.map((b) => `<li><a href="${esc(blogPath(b.slug))}">${esc(b.seoTitle || b.title)}</a></li>`).join("")}</ul>`
        : "",
    ),
  );
  for (const urlPath of Object.keys(STATIC_PAGES)) {
    if (!pages.some((pg) => pg.urlPath === urlPath)) pages.push(staticPage(urlPath));
  }

  // Blog posts — title, excerpt, and the same BlogPosting schema blog.$slug.tsx sets client-side.
  for (const b of blogs) {
    const urlPath = `/blog/${b.slug}`;
    const canonicalPath = blogPath(b.slug);
    const title = `${b.seoTitle || b.title} — Moments Packaging Kenya`;
    const description = b.seoDescription || b.excerpt || "";
    const crumbs = [
      ["/", "Home"],
      ["/blog", "Blog"],
      [canonicalPath, b.title],
    ];
    pages.push({
      urlPath,
      canonicalPath,
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
          mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
        },
        breadcrumbSchema(crumbs),
      ],
      body: `${breadcrumbHtml(crumbs)}<article><h1>${esc(b.title)}</h1>${b.excerpt ? `<p>${esc(b.excerpt)}</p>` : ""}${b.author ? `<p>By ${esc(b.author)}${b.publishedAt ? ` · ${esc(String(b.publishedAt).slice(0, 10))}` : ""}</p>` : ""}${blogBodyHtml(b.body)}</article>${howToBuy()}`,
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

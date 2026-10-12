import { Link, Navigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/services/api";
import type { Product } from "@/data/products";
import { useSeo } from "@/hooks/useSeo";
import {
  SITE_ORIGIN,
  displayProductName,
  formatKes,
  priceUnitLabel,
  productPath,
} from "@/seo/seoData";
import { findShopPage, landingFaqs, shopPageIncludes, shopPath } from "@/seo/landingPages";

/**
 * A buyer-intent landing page — /shop/takeaway-food-containers/ and friends (src/seo/landingPages.js).
 * The prerendered HTML for this URL (scripts/prerender-seo.mjs) carries the same copy, product list
 * and Q&A; this is what a shopper sees once the app mounts.
 *
 * Candidates come from the category filter and /products/search, then the page's own include/
 * exclude rule decides what actually shows — the same rule the prerender applies to the full
 * catalogue, so both list the same products.
 */
export default function ShopLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = findShopPage(slug);
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    setProducts(null);
    const byCategory = page.category
      ? [0, 1].map((p) =>
          api.getProducts({ category: page.category, page: p, size: 100 }).catch(() => []),
        )
      : [];
    const bySearch = page.terms.map((t) => api.searchProducts(t, 50).catch(() => [] as Product[]));
    void Promise.all([...byCategory, ...bySearch]).then((lists) => {
      if (cancelled) return;
      const seen = new Map<string, Product>();
      for (const p of lists.flat()) if (p.slug && shopPageIncludes(page, p)) seen.set(p.slug, p);
      setProducts(
        [...seen.values()].sort((a, b) =>
          displayProductName(a.name).localeCompare(displayProductName(b.name)),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const fromPrice = useMemo(() => {
    const priced = (products ?? []).filter((p) => p.basePrice != null && Number(p.basePrice) > 0);
    if (!priced.length) return null;
    const cheapest = priced.reduce((a, b) => (Number(b.basePrice) < Number(a.basePrice) ? b : a));
    return `${formatKes(cheapest.basePrice ?? 0)} per ${priceUnitLabel(cheapest)}`;
  }, [products]);

  const faqs = page ? landingFaqs(page, fromPrice) : [];

  useSeo({
    enabled: !!page && products !== null,
    title: page?.title ?? "",
    description: page?.description ?? "",
    path: shopPath(slug ?? ""),
    jsonLd: page
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
              {
                "@type": "ListItem",
                position: 2,
                name: "Products",
                item: `${SITE_ORIGIN}/products`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: page.h1,
                item: `${SITE_ORIGIN}${shopPath(page.slug)}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : undefined,
  });

  if (!page) return <Navigate to="/products" replace />;

  const related = page.related.map(findShopPage).filter((r): r is NonNullable<typeof r> => !!r);

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-accent">
              Home
            </Link>{" "}
            /{" "}
            <Link to="/products" className="hover:text-accent">
              Products
            </Link>{" "}
            / <span>{page.h1}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium text-foreground sm:text-5xl text-balance">
            {page.h1}
          </h1>
          <div className="mt-5 max-w-3xl space-y-3 text-base text-muted-foreground sm:text-lg">
            {page.intro.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
          {products && products.length > 0 && (
            <p className="mt-5 text-sm font-medium text-foreground">
              {products.length} products{fromPrice ? `, from ${fromPrice}` : ""}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        {products === null ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing listed here right now —{" "}
            <Link to="/products" className="text-accent underline">
              browse all products
            </Link>{" "}
            or{" "}
            <Link to="/contact" className="text-accent underline">
              ask us
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {products.map((p) => {
              const image = p.primaryImageUrl || p.imageUrls?.[0];
              const name = displayProductName(p.name);
              return (
                <li key={p.slug}>
                  <Link
                    to={productPath(p.slug)}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
                  >
                    <div className="aspect-square overflow-hidden bg-secondary">
                      {image ? (
                        <img
                          src={image}
                          alt={name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                      <span className="text-sm font-medium leading-snug text-foreground">
                        {name}
                      </span>
                      {p.basePrice != null && (
                        <span className="mt-auto text-sm text-muted-foreground">
                          {formatKes(p.basePrice)}{" "}
                          <span className="text-xs">per {priceUnitLabel(p)}</span>
                        </span>
                      )}
                      {p.stockStatus === "OUT_OF_STOCK" && (
                        <span className="text-xs text-muted-foreground">Out of stock</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-12 lg:px-8">
        <h2 className="font-display text-2xl font-medium text-foreground">Questions</h2>
        <Accordion type="single" collapsible className="mt-3">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-medium text-foreground">Related</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={shopPath(r.slug)}
                    className="inline-block rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {r.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

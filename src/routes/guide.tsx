import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSeo } from "@/hooks/useSeo";
import { BUSINESS, SITE_ORIGIN, formatKes, productPath } from "@/seo/seoData";
import { INDUSTRY_PAGES, findShopPage, industryPath, shopPath } from "@/seo/landingPages";
import {
  ECO_GROUPS,
  GUIDE_DATA_PATH,
  findGuidePage,
  whatsappCustomUrl,
  type GuideData,
  type GuideProductCard,
} from "@/seo/guidePages";

/**
 * A guide page — /packaging-suppliers-nairobi/, /packaging/eco-friendly-packaging-kenya/ and
 * /custom-packaging-nairobi/ (src/seo/guidePages.js). The prerendered HTML carries the same copy;
 * the catalogue numbers come from the guide-data.json the prerender writes beside it, so the
 * shopper and the crawler see the same counts and prices.
 */
export default function GuidePage({ slug }: { slug: string }) {
  const page = findGuidePage(slug);
  const [data, setData] = useState<GuideData | null>(null);

  useEffect(() => {
    if (!page || page.kind === "custom") return;
    let cancelled = false;
    fetch(GUIDE_DATA_PATH)
      .then((r) => (r.ok ? (r.json() as Promise<GuideData>) : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.hubs)) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page]);

  useSeo({
    enabled: !!page,
    title: page?.title ?? "",
    description: page?.description ?? "",
    path: page?.path ?? "/",
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
                name: page.h1,
                item: `${SITE_ORIGIN}${page.path}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : undefined,
  });

  if (!page) return <Navigate to="/products" replace />;

  const shopLinks = (page.links.shop ?? [])
    .map(findShopPage)
    .filter((s): s is NonNullable<typeof s> => !!s);
  const guideLinks = (page.links.guides ?? [])
    .map(findGuidePage)
    .filter((g): g is NonNullable<typeof g> => !!g);

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:py-14 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-accent">
              Home
            </Link>{" "}
            / <span>{page.h1}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-5xl text-balance">
            {page.h1}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">{page.answer}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {page.kind === "custom" ? (
              <>
                <a
                  href={whatsappCustomUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp us your logo
                </a>
                <a
                  href={`tel:${BUSINESS.phoneIntl}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-accent hover:text-accent"
                >
                  <Phone className="h-4 w-4" aria-hidden /> {BUSINESS.phoneDisplay}
                </a>
              </>
            ) : (
              <>
                <Link
                  to="/products"
                  className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Shop all products
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-accent hover:text-accent"
                >
                  Visit or contact the shop
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-8 sm:py-12 lg:px-8">
        {page.kind === "suppliers" && <HubTable data={data} />}
        {page.kind === "eco" && <EcoGroups data={data} />}

        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-2xl font-medium text-foreground">{s.heading}</h2>
            {s.paras?.map((t) => (
              <p key={t} className="mt-3 text-muted-foreground">
                {t}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {page.table && (
          <section>
            <h2 className="font-display text-2xl font-medium text-foreground">
              {page.table.caption}
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary text-foreground">
                  <tr>
                    {page.table.head.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.table.rows.map((r) => (
                    <tr key={r[0]} className="border-t border-border align-top">
                      {r.map((c, i) => (
                        <td
                          key={i}
                          className={i === 0 ? "px-3 py-2 font-medium text-foreground" : "px-3 py-2 text-muted-foreground"}
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl font-medium text-foreground">Questions</h2>
          <Accordion type="single" collapsible className="mt-2">
            {page.faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {(shopLinks.length > 0 || guideLinks.length > 0 || page.links.industries || page.links.extra) && (
          <section>
            <h2 className="font-display text-xl font-medium text-foreground">Related</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {shopLinks.map((s) => (
                <Chip key={s.slug} to={shopPath(s.slug)} label={s.h1} />
              ))}
              {page.links.industries &&
                INDUSTRY_PAGES.map((ind) => (
                  <Chip key={ind.slug} to={industryPath(ind.slug)} label={ind.h1} />
                ))}
              {guideLinks.map((g) => (
                <Chip key={g.slug} to={g.path} label={g.h1} />
              ))}
              {page.links.extra?.map(([to, label]) => <Chip key={to} to={to} label={label} />)}
            </ul>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}

function Chip({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="inline-block rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent hover:text-accent"
      >
        {label}
      </Link>
    </li>
  );
}

/** What we stock: one row per /shop/ hub, with live count and from-price. */
function HubTable({ data }: { data: GuideData | null }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-medium text-foreground">What we stock</h2>
      {data ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Packaging</th>
                <th className="px-3 py-2 text-right font-medium">Products</th>
                <th className="px-3 py-2 text-right font-medium">From</th>
              </tr>
            </thead>
            <tbody>
              {data.hubs.map((h) => (
                <tr key={h.slug} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link to={shopPath(h.slug)} className="text-foreground underline-offset-2 hover:text-accent hover:underline">
                      {h.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{h.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {h.from ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {/* No data file (dev server, or the fetch failed): the hub links still work. */}
          {(["takeaway-food-containers", "disposable-cups-and-lids", "khaki-and-paper-bags", "cake-boxes-and-dessert-packaging"] as const)
            .map(findShopPage)
            .filter((s): s is NonNullable<typeof s> => !!s)
            .map((s) => (
              <Chip key={s.slug} to={shopPath(s.slug)} label={s.h1} />
            ))}
        </ul>
      )}
    </section>
  );
}

function EcoGroups({ data }: { data: GuideData | null }) {
  if (!data) return null;
  return (
    <>
      {ECO_GROUPS.map((g) => {
        const products = data.eco.find((e) => e.key === g.key)?.products ?? [];
        if (!products.length) return null;
        return (
          <section key={g.key}>
            <h2 className="font-display text-2xl font-medium text-foreground">{g.heading}</h2>
            <p className="mt-2 text-muted-foreground">{g.blurb}</p>
            <ProductRow products={products} />
          </section>
        );
      })}
    </>
  );
}

/** Compact cards: two across on a phone, scrolling sideways when a group is long. */
function ProductRow({ products }: { products: GuideProductCard[] }) {
  return (
    <ul className="mt-3 grid auto-cols-[46%] grid-flow-col gap-3 overflow-x-auto pb-2 sm:auto-cols-[30%] lg:auto-cols-[23%]">
      {products.map((p) => (
        <li key={p.slug}>
          <Link
            to={productPath(p.slug)}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-accent/40"
          >
            <div className="aspect-[4/3] overflow-hidden bg-secondary">
              {p.image ? (
                <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2.5">
              <span className="text-sm leading-snug text-foreground">{p.name}</span>
              {p.basePrice != null && (
                <span className="mt-auto text-xs text-muted-foreground">
                  {formatKes(p.basePrice)} per {p.unit}
                </span>
              )}
              {p.stockStatus === "OUT_OF_STOCK" && (
                <span className="text-xs text-muted-foreground">Out of stock</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

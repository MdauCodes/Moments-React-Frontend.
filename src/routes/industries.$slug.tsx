import { Link, Navigate, useParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { useSeo } from "@/hooks/useSeo";
import { SITE_ORIGIN } from "@/seo/seoData";
import { findIndustryPage, findShopPage, industryPath, shopPath } from "@/seo/landingPages";

/**
 * An industry hub — /industries/food-and-beverage/ etc. (src/seo/landingPages.js): who it's for and
 * links to the /shop/ pages that business buys from. The prerendered HTML carries the same copy.
 * The full filterable list stays at /products?industry=<slug>.
 */
export default function IndustryHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = findIndustryPage(slug);

  useSeo({
    enabled: !!page,
    title: page?.title ?? "",
    description: page?.description ?? "",
    path: industryPath(slug ?? ""),
    jsonLd: page
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "Industries",
              item: `${SITE_ORIGIN}/industries`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: page.h1,
              item: `${SITE_ORIGIN}${industryPath(page.slug)}`,
            },
          ],
        }
      : undefined,
  });

  if (!page) return <Navigate to="/industries" replace />;

  const hubs = page.shop.map(findShopPage).filter((h): h is NonNullable<typeof h> => !!h);

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-accent">
              Home
            </Link>{" "}
            /{" "}
            <Link to="/industries" className="hover:text-accent">
              Industries
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
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8">
        <h2 className="font-display text-2xl font-medium text-foreground">What to shop</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map((h) => (
            <li key={h.slug}>
              <Link
                to={shopPath(h.slug)}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
              >
                <span className="font-display text-lg text-foreground">{h.h1}</span>
                <span className="mt-2 text-sm text-muted-foreground">{h.intro[0]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link
            to={`/products?industry=${page.slug}`}
            className="text-sm font-medium text-accent underline"
          >
            See every product for this industry
          </Link>
        </p>
      </section>
    </SiteLayout>
  );
}

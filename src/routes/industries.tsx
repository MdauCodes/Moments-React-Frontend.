import { Link } from "react-router-dom";

import { SiteLayout } from "@/components/SiteLayout";
import { ArrowRight } from "lucide-react";
import { industries } from "@/data/products";



function IndustriesPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Industries</p>
            <h1 className="mt-3 font-display text-4xl font-medium text-foreground sm:text-5xl md:text-6xl lg:text-7xl text-balance">
              Packaging for every kind of business.
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Whatever you sell, we've probably packed it. Eight industries — one production
              line, one quality bar. Pick a sector to jump straight to the products we make for it.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {industries.map((ind) => {
            const Icon = ind.icon;
            return (
              <Link
                key={ind.id}
                
                to={`/products?industry=${ind.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                  {ind.image ? (
                    <img
                      src={ind.image}
                      alt={`${ind.name} packaging in context`}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent" />
                  <span
                    className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-xl bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors group-hover:bg-accent group-hover:text-accent-foreground"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-background/90 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <h2 className="font-display text-xl text-foreground sm:text-2xl">
                    {ind.name}
                  </h2>
                  {ind.tagline && (
                    <p className="mt-1 text-sm font-medium text-accent">{ind.tagline}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">{ind.description}</p>
                  {ind.keywords && ind.keywords.length > 0 && (
                    <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
                      {ind.keywords.slice(0, 4).join(" · ")}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors group-hover:text-accent">
                    See products <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:pb-24 lg:px-8">
        <div className="rounded-3xl bg-primary p-8 text-primary-foreground sm:p-12 lg:p-16">
          <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl">
                Don't see your industry? We probably still pack for it.
              </h3>
              <p className="mt-3 max-w-xl text-primary-foreground/88 sm:mt-4">
                Tell us what you sell. We'll recommend formats, sizes and pricing within 24 hours.
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-foreground px-6 py-3.5 text-sm font-medium text-primary sm:px-7 sm:py-4 lg:justify-self-end"
            >
              Talk to our team <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

export default IndustriesPage;

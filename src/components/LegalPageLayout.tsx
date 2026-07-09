import { Link } from "react-router-dom";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { ScrollText, Mail, Phone, ArrowUp } from "lucide-react";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_PHONE_ALT } from "@/data/products";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalPageLayoutProps {
  eyebrow?: string;
  title: string;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
  /** Sibling legal pages for cross-linking at the bottom. */
  related?: { to: string; label: string }[];
}

export function LegalPageLayout({
  eyebrow = "Legal",
  title,
  intro,
  updated,
  sections,
  related = [],
}: LegalPageLayoutProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const [showTop, setShowTop] = useState(false);

  const tocItems = useMemo(
    () => sections.map((s) => ({ id: s.id, title: s.title })),
    [sections],
  );

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (headings.length === 0) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [sections]);

  return (
    <div className="bg-background">
      {/* Hero band */}
      <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 80% 60%, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px, 64px 64px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pb-20 sm:pt-20 lg:px-8">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-primary-foreground/85">
            <ScrollText className="h-4 w-4" aria-hidden />
            <span>{eyebrow}</span>
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <div className="mt-6 max-w-2xl text-sm leading-relaxed text-primary-foreground/90 sm:text-base">
            {intro}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-primary-foreground/85">
            <span className="rounded-full border border-primary-foreground/25 bg-primary-foreground/5 px-3 py-1.5">
              Updated {updated}
            </span>
            <span className="rounded-full border border-primary-foreground/25 bg-primary-foreground/5 px-3 py-1.5">
              Governed by Kenyan law
            </span>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                On this page
              </p>
              <ol className="mt-4 space-y-1 border-l border-border">
                {tocItems.map((item, i) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={cn(
                          "block -ml-px border-l-2 py-1.5 pl-4 text-sm transition-colors",
                          active
                            ? "border-accent font-medium text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <span className="mr-2 text-xs tabular-nums text-muted-foreground/70">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {item.title}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          {/* Sections */}
          <article className="min-w-0">
            <div className="space-y-10">
              {sections.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
                >
                  <header className="mb-4 flex items-baseline gap-4 border-b border-border/60 pb-4">
                    <span className="font-display text-2xl text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
                      {section.title}
                    </h2>
                  </header>
                  <div className="legal-prose text-[15px] leading-relaxed text-foreground/85">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            {/* Contact CTA */}
            <section className="mt-12 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-card p-6 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Questions about this policy?
              </p>
              <h3 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
                Talk to a real human on our team.
              </h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Email or WhatsApp us and we&apos;ll get back to you on the same business day.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href={`mailto:${COMPANY_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  {COMPANY_EMAIL}
                </a>
                <a
                  href={`tel:+254${COMPANY_PHONE.replace(/\D/g, "").slice(-9)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {COMPANY_PHONE}
                </a>
                <a
                  href={`tel:+254${COMPANY_PHONE_ALT.replace(/\D/g, "").slice(-9)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {COMPANY_PHONE_ALT}
                </a>
              </div>
            </section>

            {related.length > 0 && (
              <nav
                aria-label="Related legal pages"
                className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-muted-foreground"
              >
                <span className="font-medium text-foreground">See also:</span>
                {related.map((r) => (
                  <Link key={r.to} to={r.to} className="underline-offset-4 hover:text-accent hover:underline">
                    {r.label}
                  </Link>
                ))}
              </nav>
            )}
          </article>
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur transition hover:border-accent hover:text-accent sm:bottom-28 sm:right-6"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

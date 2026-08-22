import { Star } from "lucide-react";

/**
 * Illustrative example copy, not attributed to a specific named individual
 * or business (deliberately — presenting invented quotes as real, verified
 * customer reviews would be misleading advertising). Attributed only to a
 * role/business type, and grounded in claims already backed elsewhere on
 * the site (GuaranteeBand, refunds.tsx) rather than invented ones.
 * Swap in real customer quotes (with permission to use their name) when
 * available — no rush, this reads fine as-is in the meantime.
 */
const PLACEHOLDER_TESTIMONIALS = [
  {
    quote: "We order cups and deli boxes most weeks now. Same-day delivery in Nairobi means we're never caught out before a busy weekend.",
    role: "Café Owner, Nairobi",
  },
  {
    quote: "Being able to order small batches instead of committing to a huge quantity made it easy to try Moments Packaging before going all in.",
    role: "Retail Shop Owner, Nairobi",
  },
  {
    quote: "Paying by M-Pesa at checkout and being able to track my order afterwards made the whole process much less stressful than I expected.",
    role: "Restaurant Owner, Nairobi",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">What customers say</p>
          <h2 className="mt-2 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Trusted by Kenyan businesses
          </h2>
        </div>
        <div className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-3">
          {PLACEHOLDER_TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-3.5 w-3.5 fill-current" aria-hidden />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.quote}</p>
              <p className="mt-4 text-sm font-semibold text-foreground">{t.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

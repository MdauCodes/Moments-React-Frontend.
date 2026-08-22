import { ShieldCheck, Truck, RotateCcw, Wallet } from "lucide-react";

/**
 * Grounded in claims already live elsewhere on the site (TRUST_STATS on the
 * homepage hero, and the free-reprint policy in refunds.tsx) — nothing new
 * is asserted here. Still worth an admin skim before shipping in case those
 * source claims have since changed.
 */
const GUARANTEES = [
  {
    Icon: ShieldCheck,
    title: "Quality guarantee",
    desc: "Receive a defective or incorrect order? We'll work with you to resolve the issue, in line with our refund and replacement policy.",
  },
  {
    Icon: Truck,
    title: "Fast delivery",
    desc: "Get your packaging same day within Nairobi and within 3 days countrywide.",
  },
  {
    Icon: RotateCcw,
    title: "No minimum order stress",
    desc: "Order from as low as 1 unit — no need to commit to large quantities.",
  },
  {
    Icon: Wallet,
    title: "Secure M-Pesa checkout",
    desc: "Pay securely via M-Pesa. Your M-Pesa PIN is never shared with or stored by Moments Packaging.",
  },
];

export function GuaranteeBand() {
  return (
    <section className="border-y border-border bg-background">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="flex flex-col items-start gap-2">
              <g.Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
              <p className="text-sm font-semibold text-foreground">{g.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { useEnquiry } from "@/contexts/EnquiryContext";
import { whatsappLink, COMPANY_EMAIL } from "@/data/products";
import { Check, MessageCircle, Mail, MessageSquareText } from "lucide-react";

/**
 * DRAFT CONTENT — needs admin sign-off before shipping.
 * "Partner" here is drafted as a reseller/referral/bulk-supply program —
 * confirm this matches what the business actually wants to offer (or
 * whether "partner" should instead route straight to Enterprise Quote).
 */
const PARTNER_TYPES = [
  {
    title: "Resellers & distributors",
    desc: "Stock our packaging for your own retail or wholesale customers, at partner pricing.",
  },
  {
    title: "Referral partners",
    desc: "Send us businesses that need packaging and earn a commission on their first order.",
  },
  {
    title: "Supply & production partners",
    desc: "Manufacturers and material suppliers looking to work with us on an ongoing basis.",
  },
];

function BecomeAPartnerPage() {
  const { openEnquiry } = useEnquiry();

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20 lg:px-8">
          <p className="text-xs uppercase tracking-widest text-accent">Partnerships</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Want to work with us?
          </h1>
          <p className="mt-4 text-muted-foreground">
            We work with resellers, referral partners and suppliers across Kenya. Tell us a bit about
            your business and we will get back to you.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {PARTNER_TYPES.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border bg-card p-5">
              <Check className="h-4 w-4 text-accent" />
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">{t.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="font-display text-xl text-foreground">Ready to talk?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us what kind of business you run and what you have in mind — we will come back to you
            within two working days.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {/* The primary route is the enquiry panel, so a partnership request is recorded and can
             *  be followed up, rather than living only in someone's WhatsApp thread. */}
            <button
              type="button"
              onClick={() =>
                openEnquiry({
                  topic: "other",
                  message: "I would like to talk about becoming a partner. My business is ",
                })
              }
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Tell us about your business
            </button>
            <a
              href={whatsappLink("Hi Moments Packaging, I'm interested in becoming a partner.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp us
            </a>
            <a
              href={`mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent("Partnership enquiry")}`}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> {COMPANY_EMAIL}
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Placing one big order instead?{" "}
            <Link to="/enterprise-quote" className="text-accent hover:underline">
              Ask for a bulk quote →
            </Link>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default BecomeAPartnerPage;

import { SiteLayout } from "@/components/SiteLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_PHONE_ALT, whatsappLink } from "@/data/products";
import { MessageCircle, Mail } from "lucide-react";

/**
 * DRAFT CONTENT — needs admin sign-off before shipping.
 * Answers below (MOQ, delivery windows, lead times, refund terms) are
 * best-guesses based on what's already stated elsewhere on the site
 * (terms.tsx, refunds.tsx, contact.tsx). Verify every number before publishing.
 */
type FaqGroup = { heading: string; items: { q: string; a: string }[] };

const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: "Ordering",
    items: [
      {
        q: "Is there a minimum order quantity?",
        a: "Most products can be ordered from 100 units. Some items are sold by the packet or carton — the minimum is shown on each product page before you add it to cart.",
      },
      {
        q: "Can I order without an account?",
        a: "Yes. You can browse and check out as a guest. Creating an account lets you track past orders and re-order faster.",
      },
      {
        q: "Can I get custom branding or printing on my packaging?",
        a: "Yes — branding is available on request. Use the Enterprise Quote form or WhatsApp us with your logo/artwork and the products you're interested in.",
      },
      {
        q: "How do I know if a product is in stock?",
        a: "Every product card shows an in-stock or out-of-stock badge. Out-of-stock items can usually still be ordered — we'll confirm a restock or production timeline with you before shipping.",
      },
    ],
  },
  {
    heading: "Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "M-Pesa, bank transfer, and cash on delivery for select customers. Large enterprise orders may require a 50% deposit before production starts.",
      },
      {
        q: "Is my M-Pesa payment secure?",
        a: "Payments are processed directly through Safaricom's M-Pesa STK push — we never see or store your PIN.",
      },
      {
        q: "Do your prices include VAT?",
        a: "Where stated, listed prices include VAT. This is shown at checkout before you confirm your order.",
      },
    ],
  },
  {
    heading: "Delivery",
    items: [
      {
        q: "How fast is delivery in Nairobi?",
        a: "Same-day delivery within Nairobi for orders placed before the daily cutoff — check your cart at checkout for the exact delivery estimate.",
      },
      {
        q: "Do you deliver outside Nairobi?",
        a: "Yes, countrywide — typically within 3 business days depending on your location.",
      },
      {
        q: "Can I track my order?",
        a: "Yes — use the Track Order page with your order reference, or check your account dashboard if you're signed in.",
      },
    ],
  },
  {
    heading: "Returns & quality",
    items: [
      {
        q: "What if my order arrives damaged or wrong?",
        a: "Contact us within 48 hours of delivery with photos of the issue and we'll arrange a replacement or refund — see our Refunds & Returns policy for full terms.",
      },
      {
        q: "Do you offer samples before a bulk order?",
        a: "For enterprise and custom-branded orders, ask your account manager about samples before committing to a full production run.",
      },
    ],
  },
];

function FaqPage() {
  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:py-20 lg:px-8">
          <p className="text-xs uppercase tracking-widest text-accent">Support</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-muted-foreground">
            Can't find what you're looking for? Reach us directly and we'll get back to you the same day.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16 lg:px-8">
        {FAQ_GROUPS.map((group) => (
          <div key={group.heading} className="mb-10">
            <h2 className="font-display text-xl font-medium text-foreground">{group.heading}</h2>
            <Accordion type="single" collapsible className="mt-3">
              {group.items.map((item, i) => (
                <AccordionItem key={i} value={`${group.heading}-${i}`}>
                  <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        <div className="mt-14 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h3 className="font-display text-xl text-foreground">Still have a question?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Talk to a real person — no bots, no ticket queues.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={whatsappLink("Hi Moments Packaging, I have a question that's not covered in the FAQ.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp us
            </a>
            <a
              href={`mailto:${COMPANY_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
            >
              <Mail className="h-4 w-4" /> {COMPANY_EMAIL}
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Or call {COMPANY_PHONE} / {COMPANY_PHONE_ALT}
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

export default FaqPage;

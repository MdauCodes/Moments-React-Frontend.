import { SiteLayout } from "@/components/SiteLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_PHONE_ALT, whatsappLink } from "@/data/products";
import { MessageCircle, Mail } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { FAQ_GROUPS, STATIC_PAGES } from "@/seo/seoData";

function FaqPage() {
  // FAQPage schema is exactly what Google's FAQ rich results and AI answer engines both parse
  // to quote a specific answer directly, rather than needing to guess at page structure — this
  // flattens FAQ_GROUPS (already a clean, structured Q&A list) straight into it.
  useSeo({
    // Same copy the prerendered /faq HTML carries (src/seo/seoData.js), so raw and hydrated agree.
    title: STATIC_PAGES["/faq"].title,
    description: STATIC_PAGES["/faq"].description,
    path: "/faq",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_GROUPS.flatMap((group) =>
        group.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      ),
    },
  });

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

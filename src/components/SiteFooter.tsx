import { Link } from "react-router-dom";

import { useState } from "react";
import { Phone, Mail, MapPin, Instagram, MessageCircle, Facebook, X } from "lucide-react";
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  COMPANY_PHONE_ALT,
  COMPANY_ADDRESS,
  WHATSAPP_NUMBER,
  INSTAGRAM_URL,
  TIKTOK_URL,
  FACEBOOK_URL,
  categories,
} from "@/data/products";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { getPrivacyPolicyContent } from "@/routes/privacy";
import { getTermsContent } from "@/routes/terms";
import { getRefundsContent } from "@/routes/refunds";

type PolicyKey = "privacy" | "terms" | "refunds";

const POLICY_CONTENT: Record<PolicyKey, () => ReturnType<typeof getPrivacyPolicyContent>> = {
  privacy: getPrivacyPolicyContent,
  terms: getTermsContent,
  refunds: getRefundsContent,
};

/** Footer link that opens a policy's full content in a modal instead of
 * navigating away — so reading it doesn't cost your place on the page. */
function PolicyModal({ policyKey, onClose }: { policyKey: PolicyKey; onClose: () => void }) {
  const content = POLICY_CONTENT[policyKey]();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-background text-foreground sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-medium">{content.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Updated {content.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="text-sm leading-relaxed text-foreground/80">{content.intro}</div>
          <div className="mt-6 space-y-6">
            {content.sections.map((section) => (
              <section key={section.id}>
                <h3 className="font-display text-base font-semibold text-foreground">{section.title}</h3>
                <div className="legal-prose mt-2 text-sm leading-relaxed text-foreground/80">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  const [openPolicy, setOpenPolicy] = useState<PolicyKey | null>(null);

  return (
    <footer
      className="mt-16 border-t border-border text-primary-foreground sm:mt-24"
      style={{
        /* Match the hero section's radial green gradient */
        background: "radial-gradient(ellipse at 100% 0%, #0d3320 0%, #08231a 60%, #061a13 100%)",
      }}
    >
      <div className="mx-auto grid gap-8 px-5 py-12 sm:grid-cols-2 sm:gap-10 sm:py-16 md:grid-cols-3 lg:grid-cols-5 max-w-7xl lg:px-8">
        {/* Brand col */}
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-foreground/10 font-display text-xl text-primary-foreground">
              m
            </span>
            <span className="font-display text-xl">Moments Packaging</span>
          </div>
        </div>

        {/* Shop col */}
        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/60">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/products" className="hover:text-accent">
                All products
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link to={`/products?category=${c.slug}`} className="hover:text-accent">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/products?deals=true" className="hover:text-accent">
                Deals
              </Link>
            </li>
          </ul>
        </div>

        {/* Explore col */}
        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/60">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/industries" className="hover:text-accent">
                Industries
              </Link>
            </li>
            <li>
              <Link to="/blog" className="hover:text-accent">
                Blog
              </Link>
            </li>
            <li>
              <Link to="/company-profile" className="hover:text-accent">
                Company Profile
              </Link>
            </li>
            <li>
              <Link to="/sustainability" className="hover:text-accent">
                Sustainability
              </Link>
            </li>
            <li>
              <Link to="/orders/track" className="hover:text-accent">
                Track Order
              </Link>
            </li>
            <li>
              <Link to="/enterprise-quote" className="hover:text-accent">
                Enterprise Quote
              </Link>
            </li>
          </ul>
        </div>

        {/* Support col */}
        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/60">Support</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/faq" className="hover:text-accent">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" className="hover:text-accent">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/payment-methods" className="hover:text-accent">
                Payment methods
              </Link>
            </li>
            <li>
              <Link to="/careers" className="hover:text-accent">
                Careers
              </Link>
            </li>
            <li>
              <Link to="/become-a-partner" className="hover:text-accent">
                Become a partner
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact col */}
        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/60">Contact</h4>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <a href="tel:+254119556688" className="hover:text-accent">
                {COMPANY_PHONE}
              </a>
              <span aria-hidden>/</span>
              <a href="tel:+254119556699" className="hover:text-accent">
                {COMPANY_PHONE_ALT}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-accent"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span>WhatsApp: 0119-55-66-88</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${COMPANY_EMAIL}`} className="flex items-center gap-2 hover:text-accent">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <span className="break-all">{COMPANY_EMAIL}</span>
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{COMPANY_ADDRESS}</span>
            </li>
          </ul>
          <div className="mt-5 flex items-center gap-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @moments_packaging"
              className="grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/20 transition hover:border-accent hover:text-accent"
            >
              <Instagram className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok moments Packaging"
              className="grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/20 transition hover:border-accent hover:text-accent"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook moments Packaging"
              className="grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/20 transition hover:border-accent hover:text-accent"
            >
              <Facebook className="h-4 w-4" aria-hidden />
            </a>
          </div>
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50">We accept</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/70">
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">M-Pesa</span>
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">Bank Transfer</span>
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">Cash on Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-primary-foreground/60 sm:flex-row lg:px-8">
          <p>© {new Date().getFullYear()} Moments Packaging Kenya Ltd. All rights reserved.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => setOpenPolicy("privacy")} className="hover:text-accent">
              Privacy Policy
            </button>
            <button type="button" onClick={() => setOpenPolicy("terms")} className="hover:text-accent">
              Terms of Service
            </button>
            <button type="button" onClick={() => setOpenPolicy("refunds")} className="hover:text-accent">
              Refunds &amp; Returns
            </button>
            <Link to="/contact" className="hover:text-accent">
              Contact
            </Link>
          </nav>
        </div>
      </div>

      {openPolicy && <PolicyModal policyKey={openPolicy} onClose={() => setOpenPolicy(null)} />}
    </footer>
  );
}

import { Link } from "react-router-dom";

import { Phone, Mail, MapPin, Instagram, MessageCircle, Facebook } from "lucide-react";
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
import logoUrl from "@/assets/moments_logo_without_background.png";

export function SiteFooter() {
  return (
    <footer
      className="mt-16 border-t border-border text-primary-foreground sm:mt-24"
      style={{
        /* Match the hero section's radial green gradient */
        background: "radial-gradient(ellipse at 100% 0%, #0d3320 0%, #08231a 60%, #061a13 100%)",
      }}
    >
      <div className="mx-auto grid gap-8 px-5 py-12 sm:grid-cols-2 sm:gap-10 sm:py-16 md:grid-cols-3 lg:grid-cols-5 max-w-7xl lg:px-8">
        {/* Brand col — logo (links home) with the legal/support pages
            stacked right below it, so the page finder for those four pages
            lives in one place instead of its own separate full-width row. */}
        <div>
          <Link to="/" aria-label="Moments Packaging Kenya — Home" className="inline-flex">
            <img src={logoUrl} alt="Moments Packaging Kenya logo" width={160} height={40} className="h-24 w-auto" />
          </Link>
          <nav aria-label="Legal and support" className="mt-4 flex flex-col gap-2.5">
            <Link to="/privacy" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Terms of Service
            </Link>
            <Link to="/rewards-terms" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Rewards &amp; Coupons Terms
            </Link>
            <Link to="/refunds" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Refunds &amp; Returns
            </Link>
            <Link to="/accessibility-policy" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Accessibility
            </Link>
            <Link to="/contact" className="text-sm font-medium text-primary-foreground hover:text-accent">
              Contact Us
            </Link>
          </nav>
        </div>

        {/* Shop col */}
        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/80">Shop</h4>
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
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/80">Explore</h4>
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
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/80">Support</h4>
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
          <h4 className="font-display text-sm uppercase tracking-widest text-primary-foreground/80">Contact</h4>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/90">
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <a href="tel:+254119556688" className="whitespace-nowrap hover:text-accent">
                {COMPANY_PHONE}
              </a>
              <span aria-hidden>/</span>
              <a href="tel:+254119556699" className="whitespace-nowrap hover:text-accent">
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/75">We accept</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/85">
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">M-Pesa</span>
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">Bank Transfer</span>
              <span className="rounded-full border border-primary-foreground/20 px-2.5 py-1">Cash on Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto px-5 py-6 text-center text-xs text-primary-foreground/80 lg:px-8">
          <p>© {new Date().getFullYear()} Moments Packaging Kenya Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

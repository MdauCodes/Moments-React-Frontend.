
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS } from "@/data/products";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";
import { SiteLayout } from "@/components/SiteLayout";



/** Shared by the /terms route and the footer's policy modal, so the content
 * lives in exactly one place. */
export function getTermsContent() {
  const sections: LegalSection[] = [
    {
      id: "who-we-are",
      title: "Who we are",
      body: (
        <p>
          Moments Packaging Kenya Ltd is a Kenyan-registered business based at {COMPANY_ADDRESS}.
          We design, print and deliver custom paper packaging — bags, boxes, cups, mailers, labels
          and gifting packaging — to restaurants, retailers and brands across Kenya.
        </p>
      ),
    },
    {
      id: "quotes-orders",
      title: "Quotes & orders",
      body: (
        <ul>
          <li>
            Catalogue prices on the site apply to standard stock and standard print. Custom
            artwork, custom sizes or rush turnarounds may be quoted separately.
          </li>
          <li>
            A quote is valid for 14 days unless stated otherwise. Prices may change after that due
            to paper or print-cost movements.
          </li>
          <li>
            An order is only confirmed once we receive payment (or the agreed deposit) and you
            have approved the final artwork proof.
          </li>
        </ul>
      ),
    },
    {
      id: "pricing-payment",
      title: "Pricing & payment",
      body: (
        <ul>
          <li>All prices are in Kenya Shillings (KES) and, where stated, include VAT.</li>
          <li>
            We accept <strong>M-Pesa</strong>, <strong>bank transfer</strong>, and (for select
            customers) <strong>cash on delivery</strong>. For large or enterprise orders we may
            require a 50% deposit before production starts.
          </li>
          <li>
            M-Pesa payments are processed via Safaricom. You are responsible for entering the
            correct M-Pesa number and confirming the STK push.
          </li>
        </ul>
      ),
    },
    {
      id: "delivery",
      title: "Delivery, pickup & own courier",
      body: (
        <ul>
          <li>
            <strong>Zone delivery:</strong> we deliver within our published delivery zones at the
            rate shown at checkout.
          </li>
          <li>
            <strong>Pickup:</strong> you can collect free of charge from our premises at{" "}
            {COMPANY_ADDRESS} during business hours. We will WhatsApp you when the order is ready.
          </li>
          <li>
            <strong>Own courier (Matatu, parcel service, etc.):</strong> when you choose this
            option, our team will call you at dispatch to confirm the transport cost. You may pay
            that cost directly to the courier or settle it with us. Once goods leave our premises
            with your nominated courier, risk passes to you.
          </li>
          <li>Please inspect goods on receipt and report any visible damage within 24 hours.</li>
        </ul>
      ),
    },
    {
      id: "returns",
      title: "Returns, refunds & reprints",
      body: (
        <ul>
          <li>
            Custom-printed products are made specifically for you and cannot be returned for a
            change of mind.
          </li>
          <li>
            If a product is defective or differs materially from the approved proof, contact us
            within 7 days of delivery. We will reprint or refund at our discretion after reviewing
            the issue. Full details are in our{" "}
            <a href="/refunds">Refund &amp; Returns Policy</a>.
          </li>
          <li>
            We are not responsible for losses caused by errors in artwork you approved, or by
            third-party couriers you chose.
          </li>
        </ul>
      ),
    },
    {
      id: "cancellations",
      title: "Cancellations",
      body: (
        <p>
          You can cancel an order at no cost before artwork is approved and production starts.
          Once production has started, cancellation may incur charges for materials, plates and
          labour already used.
        </p>
      ),
    },
    {
      id: "accounts",
      title: "Accounts",
      body: (
        <p>
          You are responsible for keeping your account password confidential and for all activity
          under your account. Notify us immediately at{" "}
          <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> if you suspect unauthorised
          access.
        </p>
      ),
    },
    {
      id: "business-accounts",
      title: "Business Accounts",
      body: (
        <>
          <p>
            Any registered customer may open a free Business Account by providing basic details —
            registered business name, KRA PIN, location, road and building address, phone number,
            and a contact person with their designation. Opening one is instant and does not
            require our approval.
          </p>
          <ul>
            <li>
              Opening a Business Account issues a single-use welcome discount code, valid only on
              that account and redeemable once against a future order. It does not itself grant any
              ongoing discount, credit terms, or special pricing.
            </li>
            <li>
              We use the information you provide, together with your order history on the account,
              to understand your business's purchasing pattern. This is not shared or sold to third
              parties, and is used only for verification and, where you choose to apply, for
              assessing eligibility for trade credit.
            </li>
            <li>
              A Business Account is a separate, later application from a trade credit (buy-on-account)
              facility. Trade credit requires additional documentation and a credit assessment, and
              is granted at our discretion.
            </li>
            <li>
              We may suspend a Business Account, or request further verification of the details
              provided, at any time — for example if information appears inaccurate or the account
              is being misused.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <p>
          You agree not to misuse the site (for example: hacking, scraping at abusive rates,
          uploading malware, or submitting artwork that is unlawful, defamatory or infringes
          third-party rights).
        </p>
      ),
    },
    {
      id: "ip",
      title: "Intellectual property",
      body: (
        <p>
          The Moments Packaging name, logo, website design, product photography and catalogue
          copy are owned by Moments Packaging Kenya Ltd. You may not copy, republish or use them
          commercially without our written permission. Your own artwork remains your property.
        </p>
      ),
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <p>
          To the maximum extent permitted by Kenyan law, our total liability for any claim
          relating to an order is limited to the amount you paid for that order. We are not
          liable for indirect or consequential losses such as lost profits or lost business
          opportunities.
        </p>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law",
      body: (
        <p>
          These Terms are governed by the laws of Kenya. Any dispute will be subject to the
          exclusive jurisdiction of the courts of Kenya, sitting in Nairobi.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      body: (
        <p>
          We may update these Terms from time to time. The version in force is the one published
          on this page at the time you place your order.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact us",
      body: (
        <p>
          Moments Packaging Kenya Ltd
          <br />
          {COMPANY_ADDRESS}
          <br />
          Email: <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
          <br />
          Phone / WhatsApp:{" "}
          <a href={`tel:${COMPANY_PHONE.replace(/\s/g, "")}`}>{COMPANY_PHONE}</a>
        </p>
      ),
    },
  ];

  return {
    title: "Terms of Service",
    updated: "May 19, 2026",
    intro: (
      <>
        The terms that govern quotes, orders, payment, production, delivery and returns when
        you buy custom-branded paper packaging from Moments Packaging Kenya. By placing an
        order or using the site, you agree to these Terms.
      </>
    ),
    sections,
    related: [
      { to: "/", label: "Home" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/refunds", label: "Refund & Returns Policy" },
    ],
  };
}

function TermsPage() {
  const content = getTermsContent();
  return (
    <SiteLayout>
      <LegalPageLayout {...content} />
    </SiteLayout>
  );
}

export default TermsPage;

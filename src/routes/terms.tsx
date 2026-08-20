
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
          Moments Packaging Kenya Ltd is a Kenyan-registered business based at {COMPANY_ADDRESS}. We
          provide high-quality packaging solutions for businesses across a wide range of industries,
          including food &amp; beverage, retail, hospitality, healthcare, beauty, and e-commerce. Our
          extensive product range includes paper bags, food packaging, cups, boxes, containers, labels,
          gift packaging, and other packaging essentials.
        </p>
      ),
    },
    {
      id: "quotes-orders",
      title: "Quotes & orders",
      body: (
        <ul>
          <li>
            Catalogue prices on the site apply to the stock packaging as listed. Bulk or
            wholesale quantities may be quoted separately.
          </li>
          <li>
            A quote is valid for 14 days unless stated otherwise. Prices may change after that due
            to paper or stock-cost movements.
          </li>
          <li>
            An order is only confirmed once we receive payment (or the agreed deposit).
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
            require a 50% deposit before dispatch.
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
      title: "Returns, refunds & replacements",
      body: (
        <ul>
          <li>
            Our packaging is ready-made stock, not printed or branded to order — we don't offer
            change-of-mind returns once an order has been delivered or collected.
          </li>
          <li>
            If a product is defective, or differs materially from what you ordered, contact us
            within 7 days of delivery. We will replace or refund at our discretion after reviewing
            the issue. Full details are in our{" "}
            <a href="/refunds">Refund &amp; Returns Policy</a>.
          </li>
          <li>
            We are not responsible for losses caused by third-party couriers you chose.
          </li>
        </ul>
      ),
    },
    {
      id: "cancellations",
      title: "Cancellations",
      body: (
        <p>
          Once an order has been paid, it cannot be cancelled.
        </p>
      ),
    },
    {
      id: "accounts",
      title: "Accounts",
      body: (
        <>
          <p>
            You are responsible for keeping your account password confidential and for all
            activity under your account. Notify us immediately at{" "}
            <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> if you suspect unauthorised
            access.
          </p>
          <p>
            You can view or delete the personal data we hold about you at any time — from your
            account settings if you have an account, or via{" "}
            <a href="/manage-my-data">View or delete your data</a> if you ordered as a guest, sent
            us an enquiry, or joined our newsletter without an account. See our{" "}
            <a href="/privacy">Privacy Policy</a> for the full details of your rights under the
            Data Protection Act, 2019.
          </p>
        </>
      ),
    },
    {
      id: "reward-coupons",
      title: "Reward Coupons & Referrals",
      body: (
        <>
          <p>
            Every registered customer — whether an Individual Shopper or a Business Account —
            earns Reward Coupons, including:
          </p>
          <ul>
            <li>1000 Coupon Points when creating an account.</li>
            <li>Coupon Points for every completed and paid order.</li>
            <li>Coupon Points for submitting eligible product reviews.</li>
          </ul>
          <p>
            The number of Coupon Points awarded per order, as well as their redemption value in
            KES, is determined by Moments Packaging and may change from time to time. The current
            earning and redemption rates are always displayed in your account dashboard before
            redemption.
          </p>
          <p>
            Coupon Points may be redeemed for discounts at checkout, up to the maximum percentage
            allowed for each order, as shown in your dashboard. Coupon Points cannot be redeemed
            for cash, transferred to another customer, or combined with a promotional code on the
            same order.
          </p>
          <p>
            When you share your referral code and a new customer registers using it, both you and
            your referral will receive Reward Coupons once their first qualifying order has been
            successfully completed.
          </p>
          <p>
            The validity period of Reward Coupons, referral rewards, and promotional offers is
            determined by Moments Packaging. Coupon Points earned beyond their validity period may
            expire and no longer be eligible for redemption. Redeeming Coupon Points above the
            free redemption threshold may also require a verified email address to help prevent
            fraud.
          </p>
          <p>
            Moments Packaging reserves the right to adjust or reverse Reward Coupon balances that
            result from technical errors, fraudulent activity, misuse of the referral program, or
            any other abuse of the rewards system.
          </p>
        </>
      ),
    },
    {
      id: "business-accounts",
      title: "Business Accounts",
      body: (
        <>
          <p>
            Any registered customer — including sole proprietors, SMEs, and registered
            companies — may open a Business Account free of charge by providing the following
            information:
          </p>
          <ul>
            <li>Business name</li>
            <li>Business type</li>
            <li>Business location</li>
            <li>Road and building address</li>
            <li>Phone number</li>
            <li>Contact person and designation</li>
          </ul>
          <p>
            Providing a KRA PIN is optional when opening a Business Account. It is only required
            if you later apply for a Trade Credit Account.
          </p>
          <p>Business Accounts are created instantly and do not require prior approval.</p>
          <p>
            Opening a Business Account automatically qualifies the account for a single-use
            welcome discount code, which may be redeemed once on a future eligible order. The
            welcome offer does not provide ongoing discounts, trade credit, special pricing, or
            any other permanent benefits.
          </p>
          <p>
            The information you provide, together with your order history, helps us better
            understand your business's purchasing needs. This information is never sold or shared
            with third parties and is used solely for account verification and, where applicable,
            assessing eligibility for Trade Credit.
          </p>
          <p>
            A Business Account is separate from a Trade Credit (Buy-on-Account) facility. Trade
            Credit requires additional documentation — including a valid KRA PIN — and is subject
            to a credit assessment and approval at the sole discretion of Moments Packaging.
          </p>
          <p>
            We reserve the right to request additional verification or suspend a Business Account
            at any time if the information provided appears inaccurate, incomplete, fraudulent, or
            if the account is being misused.
          </p>
        </>
      ),
    },
    {
      id: "welcome-offer",
      title: "Welcome offer terms",
      body: (
        <ul>
          <li>This offer is valid on orders of KES 5,000 or more.</li>
          <li>Limited to one redemption per customer.</li>
          <li>This offer cannot be combined with any other promotions, discounts, or special offers.</li>
          <li>Customers must be registered with Moments Packaging (K) Ltd and logged into their account to redeem the offer.</li>
          <li>Guest users are not eligible to use this discount.</li>
          <li>The offer is valid for 30 days from the date of registration and sign-in on the Moments Packaging website.</li>
          <li>The offer is available exclusively for orders placed through the Moments Packaging website and does not apply to purchases made through other sales channels.</li>
          <li>Offer is available on eligible products only and is subject to product availability.</li>
          <li>The offer has no cash value and cannot be exchanged for cash or transferred to another customer.</li>
          <li>While stocks last.</li>
        </ul>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <p>
          You agree not to misuse the site (for example: hacking, scraping at abusive rates, or
          uploading malware).
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
          commercially without our written permission.
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
        The terms that govern quotes, orders, payment, delivery and returns when you buy
        packaging from Moments Packaging Kenya. By placing an order or using the site, you agree
        to these Terms.
      </>
    ),
    sections,
    related: [
      { to: "/", label: "Home" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/refunds", label: "Refund & Returns Policy" },
      { to: "/accessibility-policy", label: "Accessibility Policy" },
    ],
  };
}

/** Focused subset of the full Terms — just Reward Coupons, Business Accounts, and the welcome
 *  offer — for contexts where a customer wants only the discount/coupon rules, not the entire
 *  Terms of Service. Pulled from the same section objects as getTermsContent() so the wording
 *  never drifts between the two. */
export function getRewardsOfferContent() {
  const full = getTermsContent();
  const ids = ["reward-coupons", "business-accounts", "welcome-offer"];
  return {
    title: "Rewards, Referrals & Welcome Offer Terms",
    updated: full.updated,
    intro: (
      <>
        The rules that govern Reward Coupons, referrals, and the Business Account welcome
        discount code. For everything else — orders, payment, delivery, returns — see the full{" "}
        <a href="/terms">Terms of Service</a>.
      </>
    ),
    sections: full.sections.filter((s) => ids.includes(s.id)),
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

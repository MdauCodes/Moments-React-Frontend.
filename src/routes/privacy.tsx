
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS } from "@/data/products";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";
import { SiteLayout } from "@/components/SiteLayout";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";



/** Shared by the /privacy route and the footer's policy modal, so the
 * content lives in exactly one place. */
export function getPrivacyPolicyContent() {
  const sections: LegalSection[] = [
    {
      id: "who-we-are",
      title: "Who we are",
      body: (
        <>
          <p>
            Moments Packaging Kenya Ltd (&ldquo;Moments Packaging&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
            is the data controller responsible for personal information collected through{" "}
            <strong>momentspackaging.com</strong>. We are based at {COMPANY_ADDRESS}. This policy
            is issued in compliance with the{" "}
            <strong>Kenya Data Protection Act, 2019</strong> and its supporting regulations.
          </p>
          <p>
            For any privacy matter — including data access, correction or deletion requests —
            contact our data protection contact at{" "}
            <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> or{" "}
            <a href={`tel:${COMPANY_PHONE.replace(/\s/g, "")}`}>{COMPANY_PHONE}</a>.
          </p>
        </>
      ),
    },
    {
      id: "odpc",
      title: "ODPC registration",
      body: (
        <p>
          Moments Packaging Kenya Ltd is registered as a <strong>Data Controller</strong> with the
          Office of the Data Protection Commissioner (ODPC) of Kenya, under registration number{" "}
          <strong>134-4514-F461</strong>. The certificate is valid from 19 August 2026 to 19 August
          2028.
        </p>
      ),
    },
    {
      id: "what-we-collect",
      title: "What personal data we collect",
      body: (
        <>
          <p>We collect data through the following forms and touchpoints on this site:</p>
          <ul>
            <li>
              <strong>Account registration &amp; login</strong> (<code>/account/register</code>,{" "}
              <code>/account/login</code>, <code>/account/forgot-password</code>,{" "}
              <code>/account/reset-password</code>): full name, email address, phone number, and
              password (stored hashed).
            </li>
            <li>
              <strong>Profile</strong> (<code>/account/profile</code>): business name, default
              delivery county, town and address details, and marketing preferences.
            </li>
            <li>
              <strong>Checkout</strong> (<code>/checkout</code>): billing name, email, phone,
              M-Pesa number, destination address (county, town, nearest courier office), dispatch
              details (sacco / parcel-service name, Nairobi stage or office), order items and any
              delivery notes.
            </li>
            <li>
              <strong>Order tracking</strong> (<code>/orders/track</code>): order reference and
              email/phone used to look up an order.
            </li>
            <li>
              <strong>Contact &amp; enterprise quote forms</strong> (<code>/contact</code>,{" "}
              <code>/enterprise-quote</code>): name, business name, email, phone, message,
              expected volumes and any uploaded artwork files.
            </li>
            <li>
              <strong>Newsletter / insider email prompt</strong>: email address (only if you opt
              in).
            </li>
            <li>
              <strong>Product reviews</strong>: name shown with the review, rating and review text.
            </li>
            <li>
              <strong>WhatsApp, phone and email</strong> conversations with our sales and support
              team, kept for service and audit purposes.
            </li>
            <li>
              <strong>Usage data</strong>: pages visited, device type, approximate location and
              referrer, collected via cookies and local storage (cart, wishlist, session).
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "legal-basis",
      title: "Why we collect it and our legal basis",
      body: (
        <table>
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Legal basis (Kenya DPA, 2019)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Create and secure your account; verify your email/phone.</td>
              <td>Contract performance; legitimate interest in account security.</td>
            </tr>
            <tr>
              <td>Process quotes, orders, M-Pesa payments, production, dispatch and delivery.</td>
              <td>Contract performance.</td>
            </tr>
            <tr>
              <td>Produce custom-printed packaging from artwork you upload.</td>
              <td>Contract performance.</td>
            </tr>
            <tr>
              <td>Send order confirmations, dispatch and delivery updates.</td>
              <td>Contract performance.</td>
            </tr>
            <tr>
              <td>Provide WhatsApp, phone and email support.</td>
              <td>Contract performance; legitimate interest in customer service.</td>
            </tr>
            <tr>
              <td>Send marketing about new products, deals and bulk-order offers.</td>
              <td>Consent (you can withdraw at any time).</td>
            </tr>
            <tr>
              <td>Keep tax, accounting and audit records (invoices, M-Pesa references).</td>
              <td>Legal obligation (KRA &amp; Companies Act).</td>
            </tr>
            <tr>
              <td>Detect fraud, abuse and secure the platform.</td>
              <td>Legitimate interest.</td>
            </tr>
          </tbody>
        </table>
      ),
    },
    {
      id: "third-parties",
      title: "Third parties that receive or process your data",
      body: (
        <>
          <p>
            We only share personal data with vetted processors, strictly to deliver the service you
            asked for:
          </p>
          <ul>
            <li>
              <strong>Safaricom PLC (M-Pesa)</strong> — to process mobile-money payments. Your
              M-Pesa number and transaction reference are shared with Safaricom.
            </li>
            <li>
              <strong>Banks</strong> — when you pay by bank transfer, for reconciliation.
            </li>
            <li>
              <strong>Saccos, matatus and parcel services</strong> nominated by you (own-courier
              option) — we share your name, phone number and pickup town so the parcel can be
              collected.
            </li>
            <li>
              <strong>Our own delivery riders</strong> — for zone delivery within Nairobi and
              surrounds.
            </li>
            <li>
              <strong>TumaBoda</strong> — our on-demand courier partner for real-time, tracked
              deliveries. For orders you choose to have delivered this way, we share your name,
              phone number, and delivery address with TumaBoda so their assigned rider can find
              you and contact you during delivery. TumaBoda does not receive your payment details
              or order contents.
            </li>
            <li>
              <strong>Cloud hosting and database providers</strong> (Railway for our application
              backend and PostgreSQL database, Render for frontend hosting, and Cloudinary for
              file and backup storage) acting on our instructions.
            </li>
            <li>
              <strong>WhatsApp / Meta</strong> — when you message us via WhatsApp Business.
            </li>
            <li>
              <strong>Brevo</strong> — our transactional and (where you opted in) marketing email
              provider, used to send order confirmations, account and delivery notifications, and
              newsletters.
            </li>
            <li>
              <strong>Regulators, ODPC and law enforcement</strong> where we are legally required
              to disclose.
            </li>
          </ul>
          <p>We never sell your personal data.</p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and local storage",
      body: (
        <>
          <p>This site currently uses the following cookie / local-storage categories:</p>
          <ul>
            <li>
              <strong>Strictly necessary:</strong> session, authentication, CSRF, cart contents,
              wishlist, persona selection and a one-time splash flag. Without these the site
              cannot function — they do not require consent.
            </li>
            <li>
              <strong>Functional:</strong> remembering your preferred county, recently viewed
              products and admin UI preferences. They improve usability and persist your choices.
            </li>
            <li>
              <strong>Analytics:</strong> if and when we enable a privacy-friendly analytics tool,
              it will measure anonymous page views and traffic sources so we can improve the
              catalogue. No analytics scripts are loaded today; we will update this list before
              any are added.
            </li>
            <li>
              <strong>Marketing:</strong> we do not currently run third-party advertising pixels
              (Meta, Google Ads, TikTok). If we add them, we will request your consent first via
              a cookie banner.
            </li>
          </ul>
          <p>
            You can clear or block cookies in your browser settings, but parts of checkout and
            your account may stop working.
          </p>
        </>
      ),
    },
    {
      id: "artwork",
      title: "Artwork & intellectual property",
      body: (
        <p>
          Logos, photos and artwork you upload remain your property. We use them only to produce
          your order. We may keep a copy on file so repeat orders are faster — email us if you want
          it deleted.
        </p>
      ),
    },
    {
      id: "retention",
      title: "How long we keep your data",
      body: (
        <ul>
          <li>Order, invoice, M-Pesa and tax records: at least 7 years (KRA requirement).</li>
          <li>Account profile: while your account is active, plus 12 months after closure.</li>
          <li>Marketing list: until you unsubscribe.</li>
          <li>Support conversations (WhatsApp/email): up to 24 months.</li>
        </ul>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <p>
          Data is transmitted over HTTPS and stored with reputable cloud providers in encrypted
          form. Passwords are hashed. Access is limited to staff who need it. No system is 100%
          secure — please use a strong, unique password.
        </p>
      ),
    },
    {
      id: "rights",
      title: "Your rights under the Data Protection Act, 2019",
      body: (
        <>
          <p>As a data subject in Kenya, you have the right to:</p>
          <ul>
            <li>Be informed of how your data is used (this policy).</li>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete data.</li>
            <li>Request deletion (&ldquo;right to be forgotten&rdquo;) where the law allows.</li>
            <li>Object to processing, including direct marketing.</li>
            <li>Request data portability in a commonly used format.</li>
            <li>Withdraw consent at any time, without affecting prior lawful processing.</li>
            <li>
              Lodge a complaint with the{" "}
              <strong>Office of the Data Protection Commissioner (ODPC)</strong> via{" "}
              <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">
                www.odpc.go.ke
              </a>
              .
            </li>
          </ul>
          <p>
            To submit a data request, email{" "}
            <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> with the subject line
            &ldquo;DPA Request&rdquo; and include enough information to verify your identity (e.g.
            the email or phone on your account). We will respond within 30 days as required by
            the Act.
          </p>
          <p>
            <strong>Self-service, no email needed:</strong> if you have an account, you can view
            or delete your data from your account settings once logged in. If you ordered as a
            guest, sent us an enquiry, or joined our newsletter without creating an account, use{" "}
            <Link to="/manage-my-data">View or delete your data</Link> — enter your email, confirm
            a one-time code, and you can see what we hold and request deletion directly, without
            needing to email us. To start a refund or return on an eligible order instead, see{" "}
            <Link to="/account/orders">Request a refund or return</Link>.
          </p>
          <p>
            <strong>If we don&rsquo;t respond in time:</strong> a data deletion request that
            receives no admin decision within 30 days of submission is automatically granted —
            we do not rely on inaction to keep data we should have deleted.
          </p>
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <p>
          Our service is intended for businesses and adults. We do not knowingly collect data from
          children under 18.
        </p>
      ),
    },
    {
      id: "transfers",
      title: "International transfers",
      body: (
        <p>
          Some of our processors (e.g. cloud hosting and email) may process data on servers
          outside Kenya. Where this happens we rely on contractual safeguards as required by the
          DPA, 2019.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the
          top reflects the current version. Material changes will be notified by email or a notice
          on the site.
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
    title: "Privacy Policy",
    updated: PRIVACY_POLICY_VERSION,
    intro: (
      <>
        How Moments Packaging Kenya collects, uses, shares and protects your personal data when
        you visit our site, request a quote, place an order, or message us — in line with the{" "}
        <strong>Kenya Data Protection Act, 2019</strong>.
      </>
    ),
    sections,
    related: [
      { to: "/", label: "Home" },
      { to: "/terms", label: "Terms of Service" },
      { to: "/refunds", label: "Refund & Returns Policy" },
      { to: "/accessibility-policy", label: "Accessibility Policy" },
      { to: "/manage-my-data", label: "View or Delete Your Data" },
      { to: "/account/orders", label: "Request a Refund or Return" },
    ],
  };
}

function PrivacyPage() {
  useEffect(() => { document.title = "Privacy Policy — Moments Packaging Kenya"; }, []);
  const content = getPrivacyPolicyContent();
  return (
    <SiteLayout>
      <LegalPageLayout {...content} />
    </SiteLayout>
  );
}

export default PrivacyPage;

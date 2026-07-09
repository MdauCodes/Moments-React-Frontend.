
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS } from "@/data/products";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";
import { SiteLayout } from "@/components/SiteLayout";



/** Shared by the /refunds route and the footer's policy modal, so the
 * content lives in exactly one place. */
export function getRefundsContent() {
  const sections: LegalSection[] = [
    {
      id: "when-applies",
      title: "When a refund or reprint applies",
      body: (
        <>
          <p>You may request a refund, free reprint or replacement if:</p>
          <ul>
            <li>
              The goods arrive <strong>materially defective</strong> (e.g. torn, wet, mis-glued,
              badly mis-printed).
            </li>
            <li>
              The order <strong>differs materially from the approved artwork proof</strong>{" "}
              (wrong colours beyond normal print tolerance, missing text/logo, wrong size).
            </li>
            <li>
              We delivered the <strong>wrong product or wrong quantity</strong>.
            </li>
            <li>
              An order paid for in full was <strong>never produced or dispatched</strong> due to
              our error.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "when-declined",
      title: "When a refund will not be approved",
      body: (
        <ul>
          <li>
            <strong>Change of mind</strong> on custom-printed items. Once you approve the artwork
            proof, the print run is made for you and cannot be resold.
          </li>
          <li>
            Errors in artwork you supplied and approved (typos, wrong logo version, wrong
            Pantone).
          </li>
          <li>
            Minor colour variation between batches or between screen and print — this is normal
            in commercial printing and is not a defect.
          </li>
          <li>
            Damage caused by a <strong>third-party courier or sacco that you nominated</strong>{" "}
            (own-courier option). Once goods leave our premises with your chosen transporter,
            risk passes to you. We will help you raise the claim with them where we can.
          </li>
          <li>Damage caused by misuse, exposure to water, or improper storage after delivery.</li>
          <li>
            Requests made more than <strong>7 days</strong> after delivery.
          </li>
        </ul>
      ),
    },
    {
      id: "how-to-request",
      title: "How to request a refund",
      body: (
        <>
          <p>
            All refund requests must be initiated by contacting our admin team{" "}
            <strong>by email</strong> at{" "}
            <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> with the subject line{" "}
            &ldquo;Refund Request — [your order reference]&rdquo;. Please include:
          </p>
          <ul>
            <li>
              Your <strong>order reference number</strong> (e.g. MP-XXXXXX) and order date.
            </li>
            <li>The name, email and phone number used at checkout.</li>
            <li>A clear description of the issue and the reason for the refund request.</li>
            <li>
              <strong>Supporting evidence</strong>: clear photos or short videos of the defective
              goods, the packaging they arrived in, and (where relevant) a photo of the approved
              artwork proof alongside the printed item.
            </li>
            <li>Whether you would prefer a refund, a free reprint, or store credit.</li>
          </ul>
          <p>
            You can also message us on WhatsApp at{" "}
            <a href={`tel:${COMPANY_PHONE.replace(/\s/g, "")}`}>{COMPANY_PHONE}</a> to flag the
            issue quickly, but the formal request must still come through email so we have a
            written record.
          </p>
        </>
      ),
    },
    {
      id: "timeline",
      title: "Our review process and timelines",
      body: (
        <ul>
          <li>
            We acknowledge every refund request within <strong>2 business days</strong>.
          </li>
          <li>
            Our production team reviews the evidence and, if needed, asks for the affected goods
            to be returned to our shop in Nairobi (we will arrange and cover return transport for
            confirmed defects).
          </li>
          <li>
            We aim to issue a final decision within <strong>7 business days</strong> of receiving
            all evidence (or the returned goods, where applicable).
          </li>
          <li>
            Approved refunds are paid back to the original payment method — M-Pesa or bank
            transfer — within <strong>5 business days</strong> of approval.
          </li>
        </ul>
      ),
    },
    {
      id: "alternatives",
      title: "Reprints, exchanges and store credit",
      body: (
        <>
          <p>
            Because most issues with custom packaging are best fixed by re-running the affected
            portion of the print job, our default remedy is a <strong>free reprint</strong> of
            the defective units, on the same artwork and stock, with priority production. Where
            a reprint isn&apos;t practical we offer:
          </p>
          <ul>
            <li>
              <strong>Store credit</strong> equal to the value of the affected units, usable
              against any future order within 12 months.
            </li>
            <li>
              <strong>A monetary refund</strong> to your M-Pesa or bank account.
            </li>
          </ul>
          <p>
            Direct product-for-product exchanges only apply to standard (non-printed) stock
            items — custom-printed items cannot be exchanged.
          </p>
        </>
      ),
    },
    {
      id: "cancellations",
      title: "Cancellations before production",
      body: (
        <p>
          You can cancel an order at no cost <strong>before</strong> you approve the artwork proof
          and before production starts. Once we have started cutting, printing or plate-making,
          cancellation fees may apply to cover materials and labour already used.
        </p>
      ),
    },
    {
      id: "pickup-own-courier",
      title: "Pickup & own-courier orders",
      body: (
        <ul>
          <li>
            <strong>Shop pickup:</strong> please inspect your order at the counter before you
            leave. We will help resolve any issue immediately.
          </li>
          <li>
            <strong>Own courier / sacco:</strong> please ask the matatu or parcel-service office
            to open the parcel in your presence and report any visible damage to them on the
            spot. Keep the waybill and email us within 24 hours with photos.
          </li>
          <li>
            <strong>Our delivery:</strong> please inspect on receipt and report any visible
            damage within 24 hours.
          </li>
        </ul>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law",
      body: (
        <p>
          This policy is governed by the laws of Kenya and forms part of our{" "}
          <a href="/terms">Terms of Service</a>. Where this policy and the Terms differ on the
          same point, the Terms apply.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact",
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
    title: "Refund & Returns Policy",
    updated: "May 19, 2026",
    intro: (
      <>
        Most of what we make is custom-printed for your brand, so refunds and returns work a
        little differently than at a standard retail shop. Here&apos;s when a refund applies,
        how to request one, and what to expect.
      </>
    ),
    sections,
    related: [
      { to: "/", label: "Home" },
      { to: "/terms", label: "Terms of Service" },
      { to: "/privacy", label: "Privacy Policy" },
    ],
  };
}

function RefundsPage() {
  const content = getRefundsContent();
  return (
    <SiteLayout>
      <LegalPageLayout {...content} />
    </SiteLayout>
  );
}

export default RefundsPage;


import { useEffect } from "react";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS } from "@/data/products";
import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";
import { SiteLayout } from "@/components/SiteLayout";

/** Shared by the /accessibility-policy route and the footer's policy modal,
 * so the content lives in exactly one place. */
export function getAccessibilityPolicyContent() {
  const sections: LegalSection[] = [
    {
      id: "our-commitment",
      title: "Our commitment",
      body: (
        <>
          <p>
            Moments Packaging Kenya is committed to making our website usable by as many people
            as possible, including people who use screen readers, keyboard-only navigation, or
            who need larger text, higher contrast or reduced motion to browse comfortably.
          </p>
          <p>
            We are actively working toward conformance with the{" "}
            <strong>Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA</strong>. This is
            an ongoing effort rather than a one-time fix — we review and improve the site as we
            find gaps, and we welcome feedback from anyone who runs into difficulty using it.
          </p>
        </>
      ),
    },
    {
      id: "accessibility-toolbar",
      title: "The accessibility toolbar",
      body: (
        <>
          <p>
            Every page of the site (outside our internal admin dashboard) has a floating{" "}
            <strong>accessibility button in the bottom-right corner</strong>. Selecting it opens
            a panel with the following controls, which apply immediately and are remembered for
            your next visit:
          </p>
          <ul>
            <li>
              <strong>Text size</strong> — increase, decrease or reset the size of text across
              the whole site.
            </li>
            <li>
              <strong>High contrast</strong> — switches to a high-contrast black-on-white colour
              scheme for better readability.
            </li>
            <li>
              <strong>Reduce motion</strong> — turns off animations and transitions for visitors
              sensitive to motion.
            </li>
            <li>
              <strong>Underline links</strong> — makes every link on the page underlined, so
              links are distinguishable without relying on colour alone.
            </li>
            <li>
              <strong>Readable spacing</strong> — increases line height and letter spacing for
              easier reading.
            </li>
          </ul>
          <p>
            The toolbar itself is fully operable by keyboard: it can be opened and closed, and
            every control reached, using only the Tab key and Enter, with the Escape key closing
            it at any time. It is a tool we built ourselves rather than a third-party plugin, so
            we can keep improving it based on real feedback.
          </p>
        </>
      ),
    },
    {
      id: "voice-search",
      title: "Voice search",
      body: (
        <p>
          Our product search also supports voice input on supported browsers (Chrome, Edge and
          Safari on most devices) — select the microphone icon inside the search box and speak
          what you&apos;re looking for. This uses your browser&apos;s own built-in speech
          recognition; we do not record or store audio.
        </p>
      ),
    },
    {
      id: "general-practices",
      title: "General accessibility practices",
      body: (
        <ul>
          <li>Pages use semantic HTML headings and landmarks so screen readers can navigate them logically.</li>
          <li>Product images include descriptive alt text where available.</li>
          <li>Interactive elements (buttons, links, form fields) are reachable and operable by keyboard, not just mouse or touch.</li>
          <li>Colour is never the only way information is conveyed (e.g. stock status is shown with text, not colour alone).</li>
        </ul>
      ),
    },
    {
      id: "known-limitations",
      title: "Known limitations",
      body: (
        <p>
          We are not yet fully WCAG 2.1 AA conformant across every page — this is an active work
          in progress. If you encounter a page, image or feature that is not accessible to you,
          please tell us (see Feedback below) so we can prioritise fixing it.
        </p>
      ),
    },
    {
      id: "feedback",
      title: "Feedback",
      body: (
        <p>
          If you have trouble accessing any part of this website, or have suggestions for how we
          can make it more accessible, please email{" "}
          <a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a> or call/WhatsApp us at{" "}
          <a href={`tel:${COMPANY_PHONE.replace(/\s/g, "")}`}>{COMPANY_PHONE}</a>. We aim to
          respond within one business day.
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
          Phone / WhatsApp: <a href={`tel:${COMPANY_PHONE.replace(/\s/g, "")}`}>{COMPANY_PHONE}</a>
        </p>
      ),
    },
  ];

  return {
    title: "Accessibility Policy",
    updated: "July 12, 2026",
    intro: (
      <>
        We want everyone to be able to shop with us, regardless of ability. Here&apos;s what
        we&apos;ve built so far, and how to reach us if something isn&apos;t working for you.
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

function AccessibilityPolicyPage() {
  useEffect(() => { document.title = "Accessibility Policy — Moments Packaging Kenya"; }, []);
  const content = getAccessibilityPolicyContent();
  return (
    <SiteLayout>
      <LegalPageLayout {...content} />
    </SiteLayout>
  );
}

export default AccessibilityPolicyPage;

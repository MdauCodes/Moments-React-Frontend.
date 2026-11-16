// Statement in the portal nav, until the store's credit ledger and statements (steps 3b, 5) exist.
// Says what will be here, never shows sample numbers.
import { useEffect } from "react";

import { PortalShell } from "@/components/restaurant/PortalShell";
import { ComingSoon, Muted, PortalButtonLink } from "@/components/restaurant/portalUi";

const COPY = {
  statement: {
    title: "Statement",
    doc: "Statement",
    lead: "Your credit statement will be here: what you ordered on credit, what you paid, what is due and when, as a PDF too.",
    soon: "Statements start when ordering on credit opens. Moments emails one on the 1st of each month.",
    link: { to: "/restaurant", label: "Back to home" },
  },
} as const;

export default function RestaurantSoonPage({ page }: { page: "statement" }) {
  const copy = COPY[page];
  useEffect(() => {
    document.title = `${copy.doc} · Moments Packaging`;
  }, [copy.doc]);
  return (
    <PortalShell page={page}>
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-[24px] font-bold">{copy.title}</h1>
        <Muted>{copy.lead}</Muted>
        <ComingSoon title="Coming soon" text={copy.soon} />
        <div>
          <PortalButtonLink to={copy.link.to} variant="secondary">
            {copy.link.label}
          </PortalButtonLink>
        </div>
      </div>
    </PortalShell>
  );
}

import { useState } from "react";
import { getRewardsOfferContent } from "@/routes/terms";
import { PolicyContentModal } from "@/components/PolicyContentModal";

/** Inline text link that opens just the Reward Coupons / Business Account welcome-offer terms
 *  in place — not the entire site Terms of Service — for contexts like a coupon banner or the
 *  welcome-code card where a customer only wants the discount rules, not the whole document. */
export function RewardsTermsLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-accent hover:underline"}>
        {children}
      </button>
      {open && <PolicyContentModal content={getRewardsOfferContent()} onClose={() => setOpen(false)} />}
    </>
  );
}

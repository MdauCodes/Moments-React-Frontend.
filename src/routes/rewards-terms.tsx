
import { useEffect } from "react";
import { getRewardsOfferContent } from "@/routes/terms";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { SiteLayout } from "@/components/SiteLayout";

/** A real, indexable page for the "Rewards & Coupons Terms" footer link — previously only ever
 *  rendered inside the footer's policy modal via getRewardsOfferContent() (still imported from
 *  terms.tsx so the wording stays in exactly one place). */
function RewardsTermsPage() {
  useEffect(() => { document.title = "Rewards & Coupons Terms — Moments Packaging Kenya"; }, []);
  const content = getRewardsOfferContent();
  return (
    <SiteLayout>
      <LegalPageLayout {...content} />
    </SiteLayout>
  );
}

export default RewardsTermsPage;

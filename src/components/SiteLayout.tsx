import { ReactNode, useEffect, useState } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { WhatsAppFloat } from "./WhatsAppFloat";
import { SignUpFab } from "./SignUpFab";
import { EnquireFab } from "./EnquireFab";
import { PageProgressBar } from "./PageProgressBar";
import { AppSplash } from "./AppSplash";
import { BottomNav } from "./BottomNav";
import { CookieConsent } from "./CookieConsent";
import { AddToHomeScreenPrompt } from "./AddToHomeScreenPrompt";
import { CelebratoryRewardBanner } from "./CelebratoryRewardBanner";
import { CartAddedSheet } from "./CartAddedSheet";
import { useRevealAfterActiveMs } from "@/hooks/useEngagementClock";
import { SIGNUP_FAB_REVEAL_MS } from "@/lib/engagementSignals";

// The welcome starter offer and the insider email prompt used to be mounted here (and again in
// the homepage's own copy of this layout). Both now live behind the single engagement gate
// mounted once in App.tsx — see components/engagement/EngagementPrompts.tsx.

const SPLASH_KEY = "moments_splash_shown";

function FirstVisitSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SPLASH_KEY)) return;
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShow(true);
  }, []);

  if (!show) return null;
  return <AppSplash />;
}

function LayoutShell({ children }: { children: ReactNode }) {
  // Same reveal clock SignUpFab itself reads, so the two floating buttons agree about whether the
  // lower slot is taken. (SignUpFab also hides for signed-in visitors; EnquireFab checks that for
  // itself.)
  const signUpFabPresent = useRevealAfterActiveMs(SIGNUP_FAB_REVEAL_MS);
  return (
    <>
      <FirstVisitSplash />
      <PageProgressBar />
      <div className="flex min-h-screen flex-col bg-background">
        <AddToHomeScreenPrompt />
        <CelebratoryRewardBanner />
        <SiteHeader />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <SiteFooter />
        <WhatsAppFloat />
        <SignUpFab />
        {/* EnquireFab stacks above SignUpFab when both are on screen, and drops into the lower
            slot when only it is. It has to be told which, because SignUpFab is no longer there
            from the first frame — it now waits until the visitor has actually spent time on the
            site (see SignUpFab's own comment), so assuming its presence would leave the Enquire
            button hovering above an empty gap for the first twenty seconds of every visit. */}
        <EnquireFab withSignUpFab={signUpFabPresent} />
        <CookieConsent />
        <BottomNav />
      </div>
      <CartAddedSheet />
    </>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>;
}

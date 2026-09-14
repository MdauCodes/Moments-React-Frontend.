import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { WhatsAppFloat } from "./WhatsAppFloat";
import { SignUpFab } from "./SignUpFab";
import { PageProgressBar } from "./PageProgressBar";
import { EmailInsiderPrompt } from "./EmailInsiderPrompt";
import { AppSplash } from "./AppSplash";
import { BottomNav } from "./BottomNav";
import { CookieConsent } from "./CookieConsent";
import { AddToHomeScreenPrompt } from "./AddToHomeScreenPrompt";
// Lazy — its two avatar images (~220KB combined) have no business competing with the hero image
// and fonts during the critical render path for a component that doesn't even show for 2.5s (and
// may never show at all for a logged-in visitor). Moving it into its own chunk keeps the main
// bundle lighter to parse without changing when/whether the modal itself appears.
const WelcomeStarterModal = lazy(() =>
  import("./WelcomeStarterModal").then((m) => ({ default: m.WelcomeStarterModal })),
);
import { CelebratoryRewardBanner } from "./CelebratoryRewardBanner";
import { CartAddedSheet } from "./CartAddedSheet";

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
        <EmailInsiderPrompt />
        <CookieConsent />
        <BottomNav />
      </div>
      <Suspense fallback={null}>
        <WelcomeStarterModal />
      </Suspense>
      <CartAddedSheet />
    </>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>;
}

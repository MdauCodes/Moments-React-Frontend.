import { ReactNode, useEffect, useState } from "react";
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
import { WelcomeStarterModal } from "./WelcomeStarterModal";
import { CelebratoryRewardBanner } from "./CelebratoryRewardBanner";

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
      <WelcomeStarterModal />
    </>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>;
}

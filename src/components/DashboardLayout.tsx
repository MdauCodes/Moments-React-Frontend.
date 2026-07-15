import { createContext, useContext, useState, type ReactNode } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { CookieConsent } from "@/components/CookieConsent";
import { PageProgressBar } from "@/components/PageProgressBar";

interface DashboardSidebarContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | undefined>(undefined);

/** Lets any descendant — the header's hamburger button, the page body's own
 *  sidebar nav — read/toggle the same open/closed state without prop-drilling
 *  through the layout boundary between them. */
export function useDashboardSidebar(): DashboardSidebarContextValue {
  const ctx = useContext(DashboardSidebarContext);
  if (!ctx) throw new Error("useDashboardSidebar must be used within a DashboardLayout");
  return ctx;
}

/**
 * App-shell layout for authenticated customer dashboard pages (Individual
 * Shopper, Business Account) — no SiteFooter, no BottomNav, no marketing
 * prompts (splash, email-insider). Just enough chrome to feel like a
 * distinct "cockpit" rather than another marketing page: a minimal header,
 * the WhatsApp float, and the legally-required cookie banner.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DashboardSidebarContext.Provider value={{ open, setOpen }}>
      <PageProgressBar />
      <div className="flex min-h-screen flex-col bg-background">
        <DashboardHeader />
        <main className="flex-1">{children}</main>
        <WhatsAppFloat />
        <CookieConsent />
      </div>
    </DashboardSidebarContext.Provider>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";

import { useState } from "react";
import {
  Heart,
  Home,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  ShoppingBag,
  Truck,
  User,
  Building2,
  ShieldCheck,
  Leaf,
  Percent,
  HelpCircle,
  Phone,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Persistent mobile tab bar (app-style). Replaces the old floating
 * hamburger menu so mobile navigation feels like a native shopping app
 * instead of a stack of separate floating buttons.
 *
 * "More" bundles the lower-frequency destinations (account, wishlist, live
 * chat) into one sheet so "Track Order" — a real, frequent need for a
 * B2B-ish delivery business — can get its own primary tab instead of being
 * buried in the header.
 */
export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const { whatsappNumber } = useSiteConfig();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const moreIsActive = isActive("/account") && !isActive("/account/orders");

  const chatHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        "Hi Moments Packaging, I'd like to enquire about your packaging.",
      )}`
    : null;

  const goToAccount = () => {
    setMoreOpen(false);
    navigate(isAuthenticated ? "/account/dashboard" : "/account/login");
  };
  const goToWishlist = () => {
    setMoreOpen(false);
    navigate(isAuthenticated ? "/account/wishlist" : "/account/login");
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-background/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link
          to="/"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive("/") ? "text-[var(--forest-bright)]" : "text-muted-foreground"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={isActive("/") ? 2.25 : 1.75} />
          Home
        </Link>

        <Link
          to="/products"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive("/products") ? "text-[var(--forest-bright)]" : "text-muted-foreground"
          }`}
        >
          <LayoutGrid className="h-5 w-5" strokeWidth={isActive("/products") ? 2.25 : 1.75} />
          Shop
        </Link>

        <Link
          to="/orders/track"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive("/orders/track") ? "text-[var(--forest-bright)]" : "text-muted-foreground"
          }`}
        >
          <Truck className="h-5 w-5" strokeWidth={isActive("/orders/track") ? 2.25 : 1.75} />
          Track
        </Link>

        <Link
          to="/cart"
          className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            isActive("/cart") ? "text-[var(--forest-bright)]" : "text-muted-foreground"
          }`}
        >
          <span className="relative">
            <ShoppingBag className="h-5 w-5" strokeWidth={isActive("/cart") ? 2.25 : 1.75} />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-1.5 grid min-w-[16px] h-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-foreground">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </span>
          Cart
        </Link>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
            moreOpen || moreIsActive ? "text-[var(--forest-bright)]" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={moreOpen || moreIsActive ? 2.25 : 1.75} />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl bg-background p-0 md:hidden"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg text-foreground">More</h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            <button
              type="button"
              onClick={goToAccount}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <User className="h-5 w-5 text-muted-foreground" />
              {isAuthenticated ? "My account" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={goToWishlist}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <Heart className="h-5 w-5 text-muted-foreground" />
              Wishlist
            </button>
            {chatHref && (
              <a
                href={chatHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
              >
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                Live chat
              </a>
            )}
          </div>
          {/* Same company/legal links the desktop header shows inline — mobile only ever had
              account/wishlist/chat here, so About Us, Privacy Policy, etc. were unreachable
              from the mobile nav at all. */}
          <div className="flex flex-col divide-y divide-border border-t border-border">
            <Link
              to="/company-profile"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <Building2 className="h-5 w-5 text-muted-foreground" />
              About Us
            </Link>
            <Link
              to="/privacy"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              Privacy Policy
            </Link>
            <Link
              to="/sustainability"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <Leaf className="h-5 w-5 text-muted-foreground" />
              Our Sustainability Pledge
            </Link>
            <Link
              to="/products?deals=true"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <Percent className="h-5 w-5 text-muted-foreground" />
              Deals
            </Link>
            <Link
              to="/faq"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              FAQ
            </Link>
            <Link
              to="/contact"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-foreground"
            >
              <Phone className="h-5 w-5 text-muted-foreground" />
              Contact Us
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

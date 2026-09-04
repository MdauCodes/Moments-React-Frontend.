import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";

import { useState } from "react";
import { Gift, Briefcase, Check, ShoppingBag } from "lucide-react";

import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { RegistrationDetailsWizard } from "@/components/RegistrationDetailsWizard";
import { MODAL_BG, MODAL_BORDER } from "@/lib/modalTheme";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralAttribution";

// Matches the welcome modal's cream/forest-green identity, per the brand-alignment request.
const FOREST_DEEP = "#08231a";

type AccountType = "INDIVIDUAL_SHOPPER" | "BUSINESS";

const ACCOUNT_TYPES: {
  value: AccountType;
  icon: typeof Gift;
  title: string;
  desc: string;
  perks: string[];
}[] = [
  {
    value: "INDIVIDUAL_SHOPPER",
    icon: Gift,
    title: "Individual Shopper Account",
    desc: "For individuals ordering for themselves or their own small business.",
    perks: ["Welcome bonus Reward Coupons on signup", "Earn Reward Coupons on every order", "Referral rewards & VIP tiers"],
  },
  {
    value: "BUSINESS",
    icon: Briefcase,
    title: "Business Account",
    desc: "For registered companies, SMEs and trade buyers.",
    perks: ["Welcome bonus Reward Coupons + order history for your business", "Earn Reward Coupons & referral rewards too", "First in line for trade credit"],
  },
];

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = (location.state as { returnUrl?: string } | null)?.returnUrl;
  // The URL's own ?ref= wins if present (a visitor who clicked a fresh referral link right
  // before registering); otherwise fall back to whatever ReferralCapture stashed from an
  // earlier page during this browsing session — see referralAttribution.ts for why that
  // fallback exists at all.
  const referralCode = searchParams.get("ref") ?? getStoredReferralCode();
  const preselect = searchParams.get("type");

  const [accountType, setAccountType] = useState<AccountType | null>(
    preselect === "business" ? "BUSINESS" : preselect === "merchant" ? "INDIVIDUAL_SHOPPER" : null,
  );

  function handleSuccess(result: { user: AuthUser | null }) {
    if (result.user) setSession(result.user);
    if (referralCode) clearStoredReferralCode();
    // justRegistered rides in router state (not a query param) so it survives exactly one
    // navigation and is gone on any refresh/back-button — the dashboard uses it to show a
    // proper first-visit welcome (not just this toast, which is gone in a few seconds) without
    // permanently changing what "Welcome back" means on every later visit.
    if (returnUrl) {
      toast.success("Account created — 1,000 Reward Coupons added to your wallet.");
      navigate(returnUrl, { state: { justRegistered: true } });
    } else if (accountType === "BUSINESS") {
      toast.success("Account created — 1,000 Reward Coupons added. Let's set up your business profile.");
      navigate("/account/business", { state: { justRegistered: true } });
    } else {
      toast.success("Account created — 1,000 Reward Coupons added to your wallet.");
      navigate("/account/dashboard", { state: { justRegistered: true } });
    }
  }

  if (!accountType) {
    return (
      <SiteLayout>
        <section className="px-5 py-16 lg:px-8 lg:py-20" style={{ background: MODAL_BG }}>
        <div
          className="mx-auto max-w-2xl rounded-3xl border p-6 shadow-sm sm:p-8"
          style={{ background: "#ffffff", borderColor: MODAL_BORDER }}
        >
          <h1 className="font-display text-3xl" style={{ color: FOREST_DEEP }}>Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose the account that fits how you order.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAccountType(t.value)}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-accent/50 hover:bg-secondary/30"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent">
                  <t.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 font-display text-lg">{t.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary/20 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Rather just browse?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You can still buy and track an order with no account — you just miss out on welcome Reward Coupons, order
                rewards, saved order history and referral perks.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/account/login" state={returnUrl ? { returnUrl } : undefined} className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        </section>
      </SiteLayout>
    );
  }

  const chosen = ACCOUNT_TYPES.find((t) => t.value === accountType)!;

  return (
    <SiteLayout>
      <section className="px-5 py-16 lg:px-8 lg:py-20" style={{ background: MODAL_BG }}>
      <div
        className="mx-auto max-w-md rounded-3xl border p-6 shadow-sm sm:p-8"
        style={{ background: "#ffffff", borderColor: MODAL_BORDER }}
      >
        <button
          type="button"
          onClick={() => setAccountType(null)}
          className="text-xs font-semibold text-accent hover:underline"
        >
          &larr; Change account type
        </button>
        <h1 className="mt-2 font-display text-3xl" style={{ color: FOREST_DEEP }}>{chosen.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {accountType === "BUSINESS"
            ? "Your details as the account holder. You'll add your business profile (name, address, contact info) right after this."
            : "Takes about a minute — that's it, you're in."}
        </p>
        <div className="mt-8">
          <RegistrationDetailsWizard
            accountType={accountType}
            referralCode={referralCode}
            onSuccess={handleSuccess}
          />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/account/login" state={returnUrl ? { returnUrl } : undefined} className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      </section>
    </SiteLayout>
  );
}

export default RegisterPage;

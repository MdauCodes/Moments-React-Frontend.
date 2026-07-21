import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useState, type FormEvent } from "react";
import { Gift, Briefcase, Check, ShoppingBag } from "lucide-react";

import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { PasswordInput } from "@/components/PasswordInput";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl, getSessionId } from "@/config/api";

type AccountType = "INDIVIDUAL_SHOPPER" | "BUSINESS";

const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

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
  const referralCode = searchParams.get("ref") ?? undefined;
  const preselect = searchParams.get("type");

  const [accountType, setAccountType] = useState<AccountType | null>(
    preselect === "business" ? "BUSINESS" : preselect === "merchant" ? "INDIVIDUAL_SHOPPER" : null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!consent) {
      toast.error("Please tick the consent box to continue");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
        body: JSON.stringify({
          email: email.trim(),
          firstName,
          lastName,
          phone,
          password,
          accountType,
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? "Registration failed");
      }
      const accessToken = (data as { accessToken?: string }).accessToken;
      const refreshTokenValue = (data as { refreshToken?: string }).refreshToken;
      if (accessToken) setSession(accessToken, refreshTokenValue);
      if (returnUrl) {
        toast.success("Account created — you're in.");
        navigate(returnUrl);
      } else if (accountType === "BUSINESS") {
        toast.success("Account created — let's set up your business profile.");
        navigate("/account/business");
      } else {
        toast.success("Account created — you're in.");
        navigate("/account/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!accountType) {
    return (
      <SiteLayout>
        <section
          className="mx-auto max-w-2xl px-5 py-16 lg:px-8 lg:py-20"
          style={{ background: "color-mix(in oklab, var(--accent) 8%, transparent)" }}
        >
          <h1 className="font-display text-3xl text-foreground">Create your account</h1>
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
        </section>
      </SiteLayout>
    );
  }

  const chosen = ACCOUNT_TYPES.find((t) => t.value === accountType)!;

  return (
    <SiteLayout>
      <section
        className="mx-auto max-w-md px-5 py-16 lg:px-8 lg:py-20"
        style={{ background: "color-mix(in oklab, var(--accent) 8%, transparent)" }}
      >
        <button
          type="button"
          onClick={() => setAccountType(null)}
          className="text-xs font-semibold text-accent hover:underline"
        >
          &larr; Change account type
        </button>
        <h1 className="mt-2 font-display text-3xl text-foreground">{chosen.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {accountType === "BUSINESS"
            ? "Your details as the account holder. You'll add your business profile (name, address, contact info) right after this."
            : "Takes about a minute — that's it, you're in."}
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {accountType === "BUSINESS" ? "You, the account holder" : "Your details"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your first name</label>
              <input required className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your last name</label>
              <input required className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone</label>
            <input required className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <PasswordInput required minLength={8} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <ConsentCheckbox
            checked={consent}
            onCheckedChange={setConsent}
            purpose="create and manage your account"
          />
          <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {submitting && <InlineProgress size="sm" />} Create account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/account/login" state={returnUrl ? { returnUrl } : undefined} className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </SiteLayout>
  );
}

export default RegisterPage;

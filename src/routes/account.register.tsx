import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useState, type FormEvent } from "react";
import { Gift, Briefcase, Check } from "lucide-react";

import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { PasswordInput } from "@/components/PasswordInput";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { apiUrl } from "@/config/api";

type AccountType = "SOLE_MERCHANT" | "BUSINESS";

const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const ACCOUNT_TYPES: {
  value: AccountType;
  icon: typeof Gift;
  title: string;
  desc: string;
  perks: string[];
}[] = [
  {
    value: "SOLE_MERCHANT",
    icon: Gift,
    title: "Sole Merchant Account",
    desc: "For individuals ordering for themselves or their own small business.",
    perks: ["Welcome bonus points on signup", "Earn points on every order", "Referral rewards & VIP tiers"],
  },
  {
    value: "BUSINESS",
    icon: Briefcase,
    title: "Business Account",
    desc: "For registered companies, SMEs and trade buyers.",
    perks: ["Welcome bonus points + order history for your business", "Earn points & referral rewards too", "First in line for trade credit"],
  },
];

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnUrl = (location.state as { returnUrl?: string } | null)?.returnUrl;
  const referralCode = searchParams.get("ref") ?? undefined;
  const preselect = searchParams.get("type");

  const [accountType, setAccountType] = useState<AccountType | null>(
    preselect === "business" ? "BUSINESS" : preselect === "merchant" ? "SOLE_MERCHANT" : null,
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
        headers: { "Content-Type": "application/json" },
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Registration failed");
      }
      toast.success("Account created — check your email for the verification code.");
      let verifyUrl = `/account/verify?email=${encodeURIComponent(email.trim())}&accountType=${accountType}`;
      if (returnUrl) verifyUrl += `&returnUrl=${encodeURIComponent(returnUrl)}`;
      navigate(verifyUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!accountType) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-5 py-16 lg:px-8 lg:py-20">
          <h1 className="font-display text-3xl">Create your account</h1>
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
      <section className="mx-auto max-w-md px-5 py-16 lg:px-8 lg:py-20">
        <button
          type="button"
          onClick={() => setAccountType(null)}
          className="text-xs font-semibold text-accent hover:underline"
        >
          &larr; Change account type
        </button>
        <h1 className="mt-2 font-display text-3xl">{chosen.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {accountType === "BUSINESS"
            ? "Step 1 of 2 — your sign-in details. You'll add your business profile (name, KRA PIN, contact info) right after this."
            : "Takes about a minute — that's it, you're in."}
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">First name</label>
              <input required className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Last name</label>
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

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { X, Gift, Briefcase, Check, ShoppingBag, PartyPopper, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { useAuthModal, type ModalAccountType } from "@/contexts/AuthModalContext";
import { PasswordInput } from "@/components/PasswordInput";
import { RewardsTermsLink } from "@/components/RewardsTermsLink";
import { InlineProgress } from "@/components/InlineProgress";
import { MODAL_BG, MODAL_BORDER } from "@/lib/modalTheme";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { RegistrationDetailsWizard } from "@/components/RegistrationDetailsWizard";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const ACCOUNT_TYPES: {
  value: ModalAccountType;
  icon: typeof Gift;
  title: string;
  desc: string;
  perks: string[];
}[] = [
  {
    value: "INDIVIDUAL_SHOPPER",
    icon: Gift,
    title: "Individual Shopper Account",
    desc: "Individuals ordering for themselves or their own small business.",
    perks: ["Welcome bonus Reward Coupons on signup", "Earn Reward Coupons on every order", "Referral rewards & VIP tiers"],
  },
  {
    value: "BUSINESS",
    icon: Briefcase,
    title: "Business Account",
    desc: "Registered companies, SMEs and trade buyers.",
    perks: ["Welcome bonus Reward Coupons + order history for your business", "Earn Reward Coupons & referral rewards too", "First in line for trade credit"],
  },
];

/**
 * Global overlay auth flow — the primary path from the header, the homepage
 * starter modal, and ProtectedRoute. The full pages (/account/login etc.)
 * still exist and work standalone; this doesn't replace them, it's an
 * additional faster path that never navigates away from the current URL.
 */
export function AuthModal() {
  const { mode, close } = useAuthModal();

  useEffect(() => {
    if (!mode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, close]);

  if (!mode) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border text-card-foreground shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        style={{ background: MODAL_BG, borderColor: MODAL_BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="max-h-[85vh] overflow-y-auto">
          {mode === "login" && <LoginStep />}
          {mode === "register" && <RegisterStep />}
        </div>
      </div>
    </div>
  );
}

function LoginStep() {
  const { login } = useAuth();
  const { returnUrl, openRegister, close } = useAuthModal();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Only appears once this IP has 5+ recent failed attempts — a normal login never sees this.
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password, turnstileToken || undefined);
      toast.success("Signed in");
      close();
      const roles = loggedInUser?.roles ?? [];
      if (roles.includes("ROLE_ADMIN") || roles.includes("ROLE_STAFF")) {
        navigate("/admin/dashboard");
      } else if (returnUrl) {
        navigate(returnUrl);
      } else if (loggedInUser?.accountType === "BUSINESS") {
        navigate("/account/business");
      } else if (loggedInUser?.accountType === "INDIVIDUAL_SHOPPER") {
        navigate("/account/merchant");
      }
      // otherwise (no account type on the token, e.g. guest): stay on the
      // current page, it re-renders now that isAuthenticated is true
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "CHALLENGE_REQUIRED") {
        setChallengeRequired(true);
        toast.error("Please complete the security check below and try again.");
      } else {
        toast.error(err instanceof Error ? err.message : "Sign in failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-6 pb-6 pt-8">
      <h2 className="text-center font-display text-2xl text-foreground">Sign in</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">Welcome back.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
          <input type="email" required autoFocus className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <Link to="/account/forgot-password" onClick={close} className="text-xs text-accent hover:underline">
              Forgot?
            </Link>
          </div>
          <PasswordInput required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {challengeRequired && <TurnstileWidget onToken={setTurnstileToken} />}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting && <InlineProgress size="sm" />} Sign in
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to Moments?{" "}
        <button type="button" onClick={() => openRegister({ returnUrl })} className="text-accent hover:underline">
          Create an account
        </button>
      </p>
    </div>
  );
}

function RegisterStep() {
  const { returnUrl, preselectAccountType, referralCode, openLogin, close } = useAuthModal();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<ModalAccountType | null>(preselectAccountType ?? null);
  const [welcome, setWelcome] = useState<{ firstName: string; accountType: ModalAccountType } | null>(null);

  function handleSuccess(result: { user: AuthUser | null; firstName: string }) {
    if (result.user) setSession(result.user);
    setWelcome({ firstName: result.firstName, accountType: accountType as ModalAccountType });
  }

  function finishAndContinue() {
    close();
    if (returnUrl) {
      toast.success("Account created — you're in.");
      navigate(returnUrl);
    } else if (welcome?.accountType === "BUSINESS") {
      toast.success("Account created — let's set up your business profile.");
      navigate("/account/business");
    } else {
      toast.success("Account created — you're in.");
    }
  }

  if (welcome) {
    return (
      <div className="px-6 pb-6 pt-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
          <PartyPopper className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl text-foreground">Welcome, {welcome.firstName}!</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Your account is ready.</p>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.03] p-3.5 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="text-xs text-muted-foreground">
            <span className="block font-semibold text-foreground">You'll be assigned a dedicated account manager</span>
            They'll be your go-to contact for orders, questions, and getting the most out of your account.
          </span>
        </div>
        <button
          type="button"
          onClick={finishAndContinue}
          className="mt-5 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continue
        </button>
      </div>
    );
  }

  if (!accountType) {
    return (
      <div className="px-6 pb-6 pt-8">
        <h2 className="text-center font-display text-2xl text-foreground">Create your account</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">Choose the account that fits how you order.</p>
        <div className="mt-5 space-y-2.5">
          {ACCOUNT_TYPES.map((t) => (
            <div key={t.value} className="rounded-xl border border-border bg-background p-3.5 transition-colors hover:border-accent/50 hover:bg-secondary/30">
              <button
                type="button"
                onClick={() => setAccountType(t.value)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <t.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.desc}</span>
                  <span className="mt-1.5 block space-y-0.5">
                    {t.perks.map((p) => (
                      <span key={p} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-accent" />
                        {p}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              <Link
                to={t.value === "BUSINESS" ? "/account-options#business" : "/account-options#individual"}
                onClick={close}
                className="mt-1.5 ml-12 inline-block text-[11px] font-medium text-accent underline underline-offset-2 hover:text-accent/80"
              >
                Learn more
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Read the <RewardsTermsLink className="text-accent underline underline-offset-2">offer terms</RewardsTermsLink> for full details.
        </p>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-secondary/20 p-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Rather just browse?</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              You can still buy and track an order with no account — you just miss out on welcome Reward Coupons,
              order rewards, saved order history and referral perks.
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button type="button" onClick={() => openLogin({ returnUrl })} className="text-accent hover:underline">
            Sign in
          </button>
        </p>
      </div>
    );
  }

  const chosen = ACCOUNT_TYPES.find((t) => t.value === accountType)!;

  return (
    <div className="px-6 pb-6 pt-8">
      {!preselectAccountType && (
        <button type="button" onClick={() => setAccountType(null)} className="text-xs font-semibold text-accent hover:underline">
          &larr; Change account type
        </button>
      )}
      <h2 className="mt-2 text-center font-display text-2xl text-foreground">{chosen.title}</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {accountType === "BUSINESS"
          ? "Your details as the account holder. You'll add your business profile (name, address, contact info) right after this."
          : "Takes about a minute — that's it, you're in."}
      </p>
      <div className="mt-5">
        <RegistrationDetailsWizard
          accountType={accountType}
          referralCode={referralCode}
          compact
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}

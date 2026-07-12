import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { X, Gift, Briefcase, Check, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal, type ModalAccountType } from "@/contexts/AuthModalContext";
import { PasswordInput } from "@/components/PasswordInput";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { InlineProgress } from "@/components/InlineProgress";
import { apiUrl, setAuthToken } from "@/config/api";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const ACCOUNT_TYPES: {
  value: ModalAccountType;
  icon: typeof Gift;
  title: string;
  desc: string;
}[] = [
  {
    value: "SOLE_MERCHANT",
    icon: Gift,
    title: "Sole Merchant Account",
    desc: "Individuals — earn welcome points, order points & referral rewards.",
  },
  {
    value: "BUSINESS",
    icon: Briefcase,
    title: "Business Account",
    desc: "Companies & SMEs — order history, rewards, trade credit pipeline.",
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {mode === "login" && <LoginStep />}
        {mode === "register" && <RegisterStep />}
        {mode === "verify" && <VerifyStep />}
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      toast.success("Signed in");
      close();
      const roles = loggedInUser?.roles ?? [];
      if (roles.includes("ROLE_ADMIN") || roles.includes("ROLE_STAFF")) {
        navigate("/admin/dashboard");
      } else if (returnUrl) {
        navigate(returnUrl);
      }
      // otherwise: stay on the current page, it re-renders now that isAuthenticated is true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-6 pb-6 pt-8">
      <h2 className="font-display text-2xl text-foreground">Sign in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
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
  const { returnUrl, preselectAccountType, referralCode, openLogin, goToVerify, close } = useAuthModal();
  const [accountType, setAccountType] = useState<ModalAccountType | null>(preselectAccountType ?? null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      goToVerify(email.trim(), accountType ?? undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!accountType) {
    return (
      <div className="px-6 pb-6 pt-8">
        <h2 className="font-display text-2xl text-foreground">Create your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the account that fits how you order.</p>
        <div className="mt-5 space-y-2.5">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setAccountType(t.value)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-secondary/30"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <t.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{t.title}</span>
                <span className="block text-xs text-muted-foreground">{t.desc}</span>
              </span>
            </button>
          ))}
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
      <h2 className="mt-2 font-display text-2xl text-foreground">{chosen.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {accountType === "BUSINESS"
          ? "Step 1 of 2 — your sign-in details. You'll add your business profile (name, KRA PIN, contact info) right after this."
          : "Takes about a minute — that's it, you're in."}
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">First name</label>
            <input required className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Last name</label>
            <input required className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
          <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone</label>
          <input required className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
          <PasswordInput required minLength={8} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ConsentCheckbox checked={consent} onCheckedChange={setConsent} purpose="create and manage your account" />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting && <InlineProgress size="sm" />} Create account
        </button>
      </form>
    </div>
  );
}

function VerifyStep() {
  const { pendingEmail, pendingAccountType, returnUrl, openLogin, close } = useAuthModal();
  const navigate = useNavigate();
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      toast.error("Enter your email and the verification code.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/verify-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? "Verification failed");
      }
      const accessToken = (data as { accessToken?: string }).accessToken;
      const refreshToken = (data as { refreshToken?: string }).refreshToken;
      if (accessToken) setAuthToken(accessToken);
      if (refreshToken && typeof window !== "undefined") {
        window.localStorage.setItem("mpk_rt", refreshToken);
      }
      close();
      if (returnUrl) {
        toast.success("Email verified");
        navigate(returnUrl);
      } else if (pendingAccountType === "BUSINESS") {
        toast.success("Email verified — let's set up your business profile.");
        navigate("/account/business");
      } else {
        toast.success("Email verified");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setResending(true);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/resend-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? "Could not resend code");
      }
      toast.success("New verification code sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="px-6 pb-6 pt-8 text-center">
      <MailCheck className="mx-auto h-10 w-10 text-accent" />
      <h2 className="mt-3 font-display text-2xl text-foreground">Verify your email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the code we sent to {pendingEmail ? <strong>{pendingEmail}</strong> : "your inbox"}.
      </p>
      <form onSubmit={handleVerify} className="mt-6 space-y-3 text-left">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
          <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Verification code</label>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputCls} text-center font-mono text-lg tracking-[0.5em]`}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
            placeholder="••••••"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? <InlineProgress size="sm" /> : <Check className="h-4 w-4" />} Verify email
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={handleResend} disabled={resending} className="text-accent hover:underline disabled:opacity-60">
          {resending ? "Sending…" : "Resend code"}
        </button>
        <button type="button" onClick={() => openLogin({ returnUrl })} className="text-muted-foreground hover:underline">
          Back to sign in
        </button>
      </div>
    </div>
  );
}

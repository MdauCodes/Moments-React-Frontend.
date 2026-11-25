import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";

import { useState, type FormEvent } from "react";
import { InlineProgress } from "@/components/InlineProgress";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { passwordStore } from "@/services/passwordStore";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { MODAL_BG, MODAL_BORDER } from "@/lib/modalTheme";
import { redirectToStaffSignIn } from "@/components/StaffLinkGate";
import { STAFF_REDIRECT_TEXT, isUseStaffLinkError } from "@/lib/staffLink";

const searchSchema = z.object({ redirect: z.string().optional() });

// Matches the welcome modal's cream/forest-green identity, per the brand-alignment request —
// a full-page wash of the same MODAL_BG behind a bordered card, rather than a bare white page.
const FOREST_DEEP = "#08231a";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function LoginPage() {
  const { login, logout, setSession } = useAuth();
  const [_searchParams] = useSearchParams();
  const location = useLocation();
  // ProtectedRoute sends the page the customer was trying to reach via
  // router state; a bare ?redirect= query param is kept as a fallback for
  // any direct link that sets it that way instead.
  const returnUrl = (location.state as { returnUrl?: string } | null)?.returnUrl
    ?? _searchParams.get("redirect")
    ?? undefined;

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Only appears once this IP has 5+ recent failed attempts — a normal login never sees this.
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  // Set when login fails specifically because the password was right but the account was never
  // verified — distinct from a generic failure so we can offer "verify now" right here instead of
  // just an unhelpful error toast.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // Staff have their own sign-in: on a 403 USE_STAFF_LINK, or when the account turns out to be staff,
  // the customer session is ended and the browser goes to the staff sign-in.
  const [toStaff, setToStaff] = useState(false);

  function sendToStaff() {
    setToStaff(true);
    redirectToStaffSignIn("/admin");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password, turnstileToken || undefined);
      if (loggedInUser?.staffAccount) {
        // Staff account on the customer form: end the customer session, then go to the staff sign-in.
        await logout();
        sendToStaff();
        return;
      }
      toast.success("Signed in");
      if (loggedInUser?.verificationGraceLoginsRemaining != null) {
        const n = loggedInUser.verificationGraceLoginsRemaining;
        toast.warning(
          n > 0
            ? `Please verify your email soon — you have ${n} more sign-in${n === 1 ? "" : "s"} before you'll need to.`
            : "Please verify your email now — this was your last sign-in without it.",
          { duration: 8000 },
        );
      }
      navigate(returnUrl ?? "/account/dashboard");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (isUseStaffLinkError((err as { status?: number })?.status, code)) {
        await logout().catch(() => undefined);
        sendToStaff();
      } else if (code === "CHALLENGE_REQUIRED") {
        setChallengeRequired(true);
        toast.error("Please complete the security check below and try again.");
      } else if (code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        toast.error("Please verify your email to finish signing in.");
      } else {
        toast.error(err instanceof Error ? err.message : "Sign in failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setVerifying(true);
    try {
      const res = await passwordStore.verifyEmailOtp(email.trim(), otp);
      if (!res.ok) {
        toast.error(res.message ?? "Invalid or expired code");
        return;
      }
      if (res.data?.user) setSession(res.data.user);
      toast.success("Email verified — signing you in");
      navigate(returnUrl ?? "/account/dashboard");
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    setResending(true);
    try {
      const res = await passwordStore.sendVerificationOtp(email.trim());
      toast[res.ok ? "success" : "error"](res.ok ? "Code resent — check your email" : (res.message ?? "Couldn't resend the code"));
    } finally {
      setResending(false);
    }
  }

  return (
    <SiteLayout>
      {toStaff && (
        <p role="status" className="px-5 pt-6 text-center text-sm">
          {STAFF_REDIRECT_TEXT}
        </p>
      )}
      <section className="px-5 py-16 lg:px-8 lg:py-20" style={{ background: MODAL_BG }}>
        <div
          className="mx-auto max-w-md rounded-3xl border p-6 shadow-sm sm:p-8"
          style={{ background: "#ffffff", borderColor: MODAL_BORDER }}
        >
        <h1 className="font-display text-3xl" style={{ color: FOREST_DEEP }}>Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Welcome back.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              <Link to="/account/forgot-password" className="text-xs text-accent hover:underline">
                Forgot?
              </Link>
            </div>
            <PasswordInput
              required
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {challengeRequired && <TurnstileWidget onToken={setTurnstileToken} />}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting && <InlineProgress size="sm" />} Sign in
          </button>
        </form>
        {needsVerification && (
          <form onSubmit={verifyOtp} className="mt-6 space-y-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
            <p className="text-sm font-medium">Verify your email to continue</p>
            <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {email.trim()}.</p>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoFocus
              className={`${inputCls} tracking-[0.4em] text-center`}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {verifying && <InlineProgress size="sm" />} Verify
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={resending}
                className="rounded-full border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:border-accent/40 disabled:opacity-60"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Moments?{" "}
          <Link
            to="/account/register"
            state={returnUrl ? { returnUrl } : undefined}
            className="text-accent hover:underline"
          >
            Create an account
          </Link>
        </p>
        </div>
      </section>
    </SiteLayout>
  );
}

export default LoginPage;

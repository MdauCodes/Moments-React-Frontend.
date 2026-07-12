import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { apiUrl, setAuthToken } from "@/config/api";

const searchSchema = z.object({
  email: z.string().optional(),
  token: z.string().optional(),
});



const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function VerifyEmailPage() {
  const [_searchParams] = useSearchParams();
  const emailFromQuery = _searchParams.get("email") ?? "";
  const returnUrl = _searchParams.get("returnUrl") ?? undefined;
  const accountType = _searchParams.get("accountType") ?? undefined;

  const navigate = useNavigate();
  const [email, setEmail] = useState(emailFromQuery);
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
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? "Verification failed");
      }
      const accessToken = (data as { accessToken?: string }).accessToken;
      const refreshToken = (data as { refreshToken?: string }).refreshToken;
      if (accessToken) setAuthToken(accessToken);
      if (refreshToken && typeof window !== "undefined") {
        window.localStorage.setItem("mpk_rt", refreshToken);
      }
      if (!returnUrl && accountType === "BUSINESS") {
        toast.success("Email verified — let's set up your business profile.");
        navigate("/account/business");
      } else {
        toast.success("Email verified");
        navigate(returnUrl ?? "/account/dashboard");
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
    <SiteLayout>
      <section className="mx-auto max-w-md px-5 py-16 lg:px-8 lg:py-20">
        <div className="text-center">
          <MailCheck className="mx-auto h-12 w-12 text-accent" />
          <h1 className="mt-4 font-display text-3xl">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the code we sent to {emailFromQuery ? <strong>{emailFromQuery}</strong> : "your inbox"}.
          </p>
        </div>

        <form onSubmit={handleVerify} className="mt-8 space-y-4">
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
            <label className="mb-1.5 block text-sm font-medium">Verification code</label>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputCls} tracking-[0.5em] text-center font-mono text-lg`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ""))}
              placeholder="••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting && <InlineProgress size="sm" />} Verify email
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-accent hover:underline disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
          <Link to="/account/login" className="text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

export default VerifyEmailPage;

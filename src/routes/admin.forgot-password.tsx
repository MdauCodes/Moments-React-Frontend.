import { Link, useNavigate } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useState, type FormEvent } from "react";
import { Mail, KeyRound, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { passwordStore } from "@/services/passwordStore";



type Step = "email" | "otp" | "password" | "done";

const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";
const btnCls = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await passwordStore.requestStaffReset(email.trim());
      if (!res.ok) { setError(res.message ?? "Could not send reset code."); return; }
      setInfo("If that email belongs to an account, a reset code has been sent.");
      setStep("otp");
    } finally { setSubmitting(false); }
  }

  function submitOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit code from your email."); return; }
    setInfo(null);
    setStep("password");
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 64) { setError("Password must be at most 64 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSubmitting(true);
    try {
      const res = await passwordStore.staffReset(email, otp, password);
      if (!res.ok) { setError(res.message ?? "Could not reset password."); return; }
      setStep("done");
      toast.success("Password reset successfully");
      setTimeout(() => navigate("/admin/login"), 1500);
    } finally { setSubmitting(false); }
  }

  async function resendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await passwordStore.requestStaffReset(email.trim());
      if (!res.ok) { setError(res.message ?? "Could not resend code."); return; }
      setInfo("A new code has been sent if the email is registered.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-5 py-12"
      style={{ background: "var(--admin-bg-texture)", color: "var(--admin-text)", fontFamily: "var(--font-sans)" }}>
      <div className="w-full max-w-md rounded-[18px] border p-6 sm:p-8"
        style={{
          background: "linear-gradient(180deg, color-mix(in oklab, var(--admin-surface) 90%, var(--cream) 10%), var(--admin-surface))",
          borderColor: "var(--admin-border)",
          boxShadow: "var(--admin-shadow)",
        }}>
        {step === "done" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--admin-accent)]" />
            <h1 className="mt-4 text-xl font-semibold" style={{ color: "var(--admin-text)" }}>Password updated</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Redirecting to sign in…</p>
          </div>
        ) : step === "email" ? (
          <>
            <div className="flex justify-center">
              <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--admin-bg)" }}>
                <Mail className="h-6 w-6" style={{ color: "var(--admin-muted)" }} />
              </div>
            </div>
            <h1 className="mt-5 text-center text-xl font-semibold" style={{ color: "var(--admin-text)" }}>Forgot password?</h1>
            <p className="mt-2 text-center text-sm" style={{ color: "var(--admin-muted)" }}>Enter your email and we'll send you a 6-digit reset code.</p>
            <form onSubmit={submitEmail} className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: "color-mix(in oklab, var(--admin-bg) 84%, var(--admin-surface) 16%)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--admin-border)")} />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting} className={btnCls}>
                {submitting && <InlineProgress size="sm" />} Send reset code
              </button>
              <p className="text-center text-xs" style={{ color: "var(--admin-muted)" }}>
                Remember it? <Link to="/admin/login" className="underline hover:text-[var(--admin-accent)]">Sign in</Link>
              </p>
            </form>
          </>
        ) : step === "otp" ? (
          <>
            <div className="flex justify-center">
              <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--admin-bg)" }}>
                <KeyRound className="h-6 w-6" style={{ color: "var(--admin-muted)" }} />
              </div>
            </div>
            <h1 className="mt-5 text-center text-xl font-semibold" style={{ color: "var(--admin-text)" }}>Enter reset code</h1>
            <p className="mt-2 text-center text-sm" style={{ color: "var(--admin-muted)" }}>
              We sent a 6-digit code to <span className="font-semibold" style={{ color: "var(--admin-text)" }}>{email}</span>. It expires in 15 minutes.
            </p>
            {info && <p className="mt-3 text-center text-sm text-emerald-400">{info}</p>}
            <form onSubmit={submitOtp} className="mt-8 space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric" pattern="[0-9]*">
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="text-center text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting || otp.length !== 6} className={btnCls}>
                {submitting && <InlineProgress size="sm" />} Continue
              </button>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--admin-muted)" }}>
                <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(null); setInfo(null); }} className="hover:underline">
                  ← Change email
                </button>
                <button type="button" onClick={resendCode} disabled={submitting} className="underline hover:text-[var(--admin-accent)] disabled:opacity-60">
                  Resend code
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--admin-bg)" }}>
                <Lock className="h-6 w-6" style={{ color: "var(--admin-muted)" }} />
              </div>
            </div>
            <h1 className="mt-5 text-center text-xl font-semibold" style={{ color: "var(--admin-text)" }}>Set a new password</h1>
            <p className="mt-2 text-center text-sm" style={{ color: "var(--admin-muted)" }}>Must be at least 8 characters.</p>
            <form onSubmit={submitPassword} className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>New password</label>
                <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: "color-mix(in oklab, var(--admin-bg) 84%, var(--admin-surface) 16%)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                  toggleStyle={{ color: "var(--admin-muted)" }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>Confirm password</label>
                <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2"
                  style={{
                    background: "color-mix(in oklab, var(--admin-bg) 84%, var(--admin-surface) 16%)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                  toggleStyle={{ color: "var(--admin-muted)" }} />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={submitting} className={btnCls}>
                {submitting && <InlineProgress size="sm" />} Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminForgotPasswordPage;

import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { passwordStore } from "@/services/passwordStore";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Shown in both the Individual Shopper and Business account dashboards. Email
 * verification is never required to sign up or shop — only to keep
 * redeeming points past the free allowance (see backend
 * ReferralService.FREE_REDEMPTION_LIMIT). This card makes the capability
 * visible from day one even before it's ever enforced.
 */
export function EmailVerificationCard({
  email,
  emailVerified,
  freeRedemptionsRemaining,
  onVerified,
}: {
  email: string;
  emailVerified: boolean;
  freeRedemptionsRemaining: number | null;
  onVerified?: () => void;
}) {
  const { setSession } = useAuth();
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function sendCode() {
    setSending(true);
    try {
      const res = await passwordStore.sendVerificationOtp(email);
      if (res.ok) {
        setOtpSent(true);
        toast.success("Verification code sent — check your email");
      } else {
        toast.error(res.message ?? "Couldn't send the code right now");
      }
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const res = await passwordStore.verifyEmailOtp(email, otp);
      if (res.ok) {
        toast.success("Email verified");
        if (res.data?.user) setSession(res.data.user);
        onVerified?.();
      } else {
        toast.error(res.message ?? "Invalid or expired code");
      }
    } finally {
      setVerifying(false);
    }
  }

  if (emailVerified) {
    return (
      <div className="rounded-lg border border-border bg-background/40 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold">Email verified</p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          You can redeem Reward Coupons without limit and recover your account by email if you ever forget your password.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold">Email not verified yet</p>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {freeRedemptionsRemaining == null || freeRedemptionsRemaining > 0
          ? `You can still redeem Reward Coupons ${freeRedemptionsRemaining != null ? `${freeRedemptionsRemaining} more time${freeRedemptionsRemaining === 1 ? "" : "s"} ` : ""}without verifying — but an unverified account can't recover access via "forgot password" if you lose it, and your Reward Coupons could be at risk. Verifying takes under a minute.`
          : "You've used your free redemptions — verify your email now to keep redeeming Reward Coupons for discounts."}
      </p>

      {!otpSent ? (
        <button
          type="button"
          onClick={sendCode}
          disabled={sending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Send verification code
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            inputMode="numeric"
            className="w-32 rounded-md border border-border bg-card px-3 py-2 text-sm tracking-widest"
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying || otp.length !== 6}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Verify
          </button>
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Resend code
          </button>
        </div>
      )}
    </div>
  );
}

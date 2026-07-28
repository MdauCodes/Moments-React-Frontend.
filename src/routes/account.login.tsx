import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";

import { useState, type FormEvent } from "react";
import { InlineProgress } from "@/components/InlineProgress";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const searchSchema = z.object({ redirect: z.string().optional() });



const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function LoginPage() {
  const { login } = useAuth();
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password, turnstileToken || undefined);
      toast.success("Signed in");
      const roles = loggedInUser?.roles ?? [];
      const dest =
        roles.includes("ROLE_ADMIN") || roles.includes("ROLE_STAFF")
          ? "/admin/dashboard"
          : (returnUrl ?? "/account/dashboard");
      navigate(dest);
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
    <SiteLayout>
      <section className="mx-auto max-w-md px-5 py-16 lg:px-8 lg:py-20">
        <h1 className="font-display text-3xl">Sign in</h1>
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
      </section>
    </SiteLayout>
  );
}

export default LoginPage;

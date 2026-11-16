// Joining a restaurant with the emailed code (RestaurantSetupPhone, steps 1-2). The invite email
// links here as /restaurant/join?email=… (store RestaurantEmails.invite).
//
// The store's accept call takes the email, the code and, when needed, names and a password. Who
// needs what is only known to the store, so "Continue" first sends just the email and code: the
// store checks the code before anything else and saves nothing when something is missing, and its
// answer tells us the next step (see classifyJoinError). A wrong code counts as one of the 5 tries.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";

import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  ErrorText,
  Field,
  Muted,
  PortalButton,
  PortalCard,
  inputClass,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { restaurantApi, type AcceptInviteResult } from "@/services/restaurantApi";
import {
  checkPassword,
  classifyJoinError,
  cleanCode,
  isEmail,
  MIN_PASSWORD,
} from "@/lib/restaurantPortal";

type Step = "code" | "password" | "names" | "joined" | "signin";

export default function RestaurantJoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();

  const [step, setStep] = useState<Step>("code");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<AcceptInviteResult | null>(null);

  useEffect(() => {
    document.title = "Join your restaurant · Moments Packaging";
  }, []);

  const pw = checkPassword(password, again);
  const emailFromLink = !!params.get("email");

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = cleanCode(code);
    if (!isEmail(email)) return setError("Enter the email address the invite was sent to.");
    if (!digits) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    try {
      const result = await restaurantApi.acceptInvite({ email: email.trim(), code: digits });
      // An existing Moments account that isn't the contact person: joined already.
      setJoined(result);
      setStep("joined");
    } catch (err) {
      const message = err instanceof Error ? err.message : "That code didn't work.";
      const need = classifyJoinError(message);
      if (need === "code-error") setError(message);
      else setStep(need);
    } finally {
      setBusy(false);
    }
  }

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = cleanCode(code);
    if (!digits) {
      setStep("code");
      return setError("Enter the 6-digit code from the email.");
    }
    if (step === "names" && (!firstName.trim() || !lastName.trim())) {
      return setError("Enter your first and last name.");
    }
    if (!pw.ok) {
      return setError(
        pw.longEnough
          ? "The two passwords don't match."
          : `Use at least ${MIN_PASSWORD} characters.`,
      );
    }
    setBusy(true);
    try {
      const result = await restaurantApi.acceptInvite({
        email: email.trim(),
        code: digits,
        password,
        ...(step === "names"
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone.trim() || undefined,
            }
          : {}),
      });
      setJoined(result);
      try {
        await login(email.trim(), password);
        navigate(result.role === "OWNER" ? "/restaurant/setup" : "/restaurant", { replace: true });
      } catch {
        // Joined, but the sign-in needs a check (or failed): let them sign in the usual way.
        setStep("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finish joining.");
    } finally {
      setBusy(false);
    }
  }

  const signedInAsInvitee =
    isAuthenticated && user && user.email.toLowerCase() === email.trim().toLowerCase();

  const stepLabel =
    step === "code"
      ? "Step 1 · your code"
      : step === "password" || step === "names"
        ? "Step 2 · your password"
        : "";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background: c.page,
        color: c.ink,
        fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <header style={{ background: "#1D4F5A", color: "#FFFFFF" }}>
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-3.5">
          <div className="font-bold">Moments Packaging · joining your restaurant</div>
          {stepLabel && (
            <>
              <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full"
                    style={{
                      background: i === 1 || step !== "code" ? c.gold : "rgba(255,255,255,0.28)",
                    }}
                  />
                ))}
              </div>
              <div className="text-[12.5px]" style={{ color: "#CFE3E6" }}>
                {stepLabel}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
        {step === "code" && (
          <form onSubmit={submitCode} className="flex flex-col gap-3" noValidate>
            <h1 className="text-[22px] font-bold">Enter the code from the email</h1>
            {emailFromLink ? (
              <Muted>
                For <strong>{email}</strong>. The code works for 7 days, only for this email.
              </Muted>
            ) : (
              <Field
                label="Email the invite was sent to"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              6-digit code
              <input
                className={`${inputClass} text-center text-[24px] font-bold tracking-[0.3em]`}
                style={{ borderColor: c.line }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                autoFocus
              />
            </label>
            <ErrorText>{error}</ErrorText>
            <PortalButton type="submit" disabled={busy} className="min-h-[52px] text-[16px]">
              {busy ? "Checking…" : "Continue"}
            </PortalButton>
          </form>
        )}

        {(step === "password" || step === "names") && (
          <form onSubmit={submitDetails} className="flex flex-col gap-3" noValidate>
            <h1 className="text-[22px] font-bold">
              {step === "names" ? "Your name and a password" : "Choose a password"}
            </h1>
            <Muted>
              You sign in with <strong>{email.trim()}</strong> and this password.
            </Muted>
            {step === "names" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Field
                    label="Last name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <Field
                  label="Phone (optional)"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </>
            )}
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              Password
              <PasswordInput
                className={inputClass}
                style={{ borderColor: c.line }}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              Type it again
              <PasswordInput
                className={inputClass}
                style={{ borderColor: c.line }}
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]" aria-live="polite">
              <Check_ ok={pw.longEnough} text={`At least ${MIN_PASSWORD} characters`} />
              <Check_ ok={pw.matches} text="The two match" />
            </div>
            <ErrorText>{error}</ErrorText>
            <PortalButton type="submit" disabled={busy} className="min-h-[52px] text-[16px]">
              {busy ? "Saving…" : "Save password"}
            </PortalButton>
          </form>
        )}

        {step === "joined" && joined && (
          <PortalCard>
            <h1 className="text-[22px] font-bold">You've joined {joined.restaurantName}</h1>
            <Muted className="mt-2">
              You already have a Moments account with {email.trim()}, so your password stays the
              same. {signedInAsInvitee ? "" : "Sign in with it to open your restaurant."}
            </Muted>
            <div className="mt-4">
              {signedInAsInvitee ? (
                <PortalButton onClick={() => navigate("/restaurant")}>
                  Open {joined.restaurantName}
                </PortalButton>
              ) : (
                <PortalButton onClick={() => openLogin({ returnUrl: "/restaurant" })}>
                  Sign in
                </PortalButton>
              )}
            </div>
          </PortalCard>
        )}

        {step === "signin" && joined && (
          <PortalCard>
            <h1 className="text-[22px] font-bold">You've joined {joined.restaurantName}</h1>
            <Muted className="mt-2">Your password is saved. Sign in once more to continue.</Muted>
            <div className="mt-4">
              <PortalButton
                onClick={() =>
                  openLogin({
                    returnUrl: joined.role === "OWNER" ? "/restaurant/setup" : "/restaurant",
                  })
                }
              >
                Sign in
              </PortalButton>
            </div>
          </PortalCard>
        )}
      </main>
    </div>
  );
}

function Check_({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? c.green : c.muted }}>
      {ok ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <X className="h-4 w-4" aria-hidden="true" />
      )}
      {text}
    </span>
  );
}

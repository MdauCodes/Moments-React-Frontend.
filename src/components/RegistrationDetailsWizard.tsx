import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { InlineProgress } from "@/components/InlineProgress";
import { PasswordInput } from "@/components/PasswordInput";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useBotDefenseFields, HoneypotField } from "@/hooks/useBotDefense";
import { api } from "@/services/api";
import { apiUrl, getSessionId } from "@/config/api";

type AccountType = "INDIVIDUAL_SHOPPER" | "BUSINESS";
type PurchasePurpose = { id: string; label: string };
type Industry = { id: string; name: string; slug: string };

const OTHER_VALUE = "__other__";

/**
 * Steps: 1) core identity, 2) date of birth (Individual only — Business skips straight to 3
 * since it collects nothing for its anniversary, that's just createdAt), 3) purpose of
 * purchase + industry + consent + submit. Shared between the standalone /account/register page
 * and AuthModal's RegisterStep so there's exactly one place this logic lives — the two callers
 * only differ in the "choose account type" screen before this and what happens on success.
 */
export function RegistrationDetailsWizard({
  accountType,
  referralCode,
  compact = false,
  onSuccess,
}: {
  accountType: AccountType;
  referralCode?: string;
  compact?: boolean;
  onSuccess: (result: { accessToken?: string; refreshToken?: string; firstName: string }) => void;
}) {
  const totalSteps = accountType === "BUSINESS" ? 2 : 3;
  const [step, setStep] = useState(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [industries, setIndustries] = useState<Industry[]>([]);
  const [purposes, setPurposes] = useState<PurchasePurpose[]>([]);
  const [industryId, setIndustryId] = useState("");
  const [purposeChoice, setPurposeChoice] = useState(""); // a real id, or OTHER_VALUE
  const [otherPurchasePurpose, setOtherPurchasePurpose] = useState("");

  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Surfaced back on step 1 (where the email field actually lives) rather than just a toast at
  // step 3 — a duplicate-email rejection is unactionable from a step with no email input on it.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputCls = compact
    ? "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
    : "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";
  const labelCls = compact
    ? "mb-1.5 block text-xs font-medium text-muted-foreground"
    : "mb-1.5 block text-sm font-medium";

  // Fetched once, on mount — not re-queried per keystroke or per step visit.
  useEffect(() => {
    void api.getIndustries().then((data) => setIndustries(data)).catch(() => undefined);
    void api.getPurchasePurposes().then((data) => setPurposes(data)).catch(() => undefined);
  }, []);

  function goNext() {
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) { toast.error("Please fill in your name"); return; }
      if (!email.trim()) { toast.error("Email is required"); return; }
      if (!phone.trim()) { toast.error("Phone is required"); return; }
      if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    }
    if (step === 2 && accountType === "INDIVIDUAL_SHOPPER" && !dateOfBirth) {
      toast.error("Date of birth is required");
      return;
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!industryId) { toast.error("Please select your industry"); return; }
    if (!purposeChoice) { toast.error("Please select what you'll mainly use this for"); return; }
    if (purposeChoice === OTHER_VALUE && !otherPurchasePurpose.trim()) {
      toast.error("Please describe what you'll mainly use this for");
      return;
    }
    if (!consent) { toast.error("Please tick the consent box to continue"); return; }

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
          ...(accountType === "INDIVIDUAL_SHOPPER" ? { dateOfBirth } : {}),
          industryId,
          ...(purposeChoice === OTHER_VALUE
            ? { otherPurchasePurpose: otherPurchasePurpose.trim() }
            : { purchasePurposeId: purposeChoice }),
          ...(referralCode ? { referralCode } : {}),
          ...toPayload(turnstileToken),
        }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        const message = (data as { message?: string }).message ?? "Registration failed";
        if (res.status === 409) {
          // Duplicate email/phone — jump back to the step that actually has those fields so the
          // customer can see and fix the problem, instead of stranding the error on step 3.
          setEmailError(message);
          setStep(1);
          toast.error(message);
          return;
        }
        throw new Error(message);
      }
      onSuccess({
        accessToken: (data as { accessToken?: string }).accessToken,
        refreshToken: (data as { refreshToken?: string }).refreshToken,
        firstName: firstName.trim() || "there",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabel = `Step ${step} of ${totalSteps}`;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stepLabel}</p>

      {step === 1 && (
        <div className={compact ? "space-y-3" : "space-y-4"}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name</label>
              <input required className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input required className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              required
              className={`${inputCls} ${emailError ? "border-destructive focus:ring-destructive/50" : ""}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            />
            {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input required className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <PasswordInput required minLength={8} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && accountType === "INDIVIDUAL_SHOPPER" && (
        <div className={compact ? "space-y-3" : "space-y-4"}>
          <div>
            <label className={labelCls}>Date of birth</label>
            <p className="mb-1.5 text-xs text-muted-foreground">Used to send you a birthday reward — never shared or sold.</p>
            <input
              type="date"
              required
              max={todayStr}
              className={inputCls}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:border-accent/40">
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === totalSteps && (
        <form onSubmit={handleSubmit} className={compact ? "space-y-3" : "space-y-4"}>
          <div>
            <label className={labelCls}>Industry</label>
            <select required className={inputCls} value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
              <option value="" disabled>Select your industry…</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>What will you mainly use this for?</label>
            <select required className={inputCls} value={purposeChoice} onChange={(e) => setPurposeChoice(e.target.value)}>
              <option value="" disabled>Select…</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              <option value={OTHER_VALUE}>Other — let me describe it</option>
            </select>
            {purposeChoice === OTHER_VALUE && (
              <input
                className={`mt-2 ${inputCls}`}
                placeholder="Tell us briefly what you'll use this for"
                value={otherPurchasePurpose}
                onChange={(e) => setOtherPurchasePurpose(e.target.value)}
              />
            )}
          </div>
          <HoneypotField value={honeypot} onChange={setHoneypot} />
          <ConsentCheckbox checked={consent} onCheckedChange={setConsent} purpose="create and manage my account" />
          <TurnstileWidget onToken={setTurnstileToken} />
          <div className="flex gap-2">
            {totalSteps > 1 && (
              <button type="button" onClick={goBack} className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:border-accent/40">
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !consent}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting && <InlineProgress size="sm" />} Create account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

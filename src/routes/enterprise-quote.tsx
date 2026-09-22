import { Link } from "react-router-dom";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/services/api";
import { apiFetch } from "@/config/api";
import { filterVisibleIndustries, type Industry } from "@/data/products";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { CheckCircle2 } from "lucide-react";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import { focusFirstError } from "@/lib/formFocus";
import { normalizeKenyanPhone, phoneForSubmission } from "@/lib/enquiryMessage";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";



const schema = z.object({
  contactName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  company: z.string().trim().min(2, "Enter your company").max(160),
  industry: z.string().min(1, "Pick an industry"),
  estimatedQuantity: z
    .number({ message: "Tell us roughly how many units." })
    // An empty box parses to 0, which used to surface as "Minimum 10,000 units" — technically
    // true, but it reads as a rejection of a number they never typed.
    .refine((n) => n > 0, { message: "Tell us roughly how many units." })
    .refine((n) => Number.isInteger(n), { message: "Use a whole number, like 25000." })
    .refine((n) => n >= 10000, { message: "Enterprise pricing starts at 10,000 units." }),
  productInterest: z.string().trim().max(2000).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

/** Used when the industries endpoint cannot be reached, so a required field is never unfillable. */
const FALLBACK_INDUSTRIES = [
  "Food & Beverage",
  "Retail & Fashion",
  "Beauty & Cosmetics",
  "Agriculture & Export",
  "Pharmacy & Health",
  "Events & Gifting",
  "Something else",
];

function EnterpriseQuotePage() {
  const { whatsappNumber } = useSiteConfig();
  const [industryNames, setIndustryNames] = useState<string[]>(FALLBACK_INDUSTRIES);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ firstName: string; email: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();
  const renderedAt = useRef(Date.now()).current;
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    contactName: "",
    email: "",
    phone: "",
    company: "",
    industry: "",
    estimatedQuantity: "",
    productInterest: "",
    message: "",
  });

  useEffect(() => {
    document.title = "Enterprise Quote — Moments Packaging Kenya";
    api
      .getIndustries()
      .then((data) => {
        // Only replace the built-in list when the API actually returned something. An empty or
        // failed response used to leave the required Industry dropdown with no options at all,
        // which made the whole form impossible to submit.
        const visible = filterVisibleIndustries(data);
        if (visible.length > 0) setIndustryNames(visible.map((i: Industry) => i.name));
      })
      .catch(() => {
        /* keep FALLBACK_INDUSTRIES */
      });
  }, []);

  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  const update = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const qtyNum = Number(form.estimatedQuantity);
  const qtyTooLow = form.estimatedQuantity !== "" && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum < 10000;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = schema.safeParse({
      ...form,
      phone: phoneForSubmission(form.phone),
      estimatedQuantity: Number(form.estimatedQuantity),
    });
    const map: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        const k = String(i.path[0] ?? "");
        if (k && !map[k]) map[k] = i.message;
      });
    }
    // Consent is now a field error next to the checkbox rather than a toast that disappears, and
    // the submit button stays live so tapping it always says something.
    if (!consent) map.consent = "Please tick this so we are allowed to reply.";
    if (Object.keys(map).length > 0) {
      setErrors(map);
      requestAnimationFrame(() =>
        focusFirstError(
          ["eq-contactName", "eq-email", "eq-phone", "eq-company", "eq-industry", "eq-estimatedQuantity", "eq-consent"],
          Object.fromEntries(Object.entries(map).map(([k, v]) => [`eq-${k}`, v])),
        ),
      );
      return;
    }
    if (!parsed.success) return;

    setSubmitting(true);
    try {
      const waited = Date.now() - renderedAt;
      if (waited < 3400) await new Promise((r) => setTimeout(r, 3400 - waited));

      const data = parsed.data;
      const res = await apiFetch("/api/v1/public/enterprise-quote", {
        method: "POST",
        json: {
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          companyName: data.company,
          estimatedQuantity: data.estimatedQuantity,
          productInterest: [data.industry, data.productInterest].filter(Boolean).join(" — "),
          message: data.message,
          consentPolicyVersion: PRIVACY_POLICY_VERSION,
          ...toPayload(turnstileToken),
        },
      });
      if (res.status === 429) {
        setSubmitError(
          "We have had a lot of requests from this connection. Please wait a minute and send it again.",
        );
        return;
      }
      if (res.status === 422 || res.status === 400) {
        setSubmitError("Some of those details were not accepted. Please check your phone number and email, then try again.");
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const firstName = data.contactName.split(" ")[0] || data.contactName;
      setSuccess({ firstName, email: data.email });
    } catch {
      setSubmitError("That did not go through — nothing you typed has been lost, so please try again.");
    } finally {
      setSubmitting(false);
      requestAnimationFrame(() => errorBannerRef.current?.focus());
    }
  };

  return (
    <SiteLayout>
      <main className="bg-background">
        {/* Header */}
        <section className="bg-[#2d4a3e] text-[#f5f0e8]">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4622d]">
              Enterprise &amp; Bulk Orders
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              Buying in bulk? Let's talk numbers.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base opacity-80 sm:text-lg">
              For orders above 10,000 units we put together a price built around your order — with a
              production schedule and one person you deal with throughout.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {["Dedicated account manager", "Custom pricing", "Priority production"].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-[#f5f0e8]/40 px-4 py-2 text-xs text-[#f5f0e8] sm:text-sm"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto w-full max-w-[560px]">
            {success ? (
              <div
                ref={successRef}
                tabIndex={-1}
                className="rounded-xl border border-border bg-card p-8 text-center shadow-sm focus:outline-none sm:p-10"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2d4a3e]/10">
                  <CheckCircle2 className="h-10 w-10 text-[#2d4a3e]" aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-2xl text-foreground sm:text-[28px]">
                  Got it, {success.firstName} — thank you
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  One of our team will put your numbers together and get back to you at{" "}
                  <span className="font-medium text-foreground">{success.email}</span> within one
                  working day.
                </p>
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      "Hi, I submitted an enterprise quote request",
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Need to talk now? WhatsApp us →
                  </a>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
                noValidate
              >
                <h2 className="font-display text-2xl text-foreground">Tell us what you need</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A few details is all it takes — we will come back to you with real numbers.
                </p>
                <div className="mt-6 space-y-4">
                  <Field id="eq-contactName" label="Your name" error={errors.contactName} required>
                    <Input
                      id="eq-contactName"
                      value={form.contactName}
                      onChange={(e) => update("contactName", e.target.value)}
                      autoComplete="name"
                      aria-invalid={errors.contactName ? true : undefined}
                      aria-describedby={errors.contactName ? "eq-contactName-error" : undefined}
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field id="eq-email" label="Work email" error={errors.email} required>
                    <Input
                      id="eq-email"
                      type="email"
                      inputMode="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      autoComplete="email"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "eq-email-error" : undefined}
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field
                    id="eq-phone"
                    label="Phone number"
                    error={errors.phone}
                    required
                    helper="We reply on WhatsApp too. 0712 345 678 is fine."
                  >
                    <Input
                      id="eq-phone"
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      onBlur={() => {
                        const tidy = normalizeKenyanPhone(form.phone);
                        if (tidy && tidy !== form.phone) update("phone", tidy);
                      }}
                      autoComplete="tel"
                      placeholder="0712 345 678"
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby={errors.phone ? "eq-phone-error" : "eq-phone-helper"}
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field id="eq-company" label="Company name" error={errors.company} required>
                    <Input
                      id="eq-company"
                      value={form.company}
                      onChange={(e) => update("company", e.target.value)}
                      autoComplete="organization"
                      aria-invalid={errors.company ? true : undefined}
                      aria-describedby={errors.company ? "eq-company-error" : undefined}
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field id="eq-industry" label="What line of business?" error={errors.industry} required>
                    <Select value={form.industry} onValueChange={(v) => update("industry", v)}>
                      <SelectTrigger
                        id="eq-industry"
                        aria-invalid={errors.industry ? true : undefined}
                        aria-describedby={errors.industry ? "eq-industry-error" : undefined}
                        className="min-h-[48px]"
                      >
                        <SelectValue placeholder="Pick the closest one" />
                      </SelectTrigger>
                      <SelectContent>
                        {industryNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    id="eq-estimatedQuantity"
                    label="Roughly how many units?"
                    error={errors.estimatedQuantity}
                    required
                    helper="Enterprise pricing starts at 10,000 units."
                  >
                    <Input
                      id="eq-estimatedQuantity"
                      type="number"
                      inputMode="numeric"
                      min={10000}
                      placeholder="e.g. 25000"
                      value={form.estimatedQuantity}
                      onChange={(e) => update("estimatedQuantity", e.target.value)}
                      aria-invalid={errors.estimatedQuantity ? true : undefined}
                      aria-describedby={
                        errors.estimatedQuantity ? "eq-estimatedQuantity-error" : "eq-estimatedQuantity-helper"
                      }
                      className="min-h-[48px]"
                    />
                    {qtyTooLow && (
                      <p className="mt-2 text-xs text-[#c4622d]">
                        Under 10,000?{" "}
                        <Link to="/products" className="underline underline-offset-2">
                          You can order straight from our catalogue →
                        </Link>
                      </p>
                    )}
                  </Field>
                  <Field id="eq-productInterest" label="What packaging are you after?" error={errors.productInterest}>
                    <Textarea
                      id="eq-productInterest"
                      value={form.productInterest}
                      onChange={(e) => update("productInterest", e.target.value)}
                      placeholder="e.g. Printed kraft bags and food boxes"
                      rows={3}
                    />
                  </Field>
                  <Field id="eq-message" label="Anything else we should know?" error={errors.message}>
                    <Textarea
                      id="eq-message"
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Sizes, branding, delivery dates — whatever matters to you."
                      rows={4}
                    />
                  </Field>
                </div>
                <HoneypotField value={honeypot} onChange={setHoneypot} />
                <TurnstileWidget onToken={setTurnstileToken} />
                <div className="mt-5">
                  <ConsentCheckbox
                    id="eq-consent"
                    checked={consent}
                    onCheckedChange={setConsent}
                    purpose="prepare my quote and contact me about it"
                  />
                  {errors.consent && (
                    <p id="eq-consent-error" className="mt-1.5 text-xs font-medium text-[#c4622d]">
                      {errors.consent}
                    </p>
                  )}
                </div>

                {submitError && (
                  <div
                    ref={errorBannerRef}
                    tabIndex={-1}
                    role="alert"
                    className="mt-5 rounded-xl border border-[#c4622d]/40 bg-[#c4622d]/10 p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#c4622d]/40"
                  >
                    {submitError}
                    {whatsappNumber && (
                      <>
                        {" "}
                        <a
                          href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                            "Hi Moments Packaging, I would like a quote for a bulk order.",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          Or send it to us on WhatsApp
                        </a>
                        .
                      </>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 h-[52px] w-full bg-[#2d4a3e] text-base text-[#f5f0e8] hover:bg-[#2d4a3e]/90"
                >
                  {submitting ? "Sending…" : "Send my quote request"}
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* Trust */}
        <section className="bg-[#f5f0e8]">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-4 py-12 text-center sm:grid-cols-3">
            {[
              { n: "500+", l: "brands packed" },
              { n: "Since 2018", l: "trusted Nairobi team" },
              { n: "Nairobi", l: "based, Kenya-wide delivery" },
            ].map((t) => (
              <div key={t.l}>
                <div className="font-display text-3xl text-[#2d4a3e] sm:text-4xl">{t.n}</div>
                <div className="mt-2 text-sm text-[#1a1510]/70">{t.l}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

/** `id` is required: it ties the label to the control and gives the hint/error stable ids for the
 *  control's aria-describedby. Before this, none of these labels were associated with anything. */
function Field({
  id,
  label,
  error,
  required,
  helper,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-1 text-[#c4622d]" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <div className="mt-1.5">{children}</div>
      {helper && !error && (
        <p id={`${id}-helper`} className="mt-1.5 text-xs text-muted-foreground">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#c4622d]">
          {error}
        </p>
      )}
    </div>
  );
}

export default EnterpriseQuotePage;

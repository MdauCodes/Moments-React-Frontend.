import { Link } from "react-router-dom";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
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
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";



const schema = z.object({
  contactName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  company: z.string().trim().min(2, "Enter your company").max(160),
  industry: z.string().min(1, "Pick an industry"),
  estimatedQuantity: z
    .number({ message: "Enter a number" })
    .int()
    .min(10000, "Minimum 10,000 units for enterprise pricing"),
  productInterest: z.string().trim().max(2000).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

function EnterpriseQuotePage() {
  const { whatsappNumber } = useSiteConfig();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ firstName: string; email: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
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
    api.getIndustries().then((data) => setIndustries(filterVisibleIndustries(data))).catch(() => setIndustries([]));
  }, []);

  const update = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const qtyNum = Number(form.estimatedQuantity);
  const qtyTooLow = form.estimatedQuantity !== "" && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum < 10000;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box to continue");
      return;
    }
    const parsed = schema.safeParse({
      ...form,
      estimatedQuantity: Number(form.estimatedQuantity),
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = String(i.path[0] ?? "");
        if (k && !map[k]) map[k] = i.message;
      });
      setErrors(map);
      return;
    }
    setSubmitting(true);
    try {
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
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const firstName = data.contactName.split(" ")[0] || data.contactName;
      setSuccess({ firstName, email: data.email });
      toast.success("Our team will contact you within 24 hours.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
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
            <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl md:text-5xl">
              Let's build something at scale.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base opacity-80 sm:text-lg">
              For orders above 10,000 units we prepare a fully custom quote — dedicated pricing,
              production scheduling, and a named account manager.
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
              <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2d4a3e]/10">
                  <CheckCircle2 className="h-10 w-10 text-[#2d4a3e]" />
                </div>
                <h2 className="mt-5 font-serif text-2xl text-foreground sm:text-[28px]">
                  Request received, {success.firstName}!
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Our enterprise team will contact you at{" "}
                  <span className="font-medium text-foreground">{success.email}</span> within 24
                  hours with a custom quote.
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
                <h2 className="font-serif text-2xl text-foreground">Tell us about your project</h2>
                <div className="mt-6 space-y-4">
                  <Field label="Contact name" error={errors.contactName} required>
                    <Input
                      value={form.contactName}
                      onChange={(e) => update("contactName", e.target.value)}
                      autoComplete="name"
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field label="Email" error={errors.email} required>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      autoComplete="email"
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone} required>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      autoComplete="tel"
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field label="Company name" error={errors.company} required>
                    <Input
                      value={form.company}
                      onChange={(e) => update("company", e.target.value)}
                      autoComplete="organization"
                      className="min-h-[48px]"
                    />
                  </Field>
                  <Field label="Industry" error={errors.industry} required>
                    <Select value={form.industry} onValueChange={(v) => update("industry", v)}>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((i) => (
                          <SelectItem key={i.id} value={i.name}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Estimated quantity"
                    error={errors.estimatedQuantity}
                    required
                    helper="Minimum 10,000 units for enterprise pricing"
                  >
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={10000}
                      value={form.estimatedQuantity}
                      onChange={(e) => update("estimatedQuantity", e.target.value)}
                      className="min-h-[48px]"
                    />
                    {qtyTooLow && (
                      <p className="mt-2 text-xs text-[#c4622d]">
                        For orders under 10,000 units,{" "}
                        <Link to="/products" className="underline underline-offset-2">
                          browse our catalogue and order directly →
                        </Link>
                      </p>
                    )}
                  </Field>
                  <Field label="Product interest" error={errors.productInterest}>
                    <Textarea
                      value={form.productInterest}
                      onChange={(e) => update("productInterest", e.target.value)}
                      placeholder="Describe what you need"
                      rows={3}
                    />
                  </Field>
                  <Field label="Message / specs" error={errors.message}>
                    <Textarea
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Any specific requirements, branding details, etc."
                      rows={4}
                    />
                  </Field>
                </div>
                <div className="mt-5">
                  <ConsentCheckbox
                    checked={consent}
                    onCheckedChange={setConsent}
                    purpose="prepare my quote and contact me about it"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !consent}
                  className="mt-5 h-[52px] w-full bg-[#2d4a3e] text-base text-[#f5f0e8] hover:bg-[#2d4a3e]/90"
                >
                  {submitting ? "Submitting…" : "Submit quote request →"}
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
                <div className="font-serif text-3xl text-[#2d4a3e] sm:text-4xl">{t.n}</div>
                <div className="mt-2 text-sm text-[#1a1510]/70">{t.l}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

function Field({
  label,
  error,
  required,
  helper,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-[#c4622d]">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {helper && !error && <p className="mt-1.5 text-xs text-muted-foreground">{helper}</p>}
      {error && <p className="mt-1.5 text-xs text-[#c4622d]">{error}</p>}
    </div>
  );
}

export default EnterpriseQuotePage;

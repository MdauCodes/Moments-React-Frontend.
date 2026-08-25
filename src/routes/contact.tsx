import { Link, useLocation } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { SiteLayout } from "@/components/SiteLayout";
import { useState, type FormEvent } from "react";
import { randomWhatsAppLink } from "@/data/products";
import { Check, Mail, MessageCircle } from "lucide-react";
import { usePersona } from "@/contexts/PersonaContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { api } from "@/services/api";
import { useBotDefenseFields, HoneypotField } from "@/hooks/useBotDefense";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";



type FormState = "idle" | "submitting" | "success" | "error";
type ContactMethod = "whatsapp" | "email";

interface LocationState {
  basketItems?: CartItem[];
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";
const labelClass = "block text-sm font-medium text-foreground mb-1.5";

function ContactPage() {
  const { persona } = usePersona();
  const { items, clearCart: clear } = useCart();
  const isCorp = persona === "corporate";

  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};
  const incoming = state.basketItems;
  const basketProducts: CartItem[] = items.length === 0 && incoming ? incoming : items;

  const [contactMethod, setContactMethod] = useState<ContactMethod>("whatsapp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const [estimatedVolume, setEstimatedVolume] = useState("");
  const [timeline, setTimeline] = useState("");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [referralSource, setReferralSource] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      setFormState("error");
      return;
    }
    setFormState("submitting");

    // The backend's EnquiryCreateRequest only has persona/contact/message/source — several
    // fields this form collects (contact method preference, volume, timeline, basket, artwork
    // filename) have no dedicated column yet, so they're folded into message as readable detail
    // lines instead of being silently dropped.
    const detailLines: string[] = [`Preferred contact method: ${contactMethod}`];
    if (isCorp && estimatedVolume) detailLines.push(`Estimated monthly volume: ${estimatedVolume}`);
    if (isCorp && timeline) detailLines.push(`Required timeline: ${timeline}`);
    if (artworkFile) detailLines.push(`Artwork mentioned (not uploaded via this form): ${artworkFile.name}`);
    if (basketProducts.length > 0) {
      detailLines.push(
        `Products: ${basketProducts
          .map((item) => `${item.productName} x${item.quantity}${item.size ? ` (${item.size})` : ""}`)
          .join(", ")}`,
      );
    }
    if (message) detailLines.push("", message);

    const payload = {
      persona,
      contact: {
        name,
        email: email || undefined,
        phone: phone || undefined,
        company: isCorp ? companyName : undefined,
      },
      message: detailLines.join("\n"),
      source: isCorp ? "corporate-quote-form" : referralSource || "contact-form",
      consentPolicyVersion: PRIVACY_POLICY_VERSION,
      ...toPayload(turnstileToken),
    };

    try {
      await api.submitEnquiry(payload);
      setFormState("success");
      clear();
    } catch (err) {
      console.error("Enquiry submission failed:", err);
      setFormState("error");
    }
  }

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-accent">Get in touch</p>
            <h1 className="mt-3 font-display text-3xl font-medium text-foreground text-balance sm:text-4xl">
              Send us an enquiry
            </h1>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Fill in your details below and choose how you&apos;d like us to reply.
            </p>
          </div>

          {formState === "success" ? (
            <div className="mt-10">
              <SuccessPanel isCorp={isCorp} email={email} contactMethod={contactMethod} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-8">
              {/* How should we reply? */}
              <div>
                <label className={labelClass}>How should we reply?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setContactMethod("whatsapp")}
                    aria-pressed={contactMethod === "whatsapp"}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      contactMethod === "whatsapp"
                        ? "border-[#25D366] bg-[#25D366]/10 text-[#128C4A]"
                        : "border-border text-foreground hover:border-accent/40"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMethod("email")}
                    aria-pressed={contactMethod === "email"}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      contactMethod === "email"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-foreground hover:border-accent/40"
                    }`}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>

              <div className="my-6 h-px bg-border" />

              {/* Form fields */}
              {!isCorp ? (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone number {contactMethod === "whatsapp" ? "*" : "(optional)"}</label>
                    <input
                      type="tel"
                      required={contactMethod === "whatsapp"}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254 7XX XXX XXX"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email {contactMethod === "email" ? "*" : "(optional)"}</label>
                    <input
                      type="email"
                      required={contactMethod === "email"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Message (optional)</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Any specific requirements, colours, or questions?"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>How did you hear about us? (optional)</label>
                    <select
                      value={referralSource}
                      onChange={(e) => setReferralSource(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select...</option>
                      <option>Instagram</option>
                      <option>WhatsApp</option>
                      <option>Referral from another business</option>
                      <option>Google search</option>
                      <option>Walk-in / saw your work</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Contact name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Company name *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company / brand name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Work email {contactMethod === "email" ? "*" : "(optional)"}</label>
                    <input
                      type="email"
                      required={contactMethod === "email"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone {contactMethod === "whatsapp" ? "*" : "(optional)"}</label>
                    <input
                      type="tel"
                      required={contactMethod === "whatsapp"}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254 7XX XXX XXX"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estimated monthly volume *</label>
                    <select
                      required
                      value={estimatedVolume}
                      onChange={(e) => setEstimatedVolume(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select range...</option>
                      <option>5,000 – 10,000 units</option>
                      <option>10,000 – 50,000 units</option>
                      <option>50,000 – 100,000 units</option>
                      <option>100,000+ units</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Required timeline (optional)</label>
                    <input
                      type="text"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      placeholder="e.g. Need by end of March"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Logo / artwork (optional)</label>
                    <input
                      type="file"
                      accept=".pdf,.ai,.png,.jpg,.svg"
                      onChange={(e) => setArtworkFile(e.target.files?.[0] ?? null)}
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      PDF, AI, PNG or SVG. Max 10MB.
                      {artworkFile && ` · Selected: ${artworkFile.name}`}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Additional notes (optional)</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Anything else we should know?"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {formState === "error" && (
                <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Something went wrong. Please try again or{" "}
                  <a
                    href={randomWhatsAppLink("Hi Moments Packaging, I'm having trouble submitting the enquiry form.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    WhatsApp us directly
                  </a>
                  .
                </div>
              )}

              <HoneypotField value={honeypot} onChange={setHoneypot} />

              <div className="mt-6">
                <ConsentCheckbox
                  checked={consent}
                  onCheckedChange={setConsent}
                  purpose="contact me about this enquiry"
                />
              </div>

              <TurnstileWidget onToken={setTurnstileToken} />

              <button
                type="submit"
                disabled={formState === "submitting" || !consent}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {formState === "submitting" ? (
                  <>
                    <InlineProgress size="sm" /> Sending...
                  </>
                ) : isCorp ? (
                  "Request quote →"
                ) : (
                  "Send enquiry →"
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function SuccessPanel({
  isCorp,
  email,
  contactMethod,
}: {
  isCorp: boolean;
  email: string;
  contactMethod: ContactMethod;
}) {
  const willEmail = contactMethod === "email";
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/20">
        <Check className="h-8 w-8 text-accent" />
      </div>
      <h2 className="mt-6 font-display text-2xl text-foreground">Enquiry received!</h2>
      <p className="mt-3 text-muted-foreground">
        {willEmail
          ? `We'll email you back${isCorp ? " within 24 hours" : ""} at ${email || "the address you provided"}.`
          : "We'll WhatsApp you back within 2 hours with your quote. If it's urgent, message us directly."}
      </p>
      {!willEmail && (
        <a
          href={randomWhatsAppLink("Hi Moments Packaging, I just submitted an enquiry.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-medium text-white"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp us now
        </a>
      )}
      <div className="mt-6">
        <Link to="/products" className="text-sm text-accent">
          Browse more products →
        </Link>
      </div>
    </div>
  );
}

export default ContactPage;

import { Link, useLocation } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { SiteLayout } from "@/components/SiteLayout";
import { useState, type FormEvent } from "react";
import { WHATSAPP_NUMBER, whatsappLink } from "@/data/products";
import { Check, MessageCircle, X } from "lucide-react";
import { usePersona } from "@/contexts/PersonaContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { apiUrl } from "@/config/api";



type FormState = "idle" | "submitting" | "success" | "error";

interface LocationState {
  basketItems?: CartItem[];
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";
const labelClass = "block text-sm font-medium text-foreground mb-1.5";

function ContactPage() {
  const { persona } = usePersona();
  const { items, removeItem: remove, clearCart: clear } = useCart();
  const isCorp = persona === "corporate";

  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};
  const incoming = state.basketItems;
  const basketProducts: CartItem[] = items.length === 0 && incoming ? incoming : items;

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      setFormState("error");
      return;
    }
    setFormState("submitting");

    const payload = {
      customerType: isCorp ? "CORPORATE" : "SME",
      name,
      companyName: isCorp ? companyName : undefined,
      email: email || undefined,
      phone,
      message: message || undefined,
      estimatedVolume: isCorp ? estimatedVolume : undefined,
      timeline: isCorp ? timeline : undefined,
      artworkUrl: undefined as string | undefined,
      referralSource: !isCorp ? referralSource : undefined,
      products: basketProducts.map((item) => ({
        productId: item.productId,
        name: item.productName,
        qty: item.quantity,
        size: item.size,
        finish: item.finish,
      })),
    };

    try {
      const response = await fetch(apiUrl("/api/enquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
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
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            {/* LEFT */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <p className="text-xs uppercase tracking-widest text-accent">
                  {isCorp ? "Enterprise enquiry" : "Quick enquiry"}
                </p>
                <h1 className="mt-3 font-display text-3xl font-medium text-foreground text-balance sm:text-4xl">
                  {isCorp ? "Let's talk about your packaging." : "Tell us what you need."}
                </h1>
                <p className="mt-5 text-muted-foreground">
                  {isCorp
                    ? "Share your requirements and your dedicated account manager will be in touch within 24 hours."
                    : "Fill in your details and we'll WhatsApp you a quote within 2 hours."}
                </p>
                <ul className="mt-8 space-y-3">
                  {(isCorp
                    ? [
                        "Dedicated account manager assigned",
                        "Formal quote within 24 hours",
                        "Contracts and SLAs available",
                      ]
                    : [
                        "Free quote, no obligation",
                        "Reply within 2 hours on WhatsApp",
                      ]
                  ).map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT */}
            <div className="lg:col-span-7">
              {formState === "success" ? (
                <SuccessPanel isCorp={isCorp} email={email} />
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-border bg-card p-5 sm:p-8"
                >
                  {/* Products in enquiry */}
                  <div>
                    <h2 className="text-sm font-medium text-foreground">
                      Products in your enquiry
                    </h2>
                    {basketProducts.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-border bg-background/50 p-4">
                        <p className="text-sm text-muted-foreground">No products selected yet.</p>
                        <Link to="/products" className="mt-1 inline-block text-sm text-accent">
                          Browse catalogue →
                        </Link>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {basketProducts.map((item) => (
                          <li
                            key={item.productId}
                            className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3"
                          >
                            <img
                              src={item.primaryImageUrl}
                              alt={item.productName}
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.productName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Qty: {item.quantity} · Size: {item.size} · Finish: {item.finish}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(item.productId)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                              aria-label={`Remove ${item.productName}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {basketProducts.length > 0 && (
                      <Link to="/products" className="mt-2 inline-block text-xs text-accent">
                        Edit basket
                      </Link>
                    )}
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
                        <label className={labelClass}>Phone number *</label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+254 7XX XXX XXX"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email (optional)</label>
                        <input
                          type="email"
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
                        <label className={labelClass}>Work email *</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Phone (optional)</label>
                        <input
                          type="tel"
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
                        href={`https://wa.me/${WHATSAPP_NUMBER}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        WhatsApp us directly
                      </a>
                      .
                    </div>
                  )}

                  <div className="mt-6">
                    <ConsentCheckbox
                      checked={consent}
                      onCheckedChange={setConsent}
                      purpose="contact you about this enquiry"
                    />
                  </div>

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
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function SuccessPanel({ isCorp, email }: { isCorp: boolean; email: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/20">
        <Check className="h-8 w-8 text-accent" />
      </div>
      <h2 className="mt-6 font-display text-2xl text-foreground">Enquiry received!</h2>
      <p className="mt-3 text-muted-foreground">
        {isCorp
          ? `Your account manager will email you within 24 hours with a formal quote. Check your inbox at ${email}.`
          : "We'll WhatsApp you back within 2 hours with your quote. If it's urgent, message us directly."}
      </p>
      {!isCorp && (
        <a
          href={whatsappLink("Hi Moments Packaging, I just submitted an enquiry.")}
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

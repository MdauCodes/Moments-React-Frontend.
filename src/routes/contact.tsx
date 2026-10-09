import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { Check, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { ChatWithUsButton } from "@/components/ChatWithUsButton";
import { ChoiceGroup, Field, PhoneField, inputClass, invalidInputClass } from "@/components/EnquiryFields";
import { InlineProgress } from "@/components/InlineProgress";
import { SiteLayout } from "@/components/SiteLayout";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useCart, type CartItem } from "@/contexts/CartContext";
import {
  ENQUIRY_TOPICS,
  type ChatPrefill,
  type EnquiryOpenOptions,
  type EnquiryTopic,
} from "@/contexts/EnquiryContext";
import { usePersona } from "@/contexts/PersonaContext";
import {
  COMPANY_ADDRESS,
  COMPANY_EMAIL,
  COMPANY_PHONE,
  COMPANY_PHONE_ALT,
  COMPANY_PHONE_ALT_INTL,
  COMPANY_PHONE_INTL,
  randomWhatsAppLink,
} from "@/data/products";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import { focusFirstError } from "@/lib/formFocus";
import {
  REPLY_OPTIONS,
  composeChatMessage,
  composeEnquiryMessage,
  emailLooksReal,
  enquirySource,
  phoneForSubmission,
  phoneLooksReachable,
  submitErrorMessage,
  type ReplyVia,
} from "@/lib/enquiryMessage";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";
import { metaLead } from "@/lib/metaEvents";
import { api } from "@/services/api";

type FormState = "idle" | "submitting" | "success" | "error";

interface LocationState {
  basketItems?: CartItem[];
  /** What the "Enquire" button that brought the visitor here already knew. */
  enquiry?: EnquiryOpenOptions;
}

/** Topics where quantity/date/where-to help us answer in one go instead of three. */
const DETAIL_TOPICS: EnquiryTopic[] = ["bulk", "printing"];

const HEARD_FROM = [
  "Instagram",
  "WhatsApp",
  "A friend or another business",
  "Google search",
  "Walked past / saw your work",
  "Somewhere else",
];

function ContactPage() {
  const { persona } = usePersona();
  const { items, clearCart } = useCart();
  const isCorp = persona === "corporate";

  const location = useLocation();
  const state = (location.state as LocationState | undefined) ?? {};
  const incoming = state.basketItems;
  const basketProducts: CartItem[] = items.length === 0 && incoming ? incoming : items;

  const startingMessage = (e?: EnquiryOpenOptions) =>
    e?.message ?? (e?.product ? `Hi, I'd like to ask about ${e.product.name}.` : "");

  const [topic, setTopic] = useState<EnquiryTopic>(
    state.enquiry?.topic ?? (basketProducts.length > 0 ? "product" : isCorp ? "bulk" : "other"),
  );
  const [replyVia, setReplyVia] = useState<ReplyVia>("whatsapp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState(startingMessage(state.enquiry));
  const [quantity, setQuantity] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorText, setErrorText] = useState<string>("");
  const [showErrors, setShowErrors] = useState(false);
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();

  const renderedAt = useRef(Date.now()).current;
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  const showDetails = DETAIL_TOPICS.includes(topic);

  // Tapping "Enquire" again while already on this page brings a new starting point.
  useEffect(() => {
    const e = state.enquiry;
    if (!e) return;
    if (e.topic) setTopic(e.topic);
    const m = startingMessage(e);
    if (m) setMessage(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const generalWhatsApp = useMemo(
    () => randomWhatsAppLink("Hi Moments Packaging, I have a question about your packaging."),
    [],
  );

  // What the visitor has typed so far, as a chat opening: the same labelled block staff already read on enquiries.
  const chatPrefill: ChatPrefill = {
    name: name.trim() || undefined,
    email: email.trim() || undefined,
    phone: phone.trim() ? phoneForSubmission(phone) : undefined,
    message: composeChatMessage({
      topic,
      replyVia,
      pagePath: location.pathname,
      products: basketProducts.map((i) => ({ name: i.productName, quantity: i.quantity, size: i.size })),
      quantity: showDetails ? quantity : undefined,
      neededBy: showDetails ? neededBy : undefined,
      deliverTo: showDetails ? deliverTo : undefined,
      company: companyName,
      heardFrom,
      text: message,
    }),
  };

  const bad = {
    "ct-name": name.trim().length < 2,
    "ct-phone": !phoneLooksReachable(phone),
    "ct-email": !emailLooksReal(email),
    "ct-message": message.trim().length < 3,
    "ct-consent": !consent,
  };
  const isValid = !Object.values(bad).some(Boolean);

  const errors: Record<string, string | undefined> = {
    "ct-name": showErrors && bad["ct-name"] ? "Please tell us your name." : undefined,
    "ct-phone":
      showErrors && bad["ct-phone"]
        ? phone.trim()
          ? "That number looks incomplete — a Kenyan number is 10 digits, like 0712 345 678."
          : "We need a number to reply on."
        : undefined,
    "ct-email":
      showErrors && bad["ct-email"]
        ? email.trim()
          ? "That email address looks incomplete."
          : "We need an email for your confirmation."
        : undefined,
    "ct-message": showErrors && bad["ct-message"] ? "Add a line or two so we can help." : undefined,
    "ct-consent": showErrors && bad["ct-consent"] ? "Please tick this so we are allowed to reply." : undefined,
  };

  useEffect(() => {
    if (formState === "success") successRef.current?.focus();
  }, [formState]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) {
      setShowErrors(true);
      requestAnimationFrame(() =>
        focusFirstError(
          ["ct-name", "ct-phone", "ct-email", "ct-message", "ct-consent"],
          Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v ? "x" : undefined])),
        ),
      );
      return;
    }
    setFormState("submitting");
    try {
      // The backend rejects anything submitted within 3s of the form appearing (bot defence).
      // Hold the request rather than disabling the button, so the rule is never something the
      // visitor has to notice or work around.
      const waited = Date.now() - renderedAt;
      if (waited < 3400) await new Promise((r) => setTimeout(r, 3400 - waited));

      await api.submitEnquiry({
        persona: persona ?? undefined,
        contact: {
          name: name.trim(),
          email: email.trim(),
          phone: phoneForSubmission(phone),
          company: companyName.trim() || undefined,
        },
        message: composeEnquiryMessage({
          topic,
          replyVia,
          pagePath: location.pathname,
          products: basketProducts.map((i) => ({
            name: i.productName,
            quantity: i.quantity,
            size: i.size,
          })),
          quantity: showDetails ? quantity : undefined,
          neededBy: showDetails ? neededBy : undefined,
          deliverTo: showDetails ? deliverTo : undefined,
          company: companyName,
          heardFrom,
          text: message,
        }),
        // `source` is the CRM's topic signal — it must stay "quick-enquiry:<topic>". It used to be
        // set to whatever the visitor picked under "How did you hear about us?", which meant the
        // CRM saw source="Instagram", could not work out the topic, and the source column stopped
        // meaning "which form was this". That answer now travels in the message instead.
        source: enquirySource(topic),
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
        ...toPayload(turnstileToken),
      });
      setFormState("success");
      metaLead("contact");
      clearCart();
    } catch (err) {
      console.error("Enquiry submission failed:", err);
      setErrorText(submitErrorMessage(err));
      setFormState("error");
      requestAnimationFrame(() => errorBannerRef.current?.focus());
    }
  }

  const whatsappFallback = randomWhatsAppLink(
    `Hi Moments Packaging, ${message.trim() || "I have a question about your packaging."}`,
  );

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-accent">Get in touch</p>
            <h1 className="mt-3 font-display text-3xl font-medium text-balance text-foreground sm:text-4xl">
              Talk to us your way
            </h1>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Call, message, email or drop by, or leave us a note below. A real person replies, usually the same day.
            </p>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
            <WayCard
              href={`tel:${COMPANY_PHONE_INTL.replace(/\s/g, "")}`}
              icon={<Phone className="h-5 w-5" aria-hidden="true" />}
              title="Call us"
              detail={COMPANY_PHONE}
              extra={{ href: `tel:${COMPANY_PHONE_ALT_INTL.replace(/\s/g, "")}`, label: COMPANY_PHONE_ALT }}
            />
            <WayCard
              href={generalWhatsApp}
              external
              icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
              title="WhatsApp"
              detail="Message us now"
            />
            <WayCard
              href={`mailto:${COMPANY_EMAIL}`}
              icon={<Mail className="h-5 w-5" aria-hidden="true" />}
              title="Email"
              detail={COMPANY_EMAIL}
            />
            <WayCard
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY_ADDRESS)}`}
              external
              icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
              title="Visit us"
              detail={COMPANY_ADDRESS}
            />
          </ul>

          {formState !== "success" && (
            <h2 className="mt-10 text-center font-display text-xl text-foreground">Or send us a message</h2>
          )}

          {formState === "success" ? (
            <div className="mt-10">
              <SuccessPanel
                ref={successRef}
                name={name}
                email={email}
                replyVia={replyVia}
                whatsappHref={whatsappFallback}
              />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-4 space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-8"
            >
              <ChoiceGroup
                legend="What is this about?"
                options={ENQUIRY_TOPICS}
                value={topic}
                onChange={setTopic}
              />

              {basketProducts.length > 0 && (
                <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
                  <p className="font-medium">We will include your basket:</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {basketProducts.map((i, idx) => (
                      <li key={`${i.productName}-${idx}`}>
                        {i.productName}
                        {i.size ? ` (${i.size})` : ""} × {i.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Field id="ct-name" label="Your name" error={errors["ct-name"]}>
                {(aria) => (
                  <input
                    {...aria}
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. Amina Wanjiru"
                    className={`${inputClass} ${errors["ct-name"] ? invalidInputClass : ""}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </Field>

              <PhoneField id="ct-phone" value={phone} onChange={setPhone} error={errors["ct-phone"]} />

              <Field
                id="ct-email"
                label="Email"
                hint="For your confirmation and anything we need to put in writing."
                error={errors["ct-email"]}
              >
                {(aria) => (
                  <input
                    {...aria}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    name="email"
                    placeholder="you@example.com"
                    className={`${inputClass} ${errors["ct-email"] ? invalidInputClass : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Field>

              <Field id="ct-company" label="Business name" optional hint="If you are buying for a business.">
                {(aria) => (
                  <input
                    {...aria}
                    name="organization"
                    autoComplete="organization"
                    placeholder="e.g. Amina's Bakery"
                    className={inputClass}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                )}
              </Field>

              <ChoiceGroup
                legend="How should we get back to you?"
                options={REPLY_OPTIONS}
                value={replyVia}
                onChange={setReplyVia}
                columns={3}
              />

              {showDetails && (
                <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/30 p-4">
                  <p className="text-xs text-muted-foreground">
                    These help us quote you properly — skip any you are not sure about yet.
                  </p>
                  <Field id="ct-quantity" label="Roughly how many?" optional>
                    {(aria) => (
                      <input
                        {...aria}
                        className={inputClass}
                        placeholder="e.g. 500 pieces"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field id="ct-needed-by" label="When do you need them?" optional>
                    {(aria) => (
                      <input
                        {...aria}
                        className={inputClass}
                        placeholder="e.g. in 2 weeks"
                        value={neededBy}
                        onChange={(e) => setNeededBy(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field id="ct-deliver-to" label="Where are we delivering?" optional>
                    {(aria) => (
                      <input
                        {...aria}
                        className={inputClass}
                        autoComplete="address-level2"
                        placeholder="e.g. Nairobi CBD, or Kisumu"
                        value={deliverTo}
                        onChange={(e) => setDeliverTo(e.target.value)}
                      />
                    )}
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Got a logo or artwork? Mention it below and we will ask you for the file when we
                    reply.
                  </p>
                </div>
              )}

              <Field id="ct-message" label="What can we help you with?" error={errors["ct-message"]}>
                {(aria) => (
                  <textarea
                    {...aria}
                    rows={4}
                    name="message"
                    placeholder="A sentence or two is plenty — sizes, colours, quantities, or just your question."
                    className={`${inputClass} ${errors["ct-message"] ? invalidInputClass : ""}`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                )}
              </Field>

              <Field id="ct-heard" label="How did you hear about us?" optional>
                {(aria) => (
                  <select
                    {...aria}
                    className={inputClass}
                    value={heardFrom}
                    onChange={(e) => setHeardFrom(e.target.value)}
                  >
                    <option value="">Rather not say</option>
                    {HEARD_FROM.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <HoneypotField value={honeypot} onChange={setHoneypot} />
              <TurnstileWidget onToken={setTurnstileToken} />

              <div>
                <ConsentCheckbox
                  id="ct-consent"
                  checked={consent}
                  onCheckedChange={setConsent}
                  purpose="contact me about this enquiry"
                />
                {errors["ct-consent"] && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">{errors["ct-consent"]}</p>
                )}
              </div>

              {formState === "error" && (
                <div
                  ref={errorBannerRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
                >
                  {errorText}{" "}
                  <a href={whatsappFallback} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                    Or send it to us on WhatsApp
                  </a>
                  .
                </div>
              )}

              <button
                type="submit"
                disabled={formState === "submitting"}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {formState === "submitting" ? (
                  <>
                    <InlineProgress size="sm" /> Sending…
                  </>
                ) : (
                  "Send my enquiry"
                )}
              </button>

            </form>
          )}

          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-medium text-foreground">Prefer to chat live?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chat with our team right here. Anything you have filled in above goes into the chat for you.
              </p>
            </div>
            <ChatWithUsButton primary prefill={chatPrefill} className="w-full shrink-0 sm:w-auto" />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function WayCard({
  href,
  icon,
  title,
  detail,
  external = false,
  extra,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  external?: boolean;
  extra?: { href: string; label: string };
}) {
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-3.5 sm:p-5">
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex min-h-[72px] min-w-0 flex-1 flex-col gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-accent">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="break-words text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">{detail}</span>
      </a>
      {extra && (
        <a href={extra.href} className="mt-2 inline-flex min-h-[40px] items-center text-xs font-medium text-accent underline">
          {extra.label}
        </a>
      )}
    </li>
  );
}

function SuccessPanel({
  ref,
  name,
  email,
  replyVia,
  whatsappHref,
}: {
  ref: Ref<HTMLDivElement>;
  name: string;
  email: string;
  replyVia: ReplyVia;
  whatsappHref: string;
}) {
  const firstName = name.trim().split(" ")[0];
  const how = replyVia === "email" ? "by email" : replyVia === "call" ? "with a call" : "on WhatsApp";
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-2xl border border-border bg-card p-8 text-center focus:outline-none sm:p-10"
    >
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/20">
        <Check className="h-8 w-8 text-accent" aria-hidden="true" />
      </div>
      <h2 className="mt-6 font-display text-2xl text-foreground">Got it, {firstName} — thank you</h2>
      <p className="mt-3 text-muted-foreground">
        Your message is with our team and we will get back to you {how} within one working day. We are
        here Monday to Friday, 8am to 5pm, and Saturday mornings.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        A copy is on its way to <span className="font-medium text-foreground">{email.trim()}</span>.
      </p>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-medium text-white"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> In a hurry? Chat with us now
      </a>
      <div className="mt-6">
        <Link to="/products" className="text-sm text-accent">
          Keep browsing our packaging →
        </Link>
      </div>
    </div>
  );
}

export default ContactPage;

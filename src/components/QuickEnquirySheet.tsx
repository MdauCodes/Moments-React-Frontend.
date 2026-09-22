import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Check, MessageCircle } from "lucide-react";

import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { ChoiceGroup, Field, PhoneField, inputClass, invalidInputClass } from "@/components/EnquiryFields";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ENQUIRY_TOPICS, useEnquiry, type EnquiryOpenOptions, type EnquiryTopic } from "@/contexts/EnquiryContext";
import { usePersona } from "@/contexts/PersonaContext";
import { whatsappLink } from "@/data/products";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import { focusFirstError } from "@/lib/formFocus";
import {
  REPLY_OPTIONS,
  composeEnquiryMessage,
  emailLooksReal,
  enquirySource,
  phoneForSubmission,
  phoneLooksReachable,
  submitErrorMessage,
  type ReplyVia,
} from "@/lib/enquiryMessage";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";
import { api } from "@/services/api";

type FormState = "idle" | "submitting" | "success" | "error";

/** Topics where knowing the quantity, the date and the drop-off point saves a whole round trip. */
const DETAIL_TOPICS: EnquiryTopic[] = ["bulk", "printing"];

const QUANTITY_PRESETS = ["Under 100", "100 – 500", "500 – 2,000", "2,000 – 10,000", "10,000+"];
const NEEDED_BY_PRESETS = ["This week", "In 2–3 weeks", "Next month", "Just planning ahead"];

function defaultMessage(options: EnquiryOpenOptions): string {
  if (options.message) return options.message;
  return "";
}

/** A friendly, topic-aware prompt above the message box. */
function promptFor(topic: EnquiryTopic, productName?: string): string {
  if (productName) return `What would you like to know about ${productName}?`;
  switch (topic) {
    case "product":
      return "Want to ask something about our product catalogue?";
    case "bulk":
      return "Tell us what you need and we will work out a price.";
    case "printing":
      return "Tell us what you would like printed.";
    case "order":
      return "Which order is this about?";
    default:
      return "What can we help you with?";
  }
}

function EnquiryForm({ onDone }: { onDone: () => void }) {
  const { options } = useEnquiry();
  const { persona } = usePersona();
  const { user } = useAuth();
  const location = useLocation();
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();

  const [topic, setTopic] = useState<EnquiryTopic>(options.topic ?? (options.product ? "product" : "other"));
  const [name, setName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [replyVia, setReplyVia] = useState<ReplyVia>("whatsapp");
  const [text, setText] = useState(defaultMessage(options));
  const [quantity, setQuantity] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorText, setErrorText] = useState<string>("");
  const [showErrors, setShowErrors] = useState(false);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  // The server rejects a form submitted within 3s of it appearing (bot defence). Rather than
  // disabling the button — which leaves someone tapping a dead control — we let them submit and
  // hold the request until the window passes, so it is never a visible obstacle.
  const renderedAt = useRef(Date.now()).current;

  const showDetails = DETAIL_TOPICS.includes(topic);

  const errors: Record<string, string | undefined> = {
    "qe-name": showErrors && name.trim().length < 2 ? "Please tell us your name." : undefined,
    "qe-phone":
      showErrors && !phoneLooksReachable(phone)
        ? phone.trim()
          ? "That number looks incomplete — a Kenyan number is 10 digits, like 0712 345 678."
          : "We need a number to reply on."
        : undefined,
    "qe-email":
      showErrors && !emailLooksReal(email)
        ? email.trim()
          ? "That email address looks incomplete."
          : "We need an email for your confirmation."
        : undefined,
    "qe-message": showErrors && text.trim().length < 3 ? "Add a line or two so we can help." : undefined,
    "qe-consent": showErrors && !consent ? "Please tick this so we are allowed to reply." : undefined,
  };
  const fieldOrder = ["qe-name", "qe-phone", "qe-email", "qe-message", "qe-consent"];
  const isValid =
    name.trim().length >= 2 &&
    phoneLooksReachable(phone) &&
    emailLooksReal(email) &&
    text.trim().length >= 3 &&
    consent;

  const whatsappText = `Hi Moments Packaging, ${text.trim() || "I have a question about your packaging."}`;

  useEffect(() => {
    if (formState === "success") successRef.current?.focus();
  }, [formState]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) {
      setShowErrors(true);
      // Let the error text render before we go looking for the field to focus.
      requestAnimationFrame(() =>
        focusFirstError(fieldOrder, {
          "qe-name": name.trim().length < 2 ? "x" : undefined,
          "qe-phone": !phoneLooksReachable(phone) ? "x" : undefined,
          "qe-email": !emailLooksReal(email) ? "x" : undefined,
          "qe-message": text.trim().length < 3 ? "x" : undefined,
          "qe-consent": !consent ? "x" : undefined,
        }),
      );
      return;
    }
    setFormState("submitting");
    try {
      const waited = Date.now() - renderedAt;
      if (waited < 3400) await new Promise((r) => setTimeout(r, 3400 - waited));

      await api.submitEnquiry({
        persona: persona ?? undefined,
        contact: {
          name: name.trim(),
          phone: phoneForSubmission(phone),
          email: email.trim(),
        },
        message: composeEnquiryMessage({
          topic,
          replyVia,
          pagePath: location.pathname,
          product: options.product ? { name: options.product.name, slug: options.product.slug } : undefined,
          quantity: showDetails ? quantity : undefined,
          neededBy: showDetails ? neededBy : undefined,
          deliverTo: showDetails ? deliverTo : undefined,
          text,
        }),
        source: enquirySource(topic),
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
        ...toPayload(turnstileToken),
      });
      setFormState("success");
    } catch (err) {
      console.error("Quick enquiry failed:", err);
      setErrorText(submitErrorMessage(err));
      setFormState("error");
      requestAnimationFrame(() => errorBannerRef.current?.focus());
    }
  }

  if (formState === "success") {
    const firstName = name.trim().split(" ")[0];
    const how =
      replyVia === "email" ? "by email" : replyVia === "call" ? "with a call" : "on WhatsApp";
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="mt-8 rounded-2xl border border-border bg-cream p-6 text-center focus:outline-none"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
          <Check className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-display text-xl text-foreground">Got it, {firstName} — thank you</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your message is with our team. We will get back to you {how} within one working day
          (we are here Monday to Friday, 8am to 5pm, and Saturday mornings).
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          We have also emailed you a copy at <span className="font-medium text-foreground">{email.trim()}</span>.
        </p>
        <a
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> In a hurry? Chat with us now
        </a>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 block w-full py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5 pb-4">
      <ChoiceGroup legend="What is this about?" options={ENQUIRY_TOPICS} value={topic} onChange={setTopic} />

      {options.product && (
        <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
          About: <span className="font-medium">{options.product.name}</span>
        </p>
      )}

      <Field id="qe-name" label="Your name" error={errors["qe-name"]}>
        {(aria) => (
          <input
            {...aria}
            className={`${inputClass} ${errors["qe-name"] ? invalidInputClass : ""}`}
            autoComplete="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>

      <PhoneField id="qe-phone" value={phone} onChange={setPhone} error={errors["qe-phone"]} />

      <Field
        id="qe-email"
        label="Email"
        hint="For your confirmation and anything we need to send in writing."
        error={errors["qe-email"]}
      >
        {(aria) => (
          <input
            {...aria}
            type="email"
            inputMode="email"
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            className={`${inputClass} ${errors["qe-email"] ? invalidInputClass : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

      {/* Only for bulk and printing: the three things we would otherwise have to ask for. */}
      {showDetails && (
        <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground">
            These three help us quote you properly — skip any you are not sure about.
          </p>
          <Field id="qe-quantity" label="Roughly how many?" optional>
            {(aria) => (
              <>
                <input
                  {...aria}
                  list="qe-quantity-options"
                  className={inputClass}
                  placeholder="e.g. 500 pieces"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <datalist id="qe-quantity-options">
                  {QUANTITY_PRESETS.map((q) => (
                    <option key={q} value={q} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field id="qe-needed-by" label="When do you need them?" optional>
            {(aria) => (
              <>
                <input
                  {...aria}
                  list="qe-needed-by-options"
                  className={inputClass}
                  placeholder="e.g. in 2 weeks"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                />
                <datalist id="qe-needed-by-options">
                  {NEEDED_BY_PRESETS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field id="qe-deliver-to" label="Where are we delivering?" optional>
            {(aria) => (
              <input
                {...aria}
                className={inputClass}
                autoComplete="address-level2"
                placeholder="e.g. Nairobi CBD, or Nakuru"
                value={deliverTo}
                onChange={(e) => setDeliverTo(e.target.value)}
              />
            )}
          </Field>
        </div>
      )}

      <Field id="qe-message" label={promptFor(topic, options.product?.name)} error={errors["qe-message"]}>
        {(aria) => (
          <textarea
            {...aria}
            rows={4}
            name="message"
            className={`${inputClass} ${errors["qe-message"] ? invalidInputClass : ""}`}
            placeholder="A sentence or two is plenty."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>

      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget onToken={setTurnstileToken} />

      <div>
        <ConsentCheckbox id="qe-consent" checked={consent} onCheckedChange={setConsent} purpose="answer this enquiry" />
        {errors["qe-consent"] && (
          <p id="qe-consent-error" className="mt-1.5 text-xs font-medium text-destructive">
            {errors["qe-consent"]}
          </p>
        )}
      </div>

      {formState === "error" && (
        <div
          ref={errorBannerRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
        >
          {errorText}{" "}
          <a
            href={whatsappLink(whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            Or send it on WhatsApp instead
          </a>
          .
        </div>
      )}

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="h-[52px] w-full rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {formState === "submitting" ? "Sending…" : "Send my question"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Would rather chat?{" "}
        <a
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline"
        >
          Message us on WhatsApp
        </a>
      </p>
    </form>
  );
}

export function QuickEnquirySheet() {
  const { isOpen, closeEnquiry } = useEnquiry();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeEnquiry()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Ask us anything</SheetTitle>
          <SheetDescription>
            Want to ask something about our product catalogue, a price, printing or an order? Send it
            here and a real person will get back to you.
          </SheetDescription>
        </SheetHeader>
        <EnquiryForm onDone={closeEnquiry} />
      </SheetContent>
    </Sheet>
  );
}

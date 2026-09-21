import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Check, MessageCircle } from "lucide-react";

import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ENQUIRY_TOPICS, useEnquiry, type EnquiryOpenOptions, type EnquiryTopic } from "@/contexts/EnquiryContext";
import { usePersona } from "@/contexts/PersonaContext";
import { whatsappLink } from "@/data/products";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";
import { api } from "@/services/api";

type ReplyVia = "whatsapp" | "call" | "email";
type FormState = "idle" | "submitting" | "success" | "error";

const REPLY_OPTIONS: { code: ReplyVia; label: string }[] = [
  { code: "whatsapp", label: "WhatsApp" },
  { code: "call", label: "Call me" },
  { code: "email", label: "Email" },
];

const PHONE_PATTERN = /^[+0-9()\s-]{7,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";
const labelClass = "mb-1.5 block text-sm font-medium text-foreground";
const errorClass = "mt-1 text-xs text-destructive";

function phoneLooksReal(value: string): boolean {
  return PHONE_PATTERN.test(value.trim()) && (value.match(/\d/g) ?? []).length >= 9;
}

function defaultMessage(options: EnquiryOpenOptions): string {
  if (options.message) return options.message;
  if (options.product) return `Hi, I'd like to know more about ${options.product.name}.`;
  return "";
}

/**
 * The lines the sales team (and later the CRM) read first. Kept as plain "Label: value" lines, one
 * per fact, so nothing about the request has to be guessed from free text.
 */
function buildMessage(args: {
  topic: EnquiryTopic;
  options: EnquiryOpenOptions;
  replyVia: ReplyVia;
  pagePath: string;
  text: string;
}): string {
  const topicLabel = ENQUIRY_TOPICS.find((t) => t.code === args.topic)?.label ?? args.topic;
  const lines = [`Topic: ${topicLabel}`];
  const product = args.options.product;
  if (product) {
    const url = product.slug ? ` (${window.location.origin}/products/${product.slug})` : "";
    lines.push(`Product: ${product.name}${url}`);
  }
  lines.push(`Preferred contact: ${REPLY_OPTIONS.find((r) => r.code === args.replyVia)?.label ?? args.replyVia}`);
  lines.push(`Page: ${args.pagePath}`);
  lines.push("", args.text.trim());
  return lines.join("\n");
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
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [showErrors, setShowErrors] = useState(false);
  // The server rejects a form submitted within 3s of it appearing (bot defence): wait it out here so a
  // fast autofill-and-send does not fail with a confusing error.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3200);
    return () => clearTimeout(t);
  }, []);

  const problems = {
    name: name.trim().length < 2,
    phone: !phoneLooksReal(phone),
    email: !EMAIL_PATTERN.test(email.trim()),
    text: text.trim().length < 3,
    consent: !consent,
  };
  const hasProblems = Object.values(problems).some(Boolean);

  const whatsappText = `Hi Moments Packaging, ${text.trim() || "I have a question about your packaging."}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hasProblems) {
      setShowErrors(true);
      return;
    }
    setFormState("submitting");
    try {
      await api.submitEnquiry({
        persona: persona ?? undefined,
        contact: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        },
        message: buildMessage({ topic, options, replyVia, pagePath: location.pathname, text }),
        source: `quick-enquiry:${topic}`,
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
        ...toPayload(turnstileToken),
      });
      setFormState("success");
    } catch (err) {
      console.error("Quick enquiry failed:", err);
      setFormState("error");
    }
  }

  if (formState === "success") {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-cream p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
          <Check className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-display text-xl text-foreground">Thank you, {name.trim().split(" ")[0]}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We have your message and will reply
          {replyVia === "email" ? " by email" : replyVia === "call" ? " with a call" : " on WhatsApp"} during working
          hours (Monday to Friday, 8am to 5pm).
        </p>
        <a
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Prefer to chat right now? WhatsApp us
        </a>
        <button type="button" onClick={onDone} className="mt-4 block w-full text-sm text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <fieldset>
        <legend className={labelClass}>What is this about?</legend>
        <div className="flex flex-wrap gap-2">
          {ENQUIRY_TOPICS.map((t) => (
            <button
              key={t.code}
              type="button"
              aria-pressed={topic === t.code}
              onClick={() => setTopic(t.code)}
              className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                topic === t.code
                  ? "border-accent bg-accent/10 font-medium text-foreground"
                  : "border-border text-foreground/80 hover:border-accent/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      {options.product && (
        <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-foreground">
          About: <span className="font-medium">{options.product.name}</span>
        </p>
      )}

      <div>
        <label htmlFor="qe-name" className={labelClass}>
          Your name *
        </label>
        <input id="qe-name" className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        {showErrors && problems.name && <p className={errorClass}>Please tell us your name.</p>}
      </div>

      <div>
        <label htmlFor="qe-phone" className={labelClass}>
          Phone number *
        </label>
        <input
          id="qe-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="e.g. 0712 345 678"
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {showErrors && problems.phone && <p className={errorClass}>Enter a phone number we can reach you on.</p>}
      </div>

      <div>
        <label htmlFor="qe-email" className={labelClass}>
          Email *
        </label>
        <input
          id="qe-email"
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {showErrors && problems.email && (
          <p className={errorClass}>{!email.trim() ? "Please add your email address." : "That email does not look right."}</p>
        )}
      </div>

      <fieldset>
        <legend className={labelClass}>How should we reply?</legend>
        <div className="grid grid-cols-3 gap-2">
          {REPLY_OPTIONS.map((r) => (
            <button
              key={r.code}
              type="button"
              aria-pressed={replyVia === r.code}
              onClick={() => setReplyVia(r.code)}
              className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                replyVia === r.code
                  ? "border-accent bg-accent/10 font-medium text-foreground"
                  : "border-border text-foreground/80 hover:border-accent/40"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="qe-message" className={labelClass}>
          Your question *
        </label>
        <textarea
          id="qe-message"
          rows={4}
          className={inputClass}
          placeholder="Tell us what you need: sizes, quantities, printing, timing…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {showErrors && problems.text && <p className={errorClass}>Add a short message so we can help.</p>}
      </div>

      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget onToken={setTurnstileToken} />

      <div>
        <ConsentCheckbox id="qe-consent" checked={consent} onCheckedChange={setConsent} purpose="answer this enquiry" />
        {showErrors && problems.consent && <p className={errorClass}>Please tick the box so we can reply to you.</p>}
      </div>

      {formState === "error" && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          We could not send that just now. Please check your number and try again, or{" "}
          <a
            href={whatsappLink(whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            send it on WhatsApp instead
          </a>
          .
        </div>
      )}

      <button
        type="submit"
        disabled={formState === "submitting" || !ready}
        className="h-[52px] w-full rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {formState === "submitting" ? "Sending…" : "Send enquiry"}
      </button>
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
            Questions about a product, a price, printing or an order? Send it here and we will get back to you.
          </SheetDescription>
        </SheetHeader>
        <EnquiryForm onDone={closeEnquiry} />
      </SheetContent>
    </Sheet>
  );
}

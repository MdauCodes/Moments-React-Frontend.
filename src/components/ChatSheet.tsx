import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";

import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { Field, inputClass, invalidInputClass } from "@/components/EnquiryFields";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useEnquiry } from "@/contexts/EnquiryContext";
import { whatsappLink } from "@/data/products";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import {
  ChatApiError,
  chatErrorText,
  clearSession,
  fetchAvailability,
  loadSession,
  mergeMessages,
  pollMessages,
  postMessage,
  saveSession,
  startChat,
  type ChatMessage,
  type ChatSession,
} from "@/lib/chatClient";
import { emailLooksReal, phoneLooksReachable, phoneForSubmission } from "@/lib/enquiryMessage";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";

const POLL_MS = 3000;
const MAX_LENGTH = 1000;

/**
 * "Chat with us": a side panel like the enquiry form. A visitor gives a name, a way to reach them and a first
 * message; after that it is a plain conversation that the team answers from the CRM. While the panel is open it
 * checks for replies every few seconds; if the visitor leaves, a reply is emailed to them (when they gave an email)
 * and the chat is still here, with its history, the next time they open the panel.
 */
export function ChatSheet() {
  const { isChatOpen, closeChat } = useEnquiry();
  return (
    <Sheet open={isChatOpen} onOpenChange={(open) => !open && closeChat()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Chat with us</SheetTitle>
          <SheetDescription>
            Ask about a product, a price, printing or an order. A real person answers.
          </SheetDescription>
        </SheetHeader>
        <ChatPanel />
      </SheetContent>
    </Sheet>
  );
}

type Mode = "form" | "chat" | "ended";

function ChatPanel() {
  const [session, setSession] = useState<ChatSession | null>(() => loadSession());
  const [mode, setMode] = useState<Mode>(() => (loadSession() ? "chat" : "form"));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [staffOnline, setStaffOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchAvailability().then((online) => alive && setStaffOnline(online));
    return () => {
      alive = false;
    };
  }, []);

  function begin(next: ChatSession, first: ChatMessage, online: boolean) {
    saveSession(next);
    setSession(next);
    setMessages([first]);
    setStaffOnline(online);
    setMode("chat");
  }

  // A chat that has ended also forgets its secret, so the next person at a shared device cannot read or continue it.
  const handleEnded = useCallback(() => {
    clearSession();
    setMode("ended");
  }, []);

  function startAgain() {
    clearSession();
    setSession(null);
    setMessages([]);
    setMode("form");
  }

  if (mode === "chat" && session) {
    return (
      <Conversation
        session={session}
        messages={messages}
        setMessages={setMessages}
        staffOnline={staffOnline}
        setStaffOnline={setStaffOnline}
        onEnded={handleEnded}
      />
    );
  }
  if (mode === "ended") {
    return (
      <div className="mt-6 space-y-4 text-sm">
        <Transcript messages={messages} />
        <p className="rounded-xl border border-border bg-cream p-4 text-foreground">
          This chat has ended. Thank you for talking to us. You can start a new one any time.
        </p>
        <button
          type="button"
          onClick={startAgain}
          className="min-h-[48px] w-full rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Start a new chat
        </button>
      </div>
    );
  }
  return <StartForm staffOnline={staffOnline} onStarted={begin} />;
}

function StartForm({
  staffOnline,
  onStarted,
}: {
  staffOnline: boolean;
  onStarted: (s: ChatSession, first: ChatMessage, online: boolean) => void;
}) {
  const { user } = useAuth();
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();
  const [name, setName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const renderedAt = useRef(Date.now()).current;

  const emailGiven = email.trim().length > 0;
  const phoneGiven = phone.trim().length > 0;
  const errors = {
    name: showErrors && name.trim().length < 2 ? "Please tell us your name." : undefined,
    email:
      showErrors && emailGiven && !emailLooksReal(email)
        ? "That email address looks incomplete."
        : undefined,
    phone:
      showErrors && phoneGiven && !phoneLooksReachable(phone)
        ? "That number looks incomplete."
        : undefined,
    reach:
      showErrors && !emailGiven && !phoneGiven
        ? "Give an email or a phone number so we can reach you if you leave this page."
        : undefined,
    message: showErrors && message.trim().length < 2 ? "Write your question first." : undefined,
    consent: showErrors && !consent ? "Please tick this so we are allowed to reply." : undefined,
  };
  const valid =
    name.trim().length >= 2 &&
    (emailGiven || phoneGiven) &&
    (!emailGiven || emailLooksReal(email)) &&
    (!phoneGiven || phoneLooksReachable(phone)) &&
    message.trim().length >= 2 &&
    consent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      // The server turns away a form filled in within 3 seconds of appearing; wait it out instead of failing.
      const wait = 3200 - (Date.now() - renderedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const started = await startChat({
        name,
        email,
        phone: phoneGiven ? phoneForSubmission(phone) : "",
        message,
        // Only where they were (no query string: it can carry an email, a token or an order reference).
        pageUrl: window.location.origin + window.location.pathname,
        consentPolicyVersion: PRIVACY_POLICY_VERSION,
        ...toPayload(turnstileToken),
      });
      onStarted(started.session, started.first, started.staffOnline);
    } catch (err) {
      setError(chatErrorText(err));
      // A security-check token works once; ask for a fresh one so a retry is not refused for reusing it.
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex-1 space-y-4 overflow-y-auto pb-4">
      <p
        className={`rounded-xl px-4 py-3 text-sm ${staffOnline ? "bg-accent/15 text-foreground" : "bg-secondary text-foreground"}`}
        role="status"
      >
        {staffOnline
          ? "We are online now and usually answer within a few minutes."
          : "We are not online right now. Leave your question and we will answer here, or by email if you give one."}
      </p>
      <Field id="chat-name" label="Your name" error={errors.name}>
        {(aria) => (
          <input
            {...aria}
            name="name"
            maxLength={120}
            autoComplete="name"
            className={`${inputClass} ${errors.name ? invalidInputClass : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <Field
        id="chat-email"
        label="Email"
        optional
        error={errors.email ?? errors.reach}
        hint="So we can reply if you close this page."
      >
        {(aria) => (
          <input
            {...aria}
            type="email"
            name="email"
            maxLength={255}
            autoComplete="email"
            inputMode="email"
            className={`${inputClass} ${errors.email || errors.reach ? invalidInputClass : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field
        id="chat-phone"
        label="Phone"
        optional
        error={errors.phone}
        hint="Email or phone, at least one."
      >
        {(aria) => (
          <input
            {...aria}
            type="tel"
            name="phone"
            maxLength={30}
            autoComplete="tel"
            inputMode="tel"
            className={`${inputClass} ${errors.phone ? invalidInputClass : ""}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </Field>
      <Field id="chat-message" label="Your question" error={errors.message}>
        {(aria) => (
          <textarea
            {...aria}
            rows={3}
            name="message"
            maxLength={MAX_LENGTH}
            className={`${inputClass} ${errors.message ? invalidInputClass : ""}`}
            placeholder="A sentence or two is plenty."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        )}
      </Field>

      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />

      <div>
        <ConsentCheckbox
          id="chat-consent"
          checked={consent}
          onCheckedChange={setConsent}
          purpose="answer this chat and follow up with you about your enquiry"
        />
        {errors.consent && (
          <p className="mt-1.5 text-xs font-medium text-destructive">{errors.consent}</p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground"
        >
          {error}{" "}
          <a
            href={whatsappLink("Hi Moments Packaging, I have a question about your packaging.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            Or message us on WhatsApp
          </a>
          .
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Starting chat…" : "Start chat"}
      </button>
    </form>
  );
}

function Conversation({
  session,
  messages,
  setMessages,
  staffOnline,
  setStaffOnline,
  onEnded,
}: {
  session: ChatSession;
  messages: ChatMessage[];
  setMessages: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
  staffOnline: boolean;
  setStaffOnline: (online: boolean) => void;
  onEnded: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  lastId.current = messages.length ? messages[messages.length - 1]!.id : 0;

  // Check for replies while the panel is open and the tab is in front. A stale or unknown chat ends cleanly.
  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const poll = await pollMessages(session, lastId.current);
        if (stopped) return;
        setMessages((cur) => mergeMessages(cur, poll.messages));
        setStaffOnline(poll.staffOnline);
        if (poll.status === "CLOSED") onEnded();
      } catch (err) {
        if (err instanceof ChatApiError && err.status === 404) {
          clearSession();
          if (!stopped) onEnded();
        }
        // anything else (offline, a busy moment) is retried on the next tick
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    // Coming back to the tab: catch up now instead of waiting for the next tick.
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, setMessages, setStaffOnline, onEnded]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const sent = await postMessage(session, body);
      setMessages((cur) => mergeMessages(cur, [sent]));
      setText("");
    } catch (err) {
      if (err instanceof ChatApiError && (err.status === 409 || err.status === 404)) {
        if (err.status === 404) clearSession();
        onEnded();
      } else {
        setError(chatErrorText(err));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <p className="mb-2 text-xs text-muted-foreground" role="status">
        {staffOnline
          ? "We are online."
          : "We are not online right now. We will answer here, or by email if you gave one."}
      </p>
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3"
      >
        <Transcript messages={messages} />
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-3 space-y-2">
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
            rows={2}
            maxLength={MAX_LENGTH}
            aria-label="Your message"
            placeholder="Write a message…"
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Transcript({ messages }: { messages: ChatMessage[] }) {
  return (
    <>
      {messages.map((m) => {
        const mine = m.sender === "VISITOR";
        return (
          <div key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
            {!mine && (
              <span className="text-xs text-muted-foreground">
                {m.senderName || "Moments Packaging"}
              </span>
            )}
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                mine
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-secondary text-foreground"
              }`}
            >
              {m.body}
            </p>
          </div>
        );
      })}
    </>
  );
}

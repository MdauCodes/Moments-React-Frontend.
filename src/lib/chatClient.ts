import { apiUrl } from "@/config/api";

/**
 * The visitor's side of website chat. A conversation is started once (name, a way to reach them, a first
 * message) and the server hands back a secret that is kept in this browser only and sent as a header with every
 * later call. Nothing here talks to the CRM: the store holds the conversation and the CRM reads it from there.
 */

const STORAGE_KEY = "mpk_chat_v1";

export type ChatSession = { id: string; token: string };

export type ChatMessage = {
  id: number;
  sender: "VISITOR" | "STAFF";
  /** First name of the person who replied; absent on the visitor's own messages. */
  senderName?: string | null;
  body: string;
  createdAt: string;
};

export type ChatPoll = { messages: ChatMessage[]; status: "OPEN" | "CLOSED"; staffOnline: boolean };

export class ChatApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function loadSession(): ChatSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatSession>;
    return typeof parsed.id === "string" && typeof parsed.token === "string"
      ? { id: parsed.id, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

/** Tells the "Chat" pill (and anything else listening) that a chat was started or forgotten. */
const CHANGED_EVENT = "mpk-chat-changed";
export function onSessionChanged(listener: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

export function saveSession(session: ChatSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: the chat still works until the page is closed.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SEEN_KEY);
  } catch {
    // nothing to clear
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

const SEEN_KEY = "mpk_chat_seen_v1";

/** The last message the visitor has had on screen; replies after it count as unread. */
export function loadSeen(): number {
  try {
    const n = Number(window.localStorage.getItem(SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveSeen(messageId: number): void {
  try {
    if (messageId > loadSeen()) window.localStorage.setItem(SEEN_KEY, String(messageId));
  } catch {
    // unread counts just stay as they were
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A reply email or notification links back here as `/?chat=<id>#r=<secret>`. Takes the chat from the address (the secret
 * is in the #fragment, which the browser never sends to any server), keeps it as this device's chat, and cleans the
 * address bar so the secret is not left on screen or in history. Returns null when the address carries no chat link.
 */
export function takeResumeFromUrl(): ChatSession | null {
  try {
    const id = new URLSearchParams(window.location.search).get("chat");
    const secret = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("r");
    if (!id || !secret || !UUID.test(id) || secret.length < 20 || secret.length > 100) return null;
    const session = { id, token: secret };
    window.localStorage.removeItem(SEEN_KEY);
    saveSession(session);
    const params = new URLSearchParams(window.location.search);
    params.delete("chat");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    return session;
  } catch {
    return null;
  }
}

/** Adds new messages to the ones already shown: no duplicates, oldest first. */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<number, ChatMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** What to tell the visitor for each way a call can fail; never a raw server message. */
export function chatErrorText(err: unknown): string {
  const status = err instanceof ChatApiError ? err.status : 0;
  if (status === 428) return "Please complete the security check and try again.";
  if (status === 429) return "That was a bit fast. Please wait a moment and try again.";
  if (status === 409) return "This chat has ended. Please start a new one.";
  if (status === 400 && err instanceof ChatApiError && err.message) return err.message;
  if (status === 400 || status === 422) return "Please check what you typed and try again.";
  return "We could not reach our team just now. Please try again, or message us on WhatsApp.";
}

async function call<T>(path: string, init: RequestInit = {}, session?: ChatSession): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers["X-Chat-Token"] = session.token;
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new ChatApiError(0, "network");
  }
  if (!res.ok) {
    let message = "";
    try {
      const body = (await res.json()) as { message?: string };
      message = typeof body.message === "string" ? body.message : "";
    } catch {
      // not JSON
    }
    throw new ChatApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchAvailability(): Promise<boolean> {
  try {
    const data = await call<{ online: boolean }>("/api/v1/public/chat/availability");
    return data.online === true;
  } catch {
    return false;
  }
}

export type StartChatInput = {
  name: string;
  email: string;
  phone: string;
  message: string;
  pageUrl: string;
  consentPolicyVersion: string;
  honeypot: string;
  formRenderedAt: number;
  turnstileToken: string;
};

export async function startChat(
  input: StartChatInput,
): Promise<{ session: ChatSession; first: ChatMessage; staffOnline: boolean }> {
  const data = await call<{
    conversationId: string;
    token: string;
    firstMessage: ChatMessage;
    staffOnline: boolean;
  }>("/api/v1/public/chat/conversations", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim() || undefined,
      phone: input.phone.trim() || undefined,
      message: input.message.trim(),
      pageUrl: input.pageUrl,
      consentPolicyVersion: input.consentPolicyVersion,
      honeypot: input.honeypot,
      formRenderedAt: input.formRenderedAt,
      turnstileToken: input.turnstileToken,
    }),
  });
  return {
    session: { id: data.conversationId, token: data.token },
    first: data.firstMessage,
    staffOnline: data.staffOnline,
  };
}

export function postMessage(session: ChatSession, body: string): Promise<ChatMessage> {
  return call<ChatMessage>(
    `/api/v1/public/chat/conversations/${session.id}/messages`,
    { method: "POST", body: JSON.stringify({ body: body.trim() }) },
    session,
  );
}

export function pollMessages(session: ChatSession, after: number): Promise<ChatPoll> {
  return call<ChatPoll>(
    `/api/v1/public/chat/conversations/${session.id}/messages?after=${after}`,
    {},
    session,
  );
}

export type PushKeys = { endpoint: string; p256dh: string; auth: string };

/** "Tell me when they reply": ties this browser's notification subscription to the chat. */
export async function subscribeChatPush(session: ChatSession, keys: PushKeys): Promise<void> {
  await call<void>(`/api/v1/public/chat/conversations/${session.id}/push`, { method: "POST", body: JSON.stringify(keys) }, session);
}

/** How many replies from the team the visitor has not seen yet, and whether the chat is still open. */
export async function checkUnread(session: ChatSession): Promise<{ unread: number; status: "OPEN" | "CLOSED" }> {
  const poll = await pollMessages(session, loadSeen());
  return { unread: poll.messages.filter((m) => m.sender === "STAFF").length, status: poll.status };
}

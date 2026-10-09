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

export function saveSession(session: ChatSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: the chat still works until the page is closed.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
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

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

import { useEnquiry } from "@/contexts/EnquiryContext";
import { ChatApiError, checkUnread, clearSession, loadSession, onSessionChanged } from "@/lib/chatClient";

const CHECK_EVERY_MS = 45_000;

/**
 * A small "Chat" button on every page for a visitor who has a chat going, with the number of replies they have not
 * read. It is how someone who left the chat window finds their way back: the reply is waiting here, on any page of the
 * site. Renders nothing for everyone else, and costs nothing until a chat has been started (one storage read).
 */
export function ChatPill() {
  const { isChatOpen, openChat } = useEnquiry();
  const [session, setSession] = useState(() => loadSession());
  const [unread, setUnread] = useState(0);

  useEffect(() => onSessionChanged(() => setSession(loadSession())), []);

  useEffect(() => {
    if (!session || isChatOpen) return;
    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState === "hidden" || !session) return;
      try {
        const result = await checkUnread(session);
        if (stopped) return;
        if (result.status === "CLOSED") {
          // The team ended the chat: forget it so the pill does not linger on a conversation nobody can reply to.
          clearSession();
          return;
        }
        setUnread(result.unread);
      } catch (err) {
        if (err instanceof ChatApiError && err.status === 404) clearSession();
        // anything else (offline, a busy moment) is tried again at the next check
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, isChatOpen]);

  if (!session || isChatOpen) return null;
  return (
    <button
      type="button"
      onClick={() => openChat()}
      aria-label={unread > 0 ? `Open your chat, ${unread} new ${unread === 1 ? "reply" : "replies"}` : "Open your chat"}
      className="fixed bottom-4 right-4 z-40 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      Chat
      {unread > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-xs font-semibold leading-5 text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

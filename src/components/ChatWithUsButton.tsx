import { MessageSquare } from "lucide-react";

import { useEnquiry } from "@/contexts/EnquiryContext";

/** The permanent "Chat with us" option, shown beside the enquiry form. WhatsApp stays its own, separate button. */
export function ChatWithUsButton({ className = "" }: { className?: string }) {
  const { openChat } = useEnquiry();
  return (
    <button
      type="button"
      onClick={openChat}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary ${className}`}
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      Chat with us
    </button>
  );
}

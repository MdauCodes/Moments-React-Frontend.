import { MessageSquare } from "lucide-react";

import { useEnquiry, type ChatPrefill } from "@/contexts/EnquiryContext";

/**
 * The "Chat with us" option, shown beside the enquiry form. WhatsApp stays its own, separate button.
 * `prefill` carries what the visitor already typed into the enquiry form, so it lands in the chat as a
 * readable message instead of having to be typed again.
 */
export function ChatWithUsButton({
  className = "",
  primary = false,
  prefill,
  label = "Chat with us",
}: {
  className?: string;
  primary?: boolean;
  prefill?: ChatPrefill;
  label?: string;
}) {
  const { openChat } = useEnquiry();
  const look = primary
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border bg-background text-foreground hover:bg-secondary";
  return (
    <button
      type="button"
      onClick={() => openChat(prefill)}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${look} ${className}`}
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

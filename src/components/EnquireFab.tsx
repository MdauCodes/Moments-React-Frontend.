import { MessageSquareText } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useEnquiry } from "@/contexts/EnquiryContext";

/** Pages where a floating button would cover something the visitor is in the middle of doing. */
const HIDDEN_ON = ["/checkout"];

/**
 * The one place a visitor who "just has a question" can always reach, on every public page. Sits
 * bottom-right, above SignUpFab (which only guests see), so the two never overlap: guests get the
 * higher slot, signed-in visitors take SignUpFab's place.
 */
export function EnquireFab({ withSignUpFab = true }: { withSignUpFab?: boolean } = {}) {
  const { openEnquiry, isOpen } = useEnquiry();
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();

  if (isOpen || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const position = isAuthenticated || !withSignUpFab
    ? "bottom-20 right-4 sm:bottom-6 sm:right-6"
    : "bottom-36 right-4 sm:bottom-24 sm:right-6";

  return (
    <button
      type="button"
      onClick={() => openEnquiry()}
      aria-label="Ask us a question or send an enquiry"
      className={`fixed ${position} z-50 flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/20 transition-all hover:scale-105 hover:shadow-xl sm:px-5 sm:py-3.5`}
    >
      <MessageSquareText className="h-5 w-5" aria-hidden="true" />
      <span>Enquire</span>
    </button>
  );
}

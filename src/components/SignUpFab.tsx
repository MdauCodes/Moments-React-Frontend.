import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

/**
 * Persistent bottom-right nudge for guests only — pulled out of RewardDeliveryBanners (see its
 * own comment) so that bar can stay a single, short, gap-first line for every visitor instead of
 * squeezing "shop more" and "sign up" into one message. Takes over AccessibilityToolbar's old
 * corner; AccessibilityToolbar itself moved to bottom-left to make room (see its own file).
 *
 * Same position/sizing language as WhatsAppFloat (also bottom-left) so the two read as a matched
 * pair of pill FABs rather than two different UI languages competing for attention.
 */
export function SignUpFab() {
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();

  if (isAuthenticated) return null;

  return (
    <button
      type="button"
      onClick={() => openLogin({})}
      aria-label="Sign up or log in"
      className="fixed bottom-20 right-4 z-50 flex min-h-[48px] items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-black/20 transition-all hover:scale-105 hover:shadow-xl sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5"
    >
      <UserPlus className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Sign up</span>
    </button>
  );
}

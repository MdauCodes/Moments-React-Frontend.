import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useRevealAfterActiveMs } from "@/hooks/useEngagementClock";
import { SIGNUP_FAB_REVEAL_MS } from "@/lib/engagementSignals";

/**
 * Persistent bottom-right nudge for guests only — pulled out of RewardDeliveryBanners (see its
 * own comment) so that bar can stay a single, short, gap-first line for every visitor instead of
 * squeezing "shop more" and "sign up" into one message. Takes over AccessibilityToolbar's old
 * corner; AccessibilityToolbar itself moved to bottom-left to make room (see its own file).
 *
 * Same position/sizing language as WhatsAppFloat (also bottom-left) so the two read as a matched
 * pair of pill FABs rather than two different UI languages competing for attention.
 *
 * Held back for the first stretch of a visit. It is not blocking, but it *is* a "sign up" ask
 * sitting over the corner of the very first screen a stranger sees, next to the WhatsApp pill
 * and above the tab bar — three floating things at once, before they have seen a product. It
 * fades in once the visitor has actually spent some time here (shared clock, same one the
 * engagement gate reads), and once in, it stays.
 */
export function SignUpFab() {
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const revealed = useRevealAfterActiveMs(SIGNUP_FAB_REVEAL_MS);

  if (isAuthenticated || !revealed) return null;

  return (
    <button
      type="button"
      onClick={() => openLogin({})}
      aria-label="Sign up or log in"
      className="fixed bottom-20 right-4 z-50 flex min-h-[48px] animate-in fade-in duration-500 motion-reduce:animate-none items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-black/20 transition-all hover:scale-105 hover:shadow-xl sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5"
    >
      <UserPlus className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">Sign up</span>
    </button>
  );
}

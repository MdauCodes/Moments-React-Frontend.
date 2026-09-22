import { useEffect, useRef } from "react";
import { X, Gift, ArrowRight } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { markPostOrderPromptShown } from "./promptEligibility";

/**
 * The post-order moment: a guest who has just paid is the single most persuadable audience the
 * site has, and right now they walk away with nothing tying them back.
 *
 * ── What this deliberately does NOT say ──────────────────────────────────────────────────────
 * It does not tell the customer that the order they just placed earned them coupons they can
 * claim by signing up. That is not true today, and it was checked rather than assumed:
 *
 *   • PaymentService.applySuccessfulPayment awards order points inside `if (order.getCustomer()
 *     != null)`. A guest checkout builds the order with `.customer(null)` (CheckoutService), so
 *     awardOrderPoints is never reached and no EARNED_ORDER credit is ever written.
 *   • PendingPointsReward — the only "pending until later" rewards row that exists — has a
 *     non-null user_id and is created solely by BirthdayRewardJob for existing account holders.
 *   • Registration (CustomerAuthService.register) awards the welcome bonus and merges the guest
 *     *cart*. Nothing anywhere links past guest orders to a new account by email or phone, and
 *     nothing back-awards points for them.
 *
 * So a guest order earns zero coupons and there is nothing to claim. Promising otherwise to
 * someone who has just handed over money is the kind of copy that costs a business its customer.
 *
 * ── What it says instead, all of it verified ─────────────────────────────────────────────────
 *   • 1,000 Reward Coupons on signup — ReferralSettingsSeeder forces rewards.welcome.points to
 *     "1000", awarded by ReferralService.awardWelcomeBonus at registration.
 *   • Coupons earned on orders — ReferralService.awardOrderPoints, rewards.points.per.100kes = 1.
 *   • Redeemable at checkout — CheckoutService gates calculateRedemptionDiscount/commitRedemption
 *     on a non-null customer, which is exactly the point being made.
 *
 * Wording matches what the rest of the site already says ("1,000 Reward Coupons on signup",
 * "Reward Coupons on every order") rather than inventing a new formulation.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────────────────────
 * Bottom-anchored and horizontally centred at every breakpoint: full-width sheet on a phone,
 * a compact card from sm up. Never a centered modal — the order reference and the delivery/
 * pickup details are the reason the customer is on this page, and nothing optional gets to cover
 * them. Centring also keeps it clear of WhatsAppFloat (bottom-left) and SignUpFab (bottom-right).
 */
export function PostOrderAccountPrompt({ onClose }: { onClose: () => void }) {
  const { openRegister } = useAuthModal();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);

  const dismiss = () => {
    markPostOrderPromptShown();
    onClose();
  };

  useEffect(() => {
    restoreFocusToRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("button[data-dismiss]")?.focus({ preventScroll: true });
    return () => restoreFocusToRef.current?.focus?.({ preventScroll: true });
  }, []);

  // Escape closes. No focus trap and no aria-modal, on purpose: this is not modal. The page
  // behind it is the customer's order confirmation and it must stay readable and reachable —
  // trapping focus here would make the receipt download and tracking link unreachable.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-labelledby="post-order-prompt-title"
      aria-describedby="post-order-prompt-desc"
      data-mpk-overlay="post-order-account"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-0 sm:px-4 sm:pb-6"
      style={{ paddingBottom: "var(--bottom-nav-height, 0px)" }}
    >
      <div
        ref={panelRef}
        className="pointer-events-auto w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none rounded-t-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:rounded-2xl sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Gift className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="post-order-prompt-title" className="text-sm font-semibold leading-snug text-foreground">
              Order placed. Make the next one earn.
            </h2>
            <p id="post-order-prompt-desc" className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Open a free account and start with{" "}
              <span className="font-medium text-foreground">1,000 Reward Coupons</span>. After that you earn
              Reward Coupons on every order and redeem them for a discount at checkout.
            </p>
          </div>
          <button
            type="button"
            data-dismiss
            onClick={dismiss}
            aria-label="Dismiss"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            markPostOrderPromptShown();
            onClose();
            openRegister({});
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Create a free account <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

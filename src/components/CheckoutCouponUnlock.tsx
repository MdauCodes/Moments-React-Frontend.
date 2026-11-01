import { useEffect, useRef, useState } from "react";
import { Gift } from "lucide-react";
import { apiUrl } from "@/config/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SoftNote } from "@/components/SoftNote";

export interface UnlockedCoupons {
  token: string;
  email: string;
  firstName: string;
  pointsBalance: number;
  pointsValueKes: number;
  maxRedeemPercent: number;
  codes: {
    code: string;
    type: "PERCENT" | "FIXED";
    value: number;
    minOrderAmount: number;
    expiresAt?: string | null;
  }[];
}

interface Offers {
  available: boolean;
  codes: number;
  points: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 45;

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T & { message?: string } }> {
  const res = await fetch(apiUrl(`/api/v1/public/checkout-coupons${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {} as T & { message?: string };
  try {
    data = await res.json();
  } catch {
    /* empty body (204) */
  }
  return { ok: res.ok, data };
}

/** For shoppers who aren't logged in: notices when the email they typed has coupons or points
 *  waiting, and lets them unlock those with a code emailed to that address. */
export function CheckoutCouponUnlock({
  email,
  onUnlocked,
}: {
  email: string;
  onUnlocked: (data: UnlockedCoupons) => void;
}) {
  const cleaned = email.trim().toLowerCase();
  const [offers, setOffers] = useState<Offers | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const lastChecked = useRef("");

  useEffect(() => {
    if (!EMAIL_RE.test(cleaned) || cleaned === lastChecked.current) return;
    const t = setTimeout(async () => {
      lastChecked.current = cleaned;
      try {
        const { ok, data } = await post<Offers>("/offers", { email: cleaned });
        setOffers(ok ? (data as Offers) : null);
      } catch {
        setOffers(null);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [cleaned]);

  useEffect(() => {
    if (!EMAIL_RE.test(cleaned)) setOffers(null);
  }, [cleaned]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setNote(null);
    try {
      const { ok, data } = await post("/send-code", { email: cleaned });
      if (!ok) setNote(data.message ?? "We couldn't send the code just now. Please try again in a moment.");
      else setCooldown(RESEND_SECONDS);
    } catch {
      setNote("We couldn't send the code just now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function openDialog() {
    setCode("");
    setNote(null);
    setOpen(true);
    void sendCode();
  }

  async function verify() {
    if (code.trim().length < 4) return;
    setBusy(true);
    setNote(null);
    try {
      const { ok, data } = await post<Omit<UnlockedCoupons, "email">>("/verify", { email: cleaned, code: code.trim() });
      if (!ok) {
        setNote(data.message ?? "That code didn't work. Please try again.");
        return;
      }
      setOpen(false);
      onUnlocked({ ...(data as Omit<UnlockedCoupons, "email">), email: cleaned });
    } catch {
      setNote("We couldn't check that code just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!offers?.available) return null;

  const what = [
    offers.codes > 0 ? `${offers.codes} coupon${offers.codes === 1 ? "" : "s"}` : null,
    offers.points ? "reward points" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Gift className="h-4 w-4 flex-shrink-0 text-accent" />
          <span>You have {what} waiting on this email.</span>
        </p>
        <button
          type="button"
          onClick={openDialog}
          className="flex-shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Use my rewards
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm it's your email</DialogTitle>
            <DialogDescription>
              We've sent a 6-digit code to <span className="font-semibold">{cleaned}</span>. Enter it below to use your
              rewards on this order. You can stay on this page.
            </DialogDescription>
          </DialogHeader>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void verify();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {note && <SoftNote message={note} onDismiss={() => setNote(null)} />}
          <button
            type="button"
            disabled={busy || code.length < 6}
            onClick={() => void verify()}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode()}
            className="text-center text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adminJson } from "@/services/adminApi";
import { TumaBodaStrategyGuideContent, WALLET_UPDATED_EVENT } from "@/components/admin/TumaBodaStrategyNotice";
import { useAuth } from "@/contexts/AdminAuthContext";
import { formatKes } from "@/components/admin/commerceUi";
import { tumaBodaSettlementApi } from "@/services/tumaBodaSettlementService";

const NOTICE_KEY = "tumaboda-payment-strategy-2026-11";
/** Countdown length once someone has had time to read. */
const WAIT_MS = 10_000;
/** "Read later" brings the guide back after this long. */
const LATER_MS = 4 * 60 * 60 * 1000;
/** A brisk reading pace (about 300 words a minute), used to judge whether someone skimmed. */
const MS_PER_WORD = 200;
const MIN_READ_MS = 20_000;
const MAX_READ_MS = 75_000;
/** Before that reading time has passed, each countdown second takes this many real seconds. */
const SKIM_SLOWDOWN = 3;
const TICK_MS = 250;

// Every admin page mounts its own layout, so remember the answer for the rest of the visit.
const understoodThisVisit = new Set<string>();

function laterKey(userId: string) {
  return `mpk.notice.${NOTICE_KEY}.later.${userId}`;
}

function snoozed(userId: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(laterKey(userId)));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/**
 * The TumaBoda payment-strategy guide, shown over any admin page until the person has understood
 * it. Its buttons unlock after a 10-second countdown that only runs while the reader is at the end
 * of the guide. Someone who reaches the end faster than they could have read it gets a countdown
 * three times slower, until they have had the guide open long enough to read it.
 * "Understood" is saved on the server, so it holds on every device. "Read later" hides it on this
 * browser for a few hours. Admins also get "Record top-up", which records the wallet payment in
 * the same step and counts as understood.
 */
export function TumaBodaStrategyGuide({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [openMs, setOpenMs] = useState(0);
  const [readMs, setReadMs] = useState(MAX_READ_MS);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAuth();
  const [step, setStep] = useState<"read" | "topup">("read");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [note, setNote] = useState("Opening balance");

  useEffect(() => {
    if (understoodThisVisit.has(userId) || snoozed(userId)) return;
    let cancelled = false;
    adminJson<{ acknowledged: boolean }>(`/api/v1/admin/notices/${NOTICE_KEY}`)
      .then((r) => {
        if (cancelled) return;
        if (r.acknowledged) understoodThisVisit.add(userId);
        else setOpen(true);
      })
      // If the check fails, don't block someone's work over an announcement.
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);

  // Not "has ever reached the end": scrolling back up pauses the countdown.
  const checkEnd = useCallback(() => {
    const el = bodyRef.current;
    if (el) setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      checkEnd();
      const words = (bodyRef.current?.innerText ?? "").split(/\s+/).filter(Boolean).length;
      setReadMs(Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, words * MS_PER_WORD)));
    }, 300);
    window.addEventListener("resize", checkEnd);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", checkEnd); };
  }, [open, checkEnd]);

  const ready = progressMs >= WAIT_MS;
  const skimmed = openMs < readMs;

  useEffect(() => {
    if (!open || ready) return;
    const t = window.setInterval(() => {
      // Time in a background tab doesn't count as reading.
      if (document.visibilityState !== "visible") return;
      setOpenMs((ms) => ms + TICK_MS);
      if (atEnd) setProgressMs((p) => p + (skimmed ? TICK_MS / SKIM_SLOWDOWN : TICK_MS));
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [open, ready, atEnd, skimmed]);

  if (!open) return null;

  const secondsLeft = Math.max(1, Math.ceil((WAIT_MS - progressMs) / 1000));
  const plural = secondsLeft === 1 ? "" : "s";
  let hint: string;
  if (ready) hint = "Thanks for reading.";
  else if (!atEnd && progressMs === 0) hint = "Scroll to the end to continue.";
  else if (!atEnd) hint = `Paused at ${secondsLeft} second${plural}. Scroll back to the end to carry on.`;
  else if (skimmed)
    hint = `${secondsLeft} second${plural} to go, counting slowly because you reached the end quickly. Take time to read the guide and it will speed up.`;
  else hint = `The buttons work in ${secondsLeft} second${plural}.`;

  const acknowledge = async () => {
    await adminJson(`/api/v1/admin/notices/${NOTICE_KEY}/acknowledge`, { method: "POST" });
    understoodThisVisit.add(userId);
    try { window.localStorage.removeItem(laterKey(userId)); } catch { /* storage unavailable */ }
    setOpen(false);
  };

  const understood = async () => {
    setSaving(true);
    try {
      await acknowledge();
    } catch {
      toast.error("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const topUpAmount = Number(amount);
  const topUpValid = Number.isFinite(topUpAmount) && topUpAmount > 0 && code.trim().length >= 3;

  const recordTopUp = async () => {
    if (!topUpValid || saving) return;
    setSaving(true);
    try {
      await tumaBodaSettlementApi.recordPayment({
        ledger: "WALLET",
        amount: topUpAmount,
        reference: code.trim(),
        method,
        notes: note.trim() || undefined,
      });
      window.dispatchEvent(new Event(WALLET_UPDATED_EVENT));
      toast.success(`Top-up of ${formatKes(topUpAmount)} recorded. Customers can choose TumaBoda while the balance covers the fee.`);
    } catch {
      toast.error("Couldn't record the top-up. Nothing was saved, so you can try again.");
      setSaving(false);
      return;
    }
    // The money is recorded. Marking the guide as read is secondary: if that fails, it just shows again.
    try {
      await acknowledge();
    } catch {
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const later = () => {
    try { window.localStorage.setItem(laterKey(userId), String(Date.now() + LATER_MS)); } catch { /* storage unavailable */ }
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tumaboda-guide-title"
        style={{
          background: "var(--admin-bg)",
          border: "1px solid var(--admin-border)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 640,
          maxHeight: "min(88vh, 760px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 20px", fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
          Please read: change to TumaBoda deliveries
        </div>
        <div ref={bodyRef} onScroll={checkEnd} style={{ padding: 20, overflowY: "auto", flex: 1, display: step === "read" ? undefined : "none" }}>
          <TumaBodaStrategyGuideContent titleId="tumaboda-guide-title" />
        </div>
        {step === "topup" && (
          <form
            id="tumaboda-guide-topup"
            onSubmit={(e) => { e.preventDefault(); void recordTopUp(); }}
            style={{ padding: 20, overflowY: "auto", flex: 1, display: "grid", gap: 12, alignContent: "start" }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Record a wallet top-up</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--admin-muted)" }}>
              Enter money already paid to TumaBoda. This records it in Moments; it doesn't move any money.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span className="admin-label">Amount paid (KES)</span>
              <input className="admin-input" type="number" min="1" step="0.01" inputMode="decimal" required autoFocus
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span className="admin-label">M-Pesa code or bank reference</span>
              <input className="admin-input" required minLength={3} maxLength={100} placeholder="e.g. SKD4XXXXXX"
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span className="admin-label">Paid by</span>
              <select className="admin-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="mpesa">M-Pesa</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span className="admin-label">Note</span>
              <input className="admin-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </form>
        )}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--admin-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {step === "topup" ? (
            <>
              <button type="button" className="admin-btn admin-btn-ghost" disabled={saving} onClick={() => setStep("read")}>
                Back to the guide
              </button>
              <button type="submit" form="tumaboda-guide-topup" className="admin-btn admin-btn-primary"
                disabled={saving || !topUpValid} style={{ marginLeft: "auto" }}>
                {saving ? "Saving…" : `Record ${topUpValid ? formatKes(topUpAmount) : "top-up"}`}
              </button>
            </>
          ) : (
          <>
          <span
            aria-live="polite"
            data-skimmed={!ready && atEnd && skimmed ? "true" : undefined}
            style={{ fontSize: 12, flex: "1 1 220px", color: !ready && atEnd && skimmed ? "var(--admin-clay)" : "var(--admin-muted)" }}
          >
            {hint}
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button type="button" className="admin-btn admin-btn-ghost" disabled={!ready || saving} onClick={later}>
              Read later
            </button>
            {isAdmin && (
              <button type="button" className="admin-btn admin-btn-ghost" disabled={!ready || saving} onClick={() => setStep("topup")}>
                Record top-up
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-primary" disabled={!ready || saving} onClick={() => void understood()}>
              {saving ? "Saving…" : "Understood"}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

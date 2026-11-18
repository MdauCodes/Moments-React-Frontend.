// Paying a PO (owner, 17 Nov; doc 15 §23): once the heads' signed copy is uploaded the PO is fully
// approved, and a PO not on credit is paid; only then does it reach Moments. Any balance Moments
// holds for the restaurant is used first (amountDue is what is left). M-Pesa: a prompt to the
// restaurant's number by default, or any other phone. Bank: the restaurant says the transfer is sent
// and Moments confirms it. The same box tops up when Moments raised the total of a changed PO.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Landmark, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { ErrorText, Field, Muted, PortalButton, portalColors as c } from "./portalUi";
import { restaurantApi, type PoDetail } from "@/services/restaurantApi";
import { kes } from "@/lib/restaurantPortal";

const POLL_MS = 4000;
const POLL_FOR_MS = 120_000;

type Method = "MPESA" | "BANK";
type State = "idle" | "sending" | "waiting" | "paid" | "failed" | "unconfirmed" | "bank-sent";

export function PoPayNow({
  po,
  mode,
  defaultPhone,
  onChanged,
}: {
  po: PoDetail;
  /** "pay": the order after approval; "topup": what is left after Moments raised the total. */
  mode: "pay" | "topup";
  defaultPhone: string;
  onChanged: () => void;
}) {
  const money = po.money;
  const due =
    mode === "topup" ? money?.topUpDue || money?.amountDue || 0 : (money?.amountDue ?? po.total);
  const [method, setMethod] = useState<Method>(
    po.paymentMethod === "BANK_TRANSFER" ? "BANK" : "MPESA",
  );
  const [phone, setPhone] = useState(money?.defaultPayerPhone || defaultPhone);
  const [reference, setReference] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  /** Asks the store until the prompt is paid or fails: the order's payment, or the top-up's status. */
  function poll(started: number, topUpId?: string) {
    timer.current = window.setTimeout(async () => {
      try {
        if (topUpId) {
          const d = await restaurantApi.purchaseOrder(po.orderId);
          const t = d.topUps?.find((x) => x.id === topUpId);
          if (t?.status === "CONFIRMED") return done(t.reference ?? null);
          if (t && (t.status === "FAILED" || t.status === "REJECTED")) {
            return fail("The payment didn't go through.");
          }
        } else {
          const s = await restaurantApi.poPaymentStatus(po.orderId);
          const status = (s.status ?? "").toUpperCase();
          if (status === "SUCCESS") return done(s.receiptNumber ?? null);
          if (status === "FAILED") {
            return fail(s.failureReason || s.message || "The payment didn't go through.");
          }
        }
      } catch {
        /* keep asking until the time is up */
      }
      if (Date.now() - started > POLL_FOR_MS) {
        setState("unconfirmed");
        onChanged();
        return;
      }
      poll(started, topUpId);
    }, POLL_MS);
  }

  function done(r: string | null) {
    setReceipt(r);
    setState("paid");
    onChanged();
  }

  function fail(message: string) {
    setError(message);
    setState("failed");
  }

  async function sendMpesa() {
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter the M-Pesa phone number to send the prompt to.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      if (mode === "topup") {
        const t = await restaurantApi.topUp(po.orderId, { method: "MPESA", phone: phone.trim() });
        setState("waiting");
        poll(Date.now(), t.id);
      } else {
        await restaurantApi.payPoByMpesa(po.orderId, phone.trim());
        setState("waiting");
        poll(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the M-Pesa prompt.");
      setState("idle");
    }
  }

  async function bankSent() {
    setState("sending");
    setError(null);
    try {
      if (mode === "topup") {
        await restaurantApi.topUp(po.orderId, {
          method: "BANK",
          reference: reference.trim() || undefined,
        });
      } else {
        await restaurantApi.bankTransferSent(po.orderId, reference.trim() || undefined);
      }
      setState("bank-sent");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the transfer.");
      setState("idle");
    }
  }

  // The PO number is printed on the PO and is what Moments' payment instructions ask for.
  const quote = po.poNumber;
  const bank = money?.bankDetails ?? null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Account number copied");
    } catch {
      /* clipboard blocked: the number can still be selected */
    }
  }

  return (
    <section
      aria-labelledby="h-paynow"
      className="rounded-[14px] border-2 bg-white p-4"
      style={{ borderColor: c.gold }}
    >
      <h2 id="h-paynow" className="text-[18px] font-bold">
        {mode === "topup" ? "Top up" : "Pay for this order"} · {kes(due)}
      </h2>
      <Muted className="mt-1">
        {mode === "topup"
          ? "Moments changed this order and its total went up. Pay the difference and it goes on."
          : "Your heads have approved it. Once it is paid, it goes to Moments."}
      </Muted>
      {money && mode === "pay" && money.balanceApplied > 0 && (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[14px] tabular-nums">
          <dt style={{ color: c.muted }}>Order total</dt>
          <dd className="text-right">{kes(money.total)}</dd>
          <dt style={{ color: c.muted }}>Your balance with Moments, used</dt>
          <dd className="text-right">− {kes(money.balanceApplied)}</dd>
          <dt className="font-bold">To pay</dt>
          <dd className="text-right font-bold">{kes(due)}</dd>
        </dl>
      )}

      {state === "waiting" && (
        <Note tone="wait">
          <strong>Check the phone.</strong> Enter the M-Pesa PIN to pay {kes(due)}. This page
          updates by itself.
        </Note>
      )}
      {state === "paid" && (
        <Note tone="good">
          <strong>Paid.</strong>
          {receipt ? ` M-Pesa receipt ${receipt}.` : ""} The order goes on to Moments now.
        </Note>
      )}
      {state === "unconfirmed" && (
        <Note tone="wait">
          <strong>Not confirmed yet.</strong> If it was paid, it shows here once M-Pesa confirms it.
          If not, send a new prompt.
        </Note>
      )}
      {state === "bank-sent" && (
        <Note tone="good">
          <strong>Thank you.</strong> Moments confirms the transfer, then the order goes on. Its
          status here updates at each step.
        </Note>
      )}

      {(state === "idle" ||
        state === "sending" ||
        state === "failed" ||
        state === "unconfirmed") && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to pay">
            {(
              [
                ["MPESA", "M-Pesa", Smartphone],
                ["BANK", "Bank transfer", Landmark],
              ] as const
            ).map(([v, label, Icon]) => (
              <label
                key={v}
                className="flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-[15px] font-semibold"
                style={{
                  borderColor: method === v ? c.green : c.line,
                  background: method === v ? "#E4F0E8" : "#FFFFFF",
                }}
              >
                <input
                  type="radio"
                  name="paymethod"
                  className="h-5 w-5"
                  checked={method === v}
                  onChange={() => {
                    setMethod(v);
                    setError(null);
                  }}
                />
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>

          {method === "MPESA" ? (
            <>
              <Field
                label="Send the M-Pesa prompt to"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                hint={
                  money?.defaultPayerPhone
                    ? "Your restaurant's number. You can use another phone."
                    : undefined
                }
              />
              <ErrorText>{error}</ErrorText>
              <PortalButton
                onClick={() => void sendMpesa()}
                disabled={state === "sending"}
                className="min-h-[52px] text-[16px]"
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                {state === "sending"
                  ? "Sending…"
                  : state === "failed" || state === "unconfirmed"
                    ? `Pay again · ${kes(due)}`
                    : `Pay ${kes(due)} by M-Pesa`}
              </PortalButton>
            </>
          ) : (
            <>
              {bank?.accountNumber ? (
                <div
                  className="rounded-[10px] p-3 text-[14px]"
                  style={{ background: c.soft }}
                  aria-label="Moments' bank account"
                >
                  <div>
                    Transfer <strong>{kes(due)}</strong> to:
                  </div>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {bank.bank && (
                      <>
                        <dt style={{ color: c.muted }}>Bank</dt>
                        <dd className="break-words">{bank.bank}</dd>
                      </>
                    )}
                    {bank.accountName && (
                      <>
                        <dt style={{ color: c.muted }}>Account name</dt>
                        <dd className="break-words">{bank.accountName}</dd>
                      </>
                    )}
                    <dt style={{ color: c.muted }}>Account number</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <strong className="select-all break-all tabular-nums">
                        {bank.accountNumber}
                      </strong>
                      <button
                        type="button"
                        onClick={() => void copy(bank.accountNumber ?? "")}
                        className="inline-flex min-h-11 items-center rounded-[10px] px-2 text-[13px] font-semibold"
                        style={{ color: c.green }}
                      >
                        Copy
                      </button>
                    </dd>
                    {bank.branch && (
                      <>
                        <dt style={{ color: c.muted }}>Branch</dt>
                        <dd className="break-words">{bank.branch}</dd>
                      </>
                    )}
                    <dt style={{ color: c.muted }}>Reference</dt>
                    <dd className="break-all font-semibold">{quote}</dd>
                  </dl>
                  {bank.paymentInstructions && (
                    <p className="mt-2" style={{ color: c.muted }}>
                      {bank.paymentInstructions}
                    </p>
                  )}
                  <p className="mt-2">
                    Then tap "I've sent the transfer" below, so Moments looks out for it and moves
                    your order on once it arrives.
                  </p>
                </div>
              ) : (
                <Muted>
                  Transfer {kes(due)} to Moments Packaging's bank account (as on your invoice, or
                  ask your contact at Moments) and quote <strong>{quote}</strong>. Then tell us it's
                  sent, so Moments looks out for it.
                </Muted>
              )}
              <Field
                label="Your bank reference (optional)"
                value={reference}
                maxLength={100}
                onChange={(e) => setReference(e.target.value)}
              />
              <ErrorText>{error}</ErrorText>
              <PortalButton
                onClick={() => void bankSent()}
                disabled={state === "sending"}
                className="min-h-[52px] text-[16px]"
              >
                <Landmark className="h-4 w-4" aria-hidden="true" />
                {state === "sending" ? "Saving…" : "I've sent the transfer"}
              </PortalButton>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Note({ tone, children }: { tone: "good" | "wait"; children: ReactNode }) {
  return (
    <p
      role="status"
      className="mt-3 rounded-[10px] p-3 text-[14px]"
      style={
        tone === "good"
          ? { background: "#E4F0E8", color: "#1F5A3B" }
          : { background: "#FFF4D6", color: "#5A3E00" }
      }
    >
      {children}
    </p>
  );
}

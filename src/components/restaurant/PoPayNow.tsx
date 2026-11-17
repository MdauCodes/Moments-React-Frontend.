// Paying a pay-now PO (owner's open question, built as the store proposed in doc 15 §21.1): once
// Moments has accepted the signed copy, an M-Pesa or bank PO shows Pay now. The store sends the
// M-Pesa prompt; the page asks the store every few seconds until it is paid or fails. Moments
// prepares the order after payment.
import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";

import { ErrorText, Field, Muted, PortalButton } from "./portalUi";
import { restaurantApi, type PoDetail } from "@/services/restaurantApi";
import { kes } from "@/lib/restaurantPortal";

const POLL_MS = 4000;
const POLL_FOR_MS = 120_000;

type State = "idle" | "sending" | "waiting" | "paid" | "failed" | "unconfirmed";

export function PoPayNow({
  po,
  defaultPhone,
  onPaid,
}: {
  po: PoDetail;
  defaultPhone: string;
  onPaid: () => void;
}) {
  const [phone, setPhone] = useState(defaultPhone);
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

  function poll(started: number) {
    timer.current = window.setTimeout(async () => {
      try {
        const s = await restaurantApi.poPaymentStatus(po.orderId);
        const status = (s.status ?? "").toUpperCase();
        if (status === "SUCCESS") {
          setReceipt(s.receiptNumber ?? null);
          setState("paid");
          onPaid();
          return;
        }
        if (status === "FAILED") {
          setError(s.failureReason || s.message || "The payment didn't go through.");
          setState("failed");
          return;
        }
      } catch {
        /* keep asking until the time is up */
      }
      if (Date.now() - started > POLL_FOR_MS) {
        setState("unconfirmed");
        return;
      }
      poll(started);
    }, POLL_MS);
  }

  async function send() {
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter the M-Pesa phone number to send the prompt to.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      await restaurantApi.payPoByMpesa(po.orderId, phone.trim());
      setState("waiting");
      poll(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the M-Pesa prompt.");
      setState("idle");
    }
  }

  return (
    <section
      aria-labelledby="h-paynow"
      className="rounded-[14px] border-2 bg-white p-4"
      style={{ borderColor: "#F2C14E" }}
    >
      <h2 id="h-paynow" className="text-[18px] font-bold">
        Pay now · {kes(po.total)}
      </h2>
      <Muted className="mt-1">
        Moments has accepted your signed copy. Pay for {po.poNumber}
        {po.orderReference ? ` (order ${po.orderReference})` : ""} and Moments prepares it.
      </Muted>

      {state === "waiting" && (
        <p
          role="status"
          className="mt-3 rounded-[10px] p-3 text-[14px]"
          style={{ background: "#FFF4D6", color: "#5A3E00" }}
        >
          <strong>Check your phone.</strong> Enter your M-Pesa PIN to pay {kes(po.total)}. This page
          updates by itself.
        </p>
      )}
      {state === "paid" && (
        <p
          role="status"
          className="mt-3 rounded-[10px] p-3 text-[14px]"
          style={{ background: "#E4F0E8", color: "#1F5A3B" }}
        >
          <strong>Paid.</strong>
          {receipt ? ` M-Pesa receipt ${receipt}.` : ""} Moments now prepares your order.
        </p>
      )}
      {state === "unconfirmed" && (
        <p
          role="status"
          className="mt-3 rounded-[10px] p-3 text-[14px]"
          style={{ background: "#FFF4D6", color: "#5A3E00" }}
        >
          <strong>Not confirmed yet.</strong> If you paid, it shows here once M-Pesa confirms it. If
          you didn't, send a new prompt.
        </p>
      )}

      {(state === "idle" ||
        state === "sending" ||
        state === "failed" ||
        state === "unconfirmed") && (
        <div className="mt-3 flex flex-col gap-2.5">
          <Field
            label="M-Pesa phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <PortalButton
            onClick={() => void send()}
            disabled={state === "sending"}
            className="min-h-[52px] text-[16px]"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            {state === "sending" ? "Sending…" : `Pay ${kes(po.total)} by M-Pesa`}
          </PortalButton>
          {po.paymentMethod === "BANK_TRANSFER" && (
            <Muted className="text-[12.5px]">
              Paying by bank transfer instead? Pay as agreed with Moments and quote{" "}
              {po.orderReference ?? po.poNumber}; Moments confirms it and prepares the order.
            </Muted>
          )}
        </div>
      )}
    </section>
  );
}

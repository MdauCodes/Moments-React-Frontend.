// Pay what the restaurant owes on credit by M-Pesa (doc 15 §19.4, §19.7): the store sends a prompt
// to the phone, for everything owed unless a smaller amount is entered, rounded up to whole
// shillings. The portal then asks the store every few seconds until the payment leaves PENDING;
// if Safaricom never confirms, it stays with Moments to confirm by hand.
import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";

import { ErrorText, Field, Muted, PortalButton } from "./portalUi";
import { restaurantApi, type PromptStatus } from "@/services/restaurantApi";
import { kes, payProblem, promptAmount } from "@/lib/restaurantPortal";

const POLL_MS = 4000;
const POLL_FOR_MS = 120_000;

export function PayByMpesa({
  owed,
  defaultPhone,
  onDone,
}: {
  owed: number;
  defaultPhone: string;
  onDone: () => void;
}) {
  const full = promptAmount(owed);
  const [amount, setAmount] = useState(String(full));
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptStatus | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => setAmount(String(full)), [full]);

  useEffect(() => {
    if (!prompt || prompt.status !== "PENDING") return;
    const started = Date.now();
    const tick = async () => {
      try {
        const next = await restaurantApi.creditPayment(prompt.id);
        if (next.status !== "PENDING") {
          setPrompt(next);
          onDone();
          return;
        }
      } catch {
        /* keep trying until the time is up */
      }
      if (Date.now() - started > POLL_FOR_MS) {
        setGaveUp(true);
        onDone();
        return;
      }
      timer.current = window.setTimeout(() => void tick(), POLL_MS);
    };
    timer.current = window.setTimeout(() => void tick(), POLL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // onDone is a reload callback from the page; polling follows the prompt only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.id, prompt?.status]);

  async function send() {
    const n = Number(amount);
    const problem = payProblem(n, owed, phone);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    setGaveUp(false);
    try {
      setPrompt(
        await restaurantApi.payCredit({
          amount: promptAmount(n) === full ? undefined : promptAmount(n),
          phone: phone.trim(),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the M-Pesa prompt.");
    } finally {
      setBusy(false);
    }
  }

  if (prompt) {
    const pending = prompt.status === "PENDING";
    const ok = prompt.status === "CONFIRMED";
    return (
      <div
        role="status"
        className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
        style={{
          background: ok ? "#E4F0E8" : pending ? "#FFF4D6" : "#FBE7E3",
          color: ok ? "#1F5A3B" : pending ? "#5A3E00" : "#8A2A1C",
        }}
      >
        {pending && !gaveUp && (
          <>
            <strong>Check your phone.</strong> Enter your M-Pesa PIN to pay {kes(prompt.amount)}.
            This page updates by itself.
          </>
        )}
        {pending && gaveUp && (
          <>
            <strong>Not confirmed yet.</strong> If you paid, Moments confirms it and it shows below
            as received. If you didn't, you can send a new prompt.
          </>
        )}
        {ok && (
          <>
            <strong>Paid {kes(prompt.amount)}.</strong> Thank you; it's on your statement.
          </>
        )}
        {!pending && !ok && (
          <>
            <strong>The payment didn't go through.</strong> {prompt.message ?? "Try again."}
          </>
        )}
        {(!pending || gaveUp) && (
          <div className="mt-2">
            <PortalButton variant="secondary" onClick={() => setPrompt(null)}>
              {ok ? "Done" : "Try again"}
            </PortalButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field
          label="Amount (KES)"
          type="number"
          inputMode="numeric"
          min={1}
          max={full}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Field
          label="M-Pesa phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Muted className="text-[12.5px]">
        You owe {kes(owed)}. The prompt asks for whole shillings; anything over stays as credit.
      </Muted>
      <ErrorText>{error}</ErrorText>
      <PortalButton onClick={() => void send()} disabled={busy || owed <= 0}>
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        {busy ? "Sending…" : "Pay by M-Pesa"}
      </PortalButton>
    </div>
  );
}

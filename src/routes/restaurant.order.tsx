// A new purchase order from the restaurant's catalogue (doc 15 §21): pick quantities at its own
// prices, then delivery and how it will pay, then place it. The store prices it again from the
// catalogue, gives it a PO number and charges nothing at placing: the heads sign the printed PO
// first; once the signed copy is uploaded it is approved, then paid (or put on credit), and only then
// does Moments see it (owner, 17 Nov; doc 15 §23).
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import {
  ErrorText,
  Field,
  Muted,
  PortalButton,
  PortalButtonLink,
  PortalCard,
  inputClass,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { useAuth } from "@/contexts/AuthContext";
import { restaurantApi, type MyCatalogue } from "@/services/restaurantApi";
import { orderDraft, useOrderDraft } from "@/lib/orderDraft";
import { useCredit } from "@/lib/useCredit";
import {
  clampQty,
  deliveryProblem,
  filterLines,
  groupByCategory,
  kes,
  orderSummary,
  ruleText,
  type DeliveryDraft,
} from "@/lib/restaurantPortal";

export default function RestaurantOrderPage() {
  useEffect(() => {
    document.title = "New order · Moments Packaging";
  }, []);
  return (
    <PortalShell page="orders">
      <OrderBody />
    </PortalShell>
  );
}

type Pay = "CREDIT" | "MPESA" | "BANK_TRANSFER";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `po-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function OrderBody() {
  const { restaurant, me } = usePortal();
  const { user } = useAuth();
  const navigate = useNavigate();
  const quantities = useOrderDraft();
  const { credit } = useCredit();
  const live = credit && credit !== "unavailable" && credit.creditEnabled ? credit : null;
  const [catalogue, setCatalogue] = useState<MyCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"pick" | "review">("pick");
  const [delivery, setDelivery] = useState<DeliveryDraft>({
    method: "DELIVERY",
    address: "",
    county: "Nairobi",
    receiver: me?.name ?? "",
    phone: me?.phone ?? "",
  });
  const [pay, setPay] = useState<Pay>(restaurant.creditEnabled ? "CREDIT" : "MPESA");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per order being reviewed: a double tap or a retry after a lost answer can't place it twice.
  const keyRef = useRef(newKey());

  useEffect(() => {
    restaurantApi
      .catalogue()
      .then(setCatalogue)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load your catalogue."));
  }, []);

  const summary = useMemo(
    () => orderSummary(catalogue?.lines ?? [], quantities),
    [catalogue, quantities],
  );

  if (loadError) {
    return (
      <PortalCard>
        <ErrorText>{loadError}</ErrorText>
      </PortalCard>
    );
  }
  if (!catalogue) {
    return <div className="h-48 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />;
  }
  if (catalogue.lines.length === 0) {
    return (
      <PortalCard>
        <h1 className="text-[22px] font-bold">New order</h1>
        <Muted className="mt-1">
          You can order once Moments has priced your catalogue. Browse the products you buy and send
          a quote request.
        </Muted>
        <div className="mt-3">
          <PortalButtonLink to="/restaurant/browse">Browse products</PortalButtonLink>
        </div>
      </PortalCard>
    );
  }

  async function place() {
    const problem = deliveryProblem(delivery);
    if (problem) return setError(problem);
    if (summary.lines.length === 0) return setError("Add at least one product.");
    if (!user) return setError("Sign in again to place the order.");
    setBusy(true);
    setError(null);
    try {
      const placed = await restaurantApi.placePo({
        contactName: me?.name ?? `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: delivery.phone.trim(),
        paymentMethod: pay,
        delivery:
          delivery.method === "PICKUP"
            ? { method: "PICKUP" }
            : {
                method: "DELIVERY",
                address: delivery.address.trim(),
                county: delivery.county.trim(),
                receiver: delivery.receiver.trim(),
              },
        notes: notes.trim() || undefined,
        items: summary.lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
        idempotencyKey: keyRef.current,
      });
      orderDraft.clear();
      keyRef.current = newKey();
      toast.success(
        `${placed.poNumber ?? "Your order"} is placed. Download it, have it signed and upload the signed copy.`,
      );
      navigate(`/restaurant/orders/${placed.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't place the order.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "review") {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <button
          type="button"
          onClick={() => setStep("pick")}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold"
          style={{ color: c.green }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Change the products
        </button>
        <h1 className="text-[24px] font-bold">Check and place</h1>

        <PortalCard aria-labelledby="h-lines">
          <h2 id="h-lines" className="text-[18px] font-bold">
            {summary.lines.length} {summary.lines.length === 1 ? "product" : "products"} from{" "}
            {catalogue.version ? `catalogue ${catalogue.version}` : "your catalogue"}
          </h2>
          <ul
            className="mt-2 flex flex-col divide-y text-[14px] tabular-nums"
            style={{ borderColor: c.line }}
          >
            {summary.lines.map((l) => (
              <li key={l.productId} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-semibold">{l.productName}</span>
                  <span className="block text-[12.5px]" style={{ color: c.muted }}>
                    {l.qty} × {kes(l.price)}
                    {l.unit ? ` per ${l.unit}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{kes(l.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 py-2 font-bold">
              <span>Total (VAT included)</span>
              <span>{kes(summary.total)}</span>
            </li>
          </ul>
          <Muted className="mt-1 text-[12.5px]">
            Delivery is agreed by Moments. The store works out the final total from your catalogue.
          </Muted>
        </PortalCard>

        <PortalCard aria-labelledby="h-delivery">
          <h2 id="h-delivery" className="text-[18px] font-bold">
            Delivery
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery">
            {(
              [
                ["DELIVERY", "Moments delivers"],
                ["PICKUP", "We collect"],
              ] as const
            ).map(([v, label]) => (
              <label
                key={v}
                className="flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-[15px] font-semibold"
                style={{
                  borderColor: delivery.method === v ? c.green : c.line,
                  background: delivery.method === v ? "#E4F0E8" : "#FFFFFF",
                }}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="h-5 w-5"
                  checked={delivery.method === v}
                  onChange={() => setDelivery({ ...delivery, method: v })}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {delivery.method === "DELIVERY" && (
              <>
                <Field
                  label="Deliver to"
                  placeholder="Building, street, area"
                  value={delivery.address}
                  onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                />
                <Field
                  label="County"
                  value={delivery.county}
                  onChange={(e) => setDelivery({ ...delivery, county: e.target.value })}
                />
                <Field
                  label="Who receives it (first and last name)"
                  value={delivery.receiver}
                  onChange={(e) => setDelivery({ ...delivery, receiver: e.target.value })}
                />
              </>
            )}
            {delivery.method === "PICKUP" && (
              <Muted>
                From Moments' shop on Ukwala Road, Nairobi CBD, once Moments says it's ready.
              </Muted>
            )}
            <Field
              label="Phone for this order"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={delivery.phone}
              onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
            />
          </div>
        </PortalCard>

        <PortalCard aria-labelledby="h-pay">
          <h2 id="h-pay" className="text-[18px] font-bold">
            How you'll pay
          </h2>
          <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="How you'll pay">
            {(
              [
                ...(restaurant.creditEnabled
                  ? ([["CREDIT", `On credit (${restaurant.paymentTermsDays ?? 30} days)`]] as const)
                  : []),
                ["MPESA", "M-Pesa"],
                ["BANK_TRANSFER", "Bank transfer"],
              ] as const
            ).map(([v, label]) => (
              <label
                key={v}
                className="flex min-h-11 items-center gap-2.5 rounded-[10px] border px-3 text-[15px]"
                style={{ borderColor: pay === v ? c.green : c.line }}
              >
                <input
                  type="radio"
                  name="pay"
                  className="h-5 w-5"
                  checked={pay === v}
                  onChange={() => setPay(v)}
                />
                {label}
              </label>
            ))}
          </div>
          {pay === "CREDIT" && live && (
            <div className="mt-2 text-[13.5px]">
              <span style={{ color: c.muted }}>Credit available: </span>
              <strong className="tabular-nums">{kes(live.available)}</strong>
              {summary.total > live.available && (
                <p role="alert" className="mt-1 font-semibold" style={{ color: c.danger }}>
                  This order is more than your available credit. Pay for it by M-Pesa or bank, make
                  it smaller, or talk to Moments.
                </p>
              )}
              {live.overdue > 0 && summary.total <= live.available && (
                <p className="mt-1" style={{ color: "#6B4A00" }}>
                  {kes(live.overdue)} is overdue, so this order waits for Moments' approval. Pay it
                  on the Statement page to avoid the wait.
                </p>
              )}
            </div>
          )}
          <Muted className="mt-2 text-[12.5px]">
            {pay === "CREDIT"
              ? `Nothing to pay: once your heads approve it, it goes on your credit account, due ${live?.paymentTermsDays ?? restaurant.paymentTermsDays ?? 30} days after delivery.`
              : "Nothing is charged now. Once your heads approve it (the signed copy is uploaded), you pay and it goes to Moments. Any balance Moments holds for you is used first."}
          </Muted>
        </PortalCard>

        <Field
          label="Note for Moments (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#FFF8E6", border: "1px solid #F2DFA6" }}
        >
          <strong>Next:</strong> you get a PO number. Download the PO, have it signed (
          {ruleText(restaurant.approvalRule)}), and upload the signed copy: that approves it.{" "}
          {pay === "CREDIT"
            ? "It then goes on your credit account and to Moments."
            : "Then you pay, and it goes to Moments."}{" "}
          Until it reaches Moments you can still cancel it.
        </div>

        <ErrorText>{error}</ErrorText>
        <PortalButton
          onClick={() => void place()}
          disabled={busy}
          className="min-h-[52px] text-[16px]"
        >
          {busy ? "Placing…" : `Place the order · ${kes(summary.total)}`}
        </PortalButton>
      </div>
    );
  }

  const groups = groupByCategory(filterLines(catalogue.lines, query));
  return (
    <div className={`flex flex-col gap-4 ${summary.lines.length ? "pb-20" : ""}`}>
      <div>
        <h1 className="text-[24px] font-bold">New order</h1>
        <Muted>
          From your catalogue{catalogue.version ? ` ${catalogue.version}` : ""}, at your own prices
          (VAT included).
        </Muted>
      </div>
      <label className="relative block">
        <span className="sr-only">Search your catalogue</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: c.muted }}
          aria-hidden="true"
        />
        <input
          type="search"
          className={`${inputClass} pl-9`}
          style={{ borderColor: c.line }}
          placeholder="Search your products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {groups.length === 0 && <Muted>Nothing in your catalogue matches "{query}".</Muted>}
      {groups.map((g) => (
        <PortalCard key={g.category} aria-label={g.category}>
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: c.muted }}>
            {g.category}
          </h2>
          <ul className="mt-1 flex flex-col divide-y" style={{ borderColor: c.line }}>
            {g.lines.map((l) => {
              const qty = quantities[l.productId] ?? 0;
              return (
                <li key={l.productId} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-semibold">{l.productName}</div>
                    <div className="text-[13px] tabular-nums" style={{ color: c.muted }}>
                      {kes(l.price)}
                      {l.unit ? ` per ${l.unit}` : ""}
                    </div>
                  </div>
                  <QtyStepper
                    name={l.productName}
                    value={qty}
                    onChange={(n) => orderDraft.set(l.productId, n)}
                  />
                </li>
              );
            })}
          </ul>
        </PortalCard>
      ))}

      {summary.lines.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-14 z-30 border-t bg-white px-4 py-2.5 sm:bottom-0"
          style={{
            borderColor: c.line,
            paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-[14px] font-semibold tabular-nums">
              {summary.lines.length} {summary.lines.length === 1 ? "product" : "products"} ·{" "}
              {kes(summary.total)}
            </span>
            <PortalButton
              onClick={() => {
                setError(null);
                setStep("review");
                window.scrollTo({ top: 0 });
              }}
            >
              Review the order
            </PortalButton>
          </div>
        </div>
      )}
    </div>
  );
}

function QtyStepper({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        className="grid h-11 w-11 place-items-center rounded-[10px] border disabled:opacity-40"
        style={{ borderColor: c.line }}
        aria-label={`One less ${name}`}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={9999}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(clampQty(e.target.value))}
        className="h-11 w-14 rounded-[10px] border text-center text-[16px] tabular-nums"
        style={{ borderColor: c.line }}
        aria-label={`How many ${name}`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-11 w-11 place-items-center rounded-[10px] text-white"
        style={{ background: c.green }}
        aria-label={`One more ${name}`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

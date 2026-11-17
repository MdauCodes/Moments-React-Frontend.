// One purchase order (PoScreen design; doc 15 §20-§21, §23): header with the PO number, total,
// stage, Paid / Not paid and who placed it; Download PO; then what this person can do now: upload the
// signed copy (or a new version Moments changed), pay (M-Pesa or bank, balance used first), top up,
// or cancel before it reaches Moments; then sections that open and close: payment, versions, items,
// signatures, delivery, terms, history.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Download, FileText } from "lucide-react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import { SignedCopyUpload } from "@/components/restaurant/SignedCopyUpload";
import { PoPayNow } from "@/components/restaurant/PoPayNow";
import {
  ComingSoon,
  ErrorText,
  Field,
  Muted,
  Pill,
  PortalButton,
  PortalCard,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import {
  restaurantApi,
  RestaurantApiError,
  type PoDetail,
  type SignedCopy,
} from "@/services/restaurantApi";
import {
  canUploadAt,
  actionAllowed,
  actionLimitText,
  dateTime,
  fileSize,
  findAction,
  isHeadRole,
  kes,
  poPaymentBadge,
  poStageText,
  ruleText,
  vatShare,
} from "@/lib/restaurantPortal";

export default function RestaurantPoPage() {
  return (
    <PortalShell page="orders">
      <PoBody />
    </PortalShell>
  );
}

function PoBody() {
  const { orderId = "" } = useParams();
  const { restaurant, me } = usePortal();
  const [po, setPo] = useState<PoDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await restaurantApi.purchaseOrder(orderId);
      setPo(d);
      setState("ready");
      document.title = `${d.poNumber} · Moments Packaging`;
    } catch (e) {
      if (e instanceof RestaurantApiError && e.status === 404) setState("unavailable");
      else {
        setError(e instanceof Error ? e.message : "Couldn't load this order.");
        setState("error");
      }
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link
      to="/restaurant/orders"
      className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold"
      style={{ color: c.green }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All orders
    </Link>
  );

  if (state === "loading") {
    return <div className="h-48 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />;
  }
  if (state === "unavailable") {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <ComingSoon
          title="This order can't be shown"
          text="It may not exist, or it isn't one you can see. Buyers see the orders they placed; heads see all of the restaurant's orders."
        />
      </div>
    );
  }
  if (state === "error" || !po) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <PortalCard>
          <ErrorText>{error}</ErrorText>
          <PortalButton className="mt-3" onClick={() => void load()}>
            Try again
          </PortalButton>
        </PortalCard>
      </div>
    );
  }

  const stage = poStageText(po.stage, po.signingMethod, po.revision);
  const paid = poPaymentBadge(po.paymentMethod, po.money, po.stage);
  const vat =
    po.vatIncluded === false
      ? null
      : typeof po.vatIncluded === "number"
        ? po.vatIncluded
        : vatShare(po.total);
  const newVersion = (po.revision ?? 1) > 1 && po.stage === "AWAITING_SIGNED_COPY";
  // The store says whether it is this person's turn (`canUpload`); the guess below (a head, or the
  // name of whoever placed it) is only for a store that doesn't send it yet. The store checks anyway.
  const placedByMe = !!me && me.name === po.placedBy.name;
  // While Moments reviews a change, the store refuses uploads and payment; its actions[] says so.
  const myTurn =
    po.signingMethod === "MANUAL" &&
    !po.changeUnderReview &&
    actionAllowed(
      po.actions,
      "UPLOAD_SIGNED_COPY",
      canUploadAt(po.stage) && (po.canUpload ?? (isHeadRole(restaurant.myRole) || placedByMe)),
    );
  const canPayNow =
    po.stage === "AWAITING_PAYMENT" &&
    !po.changeUnderReview &&
    actionAllowed(po.actions, "PAY", !!po.canPay);
  const canCancelNow = actionAllowed(po.actions, "CANCEL", !!po.canCancel);
  // The store's own words when it sends them (shown as given), else the agreed sentence.
  const reviewText =
    findAction(po.actions, "CHANGE_UNDER_REVIEW")?.text ||
    "Moments is reviewing a change to this PO.";
  // A limit the restaurant meets, in the store's words: shown instead of a button that would fail.
  const limits = (["UPLOAD_SIGNED_COPY", "PAY"] as const)
    .map((k) => actionLimitText(po.actions, k))
    .filter((t): t is string => !!t && !po.changeUnderReview);
  const cancelLimit =
    po.stage !== "CANCELLED" && po.stage !== "DELIVERED"
      ? actionLimitText(po.actions, "CANCEL")
      : null;
  const restaurantCopies = po.signedCopies.filter((s) => s.side === "RESTAURANT");

  async function cancel() {
    if (!po) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      setPo(await restaurantApi.cancelPo(po.orderId, cancelReason.trim() || undefined));
      setCancelOpen(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Couldn't cancel the order.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function downloadPo() {
    if (!po) return;
    setDownloading(true);
    try {
      await restaurantApi.downloadPo(po.orderId, po.poNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't download the purchase order.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PortalCard aria-label="Purchase order">
        <div className="text-[13px]" style={{ color: c.muted }}>
          Purchase order{po.catalogueVersion ? ` · from catalogue ${po.catalogueVersion}` : ""}
        </div>
        <h1 className="mt-0.5 text-[24px] font-bold tabular-nums">{po.poNumber}</h1>
        <div className="text-[14px] tabular-nums" style={{ color: c.muted }}>
          {dateTime(po.placedAt)} · {po.lines.length} {po.lines.length === 1 ? "item" : "items"} ·{" "}
          <strong style={{ color: c.ink }}>{kes(po.total)}</strong>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Pill tone={stage.tone}>{stage.label}</Pill>
          {po.stage !== "CANCELLED" && <Pill tone={paid.tone}>{paid.label}</Pill>}
          <Pill>
            Placed by {po.placedBy.name}
            {po.placedBy.rank ? ` · ${po.placedBy.rank}` : ""}
          </Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[13.5px] sm:grid-cols-4">
          <Fact
            label="Pay by"
            value={payLabel(po.paymentMethod)}
            sub={po.creditDueDays ? `${po.creditDueDays} days from delivery` : undefined}
          />
          <Fact
            label="Delivery"
            value={po.delivery?.method ?? "—"}
            sub={po.deliveryFee ? `${kes(po.deliveryFee)}` : undefined}
          />
          <Fact
            label="Total"
            value={kes(po.total)}
            sub={vat != null ? `VAT ${kes(vat)} included` : undefined}
          />
          <Fact label="Signing" value={signingLabel(po.signingMethod)} />
        </div>
        <div className="mt-3">
          <PortalButton
            variant="secondary"
            onClick={() => void downloadPo()}
            disabled={downloading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {downloading ? "Downloading…" : "Download PO (PDF)"}
          </PortalButton>
        </div>
      </PortalCard>

      {justUploaded && (
        <p
          role="status"
          className="rounded-[12px] p-3.5 text-[14px]"
          style={{ background: "#E3EEF0", color: "#1D4F5A" }}
        >
          <strong>Signed copy uploaded: your order is approved.</strong>{" "}
          {po.paymentMethod === "CREDIT"
            ? "It goes on your credit account and on to Moments."
            : "Pay for it below and it goes to Moments."}
        </p>
      )}

      {po.changeUnderReview && (
        <p
          role="status"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#E3EEF0", color: "#1D4F5A" }}
        >
          {reviewText}
        </p>
      )}

      {limits.map((t) => (
        <p
          key={t}
          role="note"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#F3EFE6", color: "#3E4842" }}
        >
          {t}
        </p>
      ))}

      {newVersion && !po.changeUnderReview && (
        <p
          role="alert"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#FFF4D6", color: "#5A3E00" }}
        >
          <strong>Moments changed this order: version {po.revision}.</strong>{" "}
          {po.sentBackReason ? `${po.sentBackReason} ` : ""}Download the new version, have it
          signed, and upload it.
        </p>
      )}

      {canPayNow && (
        <PoPayNow
          po={po}
          mode="pay"
          defaultPhone={me?.phone ?? po.delivery?.phone ?? ""}
          onChanged={() => void load()}
        />
      )}

      {po.stage === "AWAITING_TOP_UP" && (po.money?.topUpDue ?? 0) > 0 && (
        <PoPayNow
          po={po}
          mode="topup"
          defaultPhone={me?.phone ?? po.delivery?.phone ?? ""}
          onChanged={() => void load()}
        />
      )}

      {po.stage === "CONFIRMING_PAYMENT" && (
        <p
          role="status"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#E3EEF0", color: "#1D4F5A" }}
        >
          <strong>
            Bank transfer sent
            {po.money?.bankTransferSentAt ? ` ${dateTime(po.money.bankTransferSentAt)}` : ""}.
          </strong>{" "}
          {po.money?.bankTransferReference ? `Reference ${po.money.bankTransferReference}. ` : ""}
          Moments marks it received, confirms it, and then the order goes on.
        </p>
      )}

      {po.stage === "HELD" && (
        <p
          role="status"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#FFF4D6", color: "#5A3E00" }}
        >
          <strong>Waiting for Moments' approval.</strong> Your credit account has an overdue bill,
          or this order no longer fits the credit available. Pay what's due on the{" "}
          <Link to="/restaurant/statement" className="font-semibold underline">
            Statement
          </Link>{" "}
          page, or talk to Moments.
        </p>
      )}

      {myTurn && (
        <SignedCopyUpload
          po={po}
          onUploaded={() => {
            setJustUploaded(true);
            void load();
          }}
        />
      )}

      {po.money && (
        <Collapsible title="Payment" summary={paid.label} defaultOpen={po.money.paidAmount > 0}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[14px] tabular-nums">
            <dt style={{ color: c.muted }}>Order total</dt>
            <dd className="text-right">{kes(po.money.total)}</dd>
            {po.money.balanceApplied > 0 && (
              <>
                <dt style={{ color: c.muted }}>Your balance with Moments, used</dt>
                <dd className="text-right">{kes(po.money.balanceApplied)}</dd>
              </>
            )}
            <dt style={{ color: c.muted }}>Paid so far</dt>
            <dd className="text-right">{kes(po.money.paidAmount)}</dd>
            <dt className="font-bold">Still to pay</dt>
            <dd className="text-right font-bold">{kes(po.money.amountDue)}</dd>
          </dl>
          {(po.topUps ?? []).length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
              {(po.topUps ?? []).map((t) => (
                <li key={t.id} className="flex list-none justify-between gap-2">
                  <span>
                    Top-up · {t.method === "BANK" ? "bank" : "M-Pesa"} · {dateTime(t.at)}
                    {t.reference ? ` · ${t.reference}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {kes(t.amount)}{" "}
                    <Pill
                      tone={
                        t.status === "CONFIRMED" ? "good" : t.status === "PENDING" ? "wait" : "bad"
                      }
                    >
                      {t.status === "CONFIRMED"
                        ? "Received"
                        : t.status === "PENDING"
                          ? "Waiting"
                          : "Didn't go through"}
                    </Pill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Collapsible>
      )}

      {(po.revisions ?? []).length > 0 && (
        <Collapsible title="Versions" summary={`version ${po.revision ?? 1}`}>
          <ul className="flex flex-col gap-2 text-[14px]">
            {(po.revisions ?? []).map((r) => (
              <li key={r.revision} className="list-none">
                <strong>Version {r.revision}</strong> · {dateTime(r.at)}
                {r.changedBy ? ` by ${r.changedBy}` : ""} · {kes(r.oldTotal)} → {kes(r.newTotal)}
                {r.note && (
                  <div className="text-[13px]" style={{ color: c.muted }}>
                    {r.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Muted className="mt-2 text-[12.5px]">
            A price Moments sets on a changed order applies to that order only; your catalogue stays
            as it is.
          </Muted>
        </Collapsible>
      )}

      <Collapsible
        title="Items"
        summary={`${po.lines.length} at your catalogue prices`}
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-[14px] tabular-nums">
            <thead>
              <tr className="text-left text-[12.5px]" style={{ color: c.muted }}>
                <th className="py-1.5 pr-2 font-semibold">Product</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l, i) => (
                <tr
                  key={`${l.code ?? l.name}-${i}`}
                  className="border-t"
                  style={{ borderColor: c.line }}
                >
                  <td className="py-2 pr-2">
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-[12.5px]" style={{ color: c.muted }}>
                      {[l.code, l.pack, `${kes(l.unitPrice)} each`].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-right">{l.qty}</td>
                  <td className="py-2 text-right">{kes(l.amount)}</td>
                </tr>
              ))}
              <SumRow label="Items" value={kes(po.itemsTotal)} />
              {po.deliveryFee != null && po.deliveryFee > 0 && (
                <SumRow label="Delivery" value={kes(po.deliveryFee)} />
              )}
              <SumRow label="Total" value={kes(po.total)} strong />
              {vat != null && (
                <SumRow label="of which VAT 16%, included in the prices" value={kes(vat)} muted />
              )}
            </tbody>
          </table>
        </div>
      </Collapsible>

      <Collapsible title="Signatures" summary={stage.label} defaultOpen>
        <Muted>
          {restaurant.businessName}'s rule:{" "}
          <strong>{ruleText(po.approvalRule ?? restaurant.approvalRule)}</strong> before the order
          reaches Moments. Then Moments' Director or Operations manager (either one) signs it.
        </Muted>
        <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: c.line }}>
          {po.heads.map((h) => (
            <li key={h.name} className="flex list-none items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="font-semibold">{h.name}</span>
                {h.rank && <span style={{ color: c.muted }}> · {h.rank}</span>}
              </span>
              <Pill tone={h.mustSign ? "info" : "muted"}>{h.mustSign ? "Signs" : "May sign"}</Pill>
            </li>
          ))}
          <li className="flex list-none items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="font-semibold">Moments Packaging · final signature</span>
              <div className="text-[12.5px]" style={{ color: c.muted }}>
                Director or Operations manager, once the order is prepared
              </div>
            </span>
            <Pill tone={po.momentsSignedCopy ? "good" : "muted"}>
              {po.momentsSignedCopy ? "Signed" : "After the heads"}
            </Pill>
          </li>
        </ul>
        {restaurantCopies.length > 0 && (
          <div className="mt-3">
            <h3 className="text-[15px] font-bold">Signed copies</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {restaurantCopies.map((s) => (
                <CopyRow key={s.id} orderId={po.orderId} copy={s} />
              ))}
            </ul>
          </div>
        )}
        {po.momentsSignedCopy && (
          <div className="mt-3">
            <h3 className="text-[15px] font-bold">Moments' signed copy</h3>
            <ul className="mt-2">
              <CopyRow orderId={po.orderId} copy={po.momentsSignedCopy} />
            </ul>
          </div>
        )}
      </Collapsible>

      <Collapsible title="Delivery" summary={po.delivery?.method ?? ""}>
        <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[14px]">
          <dt style={{ color: c.muted }}>How</dt>
          <dd>{po.delivery?.method ?? "—"}</dd>
          <dt style={{ color: c.muted }}>Where</dt>
          <dd className="break-words">{po.delivery?.address ?? "—"}</dd>
          <dt style={{ color: c.muted }}>Receive</dt>
          <dd>{[po.delivery?.receiver, po.delivery?.phone].filter(Boolean).join(", ") || "—"}</dd>
          <dt style={{ color: c.muted }}>When</dt>
          <dd>After Moments signs; you get a "ready" or "on its way" email.</dd>
        </dl>
      </Collapsible>

      <Collapsible title="Terms" summary="">
        <ul className="list-disc pl-5 text-[14px] leading-relaxed">
          <li>
            Prices from {restaurant.businessName}'s catalogue
            {po.catalogueVersion ? ` ${po.catalogueVersion}` : ""}. VAT 16% included.
          </li>
          {po.creditDueDays ? (
            <li>On credit: pay within {po.creditDueDays} days of delivery.</li>
          ) : null}
          <li>
            An overdue bill or an order above the credit left is held until Moments approves it.
          </li>
        </ul>
      </Collapsible>

      <Collapsible title="History" summary={po.history.length ? `${po.history.length} steps` : ""}>
        <ol className="flex flex-col gap-1.5 text-[14px]">
          {po.history.map((h, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-28 shrink-0 tabular-nums" style={{ color: c.muted }}>
                {dateTime(h.at)}
              </span>
              <span className="min-w-0">{h.text}</span>
            </li>
          ))}
        </ol>
      </Collapsible>

      {!canCancelNow && cancelLimit && (
        <p
          role="note"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#F3EFE6", color: "#3E4842" }}
        >
          {cancelLimit}
        </p>
      )}

      {canCancelNow && (
        <PortalCard aria-labelledby="h-cancel">
          <h2 id="h-cancel" className="text-[16px] font-bold">
            Cancel this order
          </h2>
          <Muted className="mt-1">
            You can cancel it until it reaches Moments. Anything already paid stays with Moments as
            your balance for your next order.
          </Muted>
          {cancelOpen ? (
            <div className="mt-3 flex flex-col gap-2.5">
              <Field
                label="Why (optional)"
                value={cancelReason}
                maxLength={300}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <ErrorText>{cancelError}</ErrorText>
              <div className="flex flex-col gap-2 sm:flex-row">
                <PortalButton onClick={() => void cancel()} disabled={cancelBusy}>
                  {cancelBusy ? "Cancelling…" : `Yes, cancel ${po.poNumber}`}
                </PortalButton>
                <PortalButton
                  variant="secondary"
                  onClick={() => setCancelOpen(false)}
                  disabled={cancelBusy}
                >
                  Keep it
                </PortalButton>
              </div>
            </div>
          ) : (
            <PortalButton variant="secondary" className="mt-3" onClick={() => setCancelOpen(true)}>
              Cancel this order
            </PortalButton>
          )}
        </PortalCard>
      )}
    </div>
  );
}

function payLabel(method?: string | null): string {
  switch (method) {
    case "CREDIT":
      return "Credit";
    case "MPESA":
    case "PAYHERO":
      return "M-Pesa";
    case "BANK_TRANSFER":
      return "Bank";
    default:
      return method ?? "—";
  }
}

function signingLabel(m: PoDetail["signingMethod"]): string {
  if (m === "EMAIL_CODE") return "Email code";
  if (m === "MPESA") return "M-Pesa";
  return "Signed on paper";
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] p-2.5" style={{ background: c.soft }}>
      <div className="text-[12px]" style={{ color: c.muted }}>
        {label}
      </div>
      <div className="font-bold">{value}</div>
      {sub && (
        <div className="text-[12px]" style={{ color: c.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SumRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-t" style={{ borderColor: c.line, color: muted ? c.muted : undefined }}>
      <td colSpan={2} className={`py-1.5 pr-2 ${strong ? "font-bold" : ""}`}>
        {label}
      </td>
      <td className={`py-1.5 text-right ${strong ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}

function Collapsible({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="rounded-[14px] border bg-white" style={{ borderColor: c.line }}>
      <h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span className="min-w-0">
            <span className="text-[16px] font-bold">{title}</span>
            {summary && (
              <span className="ml-2 text-[13px] font-normal" style={{ color: c.muted }}>
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function CopyRow({ orderId, copy }: { orderId: string; copy: SignedCopy }) {
  const tone = copy.status === "ACCEPTED" ? "good" : copy.status === "SENT_BACK" ? "bad" : "info";
  const label =
    copy.status === "ACCEPTED"
      ? "Accepted"
      : copy.status === "SENT_BACK"
        ? "Sent back"
        : "Moments is checking";
  return (
    <li className="list-none rounded-[10px] border p-3 text-[14px]" style={{ borderColor: c.line }}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          Uploaded by <strong>{copy.uploadedBy.name}</strong>
          {copy.uploadedBy.rank ? ` (${copy.uploadedBy.rank})` : ""}
        </span>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <div className="mt-0.5 text-[12.5px]" style={{ color: c.muted }}>
        {dateTime(copy.uploadedAt)}
        {copy.decidedAt ? ` · ${label.toLowerCase()} ${dateTime(copy.decidedAt)}` : ""}
        {copy.decidedBy ? ` by ${copy.decidedBy}` : ""}
      </div>
      {copy.reason && (
        <div className="mt-1">
          <strong>Why:</strong> {copy.reason}
        </div>
      )}
      {copy.note && (
        <div className="mt-1" style={{ color: c.muted }}>
          Note: {copy.note}
        </div>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {copy.files.map((f) => (
          <li key={f.index} className="list-none">
            <a
              href={restaurantApi.signedCopyFileUrl(orderId, copy.id, f.index)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 font-semibold"
              style={{ color: c.green }}
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-all">{f.fileName}</span>
              <span className="font-normal" style={{ color: c.muted }}>
                {fileSize(f.sizeBytes)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

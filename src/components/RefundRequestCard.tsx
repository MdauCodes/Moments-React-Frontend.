import type { RefundRequest } from "@/services/refundStore";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

/** What the customer sees of the request they placed, on both the signed-in order page and the
 *  guest track page. A cancellation reads as a conversation with our team — under review, then
 *  cancelled with a refund on its way, then refund sent, or not approved — so it is always clear
 *  where it stands and that the refund is sent by hand. */
export function RefundRequestCard({ request, total }: { request: RefundRequest; total?: number }) {
  if (request.desiredAction !== "CANCEL_ORDER") {
    return (
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Refund request: {request.status}</p>
        <p className="mt-1 text-xs text-muted-foreground">Reason: {request.reason}</p>
        <p className="text-xs text-muted-foreground">Action: {request.desiredAction.replace(/_/g, " ")}</p>
        {request.adminNote && <p className="mt-2 text-xs">Admin note: {request.adminNote}</p>}
      </div>
    );
  }

  const amount = total ?? request.orderTotal;
  const refundLine = amount != null ? `your refund of ${fmt(amount)}` : "your refund";
  const copy: Record<RefundRequest["status"], { title: string; body: string }> = {
    PENDING: {
      title: "Cancellation request — under review",
      body: "We've received your request. Your order stays active until we confirm, and we'll email and text you when we've decided.",
    },
    APPROVED: {
      title: "Cancellation approved — your order is cancelled",
      body: `We'll send ${refundLine} to the M-Pesa number you paid with, and let you know as soon as it's sent. Refunds are sent by hand, so it isn't instant.`,
    },
    REJECTED: {
      title: "Cancellation not approved",
      body: "Your order is going ahead as planned. If you'd still like to talk it through, call or WhatsApp us.",
    },
    RESOLVED: {
      title: "Refund sent",
      body: `We've sent ${refundLine} to your M-Pesa. If you can't see it, WhatsApp us and we'll help.`,
    },
  };
  const { title, body } = copy[request.status];

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <p className="mt-2 text-xs text-muted-foreground">Your reason: {request.reason}</p>
      {request.adminNote && <p className="mt-1 text-xs">Note from our team: {request.adminNote}</p>}
    </div>
  );
}

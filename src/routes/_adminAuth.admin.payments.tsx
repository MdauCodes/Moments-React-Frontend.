import { useEffect, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { fetchStuckPayments, markOrderPaymentRefunded, updateOrderStatus, type StuckPayment } from "@/services/commerceApi";
import { adminResources } from "@/services/adminResources";
import { AgeBadge, formatDateShort, formatKes } from "@/components/admin/commerceUi";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { MarkPaidModal } from "@/components/admin/MarkPaidModal";

/**
 * Payments that never got a final M-Pesa callback and that the automatic STK reconciliation
 * sweep (every 10 minutes, PaymentService.reconcileStuckStkPayments on the backend) hasn't been
 * able to resolve on its own — either Daraja hasn't reached a final result yet, or the record is
 * old enough to be past the reconciliation window. Staff resolve manually by checking against an
 * M-Pesa message/statement.
 */
function StuckPaymentsPage() {
  const allowed = useRequirePermission([PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_MANAGE_ALL]);
  const [rows, setRows] = useState<StuckPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markPaidRow, setMarkPaidRow] = useState<StuckPayment | null>(null);
  // null = still loading; only matters for TUMABODA_DELIVERY rows — see
  // TumaBodaStuckPaymentOverrideService's Javadoc on the backend.
  const [tumaBodaOverrideEnabled, setTumaBodaOverrideEnabled] = useState<boolean | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await fetchStuckPayments());
    } catch (err) {
      reportAdminError(err, "Failed to load stuck payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // Not every staff role can read this (SUPER_ADMIN-only endpoint) — a 403 just means "treat
    // TumaBoda overrides as disabled", not a real error to surface.
    adminResources.tumaBodaPaymentOverride.get()
      .then((s) => setTumaBodaOverrideEnabled(!!s.enabled))
      .catch(() => setTumaBodaOverrideEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!allowed) return null;

  const tumaBodaOverrideBlocked = (row: StuckPayment) =>
    row.fulfillmentType === "TUMABODA_DELIVERY" && !tumaBodaOverrideEnabled;

  const confirmMarkPaid = async (referenceNote: string) => {
    const row = markPaidRow;
    if (!row) return;
    setBusyId(row.paymentRecordId);
    try {
      // Passed as receiptReference (the real PaymentRecord.receiptNumber), not staffNotes — this
      // used to only land in the free-text notes field, so the actual M-Pesa/payment reference
      // was never captured on the payment record itself.
      await updateOrderStatus(row.orderId, "PAID", undefined, referenceNote);
      toast.success(`${row.orderReference} marked paid`);
      setMarkPaidRow(null);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to mark paid");
    } finally {
      setBusyId(null);
    }
  };

  const markFailed = async (row: StuckPayment) => {
    if (!confirm(`Mark payment for order ${row.orderReference} as failed? Only do this once you've confirmed no M-Pesa charge went through.`)) return;
    setBusyId(row.paymentRecordId);
    try {
      await markOrderPaymentRefunded(row.orderId, "Stuck STK payment — no M-Pesa charge confirmed");
      toast.success(`${row.orderReference} marked failed`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to mark failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Stuck payments" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Stuck payments">
              <p>
                These orders' M-Pesa payments never received a final callback from Safaricom, and
                an automatic check (every 10 minutes) hasn't been able to confirm what actually
                happened. Ask the customer for their M-Pesa confirmation message before deciding —
                <b> Mark Paid</b> if it went through, <b>Mark Failed</b> if it didn't.
              </p>
            </HelpPanel>
            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Amount (KES)</th>
                    <th>Status</th>
                    <th>Stuck since</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7}><div className="admin-empty">Loading…</div></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={7}><div className="admin-empty"><b>No stuck payments</b><div style={{ fontSize: 12, marginTop: 4, color: "var(--admin-muted)" }}>Every M-Pesa payment attempt has either succeeded, failed, or is still within its normal processing window.</div></div></td></tr>
                  ) : rows.map((row) => (
                    <tr key={row.paymentRecordId}>
                      <td><b>{row.orderReference}</b></td>
                      <td>{row.contactName}</td>
                      <td>{row.phone}</td>
                      <td><b>{formatKes(row.amount)}</b></td>
                      <td>{row.status}</td>
                      <td>
                        {formatDateShort(row.createdAt)} <AgeBadge since={row.createdAt} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={busyId === row.paymentRecordId || tumaBodaOverrideBlocked(row)}
                            title={tumaBodaOverrideBlocked(row) ? "Disabled — ask a super admin to enable TumaBoda payment overrides in Settings" : undefined}
                            onClick={() => setMarkPaidRow(row)}
                          >
                            Mark Paid
                          </button>
                          <button
                            className="admin-btn"
                            disabled={busyId === row.paymentRecordId}
                            onClick={() => void markFailed(row)}
                          >
                            Mark Failed
                          </button>
                        </div>
                        {tumaBodaOverrideBlocked(row) && (
                          <div style={{ fontSize: 10.5, color: "var(--admin-muted)", marginTop: 4 }}>
                            TumaBoda override disabled — see Settings
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8, padding: 12 }}>
              {loading ? (
                <div className="admin-empty">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="admin-empty"><b>No stuck payments</b></div>
              ) : rows.map((row) => (
                <div key={row.paymentRecordId} className="admin-card">
                  <div className="admin-card-row"><b>{row.orderReference}</b><b>{formatKes(row.amount)}</b></div>
                  <div className="admin-card-row"><span>{row.contactName}</span><span style={{ color: "var(--admin-muted)" }}>{row.phone}</span></div>
                  <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                    <span>{row.status}</span>
                    <span>Stuck since {formatDateShort(row.createdAt)}</span>
                    <AgeBadge since={row.createdAt} />
                  </div>
                  <div className="admin-card-actions">
                    <button
                      className="admin-btn admin-btn-primary"
                      disabled={busyId === row.paymentRecordId || tumaBodaOverrideBlocked(row)}
                      onClick={() => setMarkPaidRow(row)}
                      style={{ flex: 1 }}
                    >
                      Mark Paid
                    </button>
                    <button
                      className="admin-btn"
                      disabled={busyId === row.paymentRecordId}
                      onClick={() => void markFailed(row)}
                      style={{ flex: 1 }}
                    >
                      Mark Failed
                    </button>
                  </div>
                  {tumaBodaOverrideBlocked(row) && (
                    <div style={{ fontSize: 10.5, color: "var(--admin-muted)" }}>
                      TumaBoda override disabled — see Settings
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {markPaidRow && (
            <MarkPaidModal
              orderReference={markPaidRow.orderReference}
              amount={markPaidRow.amount}
              busy={busyId === markPaidRow.paymentRecordId}
              onConfirm={(note) => void confirmMarkPaid(note)}
              onCancel={() => setMarkPaidRow(null)}
            />
          )}
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default StuckPaymentsPage;

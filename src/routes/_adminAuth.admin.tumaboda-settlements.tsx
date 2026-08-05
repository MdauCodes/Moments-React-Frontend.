import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { reportAdminError } from "@/lib/adminErrorToast";
import { formatKes, formatDateShort } from "@/components/admin/commerceUi";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { PERM } from "@/lib/permissions";
import {
  tumaBodaSettlementApi,
  type TumaBodaBalance,
  type TumaBodaOrderBreakdown,
  type TumaBodaPayment,
  type TumaBodaReconciliation,
} from "@/services/tumaBodaSettlementService";

function AdminTumaBodaSettlementsPage() {
  const allowed = useRequirePermission([PERM.SETTINGS_MANAGE]);

  const [balance, setBalance] = useState<TumaBodaBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const [orders, setOrders] = useState<TumaBodaOrderBreakdown[]>([]);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [payments, setPayments] = useState<TumaBodaPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [reconciliations, setReconciliations] = useState<TumaBodaReconciliation[]>([]);
  const [loadingReconciliations, setLoadingReconciliations] = useState(true);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [theirBalance, setTheirBalance] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const [recordingReconciliation, setRecordingReconciliation] = useState(false);

  useEffect(() => { document.title = "TumaBoda Settlements · Moments admin"; }, []);

  const loadBalance = async () => {
    setLoadingBalance(true);
    try {
      const b = await tumaBodaSettlementApi.getBalance();
      setBalance(b);
      setPaymentAmount((prev) => prev || (b.outstandingBalance > 0 ? b.outstandingBalance.toFixed(2) : ""));
    } catch (err) {
      reportAdminError(err, "Loading TumaBoda balance");
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await tumaBodaSettlementApi.getPayments(0, 20);
      setPayments(res.rows);
    } catch (err) {
      reportAdminError(err, "Loading TumaBoda payment history");
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadReconciliations = async () => {
    setLoadingReconciliations(true);
    try {
      const res = await tumaBodaSettlementApi.getReconciliations(0, 20);
      setReconciliations(res.rows);
    } catch (err) {
      reportAdminError(err, "Loading TumaBoda reconciliation history");
    } finally {
      setLoadingReconciliations(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await tumaBodaSettlementApi.getOrderBreakdown(0, 50);
      setOrders(res.rows);
    } catch (err) {
      reportAdminError(err, "Loading TumaBoda order breakdown");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => { void loadBalance(); void loadPayments(); void loadReconciliations(); }, []);
  useEffect(() => { if (ordersOpen && orders.length === 0) void loadOrders(); }, [ordersOpen]);

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setRecordingPayment(true);
    try {
      await tumaBodaSettlementApi.recordPayment({ amount, notes: paymentNotes.trim() || undefined });
      toast.success(`Recorded payment of ${formatKes(amount)}`);
      setPaymentAmount("");
      setPaymentNotes("");
      await Promise.all([loadBalance(), loadPayments()]);
      setOrders([]);
      if (ordersOpen) void loadOrders();
    } catch (err) {
      reportAdminError(err, "Recording TumaBoda payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const submitReconciliation = async (e: FormEvent) => {
    e.preventDefault();
    const theirs = theirBalance.trim() ? Number(theirBalance) : undefined;
    if (theirBalance.trim() && (!Number.isFinite(theirs) || (theirs as number) < 0)) {
      toast.error("Enter a valid amount, or leave blank to just snapshot our own balance");
      return;
    }
    setRecordingReconciliation(true);
    try {
      const r = await tumaBodaSettlementApi.recordReconciliation({
        theirReportedBalance: theirs,
        notes: reconciliationNotes.trim() || undefined,
      });
      if (r.delta != null && Math.abs(r.delta) > 0.01) {
        toast.warning(`Recorded — ${formatKes(Math.abs(r.delta))} disagreement (${r.delta > 0 ? "we show more owed" : "TumaBoda shows more owed"})`);
      } else if (r.delta != null) {
        toast.success("Recorded — balances agree");
      } else {
        toast.success("Recorded our balance snapshot");
      }
      setTheirBalance("");
      setReconciliationNotes("");
      await loadReconciliations();
    } catch (err) {
      reportAdminError(err, "Recording TumaBoda reconciliation");
    } finally {
      setRecordingReconciliation(false);
    }
  };

  if (!allowed) return null;

  return (
    <AdminLayout title="TumaBoda Settlements" onReload={() => { void loadBalance(); void loadPayments(); void loadReconciliations(); }}>
      <HelpAnchor>
        <HelpPanel title="TumaBoda settlement ledger">
          <div>
            <p style={{ marginTop: 0 }}>
              Moments collects full payment from customers at checkout, then owes TumaBoda separately for the
              courier leg — settled by bank transfer roughly every 15 days, in full or in part.
            </p>
            <ul style={{ paddingLeft: 18, margin: "4px 0" }}>
              <li>The balance below is a running account total, not a per-order checklist.</li>
              <li>Record a payment after you've actually transferred money — full or partial.</li>
              <li>
                Reconciliation compares our balance to what TumaBoda reports (get that from Levi's team until an
                automated feed exists) — do this roughly every 7 days to catch drift early.
              </li>
            </ul>
          </div>
        </HelpPanel>

        <div className="admin-page-stack">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }} data-admin-stats>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Total owed to date</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
                {loadingBalance ? "—" : formatKes(balance?.totalOwed ?? 0)}
              </div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Total paid to date</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
                {loadingBalance ? "—" : formatKes(balance?.totalPaid ?? 0)}
              </div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Outstanding balance</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  marginTop: 6,
                  color: (balance?.outstandingBalance ?? 0) > 0 ? "var(--admin-clay)" : undefined,
                }}
              >
                {loadingBalance ? "—" : formatKes(balance?.outstandingBalance ?? 0)}
              </div>
            </div>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Delivered TumaBoda orders</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
                {loadingBalance ? "—" : balance?.deliveredOrderCount ?? 0}
              </div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 16 }}>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => setOrdersOpen((v) => !v)}
            >
              {ordersOpen ? "Hide" : "Show"} itemized breakdown
            </button>
            {ordersOpen && (
              <div data-admin-table-scroll style={{ marginTop: 12 }}>
                {loadingOrders ? (
                  <div className="admin-empty">Loading…</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Customer</th>
                        <th>Delivered</th>
                        <th>Cost</th>
                        <th>Paid</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr><td colSpan={6}><div className="admin-empty">No delivered TumaBoda orders yet.</div></td></tr>
                      ) : (
                        orders.map((o) => (
                          <tr key={o.orderId}>
                            <td><b>{o.reference}</b></td>
                            <td>{o.contactName}</td>
                            <td>{formatDateShort(o.createdAt)}</td>
                            <td>{formatKes(o.tumabodaCost)}</td>
                            <td>{formatKes(o.amountPaid)}</td>
                            <td>{o.settlementStatus.replace("_", " ")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <div className="admin-panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>Record a payment</h3>
              <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 0 }}>
                After you've actually sent the bank transfer — full or partial.
              </p>
              <form onSubmit={submitPayment} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="admin-label">Amount paid (KES)</label>
                  <input
                    className="admin-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="admin-label">Notes (bank ref, period covered, etc.)</label>
                  <input
                    className="admin-input"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <button type="submit" className="admin-btn" disabled={recordingPayment}>
                  {recordingPayment ? "Recording…" : "Record payment"}
                </button>
              </form>

              <h4 style={{ marginTop: 20, fontSize: 13, color: "var(--admin-muted)" }}>Recent payments</h4>
              {loadingPayments ? (
                <div className="admin-empty">Loading…</div>
              ) : payments.length === 0 ? (
                <div className="admin-empty">No payments recorded yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {payments.map((p) => (
                    <div key={p.id} className="admin-card-row" style={{ fontSize: 12 }}>
                      <span>{formatDateShort(p.paidAt)} — {p.notes || "—"}</span>
                      <b>{formatKes(p.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>Weekly reconciliation</h3>
              <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 0 }}>
                Get TumaBoda's reported balance from Levi's team, enter it here — do this roughly every 7 days.
              </p>
              <form onSubmit={submitReconciliation} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="admin-label">TumaBoda's reported balance (KES)</label>
                  <input
                    className="admin-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={loadingBalance ? "" : `Our balance: ${formatKes(balance?.outstandingBalance ?? 0)}`}
                    value={theirBalance}
                    onChange={(e) => setTheirBalance(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="admin-label">Notes</label>
                  <input
                    className="admin-input"
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <button type="submit" className="admin-btn" disabled={recordingReconciliation}>
                  {recordingReconciliation ? "Recording…" : "Record check"}
                </button>
              </form>

              <h4 style={{ marginTop: 20, fontSize: 13, color: "var(--admin-muted)" }}>Recent checks</h4>
              {loadingReconciliations ? (
                <div className="admin-empty">Loading…</div>
              ) : reconciliations.length === 0 ? (
                <div className="admin-empty">No reconciliation checks recorded yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {reconciliations.map((r) => {
                    const agrees = r.delta == null || Math.abs(r.delta) < 0.01;
                    return (
                      <div key={r.id} className="admin-card-row" style={{ fontSize: 12 }}>
                        <span>
                          {formatDateShort(r.checkedAt)} — us {formatKes(r.ourBalance)}
                          {r.theirReportedBalance != null && <> · them {formatKes(r.theirReportedBalance)}</>}
                        </span>
                        {r.delta != null && (
                          <b style={{ color: agrees ? "var(--admin-accent)" : "var(--admin-clay)" }}>
                            {agrees ? "Agrees" : `Δ ${formatKes(Math.abs(r.delta))}`}
                          </b>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </HelpAnchor>
    </AdminLayout>
  );
}

export default AdminTumaBodaSettlementsPage;

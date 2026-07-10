import { Link } from "react-router-dom";
import { Landmark, Briefcase } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";

function AdminCreditAccountsPage() {
  return (
    <AdminLayout title="Credit Accounts">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 40, textAlign: "center" }}>
          <div style={{
            margin: "0 auto", width: 56, height: 56, borderRadius: 999,
            display: "grid", placeItems: "center", background: "rgba(183, 132, 64, 0.12)",
          }}>
            <Landmark size={24} color="var(--admin-accent, #b78440)" />
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginTop: 16 }}>
            Coming soon
          </h2>
          <p style={{ color: "var(--admin-muted)", fontSize: 14, marginTop: 8, maxWidth: 520, marginInline: "auto" }}>
            Trade credit — buy-on-account with a credit limit and payment terms — is Phase 2, built on top of
            Business Accounts. It isn't live yet. When it ships, this page will hold:
          </p>
          <ul style={{
            textAlign: "left", maxWidth: 440, margin: "20px auto 0", fontSize: 13,
            color: "var(--admin-muted)", display: "grid", gap: 8, listStyle: "disc", paddingLeft: 20,
          }}>
            <li>A review queue of businesses applying for credit, with their uploaded documents and order history.</li>
            <li>Approve / reject, with a credit limit (Ksh) and payment terms (days) set on approval.</li>
            <li>A running-balance view per account — outstanding invoices, overdue flags.</li>
            <li>Suspend or adjust an account's limit or terms at any time.</li>
          </ul>
          <Link
            to="/admin/business-accounts"
            className="admin-btn admin-btn-ghost"
            style={{ marginTop: 24, display: "inline-flex" }}
          >
            <Briefcase size={14} /> View Business Accounts (live today)
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminCreditAccountsPage;

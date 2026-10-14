import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { CRM_URL } from "@/config/crm";

/**
 * Owner's plan, phase 7 (2026-10-14): enquiries, quotes, partner requests and the customer analytics now live in the CRM, so the
 * store dashboard stays about orders, stock and money. Old links and bookmarks land here and point to the right CRM page.
 */
function destinationFor(pathname: string): { what: string; crmPath: string } {
  if (pathname.startsWith("/admin/analytics/customers")) {
    return { what: "Customer analytics", crmPath: "/customers/analytics" };
  }
  if (pathname.startsWith("/admin/analytics/signups-demographics")) {
    return { what: "Sign-ups and demographics", crmPath: "/customers/analytics" };
  }
  if (pathname.startsWith("/admin/enquiries")) {
    return { what: "Enquiries, quotes and partner requests", crmPath: "/leads" };
  }
  return { what: "Leads and customers", crmPath: "/leads" };
}

function MovedToCrmPage() {
  const { pathname } = useLocation();
  const { what, crmPath } = destinationFor(pathname);
  useEffect(() => {
    document.title = `${what} · Moments admin`;
  }, [what]);

  return (
    <AdminLayout title={what}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 24, maxWidth: 640 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{what} are in the CRM now</h2>
          <p style={{ marginTop: 10, color: "var(--admin-muted, #6b7280)", lineHeight: 1.5 }}>
            Every website enquiry, enterprise quote and partner request becomes a lead in the CRM
            within 15 minutes. The person it is given to and every Admin are alerted there. Nothing
            was lost: older enquiries are already in the CRM as leads.
          </p>
          <a
            href={`${CRM_URL}${crmPath}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 6,
              background: "#1f7a3a",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open the CRM <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}

export default MovedToCrmPage;

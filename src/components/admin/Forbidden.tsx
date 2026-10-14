import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

import { ShieldAlert } from "lucide-react";

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "4rem 2rem",
  textAlign: "center",
  color: "var(--admin-muted)",
  gap: 14,
};

const iconWrap: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "color-mix(in oklab, var(--admin-clay) 20%, var(--admin-surface))",
  border: "1px solid var(--admin-clay)",
  color: "var(--admin-clay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: CSSProperties = { fontSize: 16, fontWeight: 600, color: "var(--admin-text)" };
const sub: CSSProperties = { fontSize: 12.5, color: "var(--admin-muted)", maxWidth: 380 };
const back: CSSProperties = {
  marginTop: 8,
  background: "var(--admin-border)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  textDecoration: "none",
};

export interface ForbiddenProps {
  /** Optional resource name shown in the body copy. */
  resource?: string;
}

export function Forbidden({ resource }: ForbiddenProps) {
  return (
    <div style={wrap}>
      <div style={iconWrap}>
        <ShieldAlert size={26} />
      </div>
      <div style={title}>Admin access required</div>
      <div style={sub}>
        {resource
          ? `Your STAFF account does not have permission to view ${resource}. Ask an administrator if you need access.`
          : "Your STAFF account does not have permission to view this page. Ask an administrator if you need access."}
      </div>
      <Link to="/admin/dashboard" style={back}>
        Back to the dashboard
      </Link>
    </div>
  );
}

export default Forbidden;

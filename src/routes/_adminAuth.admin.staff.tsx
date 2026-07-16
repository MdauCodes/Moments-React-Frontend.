
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { can } from "@/lib/permissions";
import { adminFetch, isAdminRole, type AdminRole } from "@/services/adminApi";



type AdminUserDto = {
  id?: string | number;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  roles?: string[];
  enabled?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "Active" | "Disabled";
  createdAt?: string;
};

type PageResponse<T> = { content?: T[] };

const styles: Record<string, CSSProperties> = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  search: {
    background: "color-mix(in oklab, var(--admin-bg) 84%, var(--admin-surface) 16%)",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--admin-text)",
    width: 280,
    outline: "none",
    fontFamily: "inherit",
  },
  count: { marginLeft: "auto", fontSize: 11.5, color: "var(--admin-muted)" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "var(--admin-shadow)",
  },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--admin-muted)",
    background: "var(--admin-bg)",
    borderBottom: "1px solid var(--admin-border)",
  },
  td: {
    padding: "12px 14px",
    fontSize: 12.5,
    color: "var(--admin-text)",
    borderBottom: "1px solid var(--admin-border)",
  },
  primary: { color: "var(--admin-text)", fontWeight: 600, lineHeight: 1.3 },
  secondary: { color: "var(--admin-muted)", fontSize: 11, marginTop: 2 },
  badge: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 10.5,
    fontWeight: 700,
  },
  empty: {
    background: "linear-gradient(180deg, color-mix(in oklab, var(--admin-surface) 88%, var(--cream) 12%), var(--admin-surface))",
    border: "1px dashed var(--admin-border)",
    borderRadius: 14,
    padding: 40,
    textAlign: "center",
    color: "var(--admin-muted)",
    fontSize: 14,
    boxShadow: "var(--admin-shadow)",
  },
};

function normalizeRole(user: AdminUserDto): AdminRole {
  const direct = String(user.role ?? "").replace(/^ROLE_/, "");
  if (isAdminRole(direct)) return direct;
  if (user.roles?.some((role) => role === "ROLE_ADMIN" || role === "ADMIN")) return "ADMIN";
  return "STAFF";
}

function normalizeUser(user: AdminUserDto): StaffUser {
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const isActive = user.enabled ?? user.active ?? true;
  const name = user.name ?? fullName;

  return {
    id: String(user.id ?? user.email ?? crypto.randomUUID()),
    name: name || user.email || "Unnamed user",
    email: user.email ?? "—",
    role: normalizeRole(user),
    status: isActive ? "Active" : "Disabled",
    createdAt: user.createdAt ?? user.updatedAt,
  };
}

async function listAdminUsers(): Promise<StaffUser[]> {
  const res = await adminFetch("/api/v1/admin/users?size=100");
  if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
  const data = (await res.json()) as PageResponse<AdminUserDto> | AdminUserDto[];
  const rows = Array.isArray(data) ? data : data.content ?? [];
  return rows.map(normalizeUser);
}

function AdminStaffPage() {
  const { user } = useAdminAuth();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!can(user?.role, "staff:manage")) return;
    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const rows = await listAdminUsers();
        if (!cancelled) setUsers(rows);
      } catch (err) {
        if (!cancelled) {
          setUsers([]);
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, user?.role]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users ?? [];
    return (users ?? []).filter((row) =>
      [row.name, row.email, row.role, row.status].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query, users]);

  if (!can(user?.role, "staff:manage")) {
    return (
      <AdminLayout title="Staff">
        <Forbidden resource="staff management" />
      </AdminLayout>
    );
  }
  return (
    <AdminLayout title="Staff" actionLabel="Refresh" onAction={() => setReloadKey((key) => key + 1)} onReload={() => setReloadKey((key) => key + 1)}>
      <div style={styles.toolbar} data-admin-toolbar>
        <input
          style={styles.search}
          data-admin-search-input
          placeholder="Search by name, email, role or status…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span style={styles.count}>{users ? `${filtered.length} of ${users.length}` : "Loading…"}</span>
      </div>

      {error ? (
        <div style={styles.empty}>{error}</div>
      ) : users === null ? (
        <div style={styles.empty}>Loading staff users…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>{query ? "No users match that search." : "No staff users found."}</div>
      ) : (
        <div data-admin-table-scroll>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td style={styles.td}>
                  <div style={styles.primary}>{row.name}</div>
                  <div style={styles.secondary}>{row.email}</div>
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: row.role === "ADMIN" ? "color-mix(in oklab, var(--admin-clay) 24%, var(--admin-surface))" : "var(--admin-border)",
                      color: row.role === "ADMIN" ? "var(--admin-clay)" : "var(--admin-muted)",
                    }}
                  >
                    {row.role}
                  </span>
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: row.status === "Active" ? "color-mix(in oklab, var(--admin-accent) 34%, var(--admin-surface))" : "color-mix(in oklab, var(--admin-clay) 18%, var(--admin-bg))",
                      color: row.status === "Active" ? "var(--cream)" : "var(--admin-clay)",
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={styles.td}>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminStaffPage;

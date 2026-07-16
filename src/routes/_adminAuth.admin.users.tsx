
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { adminResources, type RoleDto, type UserDto } from "@/services/adminResources";



interface UserForm {
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roleId: string;
}

const emptyForm: UserForm = { email: "", firstName: "", lastName: "", enabled: true, roleId: "" };

function AdminUsersPage() {
  const { user, hasPermission } = useAuth();
  const canView = hasPermission(PERM.USER_VIEW) || hasPermission(PERM.USER_CREATE) || hasPermission(PERM.USER_MANAGE_ROLES);
  const canCreate = hasPermission(PERM.USER_CREATE) || hasPermission(PERM.USER_MANAGE_ROLES);
  const canDelete = hasPermission(PERM.USER_MANAGE_ROLES);
  const [rows, setRows] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [banner, setBanner] = useState<string | null>(null);
  const [showFirstVisit, setShowFirstVisit] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    const key = `users_page_seen_${user.id}`;
    try {
      if (!window.localStorage.getItem(key)) {
        setShowFirstVisit(true);
        window.localStorage.setItem(key, "1");
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const [users, roleList] = await Promise.all([
        adminResources.users.list().catch((err) => {
          console.error("Failed to load users", err);
          reportAdminError(err, "Failed to load users");
          return [] as UserDto[];
        }),
        adminResources.roles.list().catch(() => [] as RoleDto[]),
      ]);
      setRows(Array.isArray(users) ? users : []);
      setRoles(Array.isArray(roleList) ? roleList : []);
    } catch (err) {
      reportAdminError(err, "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canView) void load(); }, [canView]);

  if (!canView) return <AdminLayout title="Users"><Forbidden resource="user management" /></AdminLayout>;

  const begin = (row?: UserDto) => {
    setEditing(row ?? null);
    setForm(row ? {
      email: row.email ?? "",
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      enabled: row.enabled ?? true,
      roleId: row.staffRoleId ?? row.roleId ?? "",
    } : { ...emptyForm, roleId: roles[0]?.id ?? "" });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.roleId) {
      toast.error("Please select a staff role");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, staffRoleId: form.roleId, roleId: form.roleId };
      if (editing) {
        await adminResources.users.update(editing.id, body);
        toast.success("User updated");
      } else {
        await adminResources.users.create(body);
        setBanner(`Invite sent to ${form.email}. Account expires in 48 hours if not activated.`);
        toast.success("User created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetPwd = async (row: UserDto) => {
    if (!confirm(`A new temporary password will be sent to ${row.email}.`)) return;
    try {
      await adminResources.users.resetPassword(row.id);
      toast.success(`Reset email sent to ${row.email}`);
    } catch (err) {
      reportAdminError(err, "Reset failed");
    }
  };

  const remove = async (row: UserDto) => {
    if (row.id === user?.id || !confirm(`Delete ${row.email}?`)) return;
    setSaving(true);
    try {
      await adminResources.users.remove(row.id);
      toast.success("User deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Users" actionLabel={canCreate ? "New user" : undefined} onAction={canCreate ? () => begin() : undefined} onReload={load}>
      <div className="admin-page-stack">
        {showFirstVisit && (
          <div style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(59,130,246,0.10)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "var(--admin-text)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}>
            <span>
              <strong>New staff?</strong> Create their account here and they'll receive a temporary password by email.
              They'll be prompted to change it on first login.
            </span>
            <button className="admin-btn admin-btn-ghost" onClick={() => setShowFirstVisit(false)}>Got it</button>
          </div>
        )}
        {banner && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#166534",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}>
            <span>{banner}</span>
            <button className="admin-btn admin-btn-ghost" onClick={() => setBanner(null)}>Dismiss</button>
          </div>
        )}

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>Loading users…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5}><div className="admin-empty">No users yet.</div></td></tr>
              ) : rows.map((r) => (
                <tr key={r?.id ?? Math.random()}>
                  <td><b>{r?.email ?? "—"}</b></td>
                  <td>{[r?.firstName, r?.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{r?.staffRoleDisplay || r?.staffRoleName || r?.staffRole || "—"}</td>
                  <td>{r?.enabled ? "Enabled" : "Disabled"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {canCreate && (
                      <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                        <Pencil size={13} /> Edit
                      </button>
                    )}
                    <button className="admin-btn admin-btn-ghost" onClick={() => void resetPwd(r)}>
                      <KeyRound size={13} /> Reset Password
                    </button>
                    {canDelete && (
                      <button className="admin-btn admin-btn-danger" disabled={r.id === user?.id} onClick={() => void remove(r)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal" onSubmit={save}>
              <div className="admin-toolbar">
                <h2>{editing ? "Edit user" : "Create user"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">First name</span>
                  <input required className="admin-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </label>
                <label>
                  <span className="admin-label">Last name</span>
                  <input required className="admin-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </label>
                <label>
                  <span className="admin-label">Email</span>
                  <input required type="email" className="admin-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
                </label>
                <label>
                  <span className="admin-label">Role</span>
                  <select required className="admin-select" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                    <option value="" disabled>Select a role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.displayName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="admin-label">Enabled</span>
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                </label>
              </div>
              <div className="admin-toolbar">
                <button className="admin-btn admin-btn-primary" disabled={saving || !form.roleId}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save user
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminUsersPage;

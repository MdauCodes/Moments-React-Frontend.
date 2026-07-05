
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM, PERMISSION_GROUPS } from "@/lib/permissions";
import { adminResources, type RoleDto } from "@/services/adminResources";



interface RoleForm {
  name: string;
  displayName: string;
  description: string;
  permissions: Set<string>;
}


function emptyForm(): RoleForm {
  return { name: "", displayName: "", description: "", permissions: new Set() };
}

function toRoleName(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function AdminRolesPage() {
  const { user, hasPermission } = useAuth();
  const allowed = hasPermission(PERM.USER_MANAGE_ROLES);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDto | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showFirstVisit, setShowFirstVisit] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    const key = `roles_page_seen_${user.id}`;
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
      setRoles(await adminResources.roles.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  if (!allowed) return <AdminLayout title="Roles"><Forbidden resource="role management" /></AdminLayout>;

  const begin = (row?: RoleDto) => {
    setEditing(row ?? null);
    setForm(row
      ? { name: row.name ?? "", displayName: row.displayName, description: row.description ?? "", permissions: new Set(row.permissions ?? []) }
      : emptyForm());

    setOpen(true);
  };

  const togglePerm = (code: string) => {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...f, permissions: next };
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {

      const displayName = form.displayName.trim();
      const name = (form.name.trim() || toRoleName(displayName));
      if (!name) { toast.error("Role name is required"); setSaving(false); return; }
      const body = {
        name,
        displayName,
        description: form.description.trim() || undefined,
        permissions: Array.from(form.permissions),
      };
      if (editing) await adminResources.roles.update(editing.id, body);
      else await adminResources.roles.create(body);

      toast.success(editing ? "Role updated" : "Role created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: RoleDto) => {
    if (!confirm(`Delete role "${row.displayName}"?`)) return;
    try {
      await adminResources.roles.remove(row.id);
      toast.success("Role deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <AdminLayout title="Roles" actionLabel="Create custom role" onAction={() => begin()} onReload={load}>
      <div className="admin-page-stack">
        {showFirstVisit && (
          <div style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.35)",
            color: "var(--admin-text)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}>
            <span>
              <strong>Default roles are locked</strong> to protect system integrity. Create custom roles for specific needs.
            </span>
            <button className="admin-btn admin-btn-ghost" onClick={() => setShowFirstVisit(false)}>Got it</button>
          </div>
        )}
        {loading ? (
          <div className="admin-panel" style={{ padding: 24 }}>Loading roles…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }} data-admin-grid>
            {roles.map((r) => {
              const isSystem = !!r.isSystem || !!r.isDefault;
              return (
                <div key={r.id} className="admin-panel" style={{ padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                      {isSystem && <Lock size={13} style={{ color: "var(--admin-muted)" }} />}
                      {r.displayName}
                    </h3>
                    <div style={{ display: "flex", gap: 4 }}>
                      {!isSystem && (
                        <>
                          <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                            <Pencil size={13} />
                          </button>
                          <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {r.description && (
                    <p style={{ fontSize: 12, color: "var(--admin-muted)", margin: "8px 0" }}>{r.description}</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {(r.permissions ?? []).map((p) => (
                      <span key={p} className="admin-badge admin-badge-muted" style={{ fontSize: 10 }}>{p}</span>
                    ))}
                    {(r.permissions ?? []).length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>No permissions</span>
                    )}
                  </div>
                </div>
              );
            })}
            {roles.length === 0 && (
              <div className="admin-panel" style={{ padding: 24 }}>
                <p style={{ marginBottom: 8 }}>No roles yet.</p>
                <button className="admin-btn admin-btn-primary" onClick={() => begin()}>
                  <Plus size={14} /> Create custom role
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={save} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-toolbar">
              <h2>{editing ? "Edit role" : "Create custom role"}</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="admin-form-grid">
              <label>
                <span className="admin-label">Display name</span>
                <input
                  required
                  className="admin-input"
                  value={form.displayName}
                  onChange={(e) => {
                    const dn = e.target.value;
                    setForm((f) => ({
                      ...f,
                      displayName: dn,
                      // Auto-fill the role name from displayName until the user edits it manually or we're editing an existing role.
                      name: editing ? f.name : toRoleName(dn),
                    }));
                  }}
                />
              </label>
              <label>
                <span className="admin-label">Role name (system identifier)</span>
                <input
                  required
                  className="admin-input"
                  value={form.name}
                  disabled={!!editing}
                  placeholder="e.g. CUSTOM_ROLE"
                  pattern="[A-Z0-9_]+"
                  title="Uppercase letters, digits and underscores only"
                  onChange={(e) => setForm({ ...form, name: toRoleName(e.target.value) })}
                />
                <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                  Uppercase identifier sent to the backend. Cannot be changed after creation.
                </span>
              </label>

              <label>
                <span className="admin-label">Description</span>
                <textarea className="admin-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="admin-label">Permissions</div>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--admin-muted)", marginBottom: 6 }}>
                    {group.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                    {group.perms.map((p) => (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--admin-border)" }}>
                        <input
                          type="checkbox"
                          checked={form.permissions.has(p)}
                          onChange={() => togglePerm(p)}
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-toolbar" style={{ marginTop: 16 }}>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save role
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminRolesPage;

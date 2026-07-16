
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type IndustryDto } from "@/services/adminResources";


const empty = { name: "", description: "", iconUrl: "" };
function AdminIndustriesPage() {
  const { isAdmin } = useAuth(); const [rows, setRows] = useState<IndustryDto[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<IndustryDto | null>(null); const [form, setForm] = useState(empty);
  const load = async () => { setLoading(true); try { setRows(await adminResources.industries.list()); } catch (err) { reportAdminError(err, "Failed to load industries"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const begin = (row?: IndustryDto) => { setEditing(row ?? null); setForm(row ? { name: row.name, description: row.description ?? "", iconUrl: row.iconUrl ?? "" } : empty); setOpen(true); };
  const save = async (e: FormEvent) => { e.preventDefault(); setSaving(true); try { editing ? await adminResources.industries.update(editing.id, form) : await adminResources.industries.create(form); toast.success(editing ? "Industry updated" : "Industry created"); setOpen(false); await load(); } catch (err) { reportAdminError(err, "Save failed"); } finally { setSaving(false); } };
  const remove = async (row: IndustryDto) => { if (!isAdmin || !confirm(`Delete ${row.name}?`)) return; setSaving(true); try { await adminResources.industries.remove(row.id); toast.success("Industry deleted"); await load(); } catch (err) { reportAdminError(err, "Delete failed"); } finally { setSaving(false); } };
  return <AdminLayout title="Industries" actionLabel="New industry" onAction={() => begin()} onReload={load}><div className="admin-page-stack"><div className="admin-panel" data-admin-table-scroll><table className="admin-table"><thead><tr><th>Name</th><th>Slug</th><th>Description</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={4}>Loading industries…</td></tr> : rows.length === 0 ? <tr><td colSpan={4}><div className="admin-empty">No industries yet. <button className="admin-btn admin-btn-primary" onClick={() => begin()}>Create industry</button></div></td></tr> : rows.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.slug ?? "—"}</td><td>{r.description ?? "—"}</td><td><button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}><Pencil size={14} />Edit</button>{isAdmin && <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}><Trash2 size={14} />Delete</button>}</td></tr>)}</tbody></table></div>{open && <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={save}><div className="admin-toolbar"><h2>{editing ? "Edit industry" : "Create industry"}</h2><button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button></div><div className="admin-form-grid"><label><span className="admin-label">Name</span><input required className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span className="admin-label">Icon URL</span><input className="admin-input" value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} /></label><label style={{ gridColumn: "1/-1" }}><span className="admin-label">Description</span><textarea className="admin-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></div><div className="admin-toolbar"><button className="admin-btn admin-btn-primary" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />}Save</button></div></form></div>}</div></AdminLayout>;
}

export default AdminIndustriesPage;

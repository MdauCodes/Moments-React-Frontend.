import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { formatDate } from "@/components/admin/commerceUi";
import { adminResources, type ChangelogEntryDto, type ChangelogCategory } from "@/services/adminResources";

type FormState = {
  title: string;
  summary: string;
  category: ChangelogCategory;
  author: string;
};

const empty: FormState = { title: "", summary: "", category: "FEATURE", author: "" };

const CATEGORY_LABEL: Record<ChangelogCategory, string> = {
  FEATURE: "Feature",
  IMPROVEMENT: "Improvement",
  FIX: "Fix",
  SECURITY: "Security",
};

const CATEGORY_TONE: Record<ChangelogCategory, { bg: string; fg: string }> = {
  FEATURE: { bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8" },
  IMPROVEMENT: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
  FIX: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207" },
  SECURITY: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" },
};

// Internal, admin-only accountability log of what shipped and why — not a customer-facing
// "what's new" feed. Kept up to date as part of shipping each refactor/feature, not as an
// afterthought.
function AdminChangelogPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ChangelogEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntryDto | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.changelog.list());
    } catch (err) {
      reportAdminError(err, "Failed to load changelog");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  function begin(row?: ChangelogEntryDto) {
    setEditing(row ?? null);
    setForm(
      row
        ? { title: row.title, summary: row.summary, category: row.category, author: row.author ?? "" }
        : empty,
    );
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        category: form.category,
        author: form.author.trim() || undefined,
      };
      if (editing) {
        await adminResources.changelog.update(editing.id, body);
        toast.success("Entry updated");
      } else {
        await adminResources.changelog.create(body);
        toast.success("Entry added");
      }
      setOpen(false);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ChangelogEntryDto) {
    if (!isAdmin || !confirm(`Delete "${row.title}"?`)) return;
    setSaving(true);
    try {
      await adminResources.changelog.remove(row.id);
      toast.success("Entry deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Changelog" actionLabel="New entry" onAction={() => begin()} onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          Internal record of what shipped and why — visible to staff only, not shown to customers.
          Add an entry here whenever a refactor or feature ships.
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Title</th>
                <th>Summary</th>
                <th>By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="admin-empty">Loading changelog…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><div className="admin-empty">No entries yet. <button className="admin-btn admin-btn-primary" onClick={() => begin()}>Add the first one</button></div></td></tr>
              ) : (
                rows.map((r) => {
                  const tone = CATEGORY_TONE[r.category];
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: tone.bg, color: tone.fg,
                        }}>{CATEGORY_LABEL[r.category]}</span>
                      </td>
                      <td><b>{r.title}</b></td>
                      <td style={{ maxWidth: 420 }}>{r.summary}</td>
                      <td>{r.author || "—"}</td>
                      <td>
                        <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                          <Pencil size={14} />Edit
                        </button>
                        {isAdmin && (
                          <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}>
                            <Trash2 size={14} />Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal" onSubmit={save}>
              <div className="admin-toolbar">
                <h2>{editing ? "Edit entry" : "New entry"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">Title</span>
                  <input
                    required
                    className="admin-input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Needs Attention analytics tab"
                  />
                </label>
                <label>
                  <span className="admin-label">Category</span>
                  <select
                    className="admin-input"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as ChangelogCategory })}
                  >
                    {(Object.keys(CATEGORY_LABEL) as ChangelogCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                    ))}
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="admin-label">Summary</span>
                  <textarea
                    required
                    className="admin-input"
                    rows={3}
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="What changed and why, in a couple of sentences."
                  />
                </label>
                <label>
                  <span className="admin-label">By (optional)</span>
                  <input
                    className="admin-input"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="e.g. Claude, or a staff name"
                  />
                </label>
              </div>
              <div className="admin-toolbar">
                <button className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}Save
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminChangelogPage;

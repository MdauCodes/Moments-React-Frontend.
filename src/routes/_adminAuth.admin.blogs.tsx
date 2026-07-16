
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type BlogDto, type BlogRequest } from "@/services/adminResources";


const emptyBlog: BlogRequest = { title: "", excerpt: "", template: "educative", coverImageUrl: "", coverImageAlt: "", coverImageCaption: "", secondaryImageUrl: "", body: { type: "doc", content: [] }, author: "Moments Packaging", tags: [] };
const templates = ["educative", "explanatory", "scenario", "storyline", "announcement"];
function split(v: string) { return v.split(",").map((x) => x.trim()).filter(Boolean); }

function BlogModal({ initial, saving, onClose, onSave }: { initial: BlogDto | null; saving: boolean; onClose: () => void; onSave: (body: BlogRequest) => void }) {
  const [form, setForm] = useState<BlogRequest>(initial ? { title: initial.title, excerpt: initial.excerpt ?? "", template: initial.template ?? "educative", coverImageUrl: initial.coverImageUrl ?? "", coverImageAlt: initial.coverImageAlt ?? "", coverImageCaption: initial.coverImageCaption ?? "", secondaryImageUrl: initial.secondaryImageUrl ?? "", body: initial.body ?? { type: "doc", content: [] }, author: initial.author ?? "", tags: initial.tags ?? [] } : emptyBlog);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const editor = useEditor({ extensions: [StarterKit], content: form.body as object, immediatelyRender: false, onUpdate: ({ editor }) => setForm((f) => ({ ...f, body: editor.getJSON() })) });
  const submit = (e: FormEvent) => { e.preventDefault(); onSave({ ...form, tags: split(tags) }); };
  return <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={submit}><div className="admin-toolbar"><h2>{initial ? "Edit blog" : "Create blog"}</h2><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button></div><div className="admin-form-grid" data-admin-editor-grid>
    <label><span className="admin-label">Title</span><input required className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
    <label><span className="admin-label">Template</span><select className="admin-select" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>{templates.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
    <label><span className="admin-label">Author</span><input className="admin-input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
    <label><span className="admin-label">Tags</span><input className="admin-input" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
    <label style={{ gridColumn: "1/-1" }}><span className="admin-label">Excerpt</span><textarea className="admin-textarea" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></label>
    <ImageUploader label="Cover image" entity="blogs" value={form.coverImageUrl} onChange={(url) => setForm({ ...form, coverImageUrl: url })} />
    <label><span className="admin-label">Cover alt</span><input className="admin-input" value={form.coverImageAlt} onChange={(e) => setForm({ ...form, coverImageAlt: e.target.value })} /></label>
    <label style={{ gridColumn: "1/-1" }}><span className="admin-label">Body</span><div className="admin-tiptap"><EditorContent editor={editor} /></div></label>
  </div><div className="admin-toolbar"><button className="admin-btn admin-btn-primary" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />}Save blog</button></div></form></div>;
}

function AdminBlogsPage() {
  const { isAdmin } = useAuth();
  const [blogs, setBlogs] = useState<BlogDto[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [editing, setEditing] = useState<BlogDto | null>(null); const [open, setOpen] = useState(false);
  const load = async () => { setLoading(true); try { setBlogs(await adminResources.blogs.list({ limit: 100 })); } catch (err) { reportAdminError(err, "Failed to load blogs"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (body: BlogRequest) => { setSaving(true); try { editing ? await adminResources.blogs.update(editing.id, body) : await adminResources.blogs.create(body); toast.success(editing ? "Blog updated" : "Blog created"); setOpen(false); await load(); } catch (err) { reportAdminError(err, "Save failed"); } finally { setSaving(false); } };
  const toggle = async (b: BlogDto) => { setSaving(true); try { b.status === "PUBLISHED" ? await adminResources.blogs.unpublish(b.id) : await adminResources.blogs.publish(b.id); toast.success("Blog status updated"); await load(); } catch (err) { reportAdminError(err, "Status update failed"); } finally { setSaving(false); } };
  const remove = async (b: BlogDto) => { if (!isAdmin || !confirm(`Delete ${b.title}?`)) return; setSaving(true); try { await adminResources.blogs.remove(b.id); toast.success("Blog deleted"); await load(); } catch (err) { reportAdminError(err, "Delete failed"); } finally { setSaving(false); } };
  return <AdminLayout title="Blogs" actionLabel="New blog" onAction={() => { setEditing(null); setOpen(true); }}><div className="admin-page-stack"><div className="admin-panel" data-admin-table-scroll><table className="admin-table"><thead><tr><th>Title</th><th>Status</th><th>Author</th><th>Published</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Loading blogs…</td></tr> : blogs.length === 0 ? <tr><td colSpan={5}><div className="admin-empty">No blogs yet. <button className="admin-btn admin-btn-primary" onClick={() => setOpen(true)}>Create blog</button></div></td></tr> : blogs.map((b) => <tr key={b.id}><td><b>{b.title}</b><div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{b.excerpt}</div></td><td><span className={`admin-badge ${b.status === "PUBLISHED" ? "admin-badge-ok" : "admin-badge-muted"}`}>{b.status ?? "DRAFT"}</span></td><td>{b.author || "—"}</td><td>{b.publishedAt ? new Date(b.publishedAt).toLocaleDateString("en-KE") : "—"}</td><td><button className="admin-btn admin-btn-ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil size={14} />Edit</button><button className="admin-btn admin-btn-ghost" disabled={saving} onClick={() => void toggle(b)}>{b.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>{isAdmin && <button className="admin-btn admin-btn-danger" onClick={() => void remove(b)}><Trash2 size={14} />Delete</button>}</td></tr>)}</tbody></table></div>{open && <BlogModal initial={editing} saving={saving} onClose={() => setOpen(false)} onSave={save} />}</div></AdminLayout>;
}

export default AdminBlogsPage;

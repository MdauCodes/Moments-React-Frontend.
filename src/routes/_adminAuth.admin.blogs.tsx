import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type BlogDto } from "@/services/adminResources";

// List + status/delete actions only. Create and edit happen on the dedicated
// /admin/blogs/new and /admin/blogs/:id routes, which use the structured
// per-template BlogEditor — the same {template,data} body shape the public
// blog renders. (This page used to carry an in-page TipTap editor that wrote a
// {type:"doc"} body the public site couldn't render — removed.)
function AdminBlogsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<BlogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setBlogs(await adminResources.blogs.list({ limit: 100 }));
    } catch (err) {
      reportAdminError(err, "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const toggle = async (b: BlogDto) => {
    setBusy(true);
    try {
      if (b.status === "PUBLISHED") await adminResources.blogs.unpublish(b.id);
      else await adminResources.blogs.publish(b.id);
      toast.success("Blog status updated");
      await load();
    } catch (err) {
      reportAdminError(err, "Status update failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: BlogDto) => {
    if (!isAdmin || !confirm(`Delete ${b.title}?`)) return;
    setBusy(true);
    try {
      await adminResources.blogs.remove(b.id);
      toast.success("Blog deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Blogs" actionLabel="New blog" onAction={() => navigate("/admin/blogs/new")} onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Author</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading blogs…</td>
                </tr>
              ) : blogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="admin-empty">
                      No blogs yet.{" "}
                      <button className="admin-btn admin-btn-primary" onClick={() => navigate("/admin/blogs/new")}>
                        Create blog
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                blogs.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <b>{b.title}</b>
                      <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{b.excerpt}</div>
                    </td>
                    <td>
                      <span className={`admin-badge ${b.status === "PUBLISHED" ? "admin-badge-ok" : "admin-badge-muted"}`}>
                        {b.status ?? "DRAFT"}
                      </span>
                    </td>
                    <td>{b.author || "—"}</td>
                    <td>{b.publishedAt ? new Date(b.publishedAt).toLocaleDateString("en-KE") : "—"}</td>
                    <td>
                      <button className="admin-btn admin-btn-ghost" onClick={() => navigate(`/admin/blogs/${b.id}`)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button className="admin-btn admin-btn-ghost" disabled={busy} onClick={() => void toggle(b)}>
                        {b.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      {isAdmin && (
                        <button className="admin-btn admin-btn-danger" onClick={() => void remove(b)}>
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminBlogsPage;

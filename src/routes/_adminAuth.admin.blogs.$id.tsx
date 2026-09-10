import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import { BlogEditor, blogRequestFromForm, formValuesFromDto } from "@/components/admin/BlogEditor";
import { adminResources, type BlogDto } from "@/services/adminResources";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { can } from "@/lib/permissions";

export default function EditBlogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [blog, setBlog] = useState<BlogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    // No single-blog admin GET — fetch the list and pick this id out of it.
    adminResources.blogs
      .list({ limit: 200 })
      .then((all) => {
        if (cancelled) return;
        const found = all.find((b) => b.id === id) ?? null;
        if (!found) {
          navigate("/admin/blogs", { replace: true });
          return;
        }
        setBlog(found);
        setLoading(false);
      })
      .catch((err) => {
        reportAdminError(err, "Failed to load blog");
        navigate("/admin/blogs", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, reloadKey]);

  if (loading || !blog) {
    return (
      <AdminLayout title="Loading…">
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-8 w-1/3 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </AdminLayout>
    );
  }

  const canDelete = can(user?.role, "blog:delete");

  return (
    <AdminLayout title={`Edit: ${blog.title}`} onReload={() => setReloadKey((k) => k + 1)}>
      <BlogEditor
        key={reloadKey}
        initial={formValuesFromDto(blog)}
        submitLabel="Save & publish"
        onCancel={() => navigate("/admin/blogs")}
        onDelete={
          canDelete
            ? async () => {
                if (!confirm("Delete this blog permanently?")) return;
                try {
                  await adminResources.blogs.remove(blog.id);
                  toast.success("Blog deleted");
                  navigate("/admin/blogs");
                } catch (err) {
                  reportAdminError(err, "Delete failed");
                }
              }
            : undefined
        }
        onSubmit={async (values) => {
          try {
            await adminResources.blogs.update(blog.id, blogRequestFromForm(values));
            const wasPublished = blog.status === "PUBLISHED";
            if (values.status === "published" && !wasPublished) {
              await adminResources.blogs.publish(blog.id);
            } else if (values.status === "draft" && wasPublished) {
              await adminResources.blogs.unpublish(blog.id);
            }
            toast.success("Blog saved");
            navigate("/admin/blogs");
          } catch (err) {
            reportAdminError(err, "Save failed");
          }
        }}
      />
    </AdminLayout>
  );
}

import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { BlogEditor, blogToFormValues } from "@/components/admin/BlogEditor";
import { blogStore } from "@/services/blogStore";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { can } from "@/lib/permissions";
import type { Blog } from "@/data/blogs";

export default function EditBlogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    blogStore.getById(id).then((b) => {
      if (!b) { navigate("/admin/blogs", { replace: true }); return; }
      setBlog(b);
      setLoading(false);
    }).catch(() => navigate("/admin/blogs", { replace: true }));
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
        initial={blogToFormValues(blog)}
        submitLabel="Save & publish"
        onCancel={() => navigate("/admin/blogs")}
        onDelete={canDelete
          ? async () => {
              if (!confirm("Delete this blog permanently?")) return;
              await blogStore.remove(blog.id);
              navigate("/admin/blogs");
            }
          : undefined}
        onSubmit={async (values) => {
          await blogStore.update(blog.id, values);
          navigate("/admin/blogs");
        }}
      />
    </AdminLayout>
  );
}

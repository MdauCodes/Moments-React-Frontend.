import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import { BlogEditor, blogRequestFromForm, emptyFormValues } from "@/components/admin/BlogEditor";
import { adminResources } from "@/services/adminResources";

function NewBlogPage() {
  const navigate = useNavigate();
  return (
    <AdminLayout title="New blog">
      <BlogEditor
        initial={emptyFormValues()}
        submitLabel="Publish"
        onCancel={() => navigate("/admin/blogs")}
        onSubmit={async (values) => {
          try {
            const created = await adminResources.blogs.create(blogRequestFromForm(values));
            if (values.status === "published") {
              await adminResources.blogs.publish(created.id);
            }
            toast.success(values.status === "published" ? "Blog published" : "Draft saved");
            navigate("/admin/blogs");
          } catch (err) {
            reportAdminError(err, "Failed to save blog");
          }
        }}
      />
    </AdminLayout>
  );
}

export default NewBlogPage;

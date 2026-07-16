import { useRef, useState, type CSSProperties } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources } from "@/services/adminResources";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const styles: Record<string, CSSProperties> = {
  wrap: { display: "grid", gap: 8 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--admin-muted)" },
  box: { border: "1px dashed var(--admin-border)", borderRadius: 12, background: "var(--admin-bg)", padding: 12, display: "flex", alignItems: "center", gap: 12 },
  preview: { width: 70, height: 54, objectFit: "cover", borderRadius: 8, border: "1px solid var(--admin-border)", background: "var(--admin-surface)" },
  button: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  remove: { border: "none", background: "transparent", color: "var(--admin-clay)", cursor: "pointer", padding: 4 },
  hint: { fontSize: 11, color: "var(--admin-muted)" },
};

export function ImageUploader({ label, value, entity, onChange }: { label: string; value?: string; entity: "products" | "blogs" | "general"; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type) || file.size > MAX_FILE_SIZE) {
      toast.error("Only JPEG, PNG or WebP under 5MB allowed");
      return;
    }
    setLoading(true);
    try {
      const uploaded = await adminResources.uploadImage(file, entity);
      onChange(uploaded.url);
      toast.success("Image uploaded");
    } catch (err) {
      reportAdminError(err, "Image upload failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.label}>{label}</div>
      <div style={styles.box}>
        {value ? <img src={value} alt="Uploaded preview" style={styles.preview} /> : <div style={{ ...styles.preview, display: "grid", placeItems: "center", color: "var(--admin-muted)" }}><ImagePlus size={18} /></div>}
        <div style={{ flex: 1 }}>
          <button type="button" style={styles.button} onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {value ? "Replace image" : "Upload image"}
          </button>
          <div style={styles.hint}>JPEG, PNG or WebP · max 5MB</div>
        </div>
        {value && <button type="button" aria-label="Remove image" style={styles.remove} onClick={() => onChange("")}><X size={15} /></button>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}

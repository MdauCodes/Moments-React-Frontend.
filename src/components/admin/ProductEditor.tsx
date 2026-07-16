import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { adminJson } from "@/services/adminApi";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type SegmentDto,
  type CategoryDto,
  type SubcategoryDto,
  type IndustryDto,
  type TagDto,
} from "@/services/adminResources";
import { api } from "@/services/api";
import type { Product, ProductTag } from "@/data/products";
import { categories } from "@/data/products";
import { fetchPublicUoms, adminCreateUom, type Uom } from "@/services/uomService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductVariant {
  id?: string;
  label: string;
  sku?: string;
  price?: number;
  stock?: number;
}

export interface PricingTierRow {
  id?: string;
  collectionName: string;
  quantity: number;
  pricePerUnit: number;
  sortOrder?: number;
  uomId?: string;
  uomDescription?: string;
  enabled?: boolean;
}

export interface ProductFormValues {
  name: string;
  slug: string;
  category: string;
  description: string;
  moq: number;
  sizes: string[];
  tags: ProductTag[];
  image: string;
  images: string[];
  isDiscount: boolean;
  discountPercent?: number;
  isNewArrival: boolean;
  isFastMoving: boolean;
  industryIds: string[]; // stored as strings client-side; sent as UUIDs to backend
  tagIds: string[];
  subcategoryId?: string | null;
  totalClicks: number;
  monthlyClicks: number;
  totalEnquiries: number;
  monthlyEnquiries: number;
  material?: string;
  finish?: string;
  keywords?: string[];
  sku?: string;
  basePrice?: number;
  compareAtPrice?: number;
  stock?: number;
  lowStockThreshold?: number;
  trackInventory?: boolean;
  variants?: ProductVariant[];
  individualSalesEnabled?: boolean;
  pricingTiers?: PricingTierRow[];
  vatRate?: number;     // stored as 0..1 fraction (e.g. 0.16)
  vatExempt?: boolean;
  stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
}


export function emptyProductValues(): ProductFormValues {
  return {
    name: "",
    slug: "",
    category: categories[0]?.slug ?? "bags",
    description: "",
    moq: 100,
    sizes: [],
    tags: [],
    image: "",
    images: [],
    isDiscount: false,
    discountPercent: undefined,
    isNewArrival: false,
    isFastMoving: false,
    industryIds: [],
    tagIds: [],
    subcategoryId: null,
    totalClicks: 0,
    monthlyClicks: 0,
    totalEnquiries: 0,
    monthlyEnquiries: 0,
    material: "",
    finish: "",
    keywords: [],
    sku: "",
    basePrice: undefined,
    compareAtPrice: undefined,
    stock: 0,
    lowStockThreshold: 10,
    trackInventory: true,
    variants: [],
    individualSalesEnabled: true,
    pricingTiers: [],
    vatRate: 0.16,
    vatExempt: false,
    stockStatus: "MADE_TO_ORDER",
  };
}


export function productToFormValues(p: Product): ProductFormValues {
  const anyP = p as any;
  return {
    name: p.name,
    slug: p.slug,
    category: p.category,
    description: p.description,
    moq: p.moq,
    sizes: [...(p.sizes ?? [])],
    tags: [...(p.tags ?? [])],
    image: (p as any).image ?? (p as any).primaryImageUrl ?? (p as any).imageUrls?.[0] ?? (p as any).images?.[0] ?? "",
    images: [...((p as any).images ?? (p as any).imageUrls ?? [])],
    isDiscount: p.isDiscount,
    discountPercent: p.discountPercent,
    isNewArrival: p.isNewArrival,
    isFastMoving: p.isFastMoving,
    industryIds: [...(p.industryIds ?? [])],
    tagIds: [...(anyP.curatedTagIds ?? [])],
    subcategoryId: anyP.subcategoryId ?? null,
    totalClicks: p.totalClicks,
    monthlyClicks: p.monthlyClicks,
    totalEnquiries: p.totalEnquiries,
    monthlyEnquiries: p.monthlyEnquiries,
    material: p.material ?? "",
    finish: p.finish ?? "",
    keywords: p.keywords ? [...p.keywords] : [],
    sku: anyP.sku ?? "",
    basePrice: p.basePrice,
    compareAtPrice: anyP.compareAtPrice,
    stock: anyP.stockCount ?? anyP.stock ?? 0,
    lowStockThreshold: anyP.lowStockThreshold ?? 10,
    trackInventory: anyP.trackInventory ?? (anyP.stockStatus ? anyP.stockStatus !== "MADE_TO_ORDER" : true),
    variants: anyP.variants ? [...anyP.variants] : [],
    individualSalesEnabled: anyP.individualSalesEnabled ?? true,
    pricingTiers: (anyP.pricingTiers ?? [])
      .filter((t: any) => t && t.collectionName)
      .map((t: any, i: number) => ({
        id: t.id,
        collectionName: String(t.uomName ?? t.collectionName ?? ""),
        quantity: Number(t.quantity ?? 0),
        pricePerUnit: Number(t.pricePerUnit ?? 0),
        sortOrder: t.sortOrder ?? i,
        uomId: t.uomId ? String(t.uomId) : undefined,
        uomDescription: t.uomDescription ?? "",
        enabled: t.enabled !== false,
      })),
    vatRate: typeof anyP.vatRate === "number" ? anyP.vatRate : 0.16,
    vatExempt: anyP.vatExempt ?? false,
    stockStatus: anyP.stockStatus ?? "MADE_TO_ORDER",
  };
}



// ---------------------------------------------------------------------------
// Backend payload builder — resolves string industry IDs to UUIDs via the
// industries data map, so the Spring backend receives proper UUID strings.
// ---------------------------------------------------------------------------

function buildCreateRequest(values: ProductFormValues, productId?: string) {
  // Backend ignores client-supplied slug (generated server-side from name).
  const imageUrls = values.images.length ? values.images : values.image ? [values.image] : [];

  // Resolve client-side industry string IDs → UUID strings (backend is List<UUID>)
  const industryIds = values.industryIds.filter(Boolean);

  const pricingTiers = (values.pricingTiers ?? [])
    .filter((t) => t && typeof t.collectionName === "string" && t.collectionName.trim() && t.quantity > 0 && t.pricePerUnit > 0)
    .map((t, i) => ({
      // only include id if it's a real UUID, not our "tier-N" client placeholder
      ...(t.id && /^[0-9a-f-]{36}$/i.test(t.id) ? { id: t.id } : {}),
      collectionName: t.collectionName,
      quantity: t.quantity,
      pricePerUnit: t.pricePerUnit,
      collectionPrice: t.quantity * t.pricePerUnit,
      sortOrder: t.sortOrder ?? i,
      ...(t.uomId ? { uomId: t.uomId } : {}),
      ...(t.uomDescription ? { uomDescription: t.uomDescription } : {}),
      enabled: t.enabled !== false,
    }));


  return {
    ...(productId ? { id: productId } : {}),
    name: values.name,
    category: values.category,
    description: values.description,
    moq: values.moq,
    sizes: values.sizes,
    tags: values.tags,
    keywords: values.keywords?.length ? values.keywords : [],
    primaryImageUrl: values.image || undefined,   // backend field name
    imageUrls,                                     // backend field name
    isDiscount: values.isDiscount,
    discountPercent: values.isDiscount ? values.discountPercent : undefined,
    isNewArrival: values.isNewArrival,
    isFastMoving: values.isFastMoving,
    industryIds,
    tagIds: values.tagIds ?? [],
    subcategoryId: values.subcategoryId || undefined,
    material: values.material || undefined,
    finish: values.finish || undefined,
    basePrice: values.basePrice ?? undefined,
    compareAtPrice: values.compareAtPrice && values.basePrice && values.compareAtPrice > values.basePrice
      ? values.compareAtPrice
      : null,
    stockCount: values.trackInventory ? (values.stock ?? 0) : undefined,   // backend field name
    lowStockThreshold: values.trackInventory ? (values.lowStockThreshold ?? 10) : undefined,
    individualSalesEnabled: values.individualSalesEnabled ?? true,
    pricingTiers,
    stockStatus: values.stockStatus ?? "MADE_TO_ORDER",
    vatExempt: values.vatExempt ?? false,
    vatRate: values.vatExempt ? 0 : (typeof values.vatRate === "number" ? values.vatRate : 0.16),

    // fields not in ProductCreateRequest/ProductUpdateRequest — intentionally omitted:
    // sku, trackInventory, variants, totalClicks, monthlyClicks, totalEnquiries, monthlyEnquiries
  };
}

// ---------------------------------------------------------------------------
// Admin API helpers — POST to create, PUT to update
// ---------------------------------------------------------------------------

export async function createProductApi(values: ProductFormValues): Promise<Product> {
  return adminJson<Product>("/api/v1/admin/products", {
    method: "POST",
    body: JSON.stringify(buildCreateRequest(values)),
  });
}

export async function updateProductApi(id: string, values: ProductFormValues): Promise<Product> {
  return adminJson<Product>(`/api/v1/admin/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(buildCreateRequest(values, id)),
  });
}

export async function deleteProductApi(id: string): Promise<void> {
  await adminJson<void>(`/api/v1/admin/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugifyDraft(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function validateProduct(values: ProductFormValues, isNew: boolean): string[] {
  const issues: string[] = [];
  if (!values.name.trim()) issues.push("Product name is required.");
  // Image/description completeness is only enforced when creating a new product.
  // An existing product that was already saved without one (e.g. bulk-imported)
  // must still be editable for unrelated fields — like classification — without
  // being forced to backfill catalogue details it's always been missing.
  if (isNew && !values.image) issues.push("Add a product image.");
  // Category/Subcategory/Industries/Tags are no longer set here — classification
  // happens on the Classify Products page, so a new product is valid unclassified.
  if (isNew && !values.description.trim()) issues.push("Add a short catalogue description.");
  if (values.moq < 1) issues.push("MOQ must be at least 1.");
  if (values.isDiscount && (!values.discountPercent || values.discountPercent <= 0))
    issues.push("Set a discount percentage when Discounted is on.");
  if (values.isDiscount && values.discountPercent && values.discountPercent > 90)
    issues.push("Discount percentage must be 90% or lower.");
  return issues;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 900,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  row: { display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" },
  row3: { display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr 1fr" },
  col: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--admin-muted)" },
  helper: { fontSize: 11, color: "var(--admin-muted)" },
  input: {
    background: "color-mix(in oklab,var(--admin-bg) 82%,var(--admin-surface) 18%)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--admin-text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  textarea: {
    background: "color-mix(in oklab,var(--admin-bg) 82%,var(--admin-surface) 18%)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "var(--admin-text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    minHeight: 90,
  },
  select: {
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--admin-text)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  card: {
    background:
      "linear-gradient(180deg,color-mix(in oklab,var(--admin-surface) 92%,var(--cream) 8%),var(--admin-surface))",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "var(--admin-shadow)",
  },
  cardHd: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: {
    fontSize: 18,
    fontWeight: 650,
    color: "var(--admin-text)",
    fontFamily: "var(--font-display)",
    letterSpacing: 0,
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  imgPreview: {
    width: "100%",
    maxWidth: 280,
    aspectRatio: "4/3",
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    objectFit: "cover" as const,
  },
  imgPlaceholder: {
    width: "100%",
    maxWidth: 280,
    aspectRatio: "4/3",
    background: "var(--admin-bg)",
    border: "1px dashed var(--admin-border)",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--admin-muted)",
    fontSize: 12,
  },
  previewCard: {
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "var(--admin-shadow)",
  },
  previewImg: { width: "100%", aspectRatio: "4/3", objectFit: "cover" as const, background: "var(--admin-bg)" },
  previewBody: { padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  previewTitle: {
    color: "var(--admin-text)",
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 650,
    lineHeight: 1.1,
    margin: 0,
  },
  previewMeta: { color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" },
  previewDesc: { color: "var(--admin-muted)", fontSize: 12.5, lineHeight: 1.55, margin: 0 },
  fileBtn: {
    background: "var(--admin-border)",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-text)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  ghostBtn: {
    background: "transparent",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-muted)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 11.5,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  primaryBtn: {
    background: "var(--admin-accent)",
    color: "var(--cream)",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 12.5,
    fontWeight: 650,
    cursor: "pointer",
    fontFamily: "var(--font-display)",
  },
  dangerBtn: {
    background: "color-mix(in oklab,var(--admin-clay) 22%,var(--admin-bg))",
    color: "var(--admin-clay)",
    border: "1px solid var(--admin-clay)",
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 12.5,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  actionsBar: { display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 6 },
  actionsRight: { display: "flex", gap: 10, marginLeft: "auto" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--admin-border)",
    border: "1px solid var(--admin-border)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    color: "var(--admin-text)",
  },
  removeX: {
    background: "transparent",
    border: "none",
    color: "var(--admin-clay)",
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    lineHeight: 1,
  },
  inlineRow: { display: "flex", gap: 8, alignItems: "center" },
  errorText: { fontSize: 12, color: "var(--admin-clay)" },
  validationList: { margin: 0, paddingLeft: 18, color: "var(--admin-clay)", fontSize: 12, lineHeight: 1.7 },
  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "color-mix(in oklab,var(--admin-bg) 74%,var(--admin-surface) 26%)",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
  },
  switchLabel: { fontSize: 12.5, color: "var(--admin-text)", flex: 1 },
  divider: { borderTop: "1px solid var(--admin-border)", paddingTop: 14, marginTop: 4 },
  unsupportedBadge: {
    display: "inline-block",
    fontSize: 9.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--admin-muted)",
    background: "color-mix(in oklab,var(--admin-border) 60%,transparent)",
    border: "1px solid var(--admin-border)",
    borderRadius: 999,
    padding: "1px 7px",
    marginLeft: 8,
    verticalAlign: "middle",
  },
};

const disabledColStyle: CSSProperties = { opacity: 0.5, pointerEvents: "none" };
const disabledInputStyle: CSSProperties = { background: "transparent", color: "var(--admin-muted)", cursor: "not-allowed" };

const requiredStar: CSSProperties = {
  color: "var(--admin-clay)",
  marginLeft: 4,
  fontWeight: 700,
};
function reqLabel(text: string) {
  return (
    <>
      {text}
      <span style={requiredStar} aria-hidden="true">*</span>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        (required)
      </span>
    </>
  );
}
function invalidStyle(isInvalid: boolean): CSSProperties {
  return isInvalid
    ? { borderColor: "var(--admin-clay)", boxShadow: "0 0 0 3px color-mix(in oklab,var(--admin-clay) 18%,transparent)" }
    : {};
}


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImagePicker({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (url: string) => void;
  invalid?: boolean;
}) {
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Staged file (not yet uploaded) — preview shown locally first.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  // Revoke object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Basic client-side validation before previewing
    const MAX_BYTES = 5 * 1024 * 1024;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setUploadError("Only JPEG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("Image is larger than 5 MB.");
      return;
    }

    setUploadError(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const cancelPending = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setUploadError(null);
  };

  const uploadPending = async () => {
    if (!pendingFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      const result = await adminResources.uploadImage(pendingFile, "products");
      onChange(result.url);
      cancelPending();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // What to show in the preview area: pending (local) takes precedence over uploaded value.
  const previewSrc = pendingPreviewUrl ?? value;
  const showInvalid = invalid && !previewSrc;

  const previewBoxStyle: CSSProperties = {
    ...s.imgPreview,
    ...(pendingPreviewUrl ? { outline: "2px dashed var(--admin-accent)", outlineOffset: 2 } : {}),
  };
  const placeholderStyle: CSSProperties = {
    ...s.imgPlaceholder,
    ...(showInvalid ? { borderColor: "var(--admin-clay)", color: "var(--admin-clay)" } : {}),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {previewSrc ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={previewSrc} alt="Product preview" style={previewBoxStyle} />
          {pendingPreviewUrl && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "var(--admin-accent)",
                color: "var(--cream)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              Preview — not yet uploaded
            </span>
          )}
          {uploading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                color: "var(--cream)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Uploading…
            </div>
          )}
        </div>
      ) : (
        <div style={placeholderStyle}>{uploading ? "Uploading…" : "No image yet"}</div>
      )}

      {/* Pending file action bar */}
      {pendingFile && (
        <div style={{ ...s.inlineRow, gap: 8 }}>
          <button
            type="button"
            style={{ ...s.primaryBtn, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}
            onClick={uploadPending}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload to server"}
          </button>
          <button type="button" style={s.ghostBtn} onClick={cancelPending} disabled={uploading}>
            Cancel
          </button>
          <span style={s.helper}>
            {pendingFile.name} · {(pendingFile.size / 1024).toFixed(0)} KB
          </span>
        </div>
      )}

      <div style={s.inlineRow}>
        <label style={{ ...s.fileBtn, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
          {pendingFile ? "Choose a different file" : "Choose file"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
        {value && !pendingFile && !uploading && (
          <button type="button" style={s.ghostBtn} onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      <div style={s.inlineRow}>
        <input
          style={{ ...s.input, flex: 1 }}
          placeholder="…or paste an image URL"
          value={urlDraft}
          onChange={(e) => {
            setUrlDraft(e.target.value);
            setUploadError(null);
          }}
        />
        <button
          type="button"
          style={s.ghostBtn}
          onClick={() => {
            const url = urlDraft.trim();
            if (!url) return;
            onChange(url);
            setUrlDraft("");
          }}
        >
          Use URL
        </button>
      </div>
      {uploadError && <div style={{ ...s.helper, color: "var(--admin-clay)" }}>{uploadError}</div>}
      {showInvalid && !uploadError && (
        <div style={{ ...s.helper, color: "var(--admin-clay)", fontWeight: 600 }}>
          A product image is required.
        </div>
      )}
      <div style={s.helper}>
        JPEG, PNG or WebP · max 5 MB. Choose a file to preview it first, then click <strong>Upload to server</strong> to send it to the backend.
      </div>
    </div>
  );
}

function TokenInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={s.inlineRow}>
        <input
          style={{ ...s.input, flex: 1 }}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" style={s.ghostBtn} onClick={commit}>
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div style={s.chipRow}>
          {values.map((v) => (
            <span key={v} style={s.badge}>
              {v}
              <button
                type="button"
                style={s.removeX}
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export interface ProductEditorProps {
  initial: ProductFormValues;
  productId?: string; // undefined = create, set = update
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onCancel: () => void;
}

/** Top-level expand/collapse group — Product Details / Image / Classification. */
function CollapsibleSection({
  title,
  subtitle,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={s.card}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...s.cardHd, width: "100%", background: "transparent", border: 0, cursor: "pointer", padding: 0, textAlign: "left" }}
      >
        <div>
          <div style={s.cardTitle}>{title}</div>
          {subtitle && <span style={s.helper}>{subtitle}</span>}
        </div>
        <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
      </button>
      {open && <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>}
    </div>
  );
}

// Scoped per product (or "new" for the create form) so an in-progress edit
// survives navigating away to another admin tab, as long as the submit
// button was never hit. sessionStorage (not localStorage) so it clears
// itself once the browser tab actually closes, rather than lingering
// indefinitely as a stale, confusing draft.
function draftKeyFor(productId?: string): string {
  return `admin-product-draft:${productId ?? "new"}`;
}

export function ProductEditor({ initial, productId, submitLabel, onSubmit, onDelete, onCancel }: ProductEditorProps) {
  const draftKey = draftKeyFor(productId);

  const [values, setValues] = useState<ProductFormValues>(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) return { ...initial, ...JSON.parse(raw) };
    } catch {
      // corrupt/blocked storage — fall through to a clean form
    }
    return initial;
  });
  const [draftRestored, setDraftRestored] = useState(() => {
    try {
      return !!sessionStorage.getItem(draftKey);
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [showUomDialog, setShowUomDialog] = useState(false);
  const [priceModes, setPriceModes] = useState<Record<number, "perUnit" | "total">>({});

  const loadUoms = () => fetchPublicUoms().then(setUoms).catch(() => {});
  useEffect(() => {
    loadUoms();
  }, []);

  // --- Classification (Subcategory / Industries / Tags) ---
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [classifyCategories, setClassifyCategories] = useState<CategoryDto[]>([]);
  const [classifySubcategories, setClassifySubcategories] = useState<SubcategoryDto[]>([]);
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  useEffect(() => {
    adminResources.segments.list().then(setSegments).catch(() => undefined);
    adminResources.industries.list().then(setIndustries).catch(() => undefined);
    adminResources.tags.list().then(setTags).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedSegmentId) { setClassifyCategories([]); return; }
    adminResources.categories.list(selectedSegmentId).then(setClassifyCategories).catch(() => undefined);
  }, [selectedSegmentId]);

  useEffect(() => {
    if (!selectedCategoryId) { setClassifySubcategories([]); return; }
    adminResources.subcategories.list(selectedCategoryId).then(setClassifySubcategories).catch(() => undefined);
  }, [selectedCategoryId]);

  // Restore the Segment/Category selection for an already-classified product on load.
  useEffect(() => {
    if (!values.subcategoryId) return;
    adminResources.subcategories.list().then((all) => {
      const match = all.find((sub) => sub.id === values.subcategoryId);
      if (match) {
        setSelectedCategoryId(match.categoryId);
        setSelectedSegmentId(match.segmentId ?? "");
      }
    }).catch(() => undefined);
    // Only ever restore from the initially-loaded product, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleIndustry = (id: string) =>
    setValues((v) => ({
      ...v,
      industryIds: v.industryIds.includes(id) ? v.industryIds.filter((x) => x !== id) : [...v.industryIds, id],
    }));

  const toggleTag = (id: string) =>
    setValues((v) => ({
      ...v,
      tagIds: (v.tagIds ?? []).includes(id) ? (v.tagIds ?? []).filter((x) => x !== id) : [...(v.tagIds ?? []), id],
    }));

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [initial, values]);
  const validationIssues = useMemo(() => validateProduct(values, !productId), [values, productId]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Auto-save the draft so navigating to another admin tab and back restores
  // it — AdminLayout fully remounts this page on every route change, so
  // component state alone doesn't survive that, only storage does.
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        // storage full/blocked — draft persistence just silently stops working
      }
    }, 400);
    return () => clearTimeout(t);
  }, [values, isDirty, draftKey]);

  const discardDraft = () => {
    try { sessionStorage.removeItem(draftKey); } catch {}
    setValues(initial);
    setDraftRestored(false);
  };

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitted(true);
    if (validationIssues.length) {
      setError("Please resolve the highlighted fields before saving.");
      return;
    }
    setBusy(true);
    try {
      const images = values.images.length ? values.images : [values.image];
      await onSubmit({ ...values, slug: values.slug || slugifyDraft(values.name), images });
      try { sessionStorage.removeItem(draftKey); } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
      reportAdminError(err, productId ? "Save product changes" : "Create product");
    } finally {
      setBusy(false);
    }
  };

  const variants = values.variants ?? [];
  const pricingTiers = values.pricingTiers ?? [];

  return (
    <form style={s.wrap} onSubmit={handleSubmit}>
      <style>{`
        @media (max-width: 860px) {
          [data-admin-row] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          [data-tier-row], [data-tier-header] { grid-template-columns: 1fr !important; }
          [data-tier-header] { display: none !important; }
          [data-tier-row] { padding: 10px; border: 1px solid var(--admin-border); border-radius: 10px; background: color-mix(in oklab,var(--admin-bg) 60%,var(--admin-surface) 40%); }
          [data-tier-row] [data-tier-cell]::before { content: attr(data-label); display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--admin-muted); margin-bottom: 4px; }
          [data-variant-row] { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      {draftRestored && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: "color-mix(in oklab, var(--admin-accent) 12%, var(--admin-surface))",
            border: "1px solid color-mix(in oklab, var(--admin-accent) 40%, var(--admin-border))",
            borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "var(--admin-text)",
          }}
        >
          <span>
            <strong>Unsaved changes restored</strong> — picked up where you left off before navigating away.
          </span>
          <button
            type="button"
            onClick={discardDraft}
            style={{ background: "transparent", border: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--admin-accent)", whiteSpace: "nowrap" }}
          >
            Discard &amp; start fresh
          </button>
        </div>
      )}
      {productId && (() => {
        const noImage = !values.image;
        const noPrice = !values.basePrice || values.basePrice <= 0;
        const tiers = values.pricingTiers ?? [];
        const allTiersZero = tiers.length === 0 || tiers.every((t) => !t || !((Number(t.pricePerUnit) || 0) > 0));
        if (!noImage && !noPrice && !allTiersZero) return null;
        return (
          <div
            style={{
              gridColumn: "1 / -1",
              background: "color-mix(in oklab, #f59e0b 14%, var(--admin-surface))",
              border: "1px solid color-mix(in oklab, #f59e0b 50%, var(--admin-border))",
              color: "var(--admin-text)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12.5,
            }}
          >
            <strong style={{ color: "#92400e" }}>Incomplete product:</strong>{" "}
            This product is missing some details — add a price, image and pricing tiers to make it visible to customers.
          </div>
        );
      })()}
      <CollapsibleSection
        title="Product Details"
        subtitle="Name, description, pricing, inventory, variants, keywords, homepage flags"
        defaultOpen
      >
        {/* Core details */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div style={s.cardTitle}>Core details</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={s.row} data-admin-row>
              <div style={s.col}>
                <label style={s.label}>{reqLabel("Name")}</label>
                <input
                  style={{ ...s.input, ...invalidStyle(submitted && !values.name.trim()) }}
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Kraft Twisted-Handle Bag"
                  required
                  aria-required="true"
                  aria-invalid={submitted && !values.name.trim() ? true : undefined}
                />
                {submitted && !values.name.trim() && (
                  <span style={{ ...s.helper, color: "var(--admin-clay)" }}>Product name is required.</span>
                )}
              </div>
              <div style={s.col}>
                <label style={s.label}>URL slug</label>
                <input
                  style={s.input}
                  value={values.slug || slugifyDraft(values.name)}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto-generated"
                />
                <span style={s.helper}>Leave blank to auto-generate.</span>
              </div>
            </div>
            <div style={s.row} data-admin-row>
              <div style={s.col}>
                <label style={s.label}>{reqLabel("MOQ")}</label>
                <input
                  type="number"
                  min={1}
                  style={{ ...s.input, ...invalidStyle(submitted && values.moq < 1) }}
                  value={values.moq}
                  onChange={(e) => set("moq", Number(e.target.value) || 0)}
                  required
                  aria-required="true"
                  aria-invalid={submitted && values.moq < 1 ? true : undefined}
                />
                {submitted && values.moq < 1 ? (
                  <span style={{ ...s.helper, color: "var(--admin-clay)" }}>MOQ must be at least 1.</span>
                ) : (
                  <span style={s.helper}>Smallest quantity a customer can order in one go.</span>
                )}
              </div>
            </div>
            <div style={s.col}>
              <label style={s.label}>{reqLabel("Description")}</label>
              <textarea
                style={{ ...s.textarea, ...invalidStyle(submitted && !values.description.trim()) }}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Short product summary."
                required
                aria-required="true"
                aria-invalid={submitted && !values.description.trim() ? true : undefined}
              />
              {submitted && !values.description.trim() ? (
                <span style={{ ...s.helper, color: "var(--admin-clay)" }}>Description is required.</span>
              ) : (
                <span style={s.helper}>Shown on the product page — keep it short and specific (material, size, use case).</span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Inventory ─ single card, no broken nesting */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div style={s.cardTitle}>Pricing &amp; inventory</div>
            <span style={s.helper}>All prices in KES.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* SKU / base price / compare-at */}
            <div style={s.row3} data-admin-row>
              <div style={{ ...s.col, ...disabledColStyle }} title="Not yet supported by backend">
                <label style={s.label}>SKU<span style={s.unsupportedBadge}>Soon</span></label>
                <input
                  style={{ ...s.input, ...disabledInputStyle }}
                  value=""
                  disabled
                  placeholder="Not yet supported"
                />
              </div>
              <div style={s.col}>
                <label style={s.label}>Base price (KES)</label>
                <input
                  type="number"
                  min={0}
                  style={s.input}
                  value={values.basePrice ?? ""}
                  onChange={(e) => set("basePrice", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0"
                />
                <span style={s.helper}>The real, current selling price per unit.</span>
              </div>
              <div style={s.col}>
                <label style={s.label}>Compare-at price (KES)</label>
                <input
                  type="number"
                  min={0}
                  style={s.input}
                  value={values.compareAtPrice ?? ""}
                  onChange={(e) => set("compareAtPrice", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Original price (struck through)"
                />
                <span style={s.helper}>Shown struck-through when higher than base price.</span>
              </div>
            </div>

            {/* Stock status + VAT */}
            <div style={s.row} data-admin-row>
              <div style={s.col}>
                <label style={s.label}>Stock status</label>
                <select
                  style={s.select}
                  value={values.stockStatus ?? "MADE_TO_ORDER"}
                  onChange={(e) => {
                    const v = e.target.value as ProductFormValues["stockStatus"];
                    setValues((prev) => ({
                      ...prev,
                      stockStatus: v,
                      trackInventory: v !== "MADE_TO_ORDER",
                    }));
                  }}
                >
                  <option value="MADE_TO_ORDER">Made to order (no physical stock)</option>
                  <option value="IN_STOCK">In stock</option>
                  <option value="LOW_STOCK">Low stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                </select>
                <span style={s.helper}>"Made to order" hides the stock count from customers entirely.</span>
              </div>
              <div style={s.col}>
                <label style={s.label}>VAT</label>
                <label style={{ ...s.switchRow, marginTop: 0 }}>
                  <input
                    type="checkbox"
                    checked={values.vatExempt ?? false}
                    onChange={(e) => set("vatExempt", e.target.checked)}
                  />
                  <span style={s.switchLabel}>VAT exempt</span>
                  {!values.vatExempt && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      style={{ ...s.input, width: 90 }}
                      value={
                        typeof values.vatRate === "number"
                          ? Number((values.vatRate * 100).toFixed(2))
                          : ""
                      }
                      placeholder="16"
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        set("vatRate", isFinite(pct) ? pct / 100 : 0);
                      }}
                    />
                  )}
                  {!values.vatExempt && <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>%</span>}
                </label>
                <span style={s.helper}>Defaults to Kenya's standard 16% — only change if this specific product is zero-rated or exempt.</span>
              </div>
            </div>


            {/* Track inventory toggle */}
            <label style={s.switchRow}>
              <input
                type="checkbox"
                checked={values.trackInventory ?? true}
                onChange={(e) => set("trackInventory", e.target.checked)}
              />
              <span style={s.switchLabel}>Track inventory levels for this product</span>
            </label>
            <span style={{ ...s.helper, marginTop: -6 }}>
              Turn off for made-to-order or unlimited-supply items where a stock count doesn't make sense.
            </span>

            {(values.trackInventory ?? true) && (
              <div style={s.row} data-admin-row>
                <div style={s.col}>
                  <label style={s.label}>Stock on hand</label>
                  <input
                    type="number"
                    min={0}
                    style={s.input}
                    value={values.stock ?? 0}
                    onChange={(e) => set("stock", Number(e.target.value) || 0)}
                  />
                  <span style={s.helper}>Actual units currently available to sell.</span>
                </div>
                <div style={s.col}>
                  <label style={s.label}>Low-stock threshold</label>
                  <input
                    type="number"
                    min={0}
                    style={s.input}
                    value={values.lowStockThreshold ?? 10}
                    onChange={(e) => set("lowStockThreshold", Number(e.target.value) || 0)}
                  />
                  <span style={s.helper}>Alert when stock drops below this.</span>
                </div>
              </div>
            )}

            {/* Variants — not yet supported by backend */}
            <div style={{ ...s.col, ...disabledColStyle }} title="Not yet supported by backend">
              <label style={s.label}>Variants (size / material)<span style={s.unsupportedBadge}>Soon</span></label>
              <div style={{
                padding: "14px 16px",
                border: "1px dashed var(--admin-border)",
                borderRadius: 10,
                background: "color-mix(in oklab,var(--admin-bg) 70%,transparent)",
                color: "var(--admin-muted)",
                fontSize: 12,
              }}>
                Per-variant SKUs, pricing and stock will be available once the backend ships variant support. Use pricing tiers below for collection-based pricing in the meantime.
              </div>
            </div>

            {/* Pricing tiers — INSIDE the same card, separated by a divider */}
            <div style={s.divider}>
              <label style={s.switchRow}>
                <input
                  type="checkbox"
                  checked={values.individualSalesEnabled ?? true}
                  onChange={(e) => set("individualSalesEnabled", e.target.checked)}
                />
                <span style={s.switchLabel}>Allow individual unit purchases</span>
              </label>
              <span style={{ ...s.helper, marginTop: -6 }}>
                Off means customers must buy a full tier (Packet, Carton…) below — no single-unit checkout.
              </span>

              <div style={{ ...s.col, marginTop: 12 }}>
                <label style={s.label}>Pricing tiers (units of measure)</label>
                <span style={s.helper}>
                  Pick a UOM (Packet, Carton, Bale…), set how many pieces and the price per unit. Disabled tiers are hidden from the storefront.
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {pricingTiers.map((row, idx) => {
                    const total = (Number(row.quantity) || 0) * (Number(row.pricePerUnit) || 0);
                    const enabled = row.enabled !== false;
                    return (
                      <div
                        key={idx}
                        data-tier-row
                        style={{
                          border: "1px solid var(--admin-border)",
                          borderRadius: 8,
                          padding: 10,
                          background: enabled ? "transparent" : "rgba(0,0,0,0.03)",
                          opacity: enabled ? 1 : 0.7,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.4fr 0.7fr 1.6fr auto",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          <div data-tier-cell data-label="UOM">
                            <select
                              style={{ ...s.input, width: "100%" }}
                              value={row.uomId ?? ""}
                              onChange={(e) => {
                                const n = [...pricingTiers];
                                const selectedId = e.target.value;
                                const u = uoms.find((x) => x.id === selectedId);
                                n[idx] = {
                                  ...row,
                                  uomId: selectedId || undefined,
                                  collectionName: u?.name ?? row.collectionName,
                                  uomDescription: u?.description ?? row.uomDescription,
                                };
                                set("pricingTiers", n);
                              }}
                            >
                              <option value="">— Select UOM —</option>
                              {uoms.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div data-tier-cell data-label="Pieces / unit">
                            <input
                              type="number"
                              min={1}
                              style={{ ...s.input, width: "100%" }}
                              placeholder="25"
                              value={row.quantity || ""}
                              onChange={(e) => {
                                const n = [...pricingTiers];
                                n[idx] = { ...row, quantity: Number(e.target.value) || 0 };
                                set("pricingTiers", n);
                              }}
                            />
                          </div>
                          {(() => {
                            const mode = priceModes[idx] ?? "perUnit";
                            const qty = Number(row.quantity) || 0;
                            const perUnit = Number(row.pricePerUnit) || 0;
                            const totalVal = qty * perUnit;
                            const inputValue =
                              mode === "perUnit"
                                ? perUnit || ""
                                : totalVal || "";
                            const derivedLabel =
                              mode === "perUnit"
                                ? `Total: KES ${totalVal.toLocaleString()}`
                                : qty > 0 && perUnit
                                  ? `Per unit: KES ${perUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                                  : "Per unit: —";
                            return (
                              <div data-tier-cell data-label="Price (KES)">
                                <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                                  <div
                                    role="tablist"
                                    style={{
                                      display: "inline-flex",
                                      border: "1px solid var(--admin-border)",
                                      borderRadius: 6,
                                      overflow: "hidden",
                                      fontSize: 11,
                                    }}
                                  >
                                    {(["perUnit", "total"] as const).map((m) => {
                                      const active = mode === m;
                                      return (
                                        <button
                                          key={m}
                                          type="button"
                                          onClick={() =>
                                            setPriceModes((prev) => ({ ...prev, [idx]: m }))
                                          }
                                          style={{
                                            padding: "0 8px",
                                            background: active ? "var(--admin-accent)" : "transparent",
                                            color: active ? "var(--admin-accent-foreground, #fff)" : "var(--admin-muted)",
                                            border: "none",
                                            cursor: "pointer",
                                            fontWeight: active ? 600 : 400,
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {m === "perUnit" ? "Per unit" : "Total"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    style={{ ...s.input, flex: 1, minWidth: 0 }}
                                    placeholder={mode === "perUnit" ? "8.50" : "225"}
                                    value={inputValue}
                                    onChange={(e) => {
                                      const v = Number(e.target.value) || 0;
                                      const n = [...pricingTiers];
                                      if (mode === "perUnit") {
                                        n[idx] = { ...row, pricePerUnit: v };
                                      } else {
                                        const q = Number(row.quantity) || 0;
                                        n[idx] = {
                                          ...row,
                                          pricePerUnit: q > 0 ? v / q : 0,
                                        };
                                      }
                                      set("pricingTiers", n);
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 4 }}>
                                  {derivedLabel}
                                </div>
                              </div>
                            );
                          })()}
                          <button
                            type="button"
                            style={{ ...s.removeX, justifySelf: "end" }}
                            onClick={() => {
                              set(
                                "pricingTiers",
                                pricingTiers.filter((_, i) => i !== idx),
                              );
                              setPriceModes((prev) => {
                                const next: Record<number, "perUnit" | "total"> = {};
                                Object.entries(prev).forEach(([k, v]) => {
                                  const ki = Number(k);
                                  if (ki < idx) next[ki] = v;
                                  else if (ki > idx) next[ki - 1] = v;
                                });
                                return next;
                              });
                            }}
                            aria-label="Remove tier"
                          >
                            ×
                          </button>
                        </div>


                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                          <input
                            style={{ ...s.input, width: "100%" }}
                            placeholder="Short description (e.g. 25 pieces per packet)"
                            value={row.uomDescription ?? ""}
                            onChange={(e) => {
                              const n = [...pricingTiers];
                              n[idx] = { ...row, uomDescription: e.target.value };
                              set("pricingTiers", n);
                            }}
                          />
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => {
                                const n = [...pricingTiers];
                                n[idx] = { ...row, enabled: e.target.checked };
                                set("pricingTiers", n);
                              }}
                            />
                            Enabled
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={s.ghostBtn}
                      onClick={() =>
                        set("pricingTiers", [
                          ...pricingTiers,
                          {
                            collectionName: "",
                            quantity: 0,
                            pricePerUnit: 0,
                            sortOrder: pricingTiers.length,
                            enabled: true,
                          },
                        ])
                      }
                    >
                      + Add pricing tier
                    </button>
                    <button
                      type="button"
                      style={s.ghostBtn}
                      onClick={() => setShowUomDialog(true)}
                    >
                      Manage UOMs
                    </button>
                  </div>
                </div>
              </div>

              {showUomDialog && (
                <UomManagerDialog
                  uoms={uoms}
                  onClose={() => setShowUomDialog(false)}
                  onCreated={() => loadUoms()}
                />
              )}
            </div>
          </div>
        </div>

        {/* Variants & spec */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div style={s.cardTitle}>Variants &amp; spec</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={s.col}>
              <label style={s.label}>Available sizes</label>
              <TokenInput
                values={values.sizes}
                onChange={(next) => set("sizes", next)}
                placeholder="e.g. Small (200×100×250mm), 8oz…"
              />
              <span style={s.helper}>Press Enter after each size — shown as a picker on the product page.</span>
            </div>
            <div style={s.row} data-admin-row>
              <div style={s.col}>
                <label style={s.label}>Material</label>
                <input
                  style={s.input}
                  value={values.material ?? ""}
                  onChange={(e) => set("material", e.target.value)}
                  placeholder="e.g. Kraft 120gsm"
                />
                <span style={s.helper}>Optional — appears in the product spec, helps customers compare options.</span>
              </div>
              <div style={s.col}>
                <label style={s.label}>Finish</label>
                <input
                  style={s.input}
                  value={values.finish ?? ""}
                  onChange={(e) => set("finish", e.target.value)}
                  placeholder="e.g. Matte, Gloss"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search keywords — categorization (Subcategory/Industries) and display
            tags now live entirely on the Classify Products page, not here. */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div style={s.cardTitle}>Search keywords</div>
          </div>
          <div style={s.col}>
            <TokenInput
              values={values.keywords ?? []}
              onChange={(next) => set("keywords", next)}
              placeholder="e.g. coffee, takeaway cup, kikombe"
            />
            <span style={s.helper}>Synonyms, sheng, misspellings — all boost search recall.</span>
          </div>
        </div>

        {/* Homepage flags */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <div style={s.cardTitle}>Homepage &amp; popularity</div>
            <span style={s.helper}>Drives "Picks of the moment".</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={s.switchRow}>
              <input
                type="checkbox"
                checked={values.isDiscount}
                onChange={(e) => set("isDiscount", e.target.checked)}
              />
              <span style={s.switchLabel}>Discounted (appears in "Deals")</span>
              {values.isDiscount && (
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={values.discountPercent ?? ""}
                  placeholder="%"
                  onChange={(e) => set("discountPercent", e.target.value ? Number(e.target.value) : undefined)}
                  style={{ ...s.input, width: 70 }}
                />
              )}
            </label>
            <label style={s.switchRow}>
              <input
                type="checkbox"
                checked={values.isNewArrival}
                onChange={(e) => set("isNewArrival", e.target.checked)}
              />
              <span style={s.switchLabel}>New arrival ("Just landed")</span>
            </label>
            <label style={s.switchRow}>
              <input
                type="checkbox"
                checked={values.isFastMoving}
                onChange={(e) => set("isFastMoving", e.target.checked)}
              />
              <span style={s.switchLabel}>Fast-moving ("Trending")</span>
            </label>
            <div style={s.row3} data-admin-row>
              <div style={{ ...s.col, ...disabledColStyle }} title="Read-only metric tracked automatically">
                <label style={s.label}>Monthly clicks<span style={s.unsupportedBadge}>Auto</span></label>
                <input type="number" disabled style={{ ...s.input, ...disabledInputStyle }} value={values.monthlyClicks} readOnly />
                <span style={s.helper}>Tracked automatically.</span>
              </div>
              <div style={{ ...s.col, ...disabledColStyle }} title="Read-only metric tracked automatically">
                <label style={s.label}>Total clicks<span style={s.unsupportedBadge}>Auto</span></label>
                <input type="number" disabled style={{ ...s.input, ...disabledInputStyle }} value={values.totalClicks} readOnly />
              </div>
              <div style={{ ...s.col, ...disabledColStyle }} title="Read-only metric tracked automatically">
                <label style={s.label}>Monthly enquiries<span style={s.unsupportedBadge}>Auto</span></label>
                <input type="number" disabled style={{ ...s.input, ...disabledInputStyle }} value={values.monthlyEnquiries} readOnly />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Product Image" subtitle="Primary photo shown on the storefront" defaultOpen={false}>
        <ImagePicker
          value={values.image}
          onChange={(url) => set("image", url)}
          invalid={submitted && !values.image}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Classification"
        subtitle="Subcategory, industries and tags — same data as Classify Products"
        defaultOpen={false}
      >
        <div style={s.row} data-admin-row>
          <div style={s.col}>
            <label style={s.label}>Segment</label>
            <select
              style={s.select}
              value={selectedSegmentId}
              onChange={(e) => { setSelectedSegmentId(e.target.value); setSelectedCategoryId(""); }}
            >
              <option value="">Select segment…</option>
              {segments.map((seg) => <option key={seg.id} value={seg.id}>{seg.name}</option>)}
            </select>
          </div>
          <div style={s.col}>
            <label style={s.label}>Category</label>
            <select
              style={s.select}
              value={selectedCategoryId}
              disabled={!selectedSegmentId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">Select category…</option>
              {classifyCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
        </div>
        <div style={s.col}>
          <label style={s.label}>Subcategory</label>
          <select
            style={s.select}
            value={values.subcategoryId ?? ""}
            disabled={!selectedCategoryId}
            onChange={(e) => set("subcategoryId", e.target.value || null)}
          >
            <option value="">Select subcategory…</option>
            {classifySubcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
          </select>
          <span style={s.helper}>Every product belongs to exactly one Subcategory — this fixes its Category and Segment.</span>
        </div>
        <div style={s.col}>
          <label style={s.label}>Industries</label>
          <span style={s.helper}>Who buys it — pick as many as apply. Drives the "What does your business do?" filter.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {industries.map((ind) => (
              <label key={ind.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid var(--admin-border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
                <input type="checkbox" checked={values.industryIds.includes(ind.id)} onChange={() => toggleIndustry(ind.id)} />
                {ind.name}
              </label>
            ))}
          </div>
        </div>
        <div style={s.col}>
          <label style={s.label}>Tags</label>
          <span style={s.helper}>Drives the "What do you need?" quick-find chips on the storefront.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {tags.length === 0 && <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>No tags yet — add one via Classify Products.</span>}
            {tags.map((tag) => (
              <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid var(--admin-border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
                <input type="checkbox" checked={(values.tagIds ?? []).includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                {tag.name}
              </label>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Live preview */}
        <div style={s.previewCard}>
          {values.image ? (
            <img src={values.image} alt="" style={s.previewImg} />
          ) : (
            <div style={{ ...s.imgPlaceholder, maxWidth: "none", borderRadius: 0 }}>Preview image</div>
          )}
          <div style={s.previewBody}>
            <div style={s.previewMeta}>
              MOQ {Math.max(values.moq, 0).toLocaleString()}
            </div>
            <h3 style={s.previewTitle}>{values.name || "Product name"}</h3>
            <p style={s.previewDesc}>{values.description || "Product description preview."}</p>
            <div style={s.chipRow}>
              {values.isNewArrival && <span style={s.badge}>New arrival</span>}
              {values.isFastMoving && <span style={s.badge}>Fast moving</span>}
              {values.isDiscount && <span style={s.badge}>-{values.discountPercent ?? 0}%</span>}
            </div>
          </div>
        </div>

        {/* Errors */}
        {(error || (submitted && validationIssues.length > 0)) && (
          <div style={s.errorText}>
            {error && <div>{error}</div>}
            {submitted && validationIssues.length > 0 && (
              <ul style={s.validationList}>
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={s.actionsBar}>
          {onDelete && (
            <button type="button" style={s.dangerBtn} onClick={() => void onDelete()} disabled={busy}>
              Delete product
            </button>
          )}
          <div style={s.actionsRight}>
            <button
              type="button"
              style={s.ghostBtn}
              onClick={() => {
                if (isDirty && !confirm("Discard unsaved changes?")) return;
                try { sessionStorage.removeItem(draftKey); } catch {}
                onCancel();
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" style={s.primaryBtn} disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>
    </form>
  );
}

export default ProductEditor;

function UomManagerDialog({
  uoms,
  onClose,
  onCreated,
}: {
  uoms: Uom[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErr("Code and name are required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminCreateUom({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setCode("");
      setName("");
      setDescription("");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create UOM");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--admin-bg, white)",
          border: "1px solid var(--admin-border)",
          borderRadius: 10,
          maxWidth: 460,
          width: "100%",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Manage units of measure</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
            ×
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>
          {uoms.length === 0 ? "No UOMs defined yet." : `${uoms.length} UOM${uoms.length === 1 ? "" : "s"} available`}
        </div>
        {uoms.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 160, overflowY: "auto", fontSize: 13, border: "1px solid var(--admin-border)", borderRadius: 6 }}>
            {uoms.map((u) => (
              <li key={u.id} style={{ padding: "6px 10px", borderBottom: "1px solid var(--admin-border)" }}>
                <strong>{u.name}</strong> <span style={{ color: "var(--admin-muted)" }}>· {u.code}</span>
                {u.description && <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{u.description}</div>}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Add a new UOM</div>
          <input
            placeholder="Code (e.g. SACK)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--admin-border)", borderRadius: 6, fontSize: 13 }}
          />
          <input
            placeholder="Name (e.g. Sack)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--admin-border)", borderRadius: 6, fontSize: 13 }}
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--admin-border)", borderRadius: 6, fontSize: 13 }}
          />
          {err && <div style={{ fontSize: 12, color: "crimson" }}>{err}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "8px 14px",
              background: "var(--admin-primary, #1a472a)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Saving…" : "Add UOM"}
          </button>
        </form>
      </div>
    </div>
  );
}

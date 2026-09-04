import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { adminResources, type ProductDto } from "@/services/adminResources";
import { fetchPublicUoms, type Uom } from "@/services/uomService";
import { reportAdminError } from "@/lib/adminErrorToast";

/**
 * A deliberately narrow edit surface — price per unit, unit of measurement, and the product
 * photo — for the one thing staff actually do dozens of times a day and shouldn't need the full
 * product editor page for: correcting a price or swapping a photo. Everything else on the
 * product (description, tags, industries, additional tiers beyond the first, etc.) is untouched
 * here; that's still the full editor's job.
 * <p>
 * Only ever edits the FIRST pricing tier (sortOrder 0) if the product has tiers at all — any
 * other tiers are sent back unchanged, never dropped. A product with no tiers (individual sales
 * only) edits basePrice directly instead, with no UOM/quantity fields to show.
 */
export function QuickEditProductModal({
  productId,
  onClose,
  onSaved,
}: {
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [saving, setSaving] = useState(false);

  // Tiered-pricing fields — only meaningful when the loaded product actually has a first tier.
  const [uomId, setUomId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  // Non-tiered fallback.
  const [basePrice, setBasePrice] = useState("");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputCleanupRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [full, uomList] = await Promise.all([
          adminResources.products.get(productId),
          fetchPublicUoms(),
        ]);
        if (cancelled) return;
        setProduct(full);
        setUoms(uomList);
        const tiers = ((full as any).pricingTiers ?? []) as any[];
        const firstTier = tiers.length > 0
          ? [...tiers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
          : null;
        if (firstTier) {
          setUomId(firstTier.uomId ?? "");
          setQuantity(String(firstTier.quantity ?? ""));
          setPricePerUnit(String(firstTier.pricePerUnit ?? ""));
        } else {
          setBasePrice(full.basePrice != null ? String(full.basePrice) : "");
        }
      } catch (err) {
        reportAdminError(err, "Failed to load product");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    return () => {
      if (fileInputCleanupRef.current) URL.revokeObjectURL(fileInputCleanupRef.current);
    };
  }, []);

  const hasTier = !!product && (((product as any).pricingTiers ?? []) as any[]).length > 0;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (fileInputCleanupRef.current) URL.revokeObjectURL(fileInputCleanupRef.current);
    const url = URL.createObjectURL(file);
    fileInputCleanupRef.current = url;
    setPendingFile(file);
    setPreviewUrl(url);
    setUploadedUrl(null);
  }

  async function handleSave() {
    if (!product) return;
    setSaving(true);
    try {
      let newImageUrl: string | null = uploadedUrl;
      // A photo picked but never explicitly uploaded still gets uploaded here on Save — staff
      // shouldn't need to remember a separate upload step before the one Save button they came
      // for; see the button copy below, which says so.
      if (pendingFile && !newImageUrl) {
        setUploading(true);
        const result = await adminResources.uploadImage(pendingFile, "products");
        newImageUrl = result.url;
        setUploadedUrl(result.url);
        setUploading(false);
      }

      const body: Record<string, unknown> = {};

      if (hasTier) {
        const tiers = ((product as any).pricingTiers ?? []) as any[];
        const sorted = [...tiers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const [first, ...rest] = sorted;
        const selectedUom = uoms.find((u) => u.id === uomId);
        const updatedFirst = {
          ...first,
          uomId: uomId || undefined,
          collectionName: selectedUom?.name ?? first.collectionName,
          uomDescription: selectedUom?.description ?? first.uomDescription,
          quantity: Number(quantity) || 0,
          pricePerUnit: Number(pricePerUnit) || 0,
        };
        body.pricingTiers = [updatedFirst, ...rest];
      } else {
        body.basePrice = Number(basePrice) || 0;
      }

      if (newImageUrl) {
        const existingGallery = ((product as any).imageUrls ?? product.imageUrls ?? []) as string[];
        body.primaryImageUrl = newImageUrl;
        // New photo becomes primary (first) — existing gallery images are kept, not discarded,
        // same "add, don't replace the whole gallery" behavior as the full editor's "Add image".
        body.imageUrls = [newImageUrl, ...existingGallery.filter((u) => u !== newImageUrl)];
      }

      await adminResources.products.update(product.id, body as any);
      toast.success("Product updated");
      onSaved();
      onClose();
    } catch (err) {
      reportAdminError(err, "Failed to save changes");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const displayImage = previewUrl ?? product?.primaryImageUrl ?? product?.imageUrls?.[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "grid", placeItems: "center", zIndex: 200, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="admin-panel"
        style={{ width: "100%", maxWidth: 420, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>
            Quick edit{product ? ` — ${product.name}` : ""}
          </h3>
          <button onClick={onClose} aria-label="Close" className="admin-btn admin-btn-ghost" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="admin-empty">Loading…</div>
        ) : (
          <>
            {displayImage ? (
              <img
                src={displayImage}
                alt=""
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10 }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 10, background: "var(--admin-border)" }} />
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <label className="admin-btn admin-btn-ghost" style={{ flex: 1, justifyContent: "center", cursor: "pointer" }}>
                {pendingFile ? "Choose different" : "Add photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />
              </label>
              {/* capture="environment" opens the device's rear camera directly on mobile — same
                  pattern as the full editor's own "Take photo" button. */}
              <label className="admin-btn admin-btn-ghost" style={{ flex: 1, justifyContent: "center", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Camera size={14} />
                {pendingFile ? "Retake" : "Take photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
            {pendingFile && (
              <p className="admin-label" style={{ margin: 0 }}>
                {pendingFile.name} — will be uploaded when you save.
              </p>
            )}

            {hasTier ? (
              <>
                <label className="admin-label">
                  Unit of measurement
                  <select
                    className="admin-select"
                    style={{ width: "100%", marginTop: 4 }}
                    value={uomId}
                    onChange={(e) => setUomId(e.target.value)}
                  >
                    <option value="">— Select UOM —</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-label">
                  Pieces per unit
                  <input
                    type="number"
                    min={1}
                    className="admin-input"
                    style={{ width: "100%", marginTop: 4 }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label className="admin-label">
                  Price per piece (KES)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="admin-input"
                    style={{ width: "100%", marginTop: 4 }}
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                  />
                </label>
                {Number(quantity) > 0 && Number(pricePerUnit) > 0 && (
                  <p className="admin-label" style={{ margin: 0 }}>
                    = KES {(Number(quantity) * Number(pricePerUnit)).toLocaleString(undefined, { maximumFractionDigits: 2 })} total for {quantity} pcs
                  </p>
                )}
              </>
            ) : (
              <label className="admin-label">
                Price per unit (KES)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="admin-input"
                  style={{ width: "100%", marginTop: 4 }}
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </label>
            )}

            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
              style={{ justifyContent: "center", marginTop: 4 }}
            >
              {saving && <Loader2 size={14} className="mr-1 animate-spin inline" />}
              {uploading ? "Uploading photo…" : saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

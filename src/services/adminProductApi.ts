import { adminJson } from "@/services/adminApi";
import type { ProductFormValues } from "@/components/admin/ProductEditor";
import { industries } from "@/data/products";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function buildPayload(values: ProductFormValues, productId?: string) {
  const images = values.images.length ? values.images : values.image ? [values.image] : [];

  // industryIds MUST be UUID strings — backend field is List<UUID>.
  // Map client-side ids to canonical industry ids when possible.
  const industryIds = values.industryIds
    .map((clientId) => industries.find((i) => String(i.id) === String(clientId))?.id ?? clientId)
    .filter(Boolean);

  const pricingTiers = (values.pricingTiers ?? [])
    .filter((t) => t.collectionName.trim() && t.quantity > 0 && t.pricePerUnit > 0)
    .map((t, i) => ({
      // only send id if it looks like a real UUID (not "tier-N" placeholders)
      ...(t.id && /^[0-9a-f-]{36}$/i.test(t.id) ? { id: t.id } : {}),
      collectionName: t.collectionName,
      quantity: t.quantity,
      pricePerUnit: t.pricePerUnit,
      collectionPrice: t.quantity * t.pricePerUnit,
      sortOrder: t.sortOrder ?? i,
    }));

  return {
    ...(productId ? { id: productId } : {}),
    name: values.name,
    slug: values.slug || slugify(values.name),
    category: values.category,
    description: values.description,
    moq: values.moq,
    sizes: values.sizes,
    tags: values.tags,
    keywords: values.keywords?.length ? values.keywords : [],
    primaryImageUrl: values.image || undefined,
    imageUrls: images,
    isDiscount: values.isDiscount,
    discountPercent: values.isDiscount ? values.discountPercent : undefined,
    isNewArrival: values.isNewArrival,
    isFastMoving: values.isFastMoving,
    industryIds,
    tagIds: values.tagIds ?? [],
    subcategoryId: values.subcategoryId || undefined,
    // Explicit clear signal — without it, an empty subcategoryId reads as "no change"
    // server-side, so picking "Select subcategory…" back to blank would silently do nothing.
    clearSubcategory: !values.subcategoryId,
    material: values.material || undefined,
    finish: values.finish || undefined,
    basePrice: values.basePrice ?? null,
    originalBasePrice: values.compareAtPrice && values.basePrice && values.compareAtPrice > values.basePrice
      ? values.compareAtPrice
      : undefined,
    clearOriginalBasePrice: !values.compareAtPrice,
    stockCount: values.trackInventory ? values.stock ?? 0 : undefined,
    lowStockThreshold: values.trackInventory ? values.lowStockThreshold ?? 10 : undefined,
    individualSalesEnabled: values.individualSalesEnabled ?? true,
    pricingTiers,
    stockStatus: values.stockStatus ?? "MADE_TO_ORDER",
    vatExempt: values.vatExempt ?? false,
    vatRate: values.vatExempt ? 0 : (typeof values.vatRate === "number" ? values.vatRate : 0.16),
  };
}

export async function createProductApi(values: ProductFormValues) {
  return adminJson<{ id: string }>("/api/v1/admin/products", {
    method: "POST",
    body: JSON.stringify(buildPayload(values)),
  });
}

export async function updateProductApi(id: string, values: ProductFormValues) {
  return adminJson<{ id: string }>(`/api/v1/admin/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(buildPayload(values, id)),
  });
}

export async function deleteProductApi(id: string): Promise<void> {
  await adminJson<void>(`/api/v1/admin/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

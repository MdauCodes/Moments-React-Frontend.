import { adminJson } from "@/services/adminApi";

export type PageResponse<T> = { content?: T[]; totalElements?: number; totalPages?: number; number?: number; size?: number };
export type BackendRole = "ROLE_ADMIN" | "ROLE_STAFF";
export type EnquiryStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type BlogStatus = "DRAFT" | "PUBLISHED";

export type IndustryDto = { id: string; name: string; slug?: string; description?: string; iconUrl?: string };
export type BusinessAccountDto = {
  id: string; businessName: string; kraPin: string; location: string; road: string; buildingAddress: string;
  industryId?: string | null; industryName?: string | null; contactPersonName: string; contactPersonRole?: string | null;
  phone: string; status: "ACTIVE" | "SUSPENDED"; welcomeCode?: string | null; createdAt: string;
  orderCount?: number | null; totalSpend?: number | null;
};
export type PromoCodeDto = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  discountValue: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  active: boolean;
  /** Set only on an auto-issued Business Account welcome code — not admin-settable. */
  restrictedToUserId?: string | null;
};
export type TagDto = { id: string; name: string; slug?: string; description?: string };
export type SegmentDto = { id: string; name: string; slug?: string; description?: string; sortOrder?: number };
export type CategoryDto = { id: string; segmentId: string; segmentName?: string; name: string; slug?: string; description?: string; sortOrder?: number };
export type SubcategoryDto = { id: string; categoryId: string; categoryName?: string; segmentId?: string; segmentName?: string; name: string; slug?: string; description?: string; sortOrder?: number };
export type ProductDto = {
  id: string; name: string; slug?: string; category?: string; description?: string; moq?: number;
  sizes?: string[]; tags?: string[]; keywords?: string[]; primaryImageUrl?: string; imageUrls?: string[];
  isDiscount?: boolean; discountPercent?: number | null; isNewArrival?: boolean; isFastMoving?: boolean;
  material?: string; finish?: string; industryIds?: string[]; industries?: IndustryDto[]; monthlyClicks?: number; monthlyEnquiries?: number;
  sku?: string; basePrice?: number; compareAtPrice?: number; stock?: number; stockCount?: number; lowStockThreshold?: number; trackInventory?: boolean;
  stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
  vatRate?: number; vatExempt?: boolean;
  subcategoryId?: string | null; subcategoryName?: string | null; categoryName?: string | null; segmentName?: string | null;
  curatedTags?: TagDto[]; curatedTagIds?: string[]; tagIds?: string[];
  variants?: Array<{ id?: string; label: string; sku?: string; price?: number; stock?: number }>;
};
export type ProductRequest = Omit<ProductDto, "id" | "slug" | "industries" | "monthlyClicks" | "monthlyEnquiries" | "curatedTags" | "curatedTagIds">;
export type BulkClassifyRequest = { productIds: string[]; subcategoryId?: string; industryIds?: string[]; tagIds?: string[] };
export type BulkClassifyResponse = { updatedCount: number; productIds: string[] };


export type BlogDto = {
  id: string; title: string; slug?: string; excerpt?: string; template?: string; status?: BlogStatus | string;
  coverImageUrl?: string; coverImageAlt?: string; coverImageCaption?: string; secondaryImageUrl?: string;
  body?: unknown; author?: string; tags?: string[]; publishedAt?: string | null; createdAt?: string; updatedAt?: string;
};
export type BlogRequest = Omit<BlogDto, "id" | "slug" | "status" | "publishedAt" | "createdAt" | "updatedAt">;

export type EnquiryPipelineStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST" | "ARCHIVED";

export type EnquiryNote = {
  id?: string;
  authorId?: string;
  authorName?: string;
  message: string;
  createdAt?: string;
};

export type EnquiryDto = {
  id: string; referenceNumber?: string; reference?: string;
  status?: EnquiryStatus | EnquiryPipelineStatus;
  assignedTo?: string;
  assignedToId?: string;
  assignedToName?: string;
  /** Append-only internal notes thread. Backend may return either a string blob (legacy) or an array. */
  internalNotes?: string | EnquiryNote[];
  /** Scheduled follow-up date (ISO). */
  followUpAt?: string | null;
  firstContactedAt?: string | null;
  estimatedValue?: number | null;
  productInterest?: string | null;
  name?: string; email?: string; phone?: string; companyName?: string; message?: string; createdAt?: string;
  contact?: { name?: string; email?: string; phone?: string; company?: string }; products?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>>;
};

export type EnquiryPipelineSummary = Partial<Record<EnquiryPipelineStatus, number>> & Record<string, number>;

export type AuditLogEntry = {
  id: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  action?: string;
  reason?: string;
  /** JSON string from backend describing field changes. */
  changes?: string;
  ipAddress?: string;
  createdAt?: string;
};

export type MockModeState = { enabled: boolean; message?: string };

export type UserDto = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  roles?: BackendRole[];
  staffRole?: string;
  staffRoleId?: string;
  staffRoleName?: string;
  staffRoleDisplay?: string;
  permissions?: string[];
  isStaff?: boolean;
  mustChangePassword?: boolean;
  roleId?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type SettingDto = { id?: string; key: string; value: string; description?: string };
export type UploadResponse = { url: string; publicId: string };

export type RoleDto = {
  id: string;
  name?: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
  isSystem?: boolean;
};
export type RoleRequest = { name: string; displayName: string; description?: string; permissions: string[] };


function unwrap<T>(data: PageResponse<T> | T[]): { rows: T[]; total: number; totalPages: number } {
  if (Array.isArray(data)) return { rows: data, total: data.length, totalPages: 1 };
  const rows = data.content ?? [];
  return { rows, total: data.totalElements ?? rows.length, totalPages: data.totalPages ?? 1 };
}

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const adminResources = {
  uploadImage: (file: File, entity: "products" | "blogs" | "general") => {
    const form = new FormData();
    form.append("file", file);
    form.append("entity", entity);
    return adminJson<UploadResponse>("/api/v1/admin/uploads/image", { method: "POST", body: form });
  },
  industries: {
    list: () => adminJson<IndustryDto[]>("/api/v1/admin/industries"),
    create: (body: Partial<IndustryDto>) => adminJson<IndustryDto>("/api/v1/admin/industries", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<IndustryDto>) => adminJson<IndustryDto>(`/api/v1/admin/industries/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/industries/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  businessAccounts: {
    list: (params: { q?: string; page?: number; size?: number }) =>
      adminJson<PageResponse<BusinessAccountDto>>(`/api/v1/admin/business-accounts${qs(params)}`),
    get: (id: string) => adminJson<BusinessAccountDto>(`/api/v1/admin/business-accounts/${encodeURIComponent(id)}`),
    setStatus: (id: string, status: "ACTIVE" | "SUSPENDED") =>
      adminJson<BusinessAccountDto>(`/api/v1/admin/business-accounts/${encodeURIComponent(id)}/status${qs({ status })}`, { method: "PATCH" }),
  },
  promoCodes: {
    list: () => adminJson<PromoCodeDto[]>("/api/v1/admin/promo-codes"),
    create: (body: Partial<PromoCodeDto>) => adminJson<PromoCodeDto>("/api/v1/admin/promo-codes", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<PromoCodeDto>) => adminJson<PromoCodeDto>(`/api/v1/admin/promo-codes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/promo-codes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  tags: {
    list: () => adminJson<TagDto[]>("/api/v1/admin/tags"),
    create: (body: Partial<TagDto>) => adminJson<TagDto>("/api/v1/admin/tags", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<TagDto>) => adminJson<TagDto>(`/api/v1/admin/tags/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/tags/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  segments: {
    list: () => adminJson<SegmentDto[]>("/api/v1/admin/segments"),
    create: (body: Partial<SegmentDto>) => adminJson<SegmentDto>("/api/v1/admin/segments", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<SegmentDto>) => adminJson<SegmentDto>(`/api/v1/admin/segments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string, opts?: { reassignTo?: string; cascade?: boolean }) =>
      adminJson<void>(`/api/v1/admin/segments/${encodeURIComponent(id)}${qs({ reassignTo: opts?.reassignTo, cascade: opts?.cascade })}`, { method: "DELETE" }),
  },
  categories: {
    list: (segmentId?: string) => adminJson<CategoryDto[]>(`/api/v1/admin/categories${qs({ segmentId })}`),
    create: (body: { segmentId: string; name: string; description?: string; sortOrder?: number }) =>
      adminJson<CategoryDto>("/api/v1/admin/categories", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ segmentId: string; name: string; description?: string; sortOrder?: number }>) =>
      adminJson<CategoryDto>(`/api/v1/admin/categories/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string, opts?: { reassignTo?: string; cascade?: boolean }) =>
      adminJson<void>(`/api/v1/admin/categories/${encodeURIComponent(id)}${qs({ reassignTo: opts?.reassignTo, cascade: opts?.cascade })}`, { method: "DELETE" }),
  },
  subcategories: {
    list: (categoryId?: string) => adminJson<SubcategoryDto[]>(`/api/v1/admin/subcategories${qs({ categoryId })}`),
    create: (body: { categoryId: string; name: string; description?: string; sortOrder?: number }) =>
      adminJson<SubcategoryDto>("/api/v1/admin/subcategories", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ categoryId: string; name: string; description?: string; sortOrder?: number }>) =>
      adminJson<SubcategoryDto>(`/api/v1/admin/subcategories/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string, opts?: { reassignTo?: string; cascade?: boolean }) =>
      adminJson<void>(`/api/v1/admin/subcategories/${encodeURIComponent(id)}${qs({ reassignTo: opts?.reassignTo, cascade: opts?.cascade })}`, { method: "DELETE" }),
  },
  products: {
    list: async (params: Record<string, string | number | boolean | undefined>) => unwrap(await adminJson<PageResponse<ProductDto> | ProductDto[]>(`/api/v1/admin/products${qs(params)}`)),
    get: (id: string) => adminJson<ProductDto>(`/api/v1/admin/products/${encodeURIComponent(id)}`),
    create: (body: ProductRequest) => adminJson<ProductDto>("/api/v1/admin/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<ProductRequest>) => adminJson<ProductDto>(`/api/v1/admin/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
    bulkClassify: (body: BulkClassifyRequest) =>
      adminJson<BulkClassifyResponse>("/api/v1/admin/products/bulk-classify", { method: "PATCH", body: JSON.stringify(body) }),
  },
  inventory: {
    getLowStock: () => adminJson<ProductDto[]>("/api/v1/admin/products/inventory/low-stock"),
    getOutOfStock: () => adminJson<ProductDto[]>("/api/v1/admin/products/inventory/out-of-stock"),
    adjustStock: (id: string, body: { type: string; delta: number; reason?: string }) =>
      adminJson<ProductDto>(`/api/v1/admin/products/${encodeURIComponent(id)}/stock/adjust`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    setStock: (id: string, count: number, reason?: string) =>
      adminJson<ProductDto>(
        `/api/v1/admin/products/${encodeURIComponent(id)}/stock/set?count=${count}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`,
        { method: "PUT" },
      ),
  },

  blogs: {
    list: (params: Record<string, string | number | undefined> = {}) => adminJson<BlogDto[]>(`/api/v1/admin/blogs${qs(params)}`),
    create: (body: BlogRequest) => adminJson<BlogDto>("/api/v1/admin/blogs", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<BlogRequest>) => adminJson<BlogDto>(`/api/v1/admin/blogs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    publish: (id: string) => adminJson<BlogDto>(`/api/v1/admin/blogs/${encodeURIComponent(id)}/publish`, { method: "POST" }),
    unpublish: (id: string) => adminJson<BlogDto>(`/api/v1/admin/blogs/${encodeURIComponent(id)}/unpublish`, { method: "POST" }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/blogs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  enquiries: {
    list: async (params: Record<string, string | number | undefined>) => unwrap(await adminJson<PageResponse<EnquiryDto> | EnquiryDto[]>(`/api/v1/admin/enquiries${qs(params)}`)),
    update: (id: string, body: Partial<EnquiryDto> & { note?: string; addNote?: string }) =>
      adminJson<EnquiryDto>(`/api/v1/admin/enquiries/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    pipelineSummary: () => adminJson<EnquiryPipelineSummary>("/api/v1/admin/enquiries/pipeline/summary"),
    followUpsDue: () => adminJson<EnquiryDto[]>("/api/v1/admin/enquiries/follow-ups/due"),
  },
  auditLogs: {
    list: async (params: Record<string, string | number | undefined> = {}) =>
      unwrap(await adminJson<PageResponse<AuditLogEntry> | AuditLogEntry[]>(`/api/v1/admin/audit-logs${qs(params)}`)),
  },
  mockMode: {
    get: () => adminJson<MockModeState>("/api/v1/admin/mock-mode"),
    set: (enabled: boolean) =>
      adminJson<MockModeState>(`/api/v1/admin/mock-mode?enabled=${enabled ? "true" : "false"}`, { method: "PUT" }),
  },
  users: {
    list: async (params: Record<string, string | number | boolean | undefined> = {}) => {
      const data = await adminJson<PageResponse<UserDto> | UserDto[]>(`/api/v1/admin/users${qs(params)}`);
      return unwrap(data).rows;
    },
    create: (body: Partial<UserDto> & { password?: string; roleId?: string; staffRoleId?: string }) => adminJson<UserDto>("/api/v1/admin/users", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<UserDto> & { password?: string; resetPassword?: boolean; roleId?: string; staffRoleId?: string }) => adminJson<UserDto>(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
    resetPassword: (id: string) => adminJson<void>(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ resetPassword: true }) }),
    listAssignable: () => adminJson<UserDto[]>("/api/v1/admin/users/assignable"),
  },
  roles: {
    list: () => adminJson<RoleDto[]>("/api/v1/admin/roles"),
    create: (body: RoleRequest) => adminJson<RoleDto>("/api/v1/admin/roles", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: RoleRequest) => adminJson<RoleDto>(`/api/v1/admin/roles/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => adminJson<void>(`/api/v1/admin/roles/${encodeURIComponent(id)}`, { method: "DELETE" }),
    listPermissions: () => adminJson<string[]>("/api/v1/admin/permissions"),
  },
  settings: {
    list: () => adminJson<SettingDto[]>("/api/v1/admin/settings"),
    upsert: (body: SettingDto) => adminJson<SettingDto>("/api/v1/admin/settings", { method: "PUT", body: JSON.stringify(body) }),
  },
};

import { Fragment, useEffect, useState } from "react";
import { Loader2, Image as ImageIcon, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type GeneratedProductImageDto,
  type ProductImageGenerationBatchDto,
  type ProductImageGenerationBudgetDto,
} from "@/services/adminResources";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

const RUNNING_STATUSES = new Set(["IN_PROGRESS"]);

function statusColor(status: ProductImageGenerationBatchDto["status"]) {
  switch (status) {
    case "COMPLETED": return "#15803d";
    case "COMPLETED_WITH_ERRORS": return "#b45309";
    case "STOPPED_BUDGET_LIMIT": return "#b91c1c";
    case "DELETED": return "var(--admin-muted)";
    default: return "var(--admin-muted)";
  }
}

function groupByProduct(images: GeneratedProductImageDto[]) {
  const map = new Map<string, { productName: string; images: GeneratedProductImageDto[] }>();
  for (const img of images) {
    const entry = map.get(img.productId) ?? { productName: img.productName, images: [] };
    entry.images.push(img);
    map.set(img.productId, entry);
  }
  return Array.from(map.values());
}

function BatchImagesPanel({ batchId }: { batchId: string }) {
  const [images, setImages] = useState<GeneratedProductImageDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminResources.productImageGeneration.getBatchImages(batchId)
      .then((res) => { if (!cancelled) setImages(res); })
      .catch((err) => { reportAdminError(err, "Failed to load batch images"); if (!cancelled) setImages([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchId]);

  if (loading) {
    return <p style={{ fontSize: 12.5, color: "var(--admin-muted)", padding: "10px 0" }}><Loader2 size={13} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />Loading images…</p>;
  }
  if (!images || images.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--admin-muted)", padding: "10px 0" }}>No images recorded for this batch (all products failed, or none succeeded yet).</p>;
  }

  const groups = groupByProduct(images);

  return (
    <div style={{ padding: "12px 0", display: "grid", gap: 14 }}>
      {groups.map((g) => (
        <div key={g.productName}>
          <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600 }}>{g.productName}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {g.images.map((img) => (
              <a key={img.id} href={img.imageUrl} target="_blank" rel="noreferrer" title={img.isPrimary ? "Primary image" : "Gallery image"}>
                <img
                  src={img.imageUrl} alt={g.productName}
                  style={{
                    width: 72, height: 72, objectFit: "cover", borderRadius: 8,
                    border: img.isPrimary ? "2px solid var(--admin-accent, #2f6f4f)" : "1px solid var(--admin-border)",
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminProductImagesPage() {
  const { user } = useAdminAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";

  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [budget, setBudget] = useState<ProductImageGenerationBudgetDto | null>(null);
  const [batches, setBatches] = useState<ProductImageGenerationBatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState("10");
  const [starting, setStarting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  async function refresh() {
    try {
      const [count, budgetDto, batchList] = await Promise.all([
        adminResources.productImageGeneration.getCandidateCount(),
        adminResources.productImageGeneration.getBudget(),
        adminResources.productImageGeneration.listBatches(),
      ]);
      setCandidateCount(count);
      setBudget(budgetDto);
      setBatches(batchList);
    } catch (err) {
      reportAdminError(err, "Failed to load image generation status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) return;
    void refresh();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const hasRunning = batches.some((b) => RUNNING_STATUSES.has(b.status));
    if (!hasRunning) return;
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [isSuperAdmin, batches]);

  if (!isSuperAdmin) return <AdminLayout title="Product Images (AI)"><Forbidden resource="Product Images (AI)" /></AdminLayout>;

  async function startRun() {
    const n = Number(limit);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a valid number of products");
      return;
    }
    setStarting(true);
    try {
      await adminResources.productImageGeneration.runBatch(n);
      toast.success(`Generation batch started for ${n} product${n === 1 ? "" : "s"}.`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to start batch");
    } finally {
      setStarting(false);
    }
  }

  async function deleteBatch(id: string) {
    if (!window.confirm("This deletes all images generated in this batch from Cloudinary and clears them from any product that still uses them (unless an admin has since manually replaced the image). Continue?")) return;
    setDeletingId(id);
    try {
      await adminResources.productImageGeneration.deleteBatch(id);
      toast.success("Batch deleted.");
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to delete batch");
    } finally {
      setDeletingId(null);
    }
  }

  const hasRunning = batches.some((b) => RUNNING_STATUSES.has(b.status));

  return (
    <AdminLayout title="Product Images (AI)">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            <b>Super Admin only.</b> Generates catalog-style product images via Gemini and uploads them to
            Cloudinary. Admin-triggered only — there is no scheduled/automatic run. Each run stops early if the
            next image would exceed the configured budget ceiling.
          </p>
        </div>

        <div className="admin-panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <ImageIcon size={16} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Generate images</h3>
          </div>

          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}><Loader2 size={13} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />Loading status…</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Products without images</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{candidateCount ?? "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Spent</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{budget ? fmtUsd(budget.spentUsd) : "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Remaining budget</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{budget ? fmtUsd(budget.remainingUsd) : "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Cost per image</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{budget ? fmtUsd(budget.costPerImageUsd) : "—"}</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Products to generate for</label>
                <input
                  className="admin-input" style={{ width: 100 }} type="number" min={1}
                  value={limit} onChange={(e) => setLimit(e.target.value)}
                  disabled={hasRunning}
                />
                <button
                  type="button" className="admin-btn admin-btn-primary"
                  disabled={starting || hasRunning}
                  onClick={() => void startRun()}
                >
                  {starting && <Loader2 size={14} className="animate-spin" />} Start generation
                </button>
                {hasRunning && (
                  <span style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>
                    <Loader2 size={12} className="animate-spin" style={{ display: "inline", marginRight: 4 }} />
                    A batch is already running — refreshing automatically.
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="admin-panel" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>Batch history</h3>
          {batches.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No batches yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Succeeded</th>
                  <th>Failed</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const expanded = expandedBatchId === b.id;
                  const canViewImages = b.succeededCount > 0;
                  return (
                    <Fragment key={b.id}>
                      <tr>
                        <td>{new Date(b.createdAt).toLocaleString()}</td>
                        <td>{b.triggerType}</td>
                        <td style={{ color: statusColor(b.status), fontWeight: 600 }}>{b.status.replace(/_/g, " ")}</td>
                        <td>{b.requestedCount}</td>
                        <td>{b.succeededCount}</td>
                        <td>{b.failedCount}</td>
                        <td>
                          {canViewImages && (
                            <button
                              type="button" className="admin-btn admin-btn-ghost"
                              onClick={() => setExpandedBatchId(expanded ? null : b.id)}
                            >
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} View images
                            </button>
                          )}
                        </td>
                        <td>
                          {b.status !== "DELETED" && !RUNNING_STATUSES.has(b.status) && (
                            <button
                              type="button" className="admin-btn admin-btn-ghost"
                              disabled={deletingId === b.id}
                              onClick={() => void deleteBatch(b.id)}
                              aria-label="Delete batch"
                            >
                              {deletingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={8} style={{ background: "var(--admin-hover, rgba(0,0,0,0.02))" }}>
                            <BatchImagesPanel batchId={b.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminProductImagesPage;

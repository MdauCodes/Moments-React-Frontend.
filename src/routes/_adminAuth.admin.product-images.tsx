import { Fragment, useEffect, useState } from "react";
import { Loader2, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Sparkles, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type GeneratedProductImageDto,
  type ProductDto,
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

// ── Product search picker (for the "clean up one specific product" trigger) ────────────────────

function useDebounced(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function ProductPicker({ selected, onSelect }: { selected: ProductDto | null; onSelect: (p: ProductDto | null) => void }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [results, setResults] = useState<ProductDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQ.trim() || selected) { setResults([]); return; }
    setLoading(true);
    adminResources.products.list({ q: debouncedQ, size: 8 })
      .then((page) => setResults(page.rows))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQ, selected]);

  if (selected) {
    return (
      <div className="admin-input" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</span>
        <button type="button" onClick={() => { onSelect(null); setQ(""); }} aria-label="Clear product" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 2 }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
        <input
          className="admin-input" style={{ paddingLeft: 26, width: "100%" }}
          placeholder="Search product by name…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && q.trim() && (
        <div className="admin-panel" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: "auto", padding: 4 }}>
          {loading ? (
            <div style={{ padding: 8, fontSize: 12.5, color: "var(--admin-muted)" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12.5, color: "var(--admin-muted)" }}>No products found.</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id} type="button"
                onMouseDown={() => { onSelect(p); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-hover, rgba(0,0,0,0.05))")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminProductImagesPage() {
  const { user } = useAdminAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";

  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [budget, setBudget] = useState<ProductImageGenerationBudgetDto | null>(null);
  const [cleanupCandidateCount, setCleanupCandidateCount] = useState<number | null>(null);
  const [cleanupBudget, setCleanupBudget] = useState<ProductImageGenerationBudgetDto | null>(null);
  const [batches, setBatches] = useState<ProductImageGenerationBatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState("10");
  const [starting, setStarting] = useState(false);
  const [cleanupLimit, setCleanupLimit] = useState("10");
  const [startingCleanup, setStartingCleanup] = useState(false);
  const [cleanupProduct, setCleanupProduct] = useState<ProductDto | null>(null);
  const [startingCleanupForProduct, setStartingCleanupForProduct] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  async function refresh() {
    try {
      const [count, budgetDto, cleanupCount, cleanupBudgetDto, batchList] = await Promise.all([
        adminResources.productImageGeneration.getCandidateCount(),
        adminResources.productImageGeneration.getBudget(),
        adminResources.productImageGeneration.getCleanupCandidateCount(),
        adminResources.productImageGeneration.getCleanupBudget(),
        adminResources.productImageGeneration.listBatches(),
      ]);
      setCandidateCount(count);
      setBudget(budgetDto);
      setCleanupCandidateCount(cleanupCount);
      setCleanupBudget(cleanupBudgetDto);
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

  const hasRunning = batches.some((b) => RUNNING_STATUSES.has(b.status));

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

  async function startCleanupRun() {
    const n = Number(cleanupLimit);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a valid number of products");
      return;
    }
    setStartingCleanup(true);
    try {
      await adminResources.productImageGeneration.runCleanupBatch(n);
      toast.success(`Cleanup batch started for ${n} product${n === 1 ? "" : "s"}.`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to start cleanup batch");
    } finally {
      setStartingCleanup(false);
    }
  }

  async function startCleanupForProduct() {
    if (!cleanupProduct) return;
    setStartingCleanupForProduct(true);
    try {
      await adminResources.productImageGeneration.runCleanupForProduct(cleanupProduct.id);
      toast.success(`Cleanup started for "${cleanupProduct.name}".`);
      setCleanupProduct(null);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to start cleanup for this product");
    } finally {
      setStartingCleanupForProduct(false);
    }
  }

  async function resetAllCleanups() {
    if (!window.confirm(
      "This reverts every cleaned-up product back to just its original raw photo, and deletes every " +
      "AI-cleaned image from Cloudinary. Use this before re-running cleanup with an improved prompt. Continue?"
    )) return;
    setResettingAll(true);
    try {
      const count = await adminResources.productImageGeneration.resetAllCleanups();
      toast.success(`Reset ${count} cleanup batch${count === 1 ? "" : "es"} back to raw photos.`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Failed to reset cleanups");
    } finally {
      setResettingAll(false);
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

  return (
    <AdminLayout title="Product Images (AI)">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            <b>Super Admin only.</b> Two ways to get product images via Gemini, both admin-triggered only (no
            scheduled/automatic run), both stopping early if the next image would exceed the shared budget ceiling.
            <b> Generate</b> invents a plausible image from the product's name/description (no reference photo, so
            results only approximate the real product). <b>Clean up</b> edits a real admin-uploaded photo into 3
            polished catalog images — more accurate, since it's grounded in what the product actually looks like.
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
                <label style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Number of products</label>
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
              <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--admin-muted)" }}>
                This is a count of <b>products</b>, not images — each product gets up to 3 images, so 10 products
                can generate up to 30 images. Only products with no image at all are ever picked; a product that
                fails is simply retried automatically the next time you start a batch.
              </p>
            </>
          )}
        </div>

        <div className="admin-panel" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={16} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Clean up images (from a real photo)</h3>
          </div>

          {loading ? (
            <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}><Loader2 size={13} className="animate-spin" style={{ display: "inline", marginRight: 6 }} />Loading status…</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Products with a raw photo, not yet cleaned</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cleanupCandidateCount ?? "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Spent (shared budget)</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cleanupBudget ? fmtUsd(cleanupBudget.spentUsd) : "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Remaining budget</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cleanupBudget ? fmtUsd(cleanupBudget.remainingUsd) : "—"}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Cost per image</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{cleanupBudget ? fmtUsd(cleanupBudget.costPerImageUsd) : "—"}</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Number of products</label>
                <input
                  className="admin-input" style={{ width: 100 }} type="number" min={1}
                  value={cleanupLimit} onChange={(e) => setCleanupLimit(e.target.value)}
                  disabled={hasRunning}
                />
                <button
                  type="button" className="admin-btn admin-btn-primary"
                  disabled={startingCleanup || hasRunning}
                  onClick={() => void startCleanupRun()}
                >
                  {startingCleanup && <Loader2 size={14} className="animate-spin" />} Start cleanup batch
                </button>
              </div>

              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--admin-muted)" }}>
                  Or clean up one specific product on demand — works even if it's already been cleaned before,
                  so you can re-run it if the first result wasn't good.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <ProductPicker selected={cleanupProduct} onSelect={setCleanupProduct} />
                  <button
                    type="button" className="admin-btn admin-btn-primary"
                    disabled={!cleanupProduct || startingCleanupForProduct || hasRunning}
                    onClick={() => void startCleanupForProduct()}
                  >
                    {startingCleanupForProduct && <Loader2 size={14} className="animate-spin" />} Clean this product
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14, marginTop: 14 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--admin-muted)" }}>
                  Not happy with the current cleanup results? Reset every cleaned product back to just its
                  original raw photo in one go — useful right after a prompt change, before re-running cleanup.
                </p>
                <button
                  type="button" className="admin-btn admin-btn-ghost"
                  style={{ borderColor: "var(--admin-clay)", color: "var(--admin-clay)" }}
                  disabled={resettingAll || hasRunning}
                  onClick={() => void resetAllCleanups()}
                >
                  {resettingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Reset all cleanups
                </button>
              </div>

              {hasRunning && (
                <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--admin-muted)" }}>
                  <Loader2 size={12} className="animate-spin" style={{ display: "inline", marginRight: 4 }} />
                  A batch is already running (generate or cleanup) — refreshing automatically.
                </p>
              )}
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
                  <th>Mode</th>
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
                        <td>{b.mode === "CLEANUP" ? "Clean up" : "Generate"}</td>
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
                          <td colSpan={9} style={{ background: "var(--admin-hover, rgba(0,0,0,0.02))" }}>
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

import { useNavigate, useParams } from "react-router-dom";

import { useEffect, useState, type CSSProperties } from "react";
import { MessageCircle, Copy } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminFetch } from "@/services/adminApi";



type EnquiryStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "CLOSED";

type CustomerType = "SME" | "CORPORATE";

interface EnquiryProduct {
  productId: string;
  name: string;
  qty: number;
  size?: string;
  finish?: string;
}

interface EnquiryDetail {
  id: string;
  customerType: CustomerType;
  name: string;
  companyName?: string;
  email?: string;
  phone: string;
  message?: string;
  estimatedVolume?: string;
  timeline?: string;
  artworkUrl?: string;
  referralSource?: string;
  status: EnquiryStatus;
  isRead: boolean;
  createdAt: string;
  products: EnquiryProduct[];
  internalNotes?: string;
  assignedTo?: string;
  followUpDate?: string;
}

const STATUSES: EnquiryStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "CLOSED",
];

const STATUS_STYLES: Record<
  EnquiryStatus,
  { bg: string; color: string; border: string; label: string }
> = {
  NEW: { bg: "color-mix(in oklab, var(--admin-clay) 24%, var(--admin-surface))", color: "var(--admin-clay)", border: "var(--admin-clay)", label: "New" },
  IN_PROGRESS: { bg: "color-mix(in oklab, var(--admin-kraft) 18%, var(--admin-surface))", color: "var(--admin-kraft)", border: "var(--admin-kraft)", label: "In progress" },
  CLOSED: { bg: "color-mix(in oklab, var(--admin-accent) 34%, var(--admin-surface))", color: "var(--cream)", border: "var(--admin-accent)", label: "Closed" },
};

const styles: Record<string, CSSProperties> = {
  back: {
    display: "inline-block",
    fontSize: 12,
    color: "var(--admin-muted)",
    cursor: "pointer",
    marginBottom: 20,
    background: "transparent",
    border: "none",
    padding: 0,
    fontFamily: "inherit",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
    gap: 18,
    alignItems: "start",
  },
  card: {
    background: "linear-gradient(180deg, color-mix(in oklab, var(--admin-surface) 90%, var(--cream) 10%), var(--admin-surface))",
    border: "1px solid var(--admin-border)",
    borderRadius: 14,
    padding: 20,
    boxShadow: "var(--admin-shadow)",
  },
  sectionLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--admin-muted)",
    marginBottom: 12,
  },
  customerHead: { display: "flex", alignItems: "center", flexWrap: "wrap" },
  customerName: { fontSize: 22, fontWeight: 650, color: "var(--admin-text)", fontFamily: "var(--font-display)", letterSpacing: 0 },
  typeBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 100,
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 9px",
    marginLeft: 8,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid var(--admin-border)",
    gap: 12,
  },
  infoLabel: { fontSize: 11, color: "var(--admin-muted)" },
  infoValue: { fontSize: 12, color: "var(--admin-text)", textAlign: "right", wordBreak: "break-word" },
  msgLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--admin-muted)",
    marginTop: 16,
  },
  msgBox: {
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    color: "var(--admin-muted)",
    lineHeight: 1.6,
    marginTop: 8,
    whiteSpace: "pre-wrap",
  },
  divider: {
    height: 1,
    background: "var(--admin-border)",
    border: "none",
    margin: "20px 0",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--admin-muted)",
    paddingBottom: 8,
    borderBottom: "1px solid var(--admin-border)",
    textAlign: "left",
    fontWeight: 500,
  },
  td: {
    padding: "10px 0",
    borderBottom: "1px solid var(--admin-border)",
    fontSize: 12,
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 6,
  },
  statusBtn: {
    background: "var(--admin-border)",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-muted)",
    borderRadius: 7,
    padding: 6,
    fontSize: 11,
    textAlign: "center",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  fieldLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--admin-muted)",
    marginBottom: 6,
    display: "block",
  },
  input: {
    width: "100%",
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "var(--admin-text)",
    fontSize: 12,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  waBtn: {
    width: "100%",
    background: "color-mix(in oklab, var(--admin-accent) 28%, var(--admin-bg))",
    border: "1px solid var(--admin-accent)",
    color: "var(--admin-accent-hover)",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  copyBtn: {
    width: "100%",
    background: "var(--admin-border)",
    border: "1px solid var(--admin-border)",
    color: "var(--admin-muted)",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  notesSub: { fontSize: 10, color: "var(--admin-muted)", marginBottom: 8 },
  textarea: {
    width: "100%",
    background: "var(--admin-bg)",
    border: "1px solid var(--admin-border)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "var(--admin-text)",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  saveBtn: {
    marginTop: 8,
    width: "100%",
    background: "var(--admin-accent)",
    color: "var(--cream)",
    border: "none",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  saveFeedback: {
    fontSize: 11,
    color: "var(--admin-accent-hover)",
    marginTop: 6,
    minHeight: 14,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 12,
    color: "var(--admin-text)",
    zIndex: 9999,
    boxShadow: "0 8px 24px oklch(0 0 0 / 0.4)",
    fontFamily: "inherit",
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "var(--admin-muted)",
    fontSize: 13,
  },
  errorWrap: {
    padding: 40,
    textAlign: "center",
    color: "var(--admin-clay)",
    fontSize: 13,
  },
  artworkLink: {
    fontSize: 12,
    color: "var(--admin-kraft)",
    textDecoration: "none",
  },
};

function typeBadgeStyle(t: CustomerType): CSSProperties {
  if (t === "SME") {
    return {
      ...styles.typeBadge,
      background: "color-mix(in oklab, var(--admin-kraft) 18%, var(--admin-surface))",
      color: "var(--admin-kraft)",
      border: "1px solid var(--admin-kraft)",
    };
  }
  return {
    ...styles.typeBadge,
    background: "color-mix(in oklab, var(--admin-accent) 34%, var(--admin-surface))",
    color: "var(--cream)",
    border: "1px solid var(--admin-accent)",
  };
}

function activeStatusBtnStyle(s: EnquiryStatus): CSSProperties {
  const v = STATUS_STYLES[s];
  return {
    ...styles.statusBtn,
    background: v.bg,
    border: `1px solid ${v.border}`,
    color: v.color,
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function buildWhatsAppMessage(e: EnquiryDetail): string {
  const lines = e.products.map(
    (p) => `• ${p.name} — ${p.qty} units, ${p.size ?? "—"}, ${p.finish ?? "—"}`,
  );
  return (
    `Hi ${e.name}! 👋 Thank you for your enquiry with Moments Packaging.\n\n` +
    `Here's a summary of what you requested:\n\n` +
    `${lines.join("\n")}\n\n` +
    `We'll send your quote shortly. Feel free to reply here with any questions!`
  );
}

function buildEmailTemplate(e: EnquiryDetail): { subject: string; body: string } {
  const subject = "Your packaging enquiry — Moments Packaging";
  const productLines = e.products
    .map((p) => `  • ${p.name} — ${p.qty} units, ${p.size ?? "—"}, ${p.finish ?? "—"}`)
    .join("\n");
  const body =
    `Hi ${e.name},\n\n` +
    `Thank you for reaching out to Moments Packaging. We've received your enquiry and our team is preparing a tailored quote for the following:\n\n` +
    `${productLines}\n\n` +
    `We'll be in touch shortly with pricing, lead times, and any clarifying questions. In the meantime, please reply to this email if you'd like to share artwork, references, or any additional context.\n\n` +
    `Warm regards,\n` +
    `The Moments Packaging Team`;
  return { subject, body };
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

type EnquiryApiItem = {
  productId?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  size?: string;
  finish?: string;
};

type EnquiryApiDto = Partial<Omit<EnquiryDetail, "products" | "name" | "phone" | "customerType">> & {
  id: string;
  persona?: string;
  contact?: { name?: string; email?: string; phone?: string; company?: string };
  companyName?: string;
  phone?: string;
  source?: string;
  products?: EnquiryApiItem[];
  items?: EnquiryApiItem[];
};

function normalizeEnquiryDetail(e: EnquiryApiDto): EnquiryDetail {
  const items = e.items ?? e.products ?? [];
  return {
    id: e.id,
    customerType: e.persona === "CORPORATE" ? "CORPORATE" : "SME",
    name: e.contact?.name ?? "Unknown customer",
    companyName: e.contact?.company ?? e.companyName,
    email: e.contact?.email ?? e.email,
    phone: e.contact?.phone ?? e.phone ?? "",
    message: e.message,
    referralSource: e.source,
    status: e.status ?? "NEW",
    isRead: e.isRead ?? true,
    createdAt: e.createdAt ?? new Date().toISOString(),
    products: items.map((item) => ({
      productId: item.productId ?? item.name ?? item.productName ?? "",
      name: item.productName ?? item.name ?? "Product",
      qty: item.quantity ?? item.qty ?? 1,
      size: item.size,
      finish: item.finish,
    })),
    internalNotes: e.internalNotes,
    assignedTo: e.assignedTo,
    followUpDate: e.followUpDate,
  };
}

function AdminEnquiryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesFeedback, setNotesFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  // Load + mark read
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await adminFetch(`/api/v1/admin/enquiries/${id}`);
        if (!res.ok) throw new Error(`Failed to load enquiry (${res.status})`);
        const data = normalizeEnquiryDetail((await res.json()) as EnquiryApiDto);
        if (!cancelled) {
          setEnquiry(data);
          setNotesDraft(data.internalNotes ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load enquiry");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadKey]);

  const patch = async (path: string, body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await adminFetch(`/api/v1/admin/enquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: enquiry?.status,
          assignedTo: enquiry?.assignedTo,
          internalNotes: enquiry?.internalNotes,
          ...body,
        }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed");
      return false;
    }
  };

  const handleStatusChange = async (next: EnquiryStatus) => {
    if (!enquiry || enquiry.status === next) return;
    const prev = enquiry.status;
    setEnquiry({ ...enquiry, status: next });
    const ok = await patch("status", { status: next });
    if (!ok && enquiry) {
      setEnquiry((cur) => (cur ? { ...cur, status: prev } : cur));
    } else if (ok) {
      showToast(`Status updated to ${STATUS_STYLES[next].label}`);
    }
  };

  const handleAssignedBlur = async (value: string) => {
    if (!enquiry) return;
    const trimmed = value.trim();
    if (trimmed === (enquiry.assignedTo ?? "")) return;
    const prev = enquiry.assignedTo;
    setEnquiry({ ...enquiry, assignedTo: trimmed || undefined });
    const ok = await patch("assigned", { assignedTo: trimmed });
    if (!ok) {
      setEnquiry((cur) => (cur ? { ...cur, assignedTo: prev } : cur));
    } else {
      showToast("Assignment saved");
    }
  };

  const handleFollowupBlur = async (value: string) => {
    if (!enquiry) return;
    if (value === (enquiry.followUpDate ?? "")) return;
    const prev = enquiry.followUpDate;
    setEnquiry({ ...enquiry, followUpDate: value || undefined });
    const ok = await patch("followup", { followUpDate: value });
    if (!ok) {
      setEnquiry((cur) => (cur ? { ...cur, followUpDate: prev } : cur));
    } else {
      showToast("Follow-up date saved");
    }
  };

  const handleSaveNotes = async () => {
    if (!enquiry) return;
    const prev = enquiry.internalNotes;
    setEnquiry({ ...enquiry, internalNotes: notesDraft });
    const ok = await patch("notes", { internalNotes: notesDraft });
    if (ok) {
      setNotesFeedback("Saved ✓");
      window.setTimeout(() => setNotesFeedback(""), 2000);
    } else {
      setEnquiry((cur) => (cur ? { ...cur, internalNotes: prev } : cur));
    }
  };

  const handleWhatsApp = () => {
    if (!enquiry) return;
    const msg = buildWhatsAppMessage(enquiry);
    const phone = digitsOnly(enquiry.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyEmail = async () => {
    if (!enquiry) return;
    const { subject, body } = buildEmailTemplate(enquiry);
    const full = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      showToast("Could not copy to clipboard");
    }
  };

  return (
    <AdminLayout title="Enquiry detail" onReload={() => setReloadKey((k) => k + 1)}>
      <button
        type="button"
        style={styles.back}
        onClick={() => navigate("/admin/enquiries")}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--admin-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--admin-muted)")}
      >
        ← Back to enquiries
      </button>

      {loading && <div style={styles.loading}>Loading enquiry…</div>}
      {!loading && loadError && <div style={styles.errorWrap}>{loadError}</div>}

      {!loading && !loadError && enquiry && (
        <div style={styles.grid} data-admin-grid>
          {/* LEFT */}
          <div style={styles.card}>
            <div style={styles.sectionLabel}>Customer</div>
            <div style={styles.customerHead}>
              <span style={styles.customerName}>{enquiry.companyName || enquiry.name}</span>
              <span style={typeBadgeStyle(enquiry.customerType)}>{enquiry.customerType}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Phone</span>
                <span style={styles.infoValue}>{enquiry.phone}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Email</span>
                <span style={styles.infoValue}>{enquiry.email || "—"}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Company</span>
                <span style={styles.infoValue}>{enquiry.companyName || "—"}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Volume</span>
                <span style={styles.infoValue}>{enquiry.estimatedVolume || "—"}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Timeline</span>
                <span style={styles.infoValue}>{enquiry.timeline || "—"}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>How they found us</span>
                <span style={styles.infoValue}>{enquiry.referralSource || "—"}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Submitted</span>
                <span style={styles.infoValue}>{formatDateTime(enquiry.createdAt)}</span>
              </div>
              {enquiry.artworkUrl && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Artwork file</span>
                  <a
                    href={enquiry.artworkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.artworkLink}
                  >
                    ↓ Download file
                  </a>
                </div>
              )}
            </div>

            {enquiry.message && (
              <>
                <div style={styles.msgLabel}>Their message</div>
                <div style={styles.msgBox}>{enquiry.message}</div>
              </>
            )}

            <hr style={styles.divider} />

            <div style={styles.sectionLabel}>Products</div>
            <div data-admin-table-scroll>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Product</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Finish</th>
                </tr>
              </thead>
              <tbody>
                {enquiry.products.map((p, i) => (
                  <tr key={`${p.productId}-${i}`}>
                    <td style={{ ...styles.td, color: "var(--admin-text)" }}>{p.name}</td>
                    <td style={{ ...styles.td, color: "var(--admin-muted)" }}>{p.qty}</td>
                    <td style={{ ...styles.td, color: "var(--admin-muted)" }}>{p.size || "—"}</td>
                    <td style={{ ...styles.td, color: "var(--admin-muted)" }}>{p.finish || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Card 1 — Status & Assignment */}
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Status</div>
              <div style={styles.statusGrid}>
                {STATUSES.map((s) => {
                  const isActive = enquiry.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      style={isActive ? activeStatusBtnStyle(s) : styles.statusBtn}
                      onClick={() => void handleStatusChange(s)}
                    >
                      {STATUS_STYLES[s].label}
                    </button>
                  );
                })}
              </div>

              <hr style={styles.divider} />

              <label style={styles.fieldLabel} htmlFor="assigned-to">Assigned to</label>
              <input
                id="assigned-to"
                type="text"
                defaultValue={enquiry.assignedTo ?? ""}
                placeholder="Assign to staff member"
                style={styles.input}
                onBlur={(e) => void handleAssignedBlur(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--admin-border)")}
              />

              <div style={{ height: 12 }} />

              <label style={styles.fieldLabel} htmlFor="followup-date">Follow-up date</label>
              <input
                id="followup-date"
                type="date"
                defaultValue={enquiry.followUpDate ?? ""}
                style={styles.input}
                onBlur={(e) => void handleFollowupBlur(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--admin-border)")}
              />
            </div>

            {/* Card 2 — Quick Replies & Notes */}
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Quick replies</div>

              {enquiry.customerType === "SME" && (
                <button type="button" style={styles.waBtn} onClick={handleWhatsApp}>
                  <MessageCircle size={14} />
                  Send WhatsApp quote
                </button>
              )}

              <button type="button" style={styles.copyBtn} onClick={() => void handleCopyEmail()}>
                <Copy size={14} />
                {copyFeedback ? "Copied!" : "Copy email template"}
              </button>

              <hr style={{ ...styles.divider, margin: "16px 0" }} />

              <div style={styles.sectionLabel}>Internal notes</div>
              <div style={styles.notesSub}>Only visible to your team</div>
              <textarea
                rows={4}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add notes for the team..."
                style={styles.textarea}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--admin-border)")}
              />
              <button type="button" style={styles.saveBtn} onClick={() => void handleSaveNotes()}>
                Save notes
              </button>
              <div style={styles.saveFeedback}>{notesFeedback}</div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </AdminLayout>
  );
}

export default AdminEnquiryDetailPage;

import { adminJson } from "@/services/adminApi";

export interface TumaBodaBalance {
  totalOwed: number;
  totalPaid: number;
  outstandingBalance: number;
  deliveredOrderCount: number;
}

export interface TumaBodaOrderBreakdown {
  orderId: string;
  reference: string;
  contactName: string;
  tumabodaCost: number;
  amountPaid: number;
  settlementStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  createdAt: string;
}

export interface TumaBodaPayment {
  id: string;
  amount: number;
  paidAt: string;
  recordedByName: string | null;
  notes: string | null;
  reference: string | null;
  method: string | null;
  proofUrl: string | null;
  tumabodaRemittanceId: string | null;
  tumabodaRemittanceStatus: string | null;
  tumabodaRemittanceRejectionReason: string | null;
  createdAt: string;
}

export interface TumaBodaCreditLine {
  status: string | null;
  creditLimit: number;
  outstanding: number;
  available: number;
  totalDrawn: number;
  totalRepaid: number;
}

export interface TumaBodaReconciliation {
  id: string;
  checkedAt: string;
  ourBalance: number;
  theirReportedBalance: number | null;
  delta: number | null;
  recordedByName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TumaBodaDisagreement {
  id: string;
  orderReference: string;
  kind: "COST_DIFFERS" | "STATUS_DIFFERS" | "MISSING_ON_THEIR_SIDE" | string;
  ourValue: string | null;
  theirValue: string | null;
  status: "OPEN" | "QUERIED" | "RESOLVED" | string;
  resolution: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

export interface TumaBodaDisagreementEvent {
  at: string;
  actor: string;
  action: string;
  note: string | null;
}

export interface TumaBodaLedgerSummary {
  ourBalance: number | null;
  theirBalance: number | null;
  delta: number | null;
  differingSince: string | null;
  openDisagreements: number;
}

interface PageResult<T> {
  rows: T[];
  total: number;
  totalPages: number;
}

function unwrap<T>(data: { content?: T[]; totalElements?: number; totalPages?: number }): PageResult<T> {
  return { rows: data.content ?? [], total: data.totalElements ?? 0, totalPages: data.totalPages ?? 1 };
}

export const tumaBodaSettlementApi = {
  getBalance: () => adminJson<TumaBodaBalance>("/api/v1/admin/tumaboda-settlements/balance"),

  getOrderBreakdown: async (page = 0, size = 50): Promise<PageResult<TumaBodaOrderBreakdown>> =>
    unwrap(await adminJson(`/api/v1/admin/tumaboda-settlements/orders?page=${page}&size=${size}`)),

  getPayments: async (page = 0, size = 20): Promise<PageResult<TumaBodaPayment>> =>
    unwrap(await adminJson(`/api/v1/admin/tumaboda-settlements/payments?page=${page}&size=${size}`)),

  recordPayment: (body: {
    amount: number;
    paidAt?: string;
    notes?: string;
    reference?: string;
    method?: string;
    proofUrl?: string;
  }) =>
    adminJson<TumaBodaPayment>("/api/v1/admin/tumaboda-settlements/payments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getReconciliations: async (page = 0, size = 20): Promise<PageResult<TumaBodaReconciliation>> =>
    unwrap(await adminJson(`/api/v1/admin/tumaboda-settlements/reconciliations?page=${page}&size=${size}`)),

  recordReconciliation: (body: { theirReportedBalance?: number; notes?: string }) =>
    adminJson<TumaBodaReconciliation>("/api/v1/admin/tumaboda-settlements/reconciliations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  recordAutoReconciliation: () =>
    adminJson<TumaBodaReconciliation>("/api/v1/admin/tumaboda-settlements/reconciliations/auto", {
      method: "POST",
    }),

  getDisagreements: () => adminJson<TumaBodaDisagreement[]>("/api/v1/admin/tumaboda-disagreements"),
  getDisagreementSummary: () =>
    adminJson<TumaBodaLedgerSummary>("/api/v1/admin/tumaboda-disagreements/summary"),
  getDisagreementEvents: (id: string) =>
    adminJson<TumaBodaDisagreementEvent[]>(`/api/v1/admin/tumaboda-disagreements/${id}/events`),
  scanDisagreements: () =>
    adminJson<{ checked: number; opened: number; closed: number; unreachable: number }>(
      "/api/v1/admin/tumaboda-disagreements/scan",
      { method: "POST" },
    ),
  queryDisagreement: (id: string, note: string) =>
    adminJson<TumaBodaDisagreement>(`/api/v1/admin/tumaboda-disagreements/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  resolveDisagreement: (id: string, resolution: string, note: string) =>
    adminJson<TumaBodaDisagreement>(`/api/v1/admin/tumaboda-disagreements/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution, note }),
    }),

  getLiveCreditLine: () =>
    adminJson<TumaBodaCreditLine>("/api/v1/admin/tumaboda-settlements/credit-line/live"),

  declareRemittance: (paymentId: string) =>
    adminJson<TumaBodaPayment>(`/api/v1/admin/tumaboda-settlements/payments/${paymentId}/declare-remittance`, {
      method: "POST",
    }),

  refreshRemittanceStatus: (paymentId: string) =>
    adminJson<TumaBodaPayment>(`/api/v1/admin/tumaboda-settlements/payments/${paymentId}/refresh-remittance-status`, {
      method: "POST",
    }),
};

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
  createdAt: string;
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

  recordPayment: (body: { amount: number; paidAt?: string; notes?: string }) =>
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
};

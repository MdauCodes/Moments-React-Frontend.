// Feedback from the screens a customer sees straight after paying (a star rating of the checkout)
// or after a payment fails (what stopped them).
//
//   POST /api/v1/public/checkout-feedback/rating          { reference, rating, comment? }
//   POST /api/v1/public/checkout-feedback/payment-failed  { reference, reason?, comment? }
//   GET  /api/v1/admin/checkout-feedback
import { apiUrl } from "@/config/api";
import { authFetch } from "@/contexts/AuthContext";

export const FAILED_REASONS = [
  { value: "MPESA_TROUBLE", label: "M-Pesa problem" },
  { value: "PRICE", label: "Price / delivery cost" },
  { value: "CHANGED_MIND", label: "Changed my mind" },
  { value: "FOUND_ELSEWHERE", label: "Found it elsewhere" },
  { value: "OTHER", label: "Something else" },
] as const;

export interface AdminCheckoutFeedback {
  id: string;
  orderReference: string;
  kind: "CHECKOUT" | "PAYMENT_FAILED";
  rating?: number | null;
  reason?: string | null;
  comment?: string | null;
  updatedAt: string;
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Could not save feedback");
}

export const checkoutFeedbackStore = {
  rate: (reference: string, rating: number, comment?: string) =>
    post("/api/v1/public/checkout-feedback/rating", { reference, rating, comment }),
  paymentFailed: (reference: string, reason?: string, comment?: string) =>
    post("/api/v1/public/checkout-feedback/payment-failed", { reference, reason, comment }),
  async listAll(): Promise<AdminCheckoutFeedback[]> {
    const res = await authFetch(apiUrl("/api/v1/admin/checkout-feedback"));
    if (!res.ok) throw new Error("Could not load checkout feedback");
    return (await res.json()) as AdminCheckoutFeedback[];
  },
};

// A new customer's private rating of creating their account (never sent to Google).
//
//   POST /api/v1/customer/signup-feedback   { rating, comment? }   (signed-in customer)
//   GET  /api/v1/admin/signup-feedback
import { apiUrl } from "@/config/api";
import { authFetch } from "@/contexts/AuthContext";

export interface AdminSignupFeedback {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  rating: number;
  comment?: string | null;
  updatedAt: string;
}

export const signupFeedbackStore = {
  async rate(rating: number, comment?: string): Promise<void> {
    const res = await authFetch(apiUrl("/api/v1/customer/signup-feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    if (!res.ok) throw new Error("Could not save feedback");
  },
  async listAll(): Promise<AdminSignupFeedback[]> {
    const res = await authFetch(apiUrl("/api/v1/admin/signup-feedback"));
    if (!res.ok) throw new Error("Could not load signup feedback");
    return (await res.json()) as AdminSignupFeedback[];
  },
};

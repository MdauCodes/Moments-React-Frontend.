// ----------------------------------------------------------------------------
// Password reset & email verification — wired to the Spring Boot backend.
//   POST /api/v1/auth/forgot-password            { email }
//   POST /api/v1/auth/verify-reset-otp           { email, otp }  -> { resetSessionToken }
//   POST /api/v1/auth/reset-password             { token, newPassword }
//   POST /api/v1/auth/staff/forgot-password      { email }
//   POST /api/v1/auth/staff/reset-password       { token, newPassword }
//   POST /api/v1/auth/verify-email               { token }
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import type { AuthUser } from "@/contexts/AuthContext";

type Result<T = undefined> = { ok: boolean; message?: string; data?: T };

async function post<T = unknown>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T, message: (data as { message?: string }).message };
    return {
      ok: false,
      message: (data as { message?: string }).message ?? `Request failed (${res.status})`,
    };
  } catch {
    return { ok: false, message: "Network error — please check your connection and try again." };
  }
}

export const passwordStore = {
  // ---- Customer flow ----
  async requestReset(email: string): Promise<Result> {
    return post("/api/v1/auth/forgot-password", { email });
  },
  async verifyOtp(email: string, otp: string): Promise<Result<{ resetSessionToken: string }>> {
    if (!/^\d{6}$/.test(otp)) return { ok: false, message: "Enter the 6-digit code from your email." };
    return post<{ resetSessionToken: string }>("/api/v1/auth/verify-reset-otp", { email, otp });
  },
  async reset(token: string, newPassword: string): Promise<Result> {
    if (!token) return { ok: false, message: "Reset session expired. Start again." };
    return post("/api/v1/auth/reset-password", { token, newPassword });
  },

  // ---- Staff / admin flow ----
  async requestStaffReset(email: string): Promise<Result> {
    return post("/api/v1/auth/staff/forgot-password", { email });
  },
  // Staff flow has no separate verify endpoint — the OTP is submitted with the new password.
  async staffReset(otp: string, newPassword: string): Promise<Result> {
    if (!/^\d{6}$/.test(otp)) return { ok: false, message: "Enter the 6-digit code from your email." };
    return post("/api/v1/auth/staff/reset-password", { otp, newPassword });
  },

  async verifyEmail(token: string): Promise<Result> {
    if (!token) return { ok: false, message: "Verification link is invalid." };
    return post("/api/v1/auth/verify-email", { token });
  },

  // ---- Dashboard email verification (optional until the free-redemption limit) ----
  async sendVerificationOtp(email: string): Promise<Result> {
    return post("/api/v1/auth/resend-otp", { email });
  },
  async verifyEmailOtp(email: string, otp: string): Promise<Result<{ user: AuthUser }>> {
    if (!/^\d{6}$/.test(otp)) return { ok: false, message: "Enter the 6-digit code from your email." };
    return post<{ user: AuthUser }>("/api/v1/auth/verify-email", { email, otp });
  },
};

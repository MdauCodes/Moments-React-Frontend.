import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { InlineProgress } from "@/components/InlineProgress";
import { authFetch } from "@/contexts/AuthContext";
import { apiUrl } from "@/config/api";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

/**
 * Self-service password change — POST /api/v1/auth/change-password applies immediately (proof of
 * identity is the current password itself, not an admin review) and has existed on the backend
 * since before this UI did; this just wires it up. Self-contained styling, shared between the
 * Individual Shopper and Business Account dashboards.
 */
export function AccountSecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(apiUrl("/api/v1/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { message?: string });
        throw new Error((err as any).message ?? "Failed to change password.");
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Password</p>
      </div>
      <form onSubmit={submit} className="mt-3.5 grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Current password</span>
          <input
            type="password"
            className={inputCls}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">New password</span>
          <input
            type="password"
            className={inputCls}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm new password</span>
          <input
            type="password"
            className={inputCls}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <div className="flex items-center justify-between gap-2 sm:col-span-3">
          <p className="text-[11px] text-muted-foreground">Applies immediately — no admin review needed.</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving && <InlineProgress size="sm" />} Update password
          </button>
        </div>
      </form>
    </div>
  );
}

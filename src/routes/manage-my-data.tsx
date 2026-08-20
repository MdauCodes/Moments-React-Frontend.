import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { HoneypotField, useBotDefenseFields } from "@/hooks/useBotDefense";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { guestDataApi, type GuestDataSummary } from "@/services/guestDataApi";
import { Loader2, ShieldCheck } from "lucide-react";

type Step = "email" | "otp" | "loaded";

function formatKes(n: number): string {
  return `KES ${Number(n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Guest (no account) self-service data access/erasure — linked quietly from the footer for
 * anyone who ordered as a guest, sent an enquiry, or joined the newsletter without ever creating
 * an account. Same email-OTP proof of ownership as every other guest flow on this site.
 */
function ManageMyDataPage() {
  useEffect(() => { document.title = "View or Delete Your Data — Moments Packaging Kenya"; }, []);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<GuestDataSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const { honeypot, setHoneypot, toPayload } = useBotDefenseFields();

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await guestDataApi.requestOtp(email.trim(), toPayload(turnstileToken));
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { sessionToken: token } = await guestDataApi.verifyOtp(email.trim(), otp.trim());
      setSessionToken(token);
      const data = await guestDataApi.getMyData(email.trim(), token);
      setSummary(data);
      setStep("loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!sessionToken) return;
    if (!confirm("Request deletion of all your data with us? An admin will review it, and it will be actioned within 30 days either way.")) return;
    setBusy(true);
    setError(null);
    try {
      await guestDataApi.requestDeletion(email.trim(), sessionToken);
      setDeletionRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("email");
    setSummary(null);
    setSessionToken(null);
    setOtp("");
    setDeletionRequested(false);
    setError(null);
  };

  return (
    <SiteLayout>
      <section className="bg-cream">
        <div className="mx-auto max-w-xl px-5 py-12 sm:py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-accent">Data protection</p>
            <h1 className="mt-3 font-display text-3xl font-medium text-foreground text-balance sm:text-4xl">
              View or delete your data
            </h1>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              For guest orders, enquiries, or newsletter signups — no account needed. We'll email
              you a code to confirm it's really you.
            </p>
          </div>

          {step === "email" && (
            <form onSubmit={handleRequestOtp} className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
              <label className="block text-sm font-medium text-foreground">
                Your email address
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <HoneypotField value={honeypot} onChange={setHoneypot} />
              <div className="mt-4">
                <TurnstileWidget onToken={setTurnstileToken} />
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                Send me a code
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
              <p className="text-sm text-muted-foreground">
                If <b>{email}</b> has data with us, a 6-digit code was just sent there.
              </p>
              <label className="mt-4 block text-sm font-medium text-foreground">
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-center text-lg tracking-[0.4em] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={busy || otp.trim().length < 6}
                className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                Verify
              </button>
              <button type="button" onClick={reset} className="mt-3 w-full text-center text-xs text-muted-foreground underline">
                Use a different email
              </button>
            </form>
          )}

          {step === "loaded" && summary && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold text-foreground">Your data</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{summary.email}</p>

              {deletionRequested ? (
                <div className="mt-6 rounded-lg bg-primary/10 p-4 text-sm text-foreground">
                  Your deletion request has been submitted. We'll act on it within 30 days as
                  required by law.
                </div>
              ) : (
                <>
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Orders ({summary.orders.length})
                    </h3>
                    {summary.orders.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No guest orders on file.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {summary.orders.map((o) => (
                          <li key={o.reference} className="rounded-lg border border-border p-3 text-sm">
                            <div className="flex justify-between font-medium">
                              <span>{o.reference}</span>
                              <span>{formatKes(o.totalAmount)}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDate(o.createdAt)} — {o.status?.replace(/_/g, " ")}
                            </div>
                            {(o.city || o.county) && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {[o.deliveryAddress, o.city, o.county].filter(Boolean).join(", ")}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Enquiries ({summary.enquiries.length})
                    </h3>
                    {summary.enquiries.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No enquiries on file.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {summary.enquiries.map((en, i) => (
                          <li key={i} className="rounded-lg border border-border p-3 text-sm">
                            <div className="text-xs text-muted-foreground">{formatDate(en.createdAt)}</div>
                            {en.message && <p className="mt-1">{en.message}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-5 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Newsletter
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {summary.newsletterSubscribed ? "Subscribed" : "Not subscribed"}
                    </p>
                  </div>

                  {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
                  <button
                    onClick={() => void handleRequestDeletion()}
                    disabled={busy}
                    className="mt-6 w-full rounded-full border border-destructive px-5 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                    Request deletion of this data
                  </button>
                </>
              )}

              <button type="button" onClick={reset} className="mt-4 w-full text-center text-xs text-muted-foreground underline">
                Start over with a different email
              </button>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

export default ManageMyDataPage;

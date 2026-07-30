import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { Copy, Share2, Sparkles, Wallet, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  referralStore,
  type ReferralStatus,
  type ReferralWallet,
  type ReferralTransaction,
  type ReferralEntry,
} from "@/services/referralStore";



function fmt(n: number, currency = "KES") {
  return `${currency} ${Number(n ?? 0).toLocaleString()}`;
}

function ReferralsPage() {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [txs, setTxs] = useState<ReferralTransaction[]>([]);
  const [refs, setRefs] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await referralStore.getStatus();
      if (cancelled) return;
      setStatus(s);
      if (s.featureUnlocked && s.programEnabled) {
        const [w, t, r] = await Promise.all([
          referralStore.getWallet(),
          referralStore.getTransactions(),
          referralStore.getReferrals(),
        ]);
        if (cancelled) return;
        setWallet(w);
        setTxs(t);
        setRefs(r);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
          <div className="shimmer h-8 w-56 rounded-md" />
          <div className="shimmer mt-3 h-4 w-80 rounded-md" />
          <div className="shimmer mt-8 h-40 w-full rounded-2xl" />
        </section>
      </SiteLayout>
    );
  }

  const live = status?.featureUnlocked && status?.programEnabled;

  if (!live) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Referrals
            </p>
            <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
              Coming soon
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
              {status?.message ??
                "We're polishing our referral programme. Soon you'll earn credit every time a friend places their first order."}
            </p>
            <Link
              to="/account/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const code = wallet?.referralCode ?? "";
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/account/register?ref=${encodeURIComponent(code)}`
      : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Referral link copied");
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const shareLink = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Moments Packaging",
          text: `Use my link to get a discount at Moments Packaging Kenya`,
          url: shareUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await copyLink();
    }
  };

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Account</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Refer & earn</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share your code. Earn credit when friends place their first order.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your referral link
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Send this to a friend — it signs them up with your code automatically, no typing needed.
            </p>
            {/* Link leads, code is secondary — a new customer is far more likely to tap a
                link than to notice and manually enter a bare referral code at registration. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground"
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <button
                type="button"
                onClick={shareLink}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Or share the code directly: <code className="font-mono font-semibold text-foreground">{code || "—"}</code>
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Copy className="h-3 w-3" /> Copy code
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
              <Wallet className="h-4 w-4" /> Credit balance
            </div>
            <p className="mt-3 font-display text-4xl font-semibold">
              {fmt(wallet?.balance ?? 0, wallet?.currency ?? "KES")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs opacity-90">
              <div>
                <p className="opacity-80">Total earned</p>
                <p className="font-semibold">{fmt(wallet?.totalEarned ?? 0)}</p>
              </div>
              <div>
                <p className="opacity-80">Redeemed</p>
                <p className="font-semibold">{fmt(wallet?.totalRedeemed ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* Transactions */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg">Wallet history</h2>
            {txs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{t.type}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums font-semibold ${
                        t.amount >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {fmt(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Referrals */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Users className="h-4 w-4 text-accent" /> Your referrals
            </h2>
            {refs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Share your code to start earning.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {refs.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.refereeName ?? r.refereeEmail ?? "Anonymous"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()} · {r.status}
                      </p>
                    </div>
                    {r.reward != null && (
                      <span className="font-semibold tabular-nums text-primary">
                        +{fmt(r.reward)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

export default ReferralsPage;

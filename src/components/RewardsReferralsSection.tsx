import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Copy, Check, Share2, Users, Package, Award } from "lucide-react";
import { toast } from "sonner";
import {
  referralStore,
  type ReferralStatus,
  type ReferralWallet,
  type ReferralTransaction,
  type ReferralEntry,
  type RewardsTier,
} from "@/services/referralStore";
import { EmailVerificationCard } from "@/components/EmailVerificationCard";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Self-contained rewards + referrals panel — earns/redeems points, shares a
 * referral link, shows history. Dropped into both the Individual Shopper and
 * Business Account dashboards as a tab, since both account types earn
 * rewards identically; only the rest of each dashboard differs.
 */
export function RewardsReferralsSection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [tier, setTier] = useState<RewardsTier | null>(null);
  const [txs, setTxs] = useState<ReferralTransaction[]>([]);
  const [refs, setRefs] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await referralStore.getStatus();
      if (cancelled) return;
      setStatus(s);
      if (s.featureUnlocked && s.programEnabled) {
        const [w, t, tr, r] = await Promise.all([
          referralStore.getWallet(),
          referralStore.getMyTier(),
          referralStore.getTransactions(),
          referralStore.getReferrals(),
        ]);
        if (cancelled) return;
        setWallet(w);
        setTier(t);
        setTxs(tr);
        setRefs(r);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadWallet = () => { void referralStore.getWallet().then(setWallet); };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const live = status?.featureUnlocked && status?.programEnabled;

  if (!live) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
        <p className="font-display text-lg">Rewards program — coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {status?.message ?? "We're polishing the rewards programme. Check back soon."}
        </p>
      </div>
    );
  }

  const code = wallet?.referralCode ?? "";
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/account/register?ref=${encodeURIComponent(code)}` : "";

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Moments Packaging", text: `Use my code ${code} for a discount`, url: shareUrl });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    }
  }

  return (
    <div className="space-y-5">
      <Section icon={Award} title="Reward Coupons balance" tint="accent">
        <div className="flex items-baseline gap-1.5">
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{wallet?.balance ?? 0}</p>
          <p className="text-sm text-muted-foreground">Reward Coupons</p>
        </div>
        {tier ? (
          <p className="mt-2 text-xs text-muted-foreground">
            You're on the <span className="font-semibold text-foreground">{tier.tierName}</span> tier —{" "}
            {tier.discountPercent}% off every order{tier.perkDescription ? `, ${tier.perkDescription.toLowerCase()}` : ""}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Keep earning Reward Coupons to unlock a VIP tier.</p>
        )}
      </Section>

      <Section icon={Award} title="Your referral code" tint="accent">
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-secondary px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-foreground">
            {code || "—"}
          </code>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={shareLink}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Share2 className="h-3.5 w-3.5" /> Share link
          </button>
        </div>
        {shareUrl && <p className="mt-2.5 break-all text-xs text-muted-foreground">{shareUrl}</p>}
      </Section>

      {wallet && (
        <EmailVerificationCard
          email={user?.email ?? ""}
          emailVerified={wallet.emailVerified}
          freeRedemptionsRemaining={wallet.freeRedemptionsRemaining}
          onVerified={reloadWallet}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Section icon={Package} title="Reward Coupons history">
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{t.type.replace(/_/g, " ")}</p>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                  <span className={`font-mono text-sm font-semibold tabular-nums ${t.amount >= 0 ? "text-accent" : "text-destructive"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Users} title="Your referrals">
          {refs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Share your code to start earning.</p>
          ) : (
            <div className="space-y-2">
              {refs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{r.refereeName ?? r.refereeEmail ?? "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{r.status}</p>
                  </div>
                  {r.reward != null && (
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent">+{r.reward}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <p className="text-xs text-muted-foreground">
        Redeem Reward Coupons for a discount at{" "}
        <Link to="/cart" className="text-accent hover:underline">
          checkout
        </Link>
        .
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  tint,
}: {
  icon?: typeof Award;
  title: string;
  children: React.ReactNode;
  tint?: "accent";
}) {
  return (
    <div className={`rounded-lg border p-5 ${tint === "accent" ? "border-accent/25 bg-accent/[0.03]" : "border-border bg-background/40"}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

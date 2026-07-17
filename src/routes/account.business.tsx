import { Link } from "react-router-dom";

import { useEffect, useState, type FormEvent } from "react";
import {
  Briefcase,
  Copy,
  Check,
  MapPin,
  User,
  TrendingUp,
  Package,
  ArrowRight,
  Info,
  LayoutGrid,
  Landmark,
  FileText,
  Settings as SettingsIcon,
  Lock,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { QuickAddProductStrip } from "@/components/QuickAddProductStrip";
import { HowItWorksCard } from "@/components/HowItWorksCard";
import { InlineProgress } from "@/components/InlineProgress";
import { RewardsReferralsSection } from "@/components/RewardsReferralsSection";
import { StatCard, StatCardGrid } from "@/components/dashboard/StatCard";
import { type DashboardNavItem } from "@/components/dashboard/DashboardSidebarNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardIdentityRow } from "@/components/dashboard/DashboardIdentityRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { filterVisibleIndustries, type Industry } from "@/data/products";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import {
  businessAccountApi,
  BUSINESS_TYPE_LABELS,
  type BusinessAccount,
  type BusinessAccountInput,
  type BusinessType,
  type CreditReadiness,
  type CustomerTaxDocument,
} from "@/services/businessAccountApi";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const blankForm: BusinessAccountInput = {
  businessName: "",
  businessType: undefined,
  kraPin: "",
  location: "",
  road: "",
  buildingAddress: "",
  industryId: "",
  contactPersonName: "",
  contactPersonRole: "",
  phone: "",
};

function AccountBusinessPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <BusinessAccountBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function BusinessAccountBody() {
  const [account, setAccount] = useState<BusinessAccount | null | undefined>(undefined);
  const [industries, setIndustries] = useState<Industry[]>([]);

  useEffect(() => {
    businessAccountApi.getMine().then(setAccount).catch(() => setAccount(null));
    api.getIndustries().then((data) => setIndustries(filterVisibleIndustries(data)));
  }, []);

  if (account === undefined) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (account) {
    return <BusinessDashboard account={account} industries={industries} onUpdated={setAccount} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">Account</p>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl">Business Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A free, self-service profile for businesses ordering from Moments Packaging — track your order history and
        be first in line when trade credit accounts launch.
      </p>
      <div className="mt-8">
        <BusinessAccountForm industries={industries} onCreated={setAccount} />
      </div>
    </div>
  );
}

// ── Dashboard shell — one unified panel, internal nav rail, Stripe-style
// density: tabular-nums metrics, thin dividers instead of stacked cards,
// muted chrome that stays out of the way of the data. ──────────────────────

type TabKey = "overview" | "orders" | "rewards" | "credit" | "documents" | "settings";

// Available functionality first, "Soon" placeholders last — so the sidebar
// reads as "here's what you can do" before "here's what's coming."
const NAV_ITEMS: DashboardNavItem<TabKey>[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "orders", label: "Orders", icon: Package },
  { key: "rewards", label: "Rewards & Referrals", icon: Award },
  { key: "settings", label: "Settings", icon: SettingsIcon },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "credit", label: "Trade Credit", icon: Landmark, soon: true },
];

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function BusinessDashboard({
  account,
  industries,
  onUpdated,
}: {
  account: BusinessAccount;
  industries: Industry[];
  onUpdated: (a: BusinessAccount) => void;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);

  useEffect(() => {
    orderStore.listMine(0, 20).then((r) => setOrders(r.rows));
  }, []);

  const score = account.creditReadiness?.score;

  return (
    <DashboardShell
      navItems={NAV_ITEMS}
      activeTab={tab}
      onTabChange={setTab}
      identity={
        <DashboardIdentityRow
          icon={Briefcase}
          name={account.businessName}
          meta={`${account.businessType ? BUSINESS_TYPE_LABELS[account.businessType] : "Business"} · Opened ${new Date(account.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}`}
          badge={
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                account.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {account.status === "ACTIVE" ? "Active" : "Suspended"}
            </span>
          }
        />
      }
      stats={
        <StatCardGrid>
          <StatCard icon={TrendingUp} label="Readiness" value={score !== undefined ? `${score}/100` : "—"} />
          <StatCard icon={Package} label="Orders" value={orders !== undefined && orders !== null ? String(orders.length) : "—"} />
          <StatCard icon={Landmark} label="Lifetime spend" value={fmtKes(account.totalSpend ?? 0)} />
        </StatCardGrid>
      }
    >
      {tab === "overview" && (
        <OverviewTab account={account} orders={orders} onSeeAllOrders={() => setTab("orders")} />
      )}
      {tab === "orders" && <OrdersTab orders={orders} totalSpend={account.totalSpend ?? 0} />}
      {tab === "rewards" && <RewardsReferralsSection />}
      {tab === "credit" && <TradeCreditTab readiness={account.creditReadiness ?? null} />}
      {tab === "documents" && <DocumentsTab />}
      {tab === "settings" && (
        <SettingsTab account={account} industries={industries} onUpdated={onUpdated} />
      )}
    </DashboardShell>
  );
}

// ── Section primitive — replaces the old "everything is a rounded-2xl card"
// pattern with a lighter, denser block matching the shell it now lives in. ──

function Section({
  icon: Icon,
  title,
  action,
  children,
  tint,
}: {
  icon?: typeof Package;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tint?: "muted" | "accent";
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        tint === "accent" ? "border-accent/25 bg-accent/[0.03]" : "border-border bg-background/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        </div>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  account,
  orders,
  onSeeAllOrders,
}: {
  account: BusinessAccount;
  orders: CustomerOrder[] | null;
  onSeeAllOrders: () => void;
}) {
  const recent = orders?.slice(0, 3) ?? null;
  return (
    <div className="space-y-5">
      {account.creditReadiness && <CreditReadinessCard readiness={account.creditReadiness} compact />}

      <Section
        icon={Package}
        title="Recent orders"
        action={
          <button
            type="button"
            onClick={onSeeAllOrders}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2">
          {recent === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {recent !== null && recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders placed yet on this account.</p>
          )}
          {recent?.map((o) => <OrderRow key={o.reference} order={o} />)}
        </div>
      </Section>

      {account.welcomeCode && <WelcomeCodeCard code={account.welcomeCode} />}

      <QuickAddProductStrip cardWidthClassName="w-32 sm:w-40" />
    </div>
  );
}

// ── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ orders, totalSpend }: { orders: CustomerOrder[] | null; totalSpend: number }) {
  return (
    <Section icon={Package} title={`Orders on this account${orders ? ` (${orders.length})` : ""}`}>
      <div className="mb-4 flex items-baseline gap-1.5 border-b border-border pb-4 text-sm">
        <span className="font-mono font-semibold tabular-nums text-foreground">{fmtKes(totalSpend)}</span>
        <span className="text-xs text-muted-foreground">lifetime spend</span>
      </div>
      <div className="space-y-2">
        {orders === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {orders !== null && orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders placed yet on this account.</p>
        )}
        {orders?.map((o) => <OrderRow key={o.reference} order={o} />)}
      </div>
    </Section>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  return (
    <Link
      to={`/account/orders/${encodeURIComponent(order.reference)}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm hover:bg-secondary/40"
    >
      <div>
        <p className="font-mono text-[13px] font-medium text-foreground">{order.reference}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[13px] font-medium tabular-nums text-foreground">{fmtKes(order.total)}</p>
        <p className="text-xs text-muted-foreground">{order.status.replace(/_/g, " ")}</p>
      </div>
    </Link>
  );
}

// ── Trade Credit tab (coming soon) ────────────────────────────────────────────

const CREDIT_FEATURES = [
  { title: "Credit limit & payment terms", desc: "A running limit and net-terms window, set after a manual review of your account." },
  { title: "Invoicing on account", desc: "Order now, settle later — invoices billed against your approved limit." },
  { title: "Application tracker", desc: "See exactly where your trade-credit application stands, from documents to approval." },
  { title: "Monthly statements", desc: "A clear running balance and payment history, downloadable at any time." },
];

function TradeCreditTab({ readiness }: { readiness: CreditReadiness | null }) {
  return (
    <div className="space-y-5">
      <HowItWorksCard icon={Lock} title="Trade Credit — coming soon">
        Applications aren't open yet. When they are, your Business Account and order history — including the
        readiness score below — will be the starting point.
      </HowItWorksCard>

      {readiness && <CreditReadinessCard readiness={readiness} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {CREDIT_FEATURES.map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-foreground">{f.title}</p>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Documents tab — tax invoices requested at checkout ──────────────────────────

const DOC_STATUS_STYLES: Record<CustomerTaxDocument["status"], string> = {
  PENDING: "bg-amber-500/15 text-amber-700",
  GENERATING: "bg-blue-500/15 text-blue-700",
  SENT: "bg-emerald-500/15 text-emerald-700",
  FAILED: "bg-destructive/15 text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
};

const DOC_STATUS_LABELS: Record<CustomerTaxDocument["status"], string> = {
  PENDING: "Preparing",
  GENERATING: "Preparing",
  SENT: "Sent to your email",
  FAILED: "Couldn't be generated",
  EXPIRED: "Link expired",
};

function DocumentsTab() {
  const [docs, setDocs] = useState<CustomerTaxDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    businessAccountApi
      .myTaxDocuments()
      .then(setDocs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"));
  }, []);

  return (
    <div className="space-y-5">
      <HowItWorksCard icon={FileText} title="Tax invoices / VAT breakdowns">
        Whenever you tick "I need a tax invoice" at checkout, the PDF shows up here once it's ready — you don't need
        to dig through your inbox. Links expire 2 weeks after being sent; contact us with the order reference to get
        one resent after that.
      </HowItWorksCard>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {docs === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading your documents…</p>
      ) : docs && docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No tax invoices requested yet — tick "I need a tax invoice" at checkout on your next order to get one here.
        </p>
      ) : (
        <div className="space-y-2">
          {docs?.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{d.orderReference}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Requested {new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                  {d.sentAt && ` · Sent ${new Date(d.sentAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${DOC_STATUS_STYLES[d.status]}`}>
                  {DOC_STATUS_LABELS[d.status]}
                </span>
                {d.cloudinaryUrl && (
                  <a
                    href={d.cloudinaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <HowItWorksCard icon={Lock} title="Trade-credit document uploads — coming soon">
        Once trade credit applications open, you'll upload KRA PIN certificates, registration documents and bank
        statements here too — separate from the tax invoices above.
      </HowItWorksCard>
    </div>
  );
}

// ── Settings tab ───────────────────────────────────────────────────────────────

function SettingsTab({
  account,
  industries,
  onUpdated,
}: {
  account: BusinessAccount;
  industries: Industry[];
  onUpdated: (a: BusinessAccount) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <BusinessAccountForm
        industries={industries}
        initial={account}
        onCreated={(a) => {
          onUpdated(a);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Section
      icon={User}
      title="Business profile"
      action={
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          Edit
        </button>
      }
    >
      <dl className="grid gap-3.5 text-sm sm:grid-cols-2">
        <Row label="Business type" value={account.businessType ? BUSINESS_TYPE_LABELS[account.businessType] : "—"} />
        {account.kraPin && <Row label="KRA PIN" value={account.kraPin} />}
        <Row label="Industry" value={account.industryName ?? "—"} />
        <Row label="Location" value={account.location} />
        <Row label="Road" value={account.road} />
        <Row label="Building / address" value={account.buildingAddress} />
        <Row label="Phone" value={account.phone} />
        <Row label="Contact person" value={account.contactPersonName} />
        <Row label="Designation" value={account.contactPersonRole ?? "—"} />
      </dl>
    </Section>
  );
}

// ── Shared cards ───────────────────────────────────────────────────────────────

const READINESS_LABEL_COPY: Record<CreditReadiness["label"], string> = {
  Building: "You're just getting started — keep ordering to build your history.",
  Promising: "You're building a solid order history toward trade credit eligibility.",
  Strong: "You have a strong order history — a great position once trade credit applications open.",
};

const READINESS_BAR_COLOR: Record<CreditReadiness["label"], string> = {
  Building: "bg-amber-500",
  Promising: "bg-accent",
  Strong: "bg-emerald-500",
};

function CreditReadinessCard({ readiness, compact }: { readiness: CreditReadiness; compact?: boolean }) {
  const factors: { label: string; points: number; max: number }[] = [
    { label: "Order frequency", points: readiness.orderCountPoints, max: readiness.orderCountMax },
    { label: "Lifetime spend", points: readiness.spendPoints, max: readiness.spendMax },
    { label: "Account age", points: readiness.accountAgePoints, max: readiness.accountAgeMax },
    { label: "Recent activity", points: readiness.recencyPoints, max: readiness.recencyMax },
  ];
  const barColor = READINESS_BAR_COLOR[readiness.label];

  return (
    <div className="rounded-lg border border-border bg-background/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trade credit readiness
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
          {readiness.label}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{readiness.score}</p>
        <p className="text-sm text-muted-foreground">/ 100</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${readiness.score}%` }} />
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">{READINESS_LABEL_COPY[readiness.label]}</p>

      {!compact && (
        <>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {f.points}/{f.max}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent/70"
                    style={{ width: `${f.max > 0 ? (f.points / f.max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              This is an informational estimate only — not a credit score, and it doesn't automatically approve or
              deny anything. Trade credit applications (coming soon) will still require documents and a human
              review.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function WelcomeCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <Section icon={Check} title="Your welcome code" tint="accent">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-lg font-semibold tracking-wide text-foreground">{code}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        Enter this at checkout for a discount on orders of Ksh 5,000 or more. One-time use, valid only on this
        account, for 30 days from today. See the{" "}
        <Link to="/terms#welcome-offer" className="text-accent hover:underline">
          full offer terms
        </Link>
        .
      </p>
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function BusinessAccountForm({
  industries,
  initial,
  onCreated,
}: {
  industries: Industry[];
  initial?: BusinessAccount;
  onCreated: (a: BusinessAccount) => void;
}) {
  const [form, setForm] = useState<BusinessAccountInput>(
    initial
      ? {
          businessName: initial.businessName,
          businessType: initial.businessType ?? undefined,
          kraPin: initial.kraPin ?? "",
          location: initial.location,
          road: initial.road,
          buildingAddress: initial.buildingAddress,
          industryId: initial.industryId ?? "",
          contactPersonName: initial.contactPersonName,
          contactPersonRole: initial.contactPersonRole ?? "",
          phone: initial.phone,
        }
      : blankForm,
  );
  const [saving, setSaving] = useState(false);

  function update<K extends keyof BusinessAccountInput>(key: K, value: BusinessAccountInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = initial ? await businessAccountApi.update(form) : await businessAccountApi.create(form);
      onCreated(saved);
      toast.success(initial ? "Business account updated" : "Business account created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const wrapperCls = initial
    ? "overflow-hidden rounded-lg border border-border"
    : "mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm";

  return (
    <form onSubmit={submit} className={wrapperCls}>
      {!initial && (
        <div className="border-b border-border bg-secondary/40 px-6 py-4">
          <p className="text-sm font-medium text-foreground">Tell us about your business</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Takes about a minute. Whether you're a sole trader, an SME or a registered company —
            this account is for you.
          </p>
        </div>
      )}

      <FormSection icon={Briefcase} title="Business details">
        <Field label="Business name">
          <input required className={inputCls} value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="What you trade as" />
        </Field>
        <Field label="Business type">
          <Select value={form.businessType ?? ""} onValueChange={(v) => update("businessType", v as BusinessType)}>
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {BUSINESS_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Industry">
          <Select value={form.industryId} onValueChange={(v) => update("industryId", v)}>
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="Select an industry (optional)" />
            </SelectTrigger>
            <SelectContent>
              {industries.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <FormSection icon={MapPin} title="Business address">
        <Field label="Location">
          <input required className={inputCls} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Westlands" />
        </Field>
        <Field label="Road">
          <input required className={inputCls} value={form.road} onChange={(e) => update("road", e.target.value)} placeholder="e.g. Waiyaki Way" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Building / address">
            <input required className={inputCls} value={form.buildingAddress} onChange={(e) => update("buildingAddress", e.target.value)} placeholder="e.g. ABC Plaza, 3rd Floor" />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={User} title="Primary contact">
        <Field label="Contact person">
          <input required className={inputCls} value={form.contactPersonName} onChange={(e) => update("contactPersonName", e.target.value)} />
        </Field>
        <Field label="Designation">
          <input className={inputCls} value={form.contactPersonRole} onChange={(e) => update("contactPersonRole", e.target.value)} placeholder="e.g. Owner, Procurement Manager" />
        </Field>
        <Field label="Phone">
          <input required className={inputCls} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+254 7…" />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse items-start gap-3 border-t border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Free to open — earns a one-time welcome discount code. Read the{" "}
          <Link to="/terms#business-accounts" className="text-accent hover:underline">
            Business Account terms
          </Link>{" "}
          and{" "}
          <Link to="/terms#welcome-offer" className="text-accent hover:underline">
            welcome offer terms
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
        >
          {saving && <InlineProgress size="sm" />} {initial ? "Save changes" : "Open Business Account"}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-6 py-6 last:border-b-0">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

export default AccountBusinessPage;

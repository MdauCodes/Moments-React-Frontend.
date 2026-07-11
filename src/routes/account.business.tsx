import { Link } from "react-router-dom";

import { useEffect, useState, type FormEvent } from "react";
import {
  Briefcase,
  Copy,
  CheckCircle2,
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
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { InlineProgress } from "@/components/InlineProgress";
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
} from "@/services/businessAccountApi";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

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
      <SiteLayout>
        <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Account</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">Business Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A free, self-service profile for businesses ordering from Moments Packaging — track your order
            history and be first in line when trade credit accounts launch.
          </p>
          <BusinessAccountBody />
        </section>
      </SiteLayout>
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
    return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (account) {
    return <BusinessDashboard account={account} industries={industries} onUpdated={setAccount} />;
  }

  return <BusinessAccountForm industries={industries} onCreated={setAccount} />;
}

// ── Dashboard shell ──────────────────────────────────────────────────────────

type TabKey = "overview" | "orders" | "credit" | "documents" | "settings";

const NAV_ITEMS: { key: TabKey; label: string; icon: typeof LayoutGrid; soon?: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "orders", label: "Orders", icon: Package },
  { key: "credit", label: "Trade Credit", icon: Landmark, soon: true },
  { key: "documents", label: "Documents", icon: FileText, soon: true },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

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

  return (
    <div className="mt-10">
      <DashboardHeader account={account} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr]">
        <DashboardNav tab={tab} onChange={setTab} />

        <div>
          {tab === "overview" && (
            <OverviewTab account={account} orders={orders} onSeeAllOrders={() => setTab("orders")} />
          )}
          {tab === "orders" && <OrdersTab orders={orders} totalSpend={account.totalSpend ?? 0} />}
          {tab === "credit" && <TradeCreditTab readiness={account.creditReadiness ?? null} />}
          {tab === "documents" && <DocumentsTab />}
          {tab === "settings" && (
            <SettingsTab account={account} industries={industries} onUpdated={onUpdated} />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardHeader({ account }: { account: BusinessAccount }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Briefcase className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-xl">{account.businessName}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                account.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {account.status === "ACTIVE" ? "Active" : "Suspended"}
            </span>
            {account.businessType && <span>{BUSINESS_TYPE_LABELS[account.businessType]}</span>}
          </p>
        </div>
      </div>
      {account.welcomeCode && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Welcome code</p>
          <p className="font-display text-lg leading-tight">{account.welcomeCode}</p>
        </div>
      )}
    </div>
  );
}

function DashboardNav({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {NAV_ITEMS.map((item) => {
        const active = tab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
            {item.soon && (
              <span
                className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                Soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

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
    <div className="space-y-6">
      {account.creditReadiness && <CreditReadinessCard readiness={account.creditReadiness} compact />}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent orders</p>
          </div>
          <button
            type="button"
            onClick={onSeeAllOrders}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {recent === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {recent !== null && recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders placed yet on this account.</p>
          )}
          {recent?.map((o) => <OrderRow key={o.reference} order={o} />)}
        </div>
      </div>

      {account.welcomeCode && <WelcomeCodeCard code={account.welcomeCode} />}
    </div>
  );
}

// ── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ orders, totalSpend }: { orders: CustomerOrder[] | null; totalSpend: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-2 gap-4 border-b border-border pb-5">
        <div>
          <p className="font-display text-2xl">{orders?.length ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Orders on this account</p>
        </div>
        <div>
          <p className="font-display text-2xl">{fmtKes(totalSpend)}</p>
          <p className="text-xs text-muted-foreground">Lifetime spend</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {orders === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {orders !== null && orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No orders placed yet on this account.</p>
        )}
        {orders?.map((o) => <OrderRow key={o.reference} order={o} />)}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  return (
    <Link
      to={`/account/orders/${encodeURIComponent(order.reference)}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary/40"
    >
      <div>
        <p className="font-medium">{order.reference}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium">{fmtKes(order.total)}</p>
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-6 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
          <Lock className="h-4 w-4" />
        </span>
        <p className="mt-3 font-display text-lg">Trade Credit — coming soon</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Applications aren't open yet. When they are, your Business Account and order history — including the
          readiness score below — will be the starting point.
        </p>
      </div>

      {readiness && <CreditReadinessCard readiness={readiness} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {CREDIT_FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5 opacity-80">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{f.title}</p>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Documents tab (coming soon) ───────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { title: "KRA PIN certificate", desc: "Confirms your tax registration." },
  { title: "Business registration certificate", desc: "Certificate of incorporation, or business name registration." },
  { title: "Contact person ID", desc: "National ID or passport of the primary contact." },
  { title: "Bank/M-Pesa statement", desc: "Recent statement to support the credit assessment." },
];

function DocumentsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <p className="mt-3 font-display text-lg">Document uploads — coming soon</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Nothing to submit yet. Once trade credit applications open, you'll upload these here — no need to
          send anything over email or WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DOCUMENT_TYPES.map((d) => (
          <div key={d.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 opacity-80">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{d.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
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
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business profile</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
        >
          Edit
        </button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
    </div>
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
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trade credit readiness
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{readiness.label}</span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="font-display text-4xl">{readiness.score}</p>
        <p className="text-sm text-muted-foreground">/ 100</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${readiness.score}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{READINESS_LABEL_COPY[readiness.label]}</p>

      {!compact && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium">
                    {f.points}/{f.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent/70"
                    style={{ width: `${f.max > 0 ? (f.points / f.max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
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
  function copy() {
    navigator.clipboard.writeText(code).then(() => toast.success("Code copied"));
  }
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
      <div className="flex items-center gap-2 text-accent">
        <CheckCircle2 className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">Your welcome code</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-display text-2xl">{code}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Enter this at checkout for a discount on orders of Ksh 5,000 or more. One-time use, valid only on this
        account, for 30 days from today. See the{" "}
        <Link to="/terms#welcome-offer" className="text-accent hover:underline">
          full offer terms
        </Link>
        .
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
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

  return (
    <form onSubmit={submit} className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
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

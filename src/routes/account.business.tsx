import { Link } from "react-router-dom";

import { useEffect, useState, type FormEvent } from "react";
import { Briefcase, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { InlineProgress } from "@/components/InlineProgress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { filterVisibleIndustries, type Industry } from "@/data/products";
import { businessAccountApi, type BusinessAccount, type BusinessAccountInput } from "@/services/businessAccountApi";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

const blankForm: BusinessAccountInput = {
  businessName: "",
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
        <section className="mx-auto max-w-2xl px-5 py-12 lg:px-8 lg:py-16">
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
    return <BusinessAccountView account={account} industries={industries} onUpdated={setAccount} />;
  }

  return <BusinessAccountForm industries={industries} onCreated={setAccount} />;
}

function BusinessAccountView({
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
    <div className="mt-10">
      {account.welcomeCode && <WelcomeCodeCard code={account.welcomeCode} />}

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg">{account.businessName}</p>
              <p className="text-xs text-muted-foreground">
                {account.status === "ACTIVE" ? "Active" : "Suspended"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
          >
            Edit
          </button>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="KRA PIN" value={account.kraPin} />
          <Row label="Industry" value={account.industryName ?? "—"} />
          <Row label="Location" value={account.location} />
          <Row label="Road" value={account.road} />
          <Row label="Building / address" value={account.buildingAddress} />
          <Row label="Phone" value={account.phone} />
          <Row label="Contact person" value={account.contactPersonName} />
          <Row label="Designation" value={account.contactPersonRole ?? "—"} />
        </dl>
      </div>
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
        Enter this at checkout for a discount on your first order. One-time use, valid only on this account.
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
          kraPin: initial.kraPin,
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
    <form onSubmit={submit} className="mt-10 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
      <Field label="Registered business name">
        <input required className={inputCls} value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
      </Field>
      <Field label="KRA PIN">
        <input required className={inputCls} value={form.kraPin} onChange={(e) => update("kraPin", e.target.value)} />
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
      <Field label="Phone">
        <input required className={inputCls} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+254 7…" />
      </Field>
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
      <Field label="Contact person">
        <input required className={inputCls} value={form.contactPersonName} onChange={(e) => update("contactPersonName", e.target.value)} />
      </Field>
      <Field label="Designation">
        <input className={inputCls} value={form.contactPersonRole} onChange={(e) => update("contactPersonRole", e.target.value)} placeholder="e.g. Owner, Procurement Manager" />
      </Field>

      <div className="sm:col-span-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Opening a Business Account is free and earns you a one-time welcome discount code. Read our{" "}
          <Link to="/terms#business-accounts" className="text-accent hover:underline">
            Business Account terms
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <InlineProgress size="sm" />} {initial ? "Save changes" : "Open Business Account"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default AccountBusinessPage;

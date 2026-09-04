
import { InlineProgress } from "@/components/InlineProgress";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { profileStore, type CustomerProfile, type CustomerAddress } from "@/services/profileStore";
import { useAuth } from "@/contexts/AuthContext";
import { AccountSecuritySection } from "@/components/AccountSecuritySection";
import { PrivacyDataSection } from "@/components/PrivacyDataSection";



const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    profileStore.get().then((res) => {
      // Seed from auth user if profile is blank
      const p = res.profile;
      if (!p.firstName && user) {
        p.firstName = user.firstName;
        p.lastName = user.lastName;
        p.email = user.email;
      }
      setProfile(p);
      setPhoneDraft(p.phone);
    });
  }, [user]);

  if (!profile) {
    return (
      <ProtectedRoute>
      <DashboardPageShell>
        <section className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-muted-foreground">Loading…</section>
      </DashboardPageShell>
      </ProtectedRoute>
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const { message } = await profileStore.save(profile);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit profile update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePhone(e: FormEvent) {
    e.preventDefault();
    setSavingPhone(true);
    try {
      const updated = await profileStore.updatePhone(phoneDraft.trim());
      setProfile(updated);
      toast.success("Phone number updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update phone number.");
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <ProtectedRoute>
    <DashboardPageShell>
      <section className="mx-auto max-w-4xl px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your contact details and saved addresses. Name changes are reviewed by our team before they apply.
        </p>

        <form onSubmit={handleSave} className="mt-10 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <Field label="First name" value={profile.firstName} onChange={(v) => setProfile({ ...profile, firstName: v })} />
          <Field label="Last name" value={profile.lastName} onChange={(v) => setProfile({ ...profile, lastName: v })} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input type="email" value={profile.email} disabled className={`${inputCls} cursor-not-allowed opacity-60`} />
            <p className="mt-1 text-[11px] text-muted-foreground">Contact us to change your email address.</p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving && <InlineProgress size="sm" />} Save
            </button>
          </div>
        </form>

        {/* Split out from the name form above — phone applies immediately (see
            profileStore.updatePhone), it isn't part of the reviewed-before-applying queue. */}
        <form onSubmit={handleSavePhone} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-6">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone</label>
            <input
              className={inputCls}
              value={phoneDraft}
              placeholder="+254 7…"
              onChange={(e) => setPhoneDraft(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Applies immediately — no admin review needed.</p>
          </div>
          <button
            type="submit"
            disabled={savingPhone || phoneDraft.trim() === profile.phone}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {savingPhone && <InlineProgress size="sm" />} Save
          </button>
        </form>

        <div className="mt-6">
          <AccountSecuritySection />
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Saved addresses</h2>
            <button onClick={() => setAddOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">
              <Plus className="h-3.5 w-3.5" /> Add address
            </button>
          </div>

          {addOpen && (
            <NewAddressForm
              onCancel={() => setAddOpen(false)}
              onSaved={(p) => { setProfile(p); setAddOpen(false); toast.success("Address added"); }}
            />
          )}

          {profile.addresses.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No addresses saved yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  address={a}
                  onSetDefault={async () => {
                    const p = await profileStore.setDefault(a.id);
                    setProfile(p);
                  }}
                  onRemove={async () => {
                    const p = await profileStore.removeAddress(a.id);
                    setProfile(p);
                    toast.success("Address removed");
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10">
          <PrivacyDataSection />
        </div>
      </section>
    </DashboardPageShell>
    </ProtectedRoute>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function AddressCard({ address, onSetDefault, onRemove }: {
  address: CustomerAddress;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{address.label}</p>
          <p className="mt-1 font-semibold">{address.recipient}</p>
        </div>
        {address.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
            <Star className="h-3 w-3 fill-accent" /> Default
          </span>
        ) : (
          <button onClick={onSetDefault} className="text-[10px] text-accent hover:underline">Set default</button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{address.line1}</p>
      <p className="text-sm text-muted-foreground">{address.city}</p>
      <p className="text-sm text-muted-foreground">{address.phone}</p>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </li>
  );
}

function NewAddressForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (p: CustomerProfile) => void }) {
  const [label, setLabel] = useState("Home");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("Nairobi");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const p = await profileStore.addAddress({ label, recipient, phone, line1, city, isDefault });
      onSaved(p);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      <Field label="Label" value={label} onChange={setLabel} />
      <Field label="Recipient" value={recipient} onChange={setRecipient} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="City" value={city} onChange={setCity} />
      <div className="sm:col-span-2">
        <Field label="Address line" value={line1} onChange={setLine1} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Set as default
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving && <InlineProgress size="sm" />} Save address
        </button>
      </div>
    </form>
  );
}

export default ProfilePage;

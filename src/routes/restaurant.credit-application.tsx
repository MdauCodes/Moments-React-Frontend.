// The credit application (owner, 19 Nov 2026): Moments' customer account form, online. Needed before a
// restaurant can buy on credit; ordering and paying upfront needs none. The owner or a head fills it in,
// downloads it to print and sign (with the guarantee page), uploads the signed scan and the papers they
// have, and sends it. Moments may send it back to fix something; a Super Admin decides.
import { useEffect, useRef, useState, type ReactNode } from "react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import {
  ErrorText,
  Field,
  Muted,
  Pill,
  PortalButton,
  PortalButtonLink,
  PortalCard,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { kes, shortDate } from "@/lib/restaurantPortal";
import {
  restaurantApi,
  type ApplicationFileKind,
  type ApplicationForm,
  type CreditApplication,
  type TermsType,
} from "@/services/restaurantApi";

const FILE_KINDS: { kind: ApplicationFileKind; label: string }[] = [
  { kind: "SIGNED_FORM", label: "The signed form (all pages, with the guarantee)" },
  { kind: "INCORPORATION", label: "Certificate of incorporation" },
  { kind: "KRA_PIN", label: "KRA PIN certificate" },
  { kind: "VAT", label: "VAT certificate" },
  { kind: "DIRECTOR_ID", label: "Directors' or guarantors' ID copies" },
  { kind: "CR12", label: "CR12" },
  { kind: "GUARANTEE", label: "Signed guarantee (if separate)" },
  { kind: "OTHER", label: "Another document" },
];
const KIND_LABEL = Object.fromEntries(FILE_KINDS.map((k) => [k.kind, k.label])) as Record<
  ApplicationFileKind,
  string
>;

const TERMS: { type: TermsType; title: string; text: string }[] = [
  {
    type: "STANDARD",
    title: "Standard credit",
    text: "Pay within the agreed days. If an amount is still unpaid a full month after it's due, 3% of it is added, and again each month after. We email you before any charge is added.",
  },
  {
    type: "SHARIAH",
    title: "Shariah-compliant deferred sale (Bai' Mu'ajjal)",
    text: "Each order's price is fixed when you buy. Paying late never adds interest or a late charge; Moments may pause credit sales until overdue amounts are paid.",
  },
];

export default function RestaurantCreditApplicationPage() {
  useEffect(() => {
    document.title = "Apply for credit · Moments Packaging";
  }, []);
  return (
    <PortalShell page="statement">
      <ApplicationBody />
    </PortalShell>
  );
}

function ApplicationBody() {
  const { restaurant } = usePortal();
  const [app, setApp] = useState<CreditApplication | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    restaurantApi.creditApplication().then(setApp, (e: Error) => setError(e.message));
  };
  useEffect(load, []);

  if (restaurant.myRole === "BUYER") {
    return (
      <PortalCard className="max-w-xl">
        <h1 className="text-[22px] font-bold">Apply for credit</h1>
        <Muted className="mt-2">
          Only your restaurant's contact person or heads can apply for credit. Ask one of them.
        </Muted>
      </PortalCard>
    );
  }
  if (error && !app) {
    return (
      <PortalCard className="max-w-xl">
        <ErrorText>{error}</ErrorText>
        <PortalButton className="mt-3" onClick={load}>
          Try again
        </PortalButton>
      </PortalCard>
    );
  }
  if (!app) return <div className="h-48 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold">Apply for credit</h1>
        <Muted>
          Buy now and pay later. This is Moments' customer account form: fill it in, print it to
          sign, upload the signed copy and send it. You can save and come back at any time.
        </Muted>
      </div>
      <StatusCard app={app} />
      {app.editable ? (
        <EditableApplication app={app} onChange={setApp} />
      ) : (
        <SentApplication app={app} />
      )}
    </div>
  );
}

function StatusCard({ app }: { app: CreditApplication }) {
  const words: Record<
    CreditApplication["status"],
    { tone: "muted" | "wait" | "good" | "bad"; pill: string; text: string }
  > = {
    NEW: {
      tone: "muted",
      pill: "Not started",
      text: "We've filled in what we already know about you. Check it and add the rest.",
    },
    DRAFT: {
      tone: "muted",
      pill: "Not sent yet",
      text: "Saved. Send it when everything below is done.",
    },
    SUBMITTED: {
      tone: "wait",
      pill: "With Moments",
      text: `Sent on ${shortDate(app.submittedAt)}. Moments will check it and let you know. It can't be changed now.`,
    },
    RETURNED: {
      tone: "bad",
      pill: "Needs a change",
      text: `Moments sent it back on ${shortDate(app.returnedAt)}: ${app.returnNote ?? ""}`,
    },
    APPROVED: {
      tone: "good",
      pill: "Approved",
      text: `Approved on ${shortDate(app.decidedAt)}. Your limit and terms are on your Statement.`,
    },
    DECLINED: {
      tone: "bad",
      pill: "Not approved",
      text: "Moments didn't approve credit this time. You can still order and pay upfront, or apply again later.",
    },
  };
  const w = words[app.status];
  return (
    <PortalCard>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={w.tone}>{w.pill}</Pill>
        <span className="text-[15px]">{w.text}</span>
      </div>
      {app.status === "APPROVED" ? (
        <PortalButtonLink to="/restaurant/statement" className="mt-3">
          Open your statement
        </PortalButtonLink>
      ) : null}
    </PortalCard>
  );
}

// ------------------------------------------------------------------ filling it in

function EditableApplication({
  app,
  onChange,
}: {
  app: CreditApplication;
  onChange: (a: CreditApplication) => void;
}) {
  const [f, setF] = useState<ApplicationForm>(() => withRows(app.form));
  const [saved, setSaved] = useState(() => JSON.stringify(withRows(app.form)));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== saved;

  const set = <K extends keyof ApplicationForm>(k: K, v: ApplicationForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof ApplicationForm) => ({
    value: (f[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never),
  });
  const num = (k: "monthlyValue" | "creditRequested" | "repaymentDays") => ({
    inputMode: "numeric" as const,
    value: f[k] === null || f[k] === undefined ? "" : String(f[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(k, e.target.value.trim() === "" ? null : Number(e.target.value.replace(/,/g, ""))),
  });
  function row<T extends object>(
    k: "bankers" | "directors" | "tradeReferences" | "guarantors",
    i: number,
    field: keyof T,
    v: string,
  ) {
    setF((x) => ({
      ...x,
      [k]: (x[k] as unknown as T[]).map((r, j) => (j === i ? { ...r, [field]: v || null } : r)),
    }));
  }

  async function run(what: string, job: () => Promise<CreditApplication | void>, done?: string) {
    setBusy(what);
    setError(null);
    setNote(null);
    try {
      const next = await job();
      if (next) {
        onChange(next);
        if (what === "save") setSaved(JSON.stringify(withRows(next.form)));
      }
      if (done) setNote(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const save = () => run("save", () => restaurantApi.saveCreditApplication(f), "Saved.");

  return (
    <>
      <PortalCard>
        <h2 className="text-[17px] font-bold">Which terms?</h2>
        <div className="mt-2 flex flex-col gap-2">
          {TERMS.map((t) => (
            <label
              key={t.type}
              className="flex cursor-pointer items-start gap-3 rounded-[10px] border p-3"
              style={{ borderColor: f.termsType === t.type ? c.green : c.line }}
            >
              <input
                type="radio"
                name="terms"
                className="mt-1 h-4 w-4"
                checked={f.termsType === t.type}
                onChange={() => set("termsType", t.type)}
              />
              <span>
                <span className="block text-[15px] font-bold">{t.title}</span>
                <span className="text-[14px]" style={{ color: c.muted }}>
                  {t.text}
                </span>
              </span>
            </label>
          ))}
        </div>
      </PortalCard>

      <PortalCard>
        <h2 className="text-[17px] font-bold">A. Your business</h2>
        <Two>
          <Field label="Legal name" {...text("legalName")} />
          <Field label="Trading name (optional)" {...text("tradingName")} />
          <Field label="Postal address" placeholder="P.O. Box" {...text("postalAddress")} />
          <Field label="Business email" type="email" {...text("email")} />
          <Field label="Plot no." {...text("plotNo")} />
          <Field label="Road" {...text("road")} />
          <Field label="Telephone number(s)" {...text("phones")} />
          <Field label="Nature of business" {...text("natureOfBusiness")} />
          <Field label="KRA PIN (optional)" {...text("kraPin")} />
          <Field label="VAT no. (optional)" {...text("vatNo")} />
        </Two>
        <Sub>Your bank accounts</Sub>
        {f.bankers.map((b, i) => (
          <Two key={i}>
            <Field
              label={`Bank and branch ${i + 1}`}
              value={b.bank ?? ""}
              onChange={(e) => row<typeof b>("bankers", i, "bank", e.target.value)}
            />
            <Field
              label="Account no."
              value={b.accountNo ?? ""}
              onChange={(e) => row<typeof b>("bankers", i, "accountNo", e.target.value)}
            />
          </Two>
        ))}
        <Sub>Directors, partners or proprietors</Sub>
        {f.directors.map((d, i) => (
          <Three key={i}>
            <Field
              label={`Full name ${i + 1}`}
              value={d.name ?? ""}
              onChange={(e) => row<typeof d>("directors", i, "name", e.target.value)}
            />
            <Field
              label="Email"
              type="email"
              value={d.email ?? ""}
              onChange={(e) => row<typeof d>("directors", i, "email", e.target.value)}
            />
            <Field
              label="Telephone"
              value={d.phone ?? ""}
              onChange={(e) => row<typeof d>("directors", i, "phone", e.target.value)}
            />
          </Three>
        ))}
        <Sub>The person who handles payments</Sub>
        <Three>
          <Field label="Name" {...text("paymentsContactName")} />
          <Field label="Telephone" {...text("paymentsContactPhone")} />
          <Field label="Email" type="email" {...text("paymentsContactEmail")} />
        </Three>
      </PortalCard>

      <PortalCard>
        <h2 className="text-[17px] font-bold">B. The credit you need</h2>
        <Two>
          <Field label="About how much you buy a month (KES)" {...num("monthlyValue")} />
          <Field label="Credit you're asking for (KES)" {...num("creditRequested")} />
          <Field
            label="Days to pay after delivery"
            hint="Up to 120 days."
            {...num("repaymentDays")}
          />
          <Field
            label="How often you'd like to pay (optional)"
            placeholder="e.g. Monthly"
            {...text("paymentFrequency")}
          />
        </Two>
        <Field
          className="mt-3"
          label="Main products you'll buy (optional)"
          {...text("mainProducts")}
        />
      </PortalCard>

      <PortalCard>
        <h2 className="text-[17px] font-bold">C. Trade references</h2>
        <Muted>Other suppliers who sell to you on credit and can tell Moments how you pay.</Muted>
        {f.tradeReferences.map((r, i) => (
          <Three key={i}>
            <Field
              label={`Company ${i + 1}`}
              value={r.company ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "company", e.target.value)}
            />
            <Field
              label="P.O. Box / address"
              value={r.address ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "address", e.target.value)}
            />
            <Field
              label="Contact person"
              value={r.contactPerson ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "contactPerson", e.target.value)}
            />
            <Field
              label="Telephone"
              value={r.phone ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "phone", e.target.value)}
            />
            <Field
              label="Email"
              type="email"
              value={r.email ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "email", e.target.value)}
            />
            <Field
              label="How long you've dealt with them"
              value={r.period ?? ""}
              onChange={(e) => row<typeof r>("tradeReferences", i, "period", e.target.value)}
            />
          </Three>
        ))}
      </PortalCard>

      <PortalCard>
        <h2 className="text-[17px] font-bold">Who signs, and guarantors</h2>
        <Muted>The guarantors sign the guarantee page of the printed form.</Muted>
        <Two>
          <Field label="Name of the person signing (in full)" {...text("signatoryName")} />
          <Field
            label="Their designation"
            placeholder="e.g. Director"
            {...text("signatoryDesignation")}
          />
        </Two>
        {f.guarantors.map((g, i) => (
          <Three key={i}>
            <Field
              label={`Guarantor ${i + 1}: full name`}
              value={g.name ?? ""}
              onChange={(e) => row<typeof g>("guarantors", i, "name", e.target.value)}
            />
            <Field
              label="ID / passport no."
              value={g.idNumber ?? ""}
              onChange={(e) => row<typeof g>("guarantors", i, "idNumber", e.target.value)}
            />
            <Field
              label="Telephone"
              value={g.phone ?? ""}
              onChange={(e) => row<typeof g>("guarantors", i, "phone", e.target.value)}
            />
          </Three>
        ))}
      </PortalCard>

      <div
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-[14px] border bg-white p-3"
        style={{ borderColor: c.line }}
      >
        {dirty ? (
          <span className="text-[13px]" style={{ color: c.muted }}>
            Changes not saved
          </span>
        ) : null}
        <PortalButton disabled={!dirty || busy !== null} onClick={() => void save()}>
          {busy === "save" ? "Saving…" : "Save the form"}
        </PortalButton>
      </div>

      {app.id ? (
        <>
          <PortalCard>
            <h2 className="text-[17px] font-bold">Print, sign and upload</h2>
            <Muted>
              1. Download the filled form and print it. 2. Sign it, stamp it, and have the
              guarantors sign the guarantee page. 3. Scan or photograph every page and upload it
              here, with the papers you have.
            </Muted>
            <PortalButton
              variant="secondary"
              className="mt-3"
              disabled={dirty || busy !== null}
              onClick={() => void run("pdf", () => restaurantApi.downloadApplicationPdf())}
            >
              {busy === "pdf" ? "Preparing…" : "Download the form to sign"}
            </PortalButton>
            {dirty ? (
              <Muted className="mt-1">Save your changes first, so the printed form has them.</Muted>
            ) : null}
            <Uploads app={app} busy={busy} run={run} />
          </PortalCard>

          <PortalCard>
            <h2 className="text-[17px] font-bold">Send it to Moments</h2>
            {app.missing.length ? (
              <ul className="mt-2 list-disc pl-5 text-[14px]" style={{ color: c.muted }}>
                {app.missing.map((m) => (
                  <li key={m}>Still needed: {m}</li>
                ))}
              </ul>
            ) : (
              <Muted>
                Everything needed is here. Once sent it can't be changed, unless Moments sends it
                back.
              </Muted>
            )}
            <PortalButton
              className="mt-3"
              disabled={dirty || app.missing.length > 0 || busy !== null}
              onClick={() =>
                void run(
                  "submit",
                  () => restaurantApi.submitCreditApplication(),
                  "Sent to Moments.",
                )
              }
            >
              {busy === "submit" ? "Sending…" : "Send the application"}
            </PortalButton>
          </PortalCard>
        </>
      ) : (
        <Muted>Save the form first; then you can print it and upload the signed copy.</Muted>
      )}
      <ErrorText>{error}</ErrorText>
      {note ? (
        <p className="text-[14px] font-semibold" style={{ color: c.green }} role="status">
          {note}
        </p>
      ) : null}
    </>
  );
}

function Uploads({
  app,
  busy,
  run,
}: {
  app: CreditApplication;
  busy: string | null;
  run: (what: string, job: () => Promise<CreditApplication | void>, done?: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<ApplicationFileKind>("SIGNED_FORM");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <FileList
        app={app}
        onRemove={(id) => void run("remove", () => restaurantApi.removeApplicationFile(id))}
      />
      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        What are you uploading?
        <select
          className="min-h-11 rounded-[10px] border bg-white px-3 text-[16px]"
          style={{ borderColor: c.line }}
          value={kind}
          onChange={(e) => setKind(e.target.value as ApplicationFileKind)}
        >
          {FILE_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-semibold">
        Choose the files (PDF, JPG or PNG, up to 10 MB each)
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          className="text-[14px] font-normal"
        />
      </label>
      <PortalButton
        variant="secondary"
        disabled={busy !== null}
        onClick={() => {
          const files = Array.from(input.current?.files ?? []);
          if (!files.length)
            return void run("upload", () => Promise.reject(new Error("Choose a file first.")));
          void run(
            "upload",
            async () => {
              const next = await restaurantApi.uploadApplicationFiles(kind, files);
              if (input.current) input.current.value = "";
              return next;
            },
            "Uploaded.",
          );
        }}
      >
        {busy === "upload" ? "Uploading…" : "Upload the files"}
      </PortalButton>
    </div>
  );
}

function FileList({ app, onRemove }: { app: CreditApplication; onRemove?: (id: string) => void }) {
  if (!app.files.length) return <Muted>Nothing uploaded yet.</Muted>;
  return (
    <ul className="flex flex-col gap-2">
      {app.files.map((f) => (
        <li
          key={f.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border p-3 text-[14px]"
          style={{ borderColor: c.line }}
        >
          <span className="min-w-0">
            <span className="block font-bold">{KIND_LABEL[f.kind]}</span>
            <span style={{ color: c.muted }}>
              {f.fileName} · {shortDate(f.uploadedAt)}
            </span>
          </span>
          <span className="flex gap-2">
            <a
              className="font-bold underline"
              style={{ color: c.green }}
              href={restaurantApi.applicationFileUrl(f.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
            </a>
            {onRemove ? (
              <button
                type="button"
                className="font-bold underline"
                style={{ color: c.danger }}
                onClick={() => onRemove(f.id)}
              >
                Remove
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ sent

function SentApplication({ app }: { app: CreditApplication }) {
  const f = app.form;
  return (
    <PortalCard>
      <h2 className="text-[17px] font-bold">What you sent</h2>
      <dl className="mt-2 grid grid-cols-1 gap-2 text-[14px] sm:grid-cols-2">
        <Item label="Terms">
          {f.termsType === "SHARIAH"
            ? "Shariah-compliant deferred sale"
            : f.termsType === "STANDARD"
              ? "Standard credit"
              : "—"}
        </Item>
        <Item label="Legal name">{f.legalName ?? "—"}</Item>
        <Item label="Credit asked for">{kes(f.creditRequested)}</Item>
        <Item label="Days to pay">{f.repaymentDays ?? "—"}</Item>
        <Item label="Signed by">
          {[f.signatoryName, f.signatoryDesignation].filter(Boolean).join(", ") || "—"}
        </Item>
      </dl>
      <div className="mt-3">
        <FileList app={app} />
      </div>
    </PortalCard>
  );
}

// ------------------------------------------------------------------ bits

function withRows(f: ApplicationForm): ApplicationForm {
  const pad = <T,>(list: T[] | null | undefined, n: number, blank: T) => {
    const out = [...(list ?? [])];
    while (out.length < n) out.push({ ...blank });
    return out;
  };
  return {
    ...f,
    bankers: pad(f.bankers, 2, { bank: null, accountNo: null }),
    directors: pad(f.directors, 2, { name: null, email: null, phone: null }),
    tradeReferences: pad(f.tradeReferences, 2, {
      company: null,
      address: null,
      contactPerson: null,
      phone: null,
      email: null,
      period: null,
    }),
    guarantors: pad(f.guarantors, 2, { name: null, idNumber: null, phone: null }),
  };
}

function Two({ children }: { children: ReactNode }) {
  return <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Three({ children }: { children: ReactNode }) {
  return <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>;
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 text-[13px] font-bold uppercase tracking-wide" style={{ color: c.muted }}>
      {children}
    </h3>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt style={{ color: c.muted }}>{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

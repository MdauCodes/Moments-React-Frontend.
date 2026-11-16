// Team page (RestaurantTeam): heads and staff, the restaurant's approval rule, "Request a change"
// for the heads (the contact person asks; Moments' Director or Operations manager decides), and
// inviting staff. Only the contact person sees the buttons; the store refuses everyone else anyway.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Lock } from "lucide-react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import {
  ErrorText,
  Field,
  Muted,
  Pill,
  PortalButton,
  PortalCard,
  inputClass,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { restaurantApi, type HeadRequestRow } from "@/services/restaurantApi";
import {
  dateTime,
  describeHeadRequest,
  headRequestProblem,
  headRequestStatus,
  HEAD_REQUEST_KINDS,
  isEmail,
  ruleText,
  splitTeam,
  type ApprovalRule,
  type HeadRequestDraft,
  type HeadRequestKind,
  type TeamPerson,
} from "@/lib/restaurantPortal";

export default function RestaurantTeamPage() {
  useEffect(() => {
    document.title = "Team · Moments Packaging";
  }, []);
  return (
    <PortalShell page="team">
      <TeamBody />
    </PortalShell>
  );
}

const blankRequest: HeadRequestDraft = {
  kind: "ADD",
  memberId: "",
  fullName: "",
  rank: "",
  email: "",
  phone: "",
  approvalRule: "",
  reason: "",
};

function TeamBody() {
  const { restaurant, reload } = usePortal();
  const isOwner = restaurant.myRole === "OWNER";
  const team = splitTeam(restaurant.members, restaurant.invites);
  const signing = [restaurant.signByMpesa && "M-Pesa", restaurant.signByEmail && "email code"]
    .filter(Boolean)
    .join(" or ");

  const [requests, setRequests] = useState<HeadRequestRow[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<HeadRequestDraft>(blankRequest);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<HeadRequestRow | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await restaurantApi.headRequests());
      setRequestsError(null);
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Couldn't load requests.");
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const removable = team.heads.filter((h) => h.joined && h.role === "APPROVER" && h.memberId);
  const pending = requests.filter((r) => r.status === "PENDING");

  const setField =
    (k: keyof HeadRequestDraft) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    const problem = headRequestProblem(draft, restaurant.approvalRule);
    if (problem) return setFormError(problem);
    setBusy(true);
    setFormError(null);
    try {
      const k = draft.kind;
      const row = await restaurantApi.requestHeadChange({
        kind: k,
        memberId: k === "REMOVE" || k === "REPLACE" ? draft.memberId : undefined,
        fullName: k === "ADD" || k === "REPLACE" ? draft.fullName.trim() : undefined,
        rank: k === "ADD" || k === "REPLACE" ? draft.rank.trim() : undefined,
        email: k === "ADD" || k === "REPLACE" ? draft.email.trim() : undefined,
        phone: k === "ADD" || k === "REPLACE" ? draft.phone.trim() || undefined : undefined,
        approvalRule: k === "RULE" ? (draft.approvalRule as ApprovalRule) : undefined,
        reason: draft.reason.trim(),
      });
      setSent(row);
      setFormOpen(false);
      setDraft(blankRequest);
      await loadRequests();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't send the request.");
    } finally {
      setBusy(false);
    }
  }

  const kind = draft.kind;
  const needsPerson = kind === "ADD" || kind === "REPLACE";
  const needsMember = kind === "REMOVE" || kind === "REPLACE";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-bold">Team</h1>
        <Muted>
          Everyone at {restaurant.businessName} who can sign in. Anyone here can place an order.
        </Muted>
      </div>

      <PortalCard aria-labelledby="h-heads">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="h-heads" className="text-[18px] font-bold">
              Heads (approve orders)
            </h2>
            <Muted>
              Your rule: <strong>{ruleText(restaurant.approvalRule)}</strong> each order before it
              goes to Moments. A head's own order needs no approval here.
              {signing ? ` Heads sign by ${signing}.` : ""}
            </Muted>
          </div>
          {isOwner && !formOpen && (
            <PortalButton
              variant="secondary"
              onClick={() => {
                setSent(null);
                setFormError(null);
                setFormOpen(true);
              }}
              className="shrink-0"
            >
              Request a change
            </PortalButton>
          )}
        </div>
        <div
          className="mt-3 flex items-start gap-2 rounded-[10px] p-2.5 text-[13.5px]"
          style={{ background: c.soft, color: "#3E4842" }}
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Set when the account was opened. Only Moments' Director or Operations manager can change
            the heads or the rule, when you ask.
          </span>
        </div>
        <ul className="mt-3 flex flex-col divide-y" style={{ borderColor: c.line }}>
          {team.heads.map((h) => (
            <PersonLine
              key={h.key}
              person={h}
              badge={h.joined ? "Head" : "Invite sent, not joined"}
            />
          ))}
        </ul>

        {formOpen && (
          <form
            onSubmit={(e) => void sendRequest(e)}
            role="dialog"
            aria-label="Request a change to your heads"
            className="mt-4 flex flex-col gap-3 rounded-[12px] border p-3.5"
            style={{ borderColor: c.line, background: c.page }}
            noValidate
          >
            <div className="font-bold">Ask Moments to change your heads</div>
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              What should change
              <select
                className={inputClass}
                style={{ borderColor: c.line }}
                value={kind}
                onChange={(e) =>
                  setDraft({
                    ...blankRequest,
                    reason: draft.reason,
                    kind: e.target.value as HeadRequestKind,
                  })
                }
              >
                {HEAD_REQUEST_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            {needsMember && (
              <label className="flex flex-col gap-1 text-[14px] font-semibold">
                {kind === "REPLACE" ? "Which head steps down" : "Which head"}
                <select
                  className={inputClass}
                  style={{ borderColor: c.line }}
                  value={draft.memberId}
                  onChange={setField("memberId")}
                >
                  <option value="">Choose a head</option>
                  {removable.map((h) => (
                    <option key={h.key} value={h.memberId ?? ""}>
                      {h.name}
                      {h.rank ? ` · ${h.rank}` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[12.5px] font-normal" style={{ color: c.muted }}>
                  The contact person stays a head.
                </span>
              </label>
            )}
            {needsPerson && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field
                  label={kind === "REPLACE" ? "New head's full name" : "Full name"}
                  value={draft.fullName}
                  onChange={setField("fullName")}
                />
                <Field
                  label="Rank"
                  placeholder="e.g. Operations manager"
                  value={draft.rank}
                  onChange={setField("rank")}
                />
                <Field
                  label="Email"
                  type="email"
                  inputMode="email"
                  value={draft.email}
                  onChange={setField("email")}
                  aria-invalid={draft.email !== "" && !isEmail(draft.email)}
                />
                <Field
                  label="Phone (optional)"
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={setField("phone")}
                />
              </div>
            )}
            {kind === "RULE" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[14px] font-semibold">The rule you want</legend>
                {(["ALL", "ANY"] as const).map((r) => (
                  <label
                    key={r}
                    className="flex min-h-11 items-center gap-2.5 rounded-[10px] border bg-white px-3 text-[15px]"
                    style={{ borderColor: c.line }}
                  >
                    <input
                      type="radio"
                      name="rule"
                      value={r}
                      className="h-5 w-5"
                      checked={draft.approvalRule === r}
                      onChange={setField("approvalRule")}
                    />
                    {r === "ALL" ? "Every head approves" : "Any one head approves"}
                    {restaurant.approvalRule === r && <Pill>now</Pill>}
                  </label>
                ))}
              </fieldset>
            )}
            <Field label="Why" value={draft.reason} onChange={setField("reason")} maxLength={500} />
            <ErrorText>{formError}</ErrorText>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PortalButton type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send to Moments"}
              </PortalButton>
              <PortalButton variant="secondary" onClick={() => setFormOpen(false)} disabled={busy}>
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        {sent && (
          <div
            role="status"
            className="mt-4 rounded-[10px] p-3 text-[14px] leading-relaxed"
            style={{ background: "#FFF4D6", color: "#5A3E00" }}
          >
            <strong>Request sent {dateTime(sent.createdAt)}:</strong> {describeHeadRequest(sent)}.
            Waiting for Moments' Director or Operations manager. You'll get an email when it's
            decided.
          </div>
        )}

        {(requests.length > 0 || requestsError) && (
          <div className="mt-4">
            <h3 className="text-[15px] font-bold">
              Your requests{pending.length ? ` · ${pending.length} waiting` : ""}
            </h3>
            {requestsError && <ErrorText>{requestsError}</ErrorText>}
            <ul className="mt-2 flex flex-col gap-2">
              {requests.map((r) => {
                const st = headRequestStatus(r.status);
                return (
                  <li
                    key={r.id}
                    className="list-none rounded-[10px] border p-3 text-[14px]"
                    style={{ borderColor: c.line }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 first-letter:uppercase">
                        {describeHeadRequest(r)}
                      </span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <div className="mt-1 text-[12.5px]" style={{ color: c.muted }}>
                      Sent {dateTime(r.createdAt)}
                      {r.requestedBy ? ` by ${r.requestedBy}` : ""}
                      {r.decidedAt ? ` · decided ${dateTime(r.decidedAt)}` : ""}
                    </div>
                    {r.decisionNote && (
                      <div className="mt-1 text-[13px]" style={{ color: c.muted }}>
                        Moments: {r.decisionNote}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PortalCard>

      <StaffSection staff={team.staff} canInvite={isOwner} onInvited={reload} />
    </div>
  );
}

function StaffSection({
  staff,
  canInvite,
  onInvited,
}: {
  staff: TeamPerson[];
  canInvite: boolean;
  onInvited: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState({ fullName: "", rank: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!person.fullName.trim() || !isEmail(person.email)) {
      return setError("Enter the person's name and email.");
    }
    setBusy(true);
    setError(null);
    try {
      await restaurantApi.inviteStaff({
        fullName: person.fullName.trim(),
        rank: person.rank.trim() || undefined,
        email: person.email.trim(),
      });
      setDone(`${person.fullName.trim()} has an invite.`);
      setPerson({ fullName: "", rank: "", email: "" });
      setOpen(false);
      await onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't invite that person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalCard aria-labelledby="h-staff">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="h-staff" className="text-[18px] font-bold">
            Staff (can order)
          </h2>
          <Muted>
            {canInvite
              ? "Add staff yourself. Each gets their own invite and password."
              : "Your contact person adds staff. Each gets their own invite and password."}
          </Muted>
        </div>
        {canInvite && !open && (
          <PortalButton
            variant="secondary"
            onClick={() => {
              setDone(null);
              setOpen(true);
            }}
            className="shrink-0"
          >
            Add someone
          </PortalButton>
        )}
      </div>
      {open && (
        <form
          onSubmit={(e) => void invite(e)}
          className="mt-3 flex flex-col gap-2.5 rounded-[12px] border p-3.5"
          style={{ borderColor: c.line, background: c.page }}
          noValidate
        >
          <Field
            label="Full name"
            value={person.fullName}
            onChange={(e) => setPerson({ ...person, fullName: e.target.value })}
          />
          <Field
            label="Rank or job (optional)"
            placeholder="e.g. Store keeper"
            value={person.rank}
            onChange={(e) => setPerson({ ...person, rank: e.target.value })}
          />
          <Field
            label="Email"
            type="email"
            inputMode="email"
            value={person.email}
            onChange={(e) => setPerson({ ...person, email: e.target.value })}
          />
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PortalButton type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send the invite"}
            </PortalButton>
            <PortalButton variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </PortalButton>
          </div>
        </form>
      )}
      {done && (
        <p role="status" className="mt-3 text-[14px] font-semibold" style={{ color: c.green }}>
          {done}
        </p>
      )}
      {staff.length === 0 ? (
        <Muted className="mt-3">No staff yet.</Muted>
      ) : (
        <ul className="mt-3 flex flex-col divide-y">
          {staff.map((p) => (
            <PersonLine
              key={p.key}
              person={p}
              badge={p.joined ? "Can order" : "Invite sent, not joined"}
              waiting={!p.joined}
            />
          ))}
        </ul>
      )}
    </PortalCard>
  );
}

function PersonLine({
  person,
  badge,
  waiting,
}: {
  person: TeamPerson;
  badge: string;
  waiting?: boolean;
}) {
  const rank =
    person.role === "OWNER"
      ? [person.rank, "contact person"].filter(Boolean).join(" · ")
      : person.rank;
  return (
    <li
      className="flex list-none flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: c.line }}
    >
      <div className="min-w-0">
        <div className="break-words font-semibold">
          {person.name}
          {rank && (
            <span className="font-normal" style={{ color: c.muted }}>
              {" "}
              · {rank}
            </span>
          )}
        </div>
        <div className="break-words text-[13.5px]" style={{ color: c.muted }}>
          {[person.email, person.phone].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div>
        <Pill
          tone={waiting || !person.joined ? "wait" : person.role === "BUYER" ? "muted" : "info"}
        >
          {badge}
        </Pill>
      </div>
    </li>
  );
}

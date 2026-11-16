// The contact person's first setup after joining (RestaurantSetupPhone, steps 3-4 and the last
// frame): add the heads with their rank, invite staff, finish. After "Finish" the store locks the
// heads; from then on only Moments' Director or Operations manager changes them, on a request.
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Check } from "lucide-react";

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
import { restaurantApi } from "@/services/restaurantApi";
import {
  isEmail,
  ruleText,
  setupDoneSentence,
  splitTeam,
  type TeamPerson,
} from "@/lib/restaurantPortal";

type Stage = "heads" | "staff" | "done";

export default function RestaurantSetupPage() {
  const [stage, setStage] = useState<Stage>("heads");
  useEffect(() => {
    document.title = "Set up your restaurant · Moments Packaging";
  }, []);
  const setupStep =
    stage === "heads"
      ? { step: 3, of: 4, label: "your heads" }
      : stage === "staff"
        ? { step: 4, of: 4, label: "your staff" }
        : null;
  return (
    <PortalShell page="setup" setupStep={setupStep}>
      <SetupBody stage={stage} setStage={setStage} />
    </PortalShell>
  );
}

interface PersonDraft {
  fullName: string;
  rank: string;
  email: string;
  phone: string;
}

const blank: PersonDraft = { fullName: "", rank: "", email: "", phone: "" };

const isBlank = (d: PersonDraft) =>
  !d.fullName.trim() && !d.rank.trim() && !d.email.trim() && !d.phone.trim();

function SetupBody({ stage, setStage }: { stage: Stage; setStage: (s: Stage) => void }) {
  const { restaurant, reload } = usePortal();
  const [draft, setDraft] = useState<PersonDraft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team = splitTeam(restaurant.members, restaurant.invites);

  // Only the contact person sets up, and only once.
  if (stage !== "done" && (restaurant.myRole !== "OWNER" || restaurant.headsLocked)) {
    return <Navigate to="/restaurant" replace />;
  }

  const set = (k: keyof PersonDraft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  /** Sends the form's person, if any. Returns false when it couldn't (the error is shown). */
  async function addDraft(kind: "head" | "staff"): Promise<boolean> {
    if (isBlank(draft)) return true;
    const needsRank = kind === "head";
    if (!draft.fullName.trim() || (needsRank && !draft.rank.trim()) || !isEmail(draft.email)) {
      setError(
        needsRank ? "Enter the head's name, rank and email." : "Enter the person's name and email.",
      );
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const person = {
        fullName: draft.fullName.trim(),
        rank: draft.rank.trim() || undefined,
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
      };
      if (kind === "head") await restaurantApi.addHead({ ...person, rank: draft.rank.trim() });
      else await restaurantApi.inviteStaff(person);
      setDraft(blank);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that person.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: FormEvent, kind: "head" | "staff") {
    e.preventDefault();
    if (isBlank(draft)) {
      setError(
        kind === "head"
          ? "Enter the head's name, rank and email."
          : "Enter the person's name and email.",
      );
      return;
    }
    await addDraft(kind);
  }

  async function continueToStaff() {
    if (await addDraft("head")) {
      setError(null);
      setStage("staff");
    }
  }

  async function finish() {
    if (!(await addDraft("staff"))) return;
    setBusy(true);
    setError(null);
    try {
      await restaurantApi.finishSetup();
      setStage("done");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't finish the setup.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3">
        <div
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-full"
          style={{ background: c.green }}
        >
          <Check className="h-7 w-7 text-white" strokeWidth={3} />
        </div>
        <h1 className="text-[22px] font-bold">{restaurant.businessName} is ready to order</h1>
        <Muted>{setupDoneSentence(team.heads, team.staff, restaurant.approvalRule)}</Muted>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <PortalButtonLink to="/restaurant">Go to your home page</PortalButtonLink>
          <PortalButtonLink to="/restaurant/team" variant="secondary">
            Open the Team page
          </PortalButtonLink>
        </div>
      </div>
    );
  }

  const isHeads = stage === "heads";
  const people = isHeads ? team.heads : team.staff;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold">
          {isHeads ? "Who approves your orders?" : "Add your staff (you can do this later)"}
        </h1>
        {isHeads ? (
          <Muted className="mt-1.5">
            Add your heads. {restaurant.businessName}'s rule:{" "}
            <strong>{ruleText(restaurant.approvalRule)}</strong> each order. After this step, only
            Moments' Director or Operations manager can change the heads, when you ask.
          </Muted>
        ) : (
          <Muted className="mt-1.5">
            Staff can place orders; the heads approve them. Each one gets their own invite and
            password.
          </Muted>
        )}
      </div>

      {people.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={isHeads ? "Heads" : "Staff"}>
          {people.map((p) => (
            <PersonRow key={p.key} person={p} head={isHeads} />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => void onAdd(e, isHeads ? "head" : "staff")}
        className="flex flex-col gap-2.5 rounded-[14px] border border-dashed p-3.5"
        style={{ borderColor: c.line }}
        noValidate
      >
        <div className="text-[14px] font-bold">{isHeads ? "Add a head" : "Add someone"}</div>
        <Field
          label="Full name"
          autoComplete="off"
          value={draft.fullName}
          onChange={set("fullName")}
        />
        <Field
          label={isHeads ? "Rank" : "Rank or job (optional)"}
          placeholder={isHeads ? "e.g. General manager" : "e.g. Store keeper"}
          value={draft.rank}
          onChange={set("rank")}
        />
        <Field
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={draft.email}
          onChange={set("email")}
        />
        {isHeads && (
          <Field
            label="Phone (optional)"
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={set("phone")}
          />
        )}
        <PortalButton type="submit" variant="secondary" disabled={busy}>
          {isHeads ? "Add this head" : "Invite this person"}
        </PortalButton>
      </form>

      <ErrorText>{error}</ErrorText>

      {isHeads ? (
        <PortalButton
          onClick={() => void continueToStaff()}
          disabled={busy}
          className="min-h-[52px] text-[16px]"
        >
          Save heads and continue
        </PortalButton>
      ) : (
        <div className="flex flex-col gap-2">
          <PortalButton
            onClick={() => void finish()}
            disabled={busy}
            className="min-h-[52px] text-[16px]"
          >
            {busy ? "Finishing…" : "Finish"}
          </PortalButton>
          <PortalButton variant="secondary" onClick={() => setStage("heads")} disabled={busy}>
            Back to heads
          </PortalButton>
        </div>
      )}
    </div>
  );
}

function PersonRow({ person, head }: { person: TeamPerson; head: boolean }) {
  return (
    <li className="list-none">
      <PortalCard className="!p-3.5">
        <div className="flex items-start justify-between gap-2">
          <strong className="min-w-0 break-words">{person.name}</strong>
          {head ? (
            <Pill tone="info">{person.role === "OWNER" ? "You · head" : "Head"}</Pill>
          ) : (
            <Pill tone={person.joined ? "muted" : "wait"}>
              {person.joined ? "Can order" : "Invite sent"}
            </Pill>
          )}
        </div>
        <div className="mt-0.5 break-words text-[13.5px]" style={{ color: c.muted }}>
          {[person.rank, person.email].filter(Boolean).join(" · ")}
        </div>
        {person.phone && (
          <div className="text-[13.5px]" style={{ color: c.muted }}>
            {person.phone}
          </div>
        )}
      </PortalCard>
    </li>
  );
}

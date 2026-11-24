import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { PasswordInput } from "@/components/PasswordInput";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { STAFF_ADDRESSES } from "@/config/staff";
import { callbackUrl, resolveNext, storeAdminTileOpen, type HandoffTarget } from "@/lib/staffLink";
import {
  checkCrmAccess,
  clearSession,
  handoffWithRefresh,
  logoutStaff,
  readSession,
  staffLogin,
  staffVerify,
  StaffApiError,
  writeDeviceToken,
  writeSession,
  type StaffSession,
} from "./staffApi";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent/50";
const btnCls =
  "inline-flex w-full min-h-11 items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Moments staff
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

/** Hand over to an app: ask the store for a code, then go to that app's callback. */
async function handOver(
  session: StaffSession,
  target: HandoffTarget,
  origin: string,
  nextPath?: string,
): Promise<"redirected" | "signed-out"> {
  const code = await handoffWithRefresh(session, target);
  if (!code) return "signed-out";
  window.location.assign(callbackUrl(origin, target, code, nextPath));
  return "redirected";
}

function describeError(e: unknown): string {
  if (e instanceof StaffApiError) {
    if (e.status === 0 || e.status >= 500)
      return "The sign-in service is not responding. Please try again in a moment.";
    if (e.status === 429 || e.code === "TOO_MANY_TRIES")
      return "Too many tries. Wait a few minutes, then start again.";
    if (e.status === 401) return "Wrong email or password.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get("next");
  const resolved = resolveNext(nextParam, STAFF_ADDRESSES, window.location.hostname);
  const nextTarget = resolved?.target;
  const nextOrigin = resolved?.origin;
  const nextPath = resolved?.path;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstile, setTurnstile] = useState("");
  const [challengeNeeded, setChallengeNeeded] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(() => !!readSession());
  const codeRef = useRef<HTMLInputElement>(null);

  /** Goes on after sign-in: straight to the wanted app, or to the chooser. */
  const proceed = useCallback(
    async (session: StaffSession): Promise<boolean> => {
      if (!nextTarget || !nextOrigin) {
        navigate("/choose", { replace: true });
        return true;
      }
      return (await handOver(session, nextTarget, nextOrigin, nextPath)) === "redirected";
    },
    [navigate, nextTarget, nextOrigin, nextPath],
  );

  // Already signed in on this browser: carry on straight away.
  useEffect(() => {
    const s = readSession();
    if (!s) return;
    let cancelled = false;
    proceed(s)
      .then((ok) => {
        if (ok) return;
        clearSession();
        if (!cancelled) setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proceed]);

  useEffect(() => {
    if (challengeId) codeRef.current?.focus();
  }, [challengeId]);

  async function finish(session: StaffSession) {
    writeSession(session);
    try {
      await proceed(session);
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const a = await staffLogin(email.trim(), password, turnstile);
      if (a.kind === "CUSTOMER") {
        window.location.assign(`${STAFF_ADDRESSES.shopUrl.replace(/\/+$/, "")}/account`);
        return;
      }
      if (a.kind === "CODE_REQUIRED") {
        setChallengeId(a.challengeId);
        setEmailHint(a.emailHint);
        setCode("");
        return;
      }
      await finish(a);
    } catch (err) {
      if (err instanceof StaffApiError && err.code === "CHALLENGE_REQUIRED") {
        setChallengeNeeded(true);
        setError("Please complete the security check below and try again.");
      } else {
        setError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError("");
    try {
      const a = await staffVerify(challengeId, code.trim(), remember);
      if (a.deviceToken) writeDeviceToken(a.deviceToken);
      await finish({
        accessToken: a.accessToken,
        refreshToken: a.refreshToken,
        user: a.user,
        staff: a.staff,
      });
    } catch (err) {
      if (err instanceof StaffApiError && err.code === "WRONG_CODE") {
        setError("That code is not right. Check the email and try again.");
      } else if (err instanceof StaffApiError && err.code === "CODE_EXPIRED") {
        setError("That code has expired. Sign in again to get a new one.");
        setChallengeId(null);
      } else if (
        err instanceof StaffApiError &&
        (err.code === "TOO_MANY_TRIES" || err.status === 429)
      ) {
        setError("Too many wrong tries. Sign in again to get a new code.");
        setChallengeId(null);
      } else {
        setError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <Shell title="Signing you in">
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          One moment…
        </p>
      </Shell>
    );
  }

  if (challengeId) {
    return (
      <Shell title="Check your email">
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code{emailHint ? ` to ${emailHint}` : ""}. It works for 10 minutes.
        </p>
        <form onSubmit={submitCode} className="mt-6 space-y-4">
          <div>
            <label htmlFor="staff-code" className="mb-1.5 block text-sm font-medium">
              Code
            </label>
            <input
              id="staff-code"
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${inputCls} text-center tracking-[0.4em]`}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember this device
          </label>
          {error && <ErrorLine message={error} />}
          <button type="submit" disabled={busy || code.length !== 6} className={btnCls}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <button
            type="button"
            className="min-h-11 w-full text-sm text-muted-foreground underline"
            onClick={() => {
              setChallengeId(null);
              setError("");
            }}
          >
            Back to sign-in
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Staff sign-in">
      <form onSubmit={submitCredentials} className="mt-6 space-y-4">
        <div>
          <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            required
            autoComplete="username"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="staff-password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <PasswordInput
            id="staff-password"
            required
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {challengeNeeded && <TurnstileWidget onToken={setTurnstile} />}
        {error && <ErrorLine message={error} />}
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}

type TileState = "checking" | "open" | "faded";

function Tile({
  title,
  blurb,
  state,
  later,
  onOpen,
  busy,
}: {
  title: string;
  blurb: string;
  state: TileState;
  later?: boolean;
  onOpen?: () => void;
  busy?: boolean;
}) {
  const faded = state === "faded" || later;
  return (
    <button
      type="button"
      disabled={faded || state === "checking" || busy}
      onClick={onOpen}
      className={`min-h-24 w-full rounded-2xl border border-border bg-background p-4 text-left transition ${
        faded ? "opacity-50" : "hover:border-accent/60 hover:shadow-sm"
      }`}
    >
      <span className="block font-display text-lg">{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{blurb}</span>
      {later ? (
        <span className="mt-2 block text-xs font-medium text-muted-foreground">Coming later</span>
      ) : state === "faded" ? (
        <span className="mt-2 block text-xs font-medium text-muted-foreground">
          Ask an admin for access
        </span>
      ) : state === "checking" ? (
        <span className="mt-2 block text-xs text-muted-foreground">Checking access…</span>
      ) : null}
    </button>
  );
}

function Chooser() {
  const navigate = useNavigate();
  const [session, setSession] = useState<StaffSession | null>(() => readSession());
  const [crm, setCrm] = useState<TileState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accessToken = session?.accessToken;

  useEffect(() => {
    if (!session) navigate("/", { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void checkCrmAccess(accessToken).then((ok) => {
      if (!cancelled) setCrm(ok ? "open" : "faded");
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!session) return null;
  const store: TileState = storeAdminTileOpen(session.staff?.permissions) ? "open" : "faded";

  async function open(target: HandoffTarget) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const origin = target === "CRM" ? STAFF_ADDRESSES.crmUrl : STAFF_ADDRESSES.shopUrl;
      const r = await handOver(session, target, origin);
      if (r === "signed-out") {
        clearSession();
        setSession(null);
      }
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  }

  const name =
    [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ") ||
    session.user?.email;
  return (
    <Shell title="Where to?">
      {name && <p className="mt-2 text-sm text-muted-foreground">Signed in as {name}</p>}
      <div className="mt-6 grid gap-3">
        <Tile
          title="CRM"
          blurb="Leads, enquiries and customers"
          state={crm}
          busy={busy}
          onOpen={() => open("CRM")}
        />
        <Tile
          title="Store admin"
          blurb="Orders, products and settings"
          state={store}
          busy={busy}
          onOpen={() => open("STORE_ADMIN")}
        />
        <Tile title="Core / ERP" blurb="Stock, finance and operations" state="faded" later />
      </div>
      {error && <ErrorLine message={error} />}
      <button
        type="button"
        className="mt-6 min-h-11 w-full rounded-full border border-border px-6 py-3 text-sm font-semibold hover:border-accent/50"
        onClick={async () => {
          await logoutStaff(session);
          setSession(null);
        }}
      >
        Sign out
      </button>
    </Shell>
  );
}

export default function StaffApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/choose" element={<Chooser />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

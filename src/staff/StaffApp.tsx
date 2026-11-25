import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, LayoutDashboard, LogOut, Store, type LucideIcon } from "lucide-react";
import logo from "@/assets/moments_logo_without_background.png";
import { PasswordInput } from "@/components/PasswordInput";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { STAFF_ADDRESSES } from "@/config/staff";
import {
  callbackUrl,
  hasSignedOutFlag,
  resolveNext,
  storeAdminTileOpen,
  withoutSignedOut,
  type HandoffTarget,
} from "@/lib/staffLink";
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

// CRM look (tokens from the CRM's styles.css): cream page, deep green bar, 1px borders, 4px corners.
const inputCls =
  "h-10 w-full rounded-[4px] border border-[#d9d2c3] bg-white px-3 text-base text-[#17241c] placeholder:text-[#8a948d] focus:border-[#1f6b45] focus:outline-none focus:ring-1 focus:ring-[#1f6b45] md:text-sm";
const btnCls =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-[#1f6b45] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#1a5c3b] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1f6b45] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
const btnOutlineCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[4px] border border-[#d9d2c3] bg-white px-3 text-[13px] font-medium text-[#17241c] transition-colors hover:bg-[#f1ece0] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1f6b45]";
const labelCls = "mb-1 block text-[13px] font-medium text-[#17241c]";

function Shell({
  title,
  children,
  wide,
  aside,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  aside?: ReactNode;
}) {
  useEffect(() => {
    document.title = "Moments Staff";
  }, []);
  return (
    <div className="flex min-h-dvh flex-col bg-[#faf7f0] font-sans text-[#17241c]">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-[#1f3a2b] bg-[#13261b] px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 items-center rounded-[4px] bg-white px-2">
            <img src={logo} alt="Moments" className="h-7 w-auto" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Moments Staff</span>
        </div>
        {aside}
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-10">
        <div
          className={`w-full ${wide ? "max-w-xl" : "max-w-sm"} rounded-[6px] border border-[#e6e0d4] bg-white p-5 shadow-[0_1px_2px_rgba(30,30,20,0.05)] sm:p-6`}
        >
          <h1 className="font-sans text-[17px] font-semibold leading-tight tracking-tight">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[4px] border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800"
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
  // `?signedout=1` (a deliberate sign-out elsewhere): really sign out here, never auto-proceed.
  const signedOutRequested = useRef(hasSignedOutFlag(window.location.search));
  const [checking, setChecking] = useState(() => !signedOutRequested.current && !!readSession());
  const autoRan = useRef(false);
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
    // StrictMode runs effects twice: only one hand-over (one code) may be requested.
    if (autoRan.current) return;
    autoRan.current = true;
    if (signedOutRequested.current) {
      const s = readSession();
      window.history.replaceState(
        null,
        "",
        withoutSignedOut(window.location.pathname, window.location.search, window.location.hash),
      );
      void logoutStaff(s).finally(() => {
        clearSession();
      });
      return;
    }
    const s = readSession();
    if (!s) return;
    proceed(s)
      .then((ok) => {
        if (ok) return;
        clearSession();
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
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
        <p role="status" className="mt-3 text-[13px] text-[#56615a]">
          One moment…
        </p>
      </Shell>
    );
  }

  if (challengeId) {
    return (
      <Shell title="Check your email">
        <p className="mt-1.5 text-[13px] text-[#56615a]">
          We sent a 6-digit code{emailHint ? ` to ${emailHint}` : ""}. It works for 10 minutes.
        </p>
        <form onSubmit={submitCode} className="mt-4 space-y-3">
          <div>
            <label htmlFor="staff-code" className={labelCls}>
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
          <label className="flex min-h-9 items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#1f6b45]"
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
            className="min-h-9 w-full text-[13px] text-[#56615a] underline hover:text-[#17241c]"
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
      <form onSubmit={submitCredentials} className="mt-4 space-y-3">
        <div>
          <label htmlFor="staff-email" className={labelCls}>
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
          <label htmlFor="staff-password" className={labelCls}>
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
        <a
          href={`${STAFF_ADDRESSES.shopUrl.replace(/\/+$/, "")}/admin/forgot-password`}
          className="block min-h-9 py-2 text-center text-[13px] text-[#56615a] underline hover:text-[#17241c]"
        >
          Forgot password?
        </a>
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
  Icon,
}: {
  title: string;
  blurb: string;
  state: TileState;
  later?: boolean;
  onOpen?: () => void;
  busy?: boolean;
  Icon: LucideIcon;
}) {
  const faded = state === "faded" || later;
  const note = later
    ? "Coming later"
    : state === "faded"
      ? "Ask an admin for access"
      : state === "checking"
        ? "Checking access…"
        : null;
  return (
    <button
      type="button"
      disabled={faded || state === "checking" || busy}
      onClick={onOpen}
      className={`flex min-h-16 w-full items-center gap-3 rounded-[6px] border border-[#e6e0d4] bg-white p-3 text-left transition-colors ${
        faded
          ? "cursor-not-allowed bg-[#f6f3ea] opacity-60"
          : "hover:border-[#1f6b45] hover:bg-[#f3f8f4]"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#e7f1ea] text-[#1f6b45]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[13px] text-[#56615a]">{blurb}</span>
        {note && <span className="mt-0.5 block text-xs font-medium text-[#56615a]">{note}</span>}
      </span>
      {!faded && state !== "checking" && (
        <ArrowRight className="h-4 w-4 shrink-0 text-[#56615a]" aria-hidden />
      )}
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
    const current = readSession();
    if (!current) return;
    void checkCrmAccess(current).then((ok) => {
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
    <Shell
      title="Where to?"
      wide
      aside={
        <div className="flex items-center gap-3">
          {name && <span className="hidden text-[13px] text-white/80 sm:inline">{name}</span>}
        </div>
      }
    >
      {name && <p className="mt-1.5 text-[13px] text-[#56615a]">Signed in as {name}</p>}
      <div className="mt-4 grid gap-2">
        <Tile
          Icon={LayoutDashboard}
          title="CRM"
          blurb="Leads, enquiries and customers"
          state={crm}
          busy={busy}
          onOpen={() => open("CRM")}
        />
        <Tile
          Icon={Store}
          title="Store admin"
          blurb="Orders, products and settings"
          state={store}
          busy={busy}
          onOpen={() => open("STORE_ADMIN")}
        />
        <Tile Icon={Boxes} title="Core / ERP" blurb="Stock, finance and operations" state="faded" later />
      </div>
      {error && (
        <div className="mt-3">
          <ErrorLine message={error} />
        </div>
      )}
      <button
        type="button"
        className={`${btnOutlineCls} mt-4 w-full sm:w-auto`}
        onClick={async () => {
          await logoutStaff(session);
          setSession(null);
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> Sign out
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

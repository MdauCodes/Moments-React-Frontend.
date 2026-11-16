import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { ClipboardList, FileText, Home, LayoutGrid, Store, Users } from "lucide-react";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { restaurantApi, type MyRestaurant } from "@/services/restaurantApi";
import { badgeLetters, brandColor, roleLabel, textOn } from "@/lib/restaurantPortal";
import { PortalButtonLink, PortalCard, portalColors as c } from "./portalUi";

export type PortalPage = "home" | "catalogue" | "orders" | "statement" | "team" | "setup";

interface PortalContextValue {
  restaurant: MyRestaurant;
  reload: () => Promise<MyRestaurant | null>;
  /** The signed-in person as a member of this restaurant (null only if the list lags behind). */
  me: MyRestaurant["members"][number] | null;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalShell");
  return ctx;
}

const NAV: { page: PortalPage; to: string; label: string; icon: typeof Home }[] = [
  { page: "home", to: "/restaurant", label: "Home", icon: Home },
  { page: "catalogue", to: "/restaurant/catalogue", label: "Catalogue", icon: LayoutGrid },
  { page: "orders", to: "/restaurant/orders", label: "Orders", icon: ClipboardList },
  { page: "statement", to: "/restaurant/statement", label: "Statement", icon: FileText },
  { page: "team", to: "/restaurant/team", label: "Team", icon: Users },
];

interface ShellProps {
  page: PortalPage;
  children: ReactNode;
  /** Setup only: replaces the nav with a step bar ("Step 3 of 4 · your heads"). */
  setupStep?: { step: number; of: number; label: string } | null;
}

/** Sign-in gate, the restaurant's own header and the portal nav around every portal page. */
export function PortalShell(props: ShellProps) {
  return (
    <ProtectedRoute>
      <PortalLoader {...props} />
    </ProtectedRoute>
  );
}

function PortalLoader({ page, children, setupStep }: ShellProps) {
  const [restaurant, setRestaurant] = useState<MyRestaurant | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await restaurantApi.mine();
      setRestaurant(r);
      setError(null);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your restaurant.");
      return null;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error && restaurant === undefined) {
    return (
      <Frame>
        <Notice title="Couldn't open your restaurant" text={error}>
          <button
            type="button"
            onClick={() => void reload()}
            className="min-h-11 rounded-[10px] px-5 font-semibold text-white"
            style={{ background: c.green }}
          >
            Try again
          </button>
        </Notice>
      </Frame>
    );
  }
  if (restaurant === undefined) {
    return (
      <Frame>
        <div className="mx-auto w-full max-w-5xl space-y-3 p-4" aria-busy="true">
          <div className="h-20 animate-pulse rounded-2xl bg-black/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
        </div>
      </Frame>
    );
  }
  if (restaurant === null) {
    return (
      <Frame>
        <Notice
          title="This page is for restaurant accounts"
          text="Your account isn't part of a restaurant with Moments. If you were invited, open the link in the invite email to join with your code."
        >
          <PortalButtonLink to="/account/dashboard">Go to your account</PortalButtonLink>
        </Notice>
      </Frame>
    );
  }
  // The contact person finishes the first setup before anything else.
  if (page !== "setup" && restaurant.myRole === "OWNER" && !restaurant.headsLocked) {
    return <Navigate to="/restaurant/setup" replace />;
  }
  return (
    <PortalFrame page={page} restaurant={restaurant} reload={reload} setupStep={setupStep}>
      {children}
    </PortalFrame>
  );
}

function PortalFrame({
  page,
  restaurant,
  reload,
  setupStep,
  children,
}: ShellProps & { restaurant: MyRestaurant; reload: () => Promise<MyRestaurant | null> }) {
  const { user } = useAuth();
  const me =
    restaurant.members.find((m) => user && m.email.toLowerCase() === user.email.toLowerCase()) ??
    null;
  const brand = brandColor(restaurant.brandColor);
  const ink = textOn(brand);
  const myName = me?.name ?? (user ? `${user.firstName} ${user.lastName}`.trim() : "");
  const inSetup = page === "setup";

  return (
    <PortalContext.Provider value={{ restaurant, reload, me }}>
      <Frame>
        <header style={{ background: brand, color: ink }}>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3">
              {restaurant.brandLogoUrl ? (
                <img
                  src={restaurant.brandLogoUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-[9px] bg-white object-contain"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-sm font-bold"
                  style={{ background: c.gold, color: c.ink }}
                >
                  {badgeLetters(restaurant.businessName, restaurant.restaurantCode)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">
                  {restaurant.businessName}
                  {inSetup ? " · setting up" : ""}
                </div>
                {!inSetup && (
                  <div className="truncate text-[12.5px] opacity-85">
                    {myName}
                    {myName ? " · " : ""}
                    {roleLabel(restaurant.myRole)}
                  </div>
                )}
              </div>
              <Link
                to="/products"
                className="hidden min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold underline-offset-4 hover:underline sm:inline-flex"
                style={{ color: ink }}
              >
                <Store className="h-4 w-4" aria-hidden="true" /> Moments shop
              </Link>
            </div>
            {setupStep ? (
              <div>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${setupStep.of}, minmax(0, 1fr))` }}
                  aria-hidden="true"
                >
                  {Array.from({ length: setupStep.of }, (_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full"
                      style={{
                        background: i < setupStep.step ? c.gold : "rgba(255,255,255,0.28)",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 text-[12.5px] opacity-85">
                  Step {setupStep.step} of {setupStep.of} · {setupStep.label}
                </div>
              </div>
            ) : (
              !inSetup && (
                <nav aria-label="Portal" className="hidden gap-1 sm:flex">
                  {NAV.map((n) => (
                    <Link
                      key={n.page}
                      to={n.to}
                      aria-current={n.page === page ? "page" : undefined}
                      className="inline-flex min-h-11 items-center rounded-[10px] px-3.5 text-sm font-semibold"
                      style={
                        n.page === page
                          ? { background: "rgba(255,255,255,0.18)", color: ink }
                          : { color: ink, opacity: 0.85 }
                      }
                    >
                      {n.label}
                    </Link>
                  ))}
                </nav>
              )
            )}
          </div>
        </header>
        <main
          className={`mx-auto w-full max-w-5xl flex-1 px-4 py-5 ${inSetup ? "" : "pb-24 sm:pb-8"}`}
        >
          {children}
        </main>
        {!inSetup && (
          <nav
            aria-label="Portal"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white sm:hidden"
            style={{ borderColor: c.line, paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = n.page === page;
              return (
                <Link
                  key={n.page}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold"
                  style={{ color: active ? c.green : c.muted }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </Frame>
    </PortalContext.Provider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background: c.page,
        color: c.ink,
        fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <PortalCard>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: c.muted }}>
          {text}
        </p>
        {children && <div className="mt-4">{children}</div>}
      </PortalCard>
    </div>
  );
}

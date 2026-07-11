import { ReactNode, useEffect, useRef } from "react";
import { LogIn } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { SiteLayout } from "@/components/SiteLayout";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const triggered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated && !triggered.current) {
      triggered.current = true;
      openLogin();
    }
    if (isAuthenticated) {
      triggered.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    // Stays on the same URL — the login modal opens on top. This fallback
    // (with full site chrome, so it doesn't look broken) only shows if
    // someone dismisses the modal without signing in.
    return (
      <SiteLayout>
        <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <LogIn className="h-5 w-5" />
          </span>
          <p className="mt-4 font-display text-xl text-foreground">Sign in to continue</p>
          <p className="mt-1.5 text-sm text-muted-foreground">You need an account to view this page.</p>
          <button
            type="button"
            onClick={() => openLogin()}
            className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </button>
        </div>
      </SiteLayout>
    );
  }

  return <>{children}</>;
}

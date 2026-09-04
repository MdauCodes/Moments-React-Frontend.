import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getStoredReferralCode } from "@/lib/referralAttribution";

export type AuthModalMode = null | "login" | "register";
export type ModalAccountType = "INDIVIDUAL_SHOPPER" | "BUSINESS";

interface OpenLoginOpts {
  returnUrl?: string;
}

interface OpenRegisterOpts {
  returnUrl?: string;
  accountType?: ModalAccountType;
  referralCode?: string;
}

interface AuthModalState {
  mode: AuthModalMode;
  returnUrl?: string;
  preselectAccountType?: ModalAccountType;
  referralCode?: string;
}

interface AuthModalContextValue extends AuthModalState {
  openLogin: (opts?: OpenLoginOpts) => void;
  openRegister: (opts?: OpenRegisterOpts) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined);

const initialState: AuthModalState = { mode: null };

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthModalState>(initialState);

  const openLogin = useCallback((opts?: OpenLoginOpts) => {
    setState({ mode: "login", returnUrl: opts?.returnUrl });
  }, []);

  const openRegister = useCallback((opts?: OpenRegisterOpts) => {
    setState({
      mode: "register",
      returnUrl: opts?.returnUrl,
      preselectAccountType: opts?.accountType,
      // No caller today ever passes an explicit referralCode when opening the modal (unlike the
      // standalone /account/register?ref= page) — falling back to whatever ReferralCapture
      // stored from an earlier page means a referred visitor who signs up via the header "Sign
      // up" button (the modal, not that dedicated page) still gets correctly attributed.
      referralCode: opts?.referralCode ?? getStoredReferralCode(),
    });
  }, []);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<AuthModalContextValue>(
    () => ({ ...state, openLogin, openRegister, close }),
    [state, openLogin, openRegister, close],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

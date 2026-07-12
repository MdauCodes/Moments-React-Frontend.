import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AuthModalMode = null | "login" | "register" | "verify";
export type ModalAccountType = "SOLE_MERCHANT" | "BUSINESS";

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
  pendingEmail?: string;
  pendingAccountType?: ModalAccountType;
  referralCode?: string;
}

interface AuthModalContextValue extends AuthModalState {
  openLogin: (opts?: OpenLoginOpts) => void;
  openRegister: (opts?: OpenRegisterOpts) => void;
  goToVerify: (email: string, accountType?: ModalAccountType) => void;
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
      referralCode: opts?.referralCode,
    });
  }, []);

  const goToVerify = useCallback((email: string, accountType?: ModalAccountType) => {
    setState((prev) => ({ ...prev, mode: "verify", pendingEmail: email, pendingAccountType: accountType }));
  }, []);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<AuthModalContextValue>(
    () => ({ ...state, openLogin, openRegister, goToVerify, close }),
    [state, openLogin, openRegister, goToVerify, close],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

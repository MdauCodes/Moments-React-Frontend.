import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiUrl } from "@/config/api";

export interface SiteConfig {
  blogsEnabled: boolean;
  emailCaptureEnabled: boolean;
  maintenanceMode: boolean;
  whatsappNumber: string;
  companyEmail: string;
  companyPhone: string;
  businessKraPin: string;
}

const DEFAULTS: SiteConfig = {
  blogsEnabled: true,
  emailCaptureEnabled: true,
  maintenanceMode: false,
  whatsappNumber: "254119556688",
  companyEmail: "info@momentspackaging.com",
  companyPhone: "0119 556 688",
  businessKraPin: "",
};

const LS_KEY = "moments_maintenance_override";

function readOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("maintenance");
  if (param === "on" || param === "true" || param === "1") {
    localStorage.setItem(LS_KEY, "on");
    return true;
  }
  if (param === "off" || param === "false" || param === "0") {
    localStorage.setItem(LS_KEY, "off");
    return false;
  }
  if (param === "clear") {
    localStorage.removeItem(LS_KEY);
    return null;
  }
  const stored = localStorage.getItem(LS_KEY);
  if (stored === "on") return true;
  if (stored === "off") return false;
  return null;
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(s)) return true;
    if (["false", "0", "off", "no"].includes(s)) return false;
  }
  return fallback;
}

const SiteConfigContext = createContext<SiteConfig>(DEFAULTS);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(() => {
    const override = readOverride();
    return override !== null ? { ...DEFAULTS, maintenanceMode: override } : DEFAULTS;
  });

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/v1/public/config"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const override = readOverride();
        const backendMaintenance = data
          ? parseBool(data.maintenanceMode, DEFAULTS.maintenanceMode)
          : DEFAULTS.maintenanceMode;
        setConfig({
          blogsEnabled: data?.blogsEnabled ?? DEFAULTS.blogsEnabled,
          emailCaptureEnabled: data?.emailCaptureEnabled ?? DEFAULTS.emailCaptureEnabled,
          maintenanceMode: override !== null ? override : backendMaintenance,
          whatsappNumber: data?.whatsappNumber ?? DEFAULTS.whatsappNumber,
          companyEmail: data?.companyEmail ?? DEFAULTS.companyEmail,
          companyPhone: data?.companyPhone ?? DEFAULTS.companyPhone,
          businessKraPin: data?.businessKraPin ?? DEFAULTS.businessKraPin,
        });
      })
      .catch(() => {
        const override = readOverride();
        if (override !== null) {
          setConfig((c) => ({ ...c, maintenanceMode: override }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

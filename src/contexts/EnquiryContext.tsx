import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Site-wide "ask us" panel. Any button anywhere (the floating Enquire button, the header, a product
 * page, the empty search results, the footer) calls openEnquiry(); the panel itself is mounted once,
 * here, and loaded lazily the first time it is opened so it costs nothing on the pages people just browse.
 */

export const ENQUIRY_TOPICS = [
  { code: "product", label: "A product or price" },
  { code: "bulk", label: "Bulk or custom order" },
  { code: "printing", label: "Printing & branding" },
  { code: "order", label: "Delivery or an order" },
  { code: "other", label: "Something else" },
] as const;

export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number]["code"];

export interface EnquiryProduct {
  id?: string;
  name: string;
  slug?: string;
}

export interface EnquiryOpenOptions {
  topic?: EnquiryTopic;
  /** The product the visitor is looking at, when they open the panel from a product page. */
  product?: EnquiryProduct;
  /** Pre-filled message; the visitor can edit it. */
  message?: string;
}

interface EnquiryContextValue {
  isOpen: boolean;
  options: EnquiryOpenOptions;
  openEnquiry: (options?: EnquiryOpenOptions) => void;
  closeEnquiry: () => void;
}

const EnquiryContext = createContext<EnquiryContextValue | null>(null);

const QuickEnquirySheet = lazy(() =>
  import("@/components/QuickEnquirySheet").then((m) => ({ default: m.QuickEnquirySheet })),
);

export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [options, setOptions] = useState<EnquiryOpenOptions>({});

  const openEnquiry = useCallback((next: EnquiryOpenOptions = {}) => {
    setOptions(next);
    setEverOpened(true);
    setIsOpen(true);
  }, []);
  const closeEnquiry = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, options, openEnquiry, closeEnquiry }),
    [isOpen, options, openEnquiry, closeEnquiry],
  );

  return (
    <EnquiryContext.Provider value={value}>
      {children}
      {everOpened && (
        <Suspense fallback={null}>
          <QuickEnquirySheet />
        </Suspense>
      )}
    </EnquiryContext.Provider>
  );
}

export function useEnquiry(): EnquiryContextValue {
  const ctx = useContext(EnquiryContext);
  if (!ctx) throw new Error("useEnquiry must be used inside <EnquiryProvider>");
  return ctx;
}

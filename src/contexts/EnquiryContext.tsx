import { Component, createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { whatsappLink } from "@/data/products";

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

/** If the panel's code cannot be downloaded (offline, or the site was updated while this tab was open),
 *  show a small WhatsApp fallback here instead of letting the error replace the whole page. */
class SheetErrorBoundary extends Component<{ onClose: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="fixed bottom-24 right-4 z-[110] max-w-xs rounded-2xl border border-border bg-card p-4 text-sm text-foreground shadow-xl"
      >
        <p>We could not open the enquiry form just now.</p>
        <a
          href={whatsappLink("Hi Moments Packaging, I have a question about your packaging.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-medium text-accent underline"
        >
          Message us on WhatsApp instead
        </a>
        <button type="button" onClick={this.props.onClose} className="mt-2 block text-xs text-muted-foreground">
          Close
        </button>
      </div>
    );
  }
}

/** Shown for the moment the panel's code is downloading, so the button never looks dead. */
function OpeningIndicator() {
  return (
    <div
      role="status"
      className="fixed bottom-24 right-4 z-[110] rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-lg"
    >
      Opening…
    </div>
  );
}

export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [options, setOptions] = useState<EnquiryOpenOptions>({});
  const [openCount, setOpenCount] = useState(0);

  const openEnquiry = useCallback((next: EnquiryOpenOptions = {}) => {
    setOptions(next);
    setEverOpened(true);
    setOpenCount((n) => n + 1);
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
        <SheetErrorBoundary key={openCount} onClose={closeEnquiry}>
          <Suspense fallback={<OpeningIndicator />}>
            <QuickEnquirySheet />
          </Suspense>
        </SheetErrorBoundary>
      )}
    </EnquiryContext.Provider>
  );
}

export function useEnquiry(): EnquiryContextValue {
  const ctx = useContext(EnquiryContext);
  if (!ctx) throw new Error("useEnquiry must be used inside <EnquiryProvider>");
  return ctx;
}

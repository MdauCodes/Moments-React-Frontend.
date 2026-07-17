import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { LegalSection } from "@/components/LegalPageLayout";

export interface PolicyContent {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}

/** Shared modal shell for any policy/terms content — shows it in place instead of navigating
 *  away, so reading it doesn't cost the customer their place on the page. Used by the footer's
 *  full policy links and by focused, contextual terms links (e.g. "full offer terms" on a
 *  coupon banner) alike, so both stay visually consistent. */
export function PolicyContentModal({ content, onClose }: { content: PolicyContent; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-background text-foreground sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-medium">{content.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Updated {content.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="text-sm leading-relaxed text-foreground/80">{content.intro}</div>
          <div className="mt-6 space-y-6">
            {content.sections.map((section) => (
              <section key={section.id}>
                <h3 className="font-display text-base font-semibold text-foreground">{section.title}</h3>
                <div className="legal-prose mt-2 text-sm leading-relaxed text-foreground/80">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

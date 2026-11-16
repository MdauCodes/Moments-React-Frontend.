// The restaurant's own catalogue (doc 15 §14-§15, §21) and its quote requests. Prices are KES, VAT
// included, unique to this restaurant, and stay until Moments changes them with 14 days' notice.
// Every priced request gives both a quote form (rendered by the store, the same file as the email's)
// and the updated catalogue (drawn here in the browser), as PDFs. Moments' working
// steps (who prices, proposed prices) are never shown: a request is "With Moments" until decided.
// No links to the shop's product pages here: those show shop prices, not the restaurant's.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, LayoutGrid, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/restaurant/PortalShell";
import {
  ComingSoon,
  ErrorText,
  Field,
  Muted,
  Pill,
  PortalButton,
  PortalButtonLink,
  PortalCard,
  inputClass,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { api } from "@/services/api";
import { restaurantApi, type MyCatalogue, type MyPriceRequest } from "@/services/restaurantApi";
import {
  dateTime,
  describeChange,
  filterLines,
  groupByCategory,
  kes,
  priceRequestStatus,
  shortDate,
} from "@/lib/restaurantPortal";
import { pdfFileName } from "@/lib/restaurantPdfLayout";
import { quoteBasket, useQuoteBasket } from "@/lib/quoteBasket";
import type { Product } from "@/data/products";

export default function RestaurantCataloguePage() {
  useEffect(() => {
    document.title = "Your catalogue · Moments Packaging";
  }, []);
  return (
    <PortalShell page="catalogue">
      <CatalogueBody />
    </PortalShell>
  );
}

/** Builds and saves a PDF; the drawing code (jsPDF, the QR maker) loads only now. */
async function downloadCatalogue(cat: MyCatalogue, onProgress: (pct: number) => void) {
  const { buildCataloguePdf, savePdf } = await import("@/lib/restaurantPdf");
  const blob = await buildCataloguePdf(cat, (done, total) =>
    onProgress(Math.round((done / total) * 100)),
  );
  savePdf(blob, pdfFileName(cat.restaurantName, "catalogue", cat.version));
}

function CatalogueBody() {
  const [params, setParams] = useSearchParams();
  const basket = useQuoteBasket();
  const [catalogue, setCatalogue] = useState<MyCatalogue | null>(null);
  const [requests, setRequests] = useState<MyPriceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(params.get("ask") === "1" || basket.length > 0);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [quoteBusy, setQuoteBusy] = useState<string | null>(null);
  const askRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [cat, reqs] = await Promise.all([
        restaurantApi.catalogue(),
        restaurantApi.priceRequests(),
      ]);
      setCatalogue(cat);
      setRequests(reqs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your catalogue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (asking && catalogue) askRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [asking, catalogue]);

  if (error && !catalogue) {
    return (
      <PortalCard>
        <ErrorText>{error}</ErrorText>
        <PortalButton className="mt-3" onClick={() => void load()}>
          Try again
        </PortalButton>
      </PortalCard>
    );
  }
  if (!catalogue) {
    return <div className="h-48 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />;
  }

  const cat = catalogue;
  const lines = filterLines(cat.lines, query);
  const groups = groupByCategory(lines);
  const open = requests.filter((r) => r.status !== "PUBLISHED" && r.status !== "DECLINED");

  async function onDownloadCatalogue() {
    setPdfProgress(0);
    try {
      await downloadCatalogue(cat, setPdfProgress);
    } catch {
      toast.error("Couldn't make the PDF. Try again.");
    } finally {
      setPdfProgress(null);
    }
  }

  async function onDownloadQuote(r: MyPriceRequest) {
    setQuoteBusy(r.id);
    try {
      await restaurantApi.downloadQuote(r.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download the quote. Try again.");
    } finally {
      setQuoteBusy(null);
    }
  }

  const closeAsk = () => {
    setAsking(false);
    if (params.get("ask")) {
      params.delete("ask");
      setParams(params, { replace: true });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold">
            Your catalogue{cat.version ? ` · ${cat.version}` : ""}
          </h1>
          <Muted>
            {cat.version
              ? `Your own prices, VAT included. Approved ${shortDate(cat.approvedAt ?? cat.effectiveFrom)}; every order is placed at them, and they stay until Moments changes them, with 14 days' notice.`
              : "No prices yet. Browse the products you buy and send a quote request; Moments prices them for you and sends a quote and your catalogue."}
          </Muted>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {cat.lines.length > 0 && (
            <PortalButton
              variant="secondary"
              onClick={() => void onDownloadCatalogue()}
              disabled={pdfProgress != null}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfProgress != null ? `Making the PDF… ${pdfProgress}%` : "Download catalogue (PDF)"}
            </PortalButton>
          )}
          <PortalButtonLink to="/restaurant/browse">
            <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Browse products
          </PortalButtonLink>
        </div>
      </div>

      {cat.upcoming.map((u) => (
        <div
          key={u.label}
          role="note"
          className="rounded-[12px] p-3.5 text-[14px] leading-relaxed"
          style={{ background: "#FFF8E6", border: "1px solid #F2DFA6" }}
        >
          <strong>Coming: {u.label}</strong>
          <ul className="mt-1 list-disc pl-5">
            {u.changes.map((ch) => (
              <li key={ch.productId}>{describeChange(u.effectiveFrom, ch)}</li>
            ))}
          </ul>
          <div className="mt-1" style={{ color: c.muted }}>
            Until then your current price stands.
          </div>
        </div>
      ))}

      {asking ? (
        <div ref={askRef}>
          <PriceRequestForm
            onCancel={closeAsk}
            onSent={async () => {
              closeAsk();
              await load();
            }}
          />
        </div>
      ) : (
        <div>
          <PortalButton variant="secondary" onClick={() => setAsking(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Ask prices for new products
          </PortalButton>
        </div>
      )}

      {cat.lines.length > 0 && (
        <PortalCard>
          <label className="relative block">
            <span className="sr-only">Search your catalogue</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: c.muted }}
              aria-hidden="true"
            />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              style={{ borderColor: c.line }}
              placeholder="Search your products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {groups.length === 0 && (
            <Muted className="mt-3">Nothing in your catalogue matches "{query}".</Muted>
          )}
          {groups.map((g) => (
            <div key={g.category} className="mt-4">
              <h2
                className="text-[13px] font-bold uppercase tracking-wide"
                style={{ color: c.muted }}
              >
                {g.category}
              </h2>
              <ul className="mt-1 divide-y" style={{ borderColor: c.line }}>
                {g.lines.map((l) => (
                  <li key={l.productId} className="flex items-center gap-3 py-2.5">
                    {l.imageUrl ? (
                      <img
                        src={l.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        style={{ background: c.soft }}
                      />
                    ) : (
                      <div
                        className="h-12 w-12 shrink-0 rounded-lg"
                        style={{ background: c.soft }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="break-words font-semibold">{l.productName}</span>
                      <div className="text-[12.5px]" style={{ color: c.muted }}>
                        {l.unit ? `per ${l.unit}` : ""}
                        {l.unit && l.priceSince ? " · " : ""}
                        {l.priceSince ? `since ${shortDate(l.priceSince)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-bold">{kes(l.price)}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </PortalCard>
      )}

      <ComingSoon
        title="Ordering from your catalogue"
        text="Purchase orders at these prices open here soon: your heads download the PO, sign it, and upload the signed copy. Until then, order through your contact at Moments."
      />

      <PortalCard aria-labelledby="h-requests">
        <h2 id="h-requests" className="text-[18px] font-bold">
          Quote requests{open.length ? ` · ${open.length} with Moments` : ""}
        </h2>
        {requests.length === 0 ? (
          <Muted className="mt-1">You haven't asked for prices yet.</Muted>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => {
              const st = priceRequestStatus(r.status, r.publishedVersion);
              const priced = r.status === "PUBLISHED";
              return (
                <li
                  key={r.id}
                  className="list-none rounded-[10px] border p-3 text-[14px]"
                  style={{ borderColor: c.line }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">
                      {r.items.length} {r.items.length === 1 ? "product" : "products"}
                    </span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="mt-0.5 break-words" style={{ color: c.muted }}>
                    {r.items.map((i) => i.productName).join(", ")}
                  </div>
                  <div className="mt-1 text-[12.5px]" style={{ color: c.muted }}>
                    Sent {dateTime(r.createdAt)}
                    {r.requestedBy ? ` by ${r.requestedBy}` : ""}
                  </div>
                  {r.declineReason && (
                    <div className="mt-1 text-[13px]">
                      <strong>Moments:</strong> {r.declineReason}
                    </div>
                  )}
                  {priced && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <PortalButton
                        variant="secondary"
                        onClick={() => void onDownloadQuote(r)}
                        disabled={quoteBusy === r.id}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        {quoteBusy === r.id ? "Downloading…" : "Download quote (PDF)"}
                      </PortalButton>
                      <PortalButton
                        variant="secondary"
                        onClick={() => void onDownloadCatalogue()}
                        disabled={pdfProgress != null}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" /> Download catalogue (PDF)
                      </PortalButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
    </div>
  );
}

/** The quote request: the products picked in Browse (or searched here), with optional quantity notes. */
function PriceRequestForm({
  onCancel,
  onSent,
}: {
  onCancel: () => void;
  onSent: () => Promise<void>;
}) {
  const picked = useQuoteBasket();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      api
        .searchProducts(term, 8)
        .then((list) => live && setResults(list))
        .catch(() => live && setResults([]))
        .finally(() => live && setSearching(false));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return setError("Add at least one product to the request.");
    setBusy(true);
    setError(null);
    try {
      await restaurantApi.requestPrices({
        items: picked.map((p) => ({
          productId: p.id,
          quantityNote: notes[p.id]?.trim() || undefined,
        })),
        note: note.trim() || undefined,
      });
      quoteBasket.clear();
      toast.success("Sent to Moments. You'll get an email with your quote and catalogue.");
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the quote request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalCard aria-labelledby="h-ask">
      <form onSubmit={(e) => void send(e)} className="flex flex-col gap-3" noValidate>
        <h2 id="h-ask" className="text-[18px] font-bold">
          Quote request
        </h2>
        <Muted>
          Add the products you want priced. A Moments manager prices them for you; you then get a
          quote and your updated catalogue, by email and here.
        </Muted>
        <div>
          <PortalButtonLink to="/restaurant/browse" variant="secondary">
            <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Browse by industry or category
          </PortalButtonLink>
        </div>
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: c.muted }}
            aria-hidden="true"
          />
          <input
            type="search"
            className={`${inputClass} pl-9`}
            style={{ borderColor: c.line }}
            placeholder="Or search, e.g. kraft box"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {searching && <Muted>Searching…</Muted>}
        {results.length > 0 && (
          <ul
            className="flex flex-col divide-y rounded-[10px] border"
            style={{ borderColor: c.line }}
          >
            {results.map((p) => {
              const already = picked.some((x) => x.id === p.id);
              const image = p.primaryImageUrl || p.image;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      quoteBasket.add({ id: p.id, name: p.name, image: image || undefined });
                      setQ("");
                      setResults([]);
                    }}
                    disabled={already}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-60"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        className="h-9 w-9 shrink-0 rounded-md"
                        style={{ background: c.soft }}
                      />
                    )}
                    <span className="min-w-0 flex-1 break-words text-[15px]">{p.name}</span>
                    <span className="text-[13px] font-bold" style={{ color: c.green }}>
                      {already ? "Added" : "Add"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {picked.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Products to price">
            {picked.map((p) => (
              <li
                key={p.id}
                className="list-none rounded-[10px] border p-3"
                style={{ borderColor: c.line, background: c.page }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => quoteBasket.remove(p.id)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px]"
                    aria-label={`Remove ${p.name}`}
                    style={{ color: c.danger }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <Field
                  label="How many you usually buy (optional)"
                  placeholder="e.g. 20 packs a month"
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
        <Field
          label="Note for Moments (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PortalButton type="submit" disabled={busy}>
            {busy ? "Sending…" : `Send to Moments${picked.length ? ` (${picked.length})` : ""}`}
          </PortalButton>
          <PortalButton variant="secondary" onClick={onCancel} disabled={busy}>
            Close
          </PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

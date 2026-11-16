// The restaurant's approved catalogue (doc 15 §14-§15) and its pricing requests. Prices are KES,
// VAT included, and stay until Moments changes them with 14 days' notice. Moments' working steps
// (who prices, proposed prices) are never shown: a request is "With Moments" until it is decided.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";

import { PortalShell } from "@/components/restaurant/PortalShell";
import {
  ComingSoon,
  ErrorText,
  Field,
  Muted,
  Pill,
  PortalButton,
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

function CatalogueBody() {
  const [catalogue, setCatalogue] = useState<MyCatalogue | null>(null);
  const [requests, setRequests] = useState<MyPriceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
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
    if (asking) askRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [asking]);

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

  const lines = filterLines(catalogue.lines, query);
  const groups = groupByCategory(lines);
  const open = requests.filter((r) => r.status !== "PUBLISHED" && r.status !== "DECLINED");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold">
            Your catalogue{catalogue.version ? ` · ${catalogue.version}` : ""}
          </h1>
          <Muted>
            {catalogue.version
              ? `Your own prices, VAT included. Approved ${shortDate(catalogue.approvedAt ?? catalogue.effectiveFrom)}; they stay until Moments changes them, with 14 days' notice.`
              : "No approved prices yet. Ask Moments to price the products you buy; your catalogue appears here once a Moments manager approves it."}
          </Muted>
        </div>
        {!asking && (
          <PortalButton onClick={() => setAsking(true)} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" /> Ask prices for new products
          </PortalButton>
        )}
      </div>

      {catalogue.upcoming.map((u) => (
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

      {asking && (
        <div ref={askRef}>
          <PriceRequestForm
            onCancel={() => setAsking(false)}
            onSent={async () => {
              setAsking(false);
              await load();
            }}
          />
        </div>
      )}

      {catalogue.lines.length > 0 && (
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
                      {l.slug ? (
                        <Link
                          to={`/products/${l.slug}`}
                          className="break-words font-semibold underline-offset-4 hover:underline"
                        >
                          {l.productName}
                        </Link>
                      ) : (
                        <span className="break-words font-semibold">{l.productName}</span>
                      )}
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
        text="Purchase orders at these prices, approved by your heads, open here soon. Until then, order as usual from the Moments shop or through your contact at Moments."
      />

      <PortalCard aria-labelledby="h-requests">
        <h2 id="h-requests" className="text-[18px] font-bold">
          Pricing requests{open.length ? ` · ${open.length} with Moments` : ""}
        </h2>
        {requests.length === 0 ? (
          <Muted className="mt-1">You haven't asked for prices yet.</Muted>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => {
              const st = priceRequestStatus(r.status, r.publishedVersion);
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
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
    </div>
  );
}

interface Picked {
  product: Pick<Product, "id" | "name" | "image">;
  quantityNote: string;
}

function PriceRequestForm({
  onCancel,
  onSent,
}: {
  onCancel: () => void;
  onSent: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
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

  const add = (p: Product) => {
    if (picked.some((x) => x.product.id === p.id)) return;
    setPicked([
      ...picked,
      { product: { id: p.id, name: p.name, image: p.image }, quantityNote: "" },
    ]);
    setQ("");
    setResults([]);
  };

  async function send(e: FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return setError("Add at least one product to the request.");
    setBusy(true);
    setError(null);
    try {
      await restaurantApi.requestPrices({
        items: picked.map((p) => ({
          productId: p.product.id,
          quantityNote: p.quantityNote.trim() || undefined,
        })),
        note: note.trim() || undefined,
      });
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the pricing request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalCard aria-labelledby="h-ask">
      <form onSubmit={(e) => void send(e)} className="flex flex-col gap-3" noValidate>
        <h2 id="h-ask" className="text-[18px] font-bold">
          Request catalogue pricing
        </h2>
        <Muted>
          Search for the products you buy and add them. A Moments manager prices them for you;
          you'll get an email when your catalogue is updated.
        </Muted>
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
            placeholder="Search products, e.g. kraft box"
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
              const already = picked.some((x) => x.product.id === p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={already}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-60"
                  >
                    {p.image ? (
                      <img
                        src={p.image}
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
            {picked.map((p, i) => (
              <li
                key={p.product.id}
                className="list-none rounded-[10px] border p-3"
                style={{ borderColor: c.line, background: c.page }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{p.product.name}</span>
                  <button
                    type="button"
                    onClick={() => setPicked(picked.filter((_, j) => j !== i))}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px]"
                    aria-label={`Remove ${p.product.name}`}
                    style={{ color: c.danger }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <Field
                  label="How many you usually buy (optional)"
                  placeholder="e.g. 20 packs a month"
                  value={p.quantityNote}
                  onChange={(e) =>
                    setPicked(
                      picked.map((x, j) => (j === i ? { ...x, quantityNote: e.target.value } : x)),
                    )
                  }
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
            {busy ? "Sending…" : `Send request${picked.length ? ` (${picked.length})` : ""}`}
          </PortalButton>
          <PortalButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </PortalButton>
        </div>
      </form>
    </PortalCard>
  );
}

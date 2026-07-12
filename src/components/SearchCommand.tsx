import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { Search, X, ArrowRight, Clock, Sparkles, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { industries as allIndustries } from "@/data/products";
import type { Product } from "@/data/products";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const RECENTS_KEY = "moments.recentSearches.v1";
const MAX_RECENTS = 6;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function writeRecents(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    /* noop */
  }
}

function pushRecent(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  const next = [t, ...readRecents().filter((r) => r.toLowerCase() !== t.toLowerCase())];
  writeRecents(next);
}

const SUGGESTED = ["Coffee cups", "Mailers", "Gift box", "SOS bag", "Labels"];

interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchCommand({ open, onClose, initialQuery = "" }: SearchCommandProps) {
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isSupported, isListening, start, stop } = useSpeechRecognition({
    onTranscript: (text) => setQuery(text),
    onError: (message) => toast.error(message),
  });

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setDebounced(initialQuery);
      setRecents(readRecents());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void api.searchProducts(q, 12).then((data) => {
      if (cancelled) return;
      setResults(data);
      setHighlight(0);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        const target = results[highlight];
        if (target) {
          e.preventDefault();
          pushRecent(query);
          onClose();
          void navigate(`/products/${target.slug}`);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, highlight, query, navigate, onClose]);

  const showEmpty = !isLoading && debounced.trim().length >= 2 && results.length === 0;
  const showIdle = debounced.trim().length < 2;

  const industryById = useMemo(() => Object.fromEntries(allIndustries.map((i) => [i.id, i])), []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Search products"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />

      <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl md:mt-[8vh] md:h-auto md:max-h-[80vh] md:rounded-2xl md:border md:border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:px-5 md:py-4">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search packaging — e.g. coffee cup, mailer, gift box…"
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {isSupported && (
            <button
              type="button"
              onClick={isListening ? stop : start}
              aria-label={isListening ? "Stop voice search" : "Search by voice"}
              aria-pressed={isListening}
              className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
                isListening
                  ? "animate-pulse bg-accent/15 text-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showIdle && (
            <div className="px-4 py-5 md:px-5">
              {recents.length > 0 && (
                <section className="mb-5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Recent
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        writeRecents([]);
                        setRecents([]);
                      }}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {recents.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => setQuery(r)}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
                        >
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mb-5">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Suggested
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => setQuery(s)}
                        className="rounded-full bg-secondary px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/70"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Browse industries</p>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {allIndustries.map((ind) => {
                    const Icon = ind.icon;
                    return (
                      <li key={ind.id}>
                        <Link
                          to={`/products?industry=${ind.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-all hover:-translate-y-0.5 hover:shadow-sm"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                          <span className="truncate">{ind.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {isLoading && (
            <ul className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-3 md:px-5">
                  <div className="shimmer h-14 w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="shimmer h-4 w-2/3 rounded" />
                    <div className="shimmer h-3 w-1/3 rounded" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showEmpty && (
            <div className="px-5 py-12 text-center">
              <p className="text-base text-foreground">No products match &lsquo;{debounced}&rsquo;</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a different word or browse our catalogue.</p>
              <Link
                to="/products"
                onClick={onClose}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse all packaging <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((p, idx) => {
                const inds = (p.industryIds ?? [])
                  .map((id) => industryById[id])
                  .filter(Boolean)
                  .slice(0, 2);
                const isHi = idx === highlight;
                return (
                  <li key={p.id}>
                    <Link
                      to="/products/$slug"
                      onClick={() => {
                        pushRecent(query);
                        void api.trackClick(p.id);
                        onClose();
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`flex items-center gap-4 px-4 py-3 transition-colors md:px-5 ${
                        isHi ? "bg-secondary" : "hover:bg-secondary/60"
                      }`}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                        {p.primaryImageUrl ? (
                          <img
                            src={p.primaryImageUrl}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-secondary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-display text-[15px] text-foreground">{p.name}</p>
                          {p.isDiscount && (
                            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                              -{p.discountPercent}%
                            </span>
                          )}
                          {p.isNewArrival && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.category} · MOQ {p.moq.toLocaleString()}
                          {inds.length > 0 ? ` · ${inds.map((i) => i.name).join(" · ")}` : ""}
                        </p>
                      </div>
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground md:flex">
          <span>
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">↑↓</kbd> navigate ·{" "}
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">↵</kbd> open ·{" "}
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">esc</kbd> close
          </span>
          <Link to="/products" onClick={onClose} className="hover:text-foreground">
            Browse full catalogue →
          </Link>
        </div>
      </div>
    </div>
  );
}

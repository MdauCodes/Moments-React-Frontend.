import { Link, useSearchParams } from "react-router-dom";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { RewardDeliveryBanners, REWARD_BANNER_SPACER_CLASS } from "@/components/RewardDeliveryBanners";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";

import { api, type Segment, type Category as TaxCategory, type Subcategory, type Tag } from "@/services/api";
import { WHATSAPP_NUMBER, filterVisibleIndustries } from "@/data/products";
import { CATEGORY_OPTIONS } from "@/data/categoryOptions";
import { useAuth } from "@/contexts/AuthContext";

import type { Product, Industry } from "@/data/products";
import { getStockInfo } from "@/lib/stock";
import { MOCK_PRODUCTS } from "@/data/mockProducts";

// Business-priority display order for the "Browse by industry" grid.
// Anything not in this list (or a new industry the admin adds later) just
// falls in after these, in whatever order the backend returned it.
const INDUSTRY_PRIORITY = [
  "food and beverage",
  "baking",
  "e-commerce and retail",
  "beauty and personal care",
  "pharmaceutical",
  "agricultural and dairy",
  "custom branding",
];

// Normalizes "&" vs "and" and stray whitespace so "Food & Beverage" matches
// "food and beverage" in the priority list above.
function normalizeIndustryName(name: string): string {
  return name.trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
}

function sortByIndustryPriority(list: Industry[]): Industry[] {
  return [...list].sort((a, b) => {
    const ai = INDUSTRY_PRIORITY.indexOf(normalizeIndustryName(a.name));
    const bi = INDUSTRY_PRIORITY.indexOf(normalizeIndustryName(b.name));
    const ar = ai === -1 ? INDUSTRY_PRIORITY.length : ai;
    const br = bi === -1 ? INDUSTRY_PRIORITY.length : bi;
    return ar - br;
  });
}

/**
 * Smart loading state for the catalogue.
 * - "ok": real data (or fallback) is in `products`, render grid normally
 * - "fallback": API unreachable / 404 → showing MOCK_PRODUCTS + subtle banner
 * - "empty": API responded with [] and no filters active
 * - "unauthorized": 401/403
 * - "server_error": 500 / unknown — show retry
 */
type LoadState = "ok" | "fallback" | "empty" | "unauthorized" | "server_error";

/** Extract HTTP status from the api layer's `Error("API request failed: 404")`. */
function statusFromError(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const m = /(\d{3})/.exec(err.message);
  return m ? Number(m[1]) : null;
}

function classifyError(err: unknown): Exclude<LoadState, "ok" | "empty"> {
  const status = statusFromError(err);
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404 || status === null) return "fallback"; // null = network/TypeError
  if (status >= 500) return "server_error";
  return "fallback";
}

const sortOptions = ["newest", "price-asc", "price-desc", "popular"] as const;
type SortKey = (typeof sortOptions)[number];

const searchSchema = z.object({
  category: z.string().optional(),
  segmentId: z.string().optional(),
  subcategoryId: z.string().optional(),
  tagId: z.string().optional(),
  industry: z.string().optional(),
  q: z.string().optional(),
  newArrivals: z.boolean().optional(),
  deals: z.boolean().optional(),
  fastMoving: z.boolean().optional(),
  inStock: z.boolean().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sort: z.enum(sortOptions).optional(),
});

const PAGE_SIZE = 20;
const ALL_PRICE_MAX = 500;



function ProductsPage() {
  const { isAuthenticated } = useAuth();
  const [_searchParams, setSearchParams] = useSearchParams();
  const search = Object.fromEntries(_searchParams.entries());
  const { category, segmentId, tagId, industry: industrySlug, q, sort = "newest" } = search;
  // Repeated query params (?subcategoryId=a&subcategoryId=b&categoryId=c) — picking several
  // subcategories and/or whole categories within the same industry combines them (the backend
  // ORs subcategoryId/categoryId together), instead of the old single-value "last click wins".
  const subcategoryIds = _searchParams.getAll("subcategoryId");
  const categoryIds = _searchParams.getAll("categoryId");
  const newArrivals = search.newArrivals === "true";
  const deals = search.deals === "true";
  const fastMoving = search.fastMoving === "true";
  const inStock = search.inStock === "true";
  const minPrice = search.minPrice ? Number(search.minPrice) : undefined;
  const maxPrice = search.maxPrice ? Number(search.maxPrice) : undefined;

  const [industries, setIndustries] = useState<Industry[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [suggestedSubcategories, setSuggestedSubcategories] = useState<Subcategory[]>([]);
  const [suggestionsArePersonalized, setSuggestionsArePersonalized] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [moreProducts, setMoreProducts] = useState<Product[] | null>(null);
  const [query, setQuery] = useState(q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Local, uncommitted price input text — only pushed into the URL params (and
  // thus the product fetch) after the visitor pauses typing, same debounce
  // pattern as search below. Without this, every keystroke on a price field
  // fired its own full-grid reload (the "constant loading" complaint).
  const [minPriceInput, setMinPriceInput] = useState(minPrice != null ? String(minPrice) : "");
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice != null ? String(maxPrice) : "");
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [preTier, setPreTier] = useState<string | null>(null);
  const handleConfigure = (p: Product, tierId?: string) => {
    setPreTier(tierId ?? null);
    setConfiguring(p);
  };
  const [loadState, setLoadState] = useState<LoadState>("ok");
  const [retryTick, setRetryTick] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ── Deliberate "load more" reveal sequence (client decision 2026-09-04) ───────────────────
  // Product #(page*PAGE_SIZE+1) onward is fetched well before the visitor reaches the bottom
  // (rootMargin below), but is deliberately NOT shown the instant it arrives — revealedCount
  // gates how much of `products` the grid is allowed to render, and morePhase paces exactly when
  // that gate opens: a filled progress ring for a minimum of 3s (nominally paced toward 4s, but
  // cut short right at 3s the moment real data is ready, or held at 100% and waiting if the
  // fetch is slower than 4s), then skeleton cards for 2s, then the real cards. The aim, per the
  // client's own framing: a consistent, legible "something is happening, please wait" beat every
  // time, rather than pagination that's sometimes instant and sometimes not depending on network
  // conditions. Deliberately scoped to "load more" only — the very first page (or a fresh filter/
  // search) still reveals the moment it's ready, no artificial delay.
  const [revealedCount, setRevealedCount] = useState(0);
  const [morePhase, setMorePhase] = useState<"idle" | "spinner" | "skeleton">("idle");
  const [ringPct, setRingPct] = useState(0);
  const moreFetchStartRef = useRef<number | null>(null);
  const ringTargetMsRef = useRef(4000);
  const wasLoadingMoreRef = useRef(false);
  // Synchronous lock, checked and set inside the IntersectionObserver callback itself — see that
  // effect's own comment for the exact race this closes (the state-based guards below it lag one
  // render behind setPage, which is a real gap a still-intersecting sentinel can slip through).
  const moreCycleActiveRef = useRef(false);
  // Set right before any state change that swaps skeletons for real cards (or vice versa) — those
  // are React removing N grid children and mounting M different ones, and depending on the exact
  // reconciliation order that can transiently shrink the document height, which the browser then
  // "corrects" by clamping window.scrollY down — visible to the visitor as an unwanted jump toward
  // the bottom right as new content lands, exactly what was reported live. The layout effect below
  // restores whatever scrollY was right before that swap, synchronously before the next paint, so
  // it's never actually visible — the visitor stays exactly where they were browsing.
  const preserveScrollRef = useRef<number | null>(null);

  const MIN_SPINNER_MS = 3000;
  const DEFAULT_SPINNER_MS = 4000;
  const SKELETON_MS = 2000;

  // Page 0 (initial load, or any filter/search/sort change resetting the grid) reveals the
  // instant it's ready — the paced sequence below is specifically for pagination while scrolling.
  useEffect(() => {
    if (page === 0 && !isLoading) {
      setRevealedCount(products.length);
      setMorePhase("idle");
      moreCycleActiveRef.current = false;
    }
  }, [page, isLoading, products.length]);

  // Fetch for page > 0 just started — begin the ring.
  useEffect(() => {
    if (page > 0 && isLoadingMore && !wasLoadingMoreRef.current) {
      moreFetchStartRef.current = Date.now();
      ringTargetMsRef.current = DEFAULT_SPINNER_MS;
      setRingPct(0);
      setMorePhase("spinner");
    }
    wasLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore, page]);

  // Drives the ring's own fill toward whatever ringTargetMsRef currently says — retargeted by the
  // effect below the instant real completion time is known, so the visible fill always finishes
  // exactly when the phase is about to move on, never mid-fill.
  useEffect(() => {
    if (morePhase !== "spinner") return;
    let raf: number;
    const tick = () => {
      const start = moreFetchStartRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      const target = ringTargetMsRef.current;
      setRingPct(Math.min(100, (elapsed / target) * 100));
      if (elapsed < target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [morePhase]);

  // The real fetch just finished (products state already has the new items — just not revealed
  // yet). Enforce the 3s floor, then hand off to skeletons for 2s, then actually reveal.
  useEffect(() => {
    if (page === 0 || isLoadingMore || morePhase !== "spinner") return;
    const elapsed = Date.now() - (moreFetchStartRef.current ?? Date.now());
    const toSkeleton = () => {
      preserveScrollRef.current = window.scrollY;
      setMorePhase("skeleton");
      const t = setTimeout(() => {
        preserveScrollRef.current = window.scrollY;
        setRevealedCount(products.length);
        setMorePhase("idle");
        // Only NOW is the lock released — the full reveal cycle (spinner + skeleton) for this
        // page has genuinely finished, so the sentinel is safe to trigger another one.
        moreCycleActiveRef.current = false;
      }, SKELETON_MS);
      return t;
    };
    if (elapsed >= MIN_SPINNER_MS) {
      // Already past the floor (a slow fetch, or one that took 3-4s) — finish the ring right now
      // instead of waiting further, and move straight on.
      ringTargetMsRef.current = elapsed;
      setRingPct(100);
      const t = toSkeleton();
      return () => clearTimeout(t);
    }
    // Not at the floor yet — retarget the ring to finish exactly at 3s (not the default 4s),
    // then transition right on that mark.
    ringTargetMsRef.current = MIN_SPINNER_MS;
    const t1 = setTimeout(() => {
      const t2 = toSkeleton();
      return () => clearTimeout(t2);
    }, MIN_SPINNER_MS - elapsed);
    return () => clearTimeout(t1);
  }, [isLoadingMore, morePhase, page, products.length]);

  // Runs synchronously after the DOM commit but before the browser paints — restores whatever
  // scrollY preserveScrollRef captured right before a skeletons<->real-cards swap, so the visitor
  // never actually sees the jump the swap would otherwise cause. See preserveScrollRef's own
  // comment above for why the swap can shift scrollY at all.
  useLayoutEffect(() => {
    if (preserveScrollRef.current !== null) {
      window.scrollTo(0, preserveScrollRef.current);
      preserveScrollRef.current = null;
    }
  }, [morePhase, revealedCount]);

  // Infinite scroll: load the next page well before the user actually reaches the bottom.
  // rootMargin: "1200px" (client decision 2026-09-04 — bumped from 800px) fires the fetch — and
  // so the spinner — well over a screen early on most viewports, before the visitor is anywhere
  // near the current bottom, so the pacing sequence is already visibly underway rather than only
  // starting once they've scrolled all the way down. Also blocked while a previous page's
  // reveal sequence is still mid-flight (morePhase !== "idle"), not just while the raw fetch is
  // in flight — otherwise reaching the bottom again during the skeleton phase would kick off a
  // second fetch stacking behind the first.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoadingMore || morePhase !== "idle" || searchResults) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Real race found live: setPage doesn't make isLoadingMore/morePhase true until a LATER
        // render (they're set inside a different effect), so a sentinel that's still intersecting
        // right after the first trigger could fire this callback again — via a fresh observer
        // instance recreated by this effect's own dependency changes — before those state guards
        // above have caught up, incrementing page multiple times in a burst (confirmed live: 4
        // pages fired within ~2s of the very first scroll). moreCycleActiveRef is a plain ref, set
        // synchronously right here, so this check is immune to that render-lag entirely.
        if (entries[0]?.isIntersecting && !moreCycleActiveRef.current) {
          moreCycleActiveRef.current = true;
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "1200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // revealedCount is the fix for a real bug found live: on the very first load, hasMore/
    // products/isLoading all settle in ONE render, but revealedCount (which gates whether the
    // sentinel div even renders — see the empty-state branch below) only catches up a render
    // LATER, via its own separate effect. This effect ran on that first render, found no sentinel
    // in the DOM yet, and gave up — and since none of ITS OWN dependencies changed afterward, it
    // never tried again. The observer was silently never created at all; scrolling to the bottom
    // did nothing, permanently, for that session. revealedCount catching up is exactly the signal
    // this effect needs to retry once the sentinel actually exists.
  }, [hasMore, isLoadingMore, morePhase, searchResults, revealedCount]);

  const selectedIndustry = useMemo(
    () => industries.find((i) => i.slug === industrySlug) ?? null,
    [industries, industrySlug],
  );

  const sortParam = useMemo(() => {
    switch (sort) {
      case "price-asc": return "basePrice,asc";
      case "price-desc": return "basePrice,desc";
      case "popular": return "monthlyClicks,desc";
      default: return "createdAt,desc";
    }
  }, [sort]);

  const anyFilterActive = !!(
    industrySlug || category || subcategoryIds.length > 0 || categoryIds.length > 0 || tagId || newArrivals || deals || fastMoving ||
    inStock || minPrice !== undefined || maxPrice !== undefined ||
    (q && q.length > 1)
  );

  // Industries
  useEffect(() => {
    let cancelled = false;
    void api.getIndustries().then((data) => {
      if (!cancelled) setIndustries(sortByIndustryPriority(filterVisibleIndustries(data)));
    });
    return () => { cancelled = true; };
  }, []);

  // Segment -> Category -> Subcategory taxonomy for "Browse by category". Fetched once, fully
  // unscoped — counts stay small (dozens, not product-scale) even once the full catalogue is
  // classified, so fetching everything and partitioning it client-side (below) is fine, and
  // means switching industries doesn't need a re-fetch.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api.getSegments(),
      api.getCategories(),
      api.getSubcategories(),
    ]).then(
      ([segs, cats, subs]) => {
        if (cancelled) return;
        setSegments(segs);
        setTaxCategories(cats);
        setSubcategories(subs);
      },
    ).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // A subcategory is "in" the selected industry either because it's directly tagged with it, or
  // because it inherits the tag from its parent category — same union rule the backend already
  // applies (SubcategoryService.getByIndustry). Everything else is "other" — shown collapsed in
  // the edge dropdown rather than cluttering the main accordion with dead, empty rows.
  const associatedSubcategoryIds = useMemo(() => {
    if (!selectedIndustry) return null; // no industry selected = nothing is "other"
    const categoriesById = new Map(taxCategories.map((c) => [c.id, c]));
    const ids = new Set<string>();
    for (const sub of subcategories) {
      const category = categoriesById.get(sub.categoryId);
      const categoryTagged = category?.industryIds?.includes(selectedIndustry.id);
      const subTagged = sub.industryIds?.includes(selectedIndustry.id);
      if (categoryTagged || subTagged) ids.add(sub.id);
    }
    return ids;
  }, [selectedIndustry, taxCategories, subcategories]);

  const isSubcategoryAssociated = (sub: Subcategory) =>
    !associatedSubcategoryIds || associatedSubcategoryIds.has(sub.id);

  // Subcategory suggestions — signed-in customers get their own past-purchase-based picks
  // ("Recommended for you"); anonymous visitors (or a signed-in customer with no purchase
  // history yet) get click-popularity ("Popular subcategories"). Falls back from personalized
  // to popular, never the reverse. Only shown/fetched with no industry selected — once an
  // industry is active, the "Categories in {industry}" accordion covers that need already,
  // and per client feedback a separate industry-scoped strip here was redundant.
  useEffect(() => {
    if (selectedIndustry) {
      setSuggestedSubcategories([]);
      return;
    }
    let cancelled = false;
    async function load() {
      if (isAuthenticated) {
        try {
          const personal = await api.getRecommendedSubcategories(6);
          if (cancelled) return;
          if (personal.length > 0) {
            setSuggestedSubcategories(personal);
            setSuggestionsArePersonalized(true);
            return;
          }
        } catch {
          // fall through to popular
        }
      }
      try {
        const popular = await api.getPopularSubcategories({ limit: 6 });
        if (!cancelled) {
          setSuggestedSubcategories(popular);
          setSuggestionsArePersonalized(false);
        }
      } catch {
        if (!cancelled) setSuggestedSubcategories([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, !!selectedIndustry]);

  // Admin-managed tags, driving "What do you need?" once populated. Additive
  // to the verified keyword quick-finds below, not a replacement — there are
  // no real tags yet, so this stays empty until the admin starts creating them.
  useEffect(() => {
    let cancelled = false;
    void api.getTags().then((data) => { if (!cancelled) setTagsList(data); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Restore the Segment/Category accordion-expansion state from a bookmarked/shared
  // subcategoryId link — just picks the first selected subcategory to decide which
  // segment/category to auto-expand; doesn't affect which products are actually shown.
  const firstSubcategoryId = subcategoryIds[0];
  useEffect(() => {
    if (!firstSubcategoryId) return;
    const sub = subcategories.find((s) => s.id === firstSubcategoryId);
    if (sub) {
      setSelectedCategoryId(sub.categoryId);
      setSelectedSegmentId(sub.segmentId ?? taxCategories.find((c) => c.id === sub.categoryId)?.segmentId ?? null);
    }
  }, [firstSubcategoryId, subcategories, taxCategories]);

  // Deep link from a homepage "Shop by category" tile: expand that segment in
  // the "Browse by category" panel and scroll it into view.
  useEffect(() => {
    if (!segmentId || subcategoryIds.length > 0) return;
    if (!segments.some((s) => s.id === segmentId)) return;
    setSelectedSegmentId(segmentId);
    const scroll = () => document.getElementById("browse-by-category")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timers = [100, 500].map((ms) => window.setTimeout(scroll, ms));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentId, subcategoryIds.length, segments]);

  const selectSegment = (id: string) => {
    setSelectedSegmentId((prev) => (prev === id ? null : id));
    setSelectedCategoryId(null);
    setParams({ subcategoryId: undefined, categoryId: undefined });
  };

  // Toggles one subcategory's membership in the current multi-select, combining with whatever
  // else is already selected (within the same industry) rather than replacing it — picking a
  // second subcategory shows the union of both, not just the latest pick.
  const selectSubcategory = (id: string, categoryId?: string | null) => {
    const turningOn = !subcategoryIds.includes(id);
    setSearchParams((prev) => {
      prev.delete("category"); // mutually exclusive with the legacy flat category filter
      const current = prev.getAll("subcategoryId");
      const next = turningOn ? [...current, id] : current.filter((v) => v !== id);
      prev.delete("subcategoryId");
      next.forEach((v) => prev.append("subcategoryId", v));
      return prev;
    });
    setSelectedCategoryId(categoryId ?? null);
    if (turningOn) {
      // Results load async (debounced fetch) — retry the scroll a few times
      // so it lands correctly once the grid has actually re-rendered.
      const scroll = () => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      [100, 500, 1000].forEach((ms) => window.setTimeout(scroll, ms));
    }
  };

  // Same idea, at the whole-Category level — clicking a category name selects every product
  // under it (regardless of subcategory), combined with any other category/subcategory picks.
  const selectCategory = (id: string, segId?: string | null) => {
    const turningOn = !categoryIds.includes(id);
    setSearchParams((prev) => {
      prev.delete("category");
      const current = prev.getAll("categoryId");
      const next = turningOn ? [...current, id] : current.filter((v) => v !== id);
      prev.delete("categoryId");
      next.forEach((v) => prev.append("categoryId", v));
      return prev;
    });
    setSelectedSegmentId(segId ?? null);
    if (turningOn) {
      const scroll = () => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      [100, 500, 1000].forEach((ms) => window.setTimeout(scroll, ms));
    }
  };

  // Reset on filter change. subcategoryIds/categoryIds are new array instances every render
  // (from _searchParams.getAll), so a joined string is used as the dependency key instead of
  // the arrays themselves — otherwise this (and the fetch effect below) would re-run every render.
  const subcategoryIdsKey = subcategoryIds.join(",");
  const categoryIdsKey = categoryIds.join(",");
  useEffect(() => {
    setPage(0);
  }, [industrySlug, category, subcategoryIdsKey, categoryIdsKey, tagId, newArrivals, deals, fastMoving, inStock, minPrice, maxPrice, sort]);

  // Fetch (wrapped with smart fallback handling — does not change API calls).
  useEffect(() => {
    if (searchResults !== null) return;
    let cancelled = false;
    if (page === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    // Use the diversified (category-interleaved) feed when no filters are
    // active and the user hasn't picked a custom sort. Otherwise fall back to
    // the standard filterable endpoint.
    const useDiversified = !anyFilterActive && sort === "newest";
    const fetcher = useDiversified
      ? api.getDiversifiedProducts({ page, size: PAGE_SIZE })
      : api.getProducts({
          industryId: selectedIndustry?.id,
          category: category || undefined,
          subcategoryId: subcategoryIds.length > 0 ? subcategoryIds : undefined,
          categoryId: categoryIds.length > 0 ? categoryIds : undefined,
          tagId: tagId || undefined,
          isNewArrival: newArrivals || undefined,
          isDiscount: deals || undefined,
          isFastMoving: fastMoving || undefined,
          page,
          size: PAGE_SIZE,
          sort: sortParam,
        });

    void fetcher
      .then((data) => {
        if (cancelled) return;
        // Client-side post-filter for price + inStock (mock-friendly).
        let filtered = data;
        if (inStock) {
          filtered = filtered.filter(
            (p) => getStockInfo(p, null, 0).state !== "out_of_stock",
          );
        }
        if (minPrice !== undefined) {
          filtered = filtered.filter((p) => (p.basePrice ?? 0) >= minPrice);
        }
        if (maxPrice !== undefined && maxPrice < ALL_PRICE_MAX) {
          filtered = filtered.filter((p) => (p.basePrice ?? 0) <= maxPrice);
        }
        setHasMore(data.length === PAGE_SIZE);
        setProducts((prev) => (page === 0 ? filtered : [...prev, ...filtered]));

        // Empty-state vs ok. Only call it "empty" on the first page with no
        // filters — otherwise it's just a filter that excluded everything.
        if (page === 0 && data.length === 0 && !anyFilterActive) {
          setLoadState("empty");
        } else {
          setLoadState("ok");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const next = classifyError(err);
        setLoadState(next);
        if (page === 0) {
          // Fallback: silently swap in mock catalogue so the UI stays browsable.
          setProducts(next === "fallback" ? MOCK_PRODUCTS : []);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setIsLoadingMore(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndustry, category, subcategoryIdsKey, categoryIdsKey, tagId, newArrivals, deals, fastMoving, inStock, minPrice, maxPrice, sortParam, page, searchResults, anyFilterActive, retryTick, sort]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => { if (query) prev.set("q", query); else prev.delete("q"); return prev; });
      if (query.trim().length < 2) { setSearchResults(null); return; }
      setIsLoading(true);
      void api
        .searchProducts(query.trim(), 12)
        .then((data) => setSearchResults(data))
        .catch(() => setSearchResults([]))
        .finally(() => setIsLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Debounced price range — commits to URL params (and so the product fetch)
  // only after the visitor pauses typing, not on every keystroke. Both bounds
  // are set in ONE setSearchParams call (not two separate setParam calls) —
  // two back-to-back calls here meant the second silently clobbered the
  // first, so minPrice never actually stuck.
  useEffect(() => {
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        if (minPriceInput) prev.set("minPrice", minPriceInput); else prev.delete("minPrice");
        if (maxPriceInput) prev.set("maxPrice", maxPriceInput); else prev.delete("maxPrice");
        return prev;
      });
    }, 400);
    return () => { if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPriceInput, maxPriceInput]);

  // Keeps the latest fetched grid available to the "more to consider" effect
  // below without adding `products` to its dependency list — otherwise every
  // "load more" page would re-trigger it and reshuffle the suggestions.
  const productsRef = useRef<Product[]>([]);
  useEffect(() => { productsRef.current = products; }, [products]);

  // "Keep browsing" / "You might also like" — whatever the visitor is looking
  // at (a text search, capped at 12 with no pagination; or an industry/
  // category/subcategory filter) is shown first and in full; this is a
  // distinct, clearly-separate section of other products underneath, so a
  // narrow filter or search doesn't feel like a dead end. Diversified mix,
  // excluding whatever's already shown above.
  useEffect(() => {
    if (isLoading) return;
    const shown = searchResults ?? (anyFilterActive ? productsRef.current : null);
    if (!shown || shown.length === 0) { setMoreProducts(null); return; }
    let cancelled = false;
    const shownIds = new Set(shown.map((p) => p.id));
    void api
      .getDiversifiedProducts({ size: 20 })
      .then((data) => {
        if (!cancelled) {
          // This is supplementary browsing, not itself a search result — same in-stock-only rule
          // as the general grid above, not the more permissive search-results one.
          setMoreProducts(
            data.filter((p) => !shownIds.has(p.id) && getStockInfo(p, null, 0).canOrder),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setMoreProducts([]);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults, anyFilterActive, isLoading]);

  const setParam = (key: string, value: string | number | boolean | undefined) => {
    setSearchParams((prev) => { const v = value; if (v !== undefined && v !== "") prev.set(key, String(v)); else prev.delete(key); return prev; });
  };

  // Set several params in ONE setSearchParams call. Calling setParam multiple times in a row for
  // different keys in the same handler silently drops all but the last update (the price-input
  // debounce hit this exact bug earlier) — anywhere more than one param needs to change together,
  // use this instead.
  const setParams = (updates: Record<string, string | number | boolean | undefined>) => {
    setSearchParams((prev) => {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== "") prev.set(key, String(value));
        else prev.delete(key);
      }
      return prev;
    });
  };

  // Switching (or clearing) the industry also drops any category/subcategory selections —
  // they were scoped to whichever industry's accordion they were picked from, so carrying them
  // over to a different (or no) industry would silently keep filtering by something that's no
  // longer visible in the UI.
  const toggleIndustry = (slug: string) => {
    setSearchParams((prev) => {
      if (prev.get("industry") === slug) prev.delete("industry");
      else prev.set("industry", slug);
      prev.delete("subcategoryId");
      prev.delete("categoryId");
      return prev;
    });
    setSelectedSegmentId(null);
    setSelectedCategoryId(null);
  };

  const toggle = (key: "newArrivals" | "deals" | "fastMoving" | "inStock") => {
    setSearchParams((prev) => { if (prev.get(key)) prev.delete(key); else prev.set(key, "true"); return prev; });
  };

  const clearAll = () => {
    setQuery("");
    setSearchResults(null);
    setSelectedSegmentId(null);
    setSelectedCategoryId(null);
    setMinPriceInput("");
    setMaxPriceInput("");
    setSearchParams(new URLSearchParams());
  };

  // Per-visit randomized order for the default ("newest") sort, so customers
  // see a fresh mix of categories and prices each time they land on the page.
  // Stable per session: each product gets a random rank the first time we see
  // it, so paginating ("Load more") doesn't reshuffle already-rendered cards.
  const shuffleRanks = useRef<Map<string, number>>(new Map());
  const grid = useMemo(() => {
    // .slice(0, revealedCount) is the actual gate behind the deliberate load-more pacing above —
    // `products` itself already has the next page's items the instant the fetch resolves, this is
    // what withholds them from actually rendering until the spinner/skeleton sequence finishes.
    const base = searchResults ?? products.slice(0, revealedCount);
    // Honour explicit sort choices — only shuffle on the default sort and
    // when the user has not narrowed the catalogue with category filters.
    const ordered = sort !== "newest" || searchResults
      ? base
      : (() => {
          const ranks = shuffleRanks.current;
          for (const p of base) {
            if (!ranks.has(p.id)) ranks.set(p.id, Math.random());
          }
          return [...base].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0));
        })();

    // General browse listing: in-stock (incl. low-stock) only — out-of-stock and made-to-order
    // are both reserved for search now (business decision 2026-09-04, tightened from the earlier
    // "deprioritize to the back" rule — nobody browsing should see what they can't buy at all).
    // Search is different: a customer who typed the words for an out-of-stock item should still
    // see it as itself, clearly labeled, rather than have it vanish from a result set they asked
    // for by name — but made-to-order stays hidden even there, since it needs a WhatsApp enquiry
    // either way and showing it in a search result implies it's a normal add-to-cart match.
    if (searchResults) {
      return ordered.filter((p) => !getStockInfo(p, null, 0).isMadeToOrder);
    }
    return ordered.filter((p) => getStockInfo(p, null, 0).canOrder);
  }, [searchResults, products, revealedCount, sort]);

  // JSON-LD ItemList for the visible page
  const itemListLd = useMemo(() => {
    if (!grid.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: grid.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.momentspackaging.com/products/${p.slug}`,
        name: p.name,
      })),
    };
  }, [grid]);

  // Active filter chips
  const chips: Array<{ label: string; clear: () => void }> = [];
  // Industry is shown in the context banner below — skip adding it here to avoid duplication.
  if (category) {
    const cat = CATEGORY_OPTIONS.find((c) => c.value === category);
    chips.push({ label: cat?.label ?? category, clear: () => setParam("category", undefined) });
  }
  // One chip per selected subcategory/category — multi-select means there can be several at once.
  for (const id of subcategoryIds) {
    const sub = subcategories.find((s) => s.id === id);
    chips.push({
      label: sub ? `${sub.segmentName ?? ""} › ${sub.categoryName ?? ""} › ${sub.name}` : "Subcategory",
      clear: () => setSearchParams((prev) => {
        const next = prev.getAll("subcategoryId").filter((v) => v !== id);
        prev.delete("subcategoryId");
        next.forEach((v) => prev.append("subcategoryId", v));
        return prev;
      }),
    });
  }
  for (const id of categoryIds) {
    const cat = taxCategories.find((c) => c.id === id);
    chips.push({
      label: cat ? `${cat.segmentName ?? ""} › ${cat.name} (all)` : "Category",
      clear: () => setSearchParams((prev) => {
        const next = prev.getAll("categoryId").filter((v) => v !== id);
        prev.delete("categoryId");
        next.forEach((v) => prev.append("categoryId", v));
        return prev;
      }),
    });
  }
  if (tagId) {
    const tag = tagsList.find((t) => t.id === tagId);
    chips.push({ label: tag?.name ?? "Tag", clear: () => setParam("tagId", undefined) });
  }
  if (newArrivals) chips.push({ label: "New Arrivals", clear: () => setParam("newArrivals", undefined) });
  if (deals) chips.push({ label: "Deals", clear: () => setParam("deals", undefined) });
  if (fastMoving) chips.push({ label: "Fast Moving", clear: () => setParam("fastMoving", undefined) });
  if (inStock) chips.push({ label: "In stock only", clear: () => setParam("inStock", undefined) });
  if (minPrice !== undefined) chips.push({ label: `Min KES ${minPrice}`, clear: () => { setMinPriceInput(""); setParam("minPrice", undefined); } });
  if (maxPrice !== undefined) chips.push({ label: `Max KES ${maxPrice}`, clear: () => { setMaxPriceInput(""); setParam("maxPrice", undefined); } });

  return (
    <SiteLayout>
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}

      {/* Same banner as the cart page, mounted here too so the free-delivery/rewards gap is
          visible while browsing — right under the header, alongside the cart icon — and ticks
          down live (via useRewardDeliveryGap -> cartTotal -> useCountUp) the moment a product
          is added from this page, without navigating to the cart first. */}
      <RewardDeliveryBanners />
      <div className={REWARD_BANNER_SPACER_CLASS} aria-hidden="true" />

      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8 lg:py-16">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Catalogue</p>
          <h1 className="mt-3 font-display text-4xl font-medium text-foreground sm:text-5xl">
            Find Packaging for Your Business
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Browse packaging solutions by business type, or simply search for what you need. Order from as little as
            1 unit and enjoy convenient delivery across Nairobi.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:pb-24 lg:px-8">
        {/* Search */}
        <div className="pt-6">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products — e.g. pizza box, coffee cups, mifuko, cling film..."
              className="w-full rounded-xl border border-border bg-background px-4 py-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status toggles */}
        <div className="scrollbar-hide mt-3 flex items-center gap-2 overflow-x-auto pb-3">
          <ToggleChip active={!!newArrivals} onClick={() => toggle("newArrivals")}>New Arrivals</ToggleChip>
          <ToggleChip active={!!deals} onClick={() => toggle("deals")}>Deals</ToggleChip>
          <ToggleChip active={!!fastMoving} onClick={() => toggle("fastMoving")}>Fast Moving</ToggleChip>
          <ToggleChip active={!!inStock} onClick={() => toggle("inStock")}>In stock</ToggleChip>
        </div>

        {/* Browse by industry — stays visible even once one is picked (the
            selected tile just highlights) so switching industries is a single
            click, not "See all" then re-pick. Only hidden during a text search,
            since search results replace the whole grid below anyway. A card
            grid works fine on tablet/desktop, but on a phone it pushes the
            actual product grid several screens down — a compact dropdown gets
            to the same result (?industry=slug) in the same footprint as any
            other filter control. */}
        {!isLoading && !searchResults && industries.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Browse by industry
            </p>
            <div className="mt-3 sm:hidden">
              <select
                value={industrySlug ?? ""}
                onChange={(e) => setParam("industry", e.target.value || undefined)}
                className="w-full rounded-full border border-foreground/20 bg-background px-4 py-2.5 text-sm text-foreground"
              >
                <option value="">All industries</option>
                {industries.map((ind) => (
                  <option key={ind.id} value={ind.slug}>{ind.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 hidden gap-x-3 gap-y-3 sm:grid sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {industries.map((ind) => {
                const Icon = ind.icon;
                const isActive = industrySlug === ind.slug;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => toggleIndustry(ind.slug)}
                    aria-pressed={isActive}
                    className={`group flex items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                    }`}
                  >
                    {Icon && (
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-primary ${
                        isActive ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/15"
                      }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{ind.name}</p>
                      {ind.description && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground">
                          {ind.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Refinement bar — Segment/Category/Subcategory browsing (when available)
            lives here alongside the legacy flat category list, sort, and price,
            all in one panel so there's one place to refine, not two competing ones. */}
        <div id="browse-by-category" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
          {/* Only shown with no industry selected — once an industry is picked, the
              "Categories in {industry}" accordion below already surfaces what's actually
              tagged to it, so a separate "Popular in {industry}" strip was redundant and,
              per client feedback, could drift out of alignment with it. */}
          {!searchResults && !selectedIndustry && suggestedSubcategories.length > 0 && (
            <div className="mb-4 border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {suggestionsArePersonalized ? "Recommended for you" : "Popular subcategories"}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {suggestedSubcategories.map((sub) => (
                  <ChipButton
                    key={sub.id}
                    active={subcategoryIds.includes(sub.id)}
                    onClick={() => selectSubcategory(sub.id, sub.categoryId)}
                  >
                    {sub.name}
                  </ChipButton>
                ))}
              </div>
            </div>
          )}
          {selectedIndustry && associatedSubcategoryIds && associatedSubcategoryIds.size === 0 && (
            <div className="mb-4 rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
              No categories have been tagged for <span className="font-semibold text-foreground">{selectedIndustry.name}</span> yet —
              showing all matching products below instead.
            </div>
          )}
          {segments.length > 0 && (!selectedIndustry || (associatedSubcategoryIds && associatedSubcategoryIds.size > 0)) && (
            <div className="mb-4 border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {selectedIndustry ? `Categories in ${selectedIndustry.name}` : "Browse by category"}
              </p>
              {/* Each segment is a disclosure row: clicking it expands its own
                  categories/subcategories directly beneath it (indented, with
                  a rail), instead of the old two-step chip-reveals-chip flow
                  where it wasn't visually clear what belonged under what.
                  When an industry is selected, only segments/categories/
                  subcategories actually associated with it show here — the
                  rest live in the "Other categories" dropdown below, so
                  picking an industry doesn't leave a wall of dead, empty
                  segment rows that expand to nothing. */}
              {/* Grid, not a single column — a collapsed segment button is
                  narrow, so a 1-column list left most of the panel's width
                  empty. Multiple segments now sit side by side; an expanded
                  one spans the full row width for its category/subcategory
                  panel, and the grid continues below it. */}
              <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {segments.map((seg) => {
                  const segCategories = taxCategories.filter((c) => {
                    if (c.segmentId !== seg.id) return false;
                    if (!selectedIndustry) return true;
                    return subcategories.some((s) => s.categoryId === c.id && isSubcategoryAssociated(s));
                  });
                  if (segCategories.length === 0) return null;
                  const isOpen = selectedSegmentId === seg.id;
                  return (
                    <div key={seg.id} className={isOpen ? "sm:col-span-2 lg:col-span-3" : ""}>
                      <button
                        type="button"
                        onClick={() => selectSegment(seg.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          isOpen
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-foreground/20 bg-cream text-foreground hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <span>{seg.name}</span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && segCategories.length > 0 && (
                        <div className="ml-3 mt-1.5 space-y-2 border-l-2 border-border pl-3">
                          {segCategories.map((cat) => {
                            const catSubs = subcategories.filter((s) => s.categoryId === cat.id && isSubcategoryAssociated(s));
                            if (catSubs.length === 0) return null;
                            const categorySelected = categoryIds.includes(cat.id);
                            return (
                              <div key={cat.id}>
                                {/* Clicking the category name selects every product under it
                                    (all its subcategories at once), combined with whatever
                                    subcategories/categories are already picked elsewhere. */}
                                <button
                                  type="button"
                                  onClick={() => selectCategory(cat.id, seg.id)}
                                  className={`text-sm font-bold hover:underline ${
                                    categorySelected ? "text-primary" : "text-foreground"
                                  }`}
                                  title={`Show all products in ${cat.name}`}
                                >
                                  {cat.name}{categorySelected ? " ✓" : ""}
                                </button>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {catSubs.map((sub) => (
                                    <ChipButton
                                      key={sub.id}
                                      active={subcategoryIds.includes(sub.id)}
                                      onClick={() => selectSubcategory(sub.id, cat.id)}
                                      size="sm"
                                    >
                                      {sub.name}
                                    </ChipButton>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              {segments.length > 0 ? "Other categories" : "Category"}
              {segments.length > 0 ? (
                // With no industry active, this is the full flat Segment › Category ›
                // Subcategory picklist (useful once there are many subcategories). With an
                // industry active, it narrows to just what's NOT associated with it — the
                // main accordion above already covers the associated ones, so this is
                // specifically the "browse outside this industry" escape hatch. Picking one
                // here clears the industry filter (browsing becomes segment-scoped again,
                // not industry-scoped) since that's what the picked subcategory belongs to.
                <select
                  value={subcategoryIds.length === 1 ? subcategoryIds[0] : ""}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    // .set() (via setParams) replaces the whole subcategoryId set with just this
                    // one — deliberately single-select here, unlike the multi-select chips above.
                    setParams({ subcategoryId: id, categoryId: undefined, category: undefined, industry: undefined });
                    const sub = id ? subcategories.find((s) => s.id === id) : undefined;
                    setSelectedCategoryId(sub?.categoryId ?? null);
                    setSelectedSegmentId(sub?.segmentId ?? null);
                    if (id) {
                      const scroll = () => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      [100, 500, 1000].forEach((ms) => window.setTimeout(scroll, ms));
                    }
                  }}
                  className="rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">All</option>
                  {segments.map((seg) =>
                    taxCategories
                      .filter((cat) => cat.segmentId === seg.id)
                      .map((cat) => {
                        const catSubs = subcategories.filter((s) => s.categoryId === cat.id && (!selectedIndustry || !isSubcategoryAssociated(s)));
                        if (catSubs.length === 0) return null;
                        return (
                          <optgroup key={cat.id} label={`${seg.name} › ${cat.name}`}>
                            {catSubs.map((sub) => (
                              <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                          </optgroup>
                        );
                      }),
                  )}
                </select>
              ) : (
                <select
                  value={category ?? ""}
                  onChange={(e) => setParam("category", e.target.value || undefined)}
                  className="rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">All</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              )}
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value as SortKey)}
                className="rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low → high</option>
                <option value="price-desc">Price: high → low</option>
                <option value="popular">Most popular</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              Price (KES)
              <input
                type="number"
                min={0}
                placeholder="min"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="w-20 rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                min={0}
                placeholder="max"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="w-20 rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs"
              />
            </label>

            {anyFilterActive && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto whitespace-nowrap text-xs font-medium text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Active chips */}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Context banner: shows which industry is active. No `!isLoading` gate — it should
            stay put while a new industry's results load in, not flicker out and back. */}
        {selectedIndustry && (
          <div className="mt-4 rounded-xl bg-primary/8 px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Showing packaging for</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{selectedIndustry.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setParam("industry", undefined)}
                className="ml-4 shrink-0 text-xs font-medium text-primary hover:underline"
              >
                See all
              </button>
            </div>
          </div>
        )}

        {/* Subtle banner: API unreachable / 404 → showing mock catalogue. */}
        {!searchResults && loadState === "fallback" && !isLoading && (
          <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            Showing sample products — connect to backend to see live catalogue.
          </div>
        )}

        {/* Grid */}
        <div id="results-anchor" className="scroll-mt-20" />
        {isLoading && grid.length === 0 ? (
          // True first load / nothing to show yet — the only time we blank to skeletons.
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : !searchResults && !isLoading && loadState === "unauthorized" ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center">
            <h3 className="font-display text-2xl text-foreground">Sign in to view products.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This catalogue is only visible to signed-in customers.
            </p>
            <Link
              to="/account/login"
              className="mt-5 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Link>
          </div>
        ) : !searchResults && !isLoading && loadState === "server_error" ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center">
            <h3 className="font-display text-2xl text-foreground">
              Something went wrong on our end. Please try again.
            </h3>
            <button
              type="button"
              onClick={() => setRetryTick((n) => n + 1)}
              className="mt-5 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : !searchResults && !isLoading && loadState === "empty" ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center">
            <h3 className="font-display text-2xl text-foreground">No products listed yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Our catalogue is being prepared. Reach out and we&apos;ll help you directly.
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Contact the team
            </Link>
          </div>
        ) : grid.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-12 text-center">
            <h3 className="font-display text-2xl text-foreground">
              {selectedIndustry
                ? `No products listed for ${selectedIndustry.name} yet`
                : "No products match your filters"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedIndustry
                ? "Try a different business type, or contact us — we may have unlisted stock."
                : "Try adjusting your search or filters."}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground hover:border-foreground/40"
              >
                Clear filters
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%2C%20I%20need%20packaging${selectedIndustry ? `%20for%20${encodeURIComponent(selectedIndustry.name)}` : ""}%20and%20can't%20find%20what%20I%20need%20on%20the%20website.`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                WhatsApp us
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Result count */}
            {grid.length > 0 && (
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                {searchResults
                  ? `${grid.length} result${grid.length === 1 ? "" : "s"} for "${query}"`
                  : selectedIndustry
                  ? `${grid.length}${hasMore ? "+" : ""} product${grid.length === 1 ? "" : "s"} for ${selectedIndustry.name}`
                  : `${grid.length}${hasMore ? "+" : ""} product${grid.length === 1 ? "" : "s"}`}
                {isLoading && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Updating…
                  </span>
                )}
              </p>
            )}
            {/* isLoading here means a filter/sort/search change is refetching while these are
                still last period's results — dim them instead of blanking to skeletons, so
                refining a filter doesn't feel like the whole page reloading. */}
            <div
              className={`mt-4 grid animate-in fade-in grid-cols-2 gap-3 duration-300 sm:mt-5 sm:gap-5 md:grid-cols-3 lg:gap-6 transition-opacity ${
                isLoading ? "opacity-40 pointer-events-none" : "opacity-100"
              }`}
            >
              {grid.map((p) => (
                // animate-in only plays once, at mount — an already-rendered card keeps its DOM
                // node across a "load more" append (same key), so only the newly-appended ones
                // actually fade in; nothing replays for cards already on screen.
                <div key={p.id} className="animate-in fade-in duration-500">
                  <ProductCard product={p} onConfigure={handleConfigure} />
                </div>
              ))}
              {/* The second half of the deliberate load-more sequence — appears once the ring
                  below finishes (see morePhase's own effects above), laid out in the SAME grid as
                  the real cards so it visually reads as the grid filling in, not a separate
                  loading row. */}
              {morePhase === "skeleton" &&
                Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={`more-${i}`} />)}
              {/* A second, small "more is coming" indicator placed AS A GRID ITEM — client
                  concern: an odd product count leaves the last row's final column(s) empty (e.g.
                  one lone card on the left in a 2-col mobile grid), and the big ring further below
                  the whole grid isn't obviously connected to that specific empty gap, reading as
                  "that's it" rather than "more is loading." CSS grid auto-flow places this in
                  whatever cell is actually next — the empty one beside an odd last item, or a
                  fresh row if the count was already even — with zero column-count math needed
                  here. Only during "spinner": once "skeleton" starts, the 4 real skeleton cards
                  above already fill that same role more fully. */}
              {morePhase === "spinner" && (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/20 sm:aspect-[4/3] sm:rounded-2xl lg:aspect-[16/10]">
                  <LoadMoreRing pct={ringPct} className="h-7 w-7 opacity-70" />
                </div>
              )}
            </div>

            {!searchResults && (
              // py-8 (not just mt-8) so this reads as its own clearly visible stop on a phone
              // screen, not a thin sliver easy to scroll straight past — mobile is the primary
              // case here (client decision 2026-09-04), sizing scales back down on larger screens.
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 py-8 sm:py-4">
                {morePhase === "spinner" && (
                  <>
                    <LoadMoreRing pct={ringPct} className="h-12 w-12 sm:h-10 sm:w-10" />
                    <p className="text-sm font-medium text-foreground sm:text-xs sm:font-normal sm:text-muted-foreground" aria-live="polite">
                      Loading more products…
                    </p>
                  </>
                )}
                <div ref={sentinelRef} className="h-1 w-full" />
              </div>
            )}

            {/* Keep browsing / You might also like — search results are capped
                with no pagination, so without this a customer who used
                quick-find or the search box hits a dead end after 12 items.
                Also shown after a filtered (industry/category/subcategory)
                grid, as a distinct, clearly-separate section underneath —
                the filtered results the visitor asked for stay first and in
                full, this is just a further "other things to consider" nudge. */}
            {(searchResults || anyFilterActive) && moreProducts && moreProducts.length > 0 && (
              <div className="mt-14 border-t border-border pt-10">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {searchResults ? "Keep browsing" : "You might also like"}
                  </p>
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    See all products →
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
                  {moreProducts.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} onConfigure={handleConfigure} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
    </SiteLayout>
  );
}

/** The "circle that fills with color as it loads" from the load-more sequence above — `pct`
 *  (0-100) is driven entirely by the parent's own rAF loop, this just renders whatever it's told
 *  so the parent stays the single source of truth for timing (default pace, floor, retargeting
 *  on early completion). A real progressbar role, not just decorative, since it's genuinely
 *  communicating "still working" the way any loading indicator would. */
function LoadMoreRing({ pct, className }: { pct: number; className?: string }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;
  return (
    <svg
      viewBox="0 0 40 40"
      className={`-rotate-90 ${className ?? "h-10 w-10"}`}
      role="progressbar"
      aria-label="Loading more products"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <circle cx={20} cy={20} r={radius} fill="none" stroke="var(--border)" strokeWidth={4} />
      <circle
        cx={20}
        cy={20}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function ChipButton({
  active,
  onClick,
  children,
  size = "md",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-medium transition-colors ${
        size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-xs"
      } ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/20 bg-cream text-foreground hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-foreground/20 bg-cream text-foreground hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}

export default ProductsPage;

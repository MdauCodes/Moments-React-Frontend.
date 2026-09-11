import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { categories } from "@/data/products";
import { api, type Segment, type Category as TaxCategory, type Subcategory } from "@/services/api";

/**
 * The "Shop" mega-menu, shared by SiteHeader (every inner page) and HomeNav (the homepage) — it
 * previously existed only on SiteHeader, so the homepage's nav was a plain link with no category
 * picker at all. Two open states, not one:
 *  - PEEK: opens on hover after a short intent delay, closes shortly after the pointer leaves —
 *    the classic "preview" behavior, forgiving of a mouse passing near the trigger.
 *  - PINNED: set by clicking the trigger. Stays open regardless of the pointer; closes only via
 *    the panel's own × button, Escape, an outside click, clicking the trigger again, or picking a
 *    category (which navigates away anyway). This is deliberately different from PEEK — "click to
 *    commit to browsing" versus "hover to preview."
 * Clicking the trigger while already on /products never re-navigates (which used to push a
 * duplicate history entry and remount the whole page) — it only ever toggles the pinned panel.
 * From anywhere else, the click still navigates to /products as a normal link AND leaves the
 * panel pinned open on arrival, so the customer lands ready to pick a category immediately.
 */
export function ShopMegaMenu({
  triggerClassName,
  triggerActiveClassName = "",
  triggerInactiveClassName = "",
  chevronClassName = "h-3.5 w-3.5",
}: {
  /** Always-applied base classes (layout/sizing/font) — visual theme differs between the light
   *  SiteHeader nav and the dark homepage nav, so callers own their own look. */
  triggerClassName: string;
  /** Extra classes applied while on /products (matches the old NavLink isActive treatment). */
  triggerActiveClassName?: string;
  /** Extra classes applied everywhere else. */
  triggerInactiveClassName?: string;
  chevronClassName?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const onProductsPage = location.pathname.startsWith("/products");

  // Carries "arrive with the menu pinned open" across a real navigation via router state — a
  // plain in-memory flag can't survive this specific transition: SiteHeader (and, now, HomeNav)
  // fully unmount and remount on every route change in this app (SiteLayout is rendered inside
  // each route, not as a stable parent outside the router outlet), so whatever this component
  // instance set right before navigating is already gone by the time the new page's instance
  // mounts. Scrubbed immediately after being read so browser Back/Forward doesn't re-open it.
  const openedViaRouterState = (location.state as { openShopMenu?: boolean } | null)?.openShopMenu === true;
  const [open, setOpen] = useState(openedViaRouterState);
  const [pinned, setPinned] = useState(openedViaRouterState);

  useEffect(() => {
    if (openedViaRouterState) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.getSegments(), api.getCategories(), api.getSubcategories()]).then(
      ([segs, cats, subs]) => {
        if (cancelled) return;
        setSegments(segs);
        setTaxCategories(cats);
        setSubcategories(subs);
        if (segs.length > 0) setActiveSegmentId((prev) => prev ?? segs[0].id);
      },
    ).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const categoriesForActiveSegment = useMemo(
    () => taxCategories.filter((c) => c.segmentId === activeSegmentId),
    [taxCategories, activeSegmentId],
  );

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  const handleMouseEnter = () => {
    if (pinned) return; // already open and staying open regardless of hover
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), 150);
  };
  const handleMouseLeave = () => {
    if (pinned) return;
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  };

  const closeAndUnpin = () => {
    clearTimers();
    setOpen(false);
    setPinned(false);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (onProductsPage) {
      // Already there — re-navigating just pushes a duplicate history entry and remounts the
      // whole page for nothing. Toggle the pin instead.
      e.preventDefault();
      clearTimers();
      if (pinned) {
        closeAndUnpin();
      } else {
        setPinned(true);
        setOpen(true);
      }
    } else {
      // Let the normal navigation proceed; arrive with the panel already pinned open.
      setPinned(true);
      setOpen(true);
    }
  };

  const handleCategorySelected = () => {
    closeAndUnpin();
  };

  // Outside click closes a PINNED menu (a peek that isn't pinned already closes itself on
  // hover-out, so this only needs to matter once pinned).
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAndUnpin();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pinned]);

  // Escape closes either state and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAndUnpin();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <NavLink
        ref={triggerRef}
        to="/products"
        onClick={handleTriggerClick}
        state={{ openShopMenu: true }}
        aria-haspopup="true"
        aria-expanded={open}
        className={`${triggerClassName} ${onProductsPage ? triggerActiveClassName : triggerInactiveClassName}`}
      >
        {onProductsPage ? "Browse categories" : "Shop"}
        <ChevronDown
          className={`${chevronClassName} transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </NavLink>

      {open && (
        <div
          className={`absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 ${segments.length > 0 ? "w-[46rem] max-w-[90vw]" : "w-72"}`}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-xl ring-1 ring-black/5">
            {pinned && (
              <button
                type="button"
                onClick={closeAndUnpin}
                aria-label="Close menu"
                className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {segments.length > 0 ? (
              // Two-pane mega-menu: Segments as a left rail, the hovered/selected segment's
              // Categories (as column headers) with their Subcategories underneath on the right.
              <div className="flex">
                <div className="w-52 shrink-0 border-r border-border bg-cream/40 py-2">
                  <Link
                    to="/products"
                    onClick={handleCategorySelected}
                    className="block px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    All products →
                  </Link>
                  {segments.map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onMouseEnter={() => setActiveSegmentId(seg.id)}
                      onClick={() => setActiveSegmentId(seg.id)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                        activeSegmentId === seg.id
                          ? "bg-secondary font-medium text-foreground"
                          : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {seg.name}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-5">
                  {categoriesForActiveSegment.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {categoriesForActiveSegment.map((cat) => {
                        const catSubs = subcategories.filter((s) => s.categoryId === cat.id);
                        if (catSubs.length === 0) return null;
                        return (
                          <div key={cat.id}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{cat.name}</p>
                            <div className="mt-2 flex flex-col gap-1.5">
                              {catSubs.map((sub) => (
                                <Link
                                  key={sub.id}
                                  to={`/products?subcategoryId=${sub.id}`}
                                  onClick={handleCategorySelected}
                                  className="text-sm text-foreground/70 transition-colors hover:text-primary"
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No subcategories yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/products"
                  onClick={handleCategorySelected}
                  className="block border-b border-border bg-cream/60 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  All products →
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/products?category=${c.slug}`}
                    onClick={handleCategorySelected}
                    className="block border-b border-border/60 px-4 py-2.5 text-sm text-foreground/80 transition-colors last:border-b-0 hover:bg-secondary hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

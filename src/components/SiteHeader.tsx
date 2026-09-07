import { Link, NavLink, useNavigate } from "react-router-dom";

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { Menu, X, ChevronDown, ChevronRight, Search, ShoppingCart, User, HelpCircle } from "lucide-react";
import logoUrl from "@/assets/moments_logo_without_background.png";
import { categories } from "@/data/products";
import { SearchCommand } from "@/components/SearchCommand";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { api, type Segment, type Category as TaxCategory, type Subcategory } from "@/services/api";

/**
 * Commerce-first nav. Categories live inside the "Shop" dropdown so the
 * top bar stays uncluttered. Deals & Enterprise sit alongside as siblings.
 */
type SimpleNav = { to: string; label: string };

// Order: Company, Sustainability, [Shop dropdown], Track Order, Deals.
const navBeforeShop: readonly SimpleNav[] = [
  { to: "/company-profile", label: "About Us" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/sustainability", label: "Our Sustainability Pledge" },
];
const navAfterShop: readonly SimpleNav[] = [
  { to: "/orders/track", label: "Track Order" },
  { to: "/deals", label: "Deals" },
];

/** Set on <html> so a page-level fixed bar (RewardDeliveryBanners' default position) can sit
 *  right below the header instead of guessing a fixed pixel offset — that guess broke as soon as
 *  anything (CelebratoryRewardBanner, the launch banner) added height above the header, since the
 *  header itself is `sticky` and pushes down naturally but the guess never knew that happened.
 *  Falls back to a sane default via `var(--site-header-bottom, ...)` wherever it's read, so
 *  nothing breaks before this effect's first paint. */
const HEADER_BOTTOM_VAR = "--site-header-bottom";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileShopOpen, setMobileShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  // Segment -> Category -> Subcategory taxonomy, driving the "Shop" mega-menu
  // (desktop) and the drill-down accordion (mobile) below. Falls back to the
  // legacy flat `categories` list until the admin has set these up.
  const [segments, setSegments] = useState<Segment[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [mobileOpenSegmentId, setMobileOpenSegmentId] = useState<string | null>(null);

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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const { openLogin } = useAuthModal();

  // Brief scale-up on the cart icon itself whenever the count goes UP (not on every render, and
  // not on a decrease from removing an item) — the badge number already updates instantly, but a
  // number changing in an 18px circle is easy to miss; a short pulse on the icon around it draws
  // the eye to "yes, that just happened" without a toast/modal interrupting the browse flow.
  const [cartBump, setCartBump] = useState(false);
  const prevItemCount = useRef(itemCount);
  useEffect(() => {
    if (itemCount > prevItemCount.current) {
      setCartBump(true);
      const t = setTimeout(() => setCartBump(false), 450);
      prevItemCount.current = itemCount;
      return () => clearTimeout(t);
    }
    prevItemCount.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  useEffect(() => {
    if (!shopOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShopOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shopOpen]);

  // Global keyboard shortcut: ⌘K / Ctrl+K opens search anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchSeed("");
        setSearchOpen(true);
      } else if (e.key === "/" && !isTyping && !searchOpen) {
        e.preventDefault();
        setSearchSeed("");
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  // Publish the header's real, current bottom edge as a CSS var (see HEADER_BOTTOM_VAR's doc
  // comment). Re-measured on resize and on scroll (rAF-throttled) because the header is `sticky`:
  // before it locks to the top of the viewport its bottom edge moves with the page (it's still
  // sitting below whatever's stacked above it — the launch banner, CelebratoryRewardBanner — in
  // normal flow), and only stabilizes once scrolling has pinned it. A ResizeObserver alone would
  // miss that transition, since the header's own box size isn't what's changing.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const sync = () => {
      rafId = null;
      document.documentElement.style.setProperty(HEADER_BOTTOM_VAR, `${el.getBoundingClientRect().bottom}px`);
    };
    const scheduleSync = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(sync);
    };
    sync();
    const ro = new ResizeObserver(scheduleSync);
    ro.observe(el);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync);
      if (rafId != null) cancelAnimationFrame(rafId);
      document.documentElement.style.removeProperty(HEADER_BOTTOM_VAR);
    };
  }, []);

  const openDropdown = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShopOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setShopOpen(false), 120);
  };

  const openSearch = (seed = "") => {
    setSearchSeed(seed);
    setSearchOpen(true);
  };

  return (
    <>
      {/* top: 0 would re-dock the header right under the (higher z-index) LaunchBanner once
          scrolled past it — this keeps it docked below the banner instead, matching the padding
          styles.css already reserves for the banner on initial load. */}
      <header
        ref={headerRef}
        className="sticky z-40 border-b border-border/60 bg-background/85 backdrop-blur-md"
        style={{ top: "var(--launch-banner-h, 0px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 lg:gap-5 lg:px-8">
          <Link to="/" className="group flex shrink-0 items-center" aria-label="Moments Packaging Kenya — Home">
            <img
              src={logoUrl}
              alt="Moments Packaging Kenya logo"
              width={160}
              height={40}
              className="h-9 w-auto sm:h-10 lg:h-11"
            />
          </Link>

          {/* Desktop search bar (lg+). Acts as a trigger for the overlay. */}
          <button
            type="button"
            onClick={() => openSearch()}
            className="hidden h-10 flex-1 items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary lg:flex lg:max-w-md"
            aria-label="Search packaging"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Search packaging…</span>
            <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline">
              ⌘K
            </kbd>
          </button>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {navBeforeShop.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                className="rounded-full px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground lg:px-4"
              >
                {n.label}
              </Link>
            ))}

            {/* Shop dropdown */}
            <div ref={dropdownRef} className="relative" onMouseEnter={openDropdown} onMouseLeave={scheduleClose}>
              <NavLink
                to="/products"
                className={({ isActive }) => `inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors lg:px-4 ${isActive ? "bg-secondary text-foreground" : "text-foreground/80 hover:bg-secondary hover:text-foreground"}`}
                onClick={() => setShopOpen(false)}
              >
                Shop
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${shopOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </NavLink>

              {shopOpen && (
                <div
                  className={`absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 ${segments.length > 0 ? "w-[46rem] max-w-[90vw]" : "w-72"}`}
                  onMouseEnter={openDropdown}
                  onMouseLeave={scheduleClose}
                >
                  <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xl ring-1 ring-black/5">
                    {segments.length > 0 ? (
                      // Two-pane mega-menu: Segments as a left rail, the hovered
                      // segment's Categories (as column headers) with their
                      // Subcategories underneath on the right — same taxonomy
                      // used on the products page's "Browse by category" panel.
                      <div className="flex">
                        <div className="w-52 shrink-0 border-r border-border bg-cream/40 py-2">
                          <Link
                            to="/products"
                            onClick={() => setShopOpen(false)}
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
                                          onClick={() => setShopOpen(false)}
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
                          onClick={() => setShopOpen(false)}
                          className="block border-b border-border bg-cream/60 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                        >
                          All products →
                        </Link>
                        {categories.map((c) => (
                          <Link
                            key={c.slug}
                            to={`/products?category=${c.slug}`}
                            onClick={() => setShopOpen(false)}
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

            {/* Track Order + Deals */}
            {navAfterShop.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors lg:px-4 ${
                  n.label === "Deals"
                    ? "text-forest hover:bg-forest/10"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                }`}
               
              >
                {n.label}
              </Link>
            ))}

            <div className="ml-2 flex items-center gap-1">
              <Link
                to="/faq"
                aria-label="Help"
                className="grid h-10 w-10 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <HelpCircle className="h-5 w-5" />
              </Link>
              <Link
                to="/cart"
                aria-label="Cart"
                className={`relative grid h-10 w-10 place-items-center rounded-full transition-all ${
                  itemCount > 0
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                } ${cartBump ? "scale-125" : "scale-100"}`}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-[20px] h-[20px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground shadow-sm ring-2 ring-background">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Link>

              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  aria-label="Account"
                  onClick={() => {
                    if (!isAuthenticated) {
                      openLogin();
                    } else {
                      setAccountOpen((v) => !v);
                    }
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <User className="h-5 w-5" />
                </button>
                {isAuthenticated && accountOpen && (
                  <div className="absolute right-0 top-full z-50 w-56 pt-2">
                    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xl ring-1 ring-black/5">
                      <div className="border-b border-border px-4 py-3 font-display text-sm text-foreground">
                        Hi {user?.firstName ?? "there"}
                      </div>
                      <Link
                        to={user?.accountType === "BUSINESS" ? "/account/business" : "/account/merchant"}
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
                      >
                        {user?.accountType === "BUSINESS" ? "Business Dashboard" : "Rewards Dashboard"}
                      </Link>
                      <Link
                        to="/account/orders"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
                      >
                        My Orders
                      </Link>
                      <Link
                        to="/account/profile"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
                      >
                        Profile
                      </Link>
                      <Link
                        to="/account/wishlist"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
                      >
                        Wishlist
                      </Link>
                      <div className="border-t border-border" />
                      <button
                        type="button"
                        onClick={async () => {
                          setAccountOpen(false);
                          await logout();
                          navigate("/");
                        }}
                        className="block w-full px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-secondary"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* Tablet/mobile cart + search + menu */}
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <Link
              to="/cart"
              aria-label="Cart"
              className={`relative grid h-10 w-10 place-items-center rounded-md transition-all ${
                itemCount > 0 ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-secondary"
              } ${cartBump ? "scale-125" : "scale-100"}`}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-[20px] h-[20px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground shadow-sm ring-2 ring-background">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => openSearch()}
              aria-label="Search packaging"
              className="grid h-10 w-10 place-items-center rounded-md border border-border text-foreground/80 transition-colors hover:bg-secondary"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="grid h-10 w-10 place-items-center rounded-md border border-border"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Tablet search trigger between md and lg */}
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label="Search packaging"
            className="hidden h-10 w-10 place-items-center rounded-md border border-border text-foreground/80 transition-colors hover:bg-secondary md:grid lg:hidden"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="border-t border-border bg-background md:hidden">
            <div className="flex flex-col px-5 py-3">
              {navBeforeShop.map((n) => (
                <Link
                  key={n.label}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ))}
              <div>
                <div className="flex items-center">
                  <Link
                    to="/products"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary"
                  >
                    Shop
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileShopOpen((v) => !v)}
                    aria-label="Toggle categories"
                    className="grid h-10 w-10 place-items-center rounded-md text-foreground/60 hover:bg-secondary"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileShopOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {mobileShopOpen && (
                  <div className="ml-3 border-l border-border pl-3">
                    <Link
                      to="/products"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-sm text-foreground/70 hover:bg-secondary"
                    >
                      All products
                    </Link>
                    {segments.length > 0 ? (
                      // Same drill-in-place accordion as the products page's
                      // "Browse by category" panel: tap a segment to expand its
                      // categories/subcategories right below it, tap a
                      // subcategory to navigate there and close the menu.
                      segments.map((seg) => {
                        const segCategories = taxCategories.filter((c) => c.segmentId === seg.id);
                        const isSegOpen = mobileOpenSegmentId === seg.id;
                        return (
                          <div key={seg.id}>
                            <button
                              type="button"
                              onClick={() => setMobileOpenSegmentId((prev) => (prev === seg.id ? null : seg.id))}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm text-foreground/70 hover:bg-secondary"
                            >
                              {seg.name}
                              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isSegOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isSegOpen && segCategories.length > 0 && (
                              <div className="ml-3 border-l border-border pl-3">
                                {segCategories.map((cat) => {
                                  const catSubs = subcategories.filter((s) => s.categoryId === cat.id);
                                  if (catSubs.length === 0) return null;
                                  return (
                                    <div key={cat.id} className="py-1">
                                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                                        {cat.name}
                                      </p>
                                      {catSubs.map((sub) => (
                                        <Link
                                          key={sub.id}
                                          to={`/products?subcategoryId=${sub.id}`}
                                          onClick={() => setOpen(false)}
                                          className="block rounded-md px-3 py-2 text-sm text-foreground/70 hover:bg-secondary"
                                        >
                                          {sub.name}
                                        </Link>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      categories.map((c) => (
                        <Link
                          key={c.slug}
                          to={`/products?category=${c.slug}`}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-3 py-2.5 text-sm text-foreground/70 hover:bg-secondary"
                        >
                          {c.name}
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>

              {navAfterShop.map((n) => (
                <Link
                  key={n.label}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm font-medium hover:bg-secondary ${
                    n.label === "Deals" ? "text-forest" : "text-foreground/80"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to="/faq"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary"
              >
                Help / FAQ
              </Link>

              {isAuthenticated ? (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="px-3 py-1.5 text-xs text-muted-foreground">Hi {user?.firstName ?? "there"}</p>
                  <Link
                    to={user?.accountType === "BUSINESS" ? "/account/business" : "/account/merchant"}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    {user?.accountType === "BUSINESS" ? "Business Dashboard" : "Rewards Dashboard"}
                  </Link>
                  <Link
                    to="/account/orders"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    My Orders
                  </Link>
                  <Link
                    to="/account/profile"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/account/wishlist"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    Wishlist
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                      navigate("/");
                    }}
                    className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-accent hover:bg-secondary"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openLogin();
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm text-foreground/80 hover:bg-secondary"
                >
                  <User className="h-4 w-4" /> Sign in
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <SearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} initialQuery={searchSeed} />
    </>
  );
}

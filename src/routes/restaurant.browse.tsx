// Browse products for a quote (owner, 16 Nov; doc 15 §21): the store's products by industry,
// category or search, with no shop prices. A product already priced for this restaurant shows its
// own price; any other can be added to a quote request, sent from the catalogue page.
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

import { PortalShell } from "@/components/restaurant/PortalShell";
import {
  ErrorText,
  Muted,
  Pill,
  PortalButton,
  PortalButtonLink,
  inputClass,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { api, type Category } from "@/services/api";
import { restaurantApi, type CatalogueLine } from "@/services/restaurantApi";
import { filterVisibleIndustries, type Industry, type Product } from "@/data/products";
import { kes } from "@/lib/restaurantPortal";
import { quoteBasket, useQuoteBasket } from "@/lib/quoteBasket";

const PAGE_SIZE = 20;

export default function RestaurantBrowsePage() {
  useEffect(() => {
    document.title = "Browse products · Moments Packaging";
  }, []);
  return (
    <PortalShell page="catalogue">
      <BrowseBody />
    </PortalShell>
  );
}

function BrowseBody() {
  const basket = useQuoteBasket();
  const [mine, setMine] = useState<Map<string, CatalogueLine>>(new Map());
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [industryId, setIndustryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    restaurantApi
      .catalogue()
      .then((cat) => setMine(new Map(cat.lines.map((l) => [l.productId, l]))))
      .catch(() => undefined);
    api
      .getIndustries()
      .then((list) => setIndustries(filterVisibleIndustries(list)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .getCategories({ industryId: industryId || undefined })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [industryId]);

  const term = q.trim();
  useEffect(() => {
    let live = true;
    setError(null);
    const load = async () => {
      try {
        if (term.length >= 2) {
          const list = await api.searchProducts(term, 40);
          if (live) {
            setProducts(list);
            setMore(false);
          }
          return;
        }
        const list = await api.getProducts({
          industryId: industryId || undefined,
          categoryId: categoryId ? [categoryId] : undefined,
          page,
          size: PAGE_SIZE,
          sort: "name,asc",
        });
        if (!live) return;
        setProducts((prev) => (page === 0 || !prev ? list : [...prev, ...list]));
        setMore(list.length === PAGE_SIZE);
      } catch {
        if (live) setError("Couldn't load products. Check your connection and try again.");
      }
    };
    const t = window.setTimeout(() => void load(), term.length >= 2 ? 250 : 0);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [term, industryId, categoryId, page]);

  /** A new search or filter starts again from the first page. */
  const restart = () => {
    setPage(0);
    setProducts(null);
  };

  const inBasket = useMemo(() => new Set(basket.map((b) => b.id)), [basket]);

  return (
    <div className={`flex flex-col gap-4 ${basket.length ? "pb-20" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold">Browse products</h1>
          <Muted>
            Find what you need and add it to a quote request. Moments prices it for you; products
            already in your catalogue show your price.
          </Muted>
        </div>
        <PortalButtonLink to="/restaurant/catalogue" variant="secondary" className="shrink-0">
          Your catalogue
        </PortalButtonLink>
      </div>

      <div className="flex flex-col gap-2.5">
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
            placeholder="Search, e.g. kraft box, cups, napkins"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              restart();
            }}
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Industry
            <select
              className={inputClass}
              style={{ borderColor: c.line }}
              value={industryId}
              onChange={(e) => {
                setIndustryId(e.target.value);
                setCategoryId("");
                restart();
              }}
              disabled={term.length >= 2}
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Category
            <select
              className={inputClass}
              style={{ borderColor: c.line }}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                restart();
              }}
              disabled={term.length >= 2}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {products === null && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-[14px] bg-black/5" />
          ))}
        </div>
      ) : products && products.length === 0 ? (
        <Muted>No products match. Try another word or category.</Muted>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(products ?? []).map((p) => (
            <ProductTile key={p.id} product={p} price={mine.get(p.id)} added={inBasket.has(p.id)} />
          ))}
        </ul>
      )}
      {more && term.length < 2 && (
        <PortalButton variant="secondary" onClick={() => setPage((n) => n + 1)}>
          Show more
        </PortalButton>
      )}

      {basket.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-14 z-30 border-t bg-white px-4 py-2.5 sm:bottom-0"
          style={{
            borderColor: c.line,
            paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">
              {basket.length} {basket.length === 1 ? "product" : "products"} to price
            </span>
            <PortalButtonLink to="/restaurant/catalogue?ask=1">Review and send</PortalButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTile({
  product,
  price,
  added,
}: {
  product: Product;
  price?: CatalogueLine;
  added: boolean;
}) {
  const image = product.primaryImageUrl || product.image;
  return (
    <li
      className="flex list-none flex-col overflow-hidden rounded-[14px] border bg-white"
      style={{ borderColor: c.line }}
    >
      {/* No link to the shop's product page: it shows shop prices (doc 15 §21). */}
      <div className="aspect-square" style={{ background: c.soft }}>
        {image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <span className="line-clamp-2 break-words text-[14px] font-semibold leading-snug">
          {product.name}
        </span>
        <div className="mt-auto">
          {price ? (
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-bold" style={{ color: c.green }}>
                {kes(price.price)}
              </span>
              <Pill tone="good">In your catalogue</Pill>
            </div>
          ) : added ? (
            <button
              type="button"
              onClick={() => quoteBasket.remove(product.id)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-bold"
              style={{ background: "#E4F0E8", color: "#1F5A3B" }}
              aria-label={`Added to quote request: ${product.name}. Tap to take it out.`}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Added
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                quoteBasket.add({ id: product.id, name: product.name, image: image || undefined })
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border text-[13.5px] font-bold"
              style={{ borderColor: c.green, color: c.green }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add to quote request
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

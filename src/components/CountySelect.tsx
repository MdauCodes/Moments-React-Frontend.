import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { KENYA_COUNTY_NAMES_NAIROBI_PINNED_AND_ALPHABETICAL } from "@/data/kenyaCounties";

interface CountySelectProps {
  value: string;
  onChange: (county: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

/**
 * Searchable Kenya county picker (47 counties, Nairobi pinned at top plus its normal alphabetical
 * slot) — type to filter instead of scrolling a long native <select>. Only ever commits a real
 * county name via onChange (never arbitrary typed text, so `value` can't drift out of sync with
 * the real list); an unmatched typed search just reverts to the last committed value when the
 * customer clicks away, same "never leave an invalid half-typed state behind" rule as the
 * address-autocomplete field elsewhere in checkout.
 */
export function CountySelect({
  value,
  onChange,
  required,
  placeholder = "Search counties…",
  className,
  id,
}: CountySelectProps) {
  const counties = KENYA_COUNTY_NAMES_NAIROBI_PINNED_AND_ALPHABETICAL;
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the displayed text in sync whenever the committed value changes from outside this
  // component (e.g. auto-filled from a resolved address elsewhere in checkout).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filtered = query.trim()
    ? counties.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
    : counties;

  function handlePick(county: string) {
    onChange(county);
    setQuery(county);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20",
          className,
        )}
      />
      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No matching county</li>
          ) : (
            filtered.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => handlePick(c)}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  {c}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

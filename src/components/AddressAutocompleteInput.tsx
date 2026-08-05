import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  fetchAddressSuggestions,
  fetchPlaceDetails,
  type AddressSuggestion,
} from "@/services/tumaBodaMapsService";

export interface ResolvedAddress {
  description: string;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: ResolvedAddress) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;

/**
 * Ward/estate-level address input backed by TumaBoda's Google Places proxy
 * (/api/v1/public/tumaboda/maps/*) — precise pin-drop for real-time-quoted delivery, finer than
 * the county-level CountySelect. Standalone for now; checkout wiring is a separate pass.
 */
export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your delivery address…",
  className,
  id,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(value);
      if (seq === requestSeq.current) {
        setSuggestions(results);
        setLoading(false);
        setOpen(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  async function handlePick(suggestion: AddressSuggestion) {
    onChange(suggestion.description);
    setOpen(false);

    // Fallback (seeded-area) suggestions already carry their own coordinates — no placeId to
    // resolve, and no real Google place to look up.
    if (suggestion.latitude != null && suggestion.longitude != null) {
      onSelect({
        description: suggestion.description,
        placeId: suggestion.placeId,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
      return;
    }

    setResolving(true);
    const details = suggestion.placeId ? await fetchPlaceDetails(suggestion.placeId) : null;
    setResolving(false);
    onSelect({
      description: suggestion.description,
      placeId: suggestion.placeId,
      latitude: details?.latitude ?? null,
      longitude: details?.longitude ?? null,
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20",
          className,
        )}
        autoComplete="off"
      />
      {resolving && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Resolving…
        </span>
      )}
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {loading && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
          )}
          {!loading &&
            suggestions.map((s) => (
              <li key={s.placeId ?? s.description}>
                <button
                  type="button"
                  onClick={() => handlePick(s)}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  {s.description}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

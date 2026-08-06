import { useMemo } from "react";
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

/** Native Kenya county picker (47 counties, Nairobi pinned at top plus its normal alphabetical slot). Reliable across all browsers. */
export function CountySelect({
  value,
  onChange,
  required,
  placeholder = "Select county…",
  className,
  id,
}: CountySelectProps) {
  const counties = useMemo(() => KENYA_COUNTY_NAMES_NAIROBI_PINNED_AND_ALPHABETICAL, []);

  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20",
        !value && "text-muted-foreground",
        className,
      )}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {counties.map((c, i) => (
        <option key={`${c}-${i}`} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

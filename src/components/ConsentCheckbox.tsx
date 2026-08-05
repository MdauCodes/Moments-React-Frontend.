import { Link } from "react-router-dom";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Short context describing what the data will be used for. */
  purpose?: string;
  /** Visual variant — `light` for use on dark/coloured backgrounds. */
  variant?: "default" | "light";
  className?: string;
  id?: string;
}

/**
 * Compact, friendly consent checkbox used wherever a user submits personal
 * information. Designed to satisfy the Kenya Data Protection Act (2019)
 * opt-in consent requirement without feeling like a legal hurdle.
 */
export function ConsentCheckbox({
  checked,
  onCheckedChange,
  purpose = "respond to your request",
  variant = "default",
  className,
  id = "dpa-consent",
}: ConsentCheckboxProps) {
  const isLight = variant === "light";
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-2.5 text-[12px] leading-relaxed cursor-pointer select-none",
        isLight ? "text-primary-foreground/85" : "text-muted-foreground",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn("mt-0.5", isLight && "border-primary-foreground/60 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary")}
      />
      <span>
        I accept that Moments Packaging will use your details to {purpose}. We keep your info
        private —{" "}
        <Link
          to="/privacy"
          className={cn("underline underline-offset-2", isLight ? "text-primary-foreground" : "text-foreground hover:text-accent")}
        >
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}

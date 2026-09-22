/**
 * The field primitives every enquiry form shares.
 *
 * They exist because the three forms had drifted into three different ways of labelling a field,
 * and none of them actually worked: before this, not one input on /contact or /enterprise-quote
 * had a label tied to it (the markup was `<label>Name *</label>` next to an input with no id), so
 * tapping a label did nothing and a screen reader announced an unnamed edit box. Everything here
 * wires htmlFor/id, aria-invalid and aria-describedby from one place so that cannot drift again.
 */

import { useId, type ReactNode } from "react";

import { normalizeKenyanPhone } from "@/lib/enquiryMessage";

export const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent/50 sm:text-sm";
export const invalidInputClass = "border-destructive focus:ring-destructive/40";
export const labelClass = "mb-1.5 block text-sm font-medium text-foreground";
export const hintClass = "mt-1.5 text-xs text-muted-foreground";
export const errorClass = "mt-1.5 text-xs font-medium text-destructive";

interface FieldShellProps {
  id: string;
  label: string;
  /** Shown as "(optional)" next to the label. Required is the default because most fields are. */
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (aria: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/**
 * Renders label → control → hint/error and hands the control the aria attributes that tie them
 * together. The error replaces the hint rather than stacking, so the field never grows taller on
 * a phone mid-correction.
 */
export function Field({ id, label, optional, hint, error, children }: FieldShellProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A phone field that speaks Kenyan. It accepts 0712…, 0112…, 712…, 254… or +254…, and tidies
 * whatever they typed into +254 7XX XXX XXX when they leave the field — visibly, so nobody has to
 * wonder whether their number "counts". A number we do not recognise as Kenyan is left exactly as
 * typed, because we do sell to people abroad.
 */
export function PhoneField({
  id,
  value,
  onChange,
  error,
  label = "Phone number",
  hint = "We reply on WhatsApp, so use the number you WhatsApp on. 0712 345 678 is fine.",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(aria) => (
        <input
          {...aria}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          name="phone"
          placeholder="0712 345 678"
          className={`${inputClass} ${error ? invalidInputClass : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const tidy = normalizeKenyanPhone(value);
            if (tidy && tidy !== value) onChange(tidy);
          }}
        />
      )}
    </Field>
  );
}

/**
 * The quick-pick rows (topic, how to reply). Real buttons with aria-pressed rather than a select,
 * because on a phone one tap beats opening a picker — and they are wrapped in a fieldset so the
 * group has a name when read aloud.
 */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string;
  options: readonly { code: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Fixed columns for short, even option sets; otherwise they wrap naturally. */
  columns?: number;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div
        className={columns ? `grid gap-2` : "flex flex-wrap gap-2"}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            aria-pressed={value === o.code}
            onClick={() => onChange(o.code)}
            className={`min-h-[44px] rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              value === o.code
                ? "border-accent bg-accent/10 font-medium text-foreground"
                : "border-border text-foreground/80 hover:border-accent/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}


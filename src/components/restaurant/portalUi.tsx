import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Tone } from "@/lib/restaurantPortal";

/** The portal's palette, from the approved designs (design-2026-11, PortalHome / RestaurantTeam). */
export const portalColors = {
  page: "#FAF7F0",
  ink: "#17241C",
  muted: "#56615A",
  line: "#E6E0D4",
  soft: "#F7F4EC",
  green: "#1F6B45",
  greenDark: "#164F33",
  gold: "#F2C14E",
  danger: "#9A2B1E",
};

const c = portalColors;

const TONES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: "#E4F0E8", fg: "#1F5A3B" },
  bad: { bg: "#FBE7E3", fg: "#8A2A1C" },
  wait: { bg: "#FFF4D6", fg: "#6B4A00" },
  muted: { bg: "#F3EFE6", fg: "#3E4842" },
  info: { bg: "#E3EEF0", fg: "#1D4F5A" },
};

export function Pill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-bold"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export function PortalCard({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-[14px] border bg-white p-4 ${className}`}
      style={{ borderColor: c.line }}
      {...rest}
    >
      {children}
    </section>
  );
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[14px] leading-relaxed ${className}`} style={{ color: c.muted }}>
      {children}
    </p>
  );
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60";

export function PortalButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const style =
    variant === "primary"
      ? { background: c.green, color: "#FFFFFF" }
      : { background: "#FFFFFF", color: c.green, border: `1.5px solid ${c.green}` };
  return (
    <button type="button" className={`${buttonBase} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}

export function PortalButtonLink({
  to,
  variant = "primary",
  className = "",
  children,
}: {
  to: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
}) {
  const style =
    variant === "primary"
      ? { background: c.green, color: "#FFFFFF" }
      : { background: "#FFFFFF", color: c.green, border: `1.5px solid ${c.green}` };
  return (
    <Link to={to} className={`${buttonBase} ${className}`} style={style}>
      {children}
    </Link>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-[10px] border bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-[#1F6B45]/40";

export function Field({
  label,
  hint,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-[14px] font-semibold ${className}`}>
      {label}
      <input className={inputClass} style={{ borderColor: c.line }} {...rest} />
      {hint && (
        <span className="text-[12.5px] font-normal" style={{ color: c.muted }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[14px] font-semibold" style={{ color: c.danger }}>
      {children}
    </p>
  );
}

/** A box for parts of the portal that wait for the store's next steps (orders, credit, payments). */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="rounded-[12px] border border-dashed p-3.5"
      style={{ borderColor: c.line, background: c.soft }}
    >
      <div className="text-[14px] font-bold">{title}</div>
      <div className="mt-1 text-[13.5px] leading-relaxed" style={{ color: c.muted }}>
        {text}
      </div>
    </div>
  );
}

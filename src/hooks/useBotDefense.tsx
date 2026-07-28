import { useRef, useState } from "react";

/**
 * Shared client-side half of BotDefenseService on the backend: a honeypot value plus the
 * timestamp the form first rendered, bundled into whatever the caller's submit payload already
 * looks like via toPayload(). A real visitor never touches the honeypot field and can't submit
 * faster than formRenderedAt allows — see HoneypotField below for the actual hidden input.
 */
export function useBotDefenseFields() {
  const formRenderedAt = useRef(Date.now()).current;
  const [honeypot, setHoneypot] = useState("");

  return {
    honeypot,
    setHoneypot,
    toPayload: (turnstileToken: string) => ({
      honeypot,
      formRenderedAt,
      turnstileToken,
    }),
  };
}

/** Hidden via CSS (not `type="hidden"`) so a bot that blindly fills every visible-looking input
 *  still trips it, while a real visitor never sees or focuses it. */
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="website"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", top: "-9999px", width: 1, height: 1, opacity: 0 }}
    />
  );
}

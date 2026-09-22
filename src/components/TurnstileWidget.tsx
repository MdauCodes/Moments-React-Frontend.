import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
      }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

let scriptLoadPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

/**
 * Cloudflare Turnstile widget. Renders nothing if VITE_TURNSTILE_SITE_KEY isn't configured — the
 * backend's TurnstileService treats a missing secret key the same way (skips verification), so a
 * fresh environment without real Cloudflare keys set up on either side just doesn't gate anything,
 * rather than silently locking every form out.
 *
 * The ~80KB Cloudflare script is not fetched when the component mounts, only once the widget is
 * actually close to being needed: when it scrolls within 400px of the viewport, or as soon as the
 * visitor touches the form (whichever happens first). A form far below the fold — or one the
 * visitor scrolls past without filling in — therefore costs nothing. Turnstile still has plenty of
 * time to solve itself while the form is being filled, and the backend's 3-second minimum submit
 * time means nobody can outrun it.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerId = useId().replace(/[:]/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [armed, setArmed] = useState(false);

  // Arm on proximity to the viewport, or on the first interaction anywhere in the enclosing form.
  useEffect(() => {
    if (!SITE_KEY || armed) return;
    const node = containerRef.current;
    if (!node) return;

    const arm = () => setArmed(true);
    const form = node.closest("form");
    form?.addEventListener("focusin", arm, { once: true });
    form?.addEventListener("input", arm, { once: true });

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) arm();
        },
        { rootMargin: "400px" },
      );
      observer.observe(node);
    } else {
      arm();
    }

    return () => {
      observer?.disconnect();
      form?.removeEventListener("focusin", arm);
      form?.removeEventListener("input", arm);
    };
  }, [armed]);

  useEffect(() => {
    if (!SITE_KEY || !armed || !containerRef.current) return;
    let cancelled = false;
    void loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    });
    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  if (!SITE_KEY) return null;
  // min-height reserves the widget's own height so arming it doesn't shove the submit button down
  // under the visitor's thumb mid-tap.
  return (
    <div
      ref={containerRef}
      id={`turnstile-${containerId}`}
      style={{ margin: "8px 0", minHeight: 65 }}
    />
  );
}

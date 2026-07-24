import { useEffect, useRef } from "react";

/**
 * Re-runs `callback` every `ms` while the tab is visible, and pauses entirely while it's hidden
 * (Page Visibility API) — for "reasonably realtime" panels that shouldn't poll a background tab.
 * Not push/WebSocket realtime — just a paused setInterval.
 */
export function useVisibilityInterval(callback: () => void, ms: number): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let id: number | undefined;

    function start() {
      if (document.visibilityState === "visible" && id === undefined) {
        id = window.setInterval(() => callbackRef.current(), ms);
      }
    }
    function stop() {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ms]);
}

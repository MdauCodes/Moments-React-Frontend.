import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { inStaffMode } from "./config/staff";
import { startMustReload } from "./lib/mustReload";

// Must reload (owner, 20 Nov 2026): before anything calls the store, so every call says which build it is.
startMustReload();

// After a deploy the previous build's page files are gone, so a tab still running the old build
// fails when it opens a page it had not loaded yet. Reload once to get the new build instead of
// showing a broken page; the time guard stops a reload loop if the file is really missing.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "reloaded-for-new-build-at";
  let last = 0;
  try {
    last = Number(window.sessionStorage.getItem(KEY)) || 0;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: still reload once */
  }
  if (Date.now() - last < 60_000) return;
  event.preventDefault();
  window.location.reload();
});

// Staff site (staff.* host, or VITE_APP_MODE=staff): only the small StaffApp, loaded on demand.
const StaffApp = lazy(() => import("./staff/StaffApp"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {inStaffMode() ? (
      <Suspense fallback={null}>
        <StaffApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);

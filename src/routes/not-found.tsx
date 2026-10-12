import { useEffect } from "react";
import { applyRobots } from "@/hooks/useSeo";

/**
 * Catch-all 404. Render's static hosting answers every unknown URL with a 200 and the app shell,
 * so search engines would otherwise index any mistyped or deleted URL as a copy of the homepage
 * (a "soft 404"). The noindex tells them it isn't a real page. RouteSeo clears it again on the
 * next navigation.
 */
export default function NotFoundPage() {
  useEffect(() => {
    applyRobots(true);
    document.title = "Page not found — Moments Packaging Kenya";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

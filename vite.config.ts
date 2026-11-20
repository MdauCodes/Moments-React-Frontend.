import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

// One id per build. Open admin tabs compare it with /version.json and reload themselves when a new
// build is live (see src/lib/useNewBuildReload.ts), so nobody runs yesterday's code after a deploy.
const BUILD_ID = process.env.RENDER_GIT_COMMIT || `${Date.now().toString(36)}`;
// Must reload (owner, 20 Nov 2026): the build's time as yyyyMMddHHmmss (UTC), so releases sort as text on the store.
const APP_RELEASE = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

function buildVersionFile(): Plugin {
  return {
    name: "build-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId: BUILD_ID, release: APP_RELEASE, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), buildVersionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_RELEASE__: JSON.stringify(APP_RELEASE) },
  server: { port: 5173 },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Deliberately narrow — only the runtime deps genuinely shared by every route (public and
        // admin alike), so they cache separately from app code that changes on every deploy.
        // NOT a blanket "everything in node_modules" grouping: that would pull admin-only heavy
        // libraries (charts, PDF export, the blog editor) into a chunk referenced by the public
        // entry point too, undoing the route-level code-splitting in App.tsx that keeps them out
        // of a public visitor's initial load.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/]react-router(-dom)?[\\/]/.test(id)) return "vendor-router";
          return undefined;
        },
      },
    },
  },
});

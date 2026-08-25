import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
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

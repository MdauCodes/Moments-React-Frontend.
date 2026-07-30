# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

React 19 / TypeScript / Vite frontend for Moments Packaging Kenya — the customer-facing storefront (browse, cart, checkout, account) plus the admin dashboard, talking to the Spring Boot backend in the sibling repo `moments-packaging-backend-Java-First client`.

## Commands

```bash
npm run dev        # Vite dev server, http://localhost:5173
npm run build       # tsc --noEmit && vite build -> dist/
npm run preview     # preview a production build
npm run lint         # eslint .
npm run format       # prettier --write .
```

There is no test runner configured (no `test` script, no test files).

## Architecture

**Routing is manual, not file-based.** Every route component lives in `src/routes/`, but despite dot-separated filenames that look like flat-routes conventions (e.g. `_adminAuth.admin.analytics.customers.tsx`), there is no route-generation plugin — every route is imported and registered explicitly in `src/App.tsx` under `<Routes>`. To add a page you must both create the file in `src/routes/` and add a `<Route>` entry in `App.tsx`. The `_adminAuth.*` filename prefix is just a naming convention marking "requires admin auth"; the actual gating is the `<AdminProtectedRoute>` wrapper element in `App.tsx`, not the filename.

**Provider stack** (see `App.tsx`) nests `SiteConfigProvider > AccessibilityProvider > AuthProvider > AuthModalProvider > CartProvider > WishlistProvider > AdminAuthProvider > PersonaProvider`. Customer auth (`AuthContext`) and admin auth (`AdminAuthContext`) are entirely separate contexts/flows — a customer session and an admin session are not the same thing.

**`src/services/`** mixes two kinds of modules: real API clients that call the backend (`adminApi`, `commerceApi`, `businessAccountApi`, `deliveryZoneService`, `uomService`, `api.ts` for shared fetch config) and client-side "store"/"mock" modules (`orderStore`, `productStore`, `profileStore`, `referralStore`, `refundStore`, `reviewStore`, `passwordStore`, `blogStore`, `commerceMock`, `analyticsMock`) that persist to `localStorage` or return canned data. Both kinds are actively used across many routes — check which a given page imports before assuming data is live from the backend versus local/mock state.

**UI components** (`src/components/ui/`) are shadcn/ui (`components.json`: style `new-york`, Tailwind v4, `slate` base, no RSC), so new primitives should go through the shadcn CLI/convention rather than being hand-rolled. Path aliases (`@/components`, `@/lib`, `@/hooks`, etc.) are defined in `components.json` and resolved via `vite-tsconfig-paths` — check `tsconfig.json` for the underlying `@/*` mapping.

**Admin analytics** (`src/routes/_adminAuth.admin.analytics*.tsx`) is a multi-page dashboard (overview, rewards, tax, products, profitability, customers, geographic, delivery) built on `recharts`, each page pairing with an analytics endpoint added on the backend — when changing one side, check the other repo for the matching phase.

**PDF generation** (`jspdf` + `jspdf-autotable`) is used client-side for exports (e.g. account/order documents), separate from the backend's own PDF generation (openhtmltopdf) for tax invoices/receipts — don't assume one covers the other.

**Forms** use `react-hook-form` + `zod` resolvers (`@hookform/resolvers`) consistently; follow that pattern rather than uncontrolled inputs or ad hoc validation for new forms.

## Current focus (as of 2026-07-30)

The admin analytics dashboard build-out from earlier this project is done and has since been restructured into more granular tabs.

**Active engagement: TumaBoda delivery-partner integration.** Full plan at `~/.claude/plans/rippling-booping-lobster.md` on the machine this was built on — read it before touching this area. Short version: real-time-quoted, trackable TumaBoda courier delivery as an option at checkout, TumaBoda handling only pricing/booking/tracking while Moments' own Daraja checkout stays untouched. Sequenced so a sandbox/test-mode system (Phase 1, TumaBoda-independent) ships first — see the sibling backend repo's CLAUDE.md for exact status. On this side, Phase 1 shipped: a "TEST" badge + hide-filter on the admin Orders page and order detail drawer, and a Super-Admin-only test-account toggle on the customer detail page. TumaBoda's own checkout UI (step-wise flow, pin-drop address, live tracking map) hasn't started.

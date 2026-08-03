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

**Active engagement: TumaBoda delivery-partner integration.** Full plan at `~/.claude/plans/rippling-booping-lobster.md` on the machine this was built on — read it before touching this area. Short version: real-time-quoted, trackable TumaBoda courier delivery as an option at checkout, TumaBoda handling only pricing/booking/tracking while Moments' own Daraja checkout stays untouched. Sequenced so a sandbox/test-mode system (Phase 1, TumaBoda-independent) ships first — see the sibling backend repo's CLAUDE.md for exact status. On this side, Phase 1 shipped: a "TEST" badge + hide-filter on the admin Orders page and order detail drawer, and a Super-Admin-only test-account toggle on the customer detail page. TumaBoda's own checkout UI (step-wise flow, pin-drop address, live tracking map) hasn't started — see "Open before Phase 6" below.

## Staging environment (as of 2026-08-03)

The backend now has a real staging environment (see the backend repo's `CLAUDE.md`) so the frontend needs the same split: a place to preview changes against staging data before they reach the live site.

**Backend base URL is now env-configurable** (`src/config/api.ts`, `VITE_API_BASE_URL`) — previously hardcoded to the production Railway URL, meaning a staging frontend build would silently have called the production backend. Falls back to the production URL when unset, so this was a safe no-op change landed on both `main` and `staging`.

**Branch plan** (per the client's direction — current live site becomes staging, a separate prod deployment gets created later, only once the client/testers have previewed and approved a build):
- A `staging` branch already exists (branched from `main`, currently checked out day-to-day).
- **Not yet done, needs the Render dashboard** (no Render CLI/API access from here):
  1. Point the *existing* Render service (currently serving `moments-demo.site`, tracking `main`) at the `staging` branch instead — this makes the site the client already previews on into the actual staging environment, with zero URL change for the client.
  2. Set `VITE_API_BASE_URL=https://moments-backend-staging-staging.up.railway.app` on that service so staging frontend talks to staging backend, not production.
  3. When a build is ready to actually go live: create a *new* Render service tracking `main`, set its `VITE_API_BASE_URL` to the production backend URL (or leave unset — that's the default), and move the `moments-demo.site` custom domain to it (Render domains are bound to one service at a time). Staging then falls back to Render's auto-generated `*.onrender.com` URL.

**Workflow once this is set up**: feature branches merge into `staging` → auto-deploys to the staging Render service + talks to the staging backend → client/testers preview live on `moments-demo.site` → only after explicit approval does `staging` merge into `main` → deploys to the (then-existing) production Render service. Mirrors the backend's `staging`→`main` discipline exactly.

## Open before Phase 6 (TumaBoda frontend checkout UX)

The plan (`~/.claude/plans/rippling-booping-lobster.md`, Phase 6) describes the *shape* of the checkout change at a high level — step-wise checkout (personal info → location), TumaBoda offered as an added perk for covered areas, pin-drop address via the backend's maps-proxy — but the actual user-journey detail (exact screens, what the pin-drop/address step looks like, how the "added perk" offer is presented, what the track-order page's TumaBoda iframe embed looks like alongside existing order-status UI) hasn't been walked through yet. Worth doing as its own design pass before Phase 6 implementation starts, separate from the backend-only Phases 2–5 which don't touch the frontend at all.

# Moments Packaging Kenya — Frontend System Design

For a new developer joining the project. Explains the *shape* of the app and the reasoning behind non-obvious decisions — pair with [CLAUDE.md](CLAUDE.md) for quick commands/conventions.

## 1. What this app is

One React SPA serving three distinct audiences from the same codebase and build:
1. **Public storefront** — browse/search/cart/checkout, no login required for most of it.
2. **Customer account area** — order history, rewards, referrals, business-account features, under `/account/**`.
3. **Admin dashboard** — staff-only fulfilment/catalogue/analytics tooling, under `/admin/**`, auth-gated separately from customer auth.

All three talk to the sibling Spring Boot backend (`moments-packaging-backend-Java-First client`) over `/api/v1/**`.

## 2. Routing — manual, not file-based

Every page component lives in `src/routes/`, and every route is imported and wired explicitly in `src/App.tsx`'s `<Routes>` tree. The dot-separated filenames (`_adminAuth.admin.analytics.customers.tsx`) *look* like a flat-routes convention but there is no route-generation plugin behind them — they're just a naming convention. To add a page: create the file **and** add the `<Route>` line in `App.tsx`; the filename alone does nothing.

The `_adminAuth.*` prefix specifically marks "requires admin auth," but the actual gate is the `<AdminProtectedRoute>` wrapper element around that whole route group in `App.tsx` — not the filename, not a convention the router enforces.

## 3. Auth — two completely separate systems

`AuthContext` (customer) and `AdminAuthContext` (staff) are independent — a customer session and an admin session share no state, no token, no context. If you're debugging "why am I logged out," check which context the page you're on actually reads from.

Provider nesting (`App.tsx`): `SiteConfigProvider > AccessibilityProvider > AuthProvider > AuthModalProvider > CartProvider > WishlistProvider > AdminAuthProvider > PersonaProvider`.

## 4. Data layer — two different things living in `src/services/`

`src/services/` mixes:
- **Real API clients** (`adminApi.ts`, `adminResources.ts`, `commerceApi.ts`, `businessAccountApi.ts`, `deliveryZoneService.ts`, `uomService.ts`, `api.ts`) — actually call the backend.
- **Client-side store/mock modules** (`orderStore.ts`, `productStore.ts`, `profileStore.ts`, `referralStore.ts`, `refundStore.ts`, `reviewStore.ts`, `passwordStore.ts`, `blogStore.ts`, `commerceMock.ts`, `analyticsMock.ts`) — persist to `localStorage` or return canned data.

Both kinds are actively imported across many routes. **Before assuming a page's data is live from the backend, check which of these it actually imports** — this isn't legacy cruft to ignore, both are in real use.

The catalogue page (`products.index.tsx`) has a specific fallback pattern worth knowing: if the real API 404s or is unreachable, it silently swaps in `MOCK_PRODUCTS` with a subtle "showing sample products" banner, so the storefront never hard-fails to a blank page just because the backend is down.

## 5. The customer-facing catalogue page — category browsing, not tag pills

`products.index.tsx` has a real hierarchical browser: **Segment → Category → Subcategory**, backed by admin-managed taxonomy data (`api.getSegments/getCategories/getSubcategories`), scoped to the selected industry when one's active. This is the actual, current way customers narrow the catalogue by type of business/product.

There used to be a second, parallel system here: a hardcoded per-industry map of "quick find" tag pills (fake use-case labels like "Serving hot drinks" mapped to a hardcoded search keyword) — this was **removed** (2026-07-23) because it duplicated and confused the real category browser above it. If you see references to it in old commits/docs, it's gone; don't reintroduce a second ad-hoc tagging layer without checking whether Segment/Category/Subcategory already covers the need.

The admin "Classify Products" tool similarly had a free-form "Tags" feature (separate from Industries and Segment/Category/Subcategory) that was **removed** the same day for the same reason — Industries + the real taxonomy hierarchy already cover product classification. The backend's `tag` domain and `adminResources.tags` API client still exist (still used by the single-product edit page, `ProductEditor.tsx`) — they weren't deleted, just no longer exposed in the bulk-classify tool or the storefront.

## 6. Admin order fulfilment — verified working end-to-end (2026-07-23)

```
Order list (/admin/orders)
        │
        ▼
Payment Queue ──Verify Payment──► Preparation Queue ──Start Production──► (in production)
        │                                  │
        │                                  └──Mark Ready──► Dispatch Queue ──Open Checklist──►
        │                                                            (tick all items)
        │                                                                    │
        │                                                        Dispatch Order (2-step:
        │                                                        click → in-app "Confirm Dispatch")
        │                                                                    │
        │                                                                    ▼
        │                                                              Order detail: "Mark delivered"
        ▼
  Order detail drawer — Cancel order / Log refund request (separate flow, not part of
  the linear chain) / full status-change history with actor + timestamp
```

Each queue page only shows orders in the right state and disappears them correctly once actioned — this full chain was manually walked end-to-end against production data and confirmed consistent across every queue, the order list, and the detail drawer.

**Fixed 2026-07-23**: the order list's "Assigned" column used to show "No staff available" for orders the detail drawer correctly showed real assignable staff for. Root cause: `OrderDetailDrawer.tsx` had its own hand-rolled assign-to-staff dropdown, duplicating `AssignSelect.tsx` (used in the list) but without its role-hierarchy check (`canAssignTo`) — the drawer mapped over the raw, unfiltered assignee list, silently letting staff assign orders to someone above their own rank. Fixed by deleting the duplicate and having the drawer use the shared `AssignSelect` component, so both surfaces now enforce (and agree on) the same rule.

**Known gap** (backend-adjacent): many real orders sit in `PENDING_PAYMENT` for weeks with no automated expiry — there's no frontend or backend job that surfaces/cleans these up.

**Track-order security, fixed 2026-07-23**: order references are sequential/guessable, so `orders.track.tsx`'s "By Reference" tab now only shows redacted status/progress (backend enforces this — see the backend `SYSTEM_DESIGN.md` §8). Full details (items, pricing, delivery address) require searching "By Email" instead — `CustomerOrder.verified` (new field) tells you which you're looking at. The by-email tab now does a follow-up `trackByReference(reference, email)` call per expanded row to unlock the full record, rather than just showing the masked summary.

## 7. Analytics dashboard

Eight admin pages (`_adminAuth.admin.analytics*.tsx`: overview, rewards, tax, products, profitability, customers, geographic, delivery), each pulling from a matching backend endpoint, sharing `analyticsUi.tsx` (KPI cards, `PeriodDeltaGrid`) and `analyticsCharts.tsx` (`TrendLineChart`, `RankedBarChart`, `ShareDonutChart`) components. All eight were verified rendering real data with no console/network errors as of 2026-07-23.

One thing worth knowing if you touch Profitability: it has a "Monthly Projection" section fed by a *separate* endpoint (`/analytics/projection`, no date-range param — always "first 7 days of the current month, scaled to 31") that can legitimately show KES 0.00 even when the rest of the page shows real revenue, if the business's first week of the month happened to have no paid orders. That's not a bug, but it's a fragile methodology worth knowing about before you go looking for why it's "broken."

**Export (added 2026-07-23)**: every page has a CSV / Excel / PDF export of its own displayed KPIs and tables — `<AnalyticsExportButtons>` (`components/admin/AnalyticsExportButtons.tsx`) takes a `getPayload()` callback returning an `AnalyticsExportPayload` (`lib/analyticsExport.ts`: `pageTitle`, `rangeLabel`, `kpis`, named `tables`). CSV and Excel (via `exceljs` — real multi-sheet `.xlsx`, one sheet per table) live in `analyticsExport.ts`; PDF (`downloadAnalyticsPdf`) is re-exported from `lib/pdf.ts`'s `downloadAnalyticsReportPdf`, reusing that file's existing masthead/KPI-card/table design system rather than a second one. Overview's pre-existing raw-row "Orders CSV"/"Customers CSV" buttons are a different, older feature (full row-level dumps, not the summarized page view) and were left as-is alongside the new buttons.

Note: `xlsx` (SheetJS) was deliberately *not* used — the npm-published version has unpatched high-severity advisories (prototype pollution, ReDoS) with no fix available. `exceljs` was used instead, with `uuid` pinned via a package.json `overrides` entry to clear one transitive moderate advisory in its own dependency chain.

## 8. Welcome modal (`WelcomeStarterModal.tsx`)

Shown to unauthenticated visitors ~1.8s after any page loads (it remounts on every page navigation since `SiteLayout` — which wraps it — is instantiated per-page, not once globally). As of 2026-07-23: capped at 3 appearances per browser session (`sessionStorage`), and explicitly declining ("Continue without an account") stops it for the rest of the session rather than just re-arming the old 45s reappear timer. Before that change it had **no cap at all** by an earlier explicit client decision — if you're touching this file, know that decision was superseded, not an oversight in the current code.

## 9. Accessibility toolbar

`AccessibilityToolbar.tsx` + `AccessibilityContext.tsx` — a from-scratch implementation (not a third-party overlay like UserWay), persisted to `localStorage`. As of 2026-07-23 it covers: font size (+/-/reset), high contrast, reduce motion, underline links, readable spacing, dyslexia-friendly font (lazy-loads Atkinson Hyperlegible only when toggled on), hide images (scoped to `<main>` so header/footer branding stays visible), line-height cycle, force-left-align, low saturation (scoped to `<main>`, not `html`/`body` — a CSS `filter` on an ancestor of a `position: fixed` element changes its containing block, which would break the WhatsApp float button, bottom nav, and the toolbar's own trigger button), a cursor-following reading mask, and a big-cursor mode. The panel's own text/touch-targets were deliberately sized up (not the site's default text-sm) since a control whose entire purpose is accessibility shouldn't itself require good eyesight to operate.

## 10. UI conventions

- **shadcn/ui** (`src/components/ui/`) — style `new-york`, Tailwind v4, `slate` base (`components.json`). New primitives should go through the shadcn convention, not be hand-rolled.
- **Forms**: `react-hook-form` + `zod` resolvers, consistently — follow this for new forms rather than uncontrolled inputs.
- **Path aliases** (`@/components`, `@/lib`, `@/hooks`, etc.) resolved via `vite-tsconfig-paths`; the underlying mapping lives in `tsconfig.json`.

## 11. Where to look for X

- "Why does this button need two clicks" → check for a nested in-app confirmation step (e.g. dispatch: "Dispatch Order" opens an inline "Confirm Dispatch" step) before assuming it's broken — this pattern shows up more than once in the admin.
- "Is this page's data real or mock" → check its imports from `src/services/` per §4.
- "Why is a customer-facing filter/tag thing behaving oddly" → check whether it's the real Segment/Category/Subcategory system or a leftover reference to the removed tag-pill system (§5).
- "Something about staff/roles/permissions in the UI" → `src/lib/roles.ts` (`canAssignTo`, `resolveStaffRole`, `STAFF_ROLE_DISPLAY`).

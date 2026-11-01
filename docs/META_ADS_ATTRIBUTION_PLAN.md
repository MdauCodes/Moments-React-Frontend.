# Meta Ads: optimised campaigns and full revenue attribution

**Status:** Phases 1 and 2 are BUILT and verified (2026-09-30); Phases 0, 3, 4 and 5 are not. See "Build status" directly below this header for exactly what exists and what is left. Originally written 2026-09-29.
**Repos:** this frontend repo (`MdauCodes/Moments-React-Frontend`) and the backend repo
(`MdauCodes/Moments-Backend`, local path `J:\backend\moments-packaging-backend-Java-First client`).
**Goal, in one sentence:** for any Meta ad or campaign, the admin dashboard shows how many paid
orders it produced, how much money they brought in (net of refunds), what the ads cost, and the
resulting return on ad spend. At the same time, Meta receives accurate purchase data so its
algorithm can optimise delivery towards buyers.

Read this whole document before writing code. Section 9 lists the decisions the owner must make;
each has a recommended default, so work can start on the defaults.

---

## Build status (updated 2026-09-30)

**Built (Phases 1 and 2), on branch `marketing-attribution` in both repos. Check `git log` on `main` for whether it has been merged and deployed; a session that finds it unmerged must not assume it is live.**

| Area | What exists | Where |
|---|---|---|
| Attribution capture | UTM/click-id/referrer capture on every route, 30-day localStorage, first + last touch, landing beacon | FE `src/lib/marketingAttribution.ts`, `src/components/MarketingAttributionCapture.tsx` |
| Attribution at checkout | `attribution` object added to the checkout request | FE `src/services/orderStore.ts` (`placeOrder`) |
| Backend storage | `order_attribution` (1 row per order), `marketing_touch_events`; endpoint `POST /api/v1/public/marketing/touch`; channel classifier; recorded AFTER the order commits, in its own transaction | BE package `marketing/`, migration `V41__marketing_attribution.sql`, hook in `CheckoutService.checkout` |
| Staff-entered orders | "How did this customer find us?" select on the admin create-order modal, sent as `acquisitionChannel` | FE `AdminOrderCreateModal.tsx`, `commerceApi.ts`; BE `AdminOrderCreateRequest` |
| Pixel events | ViewContent, AddToCart, InitiateCheckout, Purchase (browser side), Lead, Contact; held until cookie consent, replayed for the current page on accept | FE `src/lib/metaPixel.ts` (loader + `trackMeta`), `src/lib/metaEvents.ts` (one helper per event), `src/components/MetaPixel.tsx` |
| Cookie banner timing | 15 s for normal visitors; immediately for visitors who arrived from a tagged link | FE `src/components/CookieConsent.tsx` |

**Not built yet:** Phase 0 (owner's Meta setup: domain verification, Conversions API token), Phase 3 (server-side Purchase), Phase 4 (Marketing dashboard tab, `marketing_spend`, reports), Phase 5 (catalogue feed). Also not done: the AddPaymentInfo event (deliberately skipped), and updating `/privacy` to mention Meta. That is a legal-text change: the owner approves the wording first, then bump `PRIVACY_POLICY_VERSION` in `src/lib/policyVersion.ts`.

**Verified (2026-09-30):** on a fresh scratch database all 41 migrations apply and Hibernate `validate` passes; four real checkouts (tagged, untagged, garbage attribution, non-object attribution) all returned 201 with exactly one `order_attribution` row each; backend unit tests (11) pass; the full suite passes except the known local-only `contextLoads` failure. In a browser: tags stored correctly, direct visits don't erase an ad touch, zero requests to Facebook before consent or after "Only essentials", staff routes never send, held events replay on accept, Purchase reports once per order with event id `purchase-<reference>`.

**NOT verified live, do this after deploy:** (1) AddToCart from the real product page and quick-add buttons (the local sandbox can't load products because of CORS, so this was only verified by code review and typecheck); (2) ViewContent on a real product page; (3) Purchase from a real M-Pesa payment; (4) that Events Manager, under Test events, shows them. The owner can watch Test events, or use the Meta Pixel Helper Chrome extension.

**Things that differ from the original plan text below, and why:**
- **`META_UNTAGGED` channel added.** Facebook appends `fbclid` to outbound clicks from *organic* posts too, so "fbclid with no tags = paid" would inflate paid numbers. A bare `fbclid` is `META_UNTAGGED`; only clicks tagged `utm_source=meta|facebook|instagram|fb|ig` with a paid `utm_medium` are `META_PAID`. The Marketing report must show `META_UNTAGGED` separately and explain it.
- **Purchase value (D4) is `total - shippingFee`** (what the customer paid for products), not "subtotal minus discount", because it stays correct for every kind of discount, including points redemption. Server side it is `totalAmount - deliveryFee`.
- **The attribution field is raw JSON on `CheckoutRequest`** (`JsonNode`) and parsed leniently in `AttributionPayload.fromJson`. The first version used a typed object, and a malformed field made Jackson reject the whole checkout with a 500, which broke the "never reject an order" rule. Do not turn it back into a typed field.
- **No foreign key from `order_attribution` to `orders`**, because the row is written after the order commits, in a separate transaction.
- **Migration number:** `V41`. `origin/staging` and `origin/ecom-tax-capture` both carry their own, different `V41__*`; whoever merges second renumbers.
- **Debug switch:** `localStorage.setItem("mpk_meta_pixel_debug", "1")` lets the pixel run on hosts other than momentspackaging.com (for example localhost, when testing). Remove it afterwards; it sends real events to the live dataset.

---

## 1. What already exists (verified 2026-09-29)

| Piece | Where | Notes |
|---|---|---|
| Meta Pixel `978799355262510` (dataset "Moments E-commerce") | `src/components/MetaPixel.tsx`, mounted in `App.tsx` | Loads **only after cookie consent** (`localStorage["mpk_cookie_consent_v1"].choice === "accepted"`, or the `mpk:cookies-accepted` window event). Sends `PageView` per route change. `disablePushState` + `allowDuplicatePageViews` are set deliberately; don't remove them (without them staff pages get tracked and repeat PageViews are dropped). Only runs on `momentspackaging.com`. **No other events are sent yet.** |
| Cookie banner | `src/components/CookieConsent.tsx` | Appears only after **3 minutes** on site (`SHOW_AFTER_MS`). Most ad visitors leave before that, so the pixel never loads for them. See decision D3. |
| Anonymous session ID | `src/config/api.ts` (`mpk_session_id`, sent as `X-Session-Id` by `apiFetch({ session: true })`) | Same ID is already sent in the checkout body (`CheckoutRequest.sessionId`) and used by the page-journey and checkout-funnel trackers. It's the join key for "which visit became which order". |
| Page-view beacon | `src/services/pageJourneyTracker.ts` → `POST /api/v1/public/page-journey/event` → table `page_view_events(session_id, path, created_at)` | Stores path only: **no UTM, referrer or click ID**. |
| Checkout funnel | `src/services/checkoutFunnelTracker.ts` → `checkout_funnel_events(session_id, step, order_reference, ...)`; steps `OPENED`, `CONTACT_COMPLETED`, `DELIVERY_CONFIRMED`, ... | Reusable for per-campaign funnels. |
| Attribution pattern to copy | `src/lib/referralAttribution.ts` + `src/components/ReferralCapture.tsx` | Captures `?ref=` on every route, 30-day localStorage, last-click-wins. The new UTM capture should mirror this exactly. |
| Unmerged traffic classifier | branch `origin/traffic-source-tracking`, commit `666ca32` "Classify sitewide traffic source (search / AI assistant / social / referral)" | 3 files. Salvage the classification logic for the `channel` field (section 4.2), don't reinvent it. |
| **Single "order became paid" chokepoint** | backend `payment/service/PaymentService.java` → `applySuccessfulPayment(order, receipt, changedBy)` | Used by the M-Pesa callback AND manual bank-transfer / cash-on-delivery confirmation. Idempotent (returns early if already PAID). **This is where the server-side Purchase event hooks in.** |
| Order model | `order/entity/Order.java` | Has `paymentStatus` (PENDING/PAID/FAILED), `paidAt`, `totalAmount`, `subtotal`, `deliveryFeeAmount`, `email`, `phone`, `customer`, `isTestOrder`, `preLaunchDemoOrder`, refund fields. **No marketing/source fields.** |
| Revenue definition used by existing analytics | `analytics/service/AnalyticsService.getRevenueSummary` → `orderRepository.sumOrdersInRangeByPaymentStatus(start, end, PAID)` | New marketing numbers must use the same definition and the same test/demo exclusions, or they won't reconcile with the main Analytics overview (`/admin/analytics`, revenue summary). |
| Profitability (cost-based) | `AnalyticsService.getProfitability(start, end)` / `getProfitabilityBreakdown` | Reuse for "gross profit from Meta ads". |
| Partner-API call logging | `IntegrationLogContext` + `app_logs.task/actor/response_code/success` (migration V8) | Use it for Meta Conversions API calls, same as TumaBoda/Daraja. |
| Admin analytics tabs | `src/routes/_adminAuth.admin.analytics.*.tsx` (sales, customers, products, profitability, tax, rewards, delivery, geographic, signups, needs-attention, data-visualization) | New tab goes here (section 6). |
| Product catalogue | public API `GET /api/v1/public/products?page&size` (612 products, 498 with images, 440 in stock) | **`sku` is never populated in the public API.** Use the product **UUID `id`** as the Meta `content_id` everywhere (pixel, server events, catalogue feed) so they match. |
| Canonical product URLs | `/products/<slug>/` (trailing slash) | See `src/seo/seoData.js` `productPath()`. Ad links and catalogue links must use this form. |

Flyway: latest migration on backend `main` is **V40** (`V40__enquiry_email_optional.sql`); `ddl-auto: validate`, so every schema change needs a migration. Check all remote branches for an unmerged V41 before claiming the number.

---

## 2. How the pieces fit

```text
 Meta ad (URL has utm_* tags; Meta appends fbclid)
        │ click
        ▼
 Storefront ──► [A] capture utm/fbclid/landing/referrer → localStorage (30 days)
        │          + beacon: marketing touch keyed by mpk_session_id
        │
        ├─► browser pixel (after consent): ViewContent, AddToCart, InitiateCheckout
        │
        ▼
 POST /api/v1/checkout  (body gains `attribution` {...}, sessionId already sent)
        │
        ▼
 Backend creates Order ──► [B] order_attribution row (first touch, last touch, channel, fbc/fbp, consent)
        │
        ▼
 M-Pesa callback / manual confirm ──► applySuccessfulPayment()
        │                                   │ after commit
        │                                   ▼
        │                       [C] Meta Conversions API: Purchase
        │                           event_id = "purchase-<orderReference>"
        │                           (browser Purchase uses the same id → Meta de-duplicates)
        ▼
 [D] Admin → Analytics → Marketing: orders, net revenue, profit, spend, ROAS
     per channel → per Meta campaign / ad set / ad
```

Two sources of truth, on purpose:

- **Our dashboard (first-party, click-based):** "orders whose last marketing click was a Meta ad". This is the number the business trusts for money.
- **Meta Ads Manager (modelled):** includes view-through and modelled conversions, and can't see visitors who declined cookies unless the server event covers them. It will **never** exactly match our dashboard. Section 6.4 explains how to show both.

---

## 3. Phase 0: Meta Business setup (owner, no code)

The owner does these in Meta Business Manager / Events Manager. The implementer only needs the outputs.

1. **Verify the domain** `momentspackaging.com` (Business Settings → Brand safety → Domains). Use the **DNS TXT** method; DNS for momentspackaging.com is at Namecheap (Advanced DNS). Alternatively add Meta's `<meta name="facebook-domain-verification">` tag to `index.html`; if so, the implementer adds it.
2. **Confirm the pixel is the dataset** "Moments E-commerce" (`978799355262510`) and it's connected to the ad account.
3. **Create a Conversions API access token.** Events Manager → dataset → Settings → Conversions API → Generate access token; a System User token is preferred. Store it only as a Railway environment variable on the production backend: `META_CAPI_ACCESS_TOKEN`. Never commit it and never put it in the frontend.
4. **Get a test event code** (Events Manager → Test events) for verification: Railway env `META_CAPI_TEST_EVENT_CODE`. Remove it after go-live.
5. **Event priority** (Aggregated Event Measurement, if Meta still shows it for this account): Purchase first, then InitiateCheckout, AddToCart, ViewContent, Lead.
6. *(Phase 5 only)* Create a Commerce Manager **catalogue** and connect it to the dataset.

Outputs handed to the implementer: dataset ID (already known), `META_CAPI_ACCESS_TOKEN` set on Railway, optional `META_CAPI_TEST_EVENT_CODE`, and confirmation that the domain is verified.

---

## 4. Phase 1: first-party attribution capture (frontend + backend)

This is the core of "how much did Meta earn us". It doesn't depend on Meta at all and works for Google, TikTok, email and so on too.

### 4.1 Frontend: `src/lib/marketingAttribution.ts` + `src/components/MarketingAttributionCapture.tsx`

Model it line-for-line on `referralAttribution.ts` / `ReferralCapture.tsx` (mounted in `App.tsx` next to `ReferralCapture`).

On **every** route change, read the URL. If it carries any of `utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, fbclid, gclid, ttclid`, it's a **tagged touch**. Build:

```ts
interface Touch {
  source?: string; medium?: string; campaign?: string; content?: string; term?: string; campaignId?: string;
  fbclid?: string; gclid?: string; ttclid?: string;
  landingPath: string;        // pathname only, no query
  referrer?: string;          // document.referrer host only (e.g. "l.facebook.com"), never the full URL
  at: number;                 // Date.now()
}
```

- Store under `localStorage["mpk_marketing_attribution_v1"] = { first: Touch, last: Touch }`.
- `first` is written only if absent or older than 30 days. `last` is overwritten on every new tagged touch.
- An **untagged** visit whose referrer is an external host (e.g. `l.facebook.com`, `www.google.com`, `chatgpt.com`) also counts as a touch, with no utm fields and the referrer set. A visit with no referrer and no tags (direct) does **not** overwrite `last`; that gives "last non-direct click" attribution, the industry default.
- Expire the whole record after 30 days (decision D1).
- Wrap all storage in try/catch (private browsing), exactly like the referral file.
- If `fbclid` is present, also compute Meta's click cookie format and keep it: `fbc = "fb.1." + at + "." + fbclid`. If the pixel has loaded, also read the `_fbp` cookie. Both feed the server event's match quality.
- Fire a beacon once per new touch: `POST /api/v1/public/marketing/touch` with `session: true` and the Touch JSON (no PII). This gives per-campaign **landing** counts for the funnel, including visitors who never buy. Fire and forget, never block navigation.

Consent note: this capture is first-party and sends nothing to third parties, the same as the existing `?ref=` capture and page-journey beacon, which already run without consent. Whether that's acceptable is decision D2. Recommended: yes for our own records, **no** for sending anything to Meta without consent.

### 4.2 Channel classification (shared logic)

Derive one `channel` value (store it on the backend; compute it on the backend from the raw fields so it can be re-derived later):

| channel | rule (first match wins) |
|---|---|
| `META_PAID` | `utm_source` in (`meta`,`facebook`,`fb`,`instagram`,`ig`) AND `utm_medium` in (`paid_social`,`paid`,`cpc`,`ads`, ...) |
| `META_UNTAGGED` | `fbclid` present with no utm tags at all, or only a bare Meta `utm_source` with no medium. Could be an untagged ad OR an organic post click, so it is never counted as paid |
| `META_ORGANIC` | referrer host ends with `facebook.com` / `instagram.com` / `l.instagram.com` / `lm.facebook.com`, no paid tags |
| `GOOGLE_ADS` | `gclid` present OR (`utm_source=google` AND `utm_medium=cpc`) |
| `OTHER_PAID` | `ttclid` present, or any other source with a paid medium (for example TikTok) |
| `SEARCH_ORGANIC` | referrer is a search engine (google., bing., duckduckgo., yahoo.) |
| `AI_ASSISTANT` | referrer is chatgpt.com, chat.openai.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai |
| `WHATSAPP` | `utm_source=whatsapp` or referrer `wa.me` / `whatsapp.com` |
| `EMAIL` | `utm_medium=email` |
| `REFERRAL` | any other external referrer |
| `DIRECT` | nothing |

The implemented classifier is `MarketingChannelClassifier.java` (unit-tested in `MarketingAttributionTest`). The unmerged branch `traffic-source-tracking` (`666ca32`) is a separate, older page-journey classification and was not reused. A missing referrer on `fbclid` visits is normal: Meta's in-app browser often strips it.

### 4.3 Checkout sends attribution

In `src/services/orderStore.ts` `placeOrder()` (it already sets `body.sessionId`), add `body.attribution = getStoredAttribution()` with the `{ first, last, fbc, fbp, consentMarketing }` object. `consentMarketing` = the cookie-banner choice at order time (`true` only for `"accepted"`).

### 4.4 Backend: storage

**Migration `V41__marketing_attribution.sql`** (renumber if taken):

```sql
CREATE TABLE public.order_attribution (
    id                uuid PRIMARY KEY,
    order_id          uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    session_id        varchar(100),
    channel           varchar(30) NOT NULL,          -- last-touch channel (section 4.2)
    first_channel     varchar(30),
    -- last touch
    utm_source        varchar(100), utm_medium varchar(100), utm_campaign varchar(255),
    utm_content       varchar(255), utm_term   varchar(255), utm_id       varchar(100),
    landing_path      varchar(500), referrer_host varchar(255), touched_at timestamptz,
    -- first touch
    first_utm_source  varchar(100), first_utm_medium varchar(100), first_utm_campaign varchar(255),
    first_landing_path varchar(500), first_referrer_host varchar(255), first_touched_at timestamptz,
    -- click identifiers
    fbclid            varchar(500), fbc varchar(600), fbp varchar(100), gclid varchar(500),
    -- Meta server-event bookkeeping (Phase 3)
    consent_marketing boolean NOT NULL DEFAULT false,
    client_user_agent varchar(500),
    meta_capi_status  varchar(20),                    -- NULL / SENT / SKIPPED_NO_CONSENT / SKIPPED_TEST / FAILED
    meta_capi_sent_at timestamptz,
    meta_capi_error   varchar(1000),
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz
);
CREATE INDEX idx_order_attribution_channel  ON public.order_attribution (channel);
CREATE INDEX idx_order_attribution_campaign ON public.order_attribution (utm_campaign);

CREATE TABLE public.marketing_touch_events (
    id uuid PRIMARY KEY, session_id varchar(100), channel varchar(30) NOT NULL,
    utm_source varchar(100), utm_medium varchar(100), utm_campaign varchar(255),
    utm_content varchar(255), utm_term varchar(255), landing_path varchar(500),
    referrer_host varchar(255), has_fbclid boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL
);
CREATE INDEX idx_marketing_touch_created ON public.marketing_touch_events (created_at);
CREATE INDEX idx_marketing_touch_campaign ON public.marketing_touch_events (utm_campaign);
```

Why a separate 1:1 table, not columns on `orders`: `Order.java` is already ~600 lines with many concerns, and attribution is optional, write-once, and reporting-only. Check the actual orders table/PK names in the existing migrations before writing the FK.

Entities, a repository, and a new package `marketing/` (`entity`, `repository`, `service`, `controller`, `dto`), following the structure of `analytics/`.

- `CheckoutRequest` gets `private AttributionPayload attribution;` (nullable, validated lengths, unknown fields ignored).
- `CheckoutService`: after the order is saved, call `MarketingAttributionService.recordForOrder(order, request.getAttribution(), request.getSessionId(), userAgentHeader)`. **Wrap it in try/catch and log**: attribution must never fail or slow a checkout. If the payload is missing, still write a row with `channel = DIRECT`, so every web order has exactly one row.
- **Admin-created orders** (`AdminOrderCreateRequest` / `AdminOrderCreateModal.tsx`, i.e. phone, WhatsApp and walk-in orders): add an optional "How did this customer find us?" select (Meta ad / Instagram / Facebook page / WhatsApp / Google / walk-in / referral / repeat customer / other) and store it as `channel` with `utm_source=admin_entry`. This is the only way ad-driven offline sales get counted (decision D6).
- `POST /api/v1/public/marketing/touch`: public, rate-limited like the page-journey endpoint (check how `PublicPageJourneyController` is protected and copy it), validates lengths, derives `channel`, and stores it.
- Exclude `isTestOrder` / `preLaunchDemoOrder` orders from every report (same as the existing analytics), but still store their attribution.

**Acceptance for Phase 1:**
1. Open `https://momentspackaging.com/products/<slug>/?utm_source=meta&utm_medium=paid_social&utm_campaign=test-campaign&utm_content=test-ad&fbclid=TEST123`, browse, and place a real order. The `order_attribution` row has `channel=META_PAID`, `utm_campaign=test-campaign`, and `fbc` starting `fb.1.`.
2. A direct visit (no tags, no referrer) after a tagged visit still attributes the order to the tagged campaign (last non-direct).
3. An order with storage disabled (private window) still gets a row with `channel=DIRECT` and checkout isn't affected.
4. A new `marketing_touch_events` row appears for the tagged landing.

---

## 5. Phase 2: browser pixel events (frontend only)

All inside `MetaPixel.tsx`'s consent gate. Add a tiny helper `trackMeta(event, params, eventId?)` exported from `MetaPixel.tsx` that's a no-op unless the pixel is active. Use `content_ids = [product.id]` (UUID; see section 1 on SKUs) and `currency: "KES"` everywhere.

| Event | Fire when | Where | Params |
|---|---|---|---|
| `ViewContent` | product loaded on the product page | `src/routes/products.$slug.tsx` (after `product` is set) | `content_ids:[id]`, `content_type:"product"`, `content_name`, `content_category`, `value: basePrice`, `currency` |
| `AddToCart` | **any** add to cart | `src/contexts/CartContext.tsx` `addItem` (line ~214). One hook covers every caller: product page, `QuickAddUomButtons`, `ConfiguratorModal`, `quickAdd.ts`, wishlist, re-order. Don't fire from `AdminOrderCreateModal`: check whether it shares the customer CartContext, and if it does, pass a flag or skip when on `/admin`. | `content_ids:[productId]`, `contents:[{id, quantity}]`, `value: unitPrice*qty`, `currency` |
| `InitiateCheckout` | checkout page opens with a non-empty cart | `src/routes/checkout.tsx` (same moment the funnel `OPENED` step fires) | `content_ids`, `contents`, `num_items`, `value: cart subtotal`, `currency` |
| `AddPaymentInfo` *(optional)* | M-Pesa STK push initiated | `orderStore.startMpesaStk` success | `value`, `currency` |
| `Purchase` | payment status becomes PAID **in the browser** | wherever `orderStore.getPaymentStatus()` polling observes PAID, and the order-confirmation page if it loads an already-paid order | `value`, `currency`, `content_ids`, `contents`, `num_items`, **`eventID: "purchase-" + order.reference`** |
| `Lead` | enquiry / quote form submitted successfully | `EnquiryContext` submit, `enterprise-quote.tsx`, `contact.tsx` | `content_name: form name` |
| `Contact` | WhatsApp button clicked | `WhatsAppFloat.tsx`, `BottomNav`, `QuickEnquirySheet` | none |

Rules:
- The browser `Purchase` **must** use `eventID = "purchase-<reference>"`, byte-identical to the server event in Phase 3, so Meta counts the order once.
- Guard `Purchase` with a `sessionStorage` key per reference so refreshing the confirmation page doesn't send it twice.
- The value definition must match Phase 3 exactly (decision D4).

**Cookie banner timing (decision D3), IMPLEMENTED.** `CookieConsent.tsx` shows the banner **immediately** when the session started from a tagged link (`utm_*`, `fbclid`, `gclid`, `ttclid`), and after 15 seconds otherwise, instead of 3 minutes. Without this, almost no ad visitor ever loads the pixel, and Meta can't optimise. Keep the banner's wording and behaviour, which are legal elements; change only when it appears.

**Acceptance for Phase 2:** with Meta Pixel Helper (Chrome extension) and Events Manager → Test events, after accepting cookies: product page → ViewContent; add to cart from product page AND a quick-add button → AddToCart each time; checkout → InitiateCheckout; pay a real small order → Purchase with the `purchase-<ref>` event ID. With "Only essentials" chosen, no request goes to `facebook.com`.

---

## 6. Phase 3: server-side Conversions API (backend)

Why: bank-transfer and cash-on-delivery orders are confirmed by staff hours later, M-Pesa customers often close the tab before the confirmation page loads, and ad blockers and in-app browsers drop pixel calls. The server event is the only reliable Purchase signal.

### 6.1 Implementation

- New `marketing/service/MetaConversionsService.java`, enabled only when `META_CAPI_ACCESS_TOKEN` is set (log once at startup if disabled). Dataset ID in config: `meta.capi.dataset-id=978799355262510` in `application.yml`.
- Trigger: publish an `OrderPaidEvent` at the end of `PaymentService.applySuccessfulPayment` (after the existing work). Handle it with `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async`. **Never** call Meta inside the payment transaction: a slow or failed Meta call must not roll back or delay a payment. The early-return guard in `applySuccessfulPayment` already makes this fire at most once per order.
- Send only when: token configured AND order not `isTestOrder`/`preLaunchDemoOrder` AND `order_attribution.consent_marketing = true` (decision D2). Otherwise set `meta_capi_status` to `SKIPPED_NO_CONSENT` / `SKIPPED_TEST`.
- Request: `POST https://graph.facebook.com/v<current>/<datasetId>/events?access_token=...`. Check the current Graph API version at implementation time; don't hardcode an old one. Body:

```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": <order.paidAt epoch seconds>,
    "event_id": "purchase-<order.reference>",
    "action_source": "website",
    "event_source_url": "https://momentspackaging.com/order-confirmation",
    "user_data": {
      "em": ["<sha256(lowercase trimmed email)>"],
      "ph": ["<sha256(digits only, Kenyan E.164 without '+', e.g. 2547XXXXXXXX)>"],
      "external_id": ["<sha256(customer id or email)>"],
      "fbc": "<order_attribution.fbc>",
      "fbp": "<order_attribution.fbp>",
      "client_user_agent": "<order_attribution.client_user_agent>",
      "country": ["<sha256('ke')>"]
    },
    "custom_data": {
      "currency": "KES",
      "value": <see D4>,
      "order_id": "<order.reference>",
      "content_type": "product",
      "content_ids": ["<product uuid>", "..."],
      "contents": [{"id": "<product uuid>", "quantity": <n>}],
      "num_items": <total units>
    }
  }],
  "test_event_code": "<META_CAPI_TEST_EVENT_CODE, only if set>"
}
```

- Phone normalisation: `07XXXXXXXX` → `2547XXXXXXXX`, `+254…` → `254…`, `01XXXXXXXX` → `2541XXXXXXXX`. Unit-test this.
- Don't send `client_ip_address` unless decision D2 allows storing IPs. User agent plus hashed email/phone is usually enough for good match quality.
- Log through `IntegrationLogContext` (task `META_CAPI_PURCHASE`) like the TumaBoda/Daraja calls. Store `meta_capi_status` / `meta_capi_sent_at` / `meta_capi_error` on `order_attribution`.
- Retries: a failed send (network or 5xx) is retried by a small scheduled job (every 15 min, max 24 h, since Meta rejects events older than 7 days). Add an admin "resend" action later if needed.
- Refunds: Meta has no refund event. Refunds are netted in **our** dashboard only (Phase 4).

### 6.2 Acceptance for Phase 3

1. With `META_CAPI_TEST_EVENT_CODE` set, a real paid order shows a **Server** Purchase in Events Manager → Test events, with Event Match Quality "Good" or better.
2. An order paid in the browser shows **both** browser and server Purchase with the same event ID, reported as de-duplicated.
3. A bank-transfer order marked paid by staff produces a server Purchase with no browser Purchase.
4. With the Meta API unreachable (bad token), payment confirmation still succeeds and `meta_capi_status = FAILED` with the error saved.
5. A test order or a no-consent order is never sent.

Testing note: the **staging backend is paused** (`api-staging.momentspackaging.com` returns "Application not found"; don't restart it without asking the owner). Server-event verification happens on production using `test_event_code`, with a real small order that the owner then refunds or cancels. Test orders must use realistic customer names and details, with no tool or placeholder names, because Meta and partner systems see them.

---

## 7. Phase 4: the dashboard (backend + frontend)

### 7.1 Ad spend

Our database doesn't know what ads cost. Two options (decision D5):

- **4a (recommended first): manual entry.** Table `marketing_spend(id, platform, campaign_name, utm_campaign, period_start date, period_end date, amount_kes numeric(12,2), notes, created_by, created_at)`. The admin enters the spend per campaign per week or month, copied from Ads Manager. `utm_campaign` must equal the campaign name used in the ad URL (section 8.2), which is how spend joins to orders.
- **4b (later): automatic import** from the Meta Marketing API (Insights, daily spend per campaign, ad set and ad), scheduled daily. Needs an `ads_read` token and app review. Only worth it once the manual version has proven the report useful.

### 7.2 Backend endpoints (`AdminMarketingAnalyticsController`, admin-only, same auth as the other analytics controllers)

- `GET /api/v1/admin/analytics/marketing/summary?start&end`: per channel: landings (touch events), orders, paid orders, gross paid revenue, refunded amount, net revenue, gross profit (reuse the profitability cost logic), average order value, new vs returning customers (first paid order in range vs earlier).
- `GET /api/v1/admin/analytics/marketing/campaigns?start&end&channel=META_PAID`: the same metrics grouped by `utm_campaign` → `utm_term` (ad set) → `utm_content` (ad), joined to `marketing_spend` for spend, **ROAS = net revenue / spend**, **cost per purchase = spend / paid orders**, and **profit after ads = gross profit − spend**.
- `GET /api/v1/admin/analytics/marketing/funnel?start&end&campaign=`: landings → sessions with AddToCart (needs the Phase 2 AddToCart to also POST a funnel step, or reuse checkout funnel `OPENED`) → checkout opened → paid. Join sessions via `session_id`.
- `GET /api/v1/admin/analytics/marketing/orders?start&end&campaign=`: the actual orders behind a number, so the owner can click through and trust it.
- CRUD for `marketing_spend`.
- **Revenue definition:** exactly the definition behind the main Analytics overview's revenue summary (`paymentStatus = PAID`, same date field, same test/demo exclusions), plus refunds netted from the refund tables. Put the "which date" rule (order created vs paid) in one place and document it in the UI tooltip.

### 7.3 Frontend: new tab "Marketing"

`src/routes/_adminAuth.admin.analytics.marketing.tsx`, registered in `App.tsx` (routing is manual; see `CLAUDE.md`) and added to the analytics tab navigation. Reuse the existing analytics components, date-range picker and CSV/Excel/PDF export buttons.

- KPI row: Meta net revenue, Meta spend, ROAS, cost per purchase, Meta paid orders, profit after ads.
- Table: channel breakdown (all channels, so Meta is seen in context).
- Table: Meta campaigns → expandable ad sets → ads, with spend inline-editable (or a "Spend" sub-page).
- Funnel chart per selected campaign.
- Info box: "Meta Ads Manager will show different numbers: it counts people who saw an ad and bought later without clicking, and modelled conversions. This page counts orders whose last marketing click was a Meta ad." Keep this wording plain; the owner reads it.

### 7.4 Acceptance for Phase 4

The Phase 1 test order appears under its campaign with the right value. Entering spend of KES 1,000 against that campaign shows the correct ROAS. Refunding the order moves it from net revenue into refunds. CSV export matches the on-screen numbers. The totals across all channels equal the main Analytics overview's paid revenue (`/admin/analytics`) for the same range. **That equality is the key reconciliation check**, since it proves no orders are lost or double-counted.

---

## 8. Phase 5: making the ads themselves effective

### 8.1 Product catalogue feed (for catalogue / Advantage+ shopping ads)

- Endpoint `GET /api/v1/public/meta/catalog.csv` (backend, live data, cached ~1 h), which Meta fetches on a daily schedule. Build it on the backend, **not** at frontend build time: prices and stock change between deploys.
- Columns: `id` (product UUID, same as pixel `content_ids`), `title` (title-cased name; reuse the logic in `src/seo/seoData.js` `displayProductName`), `description` (supplier names stripped, as `cleanProductDescription` does), `availability` (`in stock` / `out of stock`), `condition` = `new`, `price` = `"650.00 KES"`, `link` = `https://momentspackaging.com/products/<slug>/` (trailing slash), `image_link` (primaryImageUrl), `brand` = `Moments Packaging Kenya`, `product_type` (category path). Skip products with no image or no price, and skip obvious test products (see `scripts/generate-sitemap.mjs` for the existing filter).
- 498 of 612 products have images today; the rest are excluded until photos are added.

### 8.2 Ad URL tagging convention (the join key; get this right)

In every ad, set **Website URL** to a real product or category page (trailing-slash product URLs), and put this in the ad's **URL parameters** field (Meta fills the `{{ }}` placeholders itself):

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{campaign.id}}
```

Campaign names become report rows, so name them for humans and keep them stable (e.g. `2026-10-courier-bags-nairobi`). The `marketing_spend.utm_campaign` value must match the campaign name exactly.

### 8.3 Campaign guidance (for the owner, brief)

- Objective **Sales**, conversion location **Website**, optimisation event **Purchase**. If the account can't reach roughly 50 purchases a week, Meta's delivery learns slowly; start by optimising for **InitiateCheckout** or **AddToCart** and switch to Purchase once volume allows. Verify the current Meta guidance before relying on this threshold.
- Send people to the most relevant product or category page, not the homepage.
- Click-to-WhatsApp ads can't be attributed by the website at all. Use them only with the admin "How did this customer find us?" field (section 4.4), and compare them separately.
- Custom audiences worth creating once events flow: product viewers (ViewContent 14 days), cart abandoners (AddToCart without Purchase, 7 days), past buyers (for lookalikes).

---

## 9. Decisions for the owner (recommended default in **bold**)

| # | Decision | Options | Recommended |
|---|---|---|---|
| D1 | Attribution model and window | last non-direct click / first click / both | **Store both first and last touch; report on last non-direct click; 30-day window** |
| D2 | Consent scope | (a) capture UTM for our own records without consent, send to Meta only with consent; (b) require consent for everything; (c) send server events for all buyers | **(a)**. It matches how `?ref=` and page journeys already work. Server-side sends to Meta include hashed email/phone, which is personal data under the Kenya Data Protection Act, so only for consenting buyers. The owner should confirm this with whoever handles legal and privacy. Update `/privacy` to mention Meta (Phase 2). |
| D3 | Cookie banner timing | keep 3 min / immediate for ad traffic + ~15 s otherwise / immediate always | **Immediate for tagged ad traffic, ~15 s otherwise** |
| D4 | "Value" of a purchase (for Meta and for our ROAS) | total paid incl. delivery / product value excl. delivery / excl. VAT | **What the customer paid for the products, excluding delivery, including VAT as displayed: `total - shippingFee`.** Delivery fees aren't sales revenue. Use the same value in the pixel, the server event and the dashboard. **Implemented this way in the pixel.** |
| D5 | Ad spend source | manual entry / Meta Marketing API | **Manual first (7.1a)**; automate later if the report proves useful |
| D6 | Offline and WhatsApp sales from ads | ignore / admin "How did you find us?" field | **Admin field** on admin-created orders |
| D7 | Store client IP for server events | no / yes, with retention limit | **No** (user agent + hashed contact is enough to start) |

---

## 10. Order of work and rough size

| Phase | Repo | Depends on | Size |
|---|---|---|---|
| 0 Meta setup | owner | nothing | 1 hour, owner |
| 1 Attribution capture + storage | both | D1, D2 | 2–3 days |
| 2 Browser pixel events + banner timing | frontend | D3, D4 | 1–2 days |
| 3 Conversions API | backend | Phase 0 token, Phase 1 table, D2, D4, D7 | 2 days |
| 4 Marketing dashboard + manual spend | both | Phase 1 (Phase 3 not required) | 3–4 days |
| 5 Catalogue feed + ad tagging | backend + owner | Phase 2 content IDs | 1 day + owner setup |

Phases 1 and 2 can run in parallel. **Ship Phase 1 before any ad money is spent**, because orders placed before it can never be attributed retroactively.

---

## 11. Repo rules the implementer must follow

- **Branch flow:** feature branch → `staging` → owner approval → `main`. Main needs the owner's explicit go-ahead. Frontend `staging`/`main` deploy automatically on Render; backend `main` deploys automatically on Railway.
- **Branch-specific files:** `src/config/api.ts`, `src/config/siteLock.ts` and `src/components/TumaBodaTrackingWidget.tsx` (frontend), and `SiteLockConfig.java` plus the Flyway `baseline-version` in `application.yml` (backend), hold different values per branch. A plain merge silently copies the wrong value, so check them after every merge.
- **Shared checkouts:** other work may have uncommitted changes in the main working copies. Use `git worktree add` for new work and never `git add -A`.
- **Commits:** use the owner's git identity from the machine's git config (`MdauCodes`). No co-author trailers.
- **Changelog:** after shipping each phase, add an entry to the admin changelog. Either `POST /api/v1/admin/changelog`, or a dated seeder following `changelog/service/ChangelogPatch2026_09_29SeoAndPixelSeeder.java` (next `@Order` after 97).
- **Local testing limits:** a local frontend dev server can't reach the real backend (CORS), and the staging backend is paused. Verify UI structure locally and real flows on production with test event codes and a small real order.
- Do not change the SEO prerender (`scripts/prerender-seo.mjs`), the Render rewrite rules, or the trailing-slash product URLs as part of this work. See the comments in `src/seo/seoData.js` for why they are the way they are.

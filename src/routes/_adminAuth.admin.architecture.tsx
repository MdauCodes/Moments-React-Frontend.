import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";

interface Item {
  name: string;
  description: string;
}

interface Section {
  title: string;
  intro?: string;
  items: Item[];
}

const STACK: Section = {
  title: "Tech stack",
  items: [
    { name: "Backend", description: "Spring Boot 3, Java 21. Layered as entity → repository → service → controller, one top-level package per domain (see \"Module map\" below)." },
    { name: "Frontend", description: "React 19 + TypeScript, built with Vite, routed with react-router-dom. Admin pages fetch via a shared adminResources/commerceApi client, not a single global data layer — most admin pages manage their own loading state directly." },
    { name: "Database", description: "PostgreSQL, hosted on Railway. Schema evolves via Hibernate's ddl-auto: update — there is no migration tool (no Flyway/Liquibase). Adding a column means adding the field to the entity and redeploying; there's no migration history to read as documentation." },
    { name: "Hosting", description: "Backend on Railway (moments-packaging-latest-backend-production.up.railway.app). Frontend on Render, served at momentspackaging.com / moments-demo.site." },
    { name: "Scheduled jobs", description: "Spring @Scheduled, guarded by ShedLock (JDBC-backed) so a job can't double-run if the app is ever scaled to multiple instances." },
    { name: "Rate limiting", description: "Bucket4j, in-memory. Known gap: buckets are per-instance, not shared — if the backend ever runs multiple replicas, a client's rate limit resets per replica it happens to hit. Documented as future work, not yet built (would need a Redis-backed shared bucket store)." },
    { name: "API docs", description: "SpringDoc OpenAPI is wired in — a live, interactive Swagger UI is available (typically at /swagger-ui/index.html on the backend host) listing every endpoint with request/response shapes, generated straight from the code." },
  ],
};

const INTEGRATIONS: Section = {
  title: "Third-party integrations",
  items: [
    { name: "Payments — Safaricom Daraja", description: "M-Pesa STK Push. DarajaService initiates the push; Daraja calls back to /api/v1/payments/daraja/callback, handled by PaymentService.applySuccessfulPayment — the single shared \"this order just got paid\" method both the M-Pesa and manual-payment paths funnel through (this is also where the birthday pending-points-reward fulfillment hook lives)." },
    { name: "Email — Brevo SMTP", description: "Transactional email (order confirmations, birthday rewards, OTPs, etc.) sent via Brevo's SMTP relay, not a transactional-email API." },
    { name: "SMS — Africa's Talking", description: "Toggleable via app.africastalking.enabled — off by default in some environments." },
    { name: "Image uploads — Cloudinary", description: "General-purpose image hosting for product photos, blog covers, etc. — adminResources.uploadImage()." },
    { name: "Riseller catalog sync — DigitalOcean Spaces (S3-compatible)", description: "A separate integration from Cloudinary, specifically for pulling in the wholesale supplier's (Riseller) product catalog/stock data. Products carry a risellerItemId when sourced this way." },
    { name: "Bot defense — Cloudflare Turnstile", description: "Scaffolded on both ends (widget + backend verification), but does nothing until real Cloudflare site/secret keys are configured. Progressive: invisible for normal use, only surfaces after 5 failed logins from the same IP within a 15-minute window." },
  ],
};

const DOMAIN: Section = {
  title: "Domain concepts a newcomer can't infer from the code alone",
  items: [
    { name: "Order lifecycle & payment status", description: "Order has its own status (fulfillment stage: pending → prepared → dispatched → delivered, roughly) separate from paymentStatus (PENDING/PAID/FAILED/REFUNDED). \"Revenue\" anywhere in analytics means PAID orders only — pending/failed/refunded are always shown alongside it, never folded in, so they're never mistaken for money actually received." },
    { name: "Rewards & referrals", description: "A points-based wallet (CreditTransaction ledger, CreditWallet balance) earns from: welcome bonus, paid orders, product reviews, referrals, and birthday/anniversary rewards. Redeemable for a KES discount at checkout. VIP tiers (Rewards Tiers, admin-configured) unlock perks once a customer crosses a lifetime-points threshold — a status, not a points award itself. Referral payouts are separately configured (Referral Payout Tiers) and referrals earn nothing if no tier is active." },
    { name: "Birthday/anniversary rewards", description: "accountType alone decides which date is checked: INDIVIDUAL_SHOPPER matches dateOfBirth, BUSINESS matches createdAt (i.e. account anniversary) — both localized to Africa/Nairobi. Points-mode rewards aren't credited immediately: a PendingPointsReward is created and only converted to a real wallet credit if the customer completes a paid order within 7 days (fulfilled via the same PaymentService.applySuccessfulPayment hook payments go through); otherwise it's silently forfeited. Percentage-mode instead issues a single-use, restricted promo code with its own expiry — unaffected by the points-mode pending mechanism." },
    { name: "Account types", description: "INDIVIDUAL_SHOPPER and BUSINESS are peers, not a hierarchy — both earn rewards identically. Business accounts get an additional profile (business name, KRA PIN, industry, address) and a \"trade credit readiness\" score, groundwork for a not-yet-live trade-credit product (Credit Accounts in the admin nav is a placeholder)." },
    { name: "Rate-limit / bot-defense stack", description: "Layered: Bucket4j hard rate limits on sensitive endpoints (login, OTP, password reset) → a separate Caffeine-backed failed-login counter (15-min window) that triggers the progressive Turnstile challenge at 5 failures → a disposable-email domain blocklist at registration → honeypot field + minimum-submit-time check on public forms. IP resolution relies on Tomcat's RemoteIpValve trusting Railway's 100.0.0.0/8 edge range — never trust a raw X-Forwarded-For header without this, it's spoofable." },
  ],
};

const MODULES: Section = {
  title: "Backend module map",
  intro: "One top-level package per domain, under com.mdau.momentspackagingbackendjavafirstclient — each usually follows entity/repository/service/controller/dto internally.",
  items: [
    { name: "analytics", description: "Every admin dashboard tab's data: revenue, operations, customers, products, profitability, tax, rewards economics, alerts, Needs Attention." },
    { name: "auth", description: "Customer and staff authentication, JWT issuance, registration (including bot-defense fields)." },
    { name: "order", description: "Orders, order items, promo codes, payment records — the transactional core." },
    { name: "payment", description: "DarajaService (M-Pesa) and PaymentService, the shared \"order just got paid\" entry point." },
    { name: "product", description: "Catalog, stock, taxonomy joins, Riseller sync." },
    { name: "referral", description: "Rewards wallet, credit transactions, referral events, pending points rewards, celebratory-reward banner data." },
    { name: "user", description: "The User entity itself (shared by customers and staff), account types, staff roles." },
    { name: "business", description: "Business-account-specific profile data and onboarding." },
    { name: "settings", description: "AppSetting key/value store backing most of the admin-configurable behavior (rewards rates, tax settings, discount rules)." },
    { name: "jobs", description: "Scheduled jobs: birthday rewards, lead digest email — both refactored to expose a dryRun-aware method so the Developer Tools tab can preview a run before it fires for real." },
    { name: "changelog", description: "This page's backend — internal-only shipped-work log." },
    { name: "devtools", description: "Super-Admin-only manual job triggers (preview + run) for scheduled jobs, gated separately from the general admin permission system." },
    { name: "taxonomy / industry / tag / purchasepurpose", description: "The various classification systems products and customers get tagged with — segment → category → subcategory taxonomy, industry tags, free-form tags, and the signup \"purpose of purchase\" field (with server-side find-or-create dedup for free-text answers)." },
    { name: "enquiry / lead / blog / documentbundle / taxdocument / receipt", description: "Content and document-adjacent features: the contact/quote CRM, marketing leads, the blog, and generated PDF documents (tax docs, receipts, bundles)." },
    { name: "notification / email / upload", description: "Cross-cutting senders and the image-upload abstraction (Cloudinary)." },
    { name: "audit / backup / common", description: "Audit logging for sensitive admin actions, backup tooling, and shared infrastructure (BaseEntity, exceptions, permission annotations like @IsAdmin / @IsStaffOrAdmin)." },
  ],
};

const WHERE_TO_LOOK: Section = {
  title: "Where to look first",
  items: [
    { name: "Live API reference", description: "Swagger UI on the backend host — the fastest way to see every endpoint's actual request/response shape without reading controller code." },
    { name: "Admin Feature Guide", description: "What each part of the site does, for staff — the product-level companion to this page's engineering-level view. See the Feature Guide nav entry." },
    { name: "This page's \"Known limitations\" below", description: "Read before assuming something is fully solved — a few things are deliberately left as documented future work rather than silently pretended-fixed." },
  ],
};

const KNOWN_LIMITATIONS: Section = {
  title: "Known limitations (deliberate, documented — not silently missed)",
  items: [
    { name: "Rate-limit buckets are per-instance", description: "Bucket4j's in-memory buckets don't share state across replicas. Fine at current single-instance scale; would need a Redis-backed store before scaling the backend horizontally." },
    { name: "Turnstile is scaffolded but inert until configured", description: "Both the widget and backend verification exist, but do nothing without real Cloudflare site/secret keys set in the environment." },
    { name: "ddl-auto: update has no rollback story", description: "Schema changes are one-directional. There's no migration history — the ER diagram (see Documentation) and the entity source are the schema's real documentation." },
    { name: "ProductIndustryPatchSeeder / ProductIndustryCleanupSeeder", description: "A pair of startup seeders observed failing silently on every boot in a past deploy log. Not yet investigated — flagged here rather than left as a silent surprise for whoever finds it next." },
  ],
};

function GuideSection({ section }: { section: Section }) {
  return (
    <div className="admin-panel" style={{ padding: 16 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: section.intro ? 6 : 12 }}>{section.title}</h2>
      {section.intro && (
        <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 12, lineHeight: 1.6 }}>{section.intro}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {section.items.map((item) => (
          <div
            key={item.name}
            style={{ padding: "10px 0", borderTop: "1px solid var(--admin-border)" }}
          >
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--admin-muted)", marginTop: 3, lineHeight: 1.6 }}>
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Complements the Feature Guide (what each part of the site does, for staff) rather than
// replacing it — this page answers "how is it actually built," for a developer joining the
// project. Content only, no runtime data fetch: everything here is inherently code-level and
// changes when the code changes, not on any schedule.
function AdminArchitecturePage() {
  const { user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    return <AdminLayout title="System Architecture"><Forbidden resource="System Architecture" /></AdminLayout>;
  }

  return (
    <AdminLayout title="System Architecture">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          A technical overview for a developer joining the project — what the system is built
          with, how the pieces fit together, and the domain concepts that aren't obvious from
          reading code in isolation. See also the Feature Guide for what each part of the site
          does, and the repo's own README/CLAUDE.md and ER diagram for setup instructions and
          the full schema.
        </div>
        <GuideSection section={STACK} />
        <GuideSection section={INTEGRATIONS} />
        <GuideSection section={DOMAIN} />
        <GuideSection section={MODULES} />
        <GuideSection section={WHERE_TO_LOOK} />
        <GuideSection section={KNOWN_LIMITATIONS} />
      </div>
    </AdminLayout>
  );
}

export default AdminArchitecturePage;

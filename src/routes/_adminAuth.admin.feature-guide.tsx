import { Link } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";

interface GuideEntry {
  name: string;
  description: string;
  route?: string;
}

interface GuideGroup {
  title: string;
  entries: GuideEntry[];
}

const CUSTOMER_FACING: GuideGroup = {
  title: "Customer-facing",
  entries: [
    {
      name: "Homepage & starter modal",
      description: "A first-visit popup lets a new visitor self-identify as a Sole Merchant, a Business, or \"just browsing\", and routes them into the right registration flow.",
      route: "/",
    },
    {
      name: "Sole Merchant Account",
      description: "Free individual account. Earns a welcome bonus on signup, points on every paid order, and can redeem points for checkout discounts.",
      route: "/sole-merchant-account",
    },
    {
      name: "Business Account",
      description: "Free profile for companies/SMEs (business name, KRA PIN, industry, address, contact person). Tracks order history and a \"trade credit readiness\" score as groundwork for a future trade-credit product. Earns rewards identically to a Sole Merchant account.",
      route: "/business-account",
    },
    {
      name: "Rewards points & VIP tiers",
      description: "Points are earned from welcome bonuses, paid orders, product reviews and referrals, and can be redeemed for a KES discount at checkout. VIP tiers (configured in Rewards Tiers) unlock extra perks once a customer crosses a lifetime-points threshold.",
      route: "/account/merchant",
    },
    {
      name: "Referral program (give/get)",
      description: "Every account gets a shareable referral link/code. When a referred friend signs up and later places a paid order, both sides are credited with points.",
    },
    {
      name: "Checkout — promo codes & points redemption",
      description: "At checkout, customers can apply a promo code and/or redeem rewards points for a discount, with a live preview of the KES value before confirming.",
      route: "/checkout",
    },
    {
      name: "Guest checkout & order tracking",
      description: "No account is required to buy — guests can complete an order and track it later by order reference, with a dismissible nudge afterward to create a free account.",
      route: "/orders/track",
    },
    {
      name: "Accessibility toolbar",
      description: "A floating button (bottom-right, every storefront page) opens real, functioning controls: text size, high contrast, reduce motion, underline links, readable spacing. Settings persist across visits.",
      route: "/accessibility-policy",
    },
    {
      name: "Voice search",
      description: "A microphone button inside the search dialog transcribes speech using the browser's own built-in speech recognition (no external AI service) and searches the catalogue with it.",
    },
    {
      name: "Product search",
      description: "Full-text product search with recent searches, suggested terms and quick industry links, opened from the header search icon or the keyboard shortcut.",
    },
    {
      name: "Product reviews",
      description: "Customers can leave a star rating and written review on a product they've ordered; a submitted review also earns rewards points.",
    },
  ],
};

const ADMIN_OPS: GuideGroup = {
  title: "Admin & Operations",
  entries: [
    { name: "Dashboard & Analytics", description: "Live operational snapshot — revenue, order counts by status, top products, customer/enquiry/lead totals.", route: "/admin/analytics" },
    { name: "Payment / Preparation / Dispatch queues", description: "Three sequential work queues staff move an order through: verify M-Pesa payment, prepare the order, then dispatch it.", route: "/admin/queues/payment" },
    { name: "Orders", description: "Full order list and detail view — items, payment status, delivery info, status history.", route: "/admin/orders" },
    { name: "Promo Codes (admin)", description: "Create and manage discount codes (percent or fixed amount), including the auto-issued one-time welcome code every new Business Account receives.", route: "/admin/promo-codes" },
    { name: "Rewards Tiers (admin)", description: "Define the VIP tier ladder (e.g. Silver/Gold/Platinum) — a minimum lifetime-points threshold, discount percentage and perk description per tier.", route: "/admin/rewards-tiers" },
    { name: "Rewards Report (admin)", description: "All-time totals of points earned vs. redeemed across every customer, converted to KES — the actual cost of the rewards/referral program to the business, plus outstanding future exposure.", route: "/admin/rewards-report" },
    { name: "Products, Inventory & Catalog Structure", description: "Manage the product catalogue, stock levels, and the segment / category / subcategory taxonomy products are organised under.", route: "/admin/products" },
    { name: "Industries & Delivery Zones", description: "The industry tags shown on the shop page, and the delivery-zone/pricing configuration used at checkout.", route: "/admin/industries" },
    { name: "Customers & Business Accounts", description: "Search and view customer records (account type, rewards balance) and the separate, more detailed Business Account profiles.", route: "/admin/customers" },
    { name: "Credit Accounts", description: "Manual admin adjustment of a specific customer's rewards points wallet (goodwill credits, corrections), and a raw feed of every credit transaction and referral event.", route: "/admin/credit-accounts" },
    { name: "Enquiries CRM", description: "Contact-form and quote enquiries, trackable through a status workflow from new to resolved.", route: "/admin/enquiries" },
    { name: "Reviews moderation", description: "Approve, hide or delete customer-submitted product reviews before they appear publicly.", route: "/admin/reviews" },
    { name: "Blogs", description: "Write and publish blog posts shown on the storefront's blog section.", route: "/admin/blogs" },
    { name: "Users, Roles & Permissions", description: "Manage staff accounts and the permission sets assigned to each role — this is what drives which nav items a given staff member sees.", route: "/admin/users" },
    { name: "Audit Logs", description: "A record of sensitive admin actions (status changes, adjustments, deletions) for accountability.", route: "/admin/audit-logs" },
    { name: "Settings", description: "Site-wide configuration values — including the rewards conversion rate (points per KES) and referral program on/off switches.", route: "/admin/settings" },
  ],
};

function GuideSection({ group }: { group: GuideGroup }) {
  return (
    <div className="admin-panel" style={{ padding: 16 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 12 }}>{group.title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {group.entries.map((entry) => (
          <div
            key={entry.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid var(--admin-border)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{entry.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--admin-muted)", marginTop: 3, lineHeight: 1.5 }}>
                {entry.description}
              </div>
            </div>
            {entry.route && (
              <Link
                to={entry.route}
                className="admin-btn admin-btn-ghost"
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                Open
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminFeatureGuidePage() {
  return (
    <AdminLayout title="Feature Guide">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          A quick reference for what each part of the site does and where to find it — customer-facing
          features first, then the admin tools that manage them.
        </div>
        <GuideSection group={CUSTOMER_FACING} />
        <GuideSection group={ADMIN_OPS} />
      </div>
    </AdminLayout>
  );
}

export default AdminFeatureGuidePage;

import {
  LayoutList,
  Package,
  Star,
  Users,
  Settings,
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Truck,
  CheckCircle2,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Boxes,
  Briefcase,
  TicketPercent,
  Landmark,
  HandCoins,
  Gift,
  TrendingUp,
  BookOpen,
  Share2,
  Receipt,
  FileCheck2,
  ClipboardCheck,
  Wrench,
  Coins,
  ListTree,
  LayoutGrid,
  MapPin,
  UserPlus,
  AlertTriangle,
  Layers,
  Undo2,
  Image,
  Building2,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { hasAnyPerm, PERM, type PermissionCode } from "@/lib/permissions";
import { STAFF_ROLE_RANK, type StaffRoleName } from "@/lib/roles";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  /** Item is visible when user has ANY of these permissions. Omit = always visible. */
  requiresAny?: PermissionCode[];
  /** Renders faded with a tooltip explaining why, instead of the normal hover/active styling —
   *  for pages that still exist but whose primary action has moved elsewhere (e.g. a partner's
   *  own portal), without removing staff's ability to open the page for reference. */
  disabledNote?: string;
  /** Item is only ever visible to the Super Admin staff role, regardless of permissions. */
  superAdminOnly?: boolean;
  /** Item is visible to ADMIN and SUPER_ADMIN, but not lower staff ranks, regardless of
   *  permissions — for actions with real financial/data-destructive consequences that are still
   *  meant for more than just the super admin. */
  adminOnly?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Ordered by day-to-day usability for staff, not alphabetically or by when a section was
// added — daily operational work first, technical/reference material last (Help and Developer
// are both low-frequency reference material, so they sit next to each other at the bottom).
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      // Dashboard adapts internally — show whenever there's anything to show.
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, requiresAny: [PERM.ANALYTICS_VIEW, PERM.ORDER_VIEW, PERM.USER_MANAGE_ROLES, PERM.PRODUCT_MANAGE, PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.USER_VIEW] },
    ],
  },
  {
    label: "Orders",
    items: [
      { label: "All Orders", to: "/admin/orders", icon: ShoppingCart, requiresAny: [PERM.ORDER_VIEW] },
      { label: "Pickup", to: "/admin/board/pickup", icon: CheckCircle2, requiresAny: [PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL] },
      { label: "Manual Delivery", to: "/admin/board/manual-delivery", icon: PackageCheck, requiresAny: [PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL] },
      { label: "CBD / Hand Delivery", to: "/admin/board/hand-delivery", icon: Building2, requiresAny: [PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL] },
      { label: "TumaBoda", to: "/admin/board/tumaboda", icon: ScanLine, requiresAny: [PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_PREPARE, PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL] },
      { label: "Payments", to: "/admin/payments-log", icon: Coins, requiresAny: [PERM.ORDER_VERIFY_PAYMENT] },
      { label: "Stuck Payments", to: "/admin/payments", icon: AlertTriangle, requiresAny: [PERM.ORDER_VERIFY_PAYMENT] },
      { label: "Delivery Settings", to: "/admin/delivery-settings", icon: MapPin, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Refund Requests", to: "/admin/refund-requests", icon: Undo2, requiresAny: [PERM.PAYMENT_REFUND] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", to: "/admin/products", icon: Package, requiresAny: [PERM.PRODUCT_VIEW, PERM.PRODUCT_MANAGE] },
      { label: "Stock Levels", to: "/admin/inventory", icon: Boxes, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Classifications", to: "/admin/catalog", icon: ListTree, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Classify Products", to: "/admin/classify-products", icon: LayoutList, requiresAny: [PERM.PRODUCT_MANAGE] },
      { label: "Delivery Zones", to: "/admin/delivery-zones", icon: Truck, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    label: "Audience",
    items: [
      { label: "Customers", to: "/admin/customers", icon: Users, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Business Accounts", to: "/admin/business-accounts", icon: Briefcase, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Credit Accounts", to: "/admin/credit-accounts", icon: Landmark, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Change Requests", to: "/admin/change-requests", icon: ClipboardCheck, requiresAny: [PERM.CUSTOMER_VIEW] },
      { label: "Enquiries", to: "/admin/enquiries", icon: LayoutList, requiresAny: [PERM.ENQUIRY_VIEW] },
      { label: "Reviews", to: "/admin/reviews", icon: Star, requiresAny: [PERM.REVIEW_MODERATE] },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "TumaBoda Settlements", to: "/admin/tumaboda-settlements", icon: HandCoins, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Tax Documents", to: "/admin/tax-documents", icon: Receipt, requiresAny: [PERM.ORDER_VIEW] },
      { label: "Documents/PDFs", to: "/admin/document-bundles", icon: FileCheck2, requiresAny: [PERM.ORDER_VIEW] },
      { label: "Promo Codes", to: "/admin/promo-codes", icon: TicketPercent, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    // Split out of "Sales" — these 4 are one coherent subsystem (tiers, referral payouts, and
    // the report/settings pages that go with them), and "Sales" as a label didn't predict any of
    // them. Same items, same permissions, just filed under a name that actually describes them.
    label: "Rewards",
    items: [
      { label: "Rewards Tiers", to: "/admin/rewards-tiers", icon: Gift, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Referral Payout Tiers", to: "/admin/referral-tiers", icon: Share2, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Rewards Report", to: "/admin/rewards-report", icon: TrendingUp, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Rewards Settings", to: "/admin/rewards-settings", icon: Coins, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    // The two views actually worth a daily glance. Everything checked weekly/monthly moved to
    // "Reports" below — an 11-item Analytics section was the single longest list in the sidebar,
    // and roughly half of it was reference material, not a daily habit.
    label: "Analytics",
    items: [
      { label: "Overview", to: "/admin/analytics", icon: BarChart3, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Needs Attention", to: "/admin/analytics/needs-attention", icon: AlertTriangle, requiresAny: [PERM.ANALYTICS_VIEW] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Customers", to: "/admin/analytics/customers", icon: Users, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Signups & Demographics", to: "/admin/analytics/signups-demographics", icon: UserPlus, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Geographic", to: "/admin/analytics/geographic", icon: MapPin, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Delivery", to: "/admin/analytics/delivery", icon: Truck, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Products & Inventory", to: "/admin/analytics/products", icon: Boxes, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Profitability", to: "/admin/analytics/profitability", icon: TrendingUp, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Tax & Compliance", to: "/admin/analytics/tax", icon: Receipt, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Rewards & Referrals", to: "/admin/analytics/rewards", icon: Gift, requiresAny: [PERM.ANALYTICS_VIEW] },
      { label: "Data Visualization", to: "/admin/analytics/data-visualization", icon: LayoutGrid, requiresAny: [PERM.ANALYTICS_VIEW] },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Blogs", to: "/admin/blogs", icon: FileText, requiresAny: [PERM.BLOG_MANAGE] },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users", to: "/admin/users", icon: Users, requiresAny: [PERM.USER_VIEW, PERM.USER_CREATE, PERM.USER_MANAGE_ROLES] },
      { label: "Roles", to: "/admin/roles", icon: ShieldCheck, requiresAny: [PERM.USER_MANAGE_ROLES] },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: FileText, requiresAny: [PERM.AUDIT_VIEW] },
      { label: "Changelog", to: "/admin/changelog", icon: BookOpen, requiresAny: [PERM.SETTINGS_MANAGE] },
      { label: "Settings", to: "/admin/settings", icon: Settings, requiresAny: [PERM.SETTINGS_MANAGE] },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Feature Guide", to: "/admin/feature-guide", icon: BookOpen },
      { label: "System Architecture", to: "/admin/architecture", icon: Layers, superAdminOnly: true },
    ],
  },
  {
    label: "Developer",
    items: [
      { label: "Developer", to: "/admin/developer", icon: Wrench, superAdminOnly: true },
      { label: "Product Images (AI)", to: "/admin/product-images", icon: Image, adminOnly: true },
    ],
  },
];

// Maps a nav item's `to` path to the FulfillmentType key AdminNotification.fulfillmentType
// stores (see AdminNotificationService.countUnreadByFulfillmentType) — used to attach the live
// per-tab unread badge at render time. Hand Delivery intentionally shares MANUAL_DELIVERY's count
// with the plain Manual Delivery entry (see the note where this is consumed).
export const NAV_PATH_TO_FULFILLMENT_TYPE: Record<string, string> = {
  "/admin/board/pickup": "PICKUP",
  "/admin/board/manual-delivery": "MANUAL_DELIVERY",
  "/admin/board/hand-delivery": "MANUAL_DELIVERY",
  "/admin/board/tumaboda": "TUMABODA_DELIVERY",
};

// Above this many permission-filtered items, the sidebar switches from "everything expanded" to
// the collapsible accordion + quick-filter — a low-permission role (e.g. a dispatcher who only
// sees ~6 items) keeps today's flat, always-visible list untouched.
export const DENSE_ITEM_THRESHOLD = 12;

/** Byte-for-byte the same predicate AdminLayout used to filter inline — moved here so it's
 *  reusable and independently testable, not changed. */
function isItemVisible(
  item: NavItem,
  permissions: readonly string[] | undefined | null,
  staffRole: StaffRoleName | null,
): boolean {
  if (item.superAdminOnly) return staffRole === "SUPER_ADMIN";
  if (item.adminOnly) return !!staffRole && STAFF_ROLE_RANK[staffRole] <= STAFF_ROLE_RANK.ADMIN;
  if (!item.requiresAny) return true;
  if (hasAnyPerm(permissions, item.requiresAny)) return true;
  // SUPER_ADMIN sees audit logs even without explicit AUDIT_VIEW perm.
  if (staffRole === "SUPER_ADMIN" && item.requiresAny.includes(PERM.AUDIT_VIEW)) return true;
  return false;
}

/** Permission filtering always runs first and is the only thing that can hide an item — search
 *  and collapse state (applied downstream, in AdminSidebarNav) can only narrow what's already
 *  visible here, never widen it. */
export function visibleSectionsFor(
  sections: NavSection[],
  permissions: readonly string[] | undefined | null,
  staffRole: StaffRoleName | null,
): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => isItemVisible(item, permissions, staffRole)) }))
    .filter((section) => section.items.length > 0);
}

export function countVisibleItems(sections: NavSection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}

/** Looks up a nav item by its `to` path within an already permission-filtered section list —
 *  used to render pinned items, which are stored as bare paths (see adminSidebarPrefs.ts) and
 *  need their icon/label/section resolved fresh each render rather than cached, so a pin to a
 *  route the current user can no longer see (role change, permission change) simply stops
 *  resolving instead of rendering a stale, now-inaccessible entry. */
export function findVisibleNavItem(sections: NavSection[], to: string): NavItem | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.to === to);
    if (item) return item;
  }
  return undefined;
}

/** Picks the active nav item by longest matching path prefix, not exact match — so a detail page
 *  like /admin/orders/ORD-123 or /admin/products/new still highlights its parent list item and
 *  keeps that item's section open. Replaces the old isActive(), which was exact-match for every
 *  route except two hand-special-cased ones (dashboard, enquiries) and simply didn't highlight
 *  anything on any other detail/sub-page. */
export function resolveActiveNav(
  pathname: string,
  sections: NavSection[],
): { activeTo: string | null; activeSectionLabel: string | null } {
  const normalized = pathname === "/admin" || pathname === "/admin/" ? "/admin/dashboard" : pathname;

  let activeTo: string | null = null;
  let activeSectionLabel: string | null = null;
  let bestLength = -1;
  for (const section of sections) {
    for (const item of section.items) {
      const matches = normalized === item.to || normalized.startsWith(`${item.to}/`);
      if (matches && item.to.length > bestLength) {
        bestLength = item.to.length;
        activeTo = item.to;
        activeSectionLabel = section.label;
      }
    }
  }
  return { activeTo, activeSectionLabel };
}

export interface NavMatch {
  section: NavSection;
  item: NavItem;
  score: number;
}

function scoreMatch(item: NavItem, sectionLabel: string, query: string): number {
  const label = item.label.toLowerCase();
  const lastSegment = item.to.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") ?? "";
  const section = sectionLabel.toLowerCase();

  if (label.startsWith(query)) return 100;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 80;
  if (label.includes(query) || lastSegment.includes(query)) return 60;
  if (section.includes(query)) return 40;
  // Subsequence match: every query char appears in label, in order (not necessarily adjacent) —
  // catches loose typing like "txdocs" -> "Tax Documents".
  let qi = 0;
  for (let i = 0; i < label.length && qi < query.length; i++) {
    if (label[i] === query[qi]) qi++;
  }
  if (qi === query.length) return 20;
  return 0;
}

/** Filters (never widens) an already permission-filtered set of sections down to whatever matches
 *  the query, ranked best-first within each section. Empty sections are dropped. Call with a
 *  trimmed, lowercased, non-empty query — the caller (AdminSidebarNav) owns that normalization
 *  since it also needs the raw trimmed value to decide whether search mode is active at all. */
export function matchNavItems(sections: NavSection[], query: string): NavMatch[] {
  const q = query.toLowerCase();
  const matches: NavMatch[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const score = scoreMatch(item, section.label, q);
      if (score > 0) matches.push({ section, item, score });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length);
  return matches;
}

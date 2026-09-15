import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { SiteConfigProvider } from "@/contexts/SiteConfigContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AccessibilityToolbar } from "@/components/AccessibilityToolbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { AuthModal } from "@/components/AuthModal";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { PersonaProvider } from "@/contexts/PersonaContext";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { SiteLockOverlay } from "@/components/SiteLockOverlay";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PageViewTracker } from "@/components/PageViewTracker";
import { ReferralCapture } from "@/components/ReferralCapture";

// ── Public pages ────────────────────────────────────────────────────────────
// The homepage alone stays a static import: it is the one route that must be in the initial
// bundle (a cold visitor almost always lands here, and it is what Lighthouse/PSI measures), so
// splitting it would only add a network round-trip to the critical path. Every *other* public
// page below is lazy() — see the note above the account block for why.
import HomePage from "@/routes/index";
import { LAUNCH_PAGE_ENABLED } from "@/config/siteLock";

// Every public page other than the homepage is dynamically imported. Previously all of these were
// static imports, so a visitor landing on `/` downloaded and parsed the JS for the entire
// storefront — catalogue, product detail, cart, checkout, blog, every legal/static page and the
// whole account area — before the homepage could become interactive. PageSpeed Insights measured
// the result: 512KB transferred for the single entry chunk, 386KB (75%) of it unused on the
// homepage. lazy() + the shared <Suspense> boundary around <Routes> below gives each of these its
// own chunk, fetched the moment its route is actually navigated to and not before.
const LaunchCountdownPage = lazy(() => import("@/routes/launch"));
const AboutPage = lazy(() => import("@/routes/about"));
const ContactPage = lazy(() => import("@/routes/contact"));
const CartPage = lazy(() => import("@/routes/cart"));
const CheckoutPage = lazy(() => import("@/routes/checkout"));
const CompanyProfilePage = lazy(() => import("@/routes/company-profile"));
const SustainabilityPage = lazy(() => import("@/routes/sustainability"));
const EnterpriseQuotePage = lazy(() => import("@/routes/enterprise-quote"));
const IndustriesPage = lazy(() => import("@/routes/industries"));
const LoginPage = lazy(() => import("@/routes/login"));
const OrderConfirmationPage = lazy(() => import("@/routes/order-confirmation"));
const OrdersTrackPage = lazy(() => import("@/routes/orders.track"));
const PrivacyPage = lazy(() => import("@/routes/privacy"));
const TermsPage = lazy(() => import("@/routes/terms"));
const RewardsTermsPage = lazy(() => import("@/routes/rewards-terms"));
const RefundsPage = lazy(() => import("@/routes/refunds"));
const AccessibilityPolicyPage = lazy(() => import("@/routes/accessibility-policy"));
const ManageMyDataPage = lazy(() => import("@/routes/manage-my-data"));
const StyleGuidePage = lazy(() => import("@/routes/style-guide"));
const BlogIndexPage = lazy(() => import("@/routes/blog.index"));
const BlogSlugPage = lazy(() => import("@/routes/blog.$slug"));
const FaqPage = lazy(() => import("@/routes/faq"));
const HowItWorksPage = lazy(() => import("@/routes/how-it-works"));
const PaymentMethodsPage = lazy(() => import("@/routes/payment-methods"));
const CareersPage = lazy(() => import("@/routes/careers"));
const BecomeAPartnerPage = lazy(() => import("@/routes/become-a-partner"));
const ProductsIndexPage = lazy(() => import("@/routes/products.index"));
const DealsPage = lazy(() => import("@/routes/deals"));
const ProductSlugPage = lazy(() => import("@/routes/products.$slug"));
const BusinessAccountInfoPage = lazy(() => import("@/routes/business-account"));
const IndividualShopperAccountInfoPage = lazy(() => import("@/routes/individual-shopper-account"));
const AccountOptionsPage = lazy(() => import("@/routes/account-options"));

// ── Account pages ───────────────────────────────────────────────────────────
// Lazy for the same reason as the public pages above, and even more clearly so: none of this is
// reachable without signing in, yet every anonymous visitor was paying to download it.
const AccountLoginPage = lazy(() => import("@/routes/account.login"));
const AccountRegisterPage = lazy(() => import("@/routes/account.register"));
const AccountDashboardPage = lazy(() => import("@/routes/account.dashboard"));
const AccountForgotPasswordPage = lazy(() => import("@/routes/account.forgot-password"));
const AccountResetPasswordPage = lazy(() => import("@/routes/account.reset-password"));
const AccountOrdersPage = lazy(() => import("@/routes/account.orders"));
const AccountOrderDetailPage = lazy(() => import("@/routes/account.orders.$reference"));
const AccountProfilePage = lazy(() => import("@/routes/account.profile"));
const AccountReferralsPage = lazy(() => import("@/routes/account.referrals"));
const AccountWishlistPage = lazy(() => import("@/routes/account.wishlist"));
const AccountBusinessPage = lazy(() => import("@/routes/account.business"));
const AccountMerchantPage = lazy(() => import("@/routes/account.merchant"));

// ── Admin auth pages (no auth required) ────────────────────────────────────
// Every admin page below is dynamically imported — the entire admin dashboard (analytics,
// catalog, order management, etc.) previously shipped as static imports, meaning it was bundled
// into and downloaded by every public visitor's initial page load, and vice versa for the public
// site's own code on an admin's first login. lazy() + the <Suspense> boundary around the admin
// <Route> blocks below makes each of these its own chunk, fetched only when that route is
// actually visited.
const AdminLoginPage = lazy(() => import("@/routes/admin.login"));
const AdminForgotPasswordPage = lazy(() => import("@/routes/admin.forgot-password"));
const AdminResetPasswordPage = lazy(() => import("@/routes/admin.reset-password"));

// ── Admin pages (auth required) ─────────────────────────────────────────────
// Named export, not default — wrapped to match the { default } shape lazy() requires.
const AdminDashboardPage = lazy(() =>
  import("@/routes/_adminAuth.admin.index").then((m) => ({ default: m.AdminDashboardPage })));
const AdminAnalyticsPage = lazy(() => import("@/routes/_adminAuth.admin.analytics"));
const AdminAnalyticsCustomersPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.customers"));
const AdminAnalyticsNeedsAttentionPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.needs-attention"));
const AdminAnalyticsSignupsDemographicsPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.signups-demographics"));
const AdminAnalyticsGeographicPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.geographic"));
const AdminAnalyticsDeliveryPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.delivery"));
const AdminAnalyticsProductsPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.products"));
const AdminAnalyticsProfitabilityPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.profitability"));
const AdminAnalyticsTaxPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.tax"));
const AdminAnalyticsRewardsPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.rewards"));
const AdminAnalyticsDataVisualizationPage = lazy(() => import("@/routes/_adminAuth.admin.analytics.data-visualization"));
const AdminAuditLogsPage = lazy(() => import("@/routes/_adminAuth.admin.audit-logs"));
const AdminBlogsPage = lazy(() => import("@/routes/_adminAuth.admin.blogs"));
const AdminBlogsNewPage = lazy(() => import("@/routes/_adminAuth.admin.blogs.new"));
const AdminBlogEditPage = lazy(() => import("@/routes/_adminAuth.admin.blogs.$id"));
const AdminCatalogPage = lazy(() => import("@/routes/_adminAuth.admin.catalog"));
const AdminChangePasswordPage = lazy(() => import("@/routes/_adminAuth.admin.change-password"));
const AdminClassifyProductsPage = lazy(() => import("@/routes/_adminAuth.admin.classify-products"));
const AdminCustomersPage = lazy(() => import("@/routes/_adminAuth.admin.customers"));
const AdminCustomerDetailPage = lazy(() => import("@/routes/_adminAuth.admin.customers.$id"));
const AdminBusinessAccountsPage = lazy(() => import("@/routes/_adminAuth.admin.business-accounts"));
const AdminBusinessAccountDetailPage = lazy(() => import("@/routes/_adminAuth.admin.business-accounts.$id"));
const AdminCreditAccountsPage = lazy(() => import("@/routes/_adminAuth.admin.credit-accounts"));
const AdminDeliveryZonesPage = lazy(() => import("@/routes/_adminAuth.admin.delivery-zones"));
const AdminEnquiriesPage = lazy(() => import("@/routes/_adminAuth.admin.enquiries"));
const AdminEnquiriesNewPage = lazy(() => import("@/routes/_adminAuth.admin.enquiries.new"));
const AdminEnquiryDetailPage = lazy(() => import("@/routes/_adminAuth.admin.enquiries.$id"));
const AdminInventoryPage = lazy(() => import("@/routes/_adminAuth.admin.inventory"));
const AdminOrdersPage = lazy(() => import("@/routes/_adminAuth.admin.orders"));
const AdminOrderNewPage = lazy(() => import("@/routes/_adminAuth.admin.orders_.new"));
const AdminOrderDetailPage = lazy(() => import("@/routes/_adminAuth.admin.orders.$id"));
const AdminTumaBodaSettlementsPage = lazy(() => import("@/routes/_adminAuth.admin.tumaboda-settlements"));
const AdminPromoCodesPage = lazy(() => import("@/routes/_adminAuth.admin.promo-codes"));
const AdminTaxDocumentsPage = lazy(() => import("@/routes/_adminAuth.admin.tax-documents"));
const AdminDocumentBundlesPage = lazy(() => import("@/routes/_adminAuth.admin.document-bundles"));
const AdminRewardsTiersPage = lazy(() => import("@/routes/_adminAuth.admin.rewards-tiers"));
const AdminReferralTiersPage = lazy(() => import("@/routes/_adminAuth.admin.referral-tiers"));
const AdminRewardsReportPage = lazy(() => import("@/routes/_adminAuth.admin.rewards-report"));
const AdminRewardsSettingsPage = lazy(() => import("@/routes/_adminAuth.admin.rewards-settings"));
const AdminFeatureGuidePage = lazy(() => import("@/routes/_adminAuth.admin.feature-guide"));
const AdminChangelogPage = lazy(() => import("@/routes/_adminAuth.admin.changelog"));
const AdminChangeRequestsPage = lazy(() => import("@/routes/_adminAuth.admin.change-requests"));
const AdminArchitecturePage = lazy(() => import("@/routes/_adminAuth.admin.architecture"));
const AdminDeveloperPage = lazy(() => import("@/routes/_adminAuth.admin.developer"));
const AdminProductImagesPage = lazy(() => import("@/routes/_adminAuth.admin.product-images"));
const AdminPaymentsPage = lazy(() => import("@/routes/_adminAuth.admin.payments"));
const AdminPaymentsLogPage = lazy(() => import("@/routes/_adminAuth.admin.payments-log"));
const AdminDeliverySettingsPage = lazy(() => import("@/routes/_adminAuth.admin.delivery-settings"));
const AdminRefundRequestsPage = lazy(() => import("@/routes/_adminAuth.admin.refund-requests"));
const AdminProductsIndexPage = lazy(() => import("@/routes/_adminAuth.admin.products.index"));
const AdminDeletedProductsPage = lazy(() => import("@/routes/_adminAuth.admin.products.deleted"));
const AdminProductEditPage = lazy(() => import("@/routes/_adminAuth.admin.products.$id"));
const AdminProductNewPage = lazy(() => import("@/routes/_adminAuth.admin.products_.new"));
const AdminFulfillmentBoardPage = lazy(() => import("@/routes/_adminAuth.admin.board.$mode"));
const AdminReviewsPage = lazy(() => import("@/routes/_adminAuth.admin.reviews"));
const AdminRolesPage = lazy(() => import("@/routes/_adminAuth.admin.roles"));
const AdminSettingsPage = lazy(() => import("@/routes/_adminAuth.admin.settings"));
const AdminStaffPage = lazy(() => import("@/routes/_adminAuth.admin.staff"));
const AdminUsersPage = lazy(() => import("@/routes/_adminAuth.admin.users"));

/** Suspense fallback for every lazy-loaded admin route — shown only for the brief moment the
 *  route's own chunk is being fetched over the network, not while the page's own data loads
 *  (each admin page already has its own internal loading state for that). */
function AdminRouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}

/** Suspense fallback for the lazy public/account routes.
 *
 *  Worth being precise about when a real customer actually sees this, because it drove the design:
 *  react-router v7 wraps every navigation in React's `startTransition`, and React does not hide
 *  already-revealed content behind a Suspense boundary during a transition. So clicking from the
 *  homepage into /products keeps the homepage fully on screen — chrome, scroll position and all —
 *  until the products chunk resolves, then swaps straight to the finished page. No blank flash, no
 *  layout shift, nothing torn down and rebuilt. That is why a single shared boundary wraps
 *  <Routes> below rather than one boundary per route: a fresh per-route boundary would be a new
 *  mount every time and *would* show its fallback on every single navigation.
 *
 *  What remains is the cold case — someone landing directly on a lazy route from Google, a shared
 *  link or a bookmark, where there is genuinely no previous page to hold. There is no shared
 *  layout element to keep mounted either (SiteLayout is rendered by each page itself, not as a
 *  parent route), so rather than fake a header skeleton that could drift out of sync with the real
 *  SiteHeader, this is a calm branded hold in the site's own forest/kraft palette — visually of a
 *  piece with AppSplash, which is what a first-time visitor sees on the homepage anyway. */
function PublicRouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div
        aria-hidden="true"
        className="h-9 w-9 animate-spin rounded-full border-[3px]"
        style={{
          borderColor: "color-mix(in oklab, var(--kraft) 28%, transparent)",
          borderTopColor: "var(--forest)",
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ScrollToTop />
      <PageViewTracker />
      <ReferralCapture />
      <SiteConfigProvider>
        <AccessibilityProvider>
        <AuthProvider>
          <AuthModalProvider>
          <CartProvider>
            <WishlistProvider>
              <AdminAuthProvider>
                <PersonaProvider>
                  {/* One shared Suspense boundary for every lazy public/account route (the admin
                      routes keep their own inner boundaries below, which take precedence for
                      those). Shared, not per-route, on purpose — see PublicRouteFallback's own
                      comment: it is what lets react-router's startTransition hold the current page
                      on screen during an in-app navigation instead of flashing a fallback. */}
                  <Suspense fallback={<PublicRouteFallback />}>
                  <Routes>
                    {/* Public */}
                    <Route path="/" element={<HomePage />} />
                    {LAUNCH_PAGE_ENABLED && <Route path="/launch" element={<LaunchCountdownPage />} />}
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/company-profile" element={<CompanyProfilePage />} />
                    <Route path="/sustainability" element={<SustainabilityPage />} />
                    <Route path="/enterprise-quote" element={<EnterpriseQuotePage />} />
                    <Route path="/industries" element={<IndustriesPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/orders/track" element={<OrdersTrackPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/rewards-terms" element={<RewardsTermsPage />} />
                    <Route path="/refunds" element={<RefundsPage />} />
                    <Route path="/accessibility-policy" element={<AccessibilityPolicyPage />} />
                    <Route path="/manage-my-data" element={<ManageMyDataPage />} />
                    <Route path="/style-guide" element={<StyleGuidePage />} />
                    <Route path="/blog" element={<BlogIndexPage />} />
                    <Route path="/blog/:slug" element={<BlogSlugPage />} />
                    <Route path="/faq" element={<FaqPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/payment-methods" element={<PaymentMethodsPage />} />
                    <Route path="/careers" element={<CareersPage />} />
                    <Route path="/become-a-partner" element={<BecomeAPartnerPage />} />
                    <Route path="/products" element={<ProductsIndexPage />} />
                    <Route path="/deals" element={<DealsPage />} />
                    <Route path="/products/:slug" element={<ProductSlugPage />} />
                    <Route path="/business-account" element={<BusinessAccountInfoPage />} />
                    <Route path="/individual-shopper-account" element={<IndividualShopperAccountInfoPage />} />
                    <Route path="/account-options" element={<AccountOptionsPage />} />
                    <Route path="/sole-merchant-account" element={<Navigate to="/individual-shopper-account" replace />} />

                    {/* Account */}
                    <Route path="/account/login" element={<AccountLoginPage />} />
                    <Route path="/account/register" element={<AccountRegisterPage />} />
                    <Route path="/account/dashboard" element={<AccountDashboardPage />} />
                    <Route path="/account/forgot-password" element={<AccountForgotPasswordPage />} />
                    <Route path="/account/reset-password" element={<AccountResetPasswordPage />} />
                    <Route path="/account/orders" element={<AccountOrdersPage />} />
                    <Route path="/account/orders/:reference" element={<AccountOrderDetailPage />} />
                    <Route path="/account/profile" element={<AccountProfilePage />} />
                    <Route path="/account/referrals" element={<AccountReferralsPage />} />
                    <Route path="/account/wishlist" element={<AccountWishlistPage />} />
                    <Route path="/account/business" element={<AccountBusinessPage />} />
                    <Route path="/account/merchant" element={<AccountMerchantPage />} />

                    {/* Admin — no auth. Wrapped (together with the auth-required block below) in
                        one Suspense boundary — every admin route is now a lazy chunk, see the
                        admin imports above. */}
                    <Route path="/admin/login" element={<Suspense fallback={<AdminRouteFallback />}><AdminLoginPage /></Suspense>} />
                    <Route path="/admin/forgot-password" element={<Suspense fallback={<AdminRouteFallback />}><AdminForgotPasswordPage /></Suspense>} />
                    <Route path="/admin/reset-password" element={<Suspense fallback={<AdminRouteFallback />}><AdminResetPasswordPage /></Suspense>} />

                    {/* Admin — auth required. Each element wrapped in its own Suspense boundary
                        (same AdminRouteFallback as the no-auth admin routes above) since these
                        are now lazy-loaded chunks, not static imports — see the admin imports
                        block near the top of this file. */}
                    <Route element={<AdminProtectedRoute />}>
                      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="/admin/dashboard" element={<Suspense fallback={<AdminRouteFallback />}><AdminDashboardPage /></Suspense>} />
                      <Route path="/admin/analytics" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsPage /></Suspense>} />
                      <Route path="/admin/analytics/customers" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsCustomersPage /></Suspense>} />
                      <Route path="/admin/analytics/needs-attention" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsNeedsAttentionPage /></Suspense>} />
                      <Route path="/admin/analytics/signups-demographics" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsSignupsDemographicsPage /></Suspense>} />
                      <Route path="/admin/analytics/geographic" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsGeographicPage /></Suspense>} />
                      <Route path="/admin/analytics/delivery" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsDeliveryPage /></Suspense>} />
                      <Route path="/admin/analytics/products" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsProductsPage /></Suspense>} />
                      <Route path="/admin/analytics/profitability" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsProfitabilityPage /></Suspense>} />
                      <Route path="/admin/analytics/tax" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsTaxPage /></Suspense>} />
                      <Route path="/admin/analytics/rewards" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsRewardsPage /></Suspense>} />
                      <Route path="/admin/analytics/data-visualization" element={<Suspense fallback={<AdminRouteFallback />}><AdminAnalyticsDataVisualizationPage /></Suspense>} />
                      {/* Retired composite pages from the prior analytics restructuring — redirect old
                          bookmarks/links to a sensible standalone tab rather than 404ing. */}
                      <Route path="/admin/analytics/sales" element={<Navigate to="/admin/analytics/customers" replace />} />
                      <Route path="/admin/analytics/finance" element={<Navigate to="/admin/analytics/profitability" replace />} />
                      <Route path="/admin/audit-logs" element={<Suspense fallback={<AdminRouteFallback />}><AdminAuditLogsPage /></Suspense>} />
                      <Route path="/admin/blogs" element={<Suspense fallback={<AdminRouteFallback />}><AdminBlogsPage /></Suspense>} />
                      <Route path="/admin/blogs/new" element={<Suspense fallback={<AdminRouteFallback />}><AdminBlogsNewPage /></Suspense>} />
                      <Route path="/admin/blogs/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminBlogEditPage /></Suspense>} />
                      <Route path="/admin/catalog" element={<Suspense fallback={<AdminRouteFallback />}><AdminCatalogPage /></Suspense>} />
                      <Route path="/admin/change-password" element={<Suspense fallback={<AdminRouteFallback />}><AdminChangePasswordPage /></Suspense>} />
                      <Route path="/admin/classify-products" element={<Suspense fallback={<AdminRouteFallback />}><AdminClassifyProductsPage /></Suspense>} />
                      <Route path="/admin/customers" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomersPage /></Suspense>} />
                      <Route path="/admin/customers/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomerDetailPage /></Suspense>} />
                      <Route path="/admin/business-accounts" element={<Suspense fallback={<AdminRouteFallback />}><AdminBusinessAccountsPage /></Suspense>} />
                      <Route path="/admin/business-accounts/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminBusinessAccountDetailPage /></Suspense>} />
                      <Route path="/admin/credit-accounts" element={<Suspense fallback={<AdminRouteFallback />}><AdminCreditAccountsPage /></Suspense>} />
                      <Route path="/admin/delivery-zones" element={<Suspense fallback={<AdminRouteFallback />}><AdminDeliveryZonesPage /></Suspense>} />
                      <Route path="/admin/enquiries" element={<Suspense fallback={<AdminRouteFallback />}><AdminEnquiriesPage /></Suspense>} />
                      <Route path="/admin/enquiries/new" element={<Suspense fallback={<AdminRouteFallback />}><AdminEnquiriesNewPage /></Suspense>} />
                      <Route path="/admin/enquiries/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminEnquiryDetailPage /></Suspense>} />
                      <Route path="/admin/inventory" element={<Suspense fallback={<AdminRouteFallback />}><AdminInventoryPage /></Suspense>} />
                      <Route path="/admin/orders" element={<Suspense fallback={<AdminRouteFallback />}><AdminOrdersPage /></Suspense>} />
                      <Route path="/admin/orders/new" element={<Suspense fallback={<AdminRouteFallback />}><AdminOrderNewPage /></Suspense>} />
                      <Route path="/admin/orders/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminOrderDetailPage /></Suspense>} />
                      <Route path="/admin/tumaboda-settlements" element={<Suspense fallback={<AdminRouteFallback />}><AdminTumaBodaSettlementsPage /></Suspense>} />
                      <Route path="/admin/promo-codes" element={<Suspense fallback={<AdminRouteFallback />}><AdminPromoCodesPage /></Suspense>} />
                      <Route path="/admin/tax-documents" element={<Suspense fallback={<AdminRouteFallback />}><AdminTaxDocumentsPage /></Suspense>} />
                      <Route path="/admin/document-bundles" element={<Suspense fallback={<AdminRouteFallback />}><AdminDocumentBundlesPage /></Suspense>} />
                      <Route path="/admin/developer" element={<Suspense fallback={<AdminRouteFallback />}><AdminDeveloperPage /></Suspense>} />
                      <Route path="/admin/product-images" element={<Suspense fallback={<AdminRouteFallback />}><AdminProductImagesPage /></Suspense>} />
                      <Route path="/admin/rewards-tiers" element={<Suspense fallback={<AdminRouteFallback />}><AdminRewardsTiersPage /></Suspense>} />
                      <Route path="/admin/referral-tiers" element={<Suspense fallback={<AdminRouteFallback />}><AdminReferralTiersPage /></Suspense>} />
                      <Route path="/admin/rewards-report" element={<Suspense fallback={<AdminRouteFallback />}><AdminRewardsReportPage /></Suspense>} />
                      <Route path="/admin/rewards-settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminRewardsSettingsPage /></Suspense>} />
                      <Route path="/admin/feature-guide" element={<Suspense fallback={<AdminRouteFallback />}><AdminFeatureGuidePage /></Suspense>} />
                      <Route path="/admin/changelog" element={<Suspense fallback={<AdminRouteFallback />}><AdminChangelogPage /></Suspense>} />
                      <Route path="/admin/change-requests" element={<Suspense fallback={<AdminRouteFallback />}><AdminChangeRequestsPage /></Suspense>} />
                      <Route path="/admin/architecture" element={<Suspense fallback={<AdminRouteFallback />}><AdminArchitecturePage /></Suspense>} />
                      <Route path="/admin/payments" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentsPage /></Suspense>} />
                      <Route path="/admin/payments-log" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentsLogPage /></Suspense>} />
                      <Route path="/admin/delivery-settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminDeliverySettingsPage /></Suspense>} />
                      <Route path="/admin/refund-requests" element={<Suspense fallback={<AdminRouteFallback />}><AdminRefundRequestsPage /></Suspense>} />
                      <Route path="/admin/products" element={<Suspense fallback={<AdminRouteFallback />}><AdminProductsIndexPage /></Suspense>} />
                      <Route path="/admin/products/new" element={<Suspense fallback={<AdminRouteFallback />}><AdminProductNewPage /></Suspense>} />
                      <Route path="/admin/products/deleted" element={<Suspense fallback={<AdminRouteFallback />}><AdminDeletedProductsPage /></Suspense>} />
                      <Route path="/admin/products/:id" element={<Suspense fallback={<AdminRouteFallback />}><AdminProductEditPage /></Suspense>} />
                      <Route path="/admin/board/:mode" element={<Suspense fallback={<AdminRouteFallback />}><AdminFulfillmentBoardPage /></Suspense>} />
                      <Route path="/admin/reviews" element={<Suspense fallback={<AdminRouteFallback />}><AdminReviewsPage /></Suspense>} />
                      <Route path="/admin/roles" element={<Suspense fallback={<AdminRouteFallback />}><AdminRolesPage /></Suspense>} />
                      <Route path="/admin/settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminSettingsPage /></Suspense>} />
                      <Route path="/admin/staff" element={<Suspense fallback={<AdminRouteFallback />}><AdminStaffPage /></Suspense>} />
                      <Route path="/admin/users" element={<Suspense fallback={<AdminRouteFallback />}><AdminUsersPage /></Suspense>} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={
                      <div className="flex min-h-screen items-center justify-center bg-background px-4">
                        <div className="max-w-md text-center">
                          <h1 className="text-7xl font-bold text-foreground">404</h1>
                          <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
                          <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
                          <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</a>
                        </div>
                      </div>
                    } />
                  </Routes>
                  </Suspense>
                  <Toaster />
                  <SiteLockOverlay />
                  <AuthModal />
                  <AccessibilityToolbar />
                </PersonaProvider>
              </AdminAuthProvider>
            </WishlistProvider>
          </CartProvider>
          </AuthModalProvider>
        </AuthProvider>
        </AccessibilityProvider>
      </SiteConfigProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

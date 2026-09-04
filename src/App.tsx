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
import { ReferralCapture } from "@/components/ReferralCapture";

// ── Public pages ────────────────────────────────────────────────────────────
import HomePage from "@/routes/index";
import LaunchCountdownPage, { LAUNCH_PAGE_ENABLED } from "@/routes/launch";
import AboutPage from "@/routes/about";
import ContactPage from "@/routes/contact";
import CartPage from "@/routes/cart";
import CheckoutPage from "@/routes/checkout";
import CompanyProfilePage from "@/routes/company-profile";
import SustainabilityPage from "@/routes/sustainability";
import EnterpriseQuotePage from "@/routes/enterprise-quote";
import IndustriesPage from "@/routes/industries";
import LoginPage from "@/routes/login";
import OrderConfirmationPage from "@/routes/order-confirmation";
import OrdersTrackPage from "@/routes/orders.track";
import PrivacyPage from "@/routes/privacy";
import TermsPage from "@/routes/terms";
import RewardsTermsPage from "@/routes/rewards-terms";
import RefundsPage from "@/routes/refunds";
import AccessibilityPolicyPage from "@/routes/accessibility-policy";
import ManageMyDataPage from "@/routes/manage-my-data";
import StaffPage from "@/routes/staff";
import StyleGuidePage from "@/routes/style-guide";
import BlogIndexPage from "@/routes/blog.index";
import BlogSlugPage from "@/routes/blog.$slug";
import FaqPage from "@/routes/faq";
import HowItWorksPage from "@/routes/how-it-works";
import PaymentMethodsPage from "@/routes/payment-methods";
import CareersPage from "@/routes/careers";
import BecomeAPartnerPage from "@/routes/become-a-partner";
import ProductsIndexPage from "@/routes/products.index";
import DealsPage from "@/routes/deals";
import ProductSlugPage from "@/routes/products.$slug";
import BusinessAccountInfoPage from "@/routes/business-account";
import IndividualShopperAccountInfoPage from "@/routes/individual-shopper-account";
import AccountOptionsPage from "@/routes/account-options";

// ── Account pages ───────────────────────────────────────────────────────────
import AccountLoginPage from "@/routes/account.login";
import AccountRegisterPage from "@/routes/account.register";
import AccountDashboardPage from "@/routes/account.dashboard";
import AccountForgotPasswordPage from "@/routes/account.forgot-password";
import AccountResetPasswordPage from "@/routes/account.reset-password";
import AccountOrdersPage from "@/routes/account.orders";
import AccountOrderDetailPage from "@/routes/account.orders.$reference";
import AccountProfilePage from "@/routes/account.profile";
import AccountReferralsPage from "@/routes/account.referrals";
import AccountWishlistPage from "@/routes/account.wishlist";
import AccountBusinessPage from "@/routes/account.business";
import AccountMerchantPage from "@/routes/account.merchant";

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
const AdminLiveTestUnlockPage = lazy(() => import("@/routes/_adminAuth.admin.live-test-unlock"));
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

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ScrollToTop />
      <ReferralCapture />
      <SiteConfigProvider>
        <AccessibilityProvider>
        <AuthProvider>
          <AuthModalProvider>
          <CartProvider>
            <WishlistProvider>
              <AdminAuthProvider>
                <PersonaProvider>
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
                    <Route path="/staff" element={<StaffPage />} />
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
                      <Route path="/admin/live-test-unlock" element={<Suspense fallback={<AdminRouteFallback />}><AdminLiveTestUnlockPage /></Suspense>} />
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

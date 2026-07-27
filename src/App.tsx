import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { SITE_LOCK_ENABLED } from "@/config/siteLock";
import { SiteLockOverlay } from "@/components/SiteLockOverlay";
import { ScrollToTop } from "@/components/ScrollToTop";

// ── Public pages ────────────────────────────────────────────────────────────
import HomePage from "@/routes/index";
import AboutPage from "@/routes/about";
import ContactPage from "@/routes/contact";
import CartPage from "@/routes/cart";
import CheckoutPage from "@/routes/checkout";
import CheckoutSuccessPage from "@/routes/checkout.success";
import CheckoutFailedPage from "@/routes/checkout.failed";
import CheckoutProcessingPage from "@/routes/checkout.processing";
import CompanyProfilePage from "@/routes/company-profile";
import SustainabilityPage from "@/routes/sustainability";
import EnterpriseQuotePage from "@/routes/enterprise-quote";
import IndustriesPage from "@/routes/industries";
import LoginPage from "@/routes/login";
import OrderConfirmationPage from "@/routes/order-confirmation";
import OrdersTrackPage from "@/routes/orders.track";
import PrivacyPage from "@/routes/privacy";
import TermsPage from "@/routes/terms";
import RefundsPage from "@/routes/refunds";
import AccessibilityPolicyPage from "@/routes/accessibility-policy";
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
import AdminLoginPage from "@/routes/admin.login";
import AdminForgotPasswordPage from "@/routes/admin.forgot-password";
import AdminResetPasswordPage from "@/routes/admin.reset-password";

// ── Admin pages (auth required) ─────────────────────────────────────────────
import { AdminDashboardPage } from "@/routes/_adminAuth.admin.index";
import AdminAnalyticsPage from "@/routes/_adminAuth.admin.analytics";
import AdminAnalyticsSalesPage from "@/routes/_adminAuth.admin.analytics.sales";
import AdminAnalyticsFinancePage from "@/routes/_adminAuth.admin.analytics.finance";
import AdminAnalyticsDataVisualizationPage from "@/routes/_adminAuth.admin.analytics.data-visualization";
import AdminAuditLogsPage from "@/routes/_adminAuth.admin.audit-logs";
import AdminBlogsPage from "@/routes/_adminAuth.admin.blogs";
import AdminBlogsNewPage from "@/routes/_adminAuth.admin.blogs.new";
import AdminBlogEditPage from "@/routes/_adminAuth.admin.blogs.$id";
import AdminCatalogPage from "@/routes/_adminAuth.admin.catalog";
import AdminChangePasswordPage from "@/routes/_adminAuth.admin.change-password";
import AdminClassifyProductsPage from "@/routes/_adminAuth.admin.classify-products";
import AdminCustomersPage from "@/routes/_adminAuth.admin.customers";
import AdminCustomerDetailPage from "@/routes/_adminAuth.admin.customers.$id";
import AdminBusinessAccountsPage from "@/routes/_adminAuth.admin.business-accounts";
import AdminBusinessAccountDetailPage from "@/routes/_adminAuth.admin.business-accounts.$id";
import AdminCreditAccountsPage from "@/routes/_adminAuth.admin.credit-accounts";
import AdminDeliveryZonesPage from "@/routes/_adminAuth.admin.delivery-zones";
import AdminEnquiriesPage from "@/routes/_adminAuth.admin.enquiries";
import AdminEnquiriesNewPage from "@/routes/_adminAuth.admin.enquiries.new";
import AdminEnquiryDetailPage from "@/routes/_adminAuth.admin.enquiries.$id";
import AdminInventoryPage from "@/routes/_adminAuth.admin.inventory";
import AdminOrdersPage from "@/routes/_adminAuth.admin.orders";
import AdminOrderDetailPage from "@/routes/_adminAuth.admin.orders.$id";
import AdminPromoCodesPage from "@/routes/_adminAuth.admin.promo-codes";
import AdminTaxDocumentsPage from "@/routes/_adminAuth.admin.tax-documents";
import AdminDocumentBundlesPage from "@/routes/_adminAuth.admin.document-bundles";
import AdminRewardsTiersPage from "@/routes/_adminAuth.admin.rewards-tiers";
import AdminReferralTiersPage from "@/routes/_adminAuth.admin.referral-tiers";
import AdminRewardsReportPage from "@/routes/_adminAuth.admin.rewards-report";
import AdminRewardsSettingsPage from "@/routes/_adminAuth.admin.rewards-settings";
import AdminFeatureGuidePage from "@/routes/_adminAuth.admin.feature-guide";
import AdminDevToolsPage from "@/routes/_adminAuth.admin.dev-tools";
import AdminPaymentsPage from "@/routes/_adminAuth.admin.payments";
import AdminProductsIndexPage from "@/routes/_adminAuth.admin.products.index";
import AdminProductEditPage from "@/routes/_adminAuth.admin.products.$id";
import AdminProductNewPage from "@/routes/_adminAuth.admin.products_.new";
import AdminQueuesDispatchPage from "@/routes/_adminAuth.admin.queues.dispatch";
import AdminQueuesPaymentPage from "@/routes/_adminAuth.admin.queues.payment";
import AdminQueuesPreparationPage from "@/routes/_adminAuth.admin.queues.preparation";
import AdminReviewsPage from "@/routes/_adminAuth.admin.reviews";
import AdminRolesPage from "@/routes/_adminAuth.admin.roles";
import AdminSettingsPage from "@/routes/_adminAuth.admin.settings";
import AdminStaffPage from "@/routes/_adminAuth.admin.staff";
import AdminUsersPage from "@/routes/_adminAuth.admin.users";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
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
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                    <Route path="/checkout/failed" element={<CheckoutFailedPage />} />
                    <Route path="/checkout/processing" element={<CheckoutProcessingPage />} />
                    <Route path="/company-profile" element={<CompanyProfilePage />} />
                    <Route path="/sustainability" element={<SustainabilityPage />} />
                    <Route path="/enterprise-quote" element={<EnterpriseQuotePage />} />
                    <Route path="/industries" element={<IndustriesPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/orders/track" element={<OrdersTrackPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/refunds" element={<RefundsPage />} />
                    <Route path="/accessibility-policy" element={<AccessibilityPolicyPage />} />
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

                    {/* Admin — no auth */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
                    <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

                    {/* Admin — auth required */}
                    <Route element={<AdminProtectedRoute />}>
                      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                      <Route path="/admin/analytics/sales" element={<AdminAnalyticsSalesPage />} />
                      <Route path="/admin/analytics/finance" element={<AdminAnalyticsFinancePage />} />
                      <Route path="/admin/analytics/data-visualization" element={<AdminAnalyticsDataVisualizationPage />} />
                      {/* Retired flat pages — redirect old bookmarks/links to their new consolidated home
                          (see rippling-booping-lobster.md Phase 2) rather than 404ing. */}
                      <Route path="/admin/analytics/customers" element={<Navigate to="/admin/analytics/sales" replace />} />
                      <Route path="/admin/analytics/geographic" element={<Navigate to="/admin/analytics/sales" replace />} />
                      <Route path="/admin/analytics/delivery" element={<Navigate to="/admin/analytics/sales" replace />} />
                      <Route path="/admin/analytics/rewards" element={<Navigate to="/admin/analytics/finance" replace />} />
                      <Route path="/admin/analytics/tax" element={<Navigate to="/admin/analytics/finance" replace />} />
                      <Route path="/admin/analytics/profitability" element={<Navigate to="/admin/analytics/finance" replace />} />
                      <Route path="/admin/analytics/products" element={<Navigate to="/admin/analytics/data-visualization" replace />} />
                      <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
                      <Route path="/admin/blogs" element={<AdminBlogsPage />} />
                      <Route path="/admin/blogs/new" element={<AdminBlogsNewPage />} />
                      <Route path="/admin/blogs/:id" element={<AdminBlogEditPage />} />
                      <Route path="/admin/catalog" element={<AdminCatalogPage />} />
                      <Route path="/admin/change-password" element={<AdminChangePasswordPage />} />
                      <Route path="/admin/classify-products" element={<AdminClassifyProductsPage />} />
                      <Route path="/admin/customers" element={<AdminCustomersPage />} />
                      <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
                      <Route path="/admin/business-accounts" element={<AdminBusinessAccountsPage />} />
                      <Route path="/admin/business-accounts/:id" element={<AdminBusinessAccountDetailPage />} />
                      <Route path="/admin/credit-accounts" element={<AdminCreditAccountsPage />} />
                      <Route path="/admin/delivery-zones" element={<AdminDeliveryZonesPage />} />
                      <Route path="/admin/enquiries" element={<AdminEnquiriesPage />} />
                      <Route path="/admin/enquiries/new" element={<AdminEnquiriesNewPage />} />
                      <Route path="/admin/enquiries/:id" element={<AdminEnquiryDetailPage />} />
                      <Route path="/admin/inventory" element={<AdminInventoryPage />} />
                      <Route path="/admin/orders" element={<AdminOrdersPage />} />
                      <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
                      <Route path="/admin/promo-codes" element={<AdminPromoCodesPage />} />
                      <Route path="/admin/tax-documents" element={<AdminTaxDocumentsPage />} />
                      <Route path="/admin/document-bundles" element={<AdminDocumentBundlesPage />} />
                      <Route path="/admin/dev-tools" element={<AdminDevToolsPage />} />
                      <Route path="/admin/rewards-tiers" element={<AdminRewardsTiersPage />} />
                      <Route path="/admin/referral-tiers" element={<AdminReferralTiersPage />} />
                      <Route path="/admin/rewards-report" element={<AdminRewardsReportPage />} />
                      <Route path="/admin/rewards-settings" element={<AdminRewardsSettingsPage />} />
                      <Route path="/admin/feature-guide" element={<AdminFeatureGuidePage />} />
                      <Route path="/admin/payments" element={<AdminPaymentsPage />} />
                      <Route path="/admin/products" element={<AdminProductsIndexPage />} />
                      <Route path="/admin/products/new" element={<AdminProductNewPage />} />
                      <Route path="/admin/products/:id" element={<AdminProductEditPage />} />
                      <Route path="/admin/queues/dispatch" element={<AdminQueuesDispatchPage />} />
                      <Route path="/admin/queues/payment" element={<AdminQueuesPaymentPage />} />
                      <Route path="/admin/queues/preparation" element={<AdminQueuesPreparationPage />} />
                      <Route path="/admin/reviews" element={<AdminReviewsPage />} />
                      <Route path="/admin/roles" element={<AdminRolesPage />} />
                      <Route path="/admin/settings" element={<AdminSettingsPage />} />
                      <Route path="/admin/staff" element={<AdminStaffPage />} />
                      <Route path="/admin/users" element={<AdminUsersPage />} />
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
                  {SITE_LOCK_ENABLED && <SiteLockOverlay />}
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
  );
}

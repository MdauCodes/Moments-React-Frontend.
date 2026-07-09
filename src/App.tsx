import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { SiteConfigProvider } from "@/contexts/SiteConfigContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { PersonaProvider } from "@/contexts/PersonaContext";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { SITE_LOCK_ENABLED } from "@/config/siteLock";
import { SiteLockOverlay } from "@/components/SiteLockOverlay";

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

// ── Account pages ───────────────────────────────────────────────────────────
import AccountLoginPage from "@/routes/account.login";
import AccountRegisterPage from "@/routes/account.register";
import AccountDashboardPage from "@/routes/account.dashboard";
import AccountForgotPasswordPage from "@/routes/account.forgot-password";
import AccountResetPasswordPage from "@/routes/account.reset-password";
import AccountVerifyPage from "@/routes/account.verify";
import AccountOrdersPage from "@/routes/account.orders";
import AccountOrderDetailPage from "@/routes/account.orders.$reference";
import AccountProfilePage from "@/routes/account.profile";
import AccountReferralsPage from "@/routes/account.referrals";
import AccountWishlistPage from "@/routes/account.wishlist";

// ── Admin auth pages (no auth required) ────────────────────────────────────
import AdminLoginPage from "@/routes/admin.login";
import AdminForgotPasswordPage from "@/routes/admin.forgot-password";
import AdminResetPasswordPage from "@/routes/admin.reset-password";

// ── Admin pages (auth required) ─────────────────────────────────────────────
import { AdminDashboardPage } from "@/routes/_adminAuth.admin.index";
import AdminAnalyticsPage from "@/routes/_adminAuth.admin.analytics";
import AdminAuditLogsPage from "@/routes/_adminAuth.admin.audit-logs";
import AdminBlogsPage from "@/routes/_adminAuth.admin.blogs";
import AdminBlogsNewPage from "@/routes/_adminAuth.admin.blogs.new";
import AdminBlogEditPage from "@/routes/_adminAuth.admin.blogs.$id";
import AdminCatalogPage from "@/routes/_adminAuth.admin.catalog";
import AdminChangePasswordPage from "@/routes/_adminAuth.admin.change-password";
import AdminClassifyProductsPage from "@/routes/_adminAuth.admin.classify-products";
import AdminCustomersPage from "@/routes/_adminAuth.admin.customers";
import AdminCustomerDetailPage from "@/routes/_adminAuth.admin.customers.$id";
import AdminDeliveryZonesPage from "@/routes/_adminAuth.admin.delivery-zones";
import AdminEnquiriesPage from "@/routes/_adminAuth.admin.enquiries";
import AdminEnquiriesNewPage from "@/routes/_adminAuth.admin.enquiries.new";
import AdminEnquiryDetailPage from "@/routes/_adminAuth.admin.enquiries.$id";
import AdminIndustriesPage from "@/routes/_adminAuth.admin.industries";
import AdminInventoryPage from "@/routes/_adminAuth.admin.inventory";
import AdminOrdersPage from "@/routes/_adminAuth.admin.orders";
import AdminOrderDetailPage from "@/routes/_adminAuth.admin.orders.$id";
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
      <SiteConfigProvider>
        <AuthProvider>
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

                    {/* Account */}
                    <Route path="/account/login" element={<AccountLoginPage />} />
                    <Route path="/account/register" element={<AccountRegisterPage />} />
                    <Route path="/account/dashboard" element={<AccountDashboardPage />} />
                    <Route path="/account/forgot-password" element={<AccountForgotPasswordPage />} />
                    <Route path="/account/reset-password" element={<AccountResetPasswordPage />} />
                    <Route path="/account/verify" element={<AccountVerifyPage />} />
                    <Route path="/account/orders" element={<AccountOrdersPage />} />
                    <Route path="/account/orders/:reference" element={<AccountOrderDetailPage />} />
                    <Route path="/account/profile" element={<AccountProfilePage />} />
                    <Route path="/account/referrals" element={<AccountReferralsPage />} />
                    <Route path="/account/wishlist" element={<AccountWishlistPage />} />

                    {/* Admin — no auth */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
                    <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

                    {/* Admin — auth required */}
                    <Route element={<AdminProtectedRoute />}>
                      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                      <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
                      <Route path="/admin/blogs" element={<AdminBlogsPage />} />
                      <Route path="/admin/blogs/new" element={<AdminBlogsNewPage />} />
                      <Route path="/admin/blogs/:id" element={<AdminBlogEditPage />} />
                      <Route path="/admin/catalog" element={<AdminCatalogPage />} />
                      <Route path="/admin/change-password" element={<AdminChangePasswordPage />} />
                      <Route path="/admin/classify-products" element={<AdminClassifyProductsPage />} />
                      <Route path="/admin/customers" element={<AdminCustomersPage />} />
                      <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
                      <Route path="/admin/delivery-zones" element={<AdminDeliveryZonesPage />} />
                      <Route path="/admin/enquiries" element={<AdminEnquiriesPage />} />
                      <Route path="/admin/enquiries/new" element={<AdminEnquiriesNewPage />} />
                      <Route path="/admin/enquiries/:id" element={<AdminEnquiryDetailPage />} />
                      <Route path="/admin/industries" element={<AdminIndustriesPage />} />
                      <Route path="/admin/inventory" element={<AdminInventoryPage />} />
                      <Route path="/admin/orders" element={<AdminOrdersPage />} />
                      <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
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
                </PersonaProvider>
              </AdminAuthProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </SiteConfigProvider>
    </BrowserRouter>
  );
}


import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import {
  getCustomerAnalytics, getGeographicAnalytics, getDeliveryAnalytics, getSignupTrend, getDemographicsBreakdown,
  type CustomerAnalytics, type GeographicAnalytics, type DeliveryAnalytics, type SignupTrend, type DemographicsBreakdown,
} from "@/services/commerceApi";
import { CustomersSection, customersExportPayload } from "@/components/admin/analyticsPages/CustomersSection";
import { GeographicSection, geographicExportPayload } from "@/components/admin/analyticsPages/GeographicSection";
import { DeliverySection, deliveryExportPayload } from "@/components/admin/analyticsPages/DeliverySection";
import { SignupsDemographicsSection, signupsDemographicsExportPayload } from "@/components/admin/analyticsPages/SignupsDemographicsSection";

type SalesView = "customers" | "geographic" | "delivery" | "signups";

const VIEW_LABELS: Record<SalesView, string> = {
  customers: "Customers", geographic: "Geographic", delivery: "Delivery", signups: "Signups & Demographics",
};

function AdminAnalyticsSalesPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [view, setView] = useState<SalesView>("customers");

  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [priorCustomers, setPriorCustomers] = useState<CustomerAnalytics | null>(null);

  const [geo, setGeo] = useState<GeographicAnalytics | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [delivery, setDelivery] = useState<DeliveryAnalytics | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const [signupTrend, setSignupTrend] = useState<SignupTrend | null>(null);
  const [signupTrendLoading, setSignupTrendLoading] = useState(false);
  const [demographics, setDemographics] = useState<DemographicsBreakdown | null>(null);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  useEffect(() => { document.title = "Sales · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setCustomersLoading(true);
    getCustomerAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setCustomers(res); })
      .catch((err) => reportAdminError(err, "Failed to load customer analytics"))
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const { from, to } = priorRange(range.from, range.to);
    getCustomerAnalytics(from, to)
      .then((res) => { if (!cancelled) setPriorCustomers(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period customer comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setGeoLoading(true);
    getGeographicAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setGeo(res); })
      .catch((err) => reportAdminError(err, "Failed to load geographic analytics"))
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setDeliveryLoading(true);
    getDeliveryAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setDelivery(res); })
      .catch((err) => reportAdminError(err, "Failed to load delivery analytics"))
      .finally(() => { if (!cancelled) setDeliveryLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setSignupTrendLoading(true);
    getSignupTrend(range.from, range.to)
      .then((res) => { if (!cancelled) setSignupTrend(res); })
      .catch((err) => reportAdminError(err, "Failed to load signup trend"))
      .finally(() => { if (!cancelled) setSignupTrendLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setDemographicsLoading(true);
    getDemographicsBreakdown(range.from, range.to)
      .then((res) => { if (!cancelled) setDemographics(res); })
      .catch((err) => reportAdminError(err, "Failed to load demographics breakdown"))
      .finally(() => { if (!cancelled) setDemographicsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  function exportPayload() {
    switch (view) {
      case "customers": return customersExportPayload(customers);
      case "geographic": return geographicExportPayload(geo);
      case "delivery": return deliveryExportPayload(delivery);
      case "signups": return signupsDemographicsExportPayload(signupTrend, demographics);
    }
  }

  return (
    <AdminLayout title="Analytics · Sales" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(VIEW_LABELS) as SalesView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`admin-btn ${view === v ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  onClick={() => setView(v)}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: `Analytics · Sales · ${VIEW_LABELS[view]}`,
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: `analytics-sales-${view}`,
                ...exportPayload(),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            {view === "customers" && <CustomersSection customers={customers} customersLoading={customersLoading} priorCustomers={priorCustomers} />}
            {view === "geographic" && <GeographicSection geo={geo} geoLoading={geoLoading} />}
            {view === "delivery" && <DeliverySection delivery={delivery} deliveryLoading={deliveryLoading} />}
            {view === "signups" && (
              <SignupsDemographicsSection
                signupTrend={signupTrend} signupTrendLoading={signupTrendLoading}
                demographics={demographics} demographicsLoading={demographicsLoading}
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsSalesPage;

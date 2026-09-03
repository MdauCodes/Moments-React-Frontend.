// Shared with the backend's own CheckoutService.isWithinNairobiCbd — keep both in sync if this
// center point or radius ever changes. Extracted from checkout.tsx so the admin phone-order
// modal can offer the same Hand Delivery eligibility check instead of duplicating the formula.
const CBD_CENTER_LAT = -1.2864;
const CBD_CENTER_LNG = 36.8172;
const CBD_RADIUS_KM = 1.5;
const EARTH_RADIUS_KM = 6371;

export function isWithinNairobiCbd(lat: number, lng: number): boolean {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const deltaLat = toRad(lat - CBD_CENTER_LAT);
  const deltaLng = toRad(lng - CBD_CENTER_LNG);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(CBD_CENTER_LAT)) * Math.cos(toRad(lat)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c <= CBD_RADIUS_KM;
}

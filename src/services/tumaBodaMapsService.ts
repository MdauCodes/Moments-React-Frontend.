import { apiFetch } from "@/config/api";

export interface AddressSuggestion {
  placeId: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  /** Only ever present for seeded-area fallback suggestions — TumaBoda-live predictions resolve
   *  county later, via place-details, after the customer picks one. */
  county: string | null;
}

export interface PlaceDetails {
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  name: string | null;
  /** Best-effort, backend-inferred (nearest seeded area) when TumaBoda's own response has none. */
  county: string | null;
}

export async function fetchAddressSuggestions(input: string): Promise<AddressSuggestion[]> {
  if (!input.trim()) return [];
  try {
    const res = await apiFetch(`/api/v1/public/tumaboda/maps/autocomplete?input=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const res = await apiFetch(`/api/v1/public/tumaboda/maps/place-details?placeId=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

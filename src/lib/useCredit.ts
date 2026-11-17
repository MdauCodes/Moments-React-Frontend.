// The restaurant's credit summary (doc 15 §19.4). "unavailable" until the store has credit (a 404 or
// 405 from an older store), so pages can say what will come instead of showing an error.
import { useCallback, useEffect, useState } from "react";

import { restaurantApi, RestaurantApiError, type CreditSummary } from "@/services/restaurantApi";

export function useCredit() {
  const [credit, setCredit] = useState<CreditSummary | null | "unavailable">(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setCredit(await restaurantApi.credit());
      setError(null);
    } catch (e) {
      if (e instanceof RestaurantApiError && (e.status === 404 || e.status === 405)) {
        setCredit("unavailable");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't load your credit.");
      }
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { credit, error, reload };
}

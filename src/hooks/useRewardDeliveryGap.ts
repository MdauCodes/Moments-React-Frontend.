import { useEffect, useState } from "react";
import { apiFetch } from "@/config/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { referralStore, type RewardsTier } from "@/services/referralStore";

export type RewardsTierRow = {
  tierName: string;
  minLifetimePoints: number;
  discountPercent: number;
};

export type RewardsProgressConfig = {
  pointsPer100Kes: number;
  tiers: RewardsTierRow[];
};

export type DeliveryThreshold = {
  minOrderAmount: number;
  zoneLabel: string;
};

/**
 * Shared source of truth for the "order KES X more to unlock Y" numbers
 * shown in RewardDeliveryBanners — reused by QuickAddProductStrip so the
 * quick-add ranking targets the exact same gap figures the customer sees.
 */
export function useRewardDeliveryGap() {
  const { cartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const [rewardsConfig, setRewardsConfig] = useState<RewardsProgressConfig | null>(null);
  const [deliveryThresholds, setDeliveryThresholds] = useState<DeliveryThreshold[]>([]);
  const [myTier, setMyTier] = useState<RewardsTier | null>(null);
  const [myLifetimePoints, setMyLifetimePoints] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/v1/referral/rewards-progress-config");
        if (res.ok) setRewardsConfig(await res.json());
      } catch { /* no config available */ }
      try {
        const res = await apiFetch("/api/v1/public/free-delivery-thresholds");
        if (res.ok) setDeliveryThresholds(await res.json());
      } catch { /* no thresholds available */ }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    referralStore.getMyTier().then(setMyTier).catch(() => {});
    referralStore.getWallet().then((w) => setMyLifetimePoints(w?.totalEarned ?? 0)).catch(() => {});
  }, [isAuthenticated]);

  let kesToNextTier: number | null = null;
  let nextTierName: string | null = null;
  let nextTierDiscountPercent: number | null = null;

  if (isAuthenticated && rewardsConfig && rewardsConfig.tiers.length > 0 && myLifetimePoints != null) {
    const pointsThisOrder = Math.floor(cartTotal / 100) * rewardsConfig.pointsPer100Kes;
    const projectedPoints = myLifetimePoints + pointsThisOrder;
    const nextTier = rewardsConfig.tiers
      .filter((t) => t.minLifetimePoints > projectedPoints)
      .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints)[0];
    if (nextTier) {
      const pointsNeeded = nextTier.minLifetimePoints - projectedPoints;
      kesToNextTier = Math.ceil((pointsNeeded / rewardsConfig.pointsPer100Kes) * 100);
      nextTierName = nextTier.tierName;
      nextTierDiscountPercent = nextTier.discountPercent;
    }
  }

  let kesToFreeDelivery: number | null = null;
  let freeDeliveryZoneLabel: string | null = null;
  let freeDeliveryUnlockedZoneLabel: string | null = null;

  if (deliveryThresholds.length > 0) {
    const sorted = [...deliveryThresholds].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
    const next = sorted.find((t) => t.minOrderAmount > cartTotal);
    if (next) {
      kesToFreeDelivery = Math.ceil(next.minOrderAmount - cartTotal);
      freeDeliveryZoneLabel = next.zoneLabel;
    } else {
      freeDeliveryUnlockedZoneLabel = sorted[sorted.length - 1].zoneLabel;
    }
  }

  return {
    isAuthenticated,
    rewardsConfig,
    deliveryThresholds,
    myTier,
    myLifetimePoints,
    kesToNextTier,
    nextTierName,
    nextTierDiscountPercent,
    kesToFreeDelivery,
    freeDeliveryZoneLabel,
    freeDeliveryUnlockedZoneLabel,
  };
}

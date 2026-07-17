import { useEffect, useState } from "react";
import { apiFetch } from "@/config/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { referralStore, type RewardsTier } from "@/services/referralStore";
import { businessAccountApi } from "@/services/businessAccountApi";

// Matches DiscountSettingsSeeder's default discounts.welcomeCodeMinOrderAmount, and the same
// figure already hardcoded in WelcomeCodeCard's copy — no public endpoint exposes this setting,
// so it's duplicated here rather than fetched.
const WELCOME_CODE_MIN_ORDER = 5000;

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
  const { isAuthenticated, user } = useAuth();
  const [rewardsConfig, setRewardsConfig] = useState<RewardsProgressConfig | null>(null);
  const [deliveryThresholds, setDeliveryThresholds] = useState<DeliveryThreshold[]>([]);
  const [myTier, setMyTier] = useState<RewardsTier | null>(null);
  const [myLifetimePoints, setMyLifetimePoints] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletBalanceValueKes, setWalletBalanceValueKes] = useState<number | null>(null);
  const [welcomeCode, setWelcomeCode] = useState<string | null>(null);

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
    referralStore.getWallet().then((w) => {
      setMyLifetimePoints(w?.totalEarned ?? 0);
      setWalletBalance(w?.balance ?? null);
      setWalletBalanceValueKes(w?.balanceValueKes ?? null);
    }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || user?.accountType !== "BUSINESS") return;
    businessAccountApi.getMine().then((a) => setWelcomeCode(a?.welcomeCode ?? null)).catch(() => {});
  }, [isAuthenticated, user?.accountType]);

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

  // How much more to cross into the next full KES-100 bracket, since points accrue in whole
  // 100s (Math.floor(total / 100) * pointsPer100Kes) — an order sitting just under a bracket is
  // one small top-up away from a whole extra reward.
  let kesToNextPointsBracket: number | null = null;
  if (isAuthenticated && rewardsConfig && rewardsConfig.pointsPer100Kes > 0 && cartTotal > 0) {
    const remainder = cartTotal % 100;
    if (remainder > 0) kesToNextPointsBracket = Math.ceil(100 - remainder);
  }

  // Business Account welcome code — 5% off once the order crosses the minimum, one-time use.
  let kesToWelcomeCode: number | null = null;
  let welcomeCodeReady = false;
  if (welcomeCode) {
    if (cartTotal < WELCOME_CODE_MIN_ORDER) kesToWelcomeCode = Math.ceil(WELCOME_CODE_MIN_ORDER - cartTotal);
    else welcomeCodeReady = true;
  }

  return {
    isAuthenticated,
    rewardsConfig,
    deliveryThresholds,
    myTier,
    myLifetimePoints,
    walletBalance,
    walletBalanceValueKes,
    kesToNextPointsBracket,
    welcomeCode,
    kesToWelcomeCode,
    welcomeCodeReady,
    kesToNextTier,
    nextTierName,
    nextTierDiscountPercent,
    kesToFreeDelivery,
    freeDeliveryZoneLabel,
    freeDeliveryUnlockedZoneLabel,
  };
}

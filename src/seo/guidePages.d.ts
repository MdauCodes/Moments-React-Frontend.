import type { FaqItem } from "./seoData";

export interface GuideSection {
  heading: string;
  paras?: string[];
  bullets?: string[];
}

export interface GuidePage {
  slug: string;
  path: string;
  kind: "suppliers" | "eco" | "custom";
  title: string;
  description: string;
  h1: string;
  answer: string;
  sections: GuideSection[];
  table?: { caption: string; head: string[]; rows: string[][] };
  faqs: FaqItem[];
  links: {
    shop?: string[];
    guides?: string[];
    industries?: boolean;
    extra?: [string, string][];
  };
}

export interface EcoGroup {
  key: string;
  heading: string;
  blurb: string;
  include: RegExp;
  exclude?: RegExp;
}

export interface GuideProductCard {
  slug: string;
  name: string;
  basePrice: number | null;
  unit: string;
  image: string | null;
  stockStatus: string | null;
}

export interface GuideData {
  hubs: { slug: string; name: string; count: number; from: string | null }[];
  eco: { key: string; products: GuideProductCard[] }[];
}

export declare const GUIDE_UPDATED: string;
export declare const GUIDE_DATA_PATH: string;
export declare const WHATSAPP_CUSTOM_MESSAGE: string;
export declare function whatsappCustomUrl(): string;
export declare const ECO_GROUPS: EcoGroup[];
export declare const GUIDE_PAGES: GuidePage[];
export declare const GUIDE_SLASHLESS_PATHS: string[];
export declare function findGuidePage(slug: string | undefined): GuidePage | null;
export declare function fromPriceText(
  products: { basePrice?: number | null; risellerUomName?: string | null }[],
): string | null;
export declare function buildGuideData(products: unknown[]): GuideData;

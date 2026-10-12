import type { FaqItem } from "./seoData";

export interface ShopPage {
  slug: string;
  category?: string;
  terms: string[];
  include: RegExp;
  exclude?: RegExp;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  faqs: FaqItem[];
  related: string[];
}

export interface IndustryPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  shop: string[];
}

export declare const SHOP_PAGES: ShopPage[];
export declare const INDUSTRY_PAGES: IndustryPage[];
export declare function shopPath(slug: string): string;
export declare function industryPath(slug: string): string;
export declare function findShopPage(slug: string | undefined): ShopPage | null;
export declare function findIndustryPage(slug: string | undefined): IndustryPage | null;
export declare function shopPageIncludes(
  page: ShopPage,
  product: { name?: string | null },
): boolean;
export declare function shopPagesForProduct(product: { name?: string | null }): ShopPage[];
export declare function landingFaqs(page: ShopPage, fromPrice: string | null): FaqItem[];

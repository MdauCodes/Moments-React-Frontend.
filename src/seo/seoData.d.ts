// Types for seoData.js (plain JS so the Node prerender script can import it too).

export interface StaticPageSeo {
  title: string;
  description: string;
  h1: string;
  intro: string[];
}

export interface ProductSeoInput {
  name?: string | null;
  description?: string | null;
  basePrice?: number | null;
  risellerUomName?: string | null;
}

export declare const SITE_ORIGIN: string;
export declare function productPath(slug: string): string;
export declare function blogPath(slug: string): string;
export declare const SITE_NAME: string;
export declare const BUSINESS: {
  legalName: string;
  streetAddress: string;
  locality: string;
  city: string;
  country: string;
  phoneDisplay: string;
  phoneIntl: string;
  whatsappUrl: string;
  email: string;
  hoursText: string;
};
export declare const DEFAULT_SEO: { title: string; description: string };
export declare const STATIC_PAGES: Record<string, StaticPageSeo>;

export declare function displayProductName(name?: string | null): string;
export declare function cleanProductDescription(description?: string | null): string;
export declare function formatKes(amount: number | string | null | undefined): string;
export declare function priceUnitLabel(
  product?: { risellerUomName?: string | null } | null,
): string;
export declare function productSeo(product: ProductSeoInput | null | undefined): {
  title: string;
  description: string;
  name: string;
};

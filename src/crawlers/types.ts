export interface ProductPriceInfo {
  current: number;
  original?: number;
  currency?: string;
}

export interface ProductFeature {
  heading: string;
  body: string;
  benefit?: string;
  evidence?: string;
}

export interface ProductReviewSnippet {
  quote: string;
  rating?: number;
  source?: string;
}

export interface ProductDetailSnapshot {
  title: string;
  description?: string;
  price?: ProductPriceInfo;
  features: ProductFeature[];
  specs: Record<string, string>;
  reviews: ProductReviewSnippet[];
  images: string[];
  officialUrl?: string;
  sourceDomain: string;
  capturedAt: string;
  rawUrl: string;
  delivery?: string;
  seller?: string;
  rating?: number;
  reviewCount?: number;
  discount?: string;
  categories?: string[];
}














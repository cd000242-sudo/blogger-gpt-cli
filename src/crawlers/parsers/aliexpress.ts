import * as cheerio from 'cheerio';
import { ProductDetailSnapshot, ProductFeature, ProductReviewSnippet, ProductPriceInfo } from '../types';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElement = cheerio.Element;

export function parseAliExpress(html: string, pageUrl: string): ProductDetailSnapshot {
  const runParams = extractRunParams(html);
  const $ = cheerio.load(html);

  const title =
    runParams?.titleModule?.subject ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    '제목 없음';

  const description =
    runParams?.descriptionModule?.description ||
    $('meta[name="description"]').attr('content') ||
    undefined;

  const price = extractPrice(runParams);
  const specs = extractSpecs(runParams);
  const features = extractFeatures(runParams, specs);
  const reviews = extractReviews(runParams);
  const images = extractImages(runParams, pageUrl, $);
  const officialUrl =
    runParams?.productModule?.productUrl ||
    $('link[rel="canonical"]').attr('href') ||
    pageUrl;

  const snapshot: ProductDetailSnapshot = {
    title,
    features,
    specs,
    reviews,
    images,
    officialUrl,
    sourceDomain: safeHostname(pageUrl),
    capturedAt: new Date().toISOString(),
    rawUrl: pageUrl
  };

  if (description) {
    snapshot.description = description;
  }
  if (price) {
    snapshot.price = price;
  }

  return snapshot;
}

function extractRunParams(html: string): any | null {
  const match = html.match(/window\.runParams\s*=\s*({.+?});\s*<\/script>/s);
  if (!match) return null;
  const payload = match[1];
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function extractPrice(runParams: any): ProductPriceInfo | undefined {
  if (!runParams?.priceModule) return undefined;

  const module = runParams.priceModule;
  const currency = module.minSalePrice?.currency || module.originalPrice?.currency || 'USD';
  const current = normalizeNumber(module.minSalePrice?.value ?? module.minSalePrice);
  const original = normalizeNumber(module.originalPrice?.value ?? module.originalPrice);

  if (!current) return undefined;
  const priceInfo: ProductPriceInfo = {
    current,
    currency
  };
  if (original && original > current) {
    priceInfo.original = original;
  }
  return priceInfo;
}

function extractSpecs(runParams: any): Record<string, string> {
  const specs: Record<string, string> = {};

  const props = runParams?.specsModule?.props || runParams?.specsModule?.specs;
  if (Array.isArray(props)) {
    props.forEach((spec: any) => {
      const key = spec.attrName || spec.attrNameLocal;
      const value = spec.attrValue || spec.attrValueLocal;
      if (key && value) {
        specs[key.trim()] = Array.isArray(value) ? value.join(', ') : String(value).trim();
      }
    });
  }

  const attrList = runParams?.specsModule?.productPropInfoList;
  if (Array.isArray(attrList)) {
    attrList.forEach((item: any) => {
      const key = item.attrName || item.attrNameLocal;
      const value = item.attrValue || item.attrValueLocal;
      if (key && value) {
        specs[key.trim()] = Array.isArray(value) ? value.join(', ') : String(value).trim();
      }
    });
  }

  return specs;
}

function extractFeatures(runParams: any, specs: Record<string, string>): ProductFeature[] {
  const features: ProductFeature[] = [];

  const subject = runParams?.titleModule?.subject;
  if (typeof subject === 'string' && subject.trim().length > 0) {
    subject
      .split(/[·\|]/)
      .map((item: string) => item.trim())
      .filter(Boolean)
      .slice(0, 3)
      .forEach((title: string) => {
      const feature: ProductFeature = {
        heading: title,
        body: title
      };
      const benefit = inferBenefit(title);
      if (benefit) {
        feature.benefit = benefit;
      }
      features.push(feature);
      });
  }

  const sellingPoints = runParams?.descriptionModule?.bulletPoints;
  if (Array.isArray(sellingPoints)) {
    sellingPoints.filter(Boolean).slice(0, 5).forEach((text: string) => {
      const feature: ProductFeature = {
        heading: text.slice(0, 40),
        body: text
      };
      const benefit = inferBenefit(text);
      if (benefit) {
        feature.benefit = benefit;
      }
      features.push(feature);
    });
  }

  // 스펙에서 중요한 항목 추려서 특징으로 승격
  const importantSpecs = ['Material', 'Power', 'Capacity', 'Battery', 'Dimensions'];
  importantSpecs.forEach((key) => {
    const matchingKey = Object.keys(specs).find((k) => k.toLowerCase().includes(key.toLowerCase()));
    if (matchingKey) {
      const value = specs[matchingKey];
      const feature: ProductFeature = {
        heading: `${matchingKey}`,
        body: `${matchingKey}: ${value}`
      };
      const benefit = inferBenefit(value);
      if (benefit) {
        feature.benefit = benefit;
      }
      features.push(feature);
    }
  });

  return dedupeFeatures(features).slice(0, 10);
}

function inferBenefit(text?: string) {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (/(portable|compact|lightweight|휴대)/i.test(lower)) return '휴대성';
  if (/(powerful|strong|강력|고출력)/i.test(lower)) return '성능 강조';
  if (/(comfortable|ergonomic|편안|인체공학)/i.test(lower)) return '사용 편의성';
  if (/(durable|stainless|내구)/i.test(lower)) return '내구성';
  if (/(quiet|silent|저소음)/i.test(lower)) return '저소음';
  return undefined;
}

function dedupeFeatures(features: ProductFeature[]): ProductFeature[] {
  const seen = new Set<string>();
  return features.filter((feature) => {
    const key = `${feature.heading}|${feature.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(feature.body);
  });
}

function extractReviews(runParams: any): ProductReviewSnippet[] {
  const reviews: ProductReviewSnippet[] = [];

  const feedbackList = runParams?.feedbackModule?.feedBackList;
  if (Array.isArray(feedbackList)) {
    feedbackList.slice(0, 5).forEach((item: any) => {
      const quote = item.comments?.[0]?.buyerReview || item.simpleSkuReview || item.feedbackDate;
      if (!quote) return;
      const rating = normalizeNumber(item.reviewStar);
      const review: ProductReviewSnippet = {
        quote: quote.trim(),
        source: 'AliExpress'
      };
      if (typeof rating === 'number' && !Number.isNaN(rating)) {
        review.rating = rating;
      }
      reviews.push(review);
    });
  }

  return reviews;
}

function extractImages(runParams: any, pageUrl: string, $: CheerioRoot): string[] {
  const urls = new Set<string>();

  const imageModule = runParams?.imageModule;
  if (imageModule?.imagePathList) {
    imageModule.imagePathList.forEach((item: string) => {
      try {
        urls.add(new URL(item, pageUrl).toString());
      } catch {
        // ignore
      }
    });
  }

  $('img').each((_idx: number, el: CheerioElement) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!src) return;
    if (!/\.(jpe?g|png|webp)$/i.test(src)) return;
    try {
      urls.add(new URL(src, pageUrl).toString());
    } catch {
      // ignore
    }
  });

  return Array.from(urls);
}

function normalizeNumber(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    if (digits) {
      const parsed = parseFloat(digits);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }
  return undefined;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown-host';
  }
}


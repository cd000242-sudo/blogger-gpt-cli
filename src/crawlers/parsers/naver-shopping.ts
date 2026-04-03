import * as cheerio from 'cheerio';
import { ProductDetailSnapshot, ProductFeature, ProductReviewSnippet, ProductPriceInfo } from '../types';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElement = cheerio.Element;

export function parseNaverShoppingConnect(html: string, pageUrl: string): ProductDetailSnapshot {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h2[class*="ProductTitle"], h1[class*="ProductTitle"]').first().text().trim() ||
    $('title').text().trim() ||
    '제목 없음';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('.product_summary, .summary_text').first().text().trim() ||
    undefined;

  const price = extractPrice($);

  const features = extractFeatures($);
  const specs = extractSpecs($);
  const reviews = extractReviews($);
  const images = extractImages($, pageUrl);

  const officialUrl =
    $('a[data-nclick*="prd.buy"], a[data-event="purchase"]').attr('href') ||
    $('link[rel="canonical"]').attr('href') ||
    pageUrl;

  const snapshot: ProductDetailSnapshot = {
    title,
    features,
    specs,
    reviews,
    images,
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
  if (officialUrl) {
    snapshot.officialUrl = officialUrl;
  }

  return snapshot;
}

function extractPrice($: CheerioRoot): ProductPriceInfo | undefined {
  const priceCandidates = [
    $('.price_num .num').first().text(),
    $('.price_now, .price_current').first().text(),
    $('meta[property="product:price:amount"]').attr('content')
  ];

  for (const candidate of priceCandidates) {
    const digits = (candidate || '').replace(/[^0-9]/g, '');
    if (digits) {
      return {
        current: Number(digits),
        currency: inferCurrency($)
      };
    }
  }
  return undefined;
}

function inferCurrency($: CheerioRoot) {
  const currency =
    $('meta[property="product:price:currency"]').attr('content') ||
    $('span[class*="currency"]').first().text().trim();
  if (!currency) return 'KRW';
  if (/원|KRW/i.test(currency)) return 'KRW';
  if (/USD/i.test(currency)) return 'USD';
  return currency;
}

function extractFeatures($: CheerioRoot): ProductFeature[] {
  const features: ProductFeature[] = [];

  $('.feature_list li, .product_feature li').each((_idx: number, el: CheerioElement) => {
    const heading =
      $(el).find('.feature_title, .feature-name').text().trim() ||
      $(el).find('strong').first().text().trim();
    const body =
      $(el).find('.feature_desc, .feature-description').text().trim() ||
      $(el).text().trim();

    if (!heading && !body) return;
    const feature: ProductFeature = {
      heading: heading || body?.slice(0, 32) || '특징',
      body
    };
    const benefit = inferBenefit(body);
    if (benefit) {
      feature.benefit = benefit;
    }
    features.push(feature);
  });

  if (!features.length) {
    $('.product_detail_box h4').each((_idx: number, el: CheerioElement) => {
      const heading = $(el).text().trim();
      const body = $(el).nextUntil('h4').text().trim();
      if (heading || body) {
        const feature: ProductFeature = {
          heading: heading || '상세 설명',
          body
        };
        const benefit = inferBenefit(body);
        if (benefit) {
          feature.benefit = benefit;
        }
        features.push(feature);
      }
    });
  }

  return features.slice(0, 10);
}

function inferBenefit(body?: string) {
  if (!body) return undefined;
  const phrases = [
    { test: /(강력|고성능|파워)/, label: '성능 강조' },
    { test: /(컴팩트|슬림|휴대)/, label: '휴대성' },
    { test: /(조용|저소음)/, label: '저소음' },
    { test: /(내구|튼튼|고급)/, label: '내구성' },
    { test: /(간편|쉬운|원터치)/, label: '사용 편의성' }
  ];

  const matched = phrases.find((item) => item.test.test(body));
  return matched?.label;
}

function extractSpecs($: CheerioRoot): Record<string, string> {
  const specs: Record<string, string> = {};

  $('.spec_table tr, table[class*="spec"] tr').each((_idx: number, el: CheerioElement) => {
    const key = $(el).find('th, .spec_name').text().trim();
    const value = $(el).find('td, .spec_desc').text().trim();
    if (key && value) {
      specs[key] = value;
    }
  });

  if (!Object.keys(specs).length) {
    // fallback: definition list
    $('.spec_list dt').each((_idx: number, el: CheerioElement) => {
      const key = $(el).text().trim();
      const value = $(el).next('dd').text().trim();
      if (key && value) {
        specs[key] = value;
      }
    });
  }

  return specs;
}

function extractReviews($: CheerioRoot): ProductReviewSnippet[] {
  const reviews: ProductReviewSnippet[] = [];

  $('.review_card, .review_list .item').each((_idx: number, el: CheerioElement) => {
    const quote =
      $(el).find('.review_text, .text').text().trim() ||
      $(el).find('p').first().text().trim();
    if (!quote) return;

    const ratingText =
      $(el).find('.review_rating, .star_score .score').text().trim() ||
      $(el).find('[class*="rating"]').attr('data-rating') ||
      '';
    const ratingValue = parseFloat(ratingText.replace(/[^0-9.]/g, ''));
    const review: ProductReviewSnippet = {
      quote,
      source: '네이버 쇼핑'
    };
    if (!Number.isNaN(ratingValue)) {
      review.rating = ratingValue;
    }

    reviews.push(review);
  });

  return reviews.slice(0, 5);
}

function extractImages($: CheerioRoot, pageUrl: string): string[] {
  const host = safeHostname(pageUrl);
  const trimmedHost = host.replace(/^www\./, '');
  const images = new Set<string>();

  $('img').each((_idx: number, el: CheerioElement) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || '';
    if (!src) return;
    if (!/\.(jpe?g|png|webp|gif)$/i.test(src)) return;
    if (src.includes('sprite') || src.includes('icon')) return;

    images.add(new URL(src, pageUrl).toString());
  });

  // 일부 페이지는 background-image로 썸네일 제공
  $('[style*="background-image"]').each((_idx: number, el: CheerioElement) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/url\(["']?(.*?)["']?\)/);
    if (match?.[1]) {
      const url = new URL(match[1], pageUrl).toString();
      images.add(url);
    }
  });

  // 네이버 쇼핑 CDN 의심 시 호스트 검증 (안정성을 위해)
  return Array.from(images).filter((img) => {
    try {
      const url = new URL(img);
      const candidate = url.hostname.replace(/^www\./, '');
      return candidate === trimmedHost || candidate.endsWith(`.${trimmedHost}`) || candidate.includes('naver');
    } catch {
      return false;
    }
  });
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown-host';
  }
}


/**
 * 크롤러 파서 공통 유틸리티
 * 모든 쇼핑몰 파서에서 반복되는 로직을 중앙화
 */
import * as cheerio from 'cheerio';
import { ProductDetailSnapshot } from '../types';

export type CheerioRoot = ReturnType<typeof cheerio.load>;
export type CheerioElement = cheerio.Element;

/**
 * URL에서 hostname 안전 추출
 */
export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 가격 문자열에서 숫자 추출
 * "₩15,900" → 15900, "$29.99" → 29.99
 */
export function parsePrice(text: string): number {
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * JSON-LD (@type: Product) 추출
 */
export function extractJsonLdProduct($: CheerioRoot): any | null {
  try {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      const text = $(scripts[i]).html();
      if (!text) continue;
      const data = JSON.parse(text);
      // 배열인 경우
      if (Array.isArray(data)) {
        const product = data.find((d: any) => d['@type'] === 'Product');
        if (product) return product;
      }
      if (data['@type'] === 'Product') return data;
      // @graph 안에 있는 경우
      if (data['@graph']) {
        const product = data['@graph'].find((d: any) => d['@type'] === 'Product');
        if (product) return product;
      }
    }
  } catch {}
  return null;
}

/**
 * Open Graph meta 태그에서 값 추출
 */
export function getOgMeta($: CheerioRoot, property: string): string | undefined {
  return $(`meta[property="og:${property}"]`).attr('content')?.trim() || undefined;
}

/**
 * 기본 snapshot 골격 생성
 */
export function createBaseSnapshot(
  pageUrl: string,
  overrides: Partial<ProductDetailSnapshot>
): ProductDetailSnapshot {
  return {
    title: '제목 없음',
    features: [],
    specs: {},
    reviews: [],
    images: [],
    sourceDomain: safeHostname(pageUrl),
    capturedAt: new Date().toISOString(),
    rawUrl: pageUrl,
    ...overrides,
  };
}

/**
 * 이미지 URL을 절대 경로로 변환
 */
export function resolveImageUrl(src: string, pageUrl: string): string {
  if (!src) return '';
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('http')) return src;
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return src;
  }
}

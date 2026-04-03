import * as cheerio from 'cheerio';
import { fetchPage, CrawlOptions, CrawlResult } from './playwright-runner';
import { ProductDetailSnapshot } from './types';
import { parseNaverShoppingConnect } from './parsers/naver-shopping';
import { parseAliExpress } from './parsers/aliexpress';
import { parseCoupang } from './parsers/coupang';
import { parseGmarketAuction } from './parsers/gmarket-auction';
import { parse11st } from './parsers/11st';
import { parseTemu } from './parsers/temu';

type ParserFn = (html: string, url: string) => ProductDetailSnapshot;

interface ProductParser {
  id: string;
  match: (hostname: string) => boolean;
  parse: ParserFn;
}

const registeredParsers: ProductParser[] = [];

export interface CrawlSnapshotOptions extends CrawlOptions {
  forceParserId?: string;
}

export async function crawlProductSnapshot(url: string, options: CrawlSnapshotOptions = {}) {
  const parser = resolveParser(url, options.forceParserId);
  if (!parser) {
    throw new Error('지원되지 않는 상세페이지 도메인입니다.');
  }

  const crawlResult: CrawlResult = await fetchPage(url, options);
  const snapshot = parser.parse(crawlResult.html, url);
  return { snapshot, crawlResult };
}

export function registerProductParser(parser: ProductParser) {
  const existingIndex = registeredParsers.findIndex((item) => item.id === parser.id);
  if (existingIndex >= 0) {
    registeredParsers.splice(existingIndex, 1, parser);
  } else {
    registeredParsers.push(parser);
  }
}

function resolveParser(url: string, forcedId?: string): ProductParser | null {
  const hostname = safeHostname(url);

  if (forcedId) {
    const parser = registeredParsers.find((item) => item.id === forcedId);
    return parser ?? null;
  }

  const matched =
    registeredParsers.find((parser) => parser.match(hostname)) ?? registeredParsers.find((p) => p.id === 'generic');

  return matched ?? null;
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

// ── Default parsers ──

registerProductParser({
  id: 'naver-shopping-connect',
  match: (hostname) => /naver\.com$/i.test(hostname) && hostname.includes('shopping'),
  parse: parseNaverShoppingConnect
});

registerProductParser({
  id: 'aliexpress',
  match: (hostname) => /aliexpress\./i.test(hostname) || /ali(cd)?n/i.test(hostname),
  parse: parseAliExpress
});

registerProductParser({
  id: 'coupang',
  match: (hostname) => /coupang\.com$/i.test(hostname),
  parse: parseCoupang
});

registerProductParser({
  id: 'gmarket-auction',
  match: (hostname) => /gmarket\.co\.kr$/i.test(hostname) || /auction\.co\.kr$/i.test(hostname),
  parse: parseGmarketAuction
});

registerProductParser({
  id: '11st',
  match: (hostname) => /11st\.co\.kr$/i.test(hostname),
  parse: parse11st
});

registerProductParser({
  id: 'temu',
  match: (hostname) => /temu\.com$/i.test(hostname),
  parse: parseTemu
});

registerProductParser({
  id: 'generic',
  match: () => true,
  parse: parseGenericProductDetail
});

function parseGenericProductDetail(html: string, pageUrl: string): ProductDetailSnapshot {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1, h2').first().text().trim() ||
    $('title').text().trim() ||
    '제목 없음';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('p').first().text().trim() ||
    undefined;

  const images: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (!src) return;
    if (!/\.(jpe?g|png|webp)$/i.test(src)) return;
    try {
      images.push(new URL(src, pageUrl).toString());
    } catch {
      // ignore
    }
  });

  const snapshot: ProductDetailSnapshot = {
    title,
    features: [],
    specs: {},
    reviews: [],
    images,
    officialUrl: $('link[rel="canonical"]').attr('href') || pageUrl,
    sourceDomain: safeHostname(pageUrl) || 'unknown-host',
    capturedAt: new Date().toISOString(),
    rawUrl: pageUrl
  };

  if (description) {
    snapshot.description = description;
  }

  return snapshot;
}


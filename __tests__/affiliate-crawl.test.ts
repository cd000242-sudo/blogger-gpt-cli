/**
 * 제휴 링크 크롤 어댑터 테스트 (v3.8.395)
 *
 * ── Phase 0 실측 근거 (2026-08-01, 사용자 실제 링크) ──
 *   토스   toss.im/_m/{code} --302--> toss.shopping/t/{id}?k={uuid}&referrer=affiliate
 *          정적 og 메타로 충분(0.6초). **가격은 정적·렌더 모두 없음** → null 유지, 추정 금지.
 *   네이버 naver.me/{code} --307--> brandconnect(빈 셸) --JS--> smartstore/{store}/products/{no}
 *          Playwright 필수(10.3초). 스토어명은 렌더 전엔 알 수 없다.
 *
 * ⚠️ 절대 어기면 안 되는 것
 *   1. 본문 링크는 **사용자가 준 원본** — 토스 정책상 링크 변조는 계약 해지 사유
 *   2. 가격은 확인된 것만 — 모르면 null (이번 세션 내내 지킨 "지어내지 않는다" 원칙)
 *   3. 크롤 실패가 발행을 막지 않는다
 */
import {
  crawlAffiliateLink, crawlAffiliateLinks, readMeta, extractPriceKrw, decodeEntities,
  isSupportedForCrawl,
} from '../src/core/affiliate/crawl';
import { braceBlock } from './helpers/source-block';

const TOSS_SHORT = 'https://toss.im/_m/bMxjrwji';
const TOSS_FINAL = 'https://toss.shopping/t/2526906561?k=7ab0e43f-e76f-419f-a094-864e77987e69&referrer=affiliate';

/** 실측한 토스 응답을 그대로 모사 */
const tossHtml = `<html><head>
<meta property="og:title" content="몽크로스 초강력 바디팬, 다크그레이, 2개 | 토스쇼핑">
<meta property="og:image" content="https://shopping.toss.im/2ce/live/product/785194323/2cef21">
<meta property="og:description" content="몽크로스 초강력 바디팬, 다크그레이, 2개, 8월 5일 도착 예정. 베스트 판매자">
</head><body></body></html>`;

const mockFetch = (html: string, finalUrl = TOSS_FINAL) => (async () => ({
  ok: true, status: 200, url: finalUrl, text: async () => html,
})) as any;

describe('HTML 엔티티 디코딩 (실측 버그)', () => {
  it('숫자 엔티티를 되돌린다 — 네이버가 "&#40;주&#41;" 로 보냈다', () => {
    expect(decodeEntities('&#40;주&#41;쇼마젠시')).toBe('(주)쇼마젠시');
  });

  it('&amp; 를 마지막에 풀어 이중 디코딩을 막는다', () => {
    expect(decodeEntities('A&amp;lt;B')).toBe('A&lt;B');
  });

  it('16진 엔티티와 따옴표도 처리한다', () => {
    expect(decodeEntities('&#x41;&quot;B&quot;')).toBe('A"B"');
  });

  it('빈 입력에 안전하다', () => {
    expect(decodeEntities('')).toBe('');
    expect(decodeEntities(null as any)).toBe('');
  });
});

describe('메타 추출', () => {
  it('og 메타를 읽고 엔티티까지 푼다', () => {
    expect(readMeta(tossHtml, 'og:title')).toContain('몽크로스 초강력 바디팬');
    expect(readMeta('<meta property="og:title" content="&#40;주&#41;A">', 'og:title')).toBe('(주)A');
  });

  it('없으면 빈 문자열', () => {
    expect(readMeta('<html></html>', 'og:title')).toBe('');
  });

  it('속성 순서가 뒤바뀌어도 읽는다', () => {
    expect(readMeta('<meta content="X" property="og:title">', 'og:title')).toBe('X');
  });
});

describe('가격 추출 — 확신 없으면 null', () => {
  it('첫 번째 원화 금액을 쓴다 (판매가가 앞에 온다)', () => {
    expect(extractPriceKrw('할인 전 3,152,600원 할인가 2,841,800원')).toBe(3152600);
  });

  it('금액이 없으면 null — 추정하지 않는다', () => {
    expect(extractPriceKrw('가격 문의')).toBeNull();
    expect(extractPriceKrw('')).toBeNull();
  });

  it('너무 작은 값은 가격으로 보지 않는다', () => {
    expect(extractPriceKrw('12원')).toBeNull();
  });
});

describe('토스 — 정적 크롤 (Playwright 불필요)', () => {
  it('상품명에서 "| 토스쇼핑" 꼬리를 뗀다', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch(tossHtml) });
    expect(p?.title).toBe('몽크로스 초강력 바디팬, 다크그레이, 2개');
  });

  it('이미지와 설명을 가져온다', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch(tossHtml) });
    expect(p?.imageUrl).toContain('shopping.toss.im');
    expect(p?.description).toContain('8월 5일 도착 예정');
  });

  it('⭐ 가격은 null 이다 — 토스는 웹에 가격을 노출하지 않는다(실측)', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch(tossHtml) });
    expect(p?.priceKrw).toBeNull();
    expect(p?.priceNote).toContain('가격을 노출하지 않습니다');
  });

  it('⭐ 원본 URL 을 그대로 보존한다 — 변조는 계약 해지 사유', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch(tossHtml) });
    expect(p?.originalUrl).toBe(TOSS_SHORT);
  });

  it('최종 URL 은 따로 보관한다 (본문에는 쓰지 않는다)', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch(tossHtml) });
    expect(p?.resolvedUrl).toBe(TOSS_FINAL);
    expect(p?.resolvedUrl).not.toBe(p?.originalUrl);
  });

  it('상품명을 못 얻으면 null — 링크만 쓰게 한다', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, { fetchImpl: mockFetch('<html></html>') });
    expect(p).toBeNull();
  });
});

describe('실패가 발행을 막지 않는다', () => {
  it('네트워크가 죽어도 throw 하지 않는다', async () => {
    const p = await crawlAffiliateLink(TOSS_SHORT, {
      fetchImpl: (() => Promise.reject(new Error('ECONNRESET'))) as any,
    });
    expect(p).toBeNull();
  });

  it('지원하지 않는 링크는 조용히 건너뛴다', async () => {
    expect(await crawlAffiliateLink('https://example.com/p/1')).toBeNull();
  });

  it('URL 이 아니면 즉시 null', async () => {
    expect(await crawlAffiliateLink('그냥 텍스트')).toBeNull();
    expect(await crawlAffiliateLink('')).toBeNull();
  });

  it('여러 링크 중 하나가 실패해도 나머지는 살린다', async () => {
    let n = 0;
    const flaky = (async () => {
      n += 1;
      if (n === 1) throw new Error('첫 링크 실패');
      return { ok: true, status: 200, url: TOSS_FINAL, text: async () => tossHtml };
    }) as any;
    const list = await crawlAffiliateLinks([TOSS_SHORT, TOSS_SHORT], { fetchImpl: flaky, concurrency: 1 });
    expect(list).toHaveLength(1);
  });

  it('빈 목록에 안전하다', async () => {
    expect(await crawlAffiliateLinks([])).toEqual([]);
    expect(await crawlAffiliateLinks(null as any)).toEqual([]);
  });
});

describe('병렬 처리 — 네이버가 링크당 10초라 순차는 불가', () => {
  it('동시 실행 수에 상한이 있다 (브라우저 인스턴스 폭증 방지)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
    expect(src).toContain('Math.min(opts.concurrency ?? 3, 5)');
  });

  it('crawlAffiliateLinks 가 Promise.allSettled 로 묶는다', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
    expect(src).toContain('Promise.allSettled');
  });
});

describe('제휴사 판정', () => {
  // v3.8.398: 쿠팡도 대상에 포함됐다.
  //   사용자가 제휴 링크 칸에 실제로 쿠팡 링크를 붙여넣었는데 조용히 무시됐다.
  //   단, 상품 크롤 자체는 기존 coupang-partners.ts 에 위임한다(중복 구현 안 함).
  it('토스·네이버·쿠팡이 모두 크롤 대상이다', () => {
    expect(isSupportedForCrawl('toss-sharelink')).toBe(true);
    expect(isSupportedForCrawl('naver-shopping-connect')).toBe(true);
    expect(isSupportedForCrawl('coupang')).toBe(true);
  });
});

describe('네이버 경로 — Playwright 필수 근거가 코드에 남아있다', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');

  it('브리지가 빈 셸이라 렌더가 필요하다는 실측이 기록돼 있다', () => {
    expect(src).toContain('Playwright 필수');
    expect(src).toContain('스토어명');
  });

  it('브라우저를 반드시 닫는다 (finally)', () => {
    const i = src.indexOf('async function crawlNaver');
    const block = braceBlock(src, 'async function crawlNaver');
    expect(block).toContain('finally');
    expect(block).toContain('browser.close()');
  });

  /**
   * v3.8.444 에 데스크톱으로 바꿨다.
   *   실측: 대표 갤러리 앵커 img[alt^="추가이미지"] 가
   *         모바일 390px → 0개 / 데스크톱 1440px → 10개.
   * 예전 "모바일 전제"는 리다이렉트 얘기였고, 데스크톱에서도 브리지는 정상이며
   * 가격·제목·상세·후기 모두 확인했다.
   */
  it('데스크톱 뷰포트를 쓴다 — 대표 갤러리가 데스크톱 마크업에만 나온다', () => {
    expect(src).toContain('viewport: { width: 1440, height: 900 }');
    expect(src).toContain('img[alt^="추가이미지"]');
  });
});

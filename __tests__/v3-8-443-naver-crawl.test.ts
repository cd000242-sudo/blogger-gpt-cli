/**
 * v3.8.443 — 네이버 브랜드 커넥트 실측 진단 (2026-08-04, naver.me/xiLWsfo5)
 *
 * 사용자 요청으로 실제 링크를 돌려 본 결과, 네이버는 **상세 이미지 0장 · 후기 0건**
 * 이었다. 상품명과 가격(859,000원)만 정상이었다. 원인 두 가지:
 *
 *   ① 상세 이미지 — .se-main-container img 노드는 31개 있는데 src 가 0개였다.
 *      셀렉터는 처음부터 맞았고, 문제는 (a) 지연 로딩이라 스크롤 전에는 주소가
 *      안 붙고 (b) "상세정보 펼쳐보기"로 접혀 있어 스크롤해도 안 열린다는 것.
 *        스크롤만        → 31개 중 3개
 *        펼치기 + 스크롤 → 31개 중 31개
 *   ② 후기 — 스마트스토어 JSON-LD 에는 review 도 aggregateRating 도 없다
 *      (실측 len 607, review:false, agg:false). 토스와 구조가 다르다.
 *      그래서 extractSchemaReviews 로는 영원히 0건이었다.
 *
 * 수정 후 실측: 상세 이미지 15장 · 후기 3건(전체 10건) 확보.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const crawl = fs.readFileSync(path.join(__dirname, '..', 'src/core/affiliate/crawl.ts'), 'utf-8');
const naver = blockBetween(crawl, 'async function crawlNaver(', '\n/**\n * 쿠팡 —');

describe('① 상세 이미지 — 펼치기 + 스크롤이 있어야 로드된다', () => {
  it('⭐⭐ "상세정보 펼쳐보기"를 누른다 (안 누르면 31장 중 3장만 뜬다)', () => {
    expect(naver).toContain('상세정보 펼쳐보기');
    expect(naver).toContain('.click(');
  });

  it('⭐ 버튼 문구가 다른 경우도 대비한다', () => {
    expect(naver).toContain('상품정보 펼쳐보기');
  });

  it('⭐⭐ 지연 로딩을 깨우려 스크롤한다 (시간 대기로는 안 열린다)', () => {
    expect(naver).toContain('window.scrollBy(');
    expect(naver).toContain('.se-main-container img');
  });

  it('⭐ 다 로드되면 일찍 끊는다 (무한 스크롤로 시간 낭비하지 않게)', () => {
    expect(naver).toContain('atBottom');
    expect(naver).toContain('if (same >= 3) break;');
  });

  it('⭐ 펼치기·스크롤이 실패해도 수집은 계속된다 (발행을 막지 않는다)', () => {
    // 이 앱의 원칙 — 크롤 실패가 발행을 막으면 안 된다
    expect(naver).toContain('버튼이 없거나 못 눌러도');
    expect(naver).toContain('스크롤에 실패해도');
  });
});

describe('② 후기 — JSON-LD 가 비므로 DOM 에서 긁는다', () => {
  it('⭐⭐ JSON-LD 가 0건이면 DOM 후기로 채운다', () => {
    expect(crawl).toContain('schema.reviews.length === 0 && Array.isArray((info as any).reviews)');
  });

  it('⭐⭐ 난독화된 클래스명에 의존하지 않는다 (며칠이면 깨진다)', () => {
    // 실측한 클래스명(JnLwAJPsMs 등)을 하드코딩하면 안 된다
    expect(naver).not.toMatch(/JnLwAJPsMs|zaRgVeW3tC|o97Gq32ql5/);
    // 대신 구조로 찾는다 — 구매자 리뷰 사진 도메인을 앵커로
    expect(naver).toContain('checkout.phinf');
  });

  it('⭐ 사진이 없는 상품이면 제목을 앵커로 쓴다', () => {
    expect(naver).toContain('리뷰|구매평');
  });

  it('⭐ UI 문구(배송·쿠폰·가격)를 후기로 착각하지 않는다', () => {
    expect(naver).toContain('무료배송');
    expect(naver).toContain('장바구니');
  });

  it('⭐ 전체 후기 건수를 읽어 본문이 규모를 말할 수 있게 한다', () => {
    expect(naver).toContain('reviewTotal');
    expect(naver).toContain('리뷰\\s*([\\d,]{1,12})');
  });

  it('⭐ 건수를 못 읽으면 0 — 지어내지 않는다', () => {
    expect(naver).toContain('let reviewTotal = 0;');
    expect(naver).toContain('total > 0 ?');
  });
});

describe('③ 토스 경로를 건드리지 않았다', () => {
  it('⭐ 토스는 여전히 정적 fetch 다 (Playwright 로 바꾸면 20배 느려진다)', () => {
    expect(crawl).toContain('/** 토스 — 정적 fetch 로 충분하다 (실측 확인) */');
  });

  it('⭐ 토스의 스트리밍 청크 해제는 그대로 살아 있다', () => {
    expect(crawl).toContain('export function unescapeStreamedHtml');
    expect(crawl).toContain('const sellerImages = extractDetailImageUrls(html, ogImage);');
  });
});

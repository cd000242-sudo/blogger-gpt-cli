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

/**
 * v3.8.444 — 사용자가 DOM 스니펫으로 위치를 특정해 준 두 영역.
 *   대표 갤러리: <img alt="추가이미지0" src="…?type=f40">
 *   포토리뷰   : <a data-shp-contents-type="review" data-shp-contents-grp="event">
 *                 <img src="…checkout.phinf…">
 * 그리고 사용자 우려: "이런 이벤트 텍스트가 있으면 누가봐도 대충 퍼왔네 이소리할것같은데"
 */
describe('④ 대표 갤러리(추가이미지)를 가져온다', () => {
  it('⭐⭐ alt 앵커로 찾는다 (클래스명은 난독화라 못 쓴다)', () => {
    expect(naver).toContain('img[alt^="추가이미지"]');
  });

  it('⭐⭐ 40px 썸네일이 아니라 원본을 쓴다 (쿼리를 뗀다)', () => {
    // 실측: 원본 1254px / ?type=f40 → 40px / ?type=w800 → 404
    expect(naver).toContain('const bareUrl =');
    expect(naver).toContain("split('?')[0]");
  });

  it('⭐ 파일명이 없는 주소는 버린다 (동영상 dthumb 프록시)', () => {
    // 실측: 쿼리를 떼면 ".../dthumb/" 만 남아 본문에 깨진 이미지로 나왔다
    expect(naver).toContain('dthumb');
    expect(naver).toContain('\\.(jpg|jpeg|png|gif|webp)$');
  });

  it('⭐⭐ 데스크톱 뷰포트여야 갤러리가 나온다', () => {
    // 실측: 모바일 390px → 0개, 데스크톱 1440px → 10개
    expect(naver).toContain('viewport: { width: 1440, height: 900 }');
    expect(naver).not.toContain('viewport: { width: 390, height: 844 }');
  });

  it('⭐ 갤러리를 상세컷보다 앞에 둔다 (배경 정리된 제품컷이 본문 1번에 좋다)', () => {
    expect(naver).toContain('const sellerShots = [...naverGallery, ...(info.detail || [])]');
  });
});

describe('⑤ 이벤트·판촉 배너를 본문에 싣지 않는다', () => {
  it('⭐⭐ 마크업이 event 로 표시한 것은 제외한다', () => {
    expect(naver).toContain("data-shp-contents-grp") ;
    expect(naver).toContain("=== 'event'");
  });

  it('⭐⭐ 실측한 실제 판촉 문구가 정규식에 걸린다', () => {
    const m = naver.match(/const PROMO = (\/.+\/i);/);
    expect(m).not.toBeNull();
    const re = new RegExp(m![1]!.slice(1, -2), 'i');
    // 실제 페이지에서 읽은 alt 들
    expect(re.test('N페이, 이벤트 참여하면 포인트 적립!')).toBe(true);
    expect(re.test('[가전Mega 빅세일] KRUPS 커피머신☕최대 ~ 29%')).toBe(true);
    expect(re.test('4천9백원 웰컴 선물이 왔어요! 멤버십만 누리는 추가 적립까지')).toBe(true);
    // 진짜 상품 사진 alt 는 통과해야 한다
    expect(re.test('크룹스')).toBe(false);
    expect(re.test('추가이미지0')).toBe(false);
  });

  it('⭐ alt 와 주소 양쪽에서 본다 (이중 방어)', () => {
    expect(naver).toContain('PROMO.test(alt)');
    expect(naver).toContain('PROMO.test(abs)');
  });

  it('⭐⭐ vision 도 판촉 문구 그림을 상품 사진으로 보지 않는다', () => {
    const vision = fs.readFileSync(path.join(__dirname, '..', 'src/core/affiliate/detail-image-vision.ts'), 'utf-8');
    expect(vision).toContain('판촉 문구가 큼직하게 박힌 그림');
    expect(vision).toContain('그냥 퍼왔구나');
    // 상품이 같이 보여도 제외해야 한다 — 이 조건이 빠지면 배너가 통과한다
    expect(vision).toContain('상품이 같이 보이더라도 false');
  });
});

describe('⑥ 포토리뷰는 부족할 때만 보충한다 (토스와 같은 정책)', () => {
  it('⭐ 판매자 사진이 기준 미만일 때만 쓴다', () => {
    expect(naver).toContain('if (sellerShots.length < MIN_DETAIL_IMAGES)');
  });

  it('⭐ 모자란 만큼만 가져온다 (저작권 노출 최소화)', () => {
    expect(naver).toContain('MIN_DETAIL_IMAGES - sellerShots.length');
  });

  it('⭐ 그래도 모자라면 비워 둔다', () => {
    expect(naver).toContain('이미지는 비워둡니다');
  });
});

describe('⑦ API 오류를 조용히 삼키지 않는다 (v3.8.444 시연에서 드러남)', () => {
  const vision = fs.readFileSync(path.join(__dirname, '..', 'src/core/affiliate/detail-image-vision.ts'), 'utf-8');

  /**
   * 실측: Gemini 키가 403("reported as leaked")을 받고 있었는데 화면에는
   *   "12장 분석 … ✅ 0장 중 0장에서 사실 확보" 만 찍혔다.
   * 오류 JSON 이 와도 candidates 가 없어 빈 문자열을 반환했고 루프가 조용히 넘어갔다.
   * "결과가 없다"와 "인증이 막혔다"는 화면에서 반드시 구분돼야 한다.
   */
  it('⭐⭐ 세 벤더 모두 오류 응답을 던진다', () => {
    expect(vision).toContain('function throwIfApiError');
    expect(vision).toContain("throwIfApiError(res, 'gemini')");
    expect(vision).toContain("throwIfApiError(res, 'claude')");
    expect(vision).toContain("throwIfApiError(res, 'openai')");
  });

  it('⭐⭐ 전량 실패는 성공처럼 보이면 안 된다', () => {
    expect(vision).toContain('결과를 하나도 받지 못했습니다');
    expect(vision).toContain('API 키·요금제를 확인해 주세요');
  });

  it('⭐ 그래도 발행은 막지 않는다', () => {
    expect(vision).toContain('이미지는 소제목 순서대로 배치됩니다');
    expect(vision).toContain('한 장 실패가 나머지를 막지 않는다');
  });
});

describe('⑧ 썸네일이 본문 첫 사진과 겹치지 않는다', () => {
  it('⭐⭐ 대표 갤러리에서 og:image 를 뺀다', () => {
    // 시연 실측: "2번은 1번과 같은 파일" — 갤러리 1번이 곧 썸네일이었다
    expect(naver).toContain('const thumbKey = canonicalImageKey(info.image');
    expect(naver).toContain('canonicalImageKey(u) !== thumbKey');
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

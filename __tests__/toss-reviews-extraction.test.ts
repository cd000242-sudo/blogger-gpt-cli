/**
 * 토스 후기를 안 읽고 있던 문제 (v3.8.438)
 *
 * 사용자 지적(2026-08-03): "링크 타고가니까 리뷰 1330개나 있는데 뭐가없다는건지모르곘네"
 *
 * 맞는 지적이었다. 실측으로 확인한 사실 —
 *   토스 상품 페이지는 schema.org JSON-LD 로 후기를 **정적 HTML 에 그대로** 심는다.
 *     "aggregateRating":{"ratingValue":4.7,"reviewCount":1331},
 *     "review":[{"author":{"name":"박*숙"},"reviewRating":{"ratingValue":5},
 *                "reviewBody":"포장이 넘 잘돼 왔어요…"}, …]
 *   그런데 crawlToss 는 og 메타 3개(title/image/description)만 읽고 있었다.
 *   후기를 못 봤으니 "후기 없음"으로 판정 → "상품군 일반 관심사" 경로 → 뻔한 글.
 *
 * 브라우저도 별도 API 도 필요 없었다. 이미 받아온 HTML 안에 있었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { extractSchemaReviews } from '../src/core/affiliate/crawl';

const ROOT = path.join(__dirname, '..');
const crawl = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'crawl.ts'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

/** 실측 HTML 구조를 그대로 옮긴 픽스처 (2026-08-03 toss.shopping) */
const REAL_SHAPE = `
"aggregateRating":{"@type":"AggregateRating","ratingValue":4.7,"reviewCount":1331},
"review":[{"@type":"Review","author":{"@type":"Person","name":"박*숙"},"reviewRating":{"@type":"Rating","ratingValue":5},"reviewBody":"포장이 넘 잘돼 왔어요 \\n배송도 빠르고요\\n재구매입니다"},
{"@type":"Review","author":{"@type":"Person","name":"오*지"},"reviewRating":{"@type":"Rating","ratingValue":5},"reviewBody":"늘 즐겨먹는 널담! 저렴하게 잘 샀어요"}]
`;

describe('① JSON-LD 에서 후기를 뽑는다', () => {
  it('⭐ 평점과 전체 후기 수를 읽는다', () => {
    const r = extractSchemaReviews(REAL_SHAPE);
    expect(r.ratingValue).toBe(4.7);
    expect(r.reviewCount).toBe(1331);
  });

  it('⭐ 후기 원문·작성자·별점을 읽는다', () => {
    const r = extractSchemaReviews(REAL_SHAPE);
    expect(r.reviews).toHaveLength(2);
    expect(r.reviews[0]!.author).toBe('박*숙');
    expect(r.reviews[0]!.rating).toBe(5);
    expect(r.reviews[0]!.body).toContain('포장이 넘 잘돼 왔어요');
  });

  it('⭐ 줄바꿈 이스케이프를 실제 줄바꿈으로 되돌린다', () => {
    const r = extractSchemaReviews(REAL_SHAPE);
    expect(r.reviews[0]!.body).toContain('\n');
    expect(r.reviews[0]!.body).not.toContain('\\n');
  });

  it('같은 후기가 두 번 들어가지 않는다', () => {
    const r = extractSchemaReviews(REAL_SHAPE + REAL_SHAPE);
    expect(r.reviews).toHaveLength(2);
  });

  it('너무 짧은 조각은 후기로 치지 않는다', () => {
    const junk = '"author":{"name":"A"},"reviewRating":{"ratingValue":5},"reviewBody":"굿"';
    expect(extractSchemaReviews(junk).reviews).toHaveLength(0);
  });

  it('후기가 없는 HTML 에도 죽지 않는다', () => {
    const r = extractSchemaReviews('<html><body>아무것도 없음</body></html>');
    expect(r.reviews).toEqual([]);
    expect(r.reviewCount).toBeUndefined();
  });

  it('빈 입력에도 죽지 않는다', () => {
    expect(extractSchemaReviews('').reviews).toEqual([]);
  });

  it('추출 개수에 상한이 있다 (프롬프트 비대화 방지)', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      `"author":{"name":"사람${i}"},"reviewRating":{"ratingValue":5},"reviewBody":"이건 충분히 긴 후기 본문입니다 번호 ${i}"`).join(',');
    expect(extractSchemaReviews(many).reviews.length).toBeLessThanOrEqual(40);
  });
});

describe('② 크롤러가 후기를 담아 돌려준다', () => {
  it('⭐ AffiliateProduct 에 후기 필드가 있다', () => {
    expect(crawl).toContain('reviews?: Array<{ author: string; rating: number | null; body: string }>;');
    expect(crawl).toContain('reviewCount?: number | undefined;');
    expect(crawl).toContain('ratingValue?: number | undefined;');
  });

  it('⭐ crawlToss 가 같은 HTML 에서 후기도 뽑는다 (추가 요청 0회)', () => {
    const fn = blockBetween(crawl, 'async function crawlToss(', 'async function crawlNaver(');
    expect(fn).toContain('extractSchemaReviews(html)');
    expect(fn).toContain('reviews: schema.reviews');
  });
});

describe('③ 뽑은 후기가 실제로 글 생성에 쓰인다', () => {
  /**
   * 여기가 핵심이다. 크롤만 되고 안 쓰이면 아무 의미가 없다 —
   * 이 저장소에서 반복된 "고쳤는데 출력까지 안 닿는" 사고를 막는다.
   */
  it('⭐ 제목 생성이 제휴사 무관하게 후기를 읽는다', () => {
    const block = blockBetween(orch, 'const bodies = [', 'const concerns = extractBuyerConcerns');
    // 쿠팡 후기(enrichedForTitle = coupangEnrichment)와 토스·네이버 후기를 **둘 다** 본다
    expect(block).toContain('enrichedForTitle?.reviews');
    expect(block).toContain('affiliateProducts');
    expect(orch).toContain('const enrichedForTitle = (payload as any).coupangEnrichment;');
  });

  it('⭐ 섹션 판정도 제휴사 무관하게 후기를 본다', () => {
    expect(orch).toContain('const affReviews = (((payload as any).affiliateProducts || [])[0]?.reviews || [])');
    expect(orch).toContain('const hasNoReviews = reviewCount === 0');
  });

  it('⭐ 후기 원문이 프롬프트에 실린다 (요약이 아니라 원문)', () => {
    expect(orch).toContain('💬 **실제 구매자 후기 원문**');
    expect(orch).toContain('이 후기들을 **글의 중심 재료로** 쓰세요');
  });

  it('⭐ 베끼기·뭉뚱그리기를 금지한다', () => {
    expect(orch).toContain('후기 표현을 그대로 베끼지 말고');
    expect(orch).toContain('후기에 없는 내용을 후기인 것처럼 쓰지 마세요');
    expect(orch).toContain('"리뷰가 좋다" 같은 뭉뚱그린 요약 금지');
  });

  it('⭐ 크롤이 제목 생성보다 먼저 일어난다 (순서가 핵심)', () => {
    const crawlIdx = orch.indexOf('crawlAffiliateLinks(nonCoupangLinks');
    const titleReviewIdx = orch.indexOf('const bodies = [');
    const titleCallIdx = orch.indexOf('h1 = await generateH1TitleFinal(');
    expect(crawlIdx).toBeGreaterThan(-1);
    expect(crawlIdx).toBeLessThan(titleReviewIdx);
    expect(titleReviewIdx).toBeLessThan(titleCallIdx);
  });
});

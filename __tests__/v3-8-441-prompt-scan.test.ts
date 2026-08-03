/**
 * v3.8.441 — 실제 발행 글을 읽고 찾은 품질 결함 4건
 *
 * 진단 대상 (2026-08-04 실측):
 *   leadernam.com/…/랜선식당-연탄불고기-소포장이라-한-끼씩-꺼내기-편/
 *
 * 구조·문장·규정 표기는 정상이었다. 문제는 "사게 만드는" 부분이었다.
 *   ① 6번 가격 섹션이 통째로 일반 쇼핑 요령으로 채워짐 (상품 가격 0회 등장)
 *   ② "확인된 3건" 이 8회 반복 — 전체 20,169건을 두고 우리 약점을 광고
 *   ③ H2 8개 중 6개에 상품명 전체가 박힘 (키워드 스터핑)
 *   ④ 사용 장면 GIF 가 확장자로 걸러질 위험
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const orch = read('src/core/final/orchestration.ts');
const gen = read('src/core/final/generation.ts');
const crawl = read('src/core/affiliate/crawl.ts');
const vision = read('src/core/affiliate/detail-image-vision.ts');

describe('① 가격을 못 구했을 때 — 일반 쇼핑 요령으로 지면을 때우지 않는다', () => {
  it('⭐ 가격 확인 여부를 실제로 판정한다', () => {
    expect(orch).toContain('const knownPriceKrw =');
    expect(orch).toContain('const hasNoPrice = !(knownPriceKrw > 0);');
  });

  it('⭐⭐ price_deal 섹션에 가격 미확인 분기가 배선돼 있다', () => {
    expect(orch).toContain("if (hasNoPrice && sec.id === 'price_deal')");
  });

  it('⭐⭐ 발행 글을 망친 그 문장들을 이름 대고 금지한다', () => {
    const block = blockBetween(orch, "if (hasNoPrice && sec.id === 'price_deal')", 'const reqsText =');
    // 실제 발행 글에 나온 표현들 — 이게 금지어로 안 들어가면 또 나온다
    expect(block).toContain('결제 직전 화면에서 비교하세요');
    expect(block).toContain('쿠폰 적용 후 최종 금액');
    expect(block).toContain('지면 낭비');
  });

  it('⭐ 지어내기 금지는 유지하면서 값어치로 방향을 튼다', () => {
    const block = blockBetween(orch, "if (hasNoPrice && sec.id === 'price_deal')", 'const reqsText =');
    expect(block).toContain('절대 지어내지 마세요');
    expect(block).toContain('값어치');
    expect(block).toContain('후회하는 경우');
  });

  it('⭐ 후기 분기보다 뒤에 와야 확실히 덮어쓴다', () => {
    const noReviewPrice = orch.indexOf("hasNoReviews && sec.id === 'price_deal'");
    const noPrice = orch.indexOf("if (hasNoPrice && sec.id === 'price_deal')");
    expect(noReviewPrice).toBeGreaterThan(-1);
    expect(noPrice).toBeGreaterThan(noReviewPrice);
  });
});

describe('② "확인된 3건" — 우리가 몇 건 확보했는지는 독자에게 알릴 일이 아니다', () => {
  it('⭐⭐ 건수를 본문에 쓰지 말라고 못 박는다', () => {
    expect(orch).toContain('본문에 쓰지 마세요');
    expect(orch).toContain('확인된 3건');
    expect(orch).toContain('한 번도 쓰지 마세요');
  });

  it('⭐ 왜 안 되는지 이유까지 준다 (이유 없는 금지는 잘 안 지켜진다)', () => {
    expect(orch).toContain('신뢰를 스스로 깎습니다');
  });

  it('⭐ 대신 쓸 숫자(전체 건수)를 알려준다', () => {
    expect(orch).toContain('독자에게 의미 있는 숫자는');
    expect(orch).toContain('affReviewTotal.toLocaleString');
  });

  it('⭐ 인용은 건수 대신 장면으로 유도한다', () => {
    expect(orch).toContain('장면으로');
  });
});

describe('③ H2 키워드 스터핑 — 소제목마다 상품명이 박히면 기계 글로 읽힌다', () => {
  it('⭐⭐ 키워드 반복에 상한이 있다', () => {
    const prompt = blockBetween(gen, 'const prompt = `키워드:', 'JSON 배열만 출력');
    expect(prompt).toContain('키워드를 모든 제목에 넣지 마라');
    expect(prompt).toContain('최대 2개');
  });

  it('⭐ 나머지 제목은 독자의 다음 궁금증으로 잡게 한다', () => {
    const prompt = blockBetween(gen, 'const prompt = `키워드:', 'JSON 배열만 출력');
    expect(prompt).toContain('다음으로 궁금해할');
  });

  it('⭐ 과최적화 위험을 명시한다', () => {
    const prompt = blockBetween(gen, 'const prompt = `키워드:', 'JSON 배열만 출력');
    expect(prompt).toContain('과최적화');
  });
});

describe('④ 사용 장면 GIF 는 살린다', () => {
  it('⭐⭐ 확장자로 거르는 코드가 없다', () => {
    // .gif/.webp 를 후보에서 빼는 정규식이 생기면 여기서 걸린다
    expect(crawl).not.toMatch(/\\\.(gif|webp)\$?\/[gi]*\s*\.test/);
    expect(crawl).not.toContain("endsWith('.gif')");
  });

  it('⭐ 비-상품 필터에 gif 가 들어 있지 않다', () => {
    const line = crawl.split('\n').find((l) => l.includes('const NON_PRODUCT_IMAGE ='))!;
    expect(line).toBeDefined();
    expect(line).not.toContain('gif');
  });

  it('⭐ vision 이 GIF 를 애니메이션이라는 이유로 탈락시키지 않게 지시한다', () => {
    expect(vision).toContain('GIF');
    expect(vision).toContain('애니메이션이라는 이유로 false 를 주지 마세요');
  });

  it('⭐ 왜 살려야 하는지 코드에 남아 있다 (다음 사람이 다시 막지 않게)', () => {
    expect(crawl).toContain('확장자로 거르지 않는다');
  });
});

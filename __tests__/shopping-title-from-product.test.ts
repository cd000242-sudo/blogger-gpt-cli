/**
 * 쇼핑 제목 — 상품 등록명을 그대로 쓰지 않는다 (v3.8.404)
 *
 * 사용자 보고(2026-08-02):
 *   ✅ 제목 완료: "💡미끄러짐방지 쓰레기유입방지 시티가드 그레이팅안전덮개 대(600x500) 1개 팁"
 *   → 쿠팡 등록명을 통째로 쓰고 뒤에 "팁"만 붙었다.
 *
 * 원인: 프롬프트의 `키워드 "..."를 자연스럽게 포함` 규칙.
 *   v3.8.403 에서 상품명을 주제(keyword)로 넘겼더니, 그 긴 등록명을
 *   "제목에 그대로 넣으라"는 지시가 되어버렸다.
 *
 * 쇼핑몰 등록명은 **검색 노출을 노린 키워드 나열**이지 사람이 읽는 제목이 아니다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('상품일 때는 제목 규칙이 달라진다', () => {
  it('productName 인자를 받는다', () => {
    expect(gen).toContain('productName?: string');
  });

  it('⭐ 등록명을 그대로 쓰지 말라고 못 박는다', () => {
    expect(gen).toContain('상품 등록명');
    expect(gen).toContain('그대로 쓰지 마세요');
  });

  it('⭐ 규격·수량·포장 단위를 빼라고 지시한다 (사용자가 겪은 "대(600x500) 1개")', () => {
    expect(gen).toContain('규격·치수·수량·포장 단위는 제목에서 빼세요');
    expect(gen).toContain('대(600x500)');
  });

  it('⭐ 핵심 제품 명사와 이점만 뽑으라고 예시까지 준다', () => {
    expect(gen).toContain('핵심 제품 명사');
    expect(gen).toContain('그레이팅 안전덮개');
  });

  it('⭐ 상품일 때는 "키워드를 그대로 포함" 규칙을 끈다 (이게 원인이었다)', () => {
    // 고정 길이 슬라이스는 프롬프트 문구가 늘면 깨진다 — 삼항의 끝을 경계로 잡는다
    const i = gen.indexOf('${productName ?');
    expect(i).toBeGreaterThan(-1);
    const end = gen.indexOf('자연스럽게 포함`}', i);
    expect(end).toBeGreaterThan(i);
    // 삼항의 else 쪽에만 기존 규칙이 남아야 한다
    // end 는 '자연스럽게 포함`}' 의 시작 위치 — 그 문구까지 포함해서 보면 충분하다
    expect(gen.slice(i, gen.indexOf('자연스럽게 포함`}', i) + 12)).toContain('` : `- 키워드 ');   // 삼항의 else 쪽
  });

  it('일반 글은 예전 규칙 그대로다 (동작을 바꾸지 않는다)', () => {
    expect(gen).toContain('키워드 "${keyword}"를 자연스럽게 포함');
  });
});

describe('orchestration 이 상품명을 넘긴다', () => {
  // v3.8.411: 상품명 계산이 호출부 밖 변수로 빠졌다(후기 기반 제목 지시문이 붙으면서).
  //   검증 대상은 그대로다 — "쇼핑모드일 때만" · "빈 문자열로 잘못 켜지지 않게".
  it('⭐ 쇼핑모드일 때만 상품명을 넘긴다', () => {
    expect(orch).toContain("isShoppingTitle = String((payload as any).contentMode || '') === 'shopping'");
    expect(orch).toContain('const shoppingProductName = isShoppingTitle');
    expect(braceBlock(orch, 'h1 = await generateH1TitleFinal(')).toContain('shoppingProductName');
  });

  it('상품명을 못 얻었으면 undefined 로 넘긴다 (빈 문자열로 잘못 켜지지 않게)', () => {
    expect(orch).toContain("resolvedProductName || '') || undefined");
  });

  it('v3.8.403 에서 심은 resolvedProductName 을 쓴다', () => {
    expect(orch).toContain('(payload as any).resolvedProductName = productName');
  });
});

describe('v3.8.427 — 토스/네이버 등 비-쿠팡 제휴 링크도 제목을 짓기 전에 상품명을 확정한다', () => {
  /**
   * 실측 사고(2026-08-03): 토스 쉐어링크만 넣고 발행했더니 제목이
   * "상품명 없음 가격 대비 실제 사용성 괜찮을까"로 나왔다. 본문은 상품명을 정확히
   * 썼지만(크롤 자체는 됐다), 그 크롤이 제목 생성보다 한참 뒤(구 1374행 부근)에
   * 실행돼 제목 프롬프트는 상품명을 못 받고 buyer-concerns.ts 의 "(상품명 없음)"
   * 플레이스홀더를 그대로 받아 모델이 그 문구를 문자 그대로 제목에 넣었다.
   */
  it('⭐ 쿠팡을 뺀 링크(토스/네이버)로 crawlAffiliateLinks를 미리 부른다', () => {
    // v3.8.430: "태그 우선 → 정규식 폴백" 삼항이 됐다. 폴백이 살아 있는지로 확인한다.
    expect(orch).toContain('const nonCoupangLinks = explicitProvider');
    expect(orch).toContain('affiliateAll.filter((u) => !/coupang\\.com|coupa\\.ng/i.test(u))');
    const block = braceBlock(orch, 'if (nonCoupangLinks.length > 0 && String((payload as any).contentMode || \'\') === \'shopping\'');
    expect(block).toContain("await import('../affiliate/crawl')");
    expect(block).toContain('crawlAffiliateLinks(nonCoupangLinks');
  });

  it('⭐ 크롤 결과에서 얻은 상품명을 resolvedProductName과 keyword에 모두 반영한다', () => {
    const block = braceBlock(orch, 'if (nonCoupangLinks.length > 0 && String((payload as any).contentMode || \'\') === \'shopping\'');
    expect(block).toContain('(payload as any).resolvedProductName = productName');
    expect(block).toContain('keyword = productName;');
  });

  it('⭐ 이미 resolvedProductName이 있으면(=쿠팡 경로에서 이미 잡혔으면) 다시 크롤하지 않는다', () => {
    expect(orch).toContain("nonCoupangLinks.length > 0 && String((payload as any).contentMode || '') === 'shopping'\n      && !(payload as any).resolvedProductName");
  });

  it('⭐ 결과를 affiliateProducts에 캐시해 뒤쪽 블록이 같은 링크를 또 크롤하지 않는다', () => {
    const block = braceBlock(orch, 'if (nonCoupangLinks.length > 0 && String((payload as any).contentMode || \'\') === \'shopping\'');
    expect(block).toContain('(payload as any).affiliateProducts = products;');
    // 뒤쪽(1374행 부근) 블록의 가드 — 이 캐시로 스킵되는지 실제로 확인한다
    expect(orch).toContain('if (rawLinks.length > 0 && !(payload as any).affiliateProducts) {');
  });

  it('⭐ 이 새 블록은 실제로 제목 생성(generateH1TitleFinal) 호출보다 코드상 앞에 있다 — 순서가 핵심이다', () => {
    const newBlockIdx = orch.indexOf('const nonCoupangLinks = explicitProvider');
    const titleCallIdx = orch.indexOf('h1 = await generateH1TitleFinal(');
    expect(newBlockIdx).toBeGreaterThan(-1);
    expect(titleCallIdx).toBeGreaterThan(-1);
    expect(newBlockIdx).toBeLessThan(titleCallIdx);
  });

  it('쿠팡 링크는 제외한다 — 쿠팡은 이미 위 전용 경로(resolveCoupangProductId)로 처리됐다', () => {
    const block = braceBlock(orch, 'if (nonCoupangLinks.length > 0 && String((payload as any).contentMode || \'\') === \'shopping\'');
    // nonCoupangLinks 자체가 쿠팡을 걸러낸 배열이므로, 이 블록이 쿠팡 링크를 다시 취급하지 않는다
    expect(block).not.toContain('resolveCoupangProductId');
  });
});

/**
 * 실제 발행글 검수에서 나온 결함 6건 (v3.8.437)
 *
 * 사용자 실측(2026-08-03, tjdgus24280.blogspot.com 발행글):
 *   ① "3-1,6-1은 어떤글이던지 누락이됩니다"
 *   ② "수집된이미지가 중복으로 나오는 버그"
 *   ③ "수집된 이미지가 짤려서 나오는버그 … 모바일 친화적으로 나와야됩니다"
 *   ④ "8월 3일 기준 이런거 빼세요" (AI 티가 난다)
 *   ⑤ "후기가아니라 구매전에 메뉴얼을 가르쳐주는 글로밖에안보이고"
 *   ⑥ "소개한 상품아래 CTA는 없애세요"
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');
const cta = fs.readFileSync(path.join(ROOT, 'src', 'core', 'affiliate', 'cta-card.ts'), 'utf8');
const sections = fs.readFileSync(path.join(ROOT, 'src', 'core', 'max-mode', 'mode-sections-extended.ts'), 'utf8');

describe('① 3-1·6-1 누락 — 표를 요구한 섹션이 본문을 비우던 문제', () => {
  /**
   * 왜 하필 3번·6번이었나:
   *   3. comparison_guide — "⚠️ 장단점 비교 TABLE 필수!"
   *   6. price_deal      — "가격 비교표"
   * 표를 요구하는 정확히 그 두 섹션이다. 모델이 "표 필수"를 **표가 곧 결과물**로
   * 읽어 tables 에만 채우고 content 를 비웠다. 토큰 잘림이 아니라 지시문이
   * 만든 결정론적 버그였다 — 그래서 어떤 글이든 늘 같은 자리였다.
   */
  it('⭐ 문제의 두 섹션이 실제로 표를 요구하는 섹션이 맞다 (원인 고정)', () => {
    const i = sections.indexOf('SHOPPING_CONVERSION_MODE_SECTIONS');
    const body = sections.slice(i, sections.indexOf('\n];', i));
    const ids = [...body.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ids[2]).toBe('comparison_guide');   // 3번
    expect(ids[5]).toBe('price_deal');         // 6번
  });

  it('⭐ 표가 본문을 대신하지 못한다고 못 박는다', () => {
    expect(gen).toContain('표는 본문을 대신하지 못합니다');
    expect(gen).toContain('"content" 는 어떤 경우에도 비워두면 안 됩니다');
  });

  it('⭐ 표가 있는 H3 의 본문 구성까지 지정한다 (빈 칸이 안 나오게)', () => {
    expect(gen).toContain('표를 왜 봐야 하는지 한 문단');
    expect(gen).toContain('표에서 **읽어낼 결론**');
    expect(gen).toContain('표를 빼도 글이 성립해야 합니다');
  });

  it('빈 소제목 안전망(v3.8.432)은 그대로 살아 있다', () => {
    expect(gen).toContain('빈 소제목');
    expect(gen).toContain('아래 소제목들의 **본문만** 작성하세요');
  });
});

describe('② 수집 이미지가 중복 배치되던 문제', () => {
  it('⭐ 안 쓴 사진부터 고른다 (나머지 연산 순환 제거)', () => {
    expect(orch).toContain('const usedProductImages = new Set<string>();');
    // v3.8.439: CDN 래핑 주소 때문에 정규화 키(imgKey)로 비교하도록 바뀌었다
    expect(orch).toContain('productPool.find((u) => u && !usedProductImages.has(imgKey(u)))');
    // 예전의 무조건 순환은 섹션 수 > 사진 수면 반드시 겹쳤다
    expect(orch).not.toContain('const picked = productPool[(i + 1) % productPool.length];');
  });

  it('⭐ 사진이 모자랄 때만 재사용하고, 그때도 썸네일(0번)은 피한다', () => {
    const block = blockBetween(orch, "if (shoppingStrategy === 'product-all') {", "} else if (shoppingStrategy === 'product-i2i')");
    expect(block).toContain('productPool.slice(1)');
  });

  it('⭐ 쓴 사진은 기록한다', () => {
    expect(orch).toContain('usedProductImages.add(imgKey(picked));');
  });
});

describe('③ 수집 이미지 잘림 + 모바일', () => {
  it('⭐ 수집 사진인지 판별한다', () => {
    expect(orch).toContain('const isCollectedPhoto =');
    expect(orch).toContain('usedDetailImageUrls.has(finalImageUrl)');
  });

  it('⭐ 수집 사진은 16:9 로 자르지 않고 원본 비율을 지킨다', () => {
    const block = blockBetween(orch, 'const isCollectedPhoto =', '<figure class="section-image"');
    expect(block).toContain('object-fit:contain');
    expect(block).toContain('height:auto');
    // 수집 사진 쪽 프레임에는 비율 고정이 없어야 한다
    expect(block).toContain("? 'width:100% !important;overflow:hidden");
  });

  it('⭐ 모바일에서 넘치지 않는다 (폭 100% · max-width)', () => {
    const block = blockBetween(orch, 'const isCollectedPhoto =', '<figure class="section-image"');
    expect(block).toContain('max-width:100% !important');
  });

  it('AI 생성 이미지는 예전처럼 16:9 cover 그대로다 (회귀 없음)', () => {
    const block = blockBetween(orch, 'const isCollectedPhoto =', '<figure class="section-image"');
    expect(block).toContain('object-fit:cover');
  });
});

describe('④ 날짜 꼬리표 제거', () => {
  it('⭐ "~기준"을 반드시 쓰라던 지시를 없앴다 (이게 원인이었다)', () => {
    expect(gen).not.toContain('"~기준"을 반드시 명시하세요');
  });

  it('⭐ 날짜 꼬리표를 쓰지 말라고 명시한다', () => {
    expect(gen).toContain('날짜 꼬리표를 본문에 쓰지 마세요');
    expect(gen).toContain('AI가 쓴 티만 냅니다');
  });

  it('마감 지난 일정을 쓰지 말라는 규칙은 유지된다 (사실 정확성)', () => {
    expect(gen).toContain('이전에 마감된 사업/이벤트/일정은 언급하지 마세요');
  });
});

describe('⑤ 후기형이 매뉴얼처럼 나오던 문제', () => {
  it('⭐ 화자를 전문가가 아니라 "써 본 사람"으로 못 박는다', () => {
    expect(orch).toContain('이 글의 화자 — 전문가가 아니라 "써 본 사람"입니다');
    expect(orch).toContain('말투와 시선은 전부 경험자');
  });

  it('⭐ 어떤 상품에나 붙는 일반론을 예시까지 들어 금지한다', () => {
    expect(orch).toContain('일반론 금지');
    expect(orch).toContain('구매 전 용도를 먼저 정하는 것이 좋습니다');
    expect(orch).toContain('가격 대비 성능을 따져보세요');
  });

  it('⭐ 재료가 없으면 지어내지 말고 없다고 쓰게 한다 (할루시네이션 방지 원칙 유지)', () => {
    expect(orch).toContain('재료가 없으면 솔직하게');
    expect(orch).toContain('없는 경험을 지어내는 것보다');
  });

  it('⭐ 이 지시가 실제 프롬프트 블록에 실린다 (조용히 빠지지 않게)', () => {
    expect(orch).toContain('[쇼핑 모드 섹션별 상세 지시]${voiceDirective}');
  });
});

describe('⑥ 소개한 상품 아래 CTA 중복', () => {
  it('⭐ insertCtaCards 가 마지막 카드를 건너뛸 수 있다', () => {
    expect(cta).toContain('opts: { skipFinal?: boolean } = {}');
    expect(cta).toContain('if (!opts.skipFinal) {');
  });

  it('⭐ 건너뛰면 개수도 안 센다 (로그가 사실과 맞게)', () => {
    const block = blockBetween(cta, 'if (!opts.skipFinal) {', 'return { html: out, inserted };');
    expect(block).toContain('inserted += 1;');
  });

  it('⭐ 상품 위젯이 이미 있으면 마지막 카드를 넣지 않는다', () => {
    expect(orch).toContain("skipFinal: html.includes('affiliate-product-showcase')");
  });

  it('요약 직후·본문 중간 카드는 그대로 남는다 (구매 동선 유지)', () => {
    expect(cta).toContain("card('summary')");
    expect(cta).toContain("card('mid')");
  });
});

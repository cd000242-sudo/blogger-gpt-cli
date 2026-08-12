/**
 * 정적 카드 라벨 ↔ 백엔드 금액표 정합성 (2026-08-12 실측)
 *
 * pricing-sync 가 시작 시 카드 라벨과 data-cost 를 백엔드 값으로 덮어쓴다.
 * 그런데 동기화가 실패하면 "화면 기존 값 유지"라서 **정적 HTML 값이 그대로 보인다.**
 * 실측 결과 그 정적 값이 전부 낡아 있었다:
 *
 *   균형    Gemini 3.5 Flash ~₩20/글   →  실제 Gemini 3.6 Flash ₩57  (3배 차이)
 *   프리미엄 Gemini 3.1 Pro Preview ₩90 →  실제 Gemini 3.5 Flash ₩61  (이미 제거한 모델명)
 *   가성비   ~₩12/글                    →  실제 ₩15
 *
 * 동기화가 도는 평시에는 안 보이지만, 실패하면 사용자가 3배 낮은 가격을 보고 고르게 된다.
 * 그래서 정적 값도 백엔드와 맞춰 두 겹으로 지킨다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { TIER_MODELS, tierCostKrw } from '../src/core/llm/pricing';

const html = readFileSync(join(__dirname, '..', 'electron', 'ui', 'index.html'), 'utf8');

/** 라디오 value 로 tier-card 블록을 찾는다 */
function tierCard(value: string): string {
  const cards = html.split('<label class="tier-card"').slice(1);
  const card = cards.find(block => block.includes(`value="${value}"`));
  if (!card) throw new Error(`카드를 찾지 못했습니다: ${value}`);
  return card.slice(0, card.indexOf('</label>'));
}

const GEMINI_VALUES = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'] as const;

describe('정적 카드가 백엔드 금액표와 어긋나지 않는다', () => {
  it.each(GEMINI_VALUES)('%s — 제목과 금액이 pricing.ts 와 같다', (value) => {
    const tier = TIER_MODELS.find(t => t.value === value)!;
    expect(tier).toBeDefined();
    const card = tierCard(value);
    expect(card).toContain(tier.title);
    expect(card).toContain(`~₩${tierCostKrw(tier)}/글`);
    expect(card).toContain(`data-cost="${tierCostKrw(tier)}"`);
  });

  it('폐기된 Gemini 3.1 Pro Preview 가 화면에 남아있지 않다', () => {
    expect(html).not.toContain('Gemini 3.1 Pro Preview');
  });

  it('기본 티어가 상단 배지와 일치한다', () => {
    const defaultTier = TIER_MODELS.find(t => t.default === true)!;
    const badge = html.slice(html.indexOf('id="textEngineCurrent"'));
    expect(badge.slice(0, 400)).toContain(defaultTier.title);
  });
});

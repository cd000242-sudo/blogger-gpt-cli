/**
 * 쇼핑 글 제목은 후기에서 나온다 (v3.8.411)
 *
 * 사용자 판정(2026-08-02):
 *   생성된 제목 — "브리즈 누비아 이동식 에어컨 듀얼덕트 핵심 정리 🔥"
 *   "좀 나아지긴 했는데 너라면 클릭하니..?"
 *
 * 안 눌린다. "핵심 정리"는 어떤 상품에 붙여도 말이 되고,
 * 어떤 상품에나 붙는 말은 그 상품에 대해 아무것도 말하지 않는다.
 *
 * 게다가 그 꼴은 우연이 아니었다 — generateH1TitleFinal 의 아키타입 목록에
 * '핵심 정리형'이 통째로 들어 있어서 뽑히면 그대로 나온다.
 *
 * 상품명을 검색한 사람은 그 상품을 **이미 안다**. 궁금한 건 "사도 되나?" 하나다.
 * 그 답은 이미 수집해둔 후기 60건에 있는데 제목이 그걸 하나도 안 봤다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  extractBuyerConcerns, composeShoppingTitleDirective, findFillerTail, FILLER_TAILS,
} from '../src/core/affiliate/buyer-concerns';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const gen = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'generation.ts'), 'utf8');

/** 이동식 에어컨 후기에서 실제로 흔한 문장들 */
const AIRCON_REVIEWS = [
  '생각보다 소음이 좀 있어요. 밤에 켜두면 신경 쓰입니다',
  '전기요금 걱정했는데 생각보다 많이 안 나왔어요',
  '소리가 꽤 큽니다. 거실에서는 괜찮은데 침실은 글쎄요',
  '배수 물통 자주 비워야 해서 번거로워요',
  '전기세 폭탄 맞을까 걱정했지만 괜찮네요',
  '조용한 편은 아니에요. 윙윙 소리 납니다',
  '가성비 괜찮은 것 같습니다',
  '전기요금이 좀 나오는 편이라 오래는 못 틀겠어요',
];

describe('후기에서 구매자 관심사를 뽑는다', () => {
  it('⭐ 가장 많이 언급된 걱정이 위로 온다', () => {
    const top = extractBuyerConcerns(AIRCON_REVIEWS, 3).map((c) => c.label);
    expect(top).toContain('소음');
    expect(top).toContain('전기요금');
  });

  it('몇 건이 그 말을 했는지 센다 (제목 축을 고를 근거)', () => {
    const noise = extractBuyerConcerns(AIRCON_REVIEWS, 10).find((c) => c.label === '소음');
    expect(noise!.count).toBe(3);   // 소음 / 소리가 / 조용·윙윙
  });

  it('같은 걱정의 다른 표현을 하나로 묶는다', () => {
    // "전기요금" · "전기세" 는 같은 걱정이다
    const bill = extractBuyerConcerns(['전기세가 무서워요', '전기요금 폭탄'], 5).find((c) => c.label === '전기요금');
    expect(bill!.count).toBe(2);
  });

  it('근거 후기를 함께 준다 (프롬프트에 구체성을 싣는다)', () => {
    const noise = extractBuyerConcerns(AIRCON_REVIEWS, 10).find((c) => c.label === '소음');
    expect(noise!.quotes.length).toBeGreaterThan(0);
    expect(noise!.quotes[0]!.length).toBeLessThanOrEqual(60);
  });

  it('⭐ 후기가 없어도 터지지 않는다 — 빈 결과를 준다', () => {
    expect(extractBuyerConcerns([], 3)).toEqual([]);
    expect(extractBuyerConcerns(null as any, 3)).toEqual([]);
    expect(extractBuyerConcerns(['', '   '], 3)).toEqual([]);
  });

  it('아무 걱정도 안 걸리는 후기는 빈 결과 (억지로 만들지 않는다)', () => {
    expect(extractBuyerConcerns(['잘 받았습니다', '감사합니다'], 3)).toEqual([]);
  });

  it('개수 제한을 지킨다', () => {
    expect(extractBuyerConcerns(AIRCON_REVIEWS, 2)).toHaveLength(2);
  });
});

describe('무의미한 꼬리표를 잡아낸다', () => {
  it('⭐ 사용자가 지적한 제목이 정확히 걸린다', () => {
    expect(findFillerTail('브리즈 누비아 이동식 에어컨 듀얼덕트 핵심 정리 🔥')).toBe('핵심 정리');
  });

  it('이모지·문장부호가 뒤에 붙어도 찾는다', () => {
    expect(findFillerTail('이동식 에어컨 총정리 💡')).toBe('총정리');
    expect(findFillerTail('이동식 에어컨 완벽 가이드!')).toBe('완벽 가이드');
  });

  it('⭐ 긴 꼬리표가 먼저 잡힌다 — "핵심 정리"가 "정리"로 잘리면 안 된다', () => {
    expect(findFillerTail('이동식 에어컨 핵심 정리')).toBe('핵심 정리');
  });

  it('⭐ 내용이 있는 제목은 건드리지 않는다', () => {
    expect(findFillerTail('브리즈 누비아 전기요금 정말 얼마 나올까')).toBeNull();
    expect(findFillerTail('이동식 에어컨 소음 어느 정도인지 솔직하게')).toBeNull();
  });

  it('⭐ 제목 전체가 꼬리표면 떼지 않는다 (제목이 사라지면 안 된다)', () => {
    expect(findFillerTail('정리')).toBeNull();
    expect(findFillerTail('총정리')).toBeNull();
  });

  it('빈 값에 안전하다', () => {
    expect(findFillerTail('')).toBeNull();
    expect(findFillerTail(null as any)).toBeNull();
  });
});

describe('제목 지시문', () => {
  const directive = composeShoppingTitleDirective('브리즈 누비아 이동식 에어컨', extractBuyerConcerns(AIRCON_REVIEWS, 3));

  it('⭐ 검색자가 상품을 이미 안다는 전제를 박는다', () => {
    expect(directive).toContain('이미 압니다');
    expect(directive).toContain('사도 되나');
  });

  it('⭐ 실제 후기 수치를 싣는다 (막연한 지시가 아니다)', () => {
    expect(directive).toMatch(/소음\(후기 \d+건\)/);
  });

  it('⭐ 꼬리표를 명시적으로 금지한다', () => {
    expect(directive).toContain('핵심 정리');
    expect(directive).toContain('금지');
  });

  it('하나만 고르라고 한다 (나열하면 다시 밋밋해진다)', () => {
    expect(directive).toContain('여러 개를 나열하지 마세요');
  });

  it('좋은 꼴과 나쁜 꼴을 상품명으로 보여준다', () => {
    expect(directive).toContain('브리즈 누비아 이동식 에어컨 전기요금');
    expect(directive).toContain('이런 꼴이면 실패입니다');
  });

  it('⭐ 후기가 없어도 지시문은 나온다 — 꼬리표 금지만이라도 걸어야 한다', () => {
    const noReviews = composeShoppingTitleDirective('무명 제품', []);
    expect(noReviews).toContain('금지');
    expect(noReviews).toContain('후기 데이터가 없습니다');
  });

  it('금지 목록이 비어 있지 않다', () => {
    expect(FILLER_TAILS.length).toBeGreaterThan(5);
  });
});

describe('배선 — 제목 생성이 실제로 이 지시를 쓴다', () => {
  it('⭐ 쇼핑 글이면 아키타입 목록을 통째로 갈아끼운다', () => {
    // '핵심 정리형' 아키타입이 남아 있으면 뽑혀서 같은 제목이 또 나온다
    expect(gen).toContain('shoppingDirective || `**이번에 사용할 제목 스타일');
    expect(gen).toContain('shoppingDirective ? \'- 위 쇼핑 글 제목 규칙을 따르세요\'');
  });

  it('⭐ 모델이 그래도 꼬리표를 붙이면 마지막에 떼어낸다', () => {
    expect(gen).toContain('findFillerTail');
    expect(braceBlock(gen, 'if (shoppingDirective) {')).toContain('stripped.length >= 8');
  });

  it('쇼핑 글이 아니면 기존 아키타입 그대로다 (다른 모드를 깨지 않는다)', () => {
    expect(gen).toContain('archetypeGuide');
  });

  it('⭐ orchestration 이 수집한 후기를 넘긴다', () => {
    expect(orch).toContain('extractBuyerConcerns');
    expect(orch).toContain('coupangEnrichment');
    expect(orch).toContain('shoppingTitleDirective');
  });

  it('⭐ 쇼핑모드에서만 적용된다', () => {
    expect(orch).toContain("isShoppingTitle = String((payload as any).contentMode || '') === 'shopping'");
    expect(orch).toContain('if (isShoppingTitle) {');
  });

  it('⭐ 추출이 실패해도 제목 생성을 막지 않는다', () => {
    expect(braceBlock(orch, 'if (isShoppingTitle) {')).toContain('catch');
  });

  it('무엇을 축으로 삼았는지 로그로 알린다', () => {
    expect(orch).toContain('제목 축:');
  });

  it('⭐ 추가 API 호출이 없다 — 비용은 고정이다', () => {
    const block = braceBlock(orch, 'if (isShoppingTitle) {');
    expect(block).not.toContain('callGemini');
    expect(block).not.toContain('await fetch');
  });
});

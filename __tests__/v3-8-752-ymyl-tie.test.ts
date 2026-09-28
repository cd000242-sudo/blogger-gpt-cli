import { classifyYmyl, buildYmylPromptBlock } from '../src/core/search-intent-classifier';

/*
 * v3.8.752 (감사 F10) — finance/insurance 동점 문맥 분리.
 *
 * 실측(D 글 5902): "보험금 지급지연 지연이자, 언제부터 계산되는지 확인" → '이자'(finance 5) 와 '보험'(insurance 5) 동점,
 * 배열 순서상 finance 가 이겨 결론부에 "투자 권유가 아닙니다 … 원금 손실 가능성" 이 붙었다.
 * '보험' 이 있으면 무조건 insurance 로 정하는 방식은 금지(지시서 §3) — 보험회사 주가·보험업종 투자는 finance 가 맞다.
 */
describe('v3.8.752 YMYL finance/insurance 동점', () => {
  /** 테스트 6 — 보험금 지급 지연 이자 → 보험 청구 문맥. 투자 면책이 붙지 않는다 */
  test('보험금 지급지연 지연이자 는 insurance', () => {
    const k = '보험금 지급지연 지연이자, 언제부터 계산되는지 확인';
    expect(classifyYmyl(k)).toBe('insurance');
    const block = buildYmylPromptBlock('insurance', k);
    expect(block).toContain('보험 상품 일반 정보 제공 목적');
    expect(block).not.toContain('투자 권유가 아닙니다');
    expect(block).not.toContain('원금 손실');
  });

  /** 테스트 7 — '보험' 이 있어도 투자 문맥이면 finance */
  test('보험회사 주가 · 보험업종 투자 는 finance', () => {
    expect(classifyYmyl('보험회사 주가 전망')).toBe('finance');
    expect(classifyYmyl('보험업종 투자 전망 2026')).toBe('finance');
    expect(classifyYmyl('보험사 배당 주식 추천')).toBe('finance');
    // 청구 문맥과 투자 문맥이 함께 있으면 예전대로(finance) — 무조건 insurance 가 아니다
    expect(classifyYmyl('보험금 지급지연 이자와 보험사 주가')).toBe('finance');
  });

  /** 테스트 8 — 기존 금융·보험 분류 회귀 없음 (동점이 아니면 손대지 않는다) */
  test('동점이 아닌 키워드는 예전 그대로', () => {
    expect(classifyYmyl('주택담보대출 금리 비교')).toBe('finance');
    expect(classifyYmyl('청년미래적금 이자 계산')).toBe('finance');
    expect(classifyYmyl('실비보험 청구 방법')).toBe('insurance');
    expect(classifyYmyl('자동차보험 갱신 보험료')).toBe('insurance');
    expect(classifyYmyl('종신보험 해지환급금')).toBe('insurance');
    // 사회보험 배제(v3.8.362) 유지 — 4대보험·국민연금은 insurance 가 아니다
    expect(classifyYmyl('4대보험 가입 조건')).not.toBe('insurance');
    expect(classifyYmyl('국민연금 납부예외 신청')).toBe('finance');
    // 보험 청구 문맥이라도 이자가 없으면 원래부터 insurance
    expect(classifyYmyl('보험금 청구 지급 지연 대응')).toBe('insurance');
    expect(classifyYmyl('오늘 날씨')).toBeNull();
  });
});

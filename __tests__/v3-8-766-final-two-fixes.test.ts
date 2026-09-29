const fs = require('fs');
const path = require('path');

import { weakenSentence, findStrengthened } from '../src/core/final/decision-semantics';
import { alignSummaryToBody } from '../src/core/final/answer-fidelity';
import { runFinalAuthority } from '../src/core/final/final-authority';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import type { FactEvidence } from '../src/core/final/fact-integrity';

/*
 * v3.8.766 — FINANCE/POLICY FINAL TWO FIXES. live run ed05c6(FINAL B) 저장 입력 오프라인 재생 + 교차 도메인. 호출 0회.
 *  A. 상한(MAXIMUM) 값을 추천의 선행 조건으로 쓰는 구조(값 + 능력 술어 + 뒤쪽 추천)
 *  B. 범위 근거(13.2~14.4%)의 두 끝 값을 단일 값으로 대조
 */
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-ed05c6', 'run-inputs.json'), 'utf8'));
const ITEMS = R.stage2Items.map((i: any) => ({ ...i, mainKeyword: R.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null }));
const EV = ITEMS.map((i: any) => `[${i.id}] ${i.cleanedText}`).join('\n');
const VIEW = buildValidationEvidence(ITEMS, { provider: 'Naver Grounding', trustLevel: 'weak', topic: R.keyword, context: '' } as FactEvidence).evidence;
const plain = (s: string) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const ANSWER_LIVE = '5년간 월 70만원 납입이 가능하고 남은 기간까지 유지할 수 있다면 청년도약계좌를 먼저 선택하는 편이 맞습니다.';
const CONCLUSION_LIVE = '월 70만 원을 장기간 납입할 수 있고 청년도약계좌의 남은 만기가 부담스럽지 않다면 유지하는 쪽이 맞습니다.';

describe('DECISION (T1~T7) — 상한을 추천 조건으로 쓰지 않는다', () => {
  test('T1 MAXIMUM + 능력 절 + 추천 → 검출·약화 (live ed05c6 답 상자 문장)', () => {
    expect(findStrengthened(ANSWER_LIVE).map((h) => h.kind)).toEqual(['ability-rec']);
    const r = weakenSentence(ANSWER_LIVE, EV, { dimensions: ['남은 기간'] });
    expect(r.changes[0]).toMatchObject({ action: 'weakened', value: '70만원' });
    expect(r.changes[0]!.reason).toMatch(/MAXIMUM_AS_RECOMMENDATION_CONDITION/);
    expect(r.after).toBe('5년간 최대 70만원 한도 안에서 실제 납입 가능액을 함께 보고 납입을 이어갈 수 있고 남은 기간까지 유지할 수 있다면 청년도약계좌를 먼저 선택하는 편이 맞습니다.');
  });
  test('T2 MAXIMUM + "납입할 수 있고"(부사 끼임) + 다른 조건 + 추천 → 검출 (live ed05c6 결론 문장)', () => {
    const r = weakenSentence(CONCLUSION_LIVE, EV, { dimensions: ['남은 기간'] });
    expect(r.changes.map((c) => c.action)).toEqual(['weakened']);
    expect(r.after).not.toMatch(/월 70만 원을 장기간 납입할 수 있고/);
    expect(r.after).toMatch(/최대 70만원 한도 안에서 실제 납입 가능액 · 남은 기간을 함께 보고 납입을 이어갈 수 있고 .*유지하는 쪽이 맞습니다\.$/);
  });
  test('T3 상한 단순 설명 → 그대로 · T4 명시적 가정 계산 → 그대로', () => {
    for (const s of ['이 상품은 월 최대 70만원까지 자유롭게 납입할 수 있습니다.', '월 최대 70만원 한도지만 실제 납입액은 자유롭게 정할 수 있습니다.',
      '5년간 월 70만 원 납입이 가능한 경우에는 청년도약계좌의 총 납입 규모가 커집니다.', '매월 70만원을 납입한다고 가정하면 총 납입액은 4200만원입니다.',
      '청년미래적금은 최소 1000원부터 최대 50만 원까지 자유롭게 납입할 수 있어 납입 변동이 큰 경우에 구조가 더 단순합니다.']) {
      expect(weakenSentence(s, EV, { dimensions: ['남은 기간'] }).after).toBe(s);
    }
  });
  test('T5 근거가 요구(REQUIRED) 값이면 상한 오탐 없음 · 추천이 앞에 있으면 조건이 아님', () => {
    const req = '[E01] 이 적금은 월 30만원 이상 납입해야 한다. 최대 30만원 추가 납입 가능.';
    expect(weakenSentence('월 30만원을 납입할 수 있다면 이 적금을 선택하는 편이 낫습니다.', req).changes).toEqual([]);
    expect(weakenSentence('이 적금이 낫습니다, 월 70만원까지 납입할 수 있고요.', '[E01] 월 최대 70만원까지 납입할 수 있다.').changes).toEqual([]);
  });
  test('T6 답 상자에서도 같은 계약 — live 답 상자 원문을 answer-fidelity 로', () => {
    const body = plain(R.htmlFinal);
    const r = alignSummaryToBody(R.answerBox.answer, body, { dimensions: ['남은 기간'] });
    expect(r.changes.some((c) => c.rule === 'limit-as-condition' && /5년간 월 70만원 납입이 가능하고/.test(c.before))).toBe(true);
    expect(r.text).not.toMatch(/월 70만원 납입이 가능하고/);
  });
  test('T7 final-authority 가 최종 HTML 에서 재발을 막는다 — 결론·답 상자 모두', () => {
    const fa = runFinalAuthority({ html: R.htmlFinal, evidence: VIEW, keyword: R.keyword, dimensions: ['남은 기간'] });
    const out = plain(fa.html);
    expect(out).not.toMatch(/월 70만 원을 장기간 납입할 수 있고/);
    expect(out).not.toMatch(/5년간 월 70만원 납입이 가능하고/);
    expect(fa.report.decision.some((c) => c.action === 'weakened' && /장기간 납입할 수 있고/.test(c.sentence))).toBe(true);
    expect(fa.report.fact.status).toBe('passed');
    expect(out).toContain('월 최대 50만 원');                                                     // 정상 상한 설명은 그대로
  });
});

describe('RANGE (T8~T13) — 범위 근거의 두 끝 값만', () => {
  const L = ledgerFromItems([{ id: 'E01', text: '상품A 예상 우대금리 13.2~14.4% 수준이다. 신청은 10월 7~16일. 문의 02-123-4567 · https://a.example.com/13.2-14.4' }]);
  const at = (t: string) => checkClaims(t, L, new Date('2026-09-30'));
  test('T8 13.2~14.4% → 13.2% 지원 · T9 14.4% 지원', () => {
    expect(at('상품A 13.2%').supported).toMatchObject([{ claim: '13.2%', via: 'range-endpoint', sourceIds: ['E01'] }]);
    expect(at('상품A 14.4%').unsupported).toEqual([]);
    expect(at('상품A 13.2 퍼센트').unsupported).toEqual([]);
  });
  test('T10 중간값 13.8% 은 지원하지 않는다', () => {
    expect(at('상품A 13.8%').unsupported).toEqual(['13.8%']);
  });
  test('T11 주어가 다르면 끝 값도 지원하지 않는다', () => {
    expect(at('상품B 13.2%').unsupported).toEqual(['13.2%']);
  });
  test('T12 끝 값은 범위의 문맥(주어·상태 "예상")을 그대로 넘긴다', () => {
    expect(at('상품A 13.2%').supported[0]!.range).toMatchObject({ lower: 13.2, upper: 14.4, unit: '%' });
    expect(at('상품A 13.2%').supported[0]!.range!.context).toMatch(/상품A예상우대금리13\.2~14\.4%/);
  });
  test('T13 날짜·전화번호·URL 은 범위 끝 값이 되지 않는다 · 표기 변형(∼ – -) 은 같은 범위', () => {
    expect(at('10월 7일').unsupported).toEqual(['10월 7일']);                                  // 날짜는 대상 아님(예전과 같음)
    expect(at('상담 인원 123명').unsupported).toEqual(['123명']);                              // 전화번호 02-123-4567 은 범위가 아니다(단위 없음)
    expect(at('상품A 4567%').unsupported).toEqual(['4567%']);
    for (const f of ['13.2∼14.4%', '13.2–14.4%', '13.2-14.4%', '13.2 ~ 14.4%']) {
      expect(checkClaims('상품A 13.2%', ledgerFromItems([{ id: 'E09', text: `상품A 우대금리 ${f}` }])).unsupported).toEqual([]);
    }
  });
  test('live ed05c6 — 본문 사실 게이트의 "13.2%"·"18.2%" 오탐이 사라진다(BODY_FACT 수동검토 원인)', () => {
    const r = checkClaims(plain(R.htmlFinal), ledgerFromItems(ITEMS.map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` }))), new Date('2026-09-30T00:00:00+09:00'));
    expect(r.unsupported).not.toContain('13.2%');
    expect(r.unsupported).not.toContain('18.2%');
    expect(r.supported.filter((s) => s.via === 'range-endpoint').map((s) => s.claim).sort()).toEqual(['13.2%', '18.2%']);
  });
});

describe('교차 도메인 MOCK', () => {
  const cases: Array<[string, string, string]> = [
    ['자동차', '[E01] 이 차는 1회 충전 최대 500km 주행이 가능하다.', '한 번 충전으로 500km를 달릴 수 있다면 이 차를 선택하는 편이 낫다.'],
    ['여행', '[E01] 이 주차장은 최대 2시간 무료다.', '2시간 이용할 수 있다면 이 주차장을 선택하는 편이 맞습니다.'],
    ['IT', '[E01] 이 모델은 최대 1TB를 지원한다.', '1TB를 쓸 수 있다면 이 모델을 선택하는 편이 낫습니다.'],
    ['보험', '[E01] 보상 한도는 최대 100만원이다.', '100만원 보상받을 수 있다면 이 보험을 유지하는 쪽이 맞습니다.'],
  ];
  test.each(cases)('%s — 상한을 추천 조건으로 쓰면 검출(금액 외는 안전한 치환이 없어 FLAG, 금액은 약화)', (_label, ev, s) => {
    const r = weakenSentence(s, ev);
    expect(r.changes.length).toBe(1);
    expect(['weakened', 'flagged']).toContain(r.changes[0]!.action);
    if (r.changes[0]!.action === 'flagged') expect(r.after).toBe(s);                              // FLAG 는 문장을 바꾸지 않는다
  });
  test('RANGE — 보험료 3.2~4.1% → 3.2% 끝 값 지원, 3.7% 는 지원 아님', () => {
    const L = ledgerFromItems([{ id: 'E01', text: '보험료 인상률 3.2~4.1%' }]);
    expect(checkClaims('보험료 인상률 3.2%', L).unsupported).toEqual([]);
    expect(checkClaims('보험료 인상률 3.7%', L).unsupported).toEqual(['3.7%']);
  });
  test('하드코딩 없음', () => {
    const code = ['decision-semantics.ts', 'fact-claims.ts'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8')).join(' ').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/청년도약계좌|청년미래적금|70만|13\.2|14\.4|5년간/);
  });
});

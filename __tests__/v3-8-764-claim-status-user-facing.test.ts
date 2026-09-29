const fs = require('fs');
const path = require('path');

import { correctSentence, annotateText, annotateHtml, annotateArticle, sourceStatusForValue, INTERNAL_STATUS_TOKEN } from '../src/core/final/claim-status';
import { runFinalAuthority } from '../src/core/final/final-authority';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import type { FactEvidence } from '../src/core/final/fact-integrity';

/*
 * v3.8.764 — CLAIM STATUS USER-FACING FIDELITY. 강해진 문장 뒤에 면책문을 붙이지 않고, 술어를 근거의 상태로 고친다. 호출 0회.
 * 라이브 223b32(청년미래적금 VS 도약계좌) · ad0616(국민연금 조기수령) 픽스처 + 교차 도메인 MOCK.
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const R1 = read('__tests__/fixtures/run-223b32/run-inputs.json');
const R2 = read('__tests__/fixtures/run-ad0616/run-inputs.json');
const evidenceOf = (r: any) => r.stage2Items.map((i: any) => `[${i.id}] ${i.cleanedText}`).join('\n');
const viewOf = (r: any) => buildValidationEvidence(r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })), { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence).evidence;
const plain = (s: string) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const bodyOf = (d: any) => [d.introduction, ...(d.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content)), d.conclusion].join('\n');
const E1 = evidenceOf(R1);
const STATUS_WORDS = /계획|예정|추진|검토|예상|전망|목표|방안|조건/g;
const after = (s: string, ev: string) => correctSentence(s, ev);

describe('USER-FACING (T1~T9) — 면책문이 아니라 문장 자체가 근거의 상태를 말한다', () => {
  test('T1 계획 값을 확정 현재형으로 쓴 문장 → 자연스러운 계획 표현', () => {
    const src = '[E01] 현행 기여율은 12%이다. 기여율을 12%에서 15%로 높일 계획이다.';
    const r = after('기여율은 12%에서 15%로 개선됐습니다.', src)!;
    expect(r).toMatchObject({ action: 'rewritten', after: '기여율은 12%에서 15%로 개선될 계획입니다.' });
  });
  test('T2 조건부 — 근거의 조건절을 그대로 옮기고, 가능성("수 있다")도 남긴다. 조건을 지어내지 않는다', () => {
    const a = after('소득 기준을 충족하면 20%를 지원합니다.', '[E01] 예산 통과 시 20% 지원 예정이다.')!;
    expect(a.after).toBe('예산 통과 시 소득 기준을 충족하면 20%를 지원합니다.');
    const b = after('2회차 투어는 취소됩니다.', '[E01] 우천 시 2회차 투어가 취소될 수 있다.')!;
    expect(b.after).toBe('우천 시 2회차 투어는 취소될 수 있습니다.');
    // 조건절을 근거에서 못 읽으면 일반 표현만 쓴다(특정 조건을 만들지 않음)
    const c = after('지원율은 30%입니다.', '[E01] 요건이 바뀌면 지원율은 30%로 조정된다.')!;
    expect(c.after).not.toMatch(/통과|예산|승인/);
  });
  test('T3 예상 값 → "예상됩니다" 성격을 남긴다', () => {
    expect(after('만기 수령액은 900만원입니다.', '[E01] 만기 수령액은 약 900만원으로 예상된다.')!.after).toBe('만기 수령액은 900만원으로 예상됩니다.');
  });
  test('T4 추진 중인 안 + 예상액 → 두 속성 모두 보존 (live 223b32 최종 HTML 문장)', () => {
    const r = after('일반형은 약 2138만원, 우대형은 약 2313만원으로 제시됐습니다.', E1)!;
    expect(r.values.map((v) => [v.value, v.source.status, v.source.qualifier])).toEqual([['2138만원', 'PROPOSED', 'ESTIMATE'], ['2313만원', 'PROPOSED', 'ESTIMATE']]);
    expect(r.after).toBe('개편안 기준으로 일반형은 약 2138만원, 우대형은 약 2313만원으로 예상됩니다.');
  });
  test('T5 현재 확정 값은 약화하지 않는다', () => {
    const src = '[E01] 현행 지원율은 15%이다.';
    expect(after('지원율은 15%입니다.', src)).toBeNull();
    for (const v of ['12%', '6%', '7500만원', '50만원']) expect(sourceStatusForValue(v, E1).status).toBe('CURRENT_CONFIRMED');
  });
  test('T6 한 문장에 미확정 값 3개 → 상태는 문장에서 한 번, 값은 모두 남는다', () => {
    const src = '[E01] 일반형 기여율을 15%로, 지방은 25%로 높이고 한도를 270만원으로 늘릴 계획이다.';
    const r = after('일반형 15%, 지방 25%, 최대 270만원으로 개선됐다.', src)!;
    expect(r.after).toBe('일반형 15%, 지방 25%, 최대 270만원으로 개선될 계획이다.');
    expect(r.after.match(STATUS_WORDS)!.length).toBe(1);
    // 술어가 둘이면 앞은 "-고" 로 잇고 뒤에만 상태를 싣는다(근거 문장과 같은 짜임)
    const two = after('기여율은 15%로 개선됐으며, 지방은 25%이다.', src)!;
    expect(two.after).toBe('기여율은 15%로 개선되고, 지방은 25%가 될 계획이다.');
    expect(two.after.match(STATUS_WORDS)!.length).toBe(1);
  });
  test('T7 질문 문장에는 손대지 않는다 (live 223b32 FAQ 질문)', () => {
    const q = '청년미래적금 만기 수령액 2138만원과 2313만원은 확정 금액인가요?';
    expect(annotateText(q, E1)).toEqual({ text: q, changes: [] });
  });
  test('T8 내부 상태 토큰·괄호 표지는 본문·최종 HTML 에 없다 · 표 칸은 건드리지 않는다', () => {
    const leaked = annotateText("기여율은 15%로 개선됐습니다. [상태 주의 — 근거 기준 확정 값 아님: 15%: 예정('할 계획')]", '[E01] 기여율을 15%로 높일 계획이다.').text;
    expect(leaked).not.toMatch(INTERNAL_STATUS_TOKEN);
    const fa1 = runFinalAuthority({ html: R1.htmlFinal, evidence: viewOf(R1), keyword: R1.keyword });
    const fa2 = runFinalAuthority({ html: R2.htmlFinal, evidence: viewOf(R2), keyword: R2.keyword });
    for (const html of [fa1.html, fa2.html, bodyOf(annotateArticle(R1.draft011, E1).article)]) expect(plain(html)).not.toMatch(INTERNAL_STATUS_TOKEN);
    const table = '<table><tr><td>우대형 기여율</td><td>15%</td></tr></table>';
    expect(annotateHtml(table, '[E01] 기여율을 15%로 높일 계획이다.').html).toBe(table);
  });
  test('T9 강한 문장 + 뒤의 면책문 → 고친 문장만 남는다 · 못 고친 문장에는 면책문을 붙이지 않는다', () => {
    const src = '[E01] 기여율을 15%로 높일 계획이다.';
    const r = annotateText('기여율은 15%로 개선됐습니다. 다만 아직 확정된 것은 아닙니다. 신청은 온라인으로 합니다.', src);
    expect(r.text).toBe('기여율은 15%로 개선될 계획입니다. 신청은 온라인으로 합니다.');
    expect(r.changes[0]!.droppedDisclaimer).toBe('다만 아직 확정된 것은 아닙니다.');
    const old763 = annotateText('기여율은 15%로 개선됐습니다. 다만 근거상 현재 적용 중인 확정 값은 아닙니다(15% 계획 단계).', src);
    expect(old763.text).toBe('기여율은 15%로 개선될 계획입니다.');
    // 술어를 못 찾는 문장 · "현재" 로 못박은 문장은 그대로 두고 flagged — 덧붙이는 문장 없음
    const flagged = annotateText('지방 25퍼센트 기준과 소득 조건은 따로 구분해 봐야 하죠.', '[E01] 지방은 25%를 지원할 계획이다.');
    expect(flagged.changes.map((c) => c.action)).toEqual(['flagged']);
    expect(flagged.text).toBe('지방 25퍼센트 기준과 소득 조건은 따로 구분해 봐야 하죠.');
    expect(annotateText('현재 20%를 지원하고 있습니다.', '[E01] 예산 통과 시 20% 지원 예정이다.').changes[0]).toMatchObject({ action: 'flagged', reason: 'explicit-current' });
  });
});

describe('T10 live 223b32 — 15%·25%·270만원·2138·2313 의 의미 보존 (source → writer → final)', () => {
  test('초안: 세 문장을 근거 상태로 고치고, 가정 계산 문장·현재 값 문장은 그대로', () => {
    const cs = annotateArticle(R1.draft011, E1);
    const byBefore = Object.fromEntries(cs.changes.map((c) => [c.sentence, c]));
    expect(byBefore['청년미래적금 우대형의 기여금 매칭비율은 기존 12퍼센트에서 15퍼센트로 개선됐습니다.']!.after).toBe('청년미래적금 우대형의 기여금 매칭비율은 기존 12퍼센트에서 15퍼센트로 개선될 계획입니다.');
    expect(byBefore['지방 중소기업 근무자는 25퍼센트가 적용됩니다.']!.after).toBe('지방 중소기업 근무자는 25퍼센트가 적용될 계획입니다.');
    expect(byBefore['우대형 기여금은 기존 최대 216만원에서 270만원으로 늘어나는 구조입니다.']!.after).toBe('우대형 기여금은 기존 최대 216만원에서 270만원으로 늘어나는 방향으로 추진되고 있습니다.');
    const body = plain(bodyOf(cs.article));
    expect(body).toContain('정부가 제시한 연 8퍼센트 금리 가정에서는 일반형 만기 수령액이 약 2138만원');   // 이미 "가정" — 무변경
    expect(body).not.toMatch(/15퍼센트로 개선됐습니다|25퍼센트가 적용됩니다|270만원으로 늘어나는 구조입니다/);
  });
  test('최종 HTML(final-authority): 강한 문장 0 · 값은 삭제되지 않음 · fact passed · FAQ 수 불변', () => {
    const fa = runFinalAuthority({ html: R1.htmlFinal, evidence: viewOf(R1), keyword: R1.keyword });
    const out = plain(fa.html);
    expect(out).toContain('15퍼센트로 개선될 계획입니다.');
    expect(out).toContain('지방 중소기업 근무자는 25퍼센트가 적용될 계획이죠.');
    expect(out).toContain('270만원으로 늘어나는 방향으로 추진되고 있습니다.');
    expect(out).toContain('개편안 기준으로 일반형은 약 2138만원, 우대형은 약 2313만원으로 예상됩니다.');
    expect(out).not.toMatch(/15퍼센트로 개선됐습니다|25퍼센트가 적용되죠|270만원으로 늘어나는 구조입니다|(?<!개편안 기준으로 )일반형은 약 2138만원, 우대형은 약 2313만원으로 제시됐습니다/);
    expect(out).toContain('연 8퍼센트 금리 가정에서는 일반형 만기 수령액이 약 2138만원, 우대형은 약 2313만원으로 제시됐습니다.');   // 이미 "가정" — 무변경
    for (const v of ['15퍼센트', '25퍼센트', '270만원', '2138만원', '2313만원']) expect(out.split(v).length).toBe(plain(R1.htmlFinal).split(v).length);   // 숫자 자체는 그대로
    expect(fa.report.fact.status).toBe('passed');
    expect(fa.report.faq.after).toBe(fa.report.faq.before);
    expect(fa.report.status.some((s) => /확정 금액인가요\?/.test(s.sentence))).toBe(false);
  });
  test('2편(ad0616) 회귀 — 현재 공식 규칙을 예정·추진으로 약화하지 않는다', () => {
    const cs = annotateArticle(R2.draft011, evidenceOf(R2));
    expect(cs.changes).toEqual([]);
    const fa = runFinalAuthority({ html: R2.htmlFinal, evidence: viewOf(R2), keyword: R2.keyword });
    expect(fa.report.status).toEqual([]);
    expect(fa.report.answer.changes).toEqual([]);
    expect(fa.report.faq).toMatchObject({ before: 3, after: 3, ldSynced: true });
  });
});

describe('교차 도메인 MOCK — 상태를 현재 사실로 쓰지 않는다 (정책·자동차·보험·IT·기업·여행)', () => {
  const cases: Array<[string, string, string, string, RegExp]> = [
    ['정책', '[E01] 예산 통과 시 20% 지원 예정이다.', '소득 기준을 충족하면 20%를 지원합니다.', '예산 통과 시 소득 기준을 충족하면 20%를 지원합니다.', /^(?!.*현재).*/],
    ['자동차', '[E01] 내년 출시 모델은 최대 600km 주행을 목표로 한다.', '이 모델은 최대 600km를 달립니다.', '이 모델은 최대 600km를 달리는 것을 목표로 하고 있습니다.', /목표/],
    ['보험', '[E01] 개정 약관은 적용 예정이며 자기부담금은 30%로 바뀔 예정이다.', '자기부담금은 30%입니다.', '자기부담금은 30%가 될 예정입니다.', /예정/],
    ['IT', '[E01] 향후 업데이트에서 최대 2TB 저장을 지원할 계획이다.', '이 서비스는 최대 2TB 저장을 지원합니다.', '이 서비스는 최대 2TB 저장을 지원할 계획입니다.', /계획/],
    ['기업', '[E01] 회사는 내년 매출이 1조원에 이를 것으로 전망했다.', '회사는 매출 1조원을 달성했습니다.', '회사는 매출 1조원을 달성할 것으로 전망됩니다.', /전망/],
    ['여행', '[E01] 우천 시 2회차 투어가 취소될 수 있다.', '2회차 투어는 취소됩니다.', '우천 시 2회차 투어는 취소될 수 있습니다.', /수 있/],
  ];
  test.each(cases)('%s', (_label, src, strong, expected, keeps) => {
    const r = after(strong, src)!;
    expect(r).toMatchObject({ action: 'rewritten', after: expected });
    expect(r.after).toMatch(keeps);
    expect(after(r.after, src)).toBeNull();                                                    // 고친 문장은 더 강화로 잡히지 않는다
  });
  test('"현재" 로 못박은 문장은 고치지 않고 FLAG — "현재 … 예정" 모순을 만들지 않는다', () => {
    expect(after('현재 계약의 자기부담금은 30%입니다.', cases[2]![1])).toMatchObject({ action: 'flagged', reason: 'explicit-current', after: '현재 계약의 자기부담금은 30%입니다.' });
  });
});

const fs = require('fs');
const path = require('path');

import { classifyClaimStatus, sourceStatusForValue, findStrengthenedValues, annotateText, annotateClaims, annotatePacket, annotateArticle, restoreFractionNotation, STATUS_STRENGTH } from '../src/core/final/claim-status';
import { dropDeferralSentences, isInformativeDistinction } from '../src/core/final/answer-block';
import { weakenSentence } from '../src/core/final/decision-semantics';
import { buildWriterPacketView } from '../src/core/final/writer-packet-view';
import { runFinalAuthority } from '../src/core/final/final-authority';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import type { FactEvidence } from '../src/core/final/fact-integrity';

/*
 * v3.8.763 — CLAIM STATUS PRESERVATION. 라이브 223b32(청년미래적금 VS 도약계좌)·ad0616(국민연금 조기수령) 픽스처 + 교차 도메인 MOCK. 호출 0회.
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const R1 = read('__tests__/fixtures/run-223b32/run-inputs.json');
const R2 = read('__tests__/fixtures/run-ad0616/run-inputs.json');
const evidenceOf = (r: any) => r.stage2Items.map((i: any) => `[${i.id}] ${i.cleanedText}`).join('\n');
const viewOf = (r: any) => buildValidationEvidence(r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })), { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence).evidence;
const plain = (s: string) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const E1 = evidenceOf(R1);
const bodyOf = (d: any) => [d.introduction, ...(d.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content)), d.conclusion].join('\n');

describe('STATUS (T1~T6) — 패킷·본문은 근거보다 확정성을 높일 수 없다', () => {
  const SRC = '[E01] 예산 통과 시 지원율을 20%로 확대할 예정이다. 현행 지원율은 15%이다. 지원 상한을 100만원으로 높이는 방안을 추진한다. 만기 수령액은 약 900만원으로 예상된다. 2027년부터 새 요율이 시행된다.';
  test('T1 conditional → current 거절 · T2 proposed → current 거절 · T3 estimated → exact 거절 · T5 future confirmed → current 거절', () => {
    expect(classifyClaimStatus('예산 통과 시 지원율을 20%로 확대할 예정이다.').status).toBe('CONDITIONAL');
    expect(sourceStatusForValue('20%', SRC).status).toBe('CONDITIONAL');
    expect(findStrengthenedValues('지원율은 20%입니다.', SRC).map((v) => [v.value, v.source.status, v.claimStatus])).toEqual([['20%', 'CONDITIONAL', 'CURRENT_CONFIRMED']]);
    expect(sourceStatusForValue('100만원', SRC).status).toBe('PROPOSED');
    expect(findStrengthenedValues('지원 상한은 100만원입니다.', SRC).length).toBe(1);
    expect(sourceStatusForValue('900만원', SRC).status).toBe('ESTIMATED');
    expect(findStrengthenedValues('만기 수령액은 900만원입니다.', SRC).length).toBe(1);
    expect(sourceStatusForValue('2027년', SRC).status).toBe('FUTURE_CONFIRMED');
    // 연도 단독은 값이 아니라 대상에서 뺀다 — 대신 "2027년부터 시행" 문장의 다른 값이 있으면 그것으로 본다
    expect(findStrengthenedValues('새 요율이 지금 시행됩니다.', SRC)).toEqual([]);
    expect(STATUS_STRENGTH.CURRENT_CONFIRMED).toBeGreaterThan(STATUS_STRENGTH.FUTURE_CONFIRMED);
  });
  test('T4 current → current 허용 · T6 더 약한 표현 허용', () => {
    expect(sourceStatusForValue('15%', SRC).status).toBe('CURRENT_CONFIRMED');
    expect(findStrengthenedValues('현행 지원율은 15%입니다.', SRC)).toEqual([]);
    expect(findStrengthenedValues('예산이 통과되면 지원율은 20%로 확대될 예정입니다.', SRC)).toEqual([]);          // 같은 상태
    expect(findStrengthenedValues('지원율을 20%로 높이는 방안이 검토되고 있습니다.', SRC)).toEqual([]);          // 더 약함(PROPOSED < CONDITIONAL 강도? → 조건부보다 약하거나 같으면 허용)
    expect(findStrengthenedValues('수령액은 약 900만원으로 추산됩니다.', SRC)).toEqual([]);
  });
  test('T7 값이 같아도 상태가 다르면 다른 사실 · T8 조건부 값 여러 개 중 하나만 현재로 떨어지지 않음', () => {
    const src = '[E01] 현행 기여율은 12%이다. 개편안은 기여율을 12%에서 15%로, 지방은 25%로 높이는 방안을 담았다. 통과 시 기존 가입자에게 소급 적용 예정.';
    expect(sourceStatusForValue('12%', src).status).toBe('CURRENT_CONFIRMED');
    expect(sourceStatusForValue('15%', src).status).not.toBe('CURRENT_CONFIRMED');
    expect(sourceStatusForValue('25%', src).status).not.toBe('CURRENT_CONFIRMED');
    const both = findStrengthenedValues('기여율은 15%로 개선됐고 지방은 25%가 적용됩니다.', src);
    expect(both.map((v) => v.value).sort()).toEqual(['15%', '25%']);
    // v3.8.764 — 면책문을 덧붙이지 않고 술어를 고친다(두 값이 한 술어·두 술어로 나뉘어도 상태는 한 번)
    const a = annotateText('기여율은 15%로 개선됐고 지방은 25%가 적용됩니다.', src);
    expect(a.changes.map((c) => c.action)).toEqual(['rewritten']);
    expect(a.text).not.toMatch(/개선됐|적용됩니다|확정 값은 아닙니다|\[상태 주의/);
    expect(annotateText('기여율은 12%입니다.', src).changes).toEqual([]);
  });
  test('T7b 두 번 돌아도 결과가 같다 · 질문 문장은 건너뜀 · Writer 가 옮긴 패킷 주석은 지워진다', () => {
    const src = '[E01] 현행 기여율은 12%이다. 개편안은 기여율을 12%에서 15%로 높이는 방안을 담았다.';
    const once = annotateText('기여율은 15%로 개선됐습니다. 다음 문단입니다.', src).text;
    const twice = annotateText(once, src);
    expect(twice.text).toBe(once);
    expect(twice.changes).toEqual([]);
    expect(annotateText('기여율 15%는 확정된 값인가요?', src).changes).toEqual([]);
    const leaked = annotateText("기여율은 15%로 개선됐습니다. [상태 주의 — 근거 기준 확정 값 아님: 15%: 추진·검토('방안을 담')]", src).text;
    expect(leaked).not.toContain('[상태 주의');
    expect(leaked).not.toContain('개선됐습니다');
  });
});

describe('live 223b32 — 15%·25%·270만원·2138·2313 의 source → packet → writer → final', () => {
  test('근거 상태: 15%·25% 예정/추진, 270만원 추정, 2138·2313 개편안(추진)·예상 · 12%·6%·7500만원은 현재', () => {
    expect(['PLANNED', 'PROPOSED']).toContain(sourceStatusForValue('15%', E1).status);
    expect(['PLANNED', 'PROPOSED']).toContain(sourceStatusForValue('25%', E1).status);
    expect(['ESTIMATED', 'PROPOSED', 'CONDITIONAL']).toContain(sourceStatusForValue('270만원', E1).status);
    expect(['ESTIMATED', 'PROPOSED']).toContain(sourceStatusForValue('2138만원', E1).status);
    expect(['ESTIMATED', 'PROPOSED']).toContain(sourceStatusForValue('2313만원', E1).status);
    for (const v of ['12%', '6%', '7500만원', '50만원']) expect(sourceStatusForValue(v, E1).status).toBe('CURRENT_CONFIRMED');
  });
  test('PACKET: 라이브 패킷 문장 "15%로 개선됐으며 … 25%이다" 를 근거 상태로 고쳐 쓰고(메타는 따로), 값 15%·25% 는 CORE 에서 내려간다', () => {
    const claim = (R1.packetRaw.facts || []).find((c: any) => /15%/.test(c.claim));
    expect(claim.claim).toContain('개선됐으며');                                                    // BEFORE(라이브)
    const r = annotateClaims([claim], E1);
    expect(r.changed).toBe(1);
    expect(r.claims[0]!.claim).toBe('청년미래적금 우대형 기여금 매칭비율은 기존 12%에서 15%로 개선되고, 지방 중소기업 근무 시 25%가 될 계획이다.');
    expect(r.claims[0]!.statusNote).toMatch(/\[상태 주의 — 근거 기준 확정 값 아님: 15%: (?:예정|추진·검토)\(.*\) · 25%: (?:예정|추진·검토)/);   // 메타(trace 용)
    const p = annotatePacket(R1.packetRaw, E1);
    expect(p.claimChanges).toBeGreaterThanOrEqual(1);
    const st = Object.fromEntries(p.valueStatuses.map((v) => [v.value, v.status]));
    expect(st['12%']).toBeUndefined(); expect(st['50만원']).toBeUndefined(); expect(st['6%']).toBeUndefined();   // 현재 값은 표시하지 않는다
    const view = buildWriterPacketView(p.packet, { keyword: R1.keyword, title: R1.keyword, h2Titles: [], searchIntent: R1.searchIntent });
    expect(view.text).toContain('15%로 개선되고, 지방 중소기업 근무 시 25%가 될 계획이다.');
    expect(view.text).not.toMatch(/\[상태 주의|PLANNED|PROPOSED/);
    // 값 목록에 예정·조건부 값이 있으면 핵심 수치(판단 기준)에 오르지 않고 상태 이름표를 단다 — 합성 값으로 확인
    const withPlanned = annotatePacket({ ...R1.packetRaw, numbers: [...(R1.packetRaw.numbers || []), { value: '15%', context: '우대형 기여율 12→15% 추진', sourceIds: ['E02'] }] }, E1);
    expect(withPlanned.valueStatuses.find((v) => v.value === '15%')).toBeDefined();
    const text2 = buildWriterPacketView(withPlanned.packet, { keyword: R1.keyword, title: R1.keyword, h2Titles: [], searchIntent: R1.searchIntent }).text;
    const coreBlock = text2.slice(text2.indexOf('핵심 수치'), text2.indexOf('핵심 날짜') > 0 ? text2.indexOf('핵심 날짜') : undefined);
    expect(coreBlock).not.toMatch(/^- 15% /m);                                                    // 예정 값은 판단 기준 아님
    expect(text2).toMatch(/- 15% — \(근거상 (?:계획 단계|추진·검토 단계) 값, 현재 시행 값 아님\)/);
  });
  test('WRITER→FINAL: 라이브 본문 문장 3건을 근거 상태로 고침, 2138·2313("가정") 은 그대로, 현재 값 문장은 그대로', () => {
    const cs = annotateArticle(R1.draft011, E1);
    const flagged = cs.changes.map((c) => c.sentence);
    expect(flagged.some((s) => /15퍼센트로 개선됐습니다/.test(s))).toBe(true);
    expect(flagged.some((s) => /25퍼센트가 적용/.test(s))).toBe(true);
    expect(flagged.some((s) => /270만원으로 늘어나는 구조/.test(s))).toBe(true);
    expect(flagged.some((s) => /2138만원/.test(s))).toBe(false);                                       // "연 8퍼센트 금리 가정" 이 이미 추정 상태
    expect(flagged.some((s) => /총급여 7500만원 이하/.test(s))).toBe(false);
    expect(flagged.some((s) => /6퍼센트 정부 기여금을 받을 수 있습니다/.test(s))).toBe(false);
    expect(bodyOf(cs.article)).toContain('15퍼센트로 개선될 계획입니다.');
    expect(bodyOf(cs.article)).not.toMatch(/\[상태 주의|확정 값은 아닙니다/);                            // 독자에게 내부 표지·면책문을 보이지 않는다
    // 초안에서 고친 본문을 final-authority 가 다시 돌아도 또 고치지 않는다
    const again = annotateArticle(cs.article, E1);
    expect(again.changes).toEqual([]);
    // 최종 HTML 에서도 final-authority 가 같은 방식으로 고친다(늦은 재작성이 되돌렸을 때의 안전망)
    const fa = runFinalAuthority({ html: R1.htmlFinal, evidence: viewOf(R1), keyword: R1.keyword });
    expect(fa.report.status.filter((s) => s.action === 'rewritten').length).toBeGreaterThanOrEqual(3);
    expect(plain(fa.html)).toContain('15퍼센트로 개선될 계획입니다.');
    expect(fa.report.status.some((s) => /확정 금액인가요\?/.test(s.sentence))).toBe(false);          // 질문은 주장이 아니다
    expect(fa.report.fact.status).toBe('passed');
  });
});

describe('ANSWER AVOIDANCE (T9~T10)', () => {
  test('T9 두 판단축을 가르는 문장은 보존 — live 223b32 답 상자 셋째 문장', () => {
    const third = '총급여 6000만원을 넘는 경우에는 청년미래적금 가입 가능 여부와 정부 기여금 수령 여부를 분리해서 봐야 합니다.';
    expect(isInformativeDistinction(third)).toBe(true);
    expect(dropDeferralSentences(R1.answerBox.answer)).toContain(third);                             // BEFORE: 이 문장이 빠졌다
    expect(dropDeferralSentences('가입 조건과 기여금 조건은 분리해서 봐야 합니다. 신청은 10월입니다.')).toContain('분리해서 봐야 합니다');
    expect(dropDeferralSentences('A 는 B 와 같은 기준이 아닙니다. 신청은 10월입니다.')).toContain('같은 기준이 아닙니다');
  });
  test('T10 정보축 없는 회피 문장은 예전대로 빠진다', () => {
    expect(isInformativeDistinction('자세한 내용은 확인해야 합니다.')).toBe(false);
    expect(dropDeferralSentences('신청은 10월입니다. 자세한 내용은 확인해야 합니다.')).toBe('신청은 10월입니다.');
    expect(dropDeferralSentences('신청은 10월입니다. 세부 기준은 공고에 따라 달라질 수 있습니다.')).toBe('신청은 10월입니다.');
  });
});

describe('FRACTION (T11~T13)', () => {
  const EV = '[E05] 가입기간 10년 기준 50%에 1년마다 5%를 가산(1년 미만이면 매 1개월마다 5/12% 가산). 발표일 2026/9/29, 참고 https://www.nps.or.kr/a/b/c 9/29 안내';
  test('T11 5/12% 보존 · T12 "5분의 12퍼센트"·"12분의 5퍼센트" → 5/12% 로 복원(live ad0616 초안)', () => {
    expect(restoreFractionNotation('<p>매 1개월마다 5/12%를 가산합니다.</p>', EV).restored).toEqual([]);
    const r = restoreFractionNotation('<p>1년 미만은 매 1개월마다 5분의 12퍼센트를 더합니다. 다른 표기로 12분의 5퍼센트.</p>', EV);
    expect(r.html).toBe('<p>1년 미만은 매 1개월마다 5/12%를 더합니다. 다른 표기로 5/12%.</p>');
    expect(r.restored.length).toBe(2);
    const live = annotateArticle(R2.draft011, evidenceOf(R2));
    expect(live.fractions.map((f) => [f.from, f.to])).toEqual([['5분의 12퍼센트', '5/12%']]);
    expect(bodyOf(live.article)).toContain('5/12%');
    expect(bodyOf(R2.draft011)).toContain('5분의 12퍼센트');                                        // BEFORE
  });
  test('T13 URL·날짜의 슬래시는 분수로 보지 않는다 · 근거에 % 붙은 분수만 대상', () => {
    const r = restoreFractionNotation('<p>발표 9/29, 주소 /a/b/c, 2026/9/29. 5분의 12퍼센트.</p>', EV);
    expect(r.html).toContain('발표 9/29, 주소 /a/b/c, 2026/9/29.');
    expect(r.restored.length).toBe(1);
    expect(restoreFractionNotation('<p>3분의 1 상한.</p>', '[E01] 보증금 증액 한도는 20분의 1 이다. 날짜 1/3').restored).toEqual([]);   // % 없는 분수는 대상 아님
  });
});

describe('MAXIMUM 경계 (T14~T16)', () => {
  const E = '청년도약계좌는 5년 동안 월 최대 70만원을 납입할 수 있다. 지원금은 최대 100만원까지.';
  test('T14 상한 값이 추천 조건절의 직접 선행 조건이면 검출·약화 — live 223b32 경계 문형 2건', () => {
    const a = weakenSentence('월 50만원을 3년 동안 모으는 계획이면 청년미래적금이 맞고, 월 70만원 한도로 5년 저축을 유지할 수 있으면 청년도약계좌가 맞습니다.', E, { dimensions: ['남은 기간'] });
    expect(a.changes[0]).toMatchObject({ action: 'weakened', value: '70만원' });
    expect(a.after).toContain('최대 70만원 한도 안에서 실제 납입 가능액 · 남은 기간을 함께 보고 납입을 이어갈 수 있으면 청년도약계좌가 맞습니다');
    expect(weakenSentence('5년 동안 월 70만원 한도를 유지할 수 있으면 청년도약계좌의 기여금 구조를 봅니다.', E).changes.length).toBe(1);
    expect(weakenSentence('70만원까지 유지 가능하면 유지가 맞습니다.', E).changes.length).toBe(1);
    expect(weakenSentence('70만원 수준을 유지할 여력이 있으면 그 계좌를 선택합니다.', E).changes.length).toBe(1);
    const f = weakenSentence('100만원을 받아야 유지됩니다.', E);                                          // F 금액: 하다 동사 밖 서술은 검출(기록)
    expect(f.changes.length).toBe(1);
  });
  test('T15 상한 단순 설명 · 추천 없는 조건절 → 그대로', () => {
    expect(weakenSentence('월 최대 70만원 한도 안에서 실제 납입액을 정할 수 있다.', E).changes).toEqual([]);
    expect(weakenSentence('청년도약계좌는 5년 동안 월 70만원 한도에서 저축하는 구조죠.', E).changes).toEqual([]);
    expect(weakenSentence('70만원 한도는 납입 상한이고, 최대 6퍼센트는 정부 기여금 조건입니다.', E).changes).toEqual([]);
    expect(weakenSentence('최대 100만원까지 지원됩니다.', E).changes).toEqual([]);
  });
  test('T16 명시적 가정 계산은 허용', () => {
    expect(weakenSentence('매월 70만원을 넣는다고 가정하면 총납입액은 4200만원입니다.', E).changes).toEqual([]);
    expect(weakenSentence('월 50만원을 3년간 모두 납입한다고 가정하면 원금은 1800만원입니다.', E).changes).toEqual([]);
  });
});

describe('교차 도메인 MOCK (A~F) · 회귀', () => {
  test('A 정책 · B 자동차 · C 보험 · D 여행 · E IT — 조건부/예정을 현재로 쓰면 검출, 같은 상태는 통과', () => {
    const cases: Array<[string, string, string, string]> = [
      ['[E01] 예산 통과 시 지원율을 20%로 확대할 예정이다.', '지원율은 20%입니다.', '20%', '예산 통과 시 지원율 20% 확대 예정입니다.'],
      ['[E01] 내년 출시 예정 모델은 최대 주행거리 600km를 목표로 한다.', '현재 모델의 주행거리는 600km입니다.', '600km', '내년 출시 예정 모델은 600km를 목표로 합니다.'],
      ['[E01] 개정 약관은 2027년 3월부터 적용 예정이며 자기부담금은 30%로 바뀔 예정이다.', '자기부담금은 30%입니다.', '30%', '개정 약관 적용 예정 자기부담금은 30%로 바뀔 예정입니다.'],
      ['[E01] 우천 시 행사가 취소될 예정이며 환불은 100%로 안내될 예정이다.', '행사는 취소되고 환불은 100%입니다.', '100%', '우천 시 취소 예정이며 환불은 100% 예정입니다.'],
      ['[E01] 향후 업데이트에서 최대 2TB 저장을 지원할 계획이다.', '현재 최대 2TB 저장을 지원합니다.', '2TB', '향후 업데이트에서 2TB 지원 계획입니다.'],
    ];
    for (const [src, strong, value, weak] of cases) {
      const s = findStrengthenedValues(strong, src);
      expect(s.map((v) => v.value)).toContain(value);
      expect(findStrengthenedValues(weak, src)).toEqual([]);
    }
  });
  test('F 금액 · 2편 회귀 — 현재 공식 조건이 괜히 조건부로 약화되지 않는다 · 답 상자·FAQ 변경 0', () => {
    const E2 = evidenceOf(R2);
    for (const v of ['10년', '6%', '30%', '319만3511원', '519만원', '70%']) expect(['CURRENT_CONFIRMED', 'UNKNOWN']).toContain(sourceStatusForValue(v, E2).status);
    const cs = annotateArticle(R2.draft011, E2);
    expect(cs.changes.filter((c) => /가입기간 10년|30퍼센트|519만원|3,193,511원/.test(c.sentence)).length).toBe(0);
    const fa = runFinalAuthority({ html: R2.htmlFinal, evidence: viewOf(R2), keyword: R2.keyword });
    expect(fa.report.answer.changes).toEqual([]);
    expect(fa.report.faq).toMatchObject({ before: 3, after: 3, ldSynced: true });
    expect(fa.report.fractions.map((f) => f.to)).toEqual(['5/12%']);
    expect(fa.report.fact.status).toBe('passed');
  });
  test('하드코딩 없음 — claim-status 코드에 정책 용어·상품명·이번 값이 없다', () => {
    const code = ['claim-status.ts', 'claim-status-rewrite.ts'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8')).join(' ').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/예산안|2027|청년미래적금|도약계좌|국민연금|15%|25%|270만|소급|2138|2313/);
  });
});

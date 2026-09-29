const fs = require('fs');
const path = require('path');

import { renderEvidence } from '../src/core/final/evidence';
import { planCoreQuestions, coverCoreQuestions } from '../src/core/final/core-questions';
import { officialAnswers, currentOfficialIds, reservationsFor, coreAnswerCoverage, findAnswerContradictions, claimSupportOf, checkTitleEpistemics, answerPolarity } from '../src/core/final/core-answer';
import { buildPromiseSearchQuery, promiseChunks } from '../src/core/final/promise-grounding';
import { sourceStatusForValue, findStrengthenedValues } from '../src/core/final/claim-status';
import { gateRewrite } from '../src/core/final/fact-guard';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { containsValueToken, normalizeForMatch, wonAmount } from '../src/core/final/number-token';
import { inspectFactIntegrity, type FactEvidence } from '../src/core/final/fact-integrity';

/*
 * v3.8.765 — EVIDENCE DECISION INTEGRITY. 라이브 run 111bcf(청년미래적금 VS 청년 도약계좌, FINAL C) 저장 입력 오프라인 재생 + 합성·교차 도메인. 호출 0회.
 */
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-111bcf', 'run-inputs.json'), 'utf8'));
const itemsOf = (r: any) => r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null }));
const ITEMS = itemsOf(R);
const EV = ITEMS.map((i: any) => `[${i.id}] ${i.cleanedText}`).join('\n');
const PLAN = planCoreQuestions({ keyword: R.keyword, searchIntent: R.searchIntent, readerQuestions: R.titleInputs.kinQuestions.map((q: string) => q.replace(/^Q\.\s*/, '')) });
const ANSWERS = officialAnswers(ITEMS, currentOfficialIds(ITEMS, R.officialStatus), PLAN);
const VIEW = buildValidationEvidence(ITEMS, { provider: 'Naver Grounding', trustLevel: 'weak', topic: R.keyword, context: '' } as FactEvidence).evidence;
const plainOf = (s: string) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** 합성 근거 — 공식 문서 하나(현재 회차) + 지난 회차 기사 하나 */
const mkItems = (official: string, old: string) => [
  { id: 'E01', url: 'https://example.go.kr/notice/2', title: '이번 회차 공고', domain: 'example.go.kr', sourceType: 'government', isOfficial: true, hasBody: true, pubDate: '', cleanedText: official, mainKeyword: '상품A VS 상품B', sourceName: 'example', retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null },
  { id: 'E02', url: 'https://news.example.com/old', title: '지난 기사', domain: 'news.example.com', sourceType: 'news', isOfficial: false, hasBody: true, pubDate: '', cleanedText: old, mainKeyword: '상품A VS 상품B', sourceName: 'news', retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null },
] as any[];
const STATUS_OK = { candidates: [{ url: 'https://example.go.kr/notice/2', roundRelevance: 'current', status: 'body' }] };
const SWITCH_PLAN = planCoreQuestions({ keyword: '상품A VS 상품B', readerQuestions: ['상품A 가입자인데 상품B로 갈아타기 고민중'] });

describe('0. 실패 재현 — run 111bcf 의 저장 입력이 그대로 재생된다', () => {
  test('근거 렌더를 같은 입력으로 다시 돌리면 라이브 Writer 근거 블록과 글자까지 같다(재생 신뢰도)', () => {
    expect(renderEvidence(ITEMS, 11000).text).toBe(R.stage2Render.text);
  });
  test('제목 입력 복원: 크롤 제목에 지난 회차 기사 "갈아타는 건 \'6월만\' 허용", 패킷 글 앞 5000자에는 갈아타기 언급 0, 수요 힌트는 UNKNOWN', () => {
    expect(R.titleInputs.crawledTitles.some((t: any) => /6월만/.test(t.title))).toBe(true);
    expect((R.titleInputs.packetText5000.match(/갈아/g) || []).length).toBe(0);
    expect(R.titleInputs.demandTitleHint).toMatch(/UNKNOWN/);
    expect(R.titleFinal).toMatch(/갈아타기 불가/);
  });
});

describe('CORE ANSWER COVERAGE (T1~T3)', () => {
  test('T1 현재 공식 문서(fsc 2차 공고)에 직접 답 있음 → YES · 예약으로 Writer 근거에 실린다 (BEFORE FOUND_NOT_DELIVERED → AFTER FOUND_AND_DELIVERED)', () => {
    const sw = ANSWERS.find((a) => a.cqId === 'CQ-SWITCH-AVAILABILITY')!;
    expect(sw).toMatchObject({ verdict: 'YES', sourceIds: ['E06'] });
    expect(sw.spans.some((s) => /갈아탈 수 있는 기회/.test(s.sentence))).toBe(true);
    expect(coreAnswerCoverage(ANSWERS, R.stage2Render.text)[0]!.state).toBe('FOUND_NOT_DELIVERED');   // BEFORE(라이브)
    const after = renderEvidence(ITEMS, 11000, { reserve: reservationsFor(ANSWERS), bindQualifiers: true });
    expect(coreAnswerCoverage(ANSWERS, after.text)[0]!.state).toBe('FOUND_AND_DELIVERED');
    expect(after.text.length).toBeLessThanOrEqual(11000);                                        // 예산 그대로
  });
  test('T2 답 문장이 점수 경쟁에서 밀려도 예약으로 보존 — 문서 상한·전체 예산 안에서', () => {
    const noise = Array.from({ length: 40 }, (_, i) => `월 ${i + 10}만원 이하 소득 조건과 한도 ${i + 3}%·기간 ${i + 2}개월 요건이 적용된다.`).join(' ');
    const items = mkItems(`${noise} 이번 모집에서는 기존 가입자가 상품B로 갈아탈 수 있는 기회를 추가로 제공한다.`, '지난 기사 본문.');
    const answers = officialAnswers(items, currentOfficialIds(items, STATUS_OK), SWITCH_PLAN);
    expect(coreAnswerCoverage(answers, renderEvidence(items, 700).text)[0]!.state).toBe('FOUND_NOT_DELIVERED');
    expect(coreAnswerCoverage(answers, renderEvidence(items, 700, { reserve: reservationsFor(answers) }).text)[0]!.state).toBe('FOUND_AND_DELIVERED');
  });
  test('T3 원문에 답이 없으면 만들지 않는다 — NOT_FOUND_IN_SOURCE · 예약 0 · 공식 문서 없으면 SOURCE_NOT_AVAILABLE', () => {
    const items = mkItems('이번 모집 신청은 10월 7일부터다. 소득 기준은 7500만원 이하다.', '지난 기사.');
    const answers = officialAnswers(items, currentOfficialIds(items, STATUS_OK), SWITCH_PLAN);
    expect(answers[0]!.verdict).toBe('NONE');
    expect(reservationsFor(answers)).toEqual([]);
    expect(coreAnswerCoverage(answers, 'x')[0]!.state).toBe('NOT_FOUND_IN_SOURCE');
    const none = officialAnswers(items, currentOfficialIds(items, { candidates: [] }), SWITCH_PLAN);
    expect(coreAnswerCoverage(none, 'x')[0]!.state).toBe('SOURCE_NOT_AVAILABLE');
  });
});

describe('TITLE (T4~T6)', () => {
  test('T4 핵심 답이 없거나 갈리면 제목의 가능/불가를 중립으로', () => {
    const items = mkItems('신청은 10월 7일부터다.', '지난 기사.');
    const answers = officialAnswers(items, currentOfficialIds(items, STATUS_OK), SWITCH_PLAN);
    const r = checkTitleEpistemics('상품A VS 상품B 갈아타기 불가', answers);
    expect(r).toMatchObject({ title: '상품A VS 상품B 갈아타기 조건', changed: true });
    expect(r.claims[0]).toMatchObject({ support: 'UNRESOLVED' });
    // 물음 꼴은 결론이 아니다
    expect(checkTitleEpistemics('상품A 갈아타기 가능할까?', answers).changed).toBe(false);
  });
  test('T5 현재 공식 답이 확인한 결론은 제목에 써도 된다 · 반대 결론은 중립으로(자동 반전 없음) — live 111bcf 제목', () => {
    const items = mkItems('이번 모집에서는 기존 가입자가 상품B로 갈아탈 수 있는 기회를 추가로 제공한다.', '지난 기사.');
    const answers = officialAnswers(items, currentOfficialIds(items, STATUS_OK), SWITCH_PLAN);
    expect(checkTitleEpistemics('상품A 가입자 상품B 갈아타기 가능', answers)).toMatchObject({ changed: false, claims: [{ support: 'SUPPORTED' }] });
    const live = checkTitleEpistemics(R.titleFinal, ANSWERS);
    expect(live).toMatchObject({ title: '2026년 청년미래적금 VS 청년 도약계좌 갈아타기 조건', changed: true });
    expect(live.claims[0]).toMatchObject({ polarity: 'NO', support: 'CONTRADICTED', official: 'YES', sourceIds: ['E06'] });
  });
  test('T6 제목의 결론 낱말은 검색 전제가 되지 않는다 — live 검색어 "… 갈아타기 불가" → "… 갈아타기 조건"', () => {
    const [chunk] = promiseChunks(R.titleFinal, R.keyword);
    expect(buildPromiseSearchQuery(chunk!, R.keyword)).toBe('청년미래적금 도약계좌 2026년 갈아타기 조건');
    for (const w of ['폐지', '확정', '인상', '종료', '허용']) expect(buildPromiseSearchQuery(`새 제도 ${w}`, '상품A 지원금')).not.toContain(w);
    expect(buildPromiseSearchQuery('신청 기간과 소득 기준', '상품A 지원금')).not.toContain('조건');   // 결론 낱말이 없으면 그대로
  });
});

describe('STATUS BINDING (T7~T10)', () => {
  test('T7 조건 문장 + 표/각주 값 → 조건 유지(live 111bcf 공식 각주 "(기존) 12% (개선) 15%")', () => {
    const src = '[E01] 동 예산안이 국회 심의를 거쳐 확정 될 경우, 상향된 기여금을 소급 지급할 예정이다. * 매칭비율 : (기존) 12% (개선) 15% (단, 지방 근무시 25%)';
    const s = sourceStatusForValue('15%', src);
    expect(s).toMatchObject({ status: 'CONDITIONAL', basis: 'inherited', distance: 1 });
    expect(s.statusSource).toMatch(/확정 될 경우/);
    expect(sourceStatusForValue('12%', src).status).toBe('CURRENT_CONFIRMED');                     // (기존) = 현재 명시
    expect(sourceStatusForValue('15%', EV).status).toBe('PROPOSED');                                  // live: 추진 + 조건부(상속) 중 강한 쪽 — 현재 아님
    expect(sourceStatusForValue('25%', EV).status).toBe('PLANNED');
    // 렌더도 각주 값과 앞 조건 문장을 함께 싣는다
    const after = renderEvidence(ITEMS, 11000, { reserve: reservationsFor(ANSWERS), bindQualifiers: true });
    const e06 = after.text.slice(after.text.indexOf('[E06]'));
    expect(e06).toMatch(/확정 될 경우[\s\S]*소급[\s\S]*\(기존\) 12% \(개선\) 15%/);
    expect(R.stage2Render.text.slice(R.stage2Render.text.indexOf('[E06]'))).not.toMatch(/확정 될 경우/);   // BEFORE
  });
  test('T8 추진 문장 + 각주 값 → 추진 유지 · 새 문서·새 절 머리에서는 상속하지 않는다', () => {
    expect(sourceStatusForValue('270만원', '[E01] 기여금 상한을 올리는 방안을 추진한다. * 상한 : 216만→270만원').status).toBe('PROPOSED');
    expect(sourceStatusForValue('270만원', '[E01] 기여금 상한을 올리는 방안을 추진한다.\n[E02] * 상한 : 270만원').status).toBe('UNSPECIFIED');
    expect(sourceStatusForValue('270만원', '[E01] 기여금 상한을 올리는 방안을 추진한다. Ⅱ. 가입 일정 * 상한 : 270만원').status).toBe('UNSPECIFIED');
    expect(sourceStatusForValue('270만원', EV).status).toBe('PROPOSED');                              // live 111bcf
  });
  test('T9 추진 1 + 표지 없는 조각 1 → 현재로 올리지 않는다(조각은 현재 근거가 아님)', () => {
    const src = '[E01] 비율을 15%로 높이는 방안을 추진한다.\n[E02] 비율 : 15% (우대)';
    expect(sourceStatusForValue('15%', src).status).toBe('PROPOSED');
    expect(findStrengthenedValues('우대 비율은 15%입니다.', src).map((v) => v.value)).toEqual(['15%']);
    expect(sourceStatusForValue('15%', '[E02] 비율 : 15% (우대)').status).toBe('UNSPECIFIED');
    expect(findStrengthenedValues('우대 비율은 15%입니다.', '[E02] 비율 : 15% (우대)')).toEqual([]);   // 조각뿐이면 고치지도 않는다
  });
  test('T9b 현재 단언 1 + 추진 1(동수) → 현재로 올리지 않고 자동으로 고치지도 않는다(tie → 검토) — b8cdb4 "이직 최대 2회" 오탐 방지', () => {
    const src = '[E01] 기간 중 이직은 최대 2회까지 허용된다. 애초 연 2회 신청을 받을 예정이라고 알려졌다.';
    expect(sourceStatusForValue('2회', src)).toMatchObject({ status: 'PLANNED', conflict: true, tie: true });
    expect(findStrengthenedValues('재직 기간 중 이직은 최대 2회까지 허용됩니다.', src)).toEqual([]);
  });
  test('T10 현재 명시 1 → 현재 · 현재형 단언이 표지보다 많으면 현재(흔한 값 보호)', () => {
    expect(sourceStatusForValue('12%', '[E01] 현행 비율은 12%이다. 비율을 12%에서 15%로 높이는 방안을 추진한다.').status).toBe('CURRENT_CONFIRMED');
    expect(sourceStatusForValue('6%', '[E01] 일반형은 6%를 지원한다. 일반형 6% 기여금이 지급된다. 내년에도 6%를 유지할 계획이다.').status).toBe('CURRENT_CONFIRMED');
  });
});

describe('CONTRADICTION (T11~T12)', () => {
  const yesItems = mkItems('이번 모집에서는 기존 가입자가 상품B로 갈아탈 수 있는 기회를 추가로 제공한다.', '지난 회차에는 첫 모집 가입자에게만 허용됐다.');
  const yes = officialAnswers(yesItems, currentOfficialIds(yesItems, STATUS_OK), SWITCH_PLAN);
  const noItems = mkItems('이번 모집에서는 기존 가입자의 상품B 갈아타기는 허용되지 않는다.', '다음 모집에서 열릴 수 있다는 기사.');
  const no = officialAnswers(noItems, currentOfficialIds(noItems, STATUS_OK), SWITCH_PLAN);
  test('T11 공식 YES vs 패킷 NO → 검출 (live 111bcf 초안: 불가 문장 6개 전부 CONTRADICTED, 참인 "중복 가입 불가" 이유 문장은 아님)', () => {
    expect(findAnswerContradictions('기존 가입자는 상품B로 갈아탈 수 없다.', yes)).toMatchObject([{ verdict: 'CONTRADICTED', polarity: 'NO', official: 'YES' }]);
    const draft = [R.draft011.introduction, ...(R.draft011.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content)), R.draft011.conclusion].join(' ');
    const c = findAnswerContradictions(draft, ANSWERS);
    expect(c.length).toBe(6);
    expect(c.every((x) => x.verdict === 'CONTRADICTED')).toBe(true);
    expect(c.some((x) => /중복 가입을 막고/.test(x.sentence))).toBe(false);
    expect(findAnswerContradictions('지난 회차에는 첫 모집 가입자에게만 갈아타기가 허용됐다.', yes)).toEqual([]);   // 지난 회차 이야기는 모순 아님
  });
  test('T12 공식 NO vs Writer YES → 검출 · 공식 답이 갈리면 NEEDS_REVIEW(뒤집지 않음)', () => {
    expect(findAnswerContradictions('이번 모집에서 상품B로 갈아탈 수 있습니다.', no)).toMatchObject([{ verdict: 'CONTRADICTED', polarity: 'YES', official: 'NO' }]);
    const mixed = mkItems('이번 모집에서는 일부 가입자가 갈아탈 수 있다. 다만 우대형 가입자의 갈아타기는 불가하다.', '');
    const m = officialAnswers(mixed, currentOfficialIds(mixed, STATUS_OK), SWITCH_PLAN);
    expect(m[0]!.verdict).toBe('CONFLICT');
    expect(findAnswerContradictions('상품B로 갈아탈 수 있습니다.', m)[0]!.verdict).toBe('NEEDS_REVIEW');
  });
});

describe('REWRITE GATE (T13~T15)', () => {
  const bHtml: string = R.htmlBeforePreflight;
  const at = bHtml.indexOf('에게만 허용된 예외였기');
  const pStart = bHtml.lastIndexOf('<p', at); const pEnd = bHtml.indexOf('</p>', at) + 4;
  const aHtml = bHtml.slice(0, pStart) + bHtml.slice(pEnd);
  test('T13 모순 문장 삭제 → 허용 (live 111bcf 늦은 재작성: BEFORE 보호 값 "2026년" 으로 거부 → AFTER 허용)', () => {
    expect(R.prePublishEvent.regions[0].reasons).toEqual(['보호 값 사라짐: 2026년']);                  // 라이브 BEFORE
    expect(gateRewrite(bHtml, aHtml, VIEW).status).toBe('rejected');                                    // 재현
    const g = gateRewrite(bHtml, aHtml, VIEW, { claimSupport: claimSupportOf(ANSWERS) });
    expect(g.status).toBe('accepted');
    expect(g.regions[0]!.decisions[0]!.contradictedClaims).toHaveLength(2);
  });
  test('T14 지원되는 문장 삭제 → 거부 (claimSupport 가 있어도 모순 아닌 문장의 값은 보호)', () => {
    const at2 = bHtml.indexOf('10월 7일');
    const s2 = bHtml.lastIndexOf('<p', at2); const e2 = bHtml.indexOf('</p>', at2) + 4;
    const g = gateRewrite(bHtml, bHtml.slice(0, s2) + bHtml.slice(e2), VIEW, { claimSupport: claimSupportOf(ANSWERS) });
    expect(g.status).toBe('rejected');
  });
  test('T15 모순 문장 안의 값 하나(2026년) 때문에 전체를 보호하지 않는다 · 같은 값이 지원 문장에도 있으면 그 문장이 남아 있는 한 보호 불필요', () => {
    const html = '<p>이번 모집은 2026년 10월에 시작합니다.</p><p>기존 가입자는 상품B로 갈아탈 수 없습니다. 2026년 6월 첫 모집 가입자에게만 허용된 예외였기 때문이거든요.</p>';
    const yesItems = mkItems('이번 모집에서는 기존 가입자가 상품B로 갈아탈 수 있는 기회를 추가로 제공한다. 이번 모집은 2026년 10월에 시작한다.', '');
    const yes = officialAnswers(yesItems, currentOfficialIds(yesItems, STATUS_OK), SWITCH_PLAN);
    const ev = { provider: 'x', trustLevel: 'weak', topic: 't', context: '[E01] 2026년 10월 시작. 2026년 6월 첫 모집.' } as any;
    const after = '<p>이번 모집은 2026년 10월에 시작합니다.</p>';
    expect(gateRewrite(html, after, ev).status).toBe('rejected');
    expect(gateRewrite(html, after, ev, { claimSupport: claimSupportOf(yes) }).status).toBe('accepted');
  });
});

describe('MONEY (T16~T19)', () => {
  const has = (hay: string, t: string) => containsValueToken(normalizeForMatch(hay), normalizeForMatch(t));
  test('T16 천원 == 1000원 (live 111bcf: 공식 "최소 천원" · 초안 "최소 1000원" 문장이 사실 필터를 통과한다)', () => {
    expect(has('매월 최소 천원 에서 최대 50만원', '1000원')).toBe(true);
    expect(has('매월 최소 천 원부터', '1000원')).toBe(true);
    expect(has('1천원', '1,000원')).toBe(true);
    const removed = '청년미래적금은 만 19세부터 34세 청년이 3년 동안 매월 최소 1000원부터 최대 50만원까지 자유롭게 납입하는 상품입니다.';
    const report = inspectFactIntegrity(`<p>${removed}</p>`, { ...VIEW } as FactEvidence);
    expect((report.violations || []).filter((v: any) => /1000원/.test(String(v.detail)))).toEqual([]);
  });
  test('T17 5천원 == 5000원 · T18 3만원 == 30000원', () => {
    expect(has('수수료 5천원', '5000원')).toBe(true);
    expect(has('수수료 5,000원', '5천원')).toBe(true);
    expect(has('월 3만원', '30000원')).toBe(true);
    expect(has('월 30,000원', '3만원')).toBe(true);
    expect(wonAmount('1.5만원')).toBe(15000);
    expect(has('월 3만원', '3000원')).toBe(false);
    expect(has('천만원', '1000원')).toBe(false);                                                    // 천만원 = 1천만 원
  });
  test('T19 날짜·사람 수·회차·섞인 금액에는 적용하지 않는다', () => {
    expect(wonAmount('1000명')).toBeNull();
    expect(wonAmount('2026년')).toBeNull();
    expect(wonAmount('319만3511원')).toBeNull();
    expect(has('참가자 천 명', '1000명')).toBe(false);
    expect(has('10월 7일', '1000원')).toBe(false);
    expect(has('3천만원', '3000원')).toBe(false);                                                   // 섞인 단위를 한 마디로 잘못 읽지 않는다
  });
});

describe('교차 도메인 MOCK — 현재 공식 답이 지난 기사보다 우선, 자동 반전 없음', () => {
  const cases: Array<[string, string, string, string, 'YES' | 'NO']> = [
    ['정책', '이번 2차부터 기존 가입자도 다른 상품으로 전환할 수 있다.', '지난 1차 기사: 전환 불가.', '기존 가입자는 전환이 불가합니다.', 'YES'],
    ['자동차', '2027년형부터 기존 구독자도 신형 요금제로 옮길 수 있는 기회를 제공한다.', '과거 기사: 요금제 이동 미지원.', '기존 구독자는 신형 요금제로 옮길 수 없습니다.', 'YES'],
    ['보험', '새 약관에서는 기존 계약자의 특약 전환이 허용되지 않는다.', '과거 약관 기사: 전환 가능.', '기존 계약자는 특약으로 전환할 수 있습니다.', 'NO'],
    ['여행', '2026 행사부터 사전 예약자는 다른 회차로 옮길 수 있다.', '2025 기사: 회차 변경 불가.', '사전 예약자는 다른 회차로 옮길 수 없습니다.', 'YES'],
    ['IT', '최신 펌웨어에서는 기존 계정도 새 플랜으로 전환할 수 있다.', '구버전 문서: 플랜 전환 미지원.', '기존 계정은 새 플랜으로 전환할 수 없습니다.', 'YES'],
  ];
  test.each(cases)('%s', (_label, official, old, wrong, verdict) => {
    const items = mkItems(official, old);
    const plan = planCoreQuestions({ keyword: '서비스 비교', readerQuestions: ['기존 가입자인데 전환 가능한가요'] });
    const answers = officialAnswers(items, currentOfficialIds(items, STATUS_OK), plan);
    expect(answers[0]!.verdict).toBe(verdict);
    expect(answers[0]!.sourceIds).toEqual(['E01']);                                                // 지난 기사(E02)는 답의 출처가 아니다
    expect(findAnswerContradictions(wrong, answers)[0]).toMatchObject({ verdict: 'CONTRADICTED' });
    expect(checkTitleEpistemics(`서비스 비교 ${wrong.match(/(전환|옮길)[^.]*/)![0]}`, answers).claims[0]!.support).toBe('CONTRADICTED');
  });
  test('비교만 묻는 글(갈아타기 질문 없음)에는 전환 질문을 세우지 않는다 · 커버리지는 가능/불가 문장으로 잰다', () => {
    expect(planCoreQuestions({ keyword: 'A 자동차 VS B 자동차' }).find((q) => q.id === 'CQ-SWITCH-AVAILABILITY')!.applicable).toBe(false);
    const cov = coverCoreQuestions('기존 가입자도 이번 모집에서 갈아탈 수 있습니다.', SWITCH_PLAN);
    expect(cov.find((c) => c.id === 'CQ-SWITCH-AVAILABILITY')!.status).toBe('ANSWERED');
    expect(answerPolarity('갈아타기 기회로 보면 안 됩니다', 'CQ-SWITCH-AVAILABILITY')!.polarity).toBe('NO');
  });
  test('하드코딩 없음 — 새 코드에 상품명·기관명·이번 값·회차 숫자가 없다', () => {
    const code = ['core-answer.ts', 'core-questions.ts', 'promise-grounding.ts'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8')).join(' ').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/청년미래적금|도약계좌|금융위|fsc|87726|2차 모집|6월|15%|25%|270만|2026/);
  });
});

describe('회귀 — 2편(ad0616)·223b32 는 핵심 답 계획·모순 검출에 걸리지 않는다', () => {
  test('ad0616(국민연금 조기수령): 전환 질문 없음 · 모순 0', () => {
    const R2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-ad0616', 'run-inputs.json'), 'utf8'));
    const plan = planCoreQuestions({ keyword: R2.keyword, searchIntent: R2.searchIntent });
    expect(plan.find((q) => q.id === 'CQ-SWITCH-AVAILABILITY')!.applicable).toBe(false);
    const items = itemsOf(R2);
    expect(findAnswerContradictions(R2.htmlFinal, officialAnswers(items, currentOfficialIds(items, R2.officialStatus), plan))).toEqual([]);
    expect(plainOf(R2.htmlFinal).length).toBeGreaterThan(1000);
  });
});

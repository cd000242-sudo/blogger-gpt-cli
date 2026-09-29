const fs = require('fs');
const path = require('path');

import { fetchGrounding } from '../src/core/final/naver-grounding';
import { buildOfficialResearchPlan, OFFICIAL_NEEDS } from '../src/core/final/official-research-plan';
import { alignSummaryToBody, alignRowsToBody, checkFaqConsistency, isLimitInBody } from '../src/core/final/answer-fidelity';
import { inspectArticleFactIntegrity, inspectFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { resolveDerivedDifferences } from '../src/core/final/derived-difference';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';

/*
 * v3.8.759 — 실제 2편(run d7a142 · run fba7e9) 검증 뒤의 P0 셋. 오프라인 재생(호출 0회).
 *   P0-1 공식자료 충분성: "옛 공식 문서를 읽었다" ≠ "현재 질문의 공식 근거 확보"
 *   P0-2 답 상자·요약표·FAQ 가 본문의 검증된 조건보다 강해지지 않는다
 *   P0-3 같은 블록의 명시적 가정 예시에서 나온 단순 차액은 지우지 않되 사실로 승격하지 않는다
 * 픽스처는 실제 실행 산출물이다(__tests__/fixtures/run-d7a142 · run-fba7e9). 합성 값은 MOCK 으로 표시한다.
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const R1 = read('__tests__/fixtures/run-d7a142/run-inputs.json');   // 청년미래적금 VS 청년 도약계좌
const R2 = read('__tests__/fixtures/run-fba7e9/run-inputs.json');   // 국민연금 조기수령 조건과 감액
const bodyOf = (d: any) => [d.introduction, ...(d.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content)), d.conclusion].join('\n');
const viewOf = (r: any) => buildValidationEvidence(
  r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })),
  { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence,
);

const mkSearch = (results: Record<string, any[]>) => {
  const calls: Array<{ type: string; query: string }> = [];
  const fn = async (type: string, params: any) => { calls.push({ type, query: params.query }); return { ok: true, items: results[`${type}:${params.query}`] || results[type] || [] }; };
  return { fn, calls };
};
const PUB = 'Mon, 28 Sep 2026 09:00:00 +0900';
const KW = '청년미래적금 VS 청년 도약계좌';
const news2nd = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `청년미래적금 2차 가입 신청 기사 ${i + 1}`, description: '2차 모집을 받는다', link: `https://news.example.com/a/${i + 1}`, originallink: `https://news.example.com/a/${i + 1}`, pubDate: PUB }));
const OLD = { title: '청년미래적금 출시 안내 가입절차 심사일정', description: '출시 안내', link: 'https://www.fsc.go.kr/edu/news/1' };            // MOCK
const CUR = { title: '청년미래적금 2차 가입 신청 안내', description: '2차 모집', link: 'https://www.fsc.go.kr/edu/news/2' };                   // MOCK
const pad = (s: string) => `${s} `.repeat(12);
const BODY_OLD_TENTATIVE = pad('청년미래적금 가입절차 안내. 총급여 기준 이하 가입 대상. 2차 가입자 모집시기(12월, 잠정) 감안 시 대상 조정.');   // 옛 문서가 미래 회차를 예고
const BODY_CUR_SCHEDULE = pad('청년미래적금 2차 가입 신청 안내. 신청 기간은 3월 2일부터 3월 16일까지 접수한다. 총급여 기준 이하 가입 대상.');
const BODY_CUR_NO_ANSWER = pad('청년미래적금 2차 안내 페이지입니다. 자세한 내용은 은행 창구에서 확인하십시오. 홍보 영상과 카드뉴스를 제공합니다.');
const fetchFrom = (map: Record<string, string>) => async (url: string) => map[url] || '';
const opt = (fetchBody: any, enabled = false) => ({ mainKeyword: KW, fetchBody, officialPlan: buildOfficialResearchPlan(KW), officialBoost: { enabled, maxQueries: 1 } });

describe('P0-1 공식자료 충분성 — 현재 질문의 공식 근거인가 (T1~T6)', () => {
  test('T1 옛 공식 본문이 현재 회차를 "잠정" 으로만 언급 → tentative-future · sufficient=false · 보강 대상(문서는 근거로 남는다)', async () => {
    const { fn, calls } = mkSearch({ news: news2nd(6), webkr: [OLD], blog: [] });
    const g = await fetchGrounding(KW, fn as any, opt(fetchFrom({ [OLD.link]: BODY_OLD_TENTATIVE })));
    const st = g.officialStatus!;
    expect(st.currentRound).toBe('2');
    expect(st.candidates[0]).toMatchObject({ url: OLD.link, status: 'body', roundRelevance: 'tentative-future' });
    expect(st.sufficient).toBe(false);
    expect(st.sufficiency).toBe('past-official-only');
    expect(st.boost).toMatchObject({ enabled: false, wouldTrigger: true, triggered: false });
    expect(calls.map((c) => c.type)).toEqual(['news', 'webkr', 'blog']);                       // 실제 검색 추가 없음(승인 전)
    expect(g.items!.some((i) => i.url === OLD.link && i.hasBody)).toBe(true);                    // 옛 문서도 근거로는 남는다
  });

  test('T2 현재 회차 공식 본문이 신청 기간을 답함 → current-official · 보강 켜져 있어도 실행하지 않음', async () => {
    const { fn, calls } = mkSearch({ news: news2nd(6), webkr: [CUR], blog: [], 'webkr:청년미래적금 공식 안내 가입 조건': [OLD] });
    const g = await fetchGrounding(KW, fn as any, opt(fetchFrom({ [CUR.link]: BODY_CUR_SCHEDULE }), true));
    const st = g.officialStatus!;
    expect(st.candidates[0]).toMatchObject({ url: CUR.link, status: 'body', roundRelevance: 'current' });
    expect(st.candidates[0]!.answered).toEqual(expect.arrayContaining(['schedule', 'conditions']));
    expect(st).toMatchObject({ sufficient: true, sufficiency: 'current-official', unansweredNeeds: [] });
    expect(st.boost).toMatchObject({ enabled: true, wouldTrigger: false, triggered: false });
    expect(calls.length).toBe(3);                                                                // 불필요한 보강 검색 없음
  });

  test('T3 현재 회차 공식 후보가 스니펫만(본문 실패) → snippet-only · 보강 대상', async () => {
    const { fn } = mkSearch({ news: news2nd(6), webkr: [CUR], blog: [] });
    const g = await fetchGrounding(KW, fn as any, opt(fetchFrom({})));
    const st = g.officialStatus!;
    expect(st.candidates[0]!.status).not.toBe('body');
    expect(st).toMatchObject({ sufficient: false, sufficiency: 'snippet-only' });
    expect(st.boost.wouldTrigger).toBe(true);
  });

  test('T4 현재 회차 공식 본문은 있으나 일정·조건에 답이 없음 → official-no-answer · 보강 대상', async () => {
    const { fn } = mkSearch({ news: news2nd(6), webkr: [CUR], blog: [] });
    const g = await fetchGrounding(KW, fn as any, opt(fetchFrom({ [CUR.link]: BODY_CUR_NO_ANSWER })));
    const st = g.officialStatus!;
    expect(st.candidates[0]).toMatchObject({ status: 'body', roundRelevance: 'current', answered: [] });
    expect(st).toMatchObject({ sufficient: false, sufficiency: 'official-no-answer' });
    expect(st.unansweredNeeds).toEqual(expect.arrayContaining(['schedule', 'conditions']));
    expect(st.boost.wouldTrigger).toBe(true);
  });

  test('T5 회차 개념이 없는 주제: 공식 본문이 조건을 답하면 충분(n/a) · 옛/현재 구분을 억지로 만들지 않는다', async () => {
    const KW2 = '국민연금 조기수령 조건과 감액';
    const page = { title: '국민연금 조기수령 조건과 감액 안내', description: '감액 조건', link: 'https://www.mohw.go.kr/x/1' };   // MOCK
    const { fn, calls } = mkSearch({ news: [{ title: '국민연금 조기수령 감액 기사', description: '', link: 'https://news.example.com/n/1', originallink: 'https://news.example.com/n/1', pubDate: PUB }], webkr: [page], blog: [] });
    const g = await fetchGrounding(KW2, fn as any, { mainKeyword: KW2, fetchBody: fetchFrom({ [page.link]: pad('국민연금 조기수령 감액 안내. 가입기간 10년 이상 요건 충족 시 청구 가능. 소득 기준 이하 대상.') }), officialPlan: buildOfficialResearchPlan(KW2), officialBoost: { enabled: true, maxQueries: 1 } });
    const st = g.officialStatus!;
    expect(st.currentRound).toBeNull();
    expect(st.candidates[0]).toMatchObject({ roundRelevance: 'n/a', status: 'body' });
    expect(st).toMatchObject({ sufficient: true, sufficiency: 'current-official' });
    expect(st.boost.triggered).toBe(false);
    expect(calls.length).toBe(3);
  });

  test('T6 run d7a142 재생: 6월 안내 본문(실제 6,000자)만 있으면 sufficient=false · 보강 대상 — 실제 실행에서는 true 로 오판돼 보강이 안 돌았다', async () => {
    const fsc = R1.stage2Items.find((i: any) => /fsc\.go\.kr/.test(i.url));
    const newsItems = R1.stage1Items.filter((i: any) => i.sourceType === 'news').map((i: any) => ({ title: i.title, description: '', link: i.url, originallink: i.url, pubDate: PUB }));
    const { fn, calls } = mkSearch({ news: newsItems, webkr: [{ title: fsc.title, description: '', link: fsc.url }], blog: [] });
    const g = await fetchGrounding(R1.keyword, fn as any, { mainKeyword: R1.keyword, fetchBody: fetchFrom({ [fsc.url]: fsc.cleanedText }), officialPlan: R1.officialPlan, officialBoost: { enabled: false, maxQueries: 1 } });
    const st = g.officialStatus!;
    expect(R1.officialStatus.sufficient).toBe(true);                                             // BEFORE(실제 실행 기록): 오판
    expect(st.currentRound).toBe('2');
    expect(st.candidates.find((c) => c.url === fsc.url)).toMatchObject({ status: 'body', roundRelevance: 'tentative-future' });
    expect(st.sufficient).toBe(false);                                                            // AFTER
    expect(st.sufficiency).toBe('past-official-only');
    expect(st.boost.wouldTrigger).toBe(true);
    expect(st.boost.queries).toEqual([]);                                                          // 오프라인: 실제 검색 없음
    expect(calls.length).toBe(3);
    expect(JSON.stringify(st.unansweredNeeds)).toMatch(/schedule/);
  });
});

describe('P0-2 답 상자·요약표·FAQ 는 본문보다 강해지지 않는다 (T7~T11)', () => {
  const B1 = bodyOf(R1.draft018);
  test('T7 run d7a142: "월 70만원을 유지하며"(한도→조건) → "월 최대 70만원까지 납입할 수 있고" · 나머지 판정은 그대로', () => {
    expect(isLimitInBody(B1, '70만원')).toBe(true);
    const r = alignSummaryToBody(R1.answerBox022.answer, B1);
    expect(r.changes.map((c) => c.rule)).toEqual(['limit-as-condition']);
    expect(r.text).toContain('월 최대 70만원까지 납입할 수 있고 5년 뒤 최대 4200만원 원금을 목표로 한다면 청년도약계좌를 유지하는 편이 낫습니다');
    expect(r.text).not.toContain('70만원을 유지하며');
    expect(r.text).toContain('3년 안에 목돈을 쓸 계획이면 청년미래적금이 맞습니다');
    expect(r.text).toContain('특별중도해지를 신청해야 합니다');
  });
  test('T8 약한 요약은 허용 · 본문이 한도로 말하지 않은 금액은 손대지 않는다', () => {
    const weak = '월 최대 70만원까지 납입할 수 있으면 유지하는 편이 낫습니다.';
    expect(alignSummaryToBody(weak, B1)).toEqual({ text: weak, changes: [] });
    const body = '<p>월 30만원을 유지할 수 있는 사람이 대상입니다.</p>';                            // MOCK — 최대 표기 없음
    const s = '월 30만원을 유지할 수 있으면 대상입니다.';
    expect(alignSummaryToBody(s, body).changes).toEqual([]);
  });
  test('T9 본문에 없는 절대 표현(무조건·반드시)은 지운다 · 본문에 있으면 둔다', () => {
    const body = '<p>3년 안에 쓸 돈이면 청년미래적금이 맞습니다. 5년 계획이면 반드시 서류를 확인합니다.</p>';   // MOCK
    const r = alignSummaryToBody('3년 안에 쓸 돈이면 무조건 청년미래적금이 맞습니다. 5년 계획이면 반드시 서류를 확인합니다.', body);
    expect(r.changes.map((c) => [c.rule, c.before])).toEqual([['absolute-adverb', '무조건']]);
    expect(r.text).toBe('3년 안에 쓸 돈이면 청년미래적금이 맞습니다. 5년 계획이면 반드시 서류를 확인합니다.');
  });
  test('T10 FAQ 중심 대상 일치 — run d7a142 는 1번(이직 질문 ↔ 금리 답)만 빠지고, run fba7e9 는 4개 모두 남는다', () => {
    const r1 = checkFaqConsistency(R1.visible024.faqItems, R1.keyword);
    expect(r1.notes.map((n) => n.action)).toEqual(['dropped', 'kept', 'kept', 'kept']);
    expect(r1.notes[0]!.question).toMatch(/이직/);
    expect(r1.faqs.length).toBe(3);
    const r2 = checkFaqConsistency(R2.visible024.faqItems, R2.keyword);
    expect(r2.dropped).toBe(0);
    expect(r2.faqs.length).toBe(4);
  });
  test('T11 비교 주제에서 질문의 대상과 다른 쪽만 답하면 빠진다 · 본문에 없는 값의 요약 문장·요약표 칸은 빠진다', () => {
    const faqs = [
      { question: '상품 A 가입 뒤 이직하면 자격이 없어지나요?', answer: '상품 B 는 5년 만기이고 이직 뒤에도 금리는 그대로입니다.' },   // MOCK: 낱말 "이직" 은 겹치지만 대상이 바뀜
      { question: '상품 A 는 월 납입을 건너뛰어도 되나요?', answer: '상품 A 는 자유적립식이라 건너뛴 달이 있어도 계좌는 유지됩니다.' },
    ];
    const r = checkFaqConsistency(faqs, '상품 A vs 상품 B');
    expect(r.notes.map((n) => n.action)).toEqual(['dropped', 'kept']);
    expect(r.notes[0]!.reason).toMatch(/상품\s*A 를 묻는데 답은 상품\s*B/);
    const body = '<p>상품 A 는 월 최대 50만원까지 납입합니다.</p>';                                 // MOCK
    const s = alignSummaryToBody('상품 A 는 월 최대 50만원까지 납입합니다. 우대금리는 연 2.5%입니다.', body);
    expect(s.changes.map((c) => c.rule)).toEqual(['unsupported-value']);
    expect(s.text).toBe('상품 A 는 월 최대 50만원까지 납입합니다.');
    const rows = alignRowsToBody([['월 한도', '50만원'], ['우대금리', '연 2.5%']], body);
    expect(rows.rows).toEqual([['월 한도', '50만원'], ['우대금리', '']]);
    expect(alignRowsToBody(R1.summary019.rows, B1).changes).toEqual([]);                          // 실제 요약표 행은 손대지 않는다
  });
});

describe('P0-3 명시적 가정 예시의 단순 차액 (T12~T18)', () => {
  const PADTXT = ' 조기노령연금은 청구 절차와 가입기간 요건을 함께 봅니다. 자세한 안내는 공단 창구에서 확인합니다.'.repeat(3);
  const ev = (context: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '연금', context: `[E01] 합성 근거\n${context}${PADTXT}` });
  const LEDGER0 = '조기노령연금은 1년 앞당길 때마다 6% 감액된다. 5년이면 30% 감액.';                     // MOCK 근거(100만원·94만원 없음)
  // run fba7e9 처럼 예시 값(100만원·94만원)은 근거에 있고 차액(6만원)만 없는 경우 — 판정이 차액 계산에만 달리게 한다
  const LEDGER = `${LEDGER0} 예를 들어 월 100만원 수급자는 1년 조기수령 시 월 94만원을 받는다.`;
  const BLOCK = '<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p><ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul><p>이 예시는 기본 수령액이 월 100만원인 경우입니다.</p>';

  test('T12 run fba7e9 재생: "6만원·18만원 감소" 가 hypothetical 로 보존되고 사실 검사는 통과한다 (실제 실행에서는 두 문장이 지워졌다)', () => {
    expect(R2.factFilterEvent.removed).toEqual(['1년 조기수령은 월 6만원 감소로 계산합니다.', '3년 조기수령은 월 18만원 감소로 계산합니다.']);   // BEFORE
    const v = viewOf(R2);
    const rep = inspectArticleFactIntegrity(R2.draft017, v.evidence);
    expect(rep.status).toBe('passed');                                                              // AFTER
    const hyp = (rep.derived || []).filter((d) => d.kind === 'hypothetical-diff');
    expect(hyp.map((d) => [d.claim, d.operation, d.verdict])).toEqual([['6만원', '|100만원 − 94만원|', 'hypothetical'], ['18만원', '|100만원 − 82만원|', 'hypothetical']]);
    expect(hyp[0]!.operands[0]).toMatchObject({ label: '가정 기준값', value: '100만원', origin: 'hypothetical', sourceIds: [] });
    expect(hyp[0]!.hypothesis).toContain('원래 월 100만원을 받을 예정이라면');
    const after = sanitizeArticleFactClaims(R2.draft017, v.evidence);
    expect(JSON.stringify(after)).toContain('1년 조기수령은 월 6만원 감소로 계산합니다.');
  });
  test('T13 계산이 틀리면(7만원) 지운다 · mismatch 로 기록', () => {
    const block = BLOCK.replace('6만원', '7만원');
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('blocked');
    expect(rep.derived!.find((d) => d.claim === '7만원')).toMatchObject({ kind: 'hypothetical-diff', verdict: 'mismatch' });
    expect(sanitizeFactUnsafeHtml(block, ev(LEDGER))).not.toContain('7만원');
  });
  test('T14 가정 선언이 없는 블록에서는 계산으로 살리지 않는다', () => {
    const block = '<p>월 100만원을 받는 사람의 1년 조기수령은 월 94만원입니다.</p><ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul>';
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('blocked');
    expect(rep.violations.map((v) => v.detail).join(' ')).toContain('6만원');                        // 막힌 것은 차액 주장이다(예시 값이 아니라)
    expect(rep.derived || []).toEqual([]);
  });
  test('T15 세금·복리·할인·추천이 섞인 문장은 대상이 아니다', () => {
    const block = BLOCK.replace('월 6만원 감소로 계산합니다', '세후 월 6만원 감소로 계산하면 유리합니다');
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('blocked');
    expect(rep.violations.map((v) => v.detail).join(' ')).toContain('6만원');
    expect(rep.derived || []).toEqual([]);
  });
  test('T16 다른 블록의 가정값과 섞지 않는다 · 단위가 다르면 섞지 않는다', () => {
    const other = '<ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul>';                 // 기준값은 다른 블록에 있다
    const r = resolveDerivedDifferences('1년 조기수령은 월 6만원 감소로 계산합니다.', ['6만원'], other, '', () => false);
    expect(r.resolved.size).toBe(0);
    const unit = '<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 6개월 걸립니다.</p><ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul>';
    expect(inspectFactIntegrity(unit, ev(LEDGER)).status).toBe('blocked');
  });
  test('T17 표 머리글이 가정을 말하면 그 열의 값으로 검산한다 (94만원 자체는 근거 없음)', () => {
    const table = '<table><thead><tr><th>앞당긴 기간</th><th>감액률</th><th>원래 월 100만원일 때</th></tr></thead><tbody><tr><td>1년</td><td>6%</td><td>월 94만원</td></tr></tbody></table><p>1년이면 월 6만원 줄어듭니다.</p>';
    const rep = inspectFactIntegrity(table, ev(LEDGER0));
    const d = rep.derived!.find((x) => x.claim === '6만원')!;
    expect(d).toMatchObject({ kind: 'hypothetical-diff', verdict: 'hypothetical', operation: '|100만원 − 94만원|' });
    expect(d.operands[1]).toMatchObject({ value: '94만원', origin: 'hypothetical', sourceIds: [] });
    expect(sanitizeFactUnsafeHtml(table, ev(LEDGER0))).toContain('6만원 줄어듭니다');
  });
  test('T18 가정 계산은 verified 가 아니라 hypothetical 로만 남는다 — 사실로 승격하지 않는다', () => {
    const rep = inspectFactIntegrity(BLOCK, ev(LEDGER));
    expect(rep.status).toBe('passed');
    for (const d of rep.derived!) { expect(d.kind).toBe('hypothetical-diff'); expect(d.verdict).not.toBe('verified'); expect(d.reason).toContain('EXPLICIT_HYPOTHETICAL_DERIVATION'); }
    // 표로 검산되는 근거값 차액(757)은 여전히 verified — 경로가 다르다
    const t = '<table><tr><th>구분</th><th>A</th><th>B</th></tr><tr><td>월 최대 납입액</td><td>50만원</td><td>70만원</td></tr></table><p>월 한도는 20만원 차이입니다.</p>';
    expect(inspectFactIntegrity(t, ev('A 는 월 최대 50만원, B 는 월 최대 70만원까지.')).derived![0]).toMatchObject({ kind: 'abs-diff', verdict: 'verified' });
  });
});

describe('전역 (T19~T21)', () => {
  const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', p), 'utf8');
  test('T19 배선 — orchestration 이 답 상자·요약표·FAQ·공식 상태에 새 검사를 실제로 쓴다(trace 이벤트 포함)', () => {
    const orch = src('orchestration.ts');
    for (const s of ['alignSummaryToBody(verdictAnswer', "trace.event('answer-box.fidelity'", 'alignRowsToBody(fidelityRows', "trace.event('summary-table.fidelity'", 'checkFaqConsistency(faqs, keyword)', "trace.event('faq.consistency'", 'describeOfficialShortfall(']) expect(orch).toContain(s);
    expect(orch.indexOf('checkFaqConsistency(faqs, keyword)')).toBeGreaterThan(orch.indexOf('guardFaqs(faqs, claimLedger())'));   // 값 관문 뒤
    expect(orch.indexOf('alignSummaryToBody(verdictAnswer')).toBeGreaterThan(orch.indexOf('ensureVerdictAnswer(verdictAnswer'));   // 판정 조립 뒤
    expect(orch.indexOf('alignSummaryToBody(verdictAnswer')).toBeLessThan(orch.indexOf('const answerBlockHtml = buildAnswerBlock('));
  });
  test('T20 새 규칙에 상품명·월·공고 번호·공식 URL 하드코딩 없음', () => {
    for (const f of ['answer-fidelity.ts', 'official-research-plan.ts', 'derived-difference.ts']) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');                          // 주석(실측 기록)은 뺀 코드만
      expect(code).not.toMatch(/청년미래적금|도약계좌|국민연금|\b1?\d월\b|87370|fsc\.go\.kr|nps\.or\.kr/);
    }
    expect(OFFICIAL_NEEDS.map((n) => n.id)).toEqual(['schedule', 'conditions', 'transition', 'exceptions']);
    expect(buildOfficialResearchPlan(KW).needs).toEqual(['schedule', 'conditions', 'transition', 'exceptions']);
    expect(buildOfficialResearchPlan('제주 vs 부산 여행 비교').needs).toEqual([]);
  });
  test('T21 회귀 — run fba7e9 답·요약표·FAQ 무변경, run d7a142 사실 검사에 새 통과(가짜 PASS) 없음', () => {
    const B2 = bodyOf(R2.draft018);
    expect(alignSummaryToBody(R2.answerBox022.answer, B2).changes).toEqual([]);
    expect(alignRowsToBody(R2.summary019.rows, B2).changes).toEqual([]);
    const rep1 = inspectArticleFactIntegrity(R1.draft017, viewOf(R1).evidence);
    expect(rep1.derived || []).toEqual([]);                                                        // 가정 없는 글에 파생 계산이 생기지 않는다
    // v3.8.760(P1-A) 전에는 범위 표기 "13.2%에서 14.4%" 가 미확인이었다 — 이제 근거의 "13.2~14.4%" 와 구조로 대조돼 통과한다(v3-8-760 테스트가 상세 검증)
    expect(rep1.violations).toEqual([]);
  });
});

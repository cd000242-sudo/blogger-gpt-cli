const fs = require('fs');
const path = require('path');

import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { inspectFactIntegrity, type FactEvidence } from '../src/core/final/fact-integrity';
import { guardFacts, gateRepairs, findUngroundedFactsByEvidence, protectedZones, blockContextOf } from '../src/core/final/fact-guard';
import { runFinalAuthority, syncFaqJsonLd, parseVisibleFaqs } from '../src/core/final/final-authority';
import { planCoreQuestions, coverCoreQuestions, isCoreAnswerSentence, renderCoreQuestions } from '../src/core/final/core-questions';
import { weakenSentence, valueRoles } from '../src/core/final/decision-semantics';
import { alignSummaryToBody, checkFaqConsistency } from '../src/core/final/answer-fidelity';
import { fetchPageDocumentDetailed } from '../src/core/crawlers/official-page-body';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import { buildOfficialResearchPlan } from '../src/core/final/official-research-plan';
import { extractRanges } from '../src/core/final/range-value';
import { resolveDerivedDifferences } from '../src/core/final/derived-difference';

/*
 * v3.8.761 — FINALIZATION AUTHORITY. 라이브 2편(b8cdb4·a280b4) 픽스처 + 교차 도메인 MOCK. 호출 0회.
 *   마지막 LLM 자가 수정이 앞의 결정론 검사를 무효화하지 못하게: 장부 검사기 기반 판정 · 답 상자/FAQ 제외 · 교체본 게이트 · 최종 권위 재검사 · FAQ 단일 소스 · 판단문 새 문형 · 핵심 질문 계획/coverage · fetch 실패 사유.
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const R1 = read('__tests__/fixtures/run-b8cdb4/run-inputs.json');   // 청년미래적금 VS 청년 도약계좌 (live)
const R2 = read('__tests__/fixtures/run-a280b4/run-inputs.json');   // 국민연금 조기수령 조건과 감액 (live)
const viewOf = (r: any) => buildValidationEvidence(r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })), { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence).evidence;
const PARA = /<(p|li|td)\b[^>]*>[\s\S]*?<\/\1>/gi;
const paras = (html: string) => [...String(html).matchAll(PARA)].map((m) => m[0]);
const plain = (s: string) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const findPara = (html: string, anchor: string) => paras(html).find((p) => plain(p).includes(anchor)) || '';
const PAD = ' 자세한 절차는 취급 기관이 안내합니다. 가입 전 본인 요건을 확인하세요. 신청은 창구와 앱에서 받습니다.'.repeat(3);
const ev = (context: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '합성 주제', context: `[E01] 합성 근거\n${context}${PAD}` });
const V1 = viewOf(R1); const V2 = viewOf(R2);
const noLLM = async () => { throw new Error('LLM 호출 금지'); };

describe('FINAL AUTHORITY — 늦은 LLM 재작성은 앞의 검증을 무효화하지 못한다 (T1~T5)', () => {
  test('T1 검증된 값(금리·조건)을 지운 교체본은 거부 — run b8cdb4 실제 재작성 쌍', () => {
    const before = findPara(R1.htmlAfterVoice, '기본 금리는 연 4.5%');
    const after = findPara(R1.htmlBeforePreflight, '정부 기여금과 이자소득 비과세 혜택이 적용되는 상품입니다');
    expect(before && after).toBeTruthy();
    const g = gateRepairs(before, [{ paragraphIndex: 0, html: after }], V1);
    expect(g.decisions[0]).toMatchObject({ accepted: false, lostProtected: expect.arrayContaining(['4.5%', '2400만원']) });
    const cond = gateRepairs(findPara(R1.htmlAfterVoice, '일반형은 총급여 6000만원 이하 또는'), [{ paragraphIndex: 0, html: findPara(R1.htmlBeforePreflight, '우대형에는 중소기업 재직자와 신규 취업자, 소상공인 등이 해당합니다') }], V1);
    expect(cond.decisions[0]!.accepted).toBe(false);
    expect(cond.decisions[0]!.lostProtected).toEqual(expect.arrayContaining(['6000만원', '200%']));
  });
  test('T2 근거 없는 값만 뺀 교체본은 허용 — 문체 손질도 허용', async () => {
    const e = ev('월 최대 50만원까지 납입한다. 기여금은 12% 이다.');
    const html = '<h3>조건</h3><p>월 최대 50만원까지 납입하고 기여금은 12% 입니다. 우대금리는 연 2.5% 입니다.</p>';
    const g = gateRepairs(html, [{ paragraphIndex: 0, html: '<p>월 최대 50만원까지 납입할 수 있고 기여금은 12% 입니다.</p>' }], e, { issueByIndex: new Map([[0, ['2.5%']]]) });
    expect(g.decisions[0]).toMatchObject({ accepted: true, lostProtected: [], introducedUnsupported: [] });
    const bad = gateRepairs(html, [{ paragraphIndex: 0, html: '<p>월 최대 50만원까지 납입하고 기여금은 15% 입니다.</p>' }], e, { issueByIndex: new Map([[0, ['2.5%']]]) });
    expect(bad.decisions[0]).toMatchObject({ accepted: false, introducedUnsupported: ['15%'] });
    const r = await guardFacts({ html, reference: e.context, keyword: 'k', evidence: e, callLLM: async () => JSON.stringify([{ paragraphIndex: 0, html: '<p>월 최대 50만원까지 납입할 수 있고 기여금은 12% 입니다.</p>' }]) });
    expect(r.repaired).toBe(1);
    expect(r.html).not.toContain('2.5%');
  });
  test('T3 검산된 20만원 차액 — 장부 검사기는 근거 없음으로 보지 않고(호출 0), 지우는 교체본은 거부', async () => {
    const fu = findUngroundedFactsByEvidence(R1.htmlAfterVoice, V1, { keyword: R1.keyword });
    expect(fu.facts.map((f) => f.token)).toEqual([]);                                             // 실제 실행에서는 13건이 걸려 7문단이 다시 써졌다
    const html = R1.htmlAfterVoice;
    const p = paras(html).findIndex((x) => plain(x).includes('월 한도 차이는 20만원'));
    expect(p).toBeGreaterThan(0);
    expect(blockContextOf(html, html.indexOf(paras(html)[p]!), html.indexOf(paras(html)[p]!) + 10)).toMatch(/<table/);
    const g = gateRepairs(html, [{ paragraphIndex: p, html: findPara(R1.htmlBeforePreflight, '매월 최대 50만원을 납입하는 상품입니다') }], V1);
    expect(g.decisions[0]).toMatchObject({ accepted: false, lostProtected: ['20만원'] });
    const r = await guardFacts({ html, reference: '', keyword: R1.keyword, evidence: V1, callLLM: noLLM });
    expect(r.repaired).toBe(0);
    expect(r.html).toContain('월 한도 차이는 20만원');
  });
  test('T4 가정 예시 계산은 보호 값이다 — 지우는 교체본 거부', () => {
    const e = ev('조기노령연금은 1년 앞당길 때마다 6% 감액된다.');
    const html = '<h3>예시</h3><p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p><ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul>';
    const fu = findUngroundedFactsByEvidence(html, e);
    expect(fu.facts).toEqual([]);
    const g = gateRepairs(html, [{ paragraphIndex: 1, html: '<li>1년 조기수령은 감소로 계산합니다.</li>' }], e);
    expect(g.decisions[0]).toMatchObject({ accepted: false, lostProtected: ['6만원'] });
  });
  test('T5 답 상자·FAQ 는 재작성 대상이 아니고, 최종 권위가 fidelity 를 다시 적용한다 — run a280b4 실제 답 상자', async () => {
    const answerBefore = `<section class="answer-first"><p class="answer-first-q">q</p><p class="answer-first-a">${R2.answerBox.answer}</p></section>`;
    const html = `${answerBefore}<h2>절</h2><h3>a</h3><p>본문 1 문단입니다.</p>`;
    expect(protectedZones(html).map((z) => z.kind)).toEqual(['answer']);
    const rewrite = findPara(R2.htmlBeforePreflight, '평생 동안 매월 지급받을 수 있습니다');
    const r = await guardFacts({ html, reference: '', keyword: R2.keyword, evidence: V2, callLLM: async () => JSON.stringify([{ paragraphIndex: 1, html: rewrite }]) });
    expect(r.html).toContain('조기수령 가능 여부부터 판단하는 편이 맞습니다');                       // 판정문 유지
    expect(r.html).not.toContain('평생 동안 매월 지급받을 수 있습니다');
    // 게이트 단독으로도 같은 판정(보호 값 3,193,511원·519만원·70% 사라짐)
    expect(gateRepairs(`<p>${R2.answerBox.answer}</p>`, [{ paragraphIndex: 0, html: rewrite }], V2).decisions[0]!.accepted).toBe(false);
    // 최종 권위: 답 상자에 상한→조건 문형이 남아 있으면 약화한다
    const body = '<h3>x</h3><p>상품 B 는 월 최대 70만원까지 납입할 수 있습니다.</p>';
    const fa = runFinalAuthority({ html: `<section class="answer-first"><p class="answer-first-q">q</p><p class="answer-first-a">월 70만원 납입을 유지할 여력이 있다면 B 를 유지하는 편이 낫습니다.</p></section><h2>절</h2>${body}`, evidence: ev('상품 B 는 월 최대 70만원까지 납입할 수 있다.'), keyword: 'A vs B' });
    expect(fa.report.decision.some((c) => c.action === 'weakened')).toBe(true);
    expect(fa.html).toMatch(/answer-first-a[^>]*>최대 70만원 한도 안에서/);
  });
});

describe('FAQ 단일 소스 (T6~T7)', () => {
  const faqHtml = (items: Array<[string, string]>) => `<div><h2>자주 묻는 질문 (FAQ)</h2>${items.map(([q, a]) => `<details><summary><span>Q.</span><span>${q}</span><span>▼</span></summary><div><p>${a}</p></div></details>`).join('')}</div>`;
  test('T6 보이는 FAQ 와 FAQPage JSON-LD 가 같다 — 답이 바뀌면 JSON-LD 도 같은 답 (live a280b4: 재작성 전 답이 남아 있던 문제)', () => {
    const ld = (h: string) => JSON.parse((h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1] || 'null');
    const stale = `${faqHtml([['가입기간이 120개월보다 짧으면 조기수령을 못 하나요?', '120개월 이상이 기본 조건입니다. 반환일시금 대상 여부를 먼저 확인합니다.']])}<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: '가입기간이 120개월보다 짧으면 조기수령을 못 하나요?', acceptedAnswer: { '@type': 'Answer', text: '옛 답' } }] })}</script>`;
    const s = syncFaqJsonLd(stale, parseVisibleFaqs(stale));
    expect(s.synced).toBe(true);
    expect(ld(s.html).mainEntity[0].acceptedAnswer.text).toBe('120개월 이상이 기본 조건입니다. 반환일시금 대상 여부를 먼저 확인합니다.');
    // 실제 최종 HTML 두 편: 최종 권위 뒤 JSON-LD == visible
    for (const r of [R1, R2]) {
      const fa = runFinalAuthority({ html: r.htmlFinal, evidence: viewOf(r), keyword: r.keyword });
      const vis = parseVisibleFaqs(fa.html);
      const scripts = [...fa.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]!); } catch { return null; } }).filter(Boolean);
      const faq = scripts.map((j: any) => j['@type'] === 'FAQPage' ? j : (j['@graph'] || []).find((g: any) => g['@type'] === 'FAQPage')).filter(Boolean);
      expect(faq.length).toBe(1);
      expect(faq[0].mainEntity.map((m: any) => [m.name, m.acceptedAnswer.text])).toEqual(vis.map((v) => [v.question, v.answer]));
    }
  });
  test('T7 어긋난 FAQ 를 빼면 visible 과 JSON-LD 에서 동시에 빠진다', () => {
    const items: Array<[string, string]> = [['상품 A 가입 뒤 이직하면 자격이 없어지나요?', '상품 B 는 5년 만기이고 이직 뒤에도 금리는 그대로입니다.'], ['상품 A 는 월 납입을 건너뛰어도 되나요?', '상품 A 는 자유적립식이라 건너뛴 달이 있어도 계좌는 유지됩니다.']];
    const html = `<h2>절</h2><h3>x</h3><p>본문.</p>${faqHtml(items)}<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>`;
    const fa = runFinalAuthority({ html, evidence: ev('상품 A 는 자유적립식이다.'), keyword: '상품 A vs 상품 B' });
    expect(fa.report.faq).toMatchObject({ before: 2, after: 1, ldSynced: true, ldCount: 1 });
    expect(parseVisibleFaqs(fa.html).map((f) => f.question)).toEqual(['상품 A 는 월 납입을 건너뛰어도 되나요?']);
    const ld = JSON.parse((fa.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]!);
    expect(ld.mainEntity.length).toBe(1);
    expect(ld.mainEntity[0].name).toBe('상품 A 는 월 납입을 건너뛰어도 되나요?');
  });
});

describe('DECISION — MAXIMUM 값의 역할 보존 (T8~T10)', () => {
  const E = '청년도약계좌는 5년 동안 월 최대 70만원을 납입할 수 있다.';
  test('T8 live b8cdb4 새 문형(유지할 여력·낼 수 있는 소득 흐름·꾸준히 납입할 수 있으면·유지 가능하면·흔들리지 않는다면) 전부 약화 · 판단축 병렬', () => {
    const fa = runFinalAuthority({ html: R1.htmlFinal, evidence: V1, keyword: R1.keyword, dimensions: ['남은 기간'] });
    const weakened = fa.report.decision.filter((c) => c.action === 'weakened');
    expect(weakened.length).toBeGreaterThanOrEqual(6);
    for (const c of weakened) { expect(c.after).toContain('최대 70만원 한도 안에서 실제 납입 가능액 · 남은 기간을 함께 보고'); expect(c.value).toBe('70만원'); }
    expect(plain(fa.html)).not.toMatch(/70만원 납입을 유지할 여력이 있다면|70만원을 낼 수 있는 소득 흐름이라면|70만원 유지 가능하면/);
    expect(plain(fa.html)).toContain('청년도약계좌를 유지하는 편이 낫습니다');                          // 판정은 그대로
    expect(alignSummaryToBody('5년 동안 월 70만원 납입을 유지할 여력이 있다면 청년도약계좌를 유지하는 편이 낫습니다.', E, { dimensions: ['남은 기간'] }).changes.map((c) => c.rule)).toEqual(['limit-as-condition']);
  });
  test('T9 상한 단순 설명은 그대로 · 근거가 REQUIRED 면 손대지 않음 · IT: 최대 1TB 를 "사용해야 유지" 로 강화 금지', () => {
    expect(weakenSentence('청년도약계좌는 5년 동안 월 70만원 한도에서 저축하는 구조죠.', E).changes).toEqual([]);
    expect(weakenSentence('A 는 월 최대 70만원까지 납입할 수 있다.', E).changes).toEqual([]);
    expect(weakenSentence('월 30만원을 낼 수 있어야 가입이 유지됩니다.', '월 30만원 이상 납입해야 가입이 유지된다. 최대 30만원까지 우대.').changes).toEqual([]);
    expect(valueRoles('요금제는 최대 1TB 저장을 지원한다.', '1TB').roles).toEqual(['MAXIMUM']);
    const it = weakenSentence('1TB를 사용할 수 있어야 이 요금제를 유지할 수 있습니다.', '요금제는 최대 1TB 저장을 지원한다.');
    expect(it.changes[0]).toMatchObject({ action: 'weakened' });
    expect(it.after).toContain('최대 1TB까지');
  });
  test('T10 명시적 가정 계산에서 상한 값을 쓰는 문장은 차단하지 않는다', () => {
    expect(weakenSentence('매월 70만원을 실제로 넣는다고 가정하면 총납입액은 4200만원입니다.', E).changes).toEqual([]);
    expect(weakenSentence('청년도약계좌는 월 70만원을 5년 납입하면 원금 4200만원을 만들 수 있습니다.', E).changes).toEqual([]);   // live 에서 오탐이었던 산술 조건문
  });
});

describe('CORE QUESTION — 전환형 글의 남은 기간 (T11~T13)', () => {
  test('T11 기존 계약 전환 비교 → REMAINING_TERM 질문 계획 (live 키워드 + 보험·구독 MOCK)', () => {
    for (const k of [R1.keyword, '기존 실손보험 유지 vs 4세대 전환', '넷플릭스 12개월 약정 vs 새 요금제 갈아타기']) {
      const p = planCoreQuestions({ keyword: k, evidenceText: k === R1.keyword ? V1.context : '' });
      expect(p[0]).toMatchObject({ id: 'CQ-REMAINING-TERM', applicable: true, dimension: '남은 기간' });
    }
    const rendered = renderCoreQuestions(planCoreQuestions({ keyword: R1.keyword, evidenceText: V1.context }));
    expect(rendered.join('\n')).toMatch(/남은 기간/);
    expect(rendered.join('\n')).not.toMatch(/70만|청년미래적금|도약계좌/);
    const fs2 = require('fs'); const src = fs2.readFileSync(require('path').join(__dirname, '..', 'src', 'core', 'final', 'core-questions.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/청년|도약계좌|미래적금|70만|5년/);
  });
  test('T12 자동차·여행지 비교, 단일 제도 설명 → 질문 없음', () => {
    for (const k of ['아이폰 vs 갤럭시 카메라 비교', '신차 A vs B 비교', '제주 vs 부산 축제 비교', R2.keyword]) expect(planCoreQuestions({ keyword: k })[0]!.applicable).toBe(false);
    expect(coverCoreQuestions('아무 글', planCoreQuestions({ keyword: '신차 A vs B 비교' }))[0]!.status).toBe('NOT_APPLICABLE');
  });
  test('T13 planned 핵심 질문에 최종 답이 없으면 MISSING — live b8cdb4 초안·최종 모두', () => {
    const plan = planCoreQuestions({ keyword: R1.keyword, evidenceText: V1.context });
    expect(coverCoreQuestions(JSON.stringify(R1.draft011), plan)[0]!.status).toBe('MISSING');
    const fa = runFinalAuthority({ html: R1.htmlFinal, evidence: V1, keyword: R1.keyword, coreQuestions: plan, dimensions: ['남은 기간'] });
    expect(fa.report.coreQuestions[0]!.status).toBe('MISSING');                                   // 약화가 끼운 "남은 기간" 낱말로 부풀리지 않는다
    const answered = '이미 가입 중인 사람은 원래 만기 5년이 아니라 지금부터 남은 기간을 놓고 비교해야 합니다.';
    expect(coverCoreQuestions(answered, plan)[0]!.status).toBe('ANSWERED');
    expect(isCoreAnswerSentence(answered, plan)).toBe(true);
    // 게이트: 핵심 질문 답 문장이 사라지는 교체본은 거부
    const e = ev('원래 만기는 5년이다.');
    const g = gateRepairs(`<p>${answered} 참고로 우대금리 표시는 은행마다 다릅니다.</p>`, [{ paragraphIndex: 0, html: '<p>참고로 우대금리 표시는 은행마다 다릅니다.</p>' }], e, { isCoreAnswer: (s) => isCoreAnswerSentence(s, plan) });
    expect(g.decisions[0]!.accepted).toBe(false);
    expect(g.decisions[0]!.lostCore.length).toBe(1);
  });
});

describe('FETCH TRACE (T14~T15)', () => {
  const origFetch = (globalThis as any).fetch;
  afterEach(() => { (globalThis as any).fetch = origFetch; });
  const stub = (impl: () => Promise<any>) => { (globalThis as any).fetch = impl; };
  test('T14 공식 본문 수집 실패 사유가 실제 오류 종류로 남는다', async () => {
    stub(async () => ({ ok: false, status: 403, headers: { get: () => 'text/html' }, text: async () => '' }));
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure).toMatchObject({ reason: 'BLOCKED', status: 403 });
    stub(async () => ({ ok: false, status: 500, headers: { get: () => 'text/html' }, text: async () => '' }));
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure).toMatchObject({ reason: 'HTTP_STATUS', status: 500 });
    stub(async () => ({ ok: true, status: 200, headers: { get: () => 'application/pdf' }, text: async () => '' }));
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure!.reason).toBe('UNSUPPORTED_CONTENT');
    stub(async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html><body><nav>메뉴</nav></body></html>' }));
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure!.reason).toBe('EXTRACT_FAIL');
    stub(async () => { const e: any = new Error('timeout'); e.name = 'TimeoutError'; throw e; });
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure!.reason).toBe('TIMEOUT');
    stub(async () => { const e: any = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; });
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a')).failure!.reason).toBe('NETWORK');
    expect((await fetchPageDocumentDetailed('https://www.example.go.kr/a.hwp')).failure!.reason).toBe('FILE_URL');
    // live b8cdb4: 저장된 trace 에는 사유가 없다 — 사후 추측하지 않는다(UNKNOWN 규칙)
    expect(R1.fetchAttempts.find((a: any) => /87726/.test(a.url))).toMatchObject({ reason: 'fetch-failed' });
    expect(R1.fetchAttempts.find((a: any) => /87726/.test(a.url)).failureReason).toBeUndefined();
  });
  test('T15 수집 실패는 후보를 "공식자료 없음" 으로 바꾸지 않는다 — fetchLog·candidate 에 사유(주입 fetch 는 UNKNOWN), sufficiency 는 snippet-only', async () => {
    const KW = '청년미래적금 VS 청년 도약계좌';
    const news = Array.from({ length: 6 }, (_, i) => ({ title: `청년미래적금 2차 가입 신청 기사 ${i + 1}`, description: '2차 모집', link: `https://news.example.com/a/${i}`, originallink: `https://news.example.com/a/${i}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900' }));
    const cur = { title: '청년미래적금 2차 가입 신청 안내', description: '2차 모집 안내', link: 'https://www.fsc.go.kr/x/2' };   // MOCK
    const fn = async (type: string) => ({ ok: true, items: type === 'news' ? news : type === 'webkr' ? [cur] : [] });
    const g = await fetchGrounding(KW, fn as any, { mainKeyword: KW, fetchBody: async () => '', officialPlan: buildOfficialResearchPlan(KW), officialBoost: { enabled: false, maxQueries: 1 } });
    const att = g.fetchLog!.find((a) => a.url === cur.link)!;
    expect(att).toMatchObject({ attempted: true, ok: false, reason: 'fetch-failed', failureReason: 'UNKNOWN', retrievedChars: 0, title: cur.title });
    expect(att.attemptedAt).toMatch(/^\d{4}-/);
    const c = g.officialStatus!.candidates.find((x) => x.url === cur.link)!;
    expect(c).toMatchObject({ status: 'fetch-failed', failureReason: 'UNKNOWN', roundRelevance: 'current' });
    expect(g.officialStatus!.sufficiency).toBe('snippet-only');
    expect(g.officialStatus!.candidates.length).toBe(1);                                               // 후보에서 빠지지 않는다
    expect(g.fetchLog!.filter((a) => !a.attempted).every((a) => a.failureReason === 'BUDGET_SKIPPED' || a.failureReason === 'FILE_URL')).toBe(true);
  });
});

describe('REGRESSION (T16~T24)', () => {
  test('T16~T18 출처 ID · fullText · validationView', () => {
    for (const r of [R1, R2]) {
      const ids = r.stage2Items.map((i: any) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(r.stage2Items.filter((i: any) => i.hasBody && i.truncatedAt !== undefined).length).toBeGreaterThan(5);
      const v = buildValidationEvidence(r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })), { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence);
      expect(v.basis).toBe('ledger'); expect(v.complete).toBe(true);
    }
  });
  test('T19~T21 범위 · 파생 차액 · 가정', () => {
    expect(extractRanges('13.2~14.4%').map((r) => [r.lower, r.upper, r.unit])).toEqual([[13.2, 14.4, '%']]);
    const table = '<table><tr><th>구분</th><th>A</th><th>B</th></tr><tr><td>월 최대 납입액</td><td>50만원</td><td>70만원</td></tr></table>';
    expect(resolveDerivedDifferences('월 한도 차이는 20만원입니다.', ['20만원'], table, '', (t) => ['50만원', '70만원'].includes(t)).resolved.has('20만원')).toBe(true);
    expect(inspectFactIntegrity('<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p>', ev('1년 앞당길 때마다 6% 감액된다.')).status).toBe('passed');
  });
  test('T22~T24 official sufficient · answer fidelity · FAQ consistency (live 픽스처)', () => {
    expect(R1.officialStatus).toMatchObject({ sufficient: false, sufficiency: 'past-official-only' });
    expect(R2.officialStatus).toMatchObject({ sufficient: true, sufficiency: 'current-official' });
    expect(alignSummaryToBody(R2.answerBox.answer, plain(R2.htmlFinal)).changes).toEqual([]);
    expect(checkFaqConsistency(parseVisibleFaqs(R2.htmlFinal), R2.keyword).dropped).toBe(0);
    expect(checkFaqConsistency(parseVisibleFaqs(R1.htmlFinal), R1.keyword).dropped).toBe(0);
    // 최종 권위 재검사: 두 편 사실 재검사 통과(늦은 재작성 유입 없음), a280b4 는 변경 0(답·FAQ 는 이미 게이트가 지킨다)
    const fa2 = runFinalAuthority({ html: R2.htmlFinal, evidence: V2, keyword: R2.keyword, coreQuestions: planCoreQuestions({ keyword: R2.keyword }) });
    expect(fa2.report.fact.status).toBe('passed');
    expect(fa2.report.decision).toEqual([]);
    expect(fa2.report.faq).toMatchObject({ before: 4, after: 4, ldSynced: true });
    // 배선
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    for (const s of ['evidence: validationView().evidence,', "trace.change('fact-guard'", 'runFinalAuthority({ html, evidence: validationView().evidence', "trace.event('final-authority.output'", 'coreQuestions: plan', "trace.event('core-questions.coverage'"]) expect(orch).toContain(s);
    expect(orch.indexOf('runFinalAuthority({')).toBeGreaterThan(orch.indexOf('fixBeforePublish('));
    expect(orch.indexOf('runFinalAuthority({')).toBeLessThan(orch.indexOf("trace.snapshot('article.visible'"));
  });
});

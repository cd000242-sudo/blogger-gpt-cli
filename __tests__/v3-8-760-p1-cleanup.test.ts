const fs = require('fs');
const path = require('path');

import { extractRanges, isRangeBound, sameRange } from '../src/core/final/range-value';
import { inspectFactIntegrity, inspectArticleFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { valueRoles, findStrengthened, weakenSentence, alignArticleDecisionSemantics } from '../src/core/final/decision-semantics';
import { uniqueDecisionPoints, retainDecisionPoints, keyPhrases } from '../src/core/final/decision-retention';
import { buildDraftFixBlock } from '../src/core/final/draft-audit';
import { checkFaqConsistency, isWeakToken, faqTokenKept, alignSummaryToBody } from '../src/core/final/answer-fidelity';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import { buildOfficialResearchPlan } from '../src/core/final/official-research-plan';

/*
 * v3.8.760 — P0 동결 뒤 알려진 P1 여섯 건. 오프라인(호출 0회). 실제 두 run 픽스처 + 교차 도메인 합성 픽스처(MOCK — 최신 사실 검증이 아니다).
 *   P1-A 범위 수치 · P1-B 판단문 상한→요구 조건 · P1-C 보강 정보 손실 · P1-D 가정 예시 값 · P1-E FAQ 의미 일치 · P1-F 공식 제목 표현 차이
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', p), 'utf8');
const R1 = read('__tests__/fixtures/run-d7a142/run-inputs.json');
const R2 = read('__tests__/fixtures/run-fba7e9/run-inputs.json');
const viewOf = (r: any) => buildValidationEvidence(
  r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })),
  { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence,
);
const PAD = ' 자세한 절차는 취급 기관이 안내합니다. 가입 전 본인 요건을 확인하세요. 신청은 창구와 앱에서 받습니다.'.repeat(3);
const ev = (context: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '합성 주제', context: `[E01] 합성 근거\n${context}${PAD}` });
const PUB = 'Mon, 28 Sep 2026 09:00:00 +0900';
const bodyText = (d: any) => [d.introduction, ...(d.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content)), d.conclusion].join('\n');

describe('P1-A 범위 수치 표기 — 하한·상한·단위 구조로 대조', () => {
  test('A1 표기 여러 꼴이 같은 범위로 읽힌다 · 날짜·음수·단위 불일치는 범위가 아니다', () => {
    const forms = ['13.2~14.4%', '13.2 ~ 14.4%', '13.2∼14.4%', '13.2-14.4%', '13.2 ~ 14.4 퍼센트', '13.2%에서 14.4%', '13.2%부터 14.4%까지'];
    for (const f of forms) expect(extractRanges(`효과는 ${f} 수준입니다`).map((r) => [r.lower, r.upper, r.unit])).toEqual([[13.2, 14.4, '%']]);
    expect(extractRanges('최소 5명에서 최대 10명까지 신청').map((r) => [r.lower, r.upper, r.unit])).toEqual([[5, 10, '명']]);
    expect(extractRanges('2026-09-29 발표')).toEqual([]);
    expect(extractRanges('수익률 -5% 기록')).toEqual([]);
    expect(extractRanges('5%에서 10만원')).toEqual([]);                                             // 단위가 다르면 범위가 아니다
    expect(extractRanges('14.4~13.2%')).toEqual([]);                                                // 하한 ≥ 상한
    expect(isRangeBound('13.2%', extractRanges('최대 13.2~14.4%'))).toBe(true);
    expect(isRangeBound('13.3%', extractRanges('최대 13.2~14.4%'))).toBe(false);
    expect(sameRange({ lower: 13.2, upper: 14.4, unit: '%', raw: '' }, extractRanges('13.2∼14.4퍼센트')[0]!)).toBe(true);
  });
  test('A2 run d7a142 재생: "일반형 최대 13.2%에서 14.4%" 문장이 근거 "13.2~14.4%" 로 보존된다(실제 실행에서는 삭제됐다)', () => {
    expect(R1.factFilterEvent.removed[0]).toMatch(/13\.2%에서 14\.4%/);                            // BEFORE
    const v = viewOf(R1);
    const rep = inspectArticleFactIntegrity(R1.draft017, v.evidence);
    expect(rep.status).toBe('passed');
    const after = sanitizeArticleFactClaims(R1.draft017, v.evidence);
    expect(bodyText(after)).toContain('일반형 최대 13.2%에서 14.4%');
  });
  test('A3 반례: 근거에 A 13.2%, B 14.4% 가 따로 있으면 "A 는 13.2~14.4%" 를 지원하지 않는다', () => {
    const e = ev('상품 A 의 효과는 13.2% 이다. 상품 B 의 효과는 14.4% 이다.');
    const rep = inspectFactIntegrity('<p>상품 A 는 13.2~14.4% 수준의 효과입니다.</p>', e);
    expect(rep.status).toBe('blocked');
    expect(rep.violations.map((x) => x.kind)).toContain('unsupported_range');
    expect(sanitizeFactUnsafeHtml('<p>상품 A 는 13.2~14.4% 수준의 효과입니다.</p>', e)).not.toContain('13.2');
  });
  test('A4 근거 "A 13.2~14.4%" → 같은 범위의 다른 표기 보존 · 하한 단일값도 지원 · 다른 범위는 차단', () => {
    const e = ev('상품 A 의 효과는 최대 13.2~14.4% 수준이다.');
    expect(inspectFactIntegrity('<p>상품 A 는 13.2∼14.4퍼센트 수준입니다.</p>', e).status).toBe('passed');
    expect(inspectFactIntegrity('<p>상품 A 는 13.2%에서 14.4% 수준입니다.</p>', e).status).toBe('passed');
    expect(inspectFactIntegrity('<p>상품 A 의 하한은 13.2% 입니다.</p>', e).status).toBe('passed');
    expect(inspectFactIntegrity('<p>상품 A 는 13.2~15.4% 수준입니다.</p>', e).status).toBe('blocked');
  });
  test('A5 회귀 — 단일값·%p·금액 검사는 그대로', () => {
    const e = ev('기여금은 납입액의 12% 이다. 월 최대 50만원까지 납입한다.');
    expect(inspectFactIntegrity('<p>기여금은 12%p 입니다.</p>', e).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>기여금은 12% 입니다.</p>', e).status).toBe('passed');
    expect(inspectFactIntegrity('<p>월 최대 60만원까지 납입합니다.</p>', e).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>월 최대 50만 원까지 납입합니다.</p>', e).status).toBe('passed');
  });
});

describe('P1-B 판단문의 상한→요구 조건 왜곡 — 값의 역할은 근거에서 읽는다', () => {
  test('B1 run d7a142: 서론·결론·2절의 "70만원 (납입을) 유지할 수 있고/유지하며" 3문장 약화 · run fba7e9 는 0건', () => {
    const v = viewOf(R1);
    expect(valueRoles(v.evidence.context, '70만원').roles).toEqual(['MAXIMUM']);
    const sem = alignArticleDecisionSemantics(R1.draft018, v.evidence.context);
    expect(sem.changes.map((c) => [c.location, c.action])).toEqual([['introduction', 'weakened'], ['conclusion', 'weakened'], ['section.1.h3.0.content', 'weakened']]);
    for (const c of sem.changes) { expect(c.after).toContain('최대 70만원까지 납입할 수 있고'); expect(c.after).not.toMatch(/70만원(?:을| 납입을)? 유지/); }
    expect(bodyText(sem.article)).not.toMatch(/70만원(?:을| 납입을)? 유지(?:하며|할 수 있고)/);
    expect(bodyText(sem.article)).toContain('청년도약계좌를 계속 보유하는 편이 낫습니다');               // 판정 자체는 그대로
    expect(alignArticleDecisionSemantics(R2.draft018, viewOf(R2).evidence.context).changes).toEqual([]);
  });
  test('B2 자동차: "최대 주행거리 500km" 를 "500km를 주행해야 한다" 로 강화하지 않는다 · 치환 불가 서술은 기록만', () => {
    const e = '이 차의 1회 충전 최대 주행거리는 500km 이다.';
    expect(valueRoles(e, '500km').roles).toEqual(['MAXIMUM']);
    const w = weakenSentence('장거리 출장이면 500km를 주행해야 한다.', e);
    expect(w.after).toBe('장거리 출장이면 최대 500km까지 주행할 수 있다.');
    expect(w.changes[0]).toMatchObject({ action: 'weakened', value: '500km' });
    const f = weakenSentence('장거리 출장이면 500km를 달려야 한다.', e);
    expect(f.after).toBe('장거리 출장이면 500km를 달려야 한다.');                                      // 안전한 치환이 없어 두고
    expect(f.changes[0]).toMatchObject({ action: 'flagged' });                                          // 기록만 남긴다
  });
  test('B3 여행: "최대 2시간 무료" 를 "2시간을 이용해야 합니다" 로 바꾸지 않는다', () => {
    const w = weakenSentence('주차장은 2시간을 이용해야 합니다.', '주차장은 최대 2시간 무료다.');
    expect(w.after).toBe('주차장은 최대 2시간까지 이용할 수 있습니다.');
  });
  test('B4 오탐 방지: 근거가 "이상 납입해야" 라면 요구 조건이 맞다 · 근거에 값이 없으면 손대지 않는다 · 이미 "최대" 로 말하면 그대로', () => {
    expect(weakenSentence('월 30만원을 유지해야 혜택이 유지됩니다.', '월 30만원 이상 납입해야 혜택이 유지된다. 최대 30만원까지 우대.').changes).toEqual([]);
    expect(weakenSentence('월 30만원을 유지해야 혜택이 유지됩니다.', '이 상품은 자유적립식이다.').changes).toEqual([]);
    expect(weakenSentence('월 최대 30만원을 유지하며 넣으면 됩니다.', '월 최대 30만원까지 납입.').changes).toEqual([]);
    expect(findStrengthened('월 최대 70만원을 납입하는 구조입니다.')).toEqual([]);                        // 상한 서술은 요구 꼴이 아니다
  });
  test('B5 배선 — 사실 필터 뒤·요약표 앞에서 본문 판단문을 약화한다(trace change)', () => {
    const orch = src('orchestration.ts');
    const at = orch.indexOf('alignArticleDecisionSemantics(allSectionsObj');
    expect(at).toBeGreaterThan(orch.indexOf('sanitizeArticleFactClaims(allSectionsObj'));
    expect(at).toBeLessThan(orch.indexOf('generateSummaryTableFinal(articleTextForAux'));
    expect(orch).toContain("trace.change('decision-semantics'");
  });
});

describe('P1-C 보강 단계가 그 절의 고유 판단 기준을 지우지 않게', () => {
  test('C1 run d7a142 011→014: "가입 시점에 따라 남은 기간은 다르므로 …" 가 사라졐던 절에 되살아난다', () => {
    const pts = uniqueDecisionPoints(R1.draft011);
    expect(pts.map((p) => [p.h2, p.h3])).toEqual([['5년 도약계좌 갈아타기 판단', '해지보다 순서가 먼저']]);
    expect(pts[0]!.phrases).toEqual(['개인 가입', '가입 시점', '시점 남은', '남은 기간']);
    expect(JSON.stringify(R1.draft014)).not.toContain('남은 기간');                                     // BEFORE: 보강이 지웠다
    const kept = retainDecisionPoints(R1.draft011, R1.draft014);
    expect(kept.checked).toBe(1);
    expect(kept.restored.map((r) => [r.h3, r.lost])).toEqual([['해지보다 순서가 먼저', ['개인 가입', '시점 남은', '남은 기간']]]);
    const h3 = kept.article.sections[1].h3Sections[0];
    expect(h3.h3).toBe('해지보다 순서가 먼저');
    expect(h3.content).toContain('<p>개인의 가입 시점에 따라 남은 기간은 다르므로, 이미 납입한 금액과 남은 만기를 함께 놓고 특별중도해지를 판단하는 방식이 맞습니다.</p>');
    expect(kept.article.sections.length).toBe(R1.draft014.sections.length);                            // 다른 절은 그대로
    expect(JSON.stringify(kept.article).length - JSON.stringify(R1.draft014).length).toBeLessThan(120);
  });
  test('C2 같은 뜻이 남아 있으면 되살리지 않는다 · 다른 절에도 있는 관점은 고유하지 않다', () => {
    const before = { sections: [
      { h2: '갈아타기', h3Sections: [{ h3: '순서', content: '<p>먼저 새 계좌를 만듭니다. 개인의 가입 시점에 따라 남은 기간은 다르므로 함께 놓고 판단하는 방식이 맞습니다.</p>' }] },
      { h2: '조건', h3Sections: [{ h3: '소득', content: '<p>소득 기준을 봅니다.</p>' }] },
    ] };
    const afterKept = { sections: [
      { h2: '갈아타기', h3Sections: [{ h3: '순서', content: '<p>가입 시점에 따라 남은 기간이 다르니 남은 기간을 놓고 판단합니다.</p>' }] },
      { h2: '조건', h3Sections: [{ h3: '소득', content: '<p>소득 기준을 봅니다.</p>' }] },
    ] };
    expect(retainDecisionPoints(before, afterKept).restored).toEqual([]);                             // 구절이 살아 있다 — 중복 제거 인정
    const twice = { sections: [before.sections[0]!, { h2: '조건', h3Sections: [{ h3: '소득', content: '<p>가입 시점에 따라 남은 기간은 다릅니다.</p>' }] }] };
    expect(uniqueDecisionPoints(twice)).toEqual([]);                                                     // 두 절에 있으면 고유하지 않다
    expect(keyPhrases('표 칸 글자')).toEqual([]);
  });
  test('C3 보강 지시에 "고유 판단 기준 보존" 한 줄 · generation 이 보강 수락 뒤 되살리기를 실제로 부른다', () => {
    const block = buildDraftFixBlock([{ kind: 'cross-section-echo', title: 'x', evidence: 'y' } as any]);
    expect(block.match(/고유한 답일 수 있습니다/g)?.length).toBe(1);
    const gen = src('generation.ts');
    expect(gen.indexOf('retainDecisionPoints(boostBeforeObj, allSectionsObj)')).toBeGreaterThan(gen.indexOf('allSectionsObj = candidate;'));
    expect(gen).toContain("runTrace.event('writer.boost.retained'");
  });
});

describe('P1-D 명시적 가정 예시의 기준값·계산값', () => {
  test('D1 "원래 월 100만원을 받을 예정이라면 … 월 94만원" — 근거에 100·94 가 없어도 가정 입력 + 검증 규칙(6%) 적용으로 보존', () => {
    const e = ev('조기노령연금은 1년 앞당길 때마다 6% 감액된다.');
    const block = '<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p>';
    const rep = inspectFactIntegrity(block, e);
    expect(rep.status).toBe('passed');
    expect(rep.derived!.map((d) => [d.kind, d.claim, d.verdict])).toEqual([['hypothetical-input', '100만원', 'hypothetical'], ['hypothetical-apply', '94만원', 'hypothetical']]);
    expect(rep.derived![1]!.operation).toBe('100만원 × (1 − 6%)');
    expect(rep.derived![1]!.operands[1]).toMatchObject({ label: '규칙', value: '6%', origin: 'evidence', sourceIds: ['E01'] });
    expect(sanitizeFactUnsafeHtml(block, e)).toBe(block);
  });
  test('D2 가정 표지가 없으면 사실 주장이다 — "월 100만원을 지급한다" 는 그대로 검사·차단', () => {
    const e = ev('조기노령연금은 1년 앞당길 때마다 6% 감액된다.');
    const rep = inspectFactIntegrity('<p>국민연금은 월 100만원을 지급한다.</p>', e);
    expect(rep.status).toBe('blocked');
    expect(rep.derived || []).toEqual([]);
  });
  test('D3 범용: 보험금 1,000만원 가정 → 자기부담금 10% 를 뺀 900만원 보존 · 검증 안 된 비율(20%)로는 못 살린다 · 세후는 대상 아님', () => {
    const e = ev('실손보험의 자기부담금은 10% 이다.');
    const ok = '<p>보험금이 1,000만원이라고 가정하면 자기부담금 10%를 뺀 900만원을 받습니다.</p>';
    const rep = inspectFactIntegrity(ok, e);
    expect(rep.status).toBe('passed');
    expect(rep.derived!.find((d) => d.claim === '900만원')).toMatchObject({ kind: 'hypothetical-apply', verdict: 'hypothetical', operation: '1000만원 × (1 − 10%)' });
    expect(inspectFactIntegrity('<p>보험금이 1,000만원이라고 가정하면 20%를 뺀 800만원을 받습니다.</p>', e).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>보험금이 1,000만원이라고 가정하면 세후 900만원을 받습니다.</p>', e).status).toBe('blocked');
  });
  test('D4 세금 기준액 가정 · 차액 규칙(− d) 도 한 번만 · 가정값은 절대 verified 가 되지 않는다', () => {
    const e = ev('기본공제는 150만원이다.');
    const rep = inspectFactIntegrity('<p>예를 들어 과세표준이 1,000만원이라면 기본공제 150만원을 뺀 850만원이 기준입니다.</p>', e);
    expect(rep.status).toBe('passed');
    for (const d of rep.derived!) { expect(d.verdict).toBe('hypothetical'); expect(d.kind).toMatch(/^hypothetical-/); }
    expect(rep.derived!.find((d) => d.claim === '850만원')!.operation).toBe('1000만원 − 150만원');
  });
  test('D5 run fba7e9 재생: 여전히 통과 · 가정 차액 2건 · 사실(A값 3,193,511원)과 가정(100만원 예시) 구분', () => {
    const v = viewOf(R2);
    const rep = inspectArticleFactIntegrity(R2.draft017, v.evidence);
    expect(rep.status).toBe('passed');
    expect((rep.derived || []).map((d) => d.kind)).toEqual(['hypothetical-diff', 'hypothetical-diff']);
    expect((rep.derived || []).every((d) => d.verdict !== 'verified')).toBe(true);
    expect(bodyText(R2.draft017)).toMatch(/319만\s?3,?511원/);                                          // 실제 규칙 값은 근거로 통과했다(파생 아님)
  });
});

describe('P1-E FAQ 질문·답 의미 일치 — 약한 낱말 하나로 통과하지 않는다', () => {
  test('E1 약한 낱말 목록은 기존 FAQ 정지어 재사용 + 소수 추가', () => {
    for (const w of ['먼저', '경우', '확인', '조건', '가능', '어떻게', '무엇']) expect(isWeakToken(w)).toBe(true);
    expect(isWeakToken('이직')).toBe(false);
    expect(faqTokenKept('조기수령', '조기노령연금청구')).toBe(true);                                        // 어근 2자
    expect(faqTokenKept('1961년생', '1961년부터')).toBe(true);                                            // 수치는 숫자부
    expect(faqTokenKept('먼저', '먼저')).toBe(true);                                                        // 낱말 자체 대조는 하되 위에서 약한 낱말은 걸러진다
  });
  test('E2 "먼저·확인" 만 겹치는 답은 어긋남 · 핵심 낱말(이직)이 남으면 유지', () => {
    const faqs = [
      { question: '이직하면 우대형 자격이 어떻게 되나요?', answer: '청년도약계좌 금리는 먼저 확인해야 합니다. 기본금리에 우대금리가 더해지죠.' },
      { question: '이직하면 우대형 자격이 유지되나요?', answer: '중소기업 재직 기간과 이직 횟수 조건을 확인해야 합니다.' },
    ];
    const r = checkFaqConsistency(faqs, '청년 적금 자격');
    expect(r.notes.map((n) => n.action)).toEqual(['dropped', 'kept']);
    expect(r.notes[0]!.reason).toContain('이직');
    expect(r.notes[1]!.matched).toEqual(['이직']);
  });
  test('E3 실제 두 run: d7a142 는 1번만 제외(대상 뒤바뀜) · fba7e9 는 4개 유지(4번은 "먼저" 가 아니라 "조기수령" 어근으로)', () => {
    const r1 = checkFaqConsistency(R1.visible024.faqItems, R1.keyword);
    expect(r1.notes.map((n) => n.action)).toEqual(['dropped', 'kept', 'kept', 'kept']);
    const r2 = checkFaqConsistency(R2.visible024.faqItems, R2.keyword);
    expect(r2.dropped).toBe(0);
    expect(r2.notes[3]!.matched).toEqual(['조기수령']);
    expect(r2.notes[3]!.matched).not.toContain('먼저');
  });
});

describe('P1-F 공식 페이지 제목 표현 차이 — 제목 일치만 보지 않는다', () => {
  const mk = (results: Record<string, any[]>) => async (type: string) => ({ ok: true, items: results[type] || [] });
  test('F1 run fba7e9 재생: 제목 "노령연금" 페이지가 요약의 조건 표지로 후보가 된다 · 같은 기관의 홈·FAQ·정책 목록은 후보 아님 · 본문은 라이브에서만', async () => {
    const asItem = (i: any) => ({ title: i.title, description: i.cleanedText, link: i.url, originallink: i.url, pubDate: PUB });
    const news = R2.stage1Items.filter((i: any) => i.sourceType === 'news').map(asItem);
    const web = R2.stage1Items.filter((i: any) => i.sourceType !== 'news' && i.sourceType !== 'blog').map(asItem);
    expect(R2.officialStatus.candidates).toEqual([]);                                                   // BEFORE(실제 실행): 후보 0
    const g = await fetchGrounding(R2.keyword, mk({ news, webkr: web }) as any, { mainKeyword: R2.keyword, fetchBody: async () => '', officialPlan: R2.officialPlan, officialBoost: { enabled: false, maxQueries: 1 } });
    const st = g.officialStatus!;
    expect(st.candidates.map((c) => c.url)).toEqual(['https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0056M0.do']);
    expect(st.candidates[0]!.title).toContain('노령연금');
    expect(st).toMatchObject({ sufficient: false, sufficiency: 'snippet-only' });                       // 저장된 본문이 없다 — 라이브에서만 확인
    expect(st.boost.wouldTrigger).toBe(true);
  });
  test('F2 범용(MOCK): 검색 표현 ≠ 공식 제도명이어도 요약이 핵심 질문을 설명하면 후보 · 기관만 같은 무관 페이지는 아님 · 제목 일치가 먼저', async () => {
    const KW = '전기차 충전 요금 감면';
    const titleMatch = { title: '전기차 충전 요금 감면 안내', description: '감면 신청', link: 'https://www.example.go.kr/a' };
    const bodyMatch = { title: '친환경차 보급 지원사업', description: '전기차 보급 지원 대상은 소득 기준 이하 가구이며 충전 시설 이용 안내를 포함한다', link: 'https://www.example.go.kr/b' };
    const unrelated = { title: '기관 소개', description: '연혁과 조직도를 안내한다', link: 'https://www.example.go.kr/c' };
    const search = mk({ news: [{ title: '전기차 충전 요금 감면 기사', description: '', link: 'https://news.example.com/1', originallink: 'https://news.example.com/1', pubDate: PUB }], webkr: [unrelated, bodyMatch, titleMatch] });
    const body = async (u: string) => `${u} 전기차 충전 요금 감면 안내. 대상은 소득 기준 이하. 신청 기간은 3월 2일부터 3월 16일까지 접수한다. `.repeat(12);
    const g = await fetchGrounding(KW, search as any, { mainKeyword: KW, fetchBody: body, officialPlan: buildOfficialResearchPlan(KW), officialBoost: { enabled: false, maxQueries: 1 } });
    expect(g.officialStatus!.candidates.map((c) => c.url)).toEqual([titleMatch.link, bodyMatch.link]);   // 제목 일치 → 요약 설명 순, 무관 페이지 없음
  });
  test('F3 동의어 사전 없음 — grounding 코드에 특정 제도명이 없다', () => {
    const code = src('naver-grounding.ts').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/노령연금|조기수령|국민연금|청년미래적금|도약계좌/);
  });
});

describe('일반화 · 하드코딩 · 회귀', () => {
  test('G1 새 모듈 코드에 이번 사례의 정답(상품명·70만원·100만원·13.2%·우대형)이 없다', () => {
    for (const f of ['range-value.ts', 'decision-semantics.ts', 'decision-retention.ts', 'answer-fidelity.ts', 'derived-difference.ts']) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(code).not.toMatch(/청년미래적금|청년도약계좌|국민연금|우대형|70만|100만|13\.2|94만/);
    }
  });
  test('G2 P0 회귀 — d7a142 답 상자 되돌리기·FAQ 제외 유지, fba7e9 답·FAQ 무변경', () => {
    const b1 = bodyText(R1.draft018);
    expect(alignSummaryToBody(R1.answerBox022.answer, b1).changes.map((c) => c.rule)).toEqual(['limit-as-condition']);
    expect(alignSummaryToBody(R2.answerBox022.answer, bodyText(R2.draft018)).changes).toEqual([]);
  });
});

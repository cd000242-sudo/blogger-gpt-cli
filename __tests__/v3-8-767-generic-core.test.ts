const fs = require('fs');
const path = require('path');

import { inspectFactIntegrity, inspectArticleFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, splitSentencesForFactCheck, extractValueTokens, type FactEvidence } from '../src/core/final/fact-integrity';
import { derivedRole } from '../src/core/final/derived-arithmetic';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { classifySourceAuthority } from '../src/core/final/source-authority';
import { distinctiveTokens, judgeEvidence } from '../src/core/final/evidence';
import { evaluateEvidence } from '../src/core/final/evidence-gate';
import { factcheckWithLineage, splitFactcheck, traceProvenance } from '../src/core/final/content-provenance';
import { repairEmptySections } from '../src/core/final/empty-section-gate';

/*
 * v3.8.767 — CROSS-DOMAIN GENERIC CORE FIX. BATCH 1(자동차 19fb30 · 보험 324f0e · 여행 69f928) 저장 입력 오프라인 재생 + 교차 도메인. 호출 0회.
 *  A. 근거 값의 한 단계 파생 계산 보존  B. 칸·블록 경계 토큰 오염  C. 삭제 범위(절 → 문장)  D. 당사자 1차 출처  E. 값·재작성 계보
 */
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch1-767', 'run-inputs.json'), 'utf8'));
const itemsOf = (run: any) => run.items.map((i: any) => ({ ...i, mainKeyword: run.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null }));
const viewOf = (run: any) => buildValidationEvidence(itemsOf(run), { provider: 'Perplexity Sonar', trustLevel: 'strong', topic: run.keyword, context: '' } as FactEvidence, { paidContext: factcheckWithLineage(run.factcheckSupplement).context }).evidence;
const plain = (s: string) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const blockWith = (draft: any, re: RegExp) => draft.sections.flatMap((s: any) => s.h3Sections).find((h: any) => re.test(h.content)).content as string;
const bodyOf = (d: any) => [d.introduction, ...d.sections.flatMap((s: any) => s.h3Sections.map((h: any) => h.content)), d.conclusion].join('\n');
const ev = (context: string): FactEvidence => ({ context, provider: 'Evidence Ledger', trustLevel: 'strong', sourceUrls: ['https://example.org/a'], topic: '' });

const CAR = R.car; const INS = R.insurance; const TRV = R.travel;
const CAR_VIEW = viewOf(CAR); const INS_VIEW = viewOf(INS); const TRV_VIEW = viewOf(TRV);

describe('DERIVED (T1~T5) — 근거 값의 한 단계 계산은 지우지 않는다', () => {
  test('T1 자동차 live: 555만 원 · 570만 원 → "15만 원 차이" 보존 (live 에선 문장 2개 삭제)', () => {
    expect(CAR.liveFactFilter.violations).toEqual(['근거 장부에서 확인되지 않은 정확한 값: 15만원', '근거 장부에서 확인되지 않은 정확한 값: 15만원']);
    const block = blockWith(CAR.draftBeforeFilter, /15만 원 차이지만/);
    const rep = inspectFactIntegrity(block, CAR_VIEW);
    expect(rep.status).toBe('passed');
    const hit = rep.derived!.find((d) => d.verdict === 'verified')!;
    expect(hit).toMatchObject({ kind: 'evidence-diff', claim: '15만원', role: 'DERIVED_FROM_EVIDENCE' });
    expect(hit.operation).toBe('|555만원 − 570만원|');
    expect(hit.operands.map((o) => o.sourceIds.includes('E02'))).toEqual([true, true]);
    const after = sanitizeFactUnsafeHtml(block, CAR_VIEW);
    expect(after).toContain('두 숫자의 차이는 15만 원이지만');
    expect(after).toContain('570만 원은 15만 원 차이지만');
  });
  test('T2 보험 live: 80,000원 × 35% = 28,000원 보존 — 문장과 계산 표의 칸 모두 (live 에선 칸이 비었다)', () => {
    expect(INS.liveFactFilter.violations).toEqual(['근거 장부에서 확인되지 않은 정확한 값: 28000원', '근거 장부에서 확인되지 않은 정확한 값: 28000원']);
    for (const re of [/<td>28,000원<\/td>/, /하루 교통비 기준은 28,000원/]) {
      const block = blockWith(INS.draftBeforeFilter, re);
      const rep = inspectFactIntegrity(block, INS_VIEW);
      expect(rep.status).toBe('passed');
      expect(rep.derived!.find((d) => d.verdict === 'verified')).toMatchObject({ kind: 'evidence-rate', claim: '28000원', operation: '80000원 × 35%' });
      expect(sanitizeFactUnsafeHtml(block, INS_VIEW)).toMatch(re);
    }
  });
  test('T3 계산 불일치는 거절 — 570 − 555 ≠ 20', () => {
    const e = ev('[E01] 올해 A 차종 국고보조금은 570만원, B 차종은 555만원이다.');
    const rep = inspectFactIntegrity('<p>A 차종 570만원과 B 차종 555만원은 20만원 차이입니다.</p>', e);
    expect(rep.violations.map((v) => v.detail)).toEqual(['근거 장부에서 확인되지 않은 정확한 값: 20만원']);
    expect(rep.derived!.some((d) => d.claim === '20만원' && d.verdict === 'mismatch')).toBe(true);
  });
  test('T4 서로 다른 문서(대상·시점)의 값 조합은 거절 — 피연산자가 같은 근거 문서에 함께 있어야 한다', () => {
    const e = ev('[E01] 2025년 A 보험 상품의 1일 기준액은 80,000원이다.\n\n[E02] 2026년 B 보험 상품의 교통비 비율은 35%다.');
    const rep = inspectFactIntegrity('<p>80,000원에 35%를 적용하면 28,000원입니다.</p>', e);
    expect(rep.status).toBe('blocked');
    expect(rep.derived!.find((d) => d.claim === '28000원')).toMatchObject({ verdict: 'unverifiable' });
    expect(rep.derived!.find((d) => d.claim === '28000원')!.reason).toMatch(/같은 근거 문서/);
  });
  test('T5 여러 단계 계산(80,000 × 35% × 10일)은 범위 밖 — 글자가 근거에 없으면 예전처럼 근거 없음', () => {
    const e = ev('[E01] 1일 대차료 기준액 80,000원에 교통비 비율 35%를 적용한다. 인정기간은 10일이다.');
    const rep = inspectFactIntegrity('<p>80,000원에 35%를 10일 적용하면 교통비는 280,000원입니다.</p>', e);
    expect(rep.violations.map((v) => v.detail)).toEqual(['근거 장부에서 확인되지 않은 정확한 값: 280000원']);
  });
  test('교차 도메인 — 제품 100,000원 × 10% = 10,000원 · 할인가 100,000원 × (1 − 10%) = 90,000원', () => {
    const e = ev('[E01] 정가 100,000원 제품에 10% 할인 쿠폰을 적용할 수 있다.');
    expect(inspectFactIntegrity('<p>100,000원에 10%를 적용하면 할인액은 10,000원입니다.</p>', e).status).toBe('passed');
    expect(inspectFactIntegrity('<p>100,000원에서 10%를 차감하면 결제액은 90,000원입니다.</p>', e).status).toBe('passed');
  });
  test('가상 계산과 실제 파생 계산을 구분한다 — 가정 입력은 HYPOTHETICAL, 근거 입력은 DERIVED_FROM_EVIDENCE', () => {
    const e = ev('[E01] 렌터카를 이용하지 않으면 대차료의 35%를 교통비로 지급한다. 1일 대차료 기준액이 80,000원이면 교통비는 28,000원 수준이다.');
    const hypo = inspectFactIntegrity('<p>예를 들어 1일 대차료가 100,000원이라고 가정하면 35%인 35,000원을 교통비로 받습니다.</p>', e);
    const roles = (hypo.derived || []).map((d) => derivedRole(d)).filter(Boolean);
    expect(roles).toContain('HYPOTHETICAL');
    expect(roles).not.toContain('DERIVED_FROM_EVIDENCE');
    const real = inspectFactIntegrity('<p>80,000원에 35%를 적용하면 28,000원입니다.</p>', ev('[E01] 1일 대차료 기준액 80,000원 · 교통비 비율 35%'));
    expect((real.derived || []).map((d) => derivedRole(d))).toContain('DERIVED_FROM_EVIDENCE');
  });
});

describe('BOUNDARY (T6~T8) — 칸·블록 경계가 없는 값을 만들지 않는다', () => {
  const TABLE_THEN_QUOTE = '<table><tbody><tr><td>입장 마감</td><td>20:30</td></tr></tbody></table><blockquote>주차 요금은 기본 시간 표기부터 갈립니다.</blockquote>';
  test('T6 "20:30" 칸 + 다음 블록 "주차" → 30주 생성 안 됨 (live 69f928 의 가짜 값)', () => {
    expect(TRV.liveFactFilter.violations).toEqual(['근거 장부에서 확인되지 않은 정확한 값: 30주']);
    expect(extractValueTokens(TABLE_THEN_QUOTE)).not.toContain('30주');
    expect(inspectFactIntegrity(TABLE_THEN_QUOTE, ev('[E01] 입장 마감은 20:30 이다. 주차 요금은 기본 시간 표기부터 갈린다.')).violations).toEqual([]);
    expect(extractValueTokens('관람은 21:30 주차장 이용 뒤')).not.toContain('30주');   // 시각의 분은 값의 시작이 아니다
  });
  test('T7 자연 문장 "30주 동안" 은 그대로 30주로 읽는다', () => {
    expect(extractValueTokens('임신 30주 동안 정기 검진을 받습니다.')).toContain('30주');
    expect(extractValueTokens('<p>임신 30주 동안 정기 검진을 받습니다.</p>')).toContain('30주');
  });
  test('T8 칸 사이 구분자 유지 — 1000원 | 주차 · 행·표 끝은 문장 경계', () => {
    const s = splitSentencesForFactCheck('<table><tr><td>1000원</td><td>주차</td></tr><tr><td>500km</td><td>주행</td></tr></table><p>다음 문장.</p>');
    expect(s).toEqual(['1000원 | 주차', '500km | 주행', '다음 문장.']);
    expect(extractValueTokens('<td>3</td><td>주 동안</td>')).toEqual([]);
  });
});

describe('DELETION (T9~T11) — 근거 없는 주장 1개 ≠ 절 전체 무효', () => {
  const E = ev('[E01] 소형차 주차 요금은 10분당 800원이다. 야간관람은 19:00부터 21:30까지이며 입장 마감은 20:30이다.');
  test('T9 태그 밖 맨 글자의 근거 없는 문장 1개 → 그 문장만 제거, 절 보존 (예전: 절 전체 "")', () => {
    const html = '주차 요금은 10분당 800원입니다. 기본 요금은 7,000원입니다. <table><tr><td>입장 마감</td><td>20:30</td></tr></table><p>야간관람은 19:00부터 21:30까지입니다.</p>';
    const out = sanitizeFactUnsafeHtml(html, E);
    expect(out).toContain('10분당 800원');
    expect(out).not.toContain('7,000원');
    expect(out).toContain('<td>20:30</td>');
    expect(out).toContain('야간관람은 19:00부터 21:30까지입니다.');
  });
  test('T10 표 칸 하나가 근거 없음 → 그 칸만 비우고 다른 칸은 보존', () => {
    const out = sanitizeFactUnsafeHtml('<table><tr><td>초과 요금</td><td>10분당 800원</td><td>하루 최대 42,000원</td></tr></table>', E);
    expect(out).toContain('<td>10분당 800원</td>');
    expect(out).toContain('<td></td>');
    expect(out).not.toContain('42,000원');
  });
  test('T11 절의 주장이 전부 근거 없음 → 예전처럼 절 제거 가능', () => {
    expect(sanitizeFactUnsafeHtml('<p>2026년 주차 요금은 5,500원입니다.</p><p>하루 최대 33,000원입니다.</p>', E)).toBe('');
  });
  test('여행 live 주차 절 — 재생에서 970자급 절이 그대로 남는다 (live 에선 0자 → 빈 절 수리)', () => {
    const before = TRV.draftBeforeFilter;
    const after = sanitizeArticleFactClaims(before, TRV_VIEW);
    const chars = (d: any) => d.sections.map((s: any) => plain(s.h3Sections.map((h: any) => h.content).join(' ')).length);
    expect(chars(after)).toEqual(chars(before));
    expect(chars(before)[4]).toBeGreaterThan(700);
    expect(plain(bodyOf(after))).toContain('10분당 800원');
    expect(inspectArticleFactIntegrity(before, TRV_VIEW).violations).toEqual([]);
  });
});

describe('SOURCE AUTHORITY (T12~T15) — 공식은 정부만이 아니다, 권위 범위는 청구 범위와 묶인다', () => {
  const kw = (run: any) => ({ mainKeyword: run.keyword, distinctive: distinctiveTokens(run.keyword) });
  const item = (run: any, id: string) => run.items.find((i: any) => i.id === id);
  test('T12 제조사 자사 제품 페이지(live E06 kia.com) → SUBJECT_OWNER_PRIMARY', () => {
    const i = item(CAR, 'E06');
    expect(i.isOfficial).toBe(false);
    expect(classifySourceAuthority({ url: i.url, tag: '웹', title: i.title, text: i.cleanedText, ...kw(CAR) })).toMatchObject({ authority: 'SUBJECT_OWNER_PRIMARY', owner: 'kia' });
  });
  test('T13 보험사 자사 공시·약관(live E05·E10 samsungfire.com) → SUBJECT_OWNER_PRIMARY', () => {
    for (const id of ['E05', 'E10']) {
      const i = item(INS, id);
      expect(classifySourceAuthority({ url: i.url, tag: '웹', title: i.title, text: i.cleanedText, ...kw(INS) }).authority).toBe('SUBJECT_OWNER_PRIMARY');
    }
  });
  test('T14 제조사 페이지는 정부 정책 원문을 대신하지 않는다 — 보조금 주제는 여전히 GROUNDING_WEAK, 상품 주제는 당사자 1차로 충족', () => {
    const car = itemsOf(CAR).map((i: any) => ({ ...i, authority: i.id === 'E06' ? 'SUBJECT_OWNER_PRIMARY' : 'SECONDARY' }));
    const g = evaluateEvidence(car, CAR.keyword);
    expect(g.status).toBe('GROUNDING_WEAK');
    expect(g.reasons.join(' ')).toMatch(/당사자 1차 1건은 자사 상품 범위라 정부 원문을 대신하지 않음/);
    const ins = itemsOf(INS).map((i: any) => ({ ...i, isOfficial: false, authority: /samsungfire/.test(i.domain) ? 'SUBJECT_OWNER_PRIMARY' : 'SECONDARY' }));
    expect(evaluateEvidence(ins, '자동차보험 대차료 교통비 기준').reasons.some((r) => /공식기관/.test(r))).toBe(false);
    expect(evaluateEvidence(ins.map((i: any) => ({ ...i, authority: 'SECONDARY' })), '자동차보험 대차료 교통비 기준').reasons.some((r) => /공식기관/.test(r))).toBe(true);
    expect(classifySourceAuthority({ url: 'https://www.kia.com/kr/vehicles/ev3/features', title: 'EV3 | Kia', mainKeyword: 'EV3 국고보조금', distinctive: ['EV3'] }).authority).not.toBe('PUBLIC_AUTHORITY_OFFICIAL');
  });
  test('T15 제3자 복사·모음 글은 1차가 아니다 — 블로그 · 기사 · 비교 글', () => {
    const d = { mainKeyword: CAR.keyword, distinctive: distinctiveTokens(CAR.keyword) };
    expect(classifySourceAuthority({ url: 'https://m.blog.naver.com/x/1', tag: '블로그', title: 'EV3 가격표 | Kia 공식 자료 정리', ...d }).authority).toBe('SECONDARY');
    expect(classifySourceAuthority({ url: 'https://www.kpinews.kr/newsView/1', tag: '웹', title: 'EV3 가격 공개', text: '… 홍길동 기자 … 무단전재 및 재배포 금지', ...d }).authority).toBe('SECONDARY');
    expect(classifySourceAuthority({ url: 'https://ev-vs.com/models/ev3', tag: '웹', title: '기아 EV3 가격 비교 총정리 | EV-VS', ...d }).authority).toBe('SECONDARY');
    const live = CAR.items.filter((i: any) => !i.isOfficial).map((i: any) => classifySourceAuthority({ url: i.url, tag: i.sourceType === 'news' ? '뉴스' : i.sourceType === 'blog' ? '블로그' : '웹', title: i.title, text: i.cleanedText, ...d }));
    expect(live.filter((v: any) => v.authority === 'SUBJECT_OWNER_PRIMARY').length).toBe(1);   // live 44건 중 kia.com 제품 페이지 하나만
  });
  test('judgeEvidence 가 authority 를 싣고, 공공기관 isOfficial 의미는 그대로다', () => {
    const r = judgeEvidence({ title: 'EV3 특징 및 디자인 상세 차량 정보 | Kia | 대한민국', url: 'https://www.kia.com/kr/vehicles/ev3/features', tag: '웹', query: CAR.keyword, text: '기아 EV3 롱레인지 1회 충전 주행거리 501km 국고보조금 가격', hasBody: true }, CAR.keyword);
    expect(r.item).toMatchObject({ isOfficial: false, authority: 'SUBJECT_OWNER_PRIMARY', owner: 'kia' });
  });
});

describe('PROVENANCE (T16~T18) — 최종 값마다 계보, 재작성 경로도 캡처', () => {
  test('T16 팩트체크가 준 새 값 + 인용 주소 → FACTCHECK_SOURCE 로 추적 (live 447km·545km)', () => {
    const ledger = ledgerFromItems([...itemsOf(CAR).map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: CAR.packetText }]);
    const entries = traceProvenance(CAR.liveFinalVisibleText, { ledger, factcheck: { provider: 'Perplexity Sonar', query: CAR.keyword, paragraphs: splitFactcheck(CAR.factcheckSupplement) } });
    for (const v of ['447km', '545km']) {
      const e = entries.find((x) => x.claim === v)!;
      expect(e.kind).toBe('FACTCHECK_SOURCE');
      expect(e.factcheck!.lineage).toBe('inline');
      expect(e.factcheck!.urls).toContain('https://www.kia.com/kr/vehicles/ev3/specification');
    }
    expect(entries.find((x) => x.claim === '4415만 원')!.kind).toBe('EVIDENCE_SOURCE');
    expect(entries.filter((x) => x.kind === 'NONE')).toEqual([]);
  });
  test('T17 팩트체크가 준 새 정확한 값 + 주소 없음 → 검사 근거에서 빠져 원고에서 지워지고, 계보는 NONE', () => {
    const noUrl = '보조금은 612만원으로 확정됐다.';
    expect(factcheckWithLineage(noUrl)).toMatchObject({ context: '', dropped: 1, ledger: [] });   // v3.8.770 — 장부 항목도 함께 돌려준다(주소 없으면 빈 장부)
    const items = [{ id: 'E01', title: '보조금 기사', url: 'https://news.example/1', domain: 'news.example', sourceType: 'news', isOfficial: false, hasBody: true, pubDate: null, cleanedText: '올해 전기차 보조금 제도가 개편됐다. 세부 금액은 차종별로 다르다.', mainKeyword: 'x', sourceName: 'x', retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null }];
    const base = { provider: 'Perplexity Sonar', trustLevel: 'strong', topic: 'x', context: '' } as FactEvidence;
    const without = buildValidationEvidence(items as any, base, { paidContext: factcheckWithLineage(noUrl).context }).evidence;
    expect(sanitizeFactUnsafeHtml('<p>올해 보조금은 612만원입니다.</p><p>세부 금액은 차종별로 다릅니다.</p>', without)).not.toContain('612만원');
    const withUrl = `${noUrl} [출처] https://gov.example/notice`;
    const kept = buildValidationEvidence(items as any, base, { paidContext: factcheckWithLineage(withUrl).context }).evidence;
    expect(sanitizeFactUnsafeHtml('<p>올해 보조금은 612만원입니다.</p>', kept)).toContain('612만원');
    expect(traceProvenance('올해 보조금은 612만원입니다.', { ledger: [], factcheck: { provider: 'p', query: 'q', paragraphs: splitFactcheck(noUrl) } })[0]!.kind).toBe('NONE');
  });
  test('T18 빈 절 재작성 — 입력·출력·값 대조·근거 ID 가 결과에 남고, orchestration 이 run-trace 로 보낸다', async () => {
    const article = { introduction: '<p>경복궁 야간관람 안내입니다. 입장 마감과 주차를 함께 봅니다.</p>', conclusion: '', sections: [{ h2: '주차장 이용 전 확인할 사항', h3Sections: [{ h3: '요금보다 사용 가능 여부', content: '' }] }] };
    const repaired = '<p>주차장 이용 전에 확인할 사항은 사용 가능 여부입니다. 행사에 따라 사용불가 안내가 공지될 수 있습니다. 소형차 주차 요금은 10분당 800원이며 입장 마감 20:30 전에 도착하도록 이동 계획을 세웁니다.</p>';
    const deps = (content: string) => ({
      title: '경복궁 야간관람 주차', mainKeyword: '경복궁 야간관람 주차', intentQuestions: ['경복궁 야간관람 때 주차는 어떻게 판단하나요?'],
      packetText: '', evidenceText: '', ledger: ledgerFromItems([{ id: 'E01', text: '소형차 주차 요금은 10분당 800원. 입장 마감 20:30' }]),
      callModel: async () => JSON.stringify({ h3Sections: [{ index: 0, content }] }),
    });
    const { result } = await repairEmptySections(article, deps(repaired));
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toMatchObject({ h2: '주차장 이용 전 확인할 사항', accepted: true, content: repaired, unsupported: [] });
    expect(result.outputs[0]!.values.find((v) => v.claim === '800원')!.sourceIds).toEqual(['E01']);
    // 값 대조를 우회하지 않는다 — 근거 없는 값이 든 수리 본문은 채택되지 않지만 출력은 기록된다
    const bad = await repairEmptySections(article, deps(repaired.replace('10분당 800원', '10분당 1,200원')));
    expect(bad.result.outputs[0]).toMatchObject({ accepted: false, unsupported: ['1,200원'] });
    expect(bad.result.unresolved).toHaveLength(1);
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toMatch(/trace\.event\('empty-section\.input'/);
    expect(orch).toMatch(/trace\.change\('empty-section', \{ fn: 'repairEmptySections'[^\n]*model: require\('\.\/model-use'\)\.modelsSince\(esModelSnap\)[^\n]*outputs: es\.result\.outputs/);
    expect(orch).toMatch(/trace\.event\('provenance'/);
    expect(orch).toMatch(/checkClaims\(judgeBodyText, claimLedger\(\), new Date\(\), derivedLedger(?:, variant)?\)/);
  });
});

describe('REGRESSION — BATCH 1 재생: 정상 값 회귀 없음 · 본문 관문', () => {
  test('자동차: 4415만 원 · 555만 원 · 501km · 721만 원 · 3694만 원 그대로, 지워지는 문장 0', () => {
    const after = sanitizeArticleFactClaims(CAR.draftBeforeFilter, CAR_VIEW);
    expect(plain(bodyOf(after))).toBe(plain(bodyOf(CAR.draftBeforeFilter)));
    for (const v of ['4415만 원', '555만 원', '501km', '721만 원', '3694만 원', '15만 원']) expect(plain(bodyOf(after))).toContain(v);
  });
  test('보험: 35% · 25일 · 30일 · 160시간 · 10일 · 28,000원 그대로 · 본문 관문은 파생값 기록으로 통과', () => {
    const after = sanitizeArticleFactClaims(INS.draftBeforeFilter, INS_VIEW);
    const text = plain(bodyOf(after));
    expect(text).toBe(plain(bodyOf(INS.draftBeforeFilter)));
    for (const v of ['35%', '25일', '30일', '160시간', '10일', '28,000원', '280,000원']) expect(text).toContain(v);
    const ledger = ledgerFromItems([...itemsOf(INS).map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: INS.packetText }]);
    const derived = (inspectArticleFactIntegrity(after, INS_VIEW).derived || []).filter((d) => d.verdict === 'verified').map((d) => ({ claim: d.claim, operation: d.operation, sourceIds: [...new Set(d.operands.flatMap((o) => o.sourceIds))] }));
    expect(checkClaims(text, ledger).unsupported).toEqual(['28,000원']);                                   // 예전 관문: 파생값을 근거 없음으로 봄
    expect(checkClaims(text, ledger, new Date(), derived).unsupported).toEqual([]);
    expect(checkClaims(text, ledger, new Date(), derived).supported.find((s) => s.via === 'derived')).toMatchObject({ claim: '28,000원', operation: '80000원 × 35%' });
  });
  test('여행: 위반 0 · 19:00 · 20:30 · 3,000매 · 10월 2일 그대로', () => {
    const after = sanitizeArticleFactClaims(TRV.draftBeforeFilter, TRV_VIEW);
    for (const v of ['19:00', '20:30', '3,000매', '10월 2일', '10분당 800원']) expect(plain(bodyOf(after))).toContain(v);
  });
  test('도메인·키워드 하드코딩 없음 — 새 모듈에 특정 회사·차종·장소 이름이 없다', () => {
    for (const f of ['derived-arithmetic.ts', 'source-authority.ts', 'content-provenance.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(src).not.toMatch(/kia|samsung|기아|삼성|EV3|경복궁|대차료|교통비/i);
    }
  });
});

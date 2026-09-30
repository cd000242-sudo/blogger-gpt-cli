const fs = require('fs');
const path = require('path');

import { checkTitleAuthority, resolveTitleAuthority } from '../src/core/final/title-authority';
import { isLexicalValue } from '../src/core/final/value-boundary';
import { extractValueTokens, inspectFactIntegrity, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { extractClaims, checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { factcheckWithLineage } from '../src/core/final/content-provenance';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { distinctiveTokens } from '../src/core/final/evidence';
import { visiblePlainText } from '../src/core/final/visible-article';
import { runFinalAuthority } from '../src/core/final/final-authority';

/*
 * v3.8.770 — FINAL TITLE AUTHORITY + VALUE TOKEN LEXICAL BOUNDARY + FACTCHECK LEDGER PARITY.
 * BATCH 2 저장 run(행정 48417f · IT a4fc1b) 오프라인 재생 + 교차 도메인. 호출 0회.
 */
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch2-770', 'run-inputs.json'), 'utf8'));
const ADMIN = R.admin; const IT = R.it;
const fcOf = (run: any) => factcheckWithLineage(run.factcheckSupplement, [], distinctiveTokens(run.keyword));
const baseLedger = (run: any) => [...run.items.map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: run.packetText }];
const itemsOf = (run: any) => run.items.map((i: any) => ({ ...i, mainKeyword: run.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null }));
const viewOf = (run: any) => buildValidationEvidence(itemsOf(run), { provider: 'Perplexity Sonar', trustLevel: 'strong', topic: run.keyword, context: '' } as FactEvidence, { paidContext: fcOf(run).context }).evidence;
const IT_TITLE = '갤럭시 S26 자급제 eSIM 듀얼심 지원, 4000mAh 45W 충전';

describe('TITLE AUTHORITY (T1~T5)', () => {
  test('T1 live a4fc1b: 제목 4000mAh 가 최종 본문·답 상자·팩트체크와 수치 충돌 → CONTRADICTED', () => {
    expect(IT.visible.title).toBe(IT_TITLE);
    const r = checkTitleAuthority(IT_TITLE, IT.finalHtml, fcOf(IT).ledger.map((l: any) => l.text));
    expect(r.pass).toBe(false);
    const c = r.claims.find((x) => x.claim === '4000mAh')!;
    expect(c.verdict).toBe('CONTRADICTED');
    expect(c.reason).toMatch(/4300mAh/);
    expect(c.evidence[0]).toBe('국내 공식 사양은 4000mAh와 45W가 아니라 표준 용량 4300mAh 정격 용량 4175mAh와 25W 고속 유선 충전입니다.');
    // 소제목("4000mAh 45W 충전 성능")·목차는 사실 진술이 아니다 — 지지로 세지 않는다
    expect(c.evidence.join(' ')).not.toMatch(/충전 성능/);
  });
  test('T1b 교차 도메인 수치 — 자동차 500km vs 최종 480km · 보험 교통비 50% vs 35%', () => {
    expect(checkTitleAuthority('신형 전기차 1회 충전 500km 주행', '<p>공식 인증 1회 충전 주행거리는 480km입니다.</p>').claims[0]).toMatchObject({ claim: '500km', verdict: 'CONTRADICTED' });
    expect(checkTitleAuthority('렌트 안 하면 교통비 50% 보상', '<p>렌터카를 쓰지 않으면 교통비는 인정 대차료의 35%입니다.</p>').claims[0]).toMatchObject({ claim: '50%', verdict: 'CONTRADICTED' });
    expect(checkTitleAuthority('렌트 안 하면 교통비 50% 보상', '<p>과실 비율이 20%면 80%만 보상됩니다.</p>').claims[0]!.verdict).toBe('UNCHECKED');   // 다른 대상의 %는 비교하지 않는다
  });
  test('T2 가능/불가 충돌 — 행정 "대리인 온라인 발급 가능" vs 최종 "본인만 · 대리인 온라인 불가"', () => {
    const r = checkTitleAuthority('인감증명서 대리인 온라인 발급 가능', '<p>정부24 온라인 발급은 본인만 할 수 있고 대리인의 온라인 발급 신청은 불가능합니다.</p>');
    expect(r.claims[0]).toMatchObject({ kind: 'categorical', verdict: 'CONTRADICTED' });
    // 질문형 제목(live 48417f "… 대리인 발급 여부")은 주장이 아니다
    expect(checkTitleAuthority(ADMIN.visible.title, ADMIN.finalHtml, fcOf(ADMIN).ledger.map((l: any) => l.text))).toMatchObject({ pass: true, claims: [] });
  });
  test('T3 통과하는 기존 후보가 있으면 그 후보로 — 교체는 제목이 굳는 자리(비평 루프 뒤·연도 정리 전)에서만', () => {
    const doc = '<p>공식 사양은 4000mAh가 아니라 표준 용량 4300mAh입니다.</p>';
    const r = resolveTitleAuthority('갤럭시 S26 4000mAh 45W', ['갤럭시 S26 4000mAh 45W', '갤럭시 S26 배터리 4300mAh 충전 정리'], doc);
    expect(r).toMatchObject({ replaced: true, title: '갤럭시 S26 배터리 4300mAh 충전 정리' });
    expect(r.tried.map((t) => t.pass)).toEqual([true]);
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    const freeze = orch.slice(orch.indexOf('void titleRevisedByCritic;'), orch.indexOf('const sections = allSectionsObj.sections;'));
    expect(freeze).toMatch(/resolveTitleAuthority\(String\(h1 \|\| ''\), payload\.titleMode === 'custom' && fixedTitle \? \[\] : \(titleGateResult\?\.history/);
    expect(freeze.indexOf('resolveTitleAuthority(')).toBeLessThan(freeze.indexOf("h1 = collapseRepeatedYear(String(h1 || ''))"));
  });
  test('T4 안전한 후보가 없으면 보류 — live a4fc1b 는 후보가 최종 제목 1개(재생성 없음) → pass=false · 새 제목을 짓지 않는다', () => {
    const r = resolveTitleAuthority(IT_TITLE, [IT_TITLE], IT.finalHtml, fcOf(IT).ledger.map((l: any) => l.text));
    expect(r).toMatchObject({ replaced: false, title: IT_TITLE });
    expect(r.result.pass).toBe(false);
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toMatch(/TITLE_AUTHORITY_PASS: titleGate\.pass,/);
    expect(orch).toContain('const publishEnforced = qualityLoopOn || !criticalGate.pass || !titleGate.pass;');
    // 판정 자리는 최종 HTML 로 검사만 한다(Judge 뒤 불변) — 모순이면 보류
    expect(orch).toMatch(/const titleAuth = checkTitleAuthority\(String\(h1 \|\| ''\), html, factcheckLedger\.map/);
  });
  test('T5 본문과 제목이 맞으면 PASS — BATCH 1·2 의 정상 제목 · 보험 "35%"', () => {
    expect(checkTitleAuthority('자동차보험 렌트 안 하면 교통비 보상 기준 대차료 계산 35%', '<p>렌터카를 이용하지 않으면 인정 대차료의 35% 상당액을 교통비로 받습니다.</p>').pass).toBe(true);
    expect(checkTitleAuthority('갤럭시 S26 자급제 eSIM 듀얼심 지원', IT.finalHtml).pass).toBe(true);
  });
});

describe('LEXICAL BOUNDARY (T6~T11)', () => {
  test('T6 "정부24 일반용" → 24일 없음 · live 48417f 가 지운 문장을 이제 지우지 않는다', () => {
    expect(ADMIN.liveFactFilter).toEqual({ violations: ['근거 장부에서 확인되지 않은 정확한 값: 24일'], removed: ['본인이 신청할 수 있으면 정부24 일반용 발급을 검토합니다.'] });
    expect(extractValueTokens('본인이 신청할 수 있으면 정부24 일반용 발급을 검토합니다.')).toEqual([]);
    const block = ADMIN.draftBeforeFilter.sections.flatMap((s: any) => s.h3Sections).find((h: any) => h.content.includes('정부24 일반용 발급을 검토')).content;
    expect(inspectFactIntegrity(block, viewOf(ADMIN)).violations).toEqual([]);
    expect(sanitizeFactUnsafeHtml(block, viewOf(ADMIN))).toContain('본인이 신청할 수 있으면 정부24 일반용 발급을 검토합니다.');
  });
  test('T7 "정부24 대상" → 24대 없음 · T8 목차 "6 위임장" → 6위 없음 (live 48417f 본문 관문 "24 대"·"6 위")', () => {
    expect(ADMIN.liveBodyUnsupported).toEqual(['6 위', '24 대']);
    expect(extractClaims('정부24 대상에서 제외됩니다. 정부24 대리 발급은 불가합니다.')).toEqual([]);
    expect(extractClaims('4 대리 발급 가능 범위부터 확인하기 5 대리인 준비 서류 6 위임장 작성과 서식')).toEqual([]);
    expect(checkClaims(visiblePlainText(ADMIN.visible), ledgerFromItems([...baseLedger(ADMIN), ...fcOf(ADMIN).ledger])).unsupported).toEqual([]);
  });
  test('T9 차량 24대 · T10 순위 6위 · 30주 동안 · 24일까지 · 월50만원 → 값', () => {
    expect(extractClaims('차량 24대가 등록됐습니다.').map((c) => c.text)).toEqual(['24대']);
    expect(extractClaims('차량 24 대가 있다.').map((c) => c.text)).toEqual(['24 대']);
    expect(extractClaims('검색순위 6위를 기록했습니다.').map((c) => c.text)).toEqual(['6위']);
    expect(extractValueTokens('임신 30주 동안')).toEqual(['30주']);
    expect(extractValueTokens('신청기간은 24일까지입니다.')).toEqual(['24일']);
    expect(extractValueTokens('월50만원 납입')).toEqual(['50만원']);
  });
  test('T11 767 회귀 — 20:30 + 주차 → 30주 없음 · 이름에 붙은 숫자(S26·EV3)는 값이 아니다', () => {
    expect(extractValueTokens('<table><tr><td>입장 마감</td><td>20:30</td></tr></table><blockquote>주차 요금은</blockquote>')).not.toContain('30주');
    expect(extractValueTokens('입장 마감 20:30 주차 요금은')).toEqual([]);
    expect(isLexicalValue('갤럭시 S26 배터리', 5, '26 배')).toBe(false);
    expect(isLexicalValue('정부24 대상', 2, '24 대')).toBe(false);
    expect(isLexicalValue('차량 24 대가', 3, '24 대')).toBe(true);
  });
});

describe('FACTCHECK LEDGER PARITY (T12~T16)', () => {
  test('T12 주소 + 뒷받침 문단 + 채택 → 장부 편입 (live a4fc1b 삼성 사양 문단)', () => {
    const fc = fcOf(IT);
    expect(fc.ledger).toHaveLength(1);
    expect(fc.ledger[0]!.id).toBe('FACTCHECK1');
    expect(fc.ledger[0]!.text).toContain('삼성은 약 30분 충전으로 최대 55%까지 충전된다고 안내합니다.');
    expect(fc.ledger[0]!.text).toContain('https://www.samsung.com/sec/smartphones/galaxy-s26/specs/');
  });
  test('T13 주소 없는 요약 → 편입 안 함 (LLM 자체는 출처가 아니다)', () => {
    expect(factcheckWithLineage('삼성은 약 30분 충전으로 최대 55%까지 충전된다고 안내합니다.', [], ['갤럭시', 'S26']).ledger).toEqual([]);
  });
  test('T14 주제 범위 — 다른 대상 문단은 주소가 있어도 편입 안 함', () => {
    const txt = '아이폰 18 프로는 45W 충전을 지원합니다.\n\n출처: https://www.apple.com/kr/iphone-18-pro/specs/';
    const r = factcheckWithLineage(txt, [], distinctiveTokens(IT.keyword));
    expect(r).toMatchObject({ ledger: [], offTopic: 1 });
  });
  test('T15 live 55%: 본문 관문 BEFORE 근거 없음 → AFTER 팩트체크 문단(삼성 사양 URL)으로 지지', () => {
    expect(IT.liveBodyUnsupported).toEqual(['55%']);
    const text = visiblePlainText(IT.visible);
    expect(checkClaims(text, ledgerFromItems(baseLedger(IT))).unsupported).toEqual(['55%']);
    const after = checkClaims(text, ledgerFromItems([...baseLedger(IT), ...fcOf(IT).ledger]));
    expect(after.unsupported).toEqual([]);
    expect(after.supported.find((s) => s.claim === '55%')!.sourceIds).toEqual(['FACTCHECK1']);
    // 사실 필터 문맥과 본문 관문 장부가 같은 문단 — 한 함수 결과를 둘 다 쓴다
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain('factcheckLedger = paidWithLineage.ledger;');
    expect(orch).toMatch(/paidContext: paidWithLineage\.context,/);
    expect(orch).toMatch(/\.\.\.factcheckLedger,\n\s*\]\);/);
  });
  test('T16 제목 권위가 팩트체크 장부를 쓴다 — 본문이 말하지 않아도 채택 팩트체크의 거부 문맥이 제목 값을 막는다', () => {
    const bodyOnly = '<p>갤럭시 S26 자급제는 듀얼심을 지원합니다.</p>';
    expect(checkTitleAuthority('갤럭시 S26 4000mAh', bodyOnly).claims[0]!.verdict).toBe('UNCHECKED');
    const withFc = checkTitleAuthority('갤럭시 S26 4000mAh', bodyOnly, fcOf(IT).ledger.map((l: any) => l.text));
    expect(withFc.claims[0]).toMatchObject({ verdict: 'CONTRADICTED' });
    expect(withFc.claims[0]!.evidence.join(' ')).toMatch(/4,000mAh·30분 69%로 표기하는 자료는 다른 지역·모델과 혼동한/);
    // final-authority 보고에도 제목이 들어간다
    const fa = runFinalAuthority({ html: IT.finalHtml, evidence: viewOf(IT), keyword: IT.keyword, coreQuestions: [], title: IT_TITLE, factcheck: fcOf(IT).ledger.map((l: any) => l.text) });
    expect(fa.report.title).toMatchObject({ pass: false });
  });
});

describe('LIVE REPLAY — 발행 판단', () => {
  const decide = (live: any, patch: Record<string, boolean>) => { const g = { ...live.hardGates, ...patch }; return Object.values(g).every(Boolean) ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW'; };
  test('행정 48417f: 거짓 MANUAL_REVIEW(BODY_FACT) → AUTO_PUBLISH · 제목 권위 PASS', () => {
    expect(ADMIN.liveHardGates).toMatchObject({ publishDecision: 'MANUAL_REVIEW', manualReviewReason: 'BODY_FACT_PASS' });
    const body = checkClaims(visiblePlainText(ADMIN.visible), ledgerFromItems([...baseLedger(ADMIN), ...fcOf(ADMIN).ledger])).unsupported;
    const title = checkTitleAuthority(ADMIN.visible.title, ADMIN.finalHtml, fcOf(ADMIN).ledger.map((l: any) => l.text));
    expect(decide(ADMIN.liveHardGates, { BODY_FACT_PASS: body.length === 0, TITLE_AUTHORITY_PASS: title.pass })).toBe('AUTO_PUBLISH');
  });
  test('IT a4fc1b: 사유가 BODY_FACT(55%, 가짜) → TITLE_AUTHORITY(4000mAh, 진짜)로 바뀌고 보류(enforced)', () => {
    expect(IT.liveHardGates).toMatchObject({ publishDecision: 'MANUAL_REVIEW', manualReviewReason: 'BODY_FACT_PASS' });
    const body = checkClaims(visiblePlainText(IT.visible), ledgerFromItems([...baseLedger(IT), ...fcOf(IT).ledger])).unsupported;
    const title = resolveTitleAuthority(IT_TITLE, [IT_TITLE], IT.finalHtml, fcOf(IT).ledger.map((l: any) => l.text));
    const patch = { BODY_FACT_PASS: body.length === 0, TITLE_AUTHORITY_PASS: title.result.pass };
    expect(patch).toEqual({ BODY_FACT_PASS: true, TITLE_AUTHORITY_PASS: false });
    expect(decide(IT.liveHardGates, patch)).toBe('MANUAL_REVIEW');
    expect(IT.finalHtml).toContain('국내 공식 사양은 4000mAh와 45W가 아니라');     // 본문은 바꾸지 않는다
  });
  test('패킷이 블로그 값을 facts 로 올린 기록(범위 밖 — 기록만)', () => {
    expect(IT.packetFactsWithValues.map((f: any) => `${f.claim} [${f.sourceIds.join(',')}]`)).toEqual(expect.arrayContaining(['갤럭시 S26의 배터리는 4,000mAh로 표기되어 있다. [E06]']));
  });
  test('하드코딩 없음 — 새 모듈에 회사·모델·서비스 이름이 없다', () => {
    for (const f of ['title-authority.ts', 'value-boundary.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(src).not.toMatch(/삼성|samsung|갤럭시|S26|정부24|인감|4000|4300|45W/i);
    }
  });
});

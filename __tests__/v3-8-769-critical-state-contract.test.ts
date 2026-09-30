const fs = require('fs');
const path = require('path');

/*
 * v3.8.769 — CRITICAL STATE FINAL CONTRACT. Writer · 답 상자 · 최종 발행 판단이 같은 canonical 상태를 쓴다. 호출 0회.
 * BATCH 1 여행 run 69f928(답 상자 "10월 2일 관람이라면 … 예매하면 됩니다") 저장 입력 재생 + 교차 도메인.
 */
let capturedPrompt = '';
jest.mock('../src/core/final/gemini-engine', () => ({
  callGeminiWithRetry: jest.fn(async (p: string) => { capturedPrompt = p; return JSON.stringify({ type: 'summary', question: 'q', answer: '10월 2일 관람분은 조기 매진됐습니다.', basis: 'b', headers: ['항목', '내용'], rows: [['예매', 'NOL 티켓']] }); }),
  callGeminiWithGrounding: jest.fn(),
  resolveSectionTimeoutMs: () => 1000,
}));

import { extractCriticalStates, criticalStateCoverage, criticalStateGate, renderCriticalStatesForAnswer, type CriticalState } from '../src/core/final/critical-state';
import { generateSummaryTableFinal } from '../src/core/final/generation';
import { distinctiveTokens } from '../src/core/final/evidence';

const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch1-767', 'state-768.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch1-767', 'publish-769.json'), 'utf8'));
const TODAY = '2026-09-30';
const TRAVEL_STATES = extractCriticalStates(S.travel.packet, { keyword: S.travel.keyword, today: TODAY, distinctive: distinctiveTokens(S.travel.keyword) });
const strip = (h: string) => String(h).replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ');
/** orchestration 과 같은 계산: 최종 HTML → coverage → gate → hardGates → (품질 루프 OFF) 결정 */
const decide = (liveGates: Record<string, boolean>, html: string, states: CriticalState[]) => {
  const cov = states.length ? criticalStateCoverage(strip(html), states) : [];
  const gate = criticalStateGate(cov);
  const hardGates = { ...liveGates, CRITICAL_STATE_PASS: gate.pass };
  return { cov, gate, decision: Object.values(hardGates).every(Boolean) ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW', enforced: !gate.pass };
};
const mk = (claim: string, keyword: string, title: string) => extractCriticalStates({ mainKeyword: 'x', currentAsOf: TODAY, facts: [{ claim, sourceIds: ['E01'] }], sourceMap: [{ id: 'E01', title, pubDate: '2026-09-20' }] }, { keyword, today: TODAY, distinctive: distinctiveTokens(keyword) });
const ALL_PASS = { TITLE_FACT_PASS: true, EVIDENCE_GATE_PASS: true, BODY_FACT_PASS: true };

describe('ANSWER BOX INPUT (T1~T3)', () => {
  test('T1 같은 상태 배열이 답 상자(요약표) 호출 입력에 들어간다 — 새 추출·새 호출 없음', async () => {
    capturedPrompt = '';
    await generateSummaryTableFinal('<p>본문</p>', { title: '2026 경복궁 야간관람 예매', promises: [], criticalStates: TRAVEL_STATES });
    expect(capturedPrompt).toContain('⏱️ 지금 독자의 행동을 바꾸는 상태');
    expect(capturedPrompt).toContain('- 10월 2일 예매: 2026-09-02 보도 기준 조기 매진 [E10,E11,E12,E13,E08]');
    expect(capturedPrompt).not.toMatch(/UNAVAILABLE|BOOK\b|CURRENT\b/);
    capturedPrompt = '';
    await generateSummaryTableFinal('<p>본문</p>', { title: 't', promises: [] });
    expect(capturedPrompt).not.toContain('⏱️ 지금 독자의 행동을 바꾸는 상태');                       // 상태 없는 글은 프롬프트 그대로
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toMatch(/generateSummaryTableFinal\(articleTextForAux, \{[\s\S]{0,400}criticalStates: researchPacket\.criticalStates \|\| \[\],/);
  });
  test('T2 답 상자가 같은 상태를 설명 → COVERED', () => {
    expect(criticalStateCoverage('10월 2일 관람분은 2026-09-02 보도 기준 조기 매진됐습니다. 10월 1일 관람은 전날까지 NOL 티켓에서 예매합니다.', TRAVEL_STATES)[0]!.status).toBe('COVERED');
  });
  test('T3 답 상자가 반대 행동 안내 → CONTRADICTED (live 69f928 답 상자) · 언급 없음 → MISSING', () => {
    expect(P.travel.answerBox).toMatch(/^10월 1일 또는 10월 2일 관람이라면 NOL 티켓에서 선착순 예매하면 됩니다\./);
    expect(criticalStateCoverage(P.travel.answerBox, TRAVEL_STATES)[0]!.status).toBe('CONTRADICTED');
    expect(criticalStateCoverage('관람은 19:00부터 21:30까지입니다.', TRAVEL_STATES)[0]!.status).toBe('MISSING');
  });
});

describe('FINAL DOCUMENT (T4~T8) — 어느 부품이든 canonical 상태와 반대면 blocker', () => {
  const BODY_OK = '<p>10월 2일 관람분은 조기 매진됐습니다.</p>';
  const ANSWER_BAD = '<section class="answer-first"><p class="answer-first-a">10월 2일에도 선착순 예매하면 됩니다.</p></section>';
  test('T4 본문 정상 + 답 상자 모순 → MANUAL_REVIEW', () => {
    const r = decide(ALL_PASS, `${ANSWER_BAD}${BODY_OK}`, TRAVEL_STATES);
    expect(r.cov[0]!.status).toBe('CONTRADICTED');
    expect(r).toMatchObject({ decision: 'MANUAL_REVIEW', enforced: true });
    expect(r.gate.reason).toBe('현재 상태와 반대 안내: 10월 2일 조기 매진');
  });
  test('T5 답 상자 정상 + 본문 모순 → MANUAL_REVIEW', () => {
    const r = decide(ALL_PASS, '<section class="answer-first"><p class="answer-first-a">10월 2일 관람분은 조기 매진됐습니다.</p></section><p>10월 2일에도 예매할 수 있습니다.</p>', TRAVEL_STATES);
    expect(r.decision).toBe('MANUAL_REVIEW');
  });
  test('T6 FAQ 답에서 반대 안내 → blocker (질문 문장 자체는 주장 아님)', () => {
    const faq = '<details><summary>Q. 10월 2일 표를 살 수 있나요?</summary><p>10월 2일도 NOL 티켓에서 예매할 수 있습니다.</p></details>';
    expect(decide(ALL_PASS, `${BODY_OK}${faq}`, TRAVEL_STATES).decision).toBe('MANUAL_REVIEW');
    expect(decide(ALL_PASS, `${BODY_OK}<details><summary>Q. 10월 2일 표를 살 수 있나요?</summary><p>10월 2일 관람분은 매진됐습니다.</p></details>`, TRAVEL_STATES).decision).toBe('AUTO_PUBLISH');
  });
  test('T7 표에서 반대 안내 → blocker (IT 재고 소진 + "현재 구매 | 가능")', () => {
    const st = mk('사전예약 기간 중 1차 물량 재고가 소진됐다.', '갤럭시 사전예약', '갤럭시 사전예약 안내');
    const r = decide(ALL_PASS, '<p>사전예약 소식입니다.</p><table><tr><th>항목</th><th>상태</th></tr><tr><td>현재 구매</td><td>가능</td></tr></table>', st);
    expect(r.cov[0]!.status).toBe('CONTRADICTED');
    expect(r.decision).toBe('MANUAL_REVIEW');
  });
  test('T8 MISSING 은 blocker 가 아니다', () => {
    const r = decide(ALL_PASS, '<p>관람은 19:00부터 21:30까지입니다. 10월 2일까지 운영합니다.</p>', TRAVEL_STATES);
    expect(r.cov[0]!.status).toBe('MISSING');
    expect(r).toMatchObject({ decision: 'AUTO_PUBLISH', enforced: false });
  });
});

describe('SCOPE (T9·T10)', () => {
  test('T9 critical state 없는 글 → 게이트 true · 발행 판단 변화 없음', () => {
    expect(criticalStateGate([])).toEqual({ pass: true, reason: '' });
    expect(decide(ALL_PASS, '<p>10월 2일에도 예매할 수 있습니다.</p>', []).decision).toBe('AUTO_PUBLISH');
  });
  test('T10 보도 기준일은 확인 시점일 뿐 — 영구 매진으로 쓰지 않고, 취소분 안내는 모순이 아니다', () => {
    const block = renderCriticalStatesForAnswer(TRAVEL_STATES);
    expect(block).toContain('2026-09-02 보도 기준');
    expect(block).toContain('보도 기준일은 확인 시점입니다 — 그 뒤 취소분·추가 판매 여부는 근거에 없습니다');
    expect(block).not.toMatch(/영구|계속 매진|다시 열리지|더 이상 판매하지/);
    expect(criticalStateCoverage('10월 2일 관람분은 9월 초 보도 기준 조기 매진됐지만 취소분이 풀리면 예매할 수 있습니다.', TRAVEL_STATES)[0]!.status).toBe('COVERED');
    expect(TRAVEL_STATES[0]).not.toHaveProperty('until');
  });
});

describe('LIVE REPLAY (T11·T12) — BATCH 1 저장 run', () => {
  test('T11 경복궁 실제 최종 글: AUTO_PUBLISH → MANUAL_REVIEW (문장은 고치지 않는다)', () => {
    expect(P.travel.livePublishDecision).toBe('AUTO_PUBLISH');
    expect(Object.values(P.travel.liveHardGates).every(Boolean)).toBe(true);
    const r = decide(P.travel.liveHardGates, P.travel.finalHtml, TRAVEL_STATES);
    expect(r.cov[0]).toMatchObject({ status: 'CONTRADICTED', evidence: ['10월 1일 또는 10월 2일 관람이라면 NOL 티켓에서 선착순 예매하면 됩니다.'] });
    expect(r).toMatchObject({ decision: 'MANUAL_REVIEW', enforced: true });
    expect(P.travel.finalHtml).toContain('선착순 예매하면 됩니다');
  });
  test('T12 자동차·보험: 상태 0개 → 게이트 true · live 판정 그대로(자동차 MANUAL_REVIEW=근거 관문 · 보험 AUTO_PUBLISH)', () => {
    for (const k of ['car', 'insurance'] as const) {
      const states = extractCriticalStates(S[k].packet, { keyword: S[k].keyword, today: TODAY, distinctive: distinctiveTokens(S[k].keyword) });
      expect(states).toEqual([]);
      const r = decide(P[k].liveHardGates, P[k].finalHtml, states);
      expect(r.gate.pass).toBe(true);
      expect(r.decision).toBe(P[k].livePublishDecision);
    }
    expect(P.car.liveManualReviewReason).toBe('EVIDENCE_GATE_PASS');
  });
});

describe('CROSS-DOMAIN — 부품별 반대 안내', () => {
  const cases: Array<[string, string, string, string, string]> = [
    ['정책 · 답 상자', '청년 월세 지원 신청은 원래 9월 15일까지였으나 9월 10일 조기 마감됐다.', '청년 월세 지원 신청', '청년 월세 지원 신청 안내', '<section class="answer-first"><p class="answer-first-a">지금 신청할 수 있습니다.</p></section>'],
    ['자동차 · 본문', '사전 예약 판매를 시작했으나 이후 주문이 중단됐다.', '신형 전기차 사전 예약', '신형 전기차 사전 예약 안내', '<p>현재 공식 홈페이지에서 주문 가능합니다.</p>'],
    ['보험 · FAQ', '해당 운전자 특약은 9월 1일 판매가 종료됐다.', '운전자보험 특약', '운전자보험 특약 판매 안내', '<details><summary>Q. 지금 가입되나요?</summary><p>현재 이 특약에 가입할 수 있습니다.</p></details>'],
    ['여행 · 답 상자', '10월 2일 관람분은 예매 시작 뒤 조기 매진됐다.', '2026 경복궁 야간관람 예매', '경복궁 야간관람 예매 안내', '<p class="answer-first-a">10월 2일 표는 지금 예매하면 됩니다.</p>'],
    ['IT · 표', '사전예약 기간 중 1차 물량 재고가 소진됐다.', '갤럭시 사전예약', '갤럭시 사전예약 안내', '<table><tr><td>현재 구매</td><td>가능</td></tr></table>'],
    ['채용 · 본문', '공개채용 접수는 마감일 전에 조기 마감됐다.', '공개채용 접수', '공개채용 접수 공고', '<p>마감일까지 지원할 수 있습니다.</p>'],
  ];
  test.each(cases)('%s → CONTRADICTED · MANUAL_REVIEW', (_label, claim, keyword, title, html) => {
    const st = mk(claim, keyword, title);
    expect(st).toHaveLength(1);
    const r = decide(ALL_PASS, html, st);
    expect(r.cov[0]!.status).toBe('CONTRADICTED');
    expect(r.decision).toBe('MANUAL_REVIEW');
  });
});

describe('WIRING — orchestration', () => {
  const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
  test('답 상자 coverage 기록 · 최종 HTML 로 게이트 · hardGates · enforced', () => {
    expect(orch).toMatch(/trace\.event\('critical-state\.coverage', \{ stage: 'answer-box'/);
    expect(orch).toMatch(/criticalStateCoverage\(String\(html \|\| ''\)\.replace\([^\n]*researchPacket\.criticalStates \|\| \[\]\)/);
    expect(orch).toMatch(/CRITICAL_STATE_PASS: criticalGate\.pass,/);
    expect(orch).toMatch(/const publishEnforced = qualityLoopOn \|\| !criticalGate\.pass(?: \|\| !(?:titleGate|surfaceGate)\.pass)?(?: \|\| !userGate\.pass)?;/);
    expect(orch).toMatch(/recordPublishDecision\(html, publishDecision, manualReviewReason, String\(h1 \|\| ''\), publishEnforced\)/);
    expect(orch.indexOf("const criticalGate = criticalStateGate(criticalFinal)")).toBeLessThan(orch.indexOf('CRITICAL_STATE_PASS: criticalGate.pass'));
  });
});

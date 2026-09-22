/**
 * v3.8.747 — 릴리스 직전 통합 점검 (유료 호출 0 · 네트워크 0)
 *
 *   · 품질 루프 OFF(기존 사용자 기본): 관문은 돌되 발행을 막지 않는다(enforced=false). 실측: 루프 없는 초안 10편 중 2편이 BODY_FACT/EMPTY_SECTION 으로 막혔고,
 *     OFF 에는 고쳐 줄 편집기가 없어 막다른 길이었다. 736 설계("기본은 734 와 같다") 로 되돌린다.
 *   · 품질 루프 ON: MANUAL_REVIEW 는 막는다. forcePublish 는 명시적 true 만. 우회(forcePublish · 사람이 고친 본문)는 기록한다.
 *   · 예약발행: MANUAL_REVIEW 는 재시도(=재생성, 유료)하지 않고 실패로 남긴다.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-preflight-747'), isPackaged: false } }));

import * as fs from 'fs';
import * as path from 'path';
import { recordPublishDecision, checkPublishDecision, findManualReviewByTitle, recordPublishOverride, listPublishOverrides, clearPublishDecisions } from '../src/core/final/publish-gate';

process.env['NO_LIVE_LLM'] = '1';
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const DIR = path.resolve('.tmp-tests/test-preflight-747');
const HTML_BAD = '<p>근거 없는 11월 2일 마감</p>';

describe('① Publish Gate — OFF 는 참고, ON 은 차단', () => {
  beforeEach(() => clearPublishDecisions());
  it('⭐⭐ 루프 OFF(enforced=false) 의 MANUAL_REVIEW 는 기록되지만 발행을 막지 않는다', async () => {
    recordPublishDecision(HTML_BAD, 'MANUAL_REVIEW', 'BODY_FACT_PASS', '제목', false);
    const rec = checkPublishDecision(HTML_BAD)!;
    expect(rec.decision).toBe('MANUAL_REVIEW');
    expect(rec.enforced).toBe(false);
    const src = read('src/core/index.ts');
    expect(src).toMatch(/hold\.decision === 'MANUAL_REVIEW' && hold\.enforced === false && !forced/);   // 알리기만
    expect(src).toMatch(/hold\.decision === 'MANUAL_REVIEW' && hold\.enforced !== false && !forced/);   // 막기
  });
  it('⭐ 루프 ON(enforced 기본 true) 의 MANUAL_REVIEW 는 막는다 · 지문이 다르면(편집됨) 막지 않는다', () => {
    recordPublishDecision(HTML_BAD, 'MANUAL_REVIEW', 'FINAL_JUDGE_PASS', '제목');
    expect(checkPublishDecision(HTML_BAD)!.enforced).toBe(true);
    expect(checkPublishDecision(HTML_BAD + ' ')).not.toBeNull();            // 공백 차이는 같은 지문
    expect(checkPublishDecision('<p>근거 없는 마감</p>')).toBeNull();        // 고친 본문 = 다른 지문
    expect(findManualReviewByTitle('제목')!.reason).toBe('FINAL_JUDGE_PASS');
    expect(findManualReviewByTitle('다른 제목')).toBeNull();
  });
  it('⭐ orchestration 은 enforced 에 qualityLoopOn 을 넘기고, 장부에 publishHoldEnforced/qualityLoopEnabled 를 남긴다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toMatch(/recordPublishDecision\(html, publishDecision, manualReviewReason, String\(h1 \|\| ''\), qualityLoopOn\)/);
    expect(orch).toContain('publishHoldEnforced: qualityLoopOn');
    expect(orch).toContain('qualityLoopEnabled: qualityLoopOn');
    expect(orch).toMatch(/품질 관문 참고\(품질 루프 OFF · 발행은 막지 않음\)/);
  });
});

describe('② forcePublish — 명시적 true 만 · 우회는 기록', () => {
  beforeEach(() => { clearPublishDecisions(); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ } });
  it('⭐ forcePublish 는 `=== true` 로만 판정한다 (undefined · null · "true" 문자열은 꺼진 것)', () => {
    const src = read('src/core/index.ts');
    expect(src).toMatch(/const forced = payload\?\.forcePublish === true;/);
    expect(src).not.toMatch(/payload\?\.forcePublish\b(?! === true)/);
  });
  it('⭐ forcePublished · userEdited 는 메모리와 파일(jsonl) 에 남는다', () => {
    const o = recordPublishOverride('forcePublish', '제목', 'FINAL_JUDGE_PASS · 심사: CTA MIXED_ENTITY');
    expect(o.kind).toBe('forcePublish');
    expect(o.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    recordPublishOverride('userEdited', '제목2', 'BODY_FACT_PASS');
    expect(listPublishOverrides().map((x) => x.kind)).toEqual(['forcePublish', 'userEdited']);
    const file = path.join(DIR, 'publish-overrides.jsonl');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(2);
    const src = read('src/core/index.ts');
    expect(src).toMatch(/recordPublishOverride\('forcePublish', title, hold\.reason\)/);
    expect(src).toMatch(/recordPublishOverride\('userEdited', title, prior\.reason\)/);
  });
});

describe('③ 예약발행 — MANUAL_REVIEW 는 재생성 재시도 없이 실패로 남는다', () => {
  const resetStore = () => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ } fs.mkdirSync(DIR, { recursive: true }); };
  beforeEach(() => { resetStore(); jest.resetModules(); });
  afterAll(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ } });

  const drive = async (publishResult: any) => {
    let generated = 0;
    jest.doMock('../src/core/index', () => ({
      runPost: jest.fn(async () => { generated += 1; return { ok: true, title: 't', html: '<p>x</p>' }; }),
      publishGeneratedContent: jest.fn(async () => publishResult),
    }));
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    const id = m.addSchedule({ topic: 't', keywords: ['t'], platform: 'wordpress', publishType: 'publish', payload: {}, maxRetries: 3, scheduleDateTime: new Date(Date.now() - 60_000).toISOString() });
    const schedule = m.getAllSchedules().find((s: any) => s.id === id);
    await (m as any).processScheduledPost(schedule);
    return { after: m.getAllSchedules().find((s: any) => s.id === id), generated };
  };

  it('⭐⭐ MANUAL_REVIEW → status failed · errorMessage 에 사유 · 재시도 0 (retryCount 0 그대로)', async () => {
    const { after, generated } = await drive({ ok: false, error: 'MANUAL_REVIEW — 품질 관문 미통과. 사유: FINAL_JUDGE_PASS', blockedReason: 'MANUAL_REVIEW', recoverable: true });
    expect(after.status).toBe('failed');
    expect(after.retryCount).toBe(0);
    expect(after.errorMessage).toContain('MANUAL_REVIEW');
    expect(generated).toBe(1);
  });
  it('일반 발행 실패는 예전대로 재시도(pending · retryCount 1)', async () => {
    const { after } = await drive({ ok: false, error: '네트워크 오류' });
    expect(after.status).toBe('pending');
    expect(after.retryCount).toBe(1);
  });
  it('AUTO_PUBLISH 는 예전대로 completed', async () => {
    const { after } = await drive({ ok: true, url: 'https://example.com/p/1' });
    expect(after.status).toBe('completed');
  });
});

describe('④ 관문 실행 표 — OFF 에서도 도는 것 / ON 에서만 도는 것 (코드 기준)', () => {
  const orch = read('src/core/final/orchestration.ts');
  const loopOn = orch.indexOf("const qualityLoopOn = ");
  const finalQa = orch.indexOf('const runFinalQa = ');
  it('OFF 에서도: Title Fact Gate · EMPTY_SECTION · FAQ 관문 · CTA 검증 · Hard Gate 계산 · 판정 기록', () => {
    expect(orch.indexOf("titleGateResult = await ensureGroundedTitle(")).toBeLessThan(loopOn);
    expect(orch.indexOf("require('./empty-section-gate')")).toBeLessThan(loopOn);
    const faqAt = orch.indexOf("require('./faq-fact-guard')"); expect(faqAt).toBeGreaterThan(loopOn); expect(faqAt).toBeLessThan(finalQa);
    expect(orch.indexOf('ctas = await generateCTAsFinal(')).toBeLessThan(finalQa);
    expect(orch).toMatch(/const hardGates: Record<string, boolean> = \{/);
  });
  it('ON 에서만: Critic 1 · Research Recovery · Editor · Verification · Editorial · Final Judge · Final QA FAQ', () => {
    const loopBlock = orch.slice(loopOn, orch.indexOf('void titleRevisedByCritic;'));
    expect(loopBlock).toContain("require('./critique-loop')");
    expect(loopBlock).toContain('moreResearch: async');
    const qaBlock = orch.slice(finalQa, orch.indexOf('const bodyClaimCheck ='));
    expect(qaBlock).toContain('runFinalJudge(');
    expect(qaBlock).toContain("require('./faq-fact-guard').guardFaqs(faqs, ledgerNow)");
    expect(orch).toMatch(/FINAL_JUDGE_PASS: runFinalQa \? !!finalJudge && finalJudge\.decision === 'PASS' : true/);
  });
  it('ON 호출 순서: Empty Section → Critic(→Recovery) → Editor → Verification → Editorial → FAQ/CTA → Judge → Publish Gate', () => {
    const loop = read('src/core/final/critique-loop.ts');
    const body = loop.slice(loop.indexOf('export async function runCritiqueLoop'));
    const idx = (s: string) => body.indexOf(s);
    expect(idx('runCritic1(ctx(), units)')).toBeLessThan(idx('input.moreResearch(critic1.researchQueries)'));
    expect(idx('input.moreResearch(critic1.researchQueries)')).toBeLessThan(idx('reviseSections(ctx(), units, openIssues())'));
    expect(idx('reviseSections(ctx(), units, openIssues())')).toBeLessThan(idx('runVerification(ctx(), units, pendingModel, revisedIds)'));
    expect(idx('runVerification(ctx(), units, pendingModel, revisedIds)')).toBeLessThan(idx('runEditorialCritic(ctx(), units)'));
    expect(orch.indexOf("require('./empty-section-gate')")).toBeLessThan(orch.indexOf("require('./critique-loop')"));
    expect(orch.indexOf('ctas = await generateCTAsFinal(')).toBeLessThan(orch.indexOf('runFinalJudge('));
    expect(orch.indexOf('runFinalJudge(')).toBeLessThan(orch.indexOf("require('./publish-gate').recordPublishDecision("));
  });
});

describe('⑤ 구버전 설정·장부 호환', () => {
  it('qualityLoop 없는 payload → OFF · 새 필드 없는 장부 항목을 읽어도 기본값', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toMatch(/const qualityLoopOn = \(payload as any\)\.qualityLoop === true \|\| process\.env\['QUALITY_LOOP'\] === '1';/);
    const { readLedger } = require('../src/core/final/publish-ledger');
    const p = path.join(DIR, 'ledger-compat.json');
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify([{ at: '2026-09-01T00:00:00.000Z', keyword: '옛 글', auditScore: 90 }]), 'utf8');   // 장부는 JSON 배열
    const rows = readLedger(p);
    expect(rows).toHaveLength(1);
    expect(rows[0].qualityConverged).toBeUndefined();
    expect(rows[0].finalDecision).toBeUndefined();
    expect(rows[0].researchRecoveryTriggered).toBeUndefined();
  });
});

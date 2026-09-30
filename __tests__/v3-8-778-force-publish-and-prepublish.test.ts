/**
 * v3.8.778 — FINAL REQUIREMENT PARITY + AGENT FORCE PUBLISH
 *
 * A. 에이전트 글이 작성자 요구로 보류(PUBLISH_HELD)될 때만 "검토 후 강제 발행" — 확인창 승인 · forcePublish === true 만 · 장부 감사 기록
 * B. 일반(API) 경로의 발행 전 자가 수정도 같은 압축 계약을 받는다(에이전트와 같은 공통 함수) · 단계 유지 검사
 * 실제 발행 0: 없는 플랫폼 이름 + fetch·axios 차단. 새 AI 호출 0.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-778'), isPackaged: false } }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

import * as fs from 'fs';
import * as path from 'path';
import { parseUserRequirements, compactRequirementBlock, withRequirementContract } from '../src/core/final/user-requirement';
import { checkUserRequirements, requirementGate, stageRegressions, holdSummary } from '../src/core/final/user-requirement-coverage';
import { captureAgentRequirements, withRequirements, agentStageRegressions, agentPublishCheck, clearAgentEvidence, rememberAgentEvidence } from '../src/core/final/agent-requirement';
import { recordPublishDecision, clearPublishDecisions } from '../src/core/final/publish-gate';
import { fixBeforePublish } from '../src/core/final/pre-publish-fix';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
/** 주석을 뺀 코드만 — 설명 주석의 낱말을 코드로 세지 않는다 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const between = (src: string, start: string, end: string) => { const a = src.indexOf(start); expect(a).toBeGreaterThan(-1); const b = src.indexOf(end, a + start.length); expect(b).toBeGreaterThan(a); return src.slice(a, b); };
const ORCH = read('src/core/final/orchestration.ts');
const MAIN = read('electron/main.ts');
const POSTING = read('electron/ui/modules/posting.js');
const WORKSHOP = read('electron/ui/modules/codex-workshop.js');

// ── 화면 모듈을 그대로 실행한다(import 없음) ──
const FP_SRC = read('electron/ui/modules/agent-force-publish.js');
// eslint-disable-next-line no-new-func
const fp = new Function(`${FP_SRC.replace(/^export /gm, '')}; return { HOLD_CATEGORY_LABELS, isAgentPublishHeld, needsStrongConfirm, buildForcePublishConfirmText, buildStrongConfirmText, approveForcePublish, clearForcePublishOffer, renderForcePublishOffer };`)();

type FakeEl = { id: string; tag: string; type: string; textContent: string; style: { cssText: string }; children: FakeEl[]; attrs: Record<string, string>; handlers: Record<string, () => Promise<void> | void>; parent?: FakeEl | { children: FakeEl[] }; setAttribute(k: string, v: string): void; appendChild(c: FakeEl): FakeEl; addEventListener(t: string, fn: () => Promise<void> | void): void; remove(): void };
function fakeDoc() {
  const body = { children: [] as FakeEl[], appendChild(el: FakeEl) { el.parent = body; body.children.push(el); return el; } };
  const createElement = (tag: string): FakeEl => {
    const el: FakeEl = {
      id: '', tag, type: '', textContent: '', style: { cssText: '' }, children: [], attrs: {}, handlers: {},
      setAttribute(k, v) { el.attrs[k] = v; },
      appendChild(c) { c.parent = el; el.children.push(c); return c; },
      addEventListener(t, fn) { el.handlers[t] = fn; },
      remove() { const p = el.parent; if (p) p.children = p.children.filter((x) => x !== el); },
    };
    return el;
  };
  return { body, createElement, getElementById: (id: string) => body.children.find((c) => c.id === id) || null };
}
const buttonOf = (panel: FakeEl, text: string) => panel.children.find((c) => c.tag === 'button' && c.textContent === text)!;

// ── 공용 입력 ──
const KEYWORD = '인감증명서 온라인 발급 가능한 용도 대리인 발급 여부';
const REQUEST = [
  '온라인·방문·대리 발급 차이를 비교표 1개로 정리해주세요.',
  '온라인 발급 방법을 정확히 4단계로 설명해주세요.',
  'FAQ는 넣지 마세요.',
  '온라인 발급이 불가능한 용도도 반드시 설명해주세요.',
  '정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.',
].join('\n');
const GOOD_URL = 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000025';
const TABLE = '<table><tr><th>구분</th><th>신청 가능자</th></tr><tr><td>온라인</td><td>본인</td></tr><tr><td>방문</td><td>본인</td></tr><tr><td>대리</td><td>대리인</td></tr></table>';
const STEPS = (n: number) => `<ol>${Array.from({ length: n }, (_, i) => `<li>${i + 1}번째 절차</li>`).join('')}</ol>`;
const USES = '<h2>온라인 발급이 불가능한 용도</h2><p>온라인 발급이 불가능한 용도는 부동산 매도용입니다.</p>';
const FAQ = '<h2>자주 묻는 질문</h2><p>Q. 대리 발급? A. 방문.</p><script type="application/ld+json">{"@type":"FAQPage"}</script>';
const CTA_API = (url = GOOD_URL, text = '정부24에서 인감증명서 발급하기') => `<p><a class="cta-btn" href="${url}">${text}</a></p>`;
const CTA_AGENT = (url = GOOD_URL, text = '정부24에서 인감증명서 발급하기') => `<div><a href="${url}" style="display:inline-block;padding:13px 30px;background:#f59e0b;color:#fff">${text} →</a></div>`;
const doc = (p: { table?: boolean; steps?: number; faq?: boolean; cta?: string } = {}) => [`<h1>${KEYWORD}</h1>`, '<h2>비교</h2>', p.table === false ? '<p>표 대신 설명</p>' : TABLE, '<h2>방법</h2>', STEPS(p.steps ?? 4), USES, p.faq ? FAQ : '', p.cta ?? CTA_API()].join('\n');
const agentDoc = (p: { table?: boolean; steps?: number; faq?: boolean; cta?: string } = {}) => doc({ ...p, cta: p.cta ?? CTA_AGENT() });
const agentPayload = (extra: Record<string, unknown> = {}) => ({ topic: KEYWORD, userRequest: REQUEST, codexWorkshop: true, previewOnly: false, platform: 'test-noop-777', agentJobId: 'job-123', ...extra });

const TMP = path.join(__dirname, '..', '.tmp-tests', 'test-778');
const LEDGER = path.join(TMP, 'publish-ledger.json');
const UNLINKED = path.join(TMP, 'publish-attempts-unlinked.json');
let realFetch: typeof fetch;
beforeAll(() => { realFetch = global.fetch; global.fetch = jest.fn(async () => { throw new Error('network blocked in test'); }) as unknown as typeof fetch; });
afterAll(() => { global.fetch = realFetch; delete process.env['PUBLISH_LEDGER_PATH']; });
beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  process.env['PUBLISH_LEDGER_PATH'] = LEDGER;
  clearAgentEvidence();
  clearPublishDecisions();
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
const publish = (payload: Record<string, unknown>, html: string) => require('../src/core/index').publishGeneratedContent(payload, KEYWORD, html, '', () => undefined);

describe('A. 에이전트 강제 발행 화면 흐름 (T1~T7)', () => {
  test('T1 PUBLISH_HELD 가 아니면 버튼 없음 — 성공·네트워크 실패·일반(API) 글 보류·취소 모두 null', () => {
    const d = fakeDoc();
    for (const r of [{ ok: true, url: 'https://x' }, { ok: false, error: 'network' }, { ok: false, blockedReason: 'MANUAL_REVIEW', error: '품질 관문' }, { ok: false, canceled: true }, null]) {
      expect(fp.renderForcePublishOffer(d, r, { onApprove: jest.fn(), confirmFn: jest.fn() })).toBeNull();
    }
    expect(d.body.children).toHaveLength(0);
  });

  test('T2 보류면 버튼 표시 — 실제 publishGeneratedContent 가 돌려준 결과로 그린다', async () => {
    const held = await publish(agentPayload(), agentDoc({ faq: true }));
    expect(held).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    expect(held.hold.source).toBe('agent-requirement');
    expect(held.hold.categories).toEqual(['EXCLUDE_VIOLATED']);
    const d = fakeDoc();
    const panel = fp.renderForcePublishOffer(d, held, { onApprove: jest.fn(), confirmFn: jest.fn() }) as FakeEl;
    expect(panel.id).toBe('agentForcePublishOffer');
    expect(buttonOf(panel, '검토 후 강제 발행')).toBeTruthy();
    expect(d.body.children).toHaveLength(1);
    // 다시 그리면 하나만 남는다 · 보류가 풀린 결과면 지운다
    fp.renderForcePublishOffer(d, held, {});
    expect(d.body.children).toHaveLength(1);
    fp.renderForcePublishOffer(d, { ok: true }, {});
    expect(d.body.children).toHaveLength(0);
  });

  test('확인창 문구 — 보류 사유 · 빠진 MUST · 위반 EXCLUDE · 잘못된 CTA · 사실 충돌 여부(점수 없음, 구분만)', async () => {
    const held = await publish(agentPayload(), agentDoc({ faq: true, table: false, cta: CTA_AGENT('https://plus.gov.kr/portal/benefitV2/', '정부24에서 조회 안내 확인') }));
    expect(held.hold.categories).toEqual(['USER_REQUIREMENT_MISSING', 'EXCLUDE_VIOLATED', 'CTA_CONTRADICTED']);
    const text = fp.buildForcePublishConfirmText(held.hold);
    expect(text).toContain('보류 사유:');
    expect(text).toContain('빠진 필수(MUST) 요구:\n  · UR1');
    expect(text).toContain('위반한 제외(EXCLUDE) 요구:\n  · UR3');
    expect(text).toContain('잘못된 CTA:\n  · UR5');
    expect(text).toContain('사실 충돌: 없음');
    expect(text).toContain('보류 구분: 빠진 필수 요구 · 제외 요청 위반 · 잘못된 CTA');
    expect(fp.needsStrongConfirm(held.hold)).toBe(false);
  });

  test('T3 "true"·1·"1"·객체는 override 가 아니다 — 모두 보류', async () => {
    for (const force of ['true', 1, '1', { yes: true }, 'TRUE']) {
      const r = await publish(agentPayload({ forcePublish: force }), agentDoc({ steps: 5 }));
      expect(r).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    }
    expect(fs.existsSync(UNLINKED) ? fs.readFileSync(UNLINKED, 'utf8') : '').not.toContain('publish-override');
  });

  test('T4 불리언 true 만 창구를 지난다(없는 플랫폼에서 멈춤 — 실제 발행 0)', async () => {
    const r = await publish(agentPayload({ forcePublish: true }), agentDoc({ faq: true }));
    expect(r.blockedReason).toBeUndefined();
    expect(r.error).toBe('알 수 없는 플랫폼: test-noop-777');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('T5 강제 발행 감사 기록 — 발행 장부(미연결 파일): 글 ID · 보류 사유 · userOverride · 시각 · 요구별 판정 · 사실/CTA 차단 여부', async () => {
    rememberAgentEvidence(parseUserRequirements('지원금은 100만원이라고 써주세요.').fingerprint, KEYWORD, '공식 https://www.gov.kr/n 지원금 50만원');
    await publish(agentPayload({ forcePublish: true, userRequest: '지원금은 100만원이라고 써주세요. 정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.' }), `<p>지원금은 50만원입니다.</p>${CTA_AGENT('https://plus.gov.kr/portal/benefitV2/', '조회')}`);
    const list = JSON.parse(fs.readFileSync(UNLINKED, 'utf8'));
    const rec = list.find((x: { source?: string }) => x.source === 'publish-override');
    expect(rec.unlinkedReason).toBe('NO_RUN_ID');
    expect(rec.override).toMatchObject({ kind: 'forcePublish', userOverride: true, source: 'agent-requirement', articleId: 'agent-job:job-123', title: KEYWORD, factualBlocker: true, ctaBlocker: true, criticalStateBlocker: false });
    expect(rec.override.categories).toEqual(['CTA_CONTRADICTED', 'FACT_CONFLICT']);   // 순서 고정: 누락 · 제외 · CTA · 사실
    expect(rec.override.holdReasons).toContain('UR1');
    expect(rec.override.coverage.map((c: { id: string; status: string }) => `${c.id}=${c.status}`)).toEqual(['UR1=CONFLICTS_WITH_EVIDENCE', 'UR2=CONTRADICTED']);
    expect(new Date(rec.override.at).toString()).not.toBe('Invalid Date');
  });

  test('T5 장부 줄이 있으면(runId) 그 줄의 publishOverrides 에 붙는다', async () => {
    fs.writeFileSync(LEDGER, JSON.stringify([{ runId: 'run-1', title: KEYWORD, keyword: KEYWORD }]), 'utf8');
    await publish(agentPayload({ forcePublish: true, runId: 'run-1' }), agentDoc({ faq: true }));
    const [entry] = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    expect(entry.publishOverrides).toHaveLength(1);
    expect(entry.publishOverrides[0]).toMatchObject({ userOverride: true, articleId: 'run-1', categories: ['EXCLUDE_VIOLATED'], factualBlocker: false, ctaBlocker: false });
  });

  test('T6 에이전트가 스스로 forcePublish 를 켤 수 없다 — 화면이 저장·현재 payload 의 값을 버리고 사람 승인(인자)만 싣는다', () => {
    const fn = between(POSTING, 'export async function publishToPlatform(options) {', 'const titleToPublish');
    expect(fn).toContain('const userApprovedForce = options?.forcePublish === true;');
    expect(fn).toContain('const { forcePublish: _storedForce, ...storedPayload } = appState.generatedContent.payload || {};');
    expect(fn).toContain('const { forcePublish: _currentForce, ...freshPayload } = currentPayload || {};');
    expect(fn).toContain('...(userApprovedForce ? { forcePublish: true } : {}),');
    // 강제 발행을 부르는 곳은 확인창 승인 콜백 하나뿐(주석 제외 코드에서 셈)
    expect(code(POSTING).match(/forcePublish: true/g)!.length).toBe(2);   // 인자 전달 1 + payload 싣기 1
    expect(POSTING).toContain('onApprove: () => publishToPlatform({ forcePublish: true }),');
    // 에이전트 결과·작업 경로에는 forcePublish 가 없다(777 과 같은 조건)
    const job = between(MAIN, "ipcMain.handle('agent-mode:run-job'", "ipcMain.handle('transform-content'");
    expect(job).not.toMatch(/\bforcePublish\b/);
    expect(WORKSHOP).not.toMatch(/\bforcePublish\b/);
  });

  test('T7 사용자가 취소하면 보류 유지 — 발행 안 부름 · 안내 그대로 · 강한 확인에서 취소해도 같다', async () => {
    const held = await publish(agentPayload(), agentDoc({ faq: true }));
    const d = fakeDoc();
    const onApprove = jest.fn();
    const panel = fp.renderForcePublishOffer(d, held, { onApprove, confirmFn: () => false }) as FakeEl;
    await buttonOf(panel, '검토 후 강제 발행').handlers['click']!();
    expect(onApprove).not.toHaveBeenCalled();
    expect(d.body.children).toHaveLength(1);
    expect(panel.children.some((c) => c.textContent === '취소했습니다 — 보류가 그대로 유지됩니다.')).toBe(true);
    // 승인하면 한 번만 부르고 안내를 걷는다
    const approvedDoc = fakeDoc();
    const approve = jest.fn();
    const p2 = fp.renderForcePublishOffer(approvedDoc, held, { onApprove: approve, confirmFn: () => true }) as FakeEl;
    await buttonOf(p2, '검토 후 강제 발행').handlers['click']!();
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approvedDoc.body.children).toHaveLength(0);
    // confirm 이 true 가 아닌 값(문자열·1)을 주면 승인이 아니다
    expect(await fp.approveForcePublish(held.hold, () => 'yes')).toBe(false);
    expect(await fp.approveForcePublish(held.hold, () => 1)).toBe(false);
    expect(await fp.approveForcePublish(held.hold, undefined)).toBe(false);
  });

  test('사실 충돌·현재 상태 모순은 두 번째 확인(더 강한 문구) — 두 번 다 승인해야 한다', async () => {
    const hold = { source: 'agent-requirement', reason: 'UR1 MUST CONTENT: 요청 값 100만원 은 근거에 없음', categories: ['FACT_CONFLICT'], groups: { missingMust: [], excludeViolations: [], ctaProblems: [], factConflicts: [{ id: 'UR1', reason: '요청 값 100만원 은 근거에 없음', sourceText: '지원금은 100만원' }] } };
    expect(fp.needsStrongConfirm(hold)).toBe(true);
    expect(fp.needsStrongConfirm({ ...hold, categories: ['CRITICAL_STATE_CONTRADICTION'] })).toBe(true);
    const asked: string[] = [];
    expect(await fp.approveForcePublish(hold, (m: string) => { asked.push(m); return asked.length === 1; })).toBe(false);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain('사실 근거와 맞지 않는 내용이 있습니다');
    expect(asked[1]).toContain('독자에게 틀린 정보가 그대로 발행될 수 있습니다');
    expect(await fp.approveForcePublish(hold, () => true)).toBe(true);
    expect(fp.buildForcePublishConfirmText(hold)).toContain('사실 충돌: 있음 (UR1)');
  });

  test('자동 강제 발행 없음 — 화면 모듈은 승인 콜백 밖에서 발행을 부르지 않는다 · 작업 ID 가 감사 글 ID 로 실린다', () => {
    expect(code(FP_SRC)).not.toMatch(/publishToPlatform|invoke\(|forcePublish:\s*true/);
    expect(WORKSHOP).toContain('state.payload = { ...state.payload, agentJobId: adoptedJobId };');
    expect(WORKSHOP).toContain('adoptedJobId = retryResult.jobId || adoptedJobId;');
  });
});

describe('B. 일반 경로 발행 전 자가 수정 — 같은 압축 계약 (R1~R5)', () => {
  const contract = parseUserRequirements(REQUEST);
  const compact = compactRequirementBlock(contract);
  const 위험한글 = '<h2>사건 정리</h2><p>A씨가 7억 원을 횡령했다. 사기죄가 적용됐다.</p><h2>이후 상황</h2><p>상황이 바뀐 것으로 보인다. 최초 폭로 이후의 일이다.</p>';

  test('배선: API 경로 = callGeminiWithRetry(withRequirementContract(prompt, userCompact)) · 에이전트 = 같은 공통 함수', () => {
    const call = between(ORCH, "const { fixBeforePublish } = require('./pre-publish-fix');", '} catch (preflightError');
    expect(call).toContain('(prompt: string) => callGeminiWithRetry(withRequirementContract(prompt, userCompact), 1, { timeoutMs: 120000 })');
    expect(read('src/core/final/agent-requirement.ts')).toContain("return withRequirementContract(prompt, capture?.compact || '');");
    expect(withRequirements('P', captureAgentRequirements(REQUEST))).toBe(withRequirementContract('P', compact));
  });

  test('실제 fixBeforePublish — 재작성 모델이 받는 프롬프트 맨 앞에 압축 계약(FAQ 제외·비교표·4단계·CTA) · 원문 되풀이 없음', async () => {
    const prompts: string[] = [];
    await fixBeforePublish({ title: '성과급 파업 가능한지', html: 위험한글 }, async (p: string) => { prompts.push(withRequirementContract(p, compact)); return '짧음'; });
    expect(prompts.length).toBeGreaterThan(0);
    for (const p of prompts) {
      expect(p.startsWith('## 📌 작성자 명시 요구(계약)')).toBe(true);
      expect(p).toContain('- [EXCLUDE] FAQ 없음(본문 FAQ 절·FAQ 블록 모두)');
      expect(p).toContain('- [MUST] 비교표 1개 이상(<table>)');
      expect(p).toContain('- [MUST] 정확히 4단계');
      expect(p).toContain('- [MUST] CTA "발급" 행동');
      expect(p).not.toContain('<<작성자 요청 시작>>');
    }
  });

  test('R1 FAQ 제외 — 재작성이 FAQ 를 넣으면 이 단계에서 회귀(COVERED→CONTRADICTED) · 최종 관문 보류', () => {
    const loss = stageRegressions(contract, doc(), doc({ faq: true }), 'pre-publish-rewrite');
    expect(loss).toEqual([expect.objectContaining({ id: 'UR3', before: 'COVERED', after: 'CONTRADICTED', stage: 'pre-publish-rewrite' })]);
    expect(requirementGate(checkUserRequirements(contract, { html: doc({ faq: true }) })).pass).toBe(false);
    expect(stageRegressions(contract, doc(), doc(), 'pre-publish-rewrite')).toEqual([]);   // 안 넣었으면 FAQ 없음 유지
  });
  test('R2 비교표 MUST — 재작성이 표를 지우면 회귀 감지', () => {
    expect(stageRegressions(contract, doc(), doc({ table: false }), 'pre-publish-rewrite')).toEqual([expect.objectContaining({ id: 'UR1', before: 'COVERED', after: 'MISSING' })]);
  });
  test('R3 정확히 4단계 — 3단계로 바꾸면 MISSING', () => {
    expect(stageRegressions(contract, doc(), doc({ steps: 3 }), 'pre-publish-rewrite')).toEqual([expect.objectContaining({ id: 'UR2', after: 'MISSING' })]);
    expect(checkUserRequirements(contract, { html: doc({ steps: 3 }) }).find((r) => r.id === 'UR2')!.status).toBe('MISSING');
  });
  test('R4 CTA — 재작성 뒤에도 최종 판정 유지(COVERED · 회귀 없음 · 통과)', () => {
    const after = doc().replace('<p>표 대신 설명</p>', '').replace('1번째 절차', '첫 절차를 진행합니다');
    expect(stageRegressions(contract, doc(), after, 'pre-publish-rewrite')).toEqual([]);
    const final = checkUserRequirements(contract, { html: after });
    expect(final.find((r) => r.id === 'UR5')!.status).toBe('COVERED');
    expect(requirementGate(final).pass).toBe(true);
  });
  test('R5 요청 없는 글 — 계약 빈 문자열 · 프롬프트 그대로(바이트 동일) · 단계 검사 없음', async () => {
    const none = parseUserRequirements('');
    expect(compactRequirementBlock(none)).toBe('');
    expect(withRequirementContract('원래 프롬프트', compactRequirementBlock(none))).toBe('원래 프롬프트');
    const raw: string[] = []; const wrapped: string[] = [];
    await fixBeforePublish({ title: '성과급 파업 가능한지', html: 위험한글 }, async (p: string) => { raw.push(p); return '짧음'; });
    await fixBeforePublish({ title: '성과급 파업 가능한지', html: 위험한글 }, async (p: string) => { wrapped.push(withRequirementContract(p, compactRequirementBlock(none))); return '짧음'; });
    expect(wrapped).toEqual(raw);
    expect(stageRegressions(none, doc(), doc({ faq: true }), 'pre-publish-rewrite')).toEqual([]);
    const traceLine = between(ORCH, "const rewriteLoss = stageRegressions(userContract, html, rewriteGate.html, 'pre-publish-rewrite');", 'html = rewriteGate.html;');
    expect(traceLine).toContain("if (userContract?.requirements.length) trace.event('user-requirement.rewrite'");
  });
  test('되돌리지 않는다 — 자가 수정은 사실·안전 수정일 수 있다(사실 > 요구). 기록하고 최종 관문이 보류', () => {
    const block = between(ORCH, "const rewriteLoss = stageRegressions(", 'trace.change(\'pre-publish-fix\'');
    expect(block).toContain('html = rewriteGate.html;');
    expect(block).not.toMatch(/html\s*=\s*htmlBeforePreflight/);
  });
});

describe('C. 반자동 · 풀오토 · 에이전트 — 같은 계약 · 같은 자가 수정 계약 · 같은 관문 · 같은 forcePublish 규칙', () => {
  test('자가 수정 프롬프트: 두 경로가 같은 계약에서 같은 문자열을 만든다', () => {
    const api = withRequirementContract('# 구간', compactRequirementBlock(parseUserRequirements(REQUEST)));
    const agent = withRequirements('# 구간', captureAgentRequirements(REQUEST));
    expect(agent).toBe(api);
  });
  test('단계 유지 검사: 같은 공통 함수 · 에이전트는 판정용 보기만 다르다(인라인 CTA)', () => {
    const cap = captureAgentRequirements(REQUEST)!;
    expect(agentStageRegressions(cap, agentDoc(), agentDoc({ table: false }), 'pre-publish-rewrite')).toEqual(stageRegressions(cap.contract, doc(), doc({ table: false }), 'pre-publish-rewrite'));
    const loss = stageRegressions(cap.contract, doc(), doc({ table: false }), 'pre-publish-rewrite');
    expect(loss.map((g) => g.id)).toEqual(['UR1']);
    expect(MAIN).toContain("agentReqMod.agentStageRegressions(agentReq, String(result.content || ''), outcome.html, 'pre-publish-rewrite')");
  });
  test('보류 사유 구분도 같은 함수(holdSummary) — 에이전트 창구와 일반 관문 blockers 에 똑같이', () => {
    const results = checkUserRequirements(parseUserRequirements(REQUEST), { html: doc({ faq: true, table: false }) });
    const api = holdSummary(requirementGate(results).blockers);
    const agent = agentPublishCheck(agentPayload(), agentDoc({ faq: true, table: false })).summary;
    expect(agent.categories).toEqual(api.categories);
    expect(agent.categories).toEqual(['USER_REQUIREMENT_MISSING', 'EXCLUDE_VIOLATED']);
  });
  test('forcePublish 규칙: 일반 글 보류(지문 장부)와 에이전트 보류 모두 === true 만 통과 · "true" 는 둘 다 보류', async () => {
    const apiHtml = doc({ faq: true });
    recordPublishDecision(apiHtml, 'MANUAL_REVIEW', 'USER_REQUIREMENT_PASS(UR3 EXCLUDE)', KEYWORD, true);
    const apiPayload = { topic: KEYWORD, userRequest: REQUEST, platform: 'test-noop-777' };
    expect(await publish({ ...apiPayload, forcePublish: 'true' }, apiHtml)).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    expect(await publish({ ...agentPayload(), forcePublish: 'true' }, agentDoc({ faq: true }))).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    expect((await publish({ ...apiPayload, forcePublish: true }, apiHtml)).error).toBe('알 수 없는 플랫폼: test-noop-777');
    expect((await publish({ ...agentPayload(), forcePublish: true }, agentDoc({ faq: true }))).error).toBe('알 수 없는 플랫폼: test-noop-777');
  });
});

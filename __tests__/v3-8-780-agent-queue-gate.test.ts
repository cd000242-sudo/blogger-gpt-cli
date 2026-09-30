/**
 * v3.8.780 — AGENT QUEUE PUBLISH-GATE PARITY
 *
 * BEFORE: 에이전트 보류 → 재발행 대기열(payload 에 codexWorkshop 없음) → [🚀 재발행] 이 일반 글처럼 나감 → 777 요구 관문 우회
 * AFTER : 대기열 저장이 에이전트 표시·작업 ID 를 보존 → 재발행 요청도 같은 발행 창구 → 요구 재검사 → 통과면 발행 / 아니면 보류
 * 대기열 재발행은 강제 발행이 아니다(forcePublish 는 버린다). 실제 발행 0(없는 플랫폼 + fetch·axios 차단).
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-780'), isPackaged: false } }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';
import { clearAgentEvidence } from '../src/core/final/agent-requirement';
import { clearPublishDecisions } from '../src/core/final/publish-gate';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const between = (src: string, start: string, end: string) => { const a = src.indexOf(start); expect(a).toBeGreaterThan(-1); const b = src.indexOf(end, a + start.length); expect(b).toBeGreaterThan(a); return src.slice(a, b); };
const POSTING = read('electron/ui/modules/posting.js');
const PREVIEW = read('electron/ui/modules/preview.js');
const EDITOR = read('electron/ui/modules/editor.js');
const STORE_SRC = read('electron/ui/modules/republish-queue-store.js');

// ── 실제 모듈 코드를 그대로 실행한다 ──
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}
function loadStore(storage: ReturnType<typeof fakeStorage>) {
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', `${STORE_SRC.replace(/^export /gm, '')}; return { agentQueuePayload, republishPayloadOf, readRepublishQueue, settleRepublishAfterPublish, resolveRepublishItems, byRepublishItemId };`)(storage);
}
// preview.js 의 buildRepublishData·normalizeRepublishPlatform 원문 그대로 + 같은 공용 함수 주입
function loadBuildRepublishData(republishPayloadOf: (item: unknown) => Record<string, unknown>) {
  const src = [braceBlock(PREVIEW, 'export function normalizeRepublishPlatform'), braceBlock(PREVIEW, 'export function buildRepublishData')].join('\n').replace(/^export /gm, '');
  // eslint-disable-next-line no-new-func
  return new Function('republishPayloadOf', `${src}; return buildRepublishData;`)(republishPayloadOf) as (item: unknown, platform?: string) => { platform: string; content: string; title: string; runId: string; payload: Record<string, unknown> };
}

const KEYWORD = '인감증명서 온라인 발급 가능한 용도 대리인 발급 여부';
const REQUEST = 'FAQ는 넣지 마세요.\n비교표를 반드시 넣어주세요.';
const TABLE = '<table><tr><th>구분</th><th>신청</th></tr><tr><td>온라인</td><td>본인</td></tr><tr><td>방문</td><td>대리</td></tr></table>';
const FAQ = '<h2>자주 묻는 질문</h2><p>Q. 대리 발급? A. 방문.</p>';
const VIOLATING = `<h1>${KEYWORD}</h1><h2>비교</h2>${TABLE}${FAQ}`;
const COMPLIANT = `<h1>${KEYWORD}</h1><h2>비교</h2>${TABLE}<p>방문 발급은 위임장이 필요합니다.</p>`;
// posting.js 에이전트 분기가 대기열에 담는 payload 의 바탕(createPayload 결과 모양)
const POSTING_PAYLOAD = { topic: KEYWORD, keyword: KEYWORD, userRequest: REQUEST, platform: 'test-noop-780', contentMode: 'discover' };

const TMP = path.join(__dirname, '..', '.tmp-tests', 'test-780');
let realFetch: typeof fetch;
beforeAll(() => { realFetch = global.fetch; global.fetch = jest.fn(async () => { throw new Error('network blocked in test'); }) as unknown as typeof fetch; });
afterAll(() => { global.fetch = realFetch; delete process.env['PUBLISH_LEDGER_PATH']; });
beforeEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true }); process.env['PUBLISH_LEDGER_PATH'] = path.join(TMP, 'publish-ledger.json'); clearAgentEvidence(); clearPublishDecisions(); (global.fetch as jest.Mock).mockClear(); });
/**
 * 실제 공용 발행 창구(publishGeneratedContent). buildRepublishData 는 모르는 플랫폼을 blogspot 으로 바꾸므로(원래 동작),
 * 부르기 직전에 세 플랫폼 키를 없는 값으로 덮는다 — 창구를 지나도 "알 수 없는 플랫폼" 에서 멈춰 실제 발행기에 닿지 않는다.
 */
const noopPlatform = (p: Record<string, unknown>) => ({ ...p, platform: 'test-noop-780', targetPlatform: 'test-noop-780', blogPlatform: 'test-noop-780' });
const shared = () => (p: Record<string, unknown>, t: string, h: string, th = '', log?: (m: string) => void): Promise<{ ok: boolean; error?: string; blockedReason?: string; hold?: unknown }> =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../src/core/index').publishGeneratedContent(noopPlatform(p), t, h, th, log);

/** 저장(posting.js 가 쓰는 공용 함수) → JSON 저장·불러오기 → 재발행 요청(preview.js buildRepublishData 원문) */
function roundTrip(html: string, basePayload: Record<string, unknown>, opts: { agent: boolean; jobId?: string; itemId?: string; extraPayload?: Record<string, unknown> }) {
  const storage = fakeStorage();
  const store = loadStore(storage);
  const payload = opts.agent ? store.agentQueuePayload({ ...basePayload, ...(opts.extraPayload || {}) }, { agentJobId: opts.jobId || 'job-A' }) : { ...basePayload, ...(opts.extraPayload || {}) };
  const item = { id: opts.itemId || 'rp_1', savedAt: '2026-09-30T00:00:00.000Z', platform: 'test-noop-780', title: KEYWORD, html, payload, lastError: 'MANUAL_REVIEW', keyword: KEYWORD, runId: '', agentJobId: opts.agent ? (opts.jobId || 'job-A') : '' };
  storage.setItem('pendingRepublishQueue', JSON.stringify([item]));                   // 직렬화
  const loaded = store.readRepublishQueue(storage)[0];                                // 불러오기
  const request = loadBuildRepublishData(store.republishPayloadOf)(loaded, 'test-noop-780');   // 재발행 요청
  return { storage, store, saved: payload, loaded, request };
}

describe('대기열에서 에이전트 표시 보존 (T1·T2)', () => {
  test('T1 에이전트 보류 글 저장 → 대기열 payload 에 codexWorkshop=true · 작업 ID · 원래 요청(userRequest) 그대로', () => {
    const { saved } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    expect(saved).toMatchObject({ codexWorkshop: true, agentJobId: 'job-A', userRequest: REQUEST, topic: KEYWORD, contentMode: 'discover' });
    // posting.js 에이전트 분기가 실제로 이 함수로 담는다
    const agentSave = between(POSTING, 'v3.8.550 — Agent 모드 발행 실패도 글을 보관한다.', 'setFinalResult({');
    expect(agentSave).toContain("payload: agentQueuePayload(payload, { agentJobId: generated.payload?.agentJobId || agentResult?.jobId || '' }),");
    expect(POSTING).toContain("import { settleRepublishAfterPublish, agentQueuePayload } from './republish-queue-store.js';");
  });
  test('T2 직렬화 → 불러오기 → 재발행 요청까지 codexWorkshop=true 유지(undefined·false·삭제 없음) · 요청 원문 유지', () => {
    const { saved, loaded, request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    for (const stage of [saved, loaded.payload, request.payload]) {
      expect(stage.codexWorkshop).toBe(true);
      expect(stage.userRequest).toBe(REQUEST);
      expect(stage.agentJobId).toBe('job-A');
    }
    expect(request).toMatchObject({ content: VIOLATING, title: KEYWORD });
    // 플랫폼 세 키는 예전처럼 buildRepublishData 가 맞춘다(모르는 값은 blogspot — 원래 동작)
    expect(request.payload).toMatchObject({ platform: request.platform, targetPlatform: request.platform, blogPlatform: request.platform });
    // 편집기로 대기열 항목을 고쳐도 payload 를 펼쳐 저장하므로 표시가 남는다(편집기 코드 그대로)
    const editorSave = between(EDITOR, "} else if (session.kind === 'republish') {", "localStorage.setItem('pendingRepublishQueue'");
    expect(editorSave).toContain('...(item.payload || {}),');
  });
});

describe('같은 발행 창구에서 요구 재검사 (T3·T4·T5·T10)', () => {
  test('T3 요구 위반 그대로인 에이전트 항목 재발행 → 요구 재검사 → MANUAL_REVIEW(보류) · 플랫폼 단계 도달 0 · 네트워크 0', async () => {
    const { request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    const logs: string[] = [];
    const r = await shared()(request.payload, request.title, request.content, '', (m) => logs.push(m));
    expect(r).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    expect(r.error).toContain('에이전트 글이 작성자 요구를 지키지 않아');
    expect(r.error).not.toContain('알 수 없는 플랫폼');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('T4 요구를 고친 에이전트 항목 → 재검사 통과 → 플랫폼 단계까지 감(없는 플랫폼에서 멈춤 · 실제 발행 0) → 성공이면 대기열에서 빠진다', async () => {
    const { request, storage, store } = roundTrip(COMPLIANT, POSTING_PAYLOAD, { agent: true });
    const r = await shared()(request.payload, request.title, request.content);
    expect(r.blockedReason).toBeUndefined();
    expect(r.error).toBe('알 수 없는 플랫폼: test-noop-780');
    expect(global.fetch).not.toHaveBeenCalled();
    // 실제 플랫폼 성공이었다면: 재발행 버튼 성공 분기가 같은 공용 함수로 그 항목만 뺀다(779)
    store.resolveRepublishItems(store.byRepublishItemId('rp_1'), { resolution: 'REPUBLISHED' });
    expect(store.readRepublishQueue(storage)).toEqual([]);
  });
  test('T5 일반(API) 대기열 항목은 에이전트 요구 검사를 받지 않는다(표시 없음 = 예전 그대로)', async () => {
    const { saved, request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: false });
    expect(saved.codexWorkshop).toBeUndefined();
    expect(request.payload.codexWorkshop).toBeUndefined();
    const r = await shared()(request.payload, request.title, request.content);
    expect(r.blockedReason).toBeUndefined();
    expect(r.error).toBe('알 수 없는 플랫폼: test-noop-780');
    // API 경로 저장 호출은 손대지 않았다
    const apiSave = between(POSTING, '// v3.8.326: 생성된 콘텐츠 자동 저장 → 재발행 큐', '});');
    expect(apiSave).toContain('payload: payload || {},');
    expect(apiSave).not.toContain('agentQueuePayload');
  });
  test('T10 재발행 실패(보류 포함) → 대기열 유지 — 재발행 버튼 실패 분기는 빼지 않는다', async () => {
    const { request, storage, store } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    const r = await shared()(request.payload, request.title, request.content);
    expect(store.settleRepublishAfterPublish({ result: r, agentJobId: 'job-A', forced: false })).toEqual([]);
    expect(store.readRepublishQueue(storage).map((x: { id: string }) => x.id)).toEqual(['rp_1']);
    const handler = between(PREVIEW, "banner.querySelectorAll('.republishBtn').forEach(btn => {", '// 개별 삭제 버튼');
    expect(between(handler, '} else {', '} catch (err) {')).not.toContain('resolveRepublishItems');
  });
});

describe('대기열 재발행은 강제 발행이 아니다 (T6·T7·T8·T9)', () => {
  test('T6 대기열 항목에 예전 forcePublish 가 남아 있어도 재발행 요청에서 버린다 → 요구 위반이면 보류', async () => {
    for (const stale of [true, 'true', 1]) {
      const { saved, request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true, extraPayload: { forcePublish: stale } });
      expect('forcePublish' in saved).toBe(false);                      // 저장할 때도 안 싣는다
      const legacyItem = { id: 'rp_old', payload: { ...saved, forcePublish: stale } };   // 누가 넣어 둔 옛 값
      const legacyRequest = loadBuildRepublishData(loadStore(fakeStorage()).republishPayloadOf)(legacyItem, 'test-noop-780');
      expect('forcePublish' in legacyRequest.payload).toBe(false);
      expect('forcePublish' in request.payload).toBe(false);
      const r = await shared()(legacyRequest.payload, KEYWORD, VIOLATING);
      expect(r).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    }
    // 재발행 버튼 코드에는 forcePublish 가 없다(주석 제외)
    const handler = between(PREVIEW, "banner.querySelectorAll('.republishBtn').forEach(btn => {", '// 개별 삭제 버튼');
    expect(handler).not.toMatch(/\bforcePublish\b/);
  });
  test('T7 forcePublish: "true" 는 override 아님(발행 창구)', async () => {
    const { request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    const r = await shared()({ ...request.payload, forcePublish: 'true' }, request.title, request.content);
    expect(r).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
  });
  test('T8 에이전트 화면의 명시적 불리언 true(확인창 승인 경로)는 기존 강제 발행 계약 그대로 — 창구 통과 · 감사 기록', async () => {
    const { request } = roundTrip(VIOLATING, POSTING_PAYLOAD, { agent: true });
    const r = await shared()({ ...request.payload, forcePublish: true }, request.title, request.content);
    expect(r.blockedReason).toBeUndefined();
    expect(r.error).toBe('알 수 없는 플랫폼: test-noop-780');
    const unlinked = JSON.parse(fs.readFileSync(path.join(TMP, 'publish-attempts-unlinked.json'), 'utf8'));
    expect(unlinked.find((x: { source?: string }) => x.source === 'publish-override').override).toMatchObject({ userOverride: true, articleId: 'agent-job:job-A' });
    // 강제 발행을 거는 곳은 여전히 확인창 승인 콜백 하나
    expect(POSTING).toContain('onApprove: () => publishToPlatform({ forcePublish: true }),');
  });
  test('T9 강제 발행 성공 → 같은 작업의 그 대기열 항목만 제거(779 계약 유지) · T11 비슷한 제목의 다른 항목 무영향', () => {
    const storage = fakeStorage();
    const store = loadStore(storage);
    const held = { id: 'rp_held', title: KEYWORD, agentJobId: 'job-A', payload: store.agentQueuePayload(POSTING_PAYLOAD, { agentJobId: 'job-A' }) };
    const similar = { id: 'rp_similar', title: `${KEYWORD} 2`, agentJobId: 'job-B', payload: store.agentQueuePayload(POSTING_PAYLOAD, { agentJobId: 'job-B' }) };
    const sameTitleApi = { id: 'rp_api', title: KEYWORD, agentJobId: '', payload: POSTING_PAYLOAD };
    storage.setItem('pendingRepublishQueue', JSON.stringify([held, similar, sameTitleApi]));
    store.settleRepublishAfterPublish({ result: { ok: true, url: 'https://leadernam.com/p/1' }, agentJobId: 'job-A', forced: true });
    expect(store.readRepublishQueue(storage).map((x: { id: string }) => x.id)).toEqual(['rp_similar', 'rp_api']);
  });
});

describe('옛(표시 없는) 대기열 항목 · 호출 변화', () => {
  test('LEGACY: 표시 없는 옛 에이전트 항목을 제목·본문으로 추측해 에이전트로 바꾸지 않는다(자동 복구 대상 아님)', () => {
    const legacy = { id: 'rp_legacy', title: KEYWORD, html: VIOLATING, payload: POSTING_PAYLOAD, agentJobId: '' };
    const request = loadBuildRepublishData(loadStore(fakeStorage()).republishPayloadOf)(legacy, 'test-noop-780');
    expect(request.payload.codexWorkshop).toBeUndefined();
    expect(code(STORE_SRC)).not.toMatch(/codexWorkshop\s*=|\.title|\.html|\.keyword/);
  });
  test('새 발행 경로 없음 — 재발행 버튼은 같은 publish-content 호출 하나(공용 발행 창구)', () => {
    const handler = between(PREVIEW, "banner.querySelectorAll('.republishBtn').forEach(btn => {", '// 개별 삭제 버튼');
    expect(handler).toContain("const result = await window.electronAPI.invoke('publish-content', publishData);");
    expect((handler.match(/invoke\(/g) || []).length).toBe(1);
    expect(braceBlock(PREVIEW, 'export function buildRepublishData')).toContain('...republishPayloadOf(item),');
    expect(PREVIEW).toContain("import { resolveRepublishItems, byRepublishItemId, republishPayloadOf } from './republish-queue-store.js';");
  });
});

/** 주석을 뺀 코드만 */
function code(src: string) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

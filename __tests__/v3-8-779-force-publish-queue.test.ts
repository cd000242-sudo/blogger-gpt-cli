/**
 * v3.8.779 — FORCE PUBLISH QUEUE FINALIZATION
 *
 * 에이전트 글이 보류 → 재발행 대기열에 담긴 뒤 "검토 후 강제 발행"으로 성공하면, 대기열의 그 항목(같은 작업 ID)을
 * 재발행 버튼과 **같은 공용 함수**로 뺀다. 성공이 확인된 뒤에만. 같은 작업을 두 번 발행하지 않는다.
 * 실제 발행 0(없는 플랫폼 이름 + fetch·axios 차단) · 새 AI 호출 0.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-779'), isPackaged: false } }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

import * as fs from 'fs';
import * as path from 'path';
import { clearAgentEvidence } from '../src/core/final/agent-requirement';
import { clearPublishDecisions } from '../src/core/final/publish-gate';
import { recordPublishAttempt } from '../src/core/final/publish-ledger';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const between = (src: string, start: string, end: string) => { const a = src.indexOf(start); expect(a).toBeGreaterThan(-1); const b = src.indexOf(end, a + start.length); expect(b).toBeGreaterThan(a); return src.slice(a, b); };
const POSTING = read('electron/ui/modules/posting.js');
const PREVIEW = read('electron/ui/modules/preview.js');
const STORE_SRC = read('electron/ui/modules/republish-queue-store.js');
const FP_SRC = read('electron/ui/modules/agent-force-publish.js');

// ── 화면 모듈을 그대로 실행한다(import 없음). localStorage 는 가짜 ──
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); }, dump: () => Object.fromEntries(m) };
}
function loadStore(storage: ReturnType<typeof fakeStorage>) {
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', `${STORE_SRC.replace(/^export /gm, '')}; return { readRepublishQueue, byRepublishItemId, byAgentJobId, resolveRepublishItems, settleRepublishAfterPublish, REPUBLISH_QUEUE_KEY, REPUBLISH_RESOLUTIONS_KEY };`)(storage);
}
function loadForce() {
  // eslint-disable-next-line no-new-func
  return new Function(`${FP_SRC.replace(/^export /gm, '')}; return { beginAgentJobPublish, endAgentJobPublish, agentJobPublishPhase, renderForcePublishOffer, approveForcePublish };`)();
}
type FakeEl = { id: string; tag: string; textContent: string; disabled?: boolean; style: { cssText: string }; children: FakeEl[]; handlers: Record<string, () => Promise<void> | void>; parent?: { children: FakeEl[] }; setAttribute(): void; appendChild(c: FakeEl): FakeEl; addEventListener(t: string, fn: () => Promise<void> | void): void; remove(): void };
function fakeDoc() {
  const body = { children: [] as FakeEl[], appendChild(el: FakeEl) { el.parent = body; body.children.push(el); return el; } };
  const createElement = (tag: string): FakeEl => {
    const el: FakeEl = { id: '', tag, textContent: '', style: { cssText: '' }, children: [], handlers: {}, setAttribute() { /* noop */ },
      appendChild(c) { c.parent = el; el.children.push(c); return c; }, addEventListener(t, fn) { el.handlers[t] = fn; },
      remove() { const p = el.parent; if (p) p.children = p.children.filter((x) => x !== el); } };
    return el;
  };
  return { body, createElement, getElementById: (id: string) => body.children.find((c) => c.id === id) || null };
}
const forceButton = (panel: FakeEl) => panel.children.find((c) => c.tag === 'button' && c.textContent === '검토 후 강제 발행')!;

// ── 공용 입력 ──
const KEYWORD = '인감증명서 온라인 발급 가능한 용도 대리인 발급 여부';
const REQUEST = 'FAQ는 넣지 마세요.';
const HELD_ITEM = { id: 'rp_held', savedAt: '2026-09-30T00:00:00.000Z', platform: 'wordpress', title: KEYWORD, html: '<p>보류된 에이전트 글</p>', payload: { topic: KEYWORD }, lastError: 'MANUAL_REVIEW', keyword: KEYWORD, runId: '', agentJobId: 'job-A' };
const SIMILAR_TITLE = { ...HELD_ITEM, id: 'rp_similar', title: `${KEYWORD} (2)`, html: '<p>다른 글</p>', agentJobId: 'job-B' };
const SAME_TITLE_NO_JOB = { ...HELD_ITEM, id: 'rp_api', html: '<p>API 경로에서 실패한 같은 제목 글</p>', agentJobId: '' };
const queueWith = (...items: object[]) => fakeStorage({ pendingRepublishQueue: JSON.stringify(items) });
const ids = (s: ReturnType<typeof fakeStorage>) => JSON.parse(s.getItem('pendingRepublishQueue') || '[]').map((x: { id: string }) => x.id);
const HELD_RESULT = { ok: false, blockedReason: 'MANUAL_REVIEW', error: 'MANUAL_REVIEW', hold: { source: 'agent-requirement', reason: 'UR1 EXCLUDE STRUCTURE: FAQ', categories: ['EXCLUDE_VIOLATED'], groups: { missingMust: [], excludeViolations: [{ id: 'UR1', reason: 'FAQ', sourceText: REQUEST }], ctaProblems: [], factConflicts: [] } } };

const TMP = path.join(__dirname, '..', '.tmp-tests', 'test-779');
const LEDGER = path.join(TMP, 'publish-ledger.json');
const UNLINKED = path.join(TMP, 'publish-attempts-unlinked.json');
let realFetch: typeof fetch;
beforeAll(() => { realFetch = global.fetch; global.fetch = jest.fn(async () => { throw new Error('network blocked in test'); }) as unknown as typeof fetch; });
afterAll(() => { global.fetch = realFetch; delete process.env['PUBLISH_LEDGER_PATH']; });
beforeEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true }); process.env['PUBLISH_LEDGER_PATH'] = LEDGER; clearAgentEvidence(); clearPublishDecisions(); });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const publish = (payload: Record<string, unknown>) => require('../src/core/index').publishGeneratedContent(payload, KEYWORD, '<h2>자주 묻는 질문</h2><p>Q. A.</p>', '', () => undefined);
const agentPayload = (extra: Record<string, unknown> = {}) => ({ topic: KEYWORD, userRequest: REQUEST, codexWorkshop: true, platform: 'test-noop-779', agentJobId: 'job-A', ...extra });

describe('대기열 정리 — 성공이 확인된 뒤에만 · 작업 ID 로만', () => {
  test('T1 보류된 에이전트 글이 대기열에 있음 → 강제 발행 성공 → 재발행 대상에서 사라짐(PUBLISHED_BY_FORCE_OVERRIDE 기록)', () => {
    const storage = queueWith(HELD_ITEM);
    const store = loadStore(storage);
    const removed = store.settleRepublishAfterPublish({ result: { ok: true, url: 'https://leadernam.com/p/1' }, agentJobId: 'job-A', forced: true });
    expect(removed.map((x: { id: string }) => x.id)).toEqual(['rp_held']);
    expect(ids(storage)).toEqual([]);
    expect(JSON.parse(storage.getItem('republishQueueResolutions')!)).toEqual([expect.objectContaining({ itemId: 'rp_held', agentJobId: 'job-A', resolution: 'PUBLISHED_BY_FORCE_OVERRIDE', url: 'https://leadernam.com/p/1' })]);
  });

  test('T2 강제 발행 실패(네트워크·인증·플랫폼 오류·결과 불확실) → 대기열 유지', () => {
    for (const result of [{ ok: false, error: 'network' }, { ok: false, needsAuth: true, error: 'invalid_grant' }, { ok: false, error: '알 수 없는 플랫폼: x' }, undefined, null, {}, { url: 'https://x' }, { ok: 'true' }]) {
      const storage = queueWith(HELD_ITEM);
      expect(loadStore(storage).settleRepublishAfterPublish({ result, agentJobId: 'job-A', forced: true })).toEqual([]);
      expect(ids(storage)).toEqual(['rp_held']);
      expect(storage.getItem('republishQueueResolutions')).toBeNull();
    }
  });

  test('T3 사용자가 확인창을 취소 → 발행 요청 없음 → 대기열 유지', async () => {
    const storage = queueWith(HELD_ITEM);
    const store = loadStore(storage);
    const fp = loadForce();
    const onApprove = jest.fn(async () => { const r = { ok: true }; store.settleRepublishAfterPublish({ result: r, agentJobId: 'job-A', forced: true }); return r; });
    const panel = fp.renderForcePublishOffer(fakeDoc(), HELD_RESULT, { onApprove, confirmFn: () => false, jobId: 'job-A' }) as FakeEl;
    await forceButton(panel).handlers['click']!();
    expect(onApprove).not.toHaveBeenCalled();
    expect(ids(storage)).toEqual(['rp_held']);
  });

  test('T4 forcePublish: "true" → 실제 발행 창구가 보류 → 성공 아님 → 대기열 유지', async () => {
    const r = await publish(agentPayload({ forcePublish: 'true' }));
    expect(r).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
    const storage = queueWith(HELD_ITEM);
    expect(loadStore(storage).settleRepublishAfterPublish({ result: r, agentJobId: 'job-A', forced: false })).toEqual([]);
    expect(ids(storage)).toEqual(['rp_held']);
  });

  test('T5 forcePublish === true + 성공 → 감사 기록(승인·보류 사유·요구 판정) 남음 + 발행 시도에 같은 글 ID·결말 + 대기열 해제', async () => {
    // 승인 감사: 실제 발행 창구가 남긴다(플랫폼 전 단계)
    await publish(agentPayload({ forcePublish: true }));
    // 발행 성공 시도: publish-content 핸들러가 남기는 것과 같은 함수·같은 필드
    recordPublishAttempt(LEDGER, { runId: '', platform: 'wordpress', ok: true, url: 'https://leadernam.com/p/1', source: 'publish-content', articleId: 'agent-job:job-A', resolution: 'PUBLISHED_BY_FORCE_OVERRIDE' });
    const storage = queueWith(HELD_ITEM);
    loadStore(storage).settleRepublishAfterPublish({ result: { ok: true, url: 'https://leadernam.com/p/1' }, agentJobId: 'job-A', forced: true });
    expect(ids(storage)).toEqual([]);
    const unlinked = JSON.parse(fs.readFileSync(UNLINKED, 'utf8'));
    const audit = unlinked.find((x: { source?: string }) => x.source === 'publish-override');
    const attempt = unlinked.find((x: { source?: string }) => x.source === 'publish-content');
    expect(audit.override).toMatchObject({ userOverride: true, articleId: 'agent-job:job-A', categories: ['EXCLUDE_VIOLATED'], holdReasons: expect.stringContaining('UR1') });
    expect(audit.override.coverage).toEqual([expect.objectContaining({ id: 'UR1', status: 'CONTRADICTED' })]);
    expect(attempt).toMatchObject({ ok: true, url: 'https://leadernam.com/p/1', articleId: 'agent-job:job-A', resolution: 'PUBLISHED_BY_FORCE_OVERRIDE' });
    expect(new Date(attempt.at).toString()).not.toBe('Invalid Date');
    // 대기열에서 빠져도 감사 기록은 장부(별도 파일)에 그대로 — 대기열 정리는 localStorage 만 만진다
    expect(STORE_SRC).not.toMatch(/publish-ledger|invoke\(/);
  });

  test('T6 비슷한·같은 제목의 다른 대기열 항목은 영향 없음(제목·본문으로 찾지 않는다) · 빈 작업 ID 는 아무것도 안 잡는다', () => {
    const storage = queueWith(HELD_ITEM, SIMILAR_TITLE, SAME_TITLE_NO_JOB);
    const store = loadStore(storage);
    store.settleRepublishAfterPublish({ result: { ok: true }, agentJobId: 'job-A', forced: true });
    expect(ids(storage)).toEqual(['rp_similar', 'rp_api']);
    expect(store.settleRepublishAfterPublish({ result: { ok: true }, agentJobId: '', forced: true })).toEqual([]);
    expect(store.resolveRepublishItems(store.byAgentJobId(''), { resolution: 'X' })).toEqual([]);
    expect(ids(storage)).toEqual(['rp_similar', 'rp_api']);
    expect(STORE_SRC).not.toMatch(/\.title\s*===|\.html\s*===|\.keyword\s*===/);
  });
});

describe('T7 중복 클릭 보호 — 같은 에이전트 작업의 두 번째 발행 요청 차단', () => {
  test('강제 발행 성공 뒤 같은 안내를 다시 눌러도 두 번째 발행 호출 없음 · 같은 작업은 새 안내도 안 뜸 · 발행 자리도 못 잡음', async () => {
    const fp = loadForce();
    const publishCalls: string[] = [];
    // publishToPlatform 과 같은 순서: 자리 잡기 → 발행 → 결과로 닫기
    const fakePublish = async () => {
      if (!fp.beginAgentJobPublish('job-A')) return { ok: false, duplicateBlocked: true };
      publishCalls.push('job-A');
      const r = { ok: true, url: 'https://leadernam.com/p/1' };
      fp.endAgentJobPublish('job-A', true);
      return r;
    };
    const panel = fp.renderForcePublishOffer(fakeDoc(), HELD_RESULT, { onApprove: fakePublish, confirmFn: () => true, jobId: 'job-A' }) as FakeEl;
    const btn = forceButton(panel);
    await btn.handlers['click']!();
    await btn.handlers['click']!();
    expect(publishCalls).toEqual(['job-A']);
    expect(btn.disabled).toBe(true);
    expect(fp.agentJobPublishPhase('job-A')).toBe('PUBLISHED');
    expect(fp.beginAgentJobPublish('job-A')).toBe(false);
    expect(fp.renderForcePublishOffer(fakeDoc(), HELD_RESULT, { onApprove: fakePublish, confirmFn: () => true, jobId: 'job-A' })).toBeNull();
  });
  test('확인창이 떠 있는 동안 연달아 눌러도 한 번만 · 실패하면 자리를 풀어 다시 시도할 수 있다', async () => {
    const fp = loadForce();
    let release: (v: boolean) => void = () => undefined;
    const slowConfirm = () => new Promise<boolean>((resolve) => { release = resolve; });
    const onApprove = jest.fn(async () => ({ ok: true }));
    const panel = fp.renderForcePublishOffer(fakeDoc(), HELD_RESULT, { onApprove, confirmFn: slowConfirm, jobId: 'job-C' }) as FakeEl;
    const first = forceButton(panel).handlers['click']!();
    await forceButton(panel).handlers['click']!();   // 확인 중 두 번째 클릭 — 무시
    release(true);
    await first;
    expect(onApprove).toHaveBeenCalledTimes(1);
    // 실패는 PUBLISHED 가 아니다 — 자리를 풀어 재시도 허용
    expect(fp.beginAgentJobPublish('job-D')).toBe(true);
    expect(fp.beginAgentJobPublish('job-D')).toBe(false);          // 발행 중 두 번째 요청 차단
    fp.endAgentJobPublish('job-D', false);
    expect(fp.agentJobPublishPhase('job-D')).toBe('NONE');
    expect(fp.beginAgentJobPublish('job-D')).toBe(true);
  });
  test('발행 창구(publishToPlatform) 배선: 에이전트 작업 자리를 발행 요청 전에 잡고 · 잡은 호출만 finally 에서 성공/실패로 닫는다 · 안내에 작업 ID', () => {
    const fn = between(POSTING, 'export async function publishToPlatform(options) {', "// 🔥 큐 연동");
    const begin = fn.indexOf('if (!beginAgentJobPublish(agentJobForPublish)) {');
    const invoke = fn.indexOf("window.electronAPI.invoke('publish-content'");
    expect(begin).toBeGreaterThan(-1);
    expect(begin).toBeLessThan(invoke);
    expect(fn).toContain("return { ok: false, duplicateBlocked: true, error: '이미 발행 중이거나 발행한 에이전트 글입니다' };");
    expect(fn).toContain('if (agentJobClaimed) endAgentJobPublish(agentJobForPublish, publishSucceeded);');
    expect(fn).toContain('jobId: agentJobForPublish,');
    // 성공 분기 안에서만 대기열 정리
    const success = between(fn, 'if (result?.ok || result?.success) {', '} else if (result?.canceled) {');
    expect(success).toContain('settleRepublishAfterPublish({ result, agentJobId: agentJobForPublish, forced: userApprovedForce })');
    expect(fn.split('settleRepublishAfterPublish(').length - 1).toBe(1);
  });
});

describe('T8 일반 재발행 성공 계약 회귀 없음 — 같은 공용 함수', () => {
  test('재발행 버튼 성공 = 그 항목 id 만 뺀다(예전 filter 와 같은 결과) · 실패 분기는 빼지 않는다', () => {
    const storage = queueWith(HELD_ITEM, SIMILAR_TITLE, SAME_TITLE_NO_JOB);
    const store = loadStore(storage);
    const removed = store.resolveRepublishItems(store.byRepublishItemId('rp_similar'), { resolution: 'REPUBLISHED', url: 'https://x' });
    expect(removed.map((x: { id: string }) => x.id)).toEqual(['rp_similar']);
    expect(ids(storage)).toEqual(['rp_held', 'rp_api']);
    expect(JSON.parse(storage.getItem('republishQueueResolutions')!)[0]).toMatchObject({ itemId: 'rp_similar', resolution: 'REPUBLISHED' });
    const handler = between(PREVIEW, "banner.querySelectorAll('.republishBtn').forEach(btn => {", '// 개별 삭제 버튼');
    const ok = between(handler, 'if (result?.ok || result?.success || result?.url) {', '} else {');
    expect(ok).toContain("resolveRepublishItems(byRepublishItemId(id), { resolution: 'REPUBLISHED', url: result.url || '' });");
    const fail = between(handler, '} else {', '} catch (err) {');
    expect(fail).not.toContain('resolveRepublishItems');
    expect(PREVIEW).not.toContain('const filtered = currentQueue.filter(x => x.id !== id);\n            localStorage.setItem');
    expect(PREVIEW).toMatch(/import \{ resolveRepublishItems, byRepublishItemId(, [a-zA-Z]+)* \} from '\.\/republish-queue-store\.js';/);   // v3.8.780 에서 republishPayloadOf 추가
  });
  test('대기열 저장은 에이전트 작업 ID 를 항목에 싣는다(payload 는 예전 그대로)', () => {
    const save = between(POSTING, 'function saveToRepublishQueue(entry = {}) {', 'const queue = JSON.parse');
    expect(save).toContain("agentJobId: entry.agentJobId || '',");
    expect(save).toContain('payload: entry.payload || {},');
    expect(POSTING).toContain("agentJobId: generated.payload?.agentJobId || agentResult?.jobId || '',");
  });
});

/**
 * v3.8.769 — 다중계정 발행에 에이전트 모드 연결 (사장님 승인 2026-11-07).
 *
 * 전: 실행 모드가 에이전트여도 다중계정은 API 키가 없으면 막고, 있으면 API(generateMaxModeArticle)로만 글을 썼다.
 * 후: 에이전트 모드면 단일발행과 같은 생성 경로(window.runAgentJobFromPosting)로 Claude Code/Codex 가 글을 쓰고,
 *     그 글을 계정별 자격 증명으로 발행한다. 시작 전에 에이전트·이미지 엔진 준비를 확인하고, 안 되면 시작하지 않는다.
 * 실제 Codex/Claude 호출·발행은 하지 않는다 - 가짜 window 로 시험한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { blockBetween, braceBlock } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (...parts: string[]): string => fs.readFileSync(path.join(root, ...parts), 'utf8');

interface AgentHelpers {
  readAgentExecutionState(win: unknown): { mode: string; provider: string };
  collectAgentImageEngines(accounts: unknown[], advanced: unknown): string[];
  verifyMultiAccountAgentReady(accounts: unknown[], advanced: unknown, win: unknown): Promise<{ ok: boolean; skipped?: boolean; message: string }>;
  generateArticleWithAgent(payload: unknown, win: unknown, deps: unknown): Promise<{ title: string; html: string; thumbnailUrl: string; jobId: string }>;
  runAccountsInOrder<T>(accounts: unknown[], runOne: (account: any) => Promise<T>, options: { agent: boolean; shouldStop: () => boolean }): Promise<T[]>;
  stripAccountSecrets(payload: Record<string, unknown>): Record<string, unknown>;
}

function loadHelpers(): AgentHelpers {
  const source = read('electron', 'ui', 'modules', 'multi-account-agent.js').replace(/^export /gm, '');
  const names = ['readAgentExecutionState', 'collectAgentImageEngines', 'verifyMultiAccountAgentReady', 'generateArticleWithAgent', 'runAccountsInOrder', 'stripAccountSecrets'];
  return vm.runInNewContext(`${source}\n({ ${names.join(', ')} })`, { console, Promise, setTimeout }) as AgentHelpers;
}

const fakeStorage = (items: Record<string, string>) => ({ getItem: (key: string) => (key in items ? items[key] : null) });

describe('실행 모드 읽기', () => {
  const h = loadHelpers();
  test('저장된 값(JSON)과 화면 상태 함수를 모두 이해한다', () => {
    const fromStorage = h.readAgentExecutionState({ localStorage: fakeStorage({ leadernamExecutionMode: '"agent"', leadernamActiveAgentProvider: '"claude"' }) });
    expect(fromStorage).toEqual({ mode: 'agent', provider: 'claude' });
    const fromState = h.readAgentExecutionState({ getAgentExecutionState: () => ({ mode: 'agent', provider: 'codex' }), localStorage: fakeStorage({}) });
    expect(fromState).toEqual({ mode: 'agent', provider: 'codex' });
    expect(h.readAgentExecutionState({ localStorage: fakeStorage({ leadernamExecutionMode: '"api"' }) }).mode).toBe('api');
    expect(h.readAgentExecutionState({ localStorage: fakeStorage({}) }).mode).toBe('api');
  });
});

describe('이미지 엔진 모으기(준비 확인 대상)', () => {
  const h = loadHelpers();
  test('계정별 이미지 소스 + 소제목 엔진을 중복 없이, 소제목이 꺼져 있으면 빼고', () => {
    const accounts = [{ settings: { imageSource: 'codex-image' } }, { settings: { imageSource: 'nanobanana2' } }, { settings: {} }];
    expect(h.collectAgentImageEngines(accounts, { thumbnailSource: 'codex-image', h2ImageSource: 'codex-image', h2ImageMode: 'all' }).sort())
      .toEqual(['codex-image', 'nanobanana2']);
    expect(h.collectAgentImageEngines(accounts, { thumbnailSource: 'codex-image', h2ImageSource: 'gptimage2', h2ImageMode: 'none' }).sort())
      .toEqual(['codex-image', 'nanobanana2']);
    expect(h.collectAgentImageEngines(accounts, { thumbnailSource: 'codex-image', h2ImageSource: 'gptimage2', h2ImageMode: 'all' }).sort())
      .toEqual(['codex-image', 'gptimage2', 'nanobanana2']);
  });
  test('"none"·"crawled" 처럼 연동이 필요 없는 값은 확인 대상에서 빠지지 않고 그대로 넘긴다(판정은 준비 확인 쪽)', () => {
    expect(loadHelpers().collectAgentImageEngines([{ settings: { imageSource: 'none' } }], { h2ImageMode: 'none' })).toEqual(['none']);
  });
});

describe('시작 전 준비 확인', () => {
  const h = loadHelpers();
  const accounts = [{ settings: { imageSource: 'codex-image' } }];
  const advanced = { thumbnailSource: 'codex-image', h2ImageSource: 'codex-image', h2ImageMode: 'all' };
  const agentWindow = (extra: Record<string, unknown>) => ({ localStorage: fakeStorage({ leadernamExecutionMode: '"agent"', leadernamActiveAgentProvider: '"claude"' }), ...extra });

  test('API 모드면 확인하지 않고 통과', async () => {
    const calls: unknown[] = [];
    const result = await h.verifyMultiAccountAgentReady(accounts, advanced, { localStorage: fakeStorage({ leadernamExecutionMode: '"api"' }), verifyAgentExecutionReadiness: (o: unknown) => { calls.push(o); } });
    expect(result).toMatchObject({ ok: true, skipped: true });
    expect(calls).toHaveLength(0);
  });

  test('에이전트 모드: 에이전트·이미지 엔진만 확인하고 계정별 플랫폼은 확인하지 않는다(자격 증명이 계정마다 다르다)', async () => {
    let received: any;
    const result = await h.verifyMultiAccountAgentReady(accounts, advanced, agentWindow({
      verifyAgentExecutionReadiness: async (options: unknown) => { received = options; return { ready: true, checks: [] }; },
    }));
    expect(result.ok).toBe(true);
    expect(received.skipPlatforms).toBe(true);
    expect(received.imageEngines).toEqual(['codex-image']);
  });

  test('준비가 안 되면 시작하지 않고, 빨간 항목의 이름과 이유를 말한다', async () => {
    const result = await h.verifyMultiAccountAgentReady(accounts, advanced, agentWindow({
      verifyAgentExecutionReadiness: async () => ({
        ready: false,
        checks: [
          { id: 'agent', label: 'Claude Code Agent', ready: true, detail: 'ok' },
          { id: 'image:codex-image', label: 'Codex 구독 이미지', ready: false, detail: 'Codex 구독 이미지는 Codex 연결이 필요합니다' },
        ],
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Codex 구독 이미지');
    expect(result.message).toContain('연결이 필요합니다');
    expect(result.message).not.toContain('Claude Code Agent');
  });

  test('준비 확인 모듈이 없으면 시작하지 않는다(조용히 API 로 넘어가지 않는다)', async () => {
    const result = await h.verifyMultiAccountAgentReady(accounts, advanced, agentWindow({}));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('앱을 다시 실행');
  });
});

describe('글 생성 (단일발행과 같은 경로)', () => {
  const h = loadHelpers();

  test('runAgentJobFromPosting 을 한 번 부르고 제목·본문·썸네일을 받는다. 이전 글은 비운다', async () => {
    const calls: unknown[] = [];
    const appState: { generatedContent: unknown } = { generatedContent: { content: 'stale' } };
    const previewModal = { style: { display: 'block' } };
    const win = {
      runAgentJobFromPosting: async (payload: unknown) => {
        calls.push(payload);
        return { ok: true, title: '에이전트 제목', content: '<h2>본문</h2>'.repeat(10), thumbnailUrl: 'data:image/png;base64,AAA', jobId: 'job-1' };
      },
      document: { getElementById: (id: string) => (id === 'previewModal' ? previewModal : null) },
    };
    const payload = { keyword: '봄 나들이', imageSource: 'codex-image' };
    const article = await h.generateArticleWithAgent(payload, win, { getAppState: () => appState });
    expect(calls).toEqual([payload]);
    expect(article).toMatchObject({ title: '에이전트 제목', thumbnailUrl: 'data:image/png;base64,AAA', jobId: 'job-1' });
    expect(article.html).toContain('<h2>본문</h2>');
    expect(appState.generatedContent).toBeNull(); // 다음 계정/단일 발행이 이 글을 재발행 글로 오해하지 않는다
    expect(previewModal.style.display).toBe('none');
  });

  test('앱이 플랫폼용으로 다듬어 저장한 글(제목·본문·썸네일)이 있으면 그것을 쓴다', async () => {
    const appState: { generatedContent: unknown } = { generatedContent: null };
    const article = await h.generateArticleWithAgent({ keyword: 'k' }, {
      runAgentJobFromPosting: async () => {
        appState.generatedContent = { title: '다듬은 제목', content: '<p>다듬은 본문</p>', thumbnailUrl: 'data:image/png;base64,BBB' };
        return { ok: true, title: '원래 제목', content: '<p>원본</p>' };
      },
    }, { getAppState: () => appState });
    expect(article).toMatchObject({ title: '다듬은 제목', html: '<p>다듬은 본문</p>', thumbnailUrl: 'data:image/png;base64,BBB' });
    expect(appState.generatedContent).toBeNull();
  });

  test('계정 비밀(구글 비밀키·워드프레스 비밀번호)은 에이전트 작업 폴더에 들어가는 payload 에서 빠진다', () => {
    const original = { keyword: 'k', googleClientSecret: 's', googleClientId: 'i', wordpressPassword: 'p', wordpressUsername: 'u', platform: 'wordpress' };
    const stripped = h.stripAccountSecrets(original);
    expect(stripped).toEqual({ keyword: 'k', platform: 'wordpress' });
    expect(original.googleClientSecret).toBe('s'); // 원본은 그대로(발행에는 필요하다)
  });

  test('생성 모듈이 없거나 본문이 비면 실패(빈 글을 발행하지 않는다)', async () => {
    await expect(h.generateArticleWithAgent({}, {}, { getAppState: () => ({}) })).rejects.toThrow(/Agent 실행 모듈/);
    await expect(h.generateArticleWithAgent({}, { runAgentJobFromPosting: async () => ({ ok: true, title: 't', content: '  ' }) }, { getAppState: () => ({}) }))
      .rejects.toThrow(/비어 있습니다/);
  });

  test('생성이 던진 오류는 그대로 전달된다(인증 만료·중지 등)', async () => {
    await expect(h.generateArticleWithAgent({}, { runAgentJobFromPosting: async () => { throw new Error('Claude Code 로그인이 아직 완료되지 않았습니다'); } }, { getAppState: () => ({}) }))
      .rejects.toThrow(/로그인/);
  });
});

describe('계정 실행 순서', () => {
  const h = loadHelpers();
  const run = async (agent: boolean, shouldStop: () => boolean = () => false) => {
    let active = 0;
    let peak = 0;
    const order: string[] = [];
    const results = await h.runAccountsInOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], async (account) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      order.push(account.id);
      return account.id;
    }, { agent, shouldStop });
    return { peak, order, results };
  };

  test('에이전트 모드는 한 계정씩 차례로(글 생성 작업은 한 번에 하나만 돈다 - already_running 방지)', async () => {
    const r = await run(true);
    expect(r.peak).toBe(1);
    expect(r.order).toEqual(['a', 'b', 'c']);
  });

  test('API 모드는 예전처럼 동시에', async () => {
    const r = await run(false);
    expect(r.peak).toBe(3);
    expect(r.results).toEqual(['a', 'b', 'c']);
  });

  test('에이전트 모드에서 중단 요청이 오면 남은 계정을 시작하지 않는다', async () => {
    const started: string[] = [];
    await h.runAccountsInOrder([{ id: 'a' }, { id: 'b' }], async (account) => { started.push(account.id); return null; },
      { agent: true, shouldStop: () => started.length >= 1 });
    expect(started).toEqual(['a']);
  });
});

describe('배선 (multi-account.js · main.ts · codex-workshop.js)', () => {
  const multi = read('electron', 'ui', 'modules', 'multi-account.js');
  const main = read('electron', 'main.ts');
  const workshop = read('electron', 'ui', 'modules', 'codex-workshop.js');
  test('multi-account.js: 새 모듈을 불러오고, 에이전트면 글을 에이전트로 만든 뒤 계정별로 발행한다', () => {
    expect(multi).toContain("from './multi-account-agent.js'");
    const publishToAccount = braceBlock(multi, 'async function publishToAccount(');
    expect(publishToAccount).toContain('generateArticleWithAgent(');
    expect(publishToAccount).toContain('stripAccountSecrets(');
    expect(publishToAccount).toContain('payload.preGenerated');
    // 에이전트 글이 있을 때만 붙인다 - API 모드 payload 는 예전 그대로
    expect(publishToAccount).toMatch(/if \(agent\)/);
  });

  test('multi-account.js: 계정 실행은 runAccountsInOrder 를 거친다', () => {
    const group = braceBlock(multi, 'async function publishGroup(');
    expect(group).toContain('runAccountsInOrder(');
  });

  test('multi-account.js: 준비 확인이 "발행 중" 표시보다 먼저이고, 실패하면 return 한다', () => {
    const start = braceBlock(multi, 'async function startMultiPublish(');
    const verifyAt = start.indexOf('verifyMultiAccountAgentReady(');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(start.indexOf('isPublishing = true;'));
    expect(start.slice(verifyAt, start.indexOf('isPublishing = true;'))).toMatch(/if \(!readiness\.ok\)[\s\S]*return;/);
  });

  test('main.ts: 이미 만든 글(preGenerated)이 오면 API 키 요구와 API 생성을 건너뛴다', () => {
    const handler = blockBetween(main, "ipcMain.handle('run-multi-account-post'", "ipcMain.handle('get-env'");
    expect(handler).toContain('preGenerated?: {');
    expect(handler).toMatch(/if \(!hasAnyTextKey && !useAgentArticle\)/);
    expect(handler).toMatch(/const article = useAgentArticle\s*\?/);
    expect(handler).toContain('await generateMaxModeArticle(');
    // API 생성은 에이전트 글이 없을 때만 부른다 (삼항의 else 쪽)
    const at = handler.indexOf('await generateMaxModeArticle(');
    expect(handler.lastIndexOf('useAgentArticle', at)).toBeGreaterThan(handler.lastIndexOf('const article', at) - 1);
  });

  test('codex-workshop.js: 플랫폼 확인 생략 옵션과 썸네일 반환', () => {
    expect(workshop).toContain('options.skipPlatforms !== true');
    const runJob = blockBetween(workshop, 'async function runAgentJob(', 'async function runAgentJobFromModal');
    const returned = runJob.slice(runJob.lastIndexOf('return {'));
    expect(returned).toContain("thumbnailUrl: imageEnhancement.thumbnailUrl || ''");
  });

  test('새 모듈은 index.html 에서 직접 불러오지 않는다(multi-account.js 가 import 한다)', () => {
    expect(read('electron', 'ui', 'index.html')).not.toContain('multi-account-agent.js');
  });
});

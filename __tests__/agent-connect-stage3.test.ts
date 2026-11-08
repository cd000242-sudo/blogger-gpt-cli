/**
 * Stage 3 - simpler screen. Each engine shows ONE status line (connected / check delayed / login needed /
 * install needed) and ONE button; the button runs the whole 4-step chain (check -> install -> login -> real answer)
 * and skips steps that are already done. A check that is only slow stops the chain WITHOUT installing or logging in.
 * Plan tables, upgrade / official links and the image API card are folded behind "자세히"; the tab is "AI 연결"
 * and the raw API key inputs stay inside it under "고급".
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { blockBetween } from './helpers/source-block';
import { createEsmLoader } from './helpers/esm-vm-loader';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const context = vm.createContext({ setTimeout });
const loader = createEsmLoader({ context, stubs: {} });
const state = loader.load(path.join(root, 'electron/ui/modules/agent-connect-state.js'));
const flow = loader.load(path.join(root, 'electron/ui/modules/agent-connect-flow.js'));

const tool = (over: Record<string, unknown> = {}) => ({ installed: true, usable: true, ...over });
const profile = (over: Record<string, unknown> = {}) => ({ id: 'p1', provider: 'claude', status: 'ready', useSystemHome: true, ...over });

describe('classifyAgentConnect - four states', () => {
  test('no tool info yet -> checking', () => {
    expect(state.classifyAgentConnect({})).toBe('checking');
  });
  test('program not found -> install', () => {
    expect(state.classifyAgentConnect({ tool: { installed: false }, profile: null })).toBe('install');
  });
  test('program there but its check did not finish -> delayed (never install)', () => {
    expect(state.classifyAgentConnect({ tool: tool({ usable: false, delayed: true }), profile: profile() })).toBe('delayed');
    expect(state.classifyAgentConnect({ tool: tool({ usable: false }), profile: profile() })).toBe('delayed');
  });
  test('a delayed login check is delayed, not "login needed"', () => {
    expect(state.classifyAgentConnect({ tool: tool(), profile: profile(), check: { ready: false, delayed: true } })).toBe('delayed');
  });
  test('installed, no ready login -> login; rejected login -> login', () => {
    expect(state.classifyAgentConnect({ tool: tool(), profile: null })).toBe('login');
    expect(state.classifyAgentConnect({ tool: tool(), profile: profile({ status: 'needs-login' }) })).toBe('login');
    expect(state.classifyAgentConnect({ tool: tool(), profile: profile(), check: { ready: false, authRequired: true } })).toBe('login');
  });
  test('installed + ready login -> ready', () => {
    expect(state.classifyAgentConnect({ tool: tool(), profile: profile() })).toBe('ready');
    expect(state.classifyAgentConnect({ tool: tool(), profile: profile(), check: { ready: true } })).toBe('ready');
  });
});

describe('describeAgentConnect - short plain wording', () => {
  test.each([
    ['ready', '연결됨'],
    ['delayed', '확인 지연'],
    ['login', '로그인 필요'],
    ['install', '설치 필요'],
  ])('%s line says "%s"', (kind, word) => {
    const d = state.describeAgentConnect(kind, 'Claude Code');
    expect(d.line).toContain('Claude Code');
    expect(d.line).toContain(word);
  });
  test('delayed keeps the login and offers a re-check; install / login say 연결하기', () => {
    const delayed = state.describeAgentConnect('delayed', 'Codex');
    expect(delayed.line).toContain('로그인은 그대로 유지됩니다');
    expect(delayed.buttonLabel).toBe('다시 확인');
    expect(state.describeAgentConnect('install', 'Codex').buttonLabel).toBe('연결하기');
    expect(state.describeAgentConnect('login', 'Codex').buttonLabel).toBe('연결하기');
    expect(state.describeAgentConnect('checking', 'Codex').disabled).toBe(true);
  });
});

function fakeApi(over: Record<string, any> = {}) {
  const calls: string[] = [];
  const status = { tools: { claude: tool() }, profiles: [profile()] };
  const api = {
    loadStatus: jest.fn(async () => { calls.push('loadStatus'); return over.status ?? status; }),
    getProfile: jest.fn((s: any) => (s.profiles && s.profiles[0]) || null),
    ensureProfile: jest.fn(async () => { calls.push('ensureProfile'); return profile({ status: 'needs-login' }); }),
    checkLogin: jest.fn(async () => { calls.push('checkLogin'); return over.check ?? { ready: true }; }),
    installTool: jest.fn(async () => { calls.push('installTool'); return over.install ?? { ok: true }; }),
    startLogin: jest.fn(async () => { calls.push('startLogin'); return { ok: true }; }),
    verifyAnswer: jest.fn(async () => { calls.push('verifyAnswer'); return over.answer ?? { ok: true }; }),
  };
  return { api, calls };
}

async function run(api: any, over: Record<string, any> = {}) {
  const lines: Array<[string, string]> = [];
  let t = 0;
  const result = await flow.runAgentConnect({
    provider: 'claude',
    label: 'Claude Code',
    api,
    confirmInstall: over.confirmInstall ?? (() => true),
    report: (line: string, tone: string) => lines.push([line, tone]),
    now: () => (t += 1000),
    sleep: async () => undefined,
    loginPollMs: 1,
    loginTimeoutMs: over.loginTimeoutMs ?? 4000,
  });
  return { result, lines };
}

describe('runAgentConnect - the one-button chain', () => {
  test('already connected: only check -> real answer (install and login are skipped)', async () => {
    const { api, calls } = fakeApi();
    const { result, lines } = await run(api);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['loadStatus', 'checkLogin', 'verifyAnswer']);
    expect(lines.map(([l]) => l).join('\n')).toContain('[1/4 준비 확인]');
    expect(lines.map(([l]) => l).join('\n')).toContain('[4/4 실제 답 확인]');
    expect(lines[lines.length - 1]![1]).toBe('success');
  });

  test('a slow tool check stops at step 1: nothing is installed, no login window, no model call', async () => {
    const { api, calls } = fakeApi({ status: { tools: { claude: tool({ usable: false, delayed: true }) }, profiles: [profile()] } });
    const { result } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 1, delayed: true });
    expect(result.message).toContain('로그인은 그대로 유지됩니다');
    expect(calls).toEqual(['loadStatus']);
  });

  test('a slow login check stops at step 1 as well (never turned into a login window)', async () => {
    const { api, calls } = fakeApi({ check: { ready: false, delayed: true } });
    const { result } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 1, delayed: true });
    expect(calls).not.toContain('startLogin');
    expect(calls).not.toContain('installTool');
  });

  test('not installed: asks first; "no" stops at step 2 without installing', async () => {
    const { api, calls } = fakeApi({ status: { tools: { claude: { installed: false } }, profiles: [] } });
    const { result } = await run(api, { confirmInstall: () => false });
    expect(result).toMatchObject({ ok: false, step: 2, delayed: false });
    expect(calls).toEqual(['loadStatus']);
  });

  test('not installed + yes: install -> login -> real answer, in that order', async () => {
    const { api, calls } = fakeApi();
    let installed = false;
    api.loadStatus.mockImplementation(async () => {
      calls.push('loadStatus');
      return installed
        ? { tools: { claude: tool() }, profiles: [profile({ status: 'needs-login' })] }
        : { tools: { claude: { installed: false } }, profiles: [] };
    });
    api.installTool.mockImplementation(async () => { calls.push('installTool'); installed = true; return { ok: true }; });
    api.checkLogin.mockResolvedValue({ ready: true });
    const { result } = await run(api);
    expect(result.ok).toBe(true);
    expect(calls.indexOf('installTool')).toBeLessThan(calls.indexOf('startLogin'));
    expect(calls.indexOf('startLogin')).toBeLessThan(calls.indexOf('verifyAnswer'));
  });

  test('install refused because a program already exists -> delayed, never a second install attempt', async () => {
    const { api, calls } = fakeApi({ status: { tools: { claude: { installed: false } }, profiles: [] }, install: { ok: false, delayed: true } });
    const { result } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 2, delayed: true });
    expect(calls.filter((c) => c === 'installTool')).toHaveLength(1);
    expect(calls).not.toContain('startLogin');
  });

  test('login needed: install is skipped, the login window opens, the chain waits until it is ready', async () => {
    const { api, calls } = fakeApi({ status: { tools: { claude: tool() }, profiles: [profile({ status: 'needs-login' })] } });
    api.checkLogin
      .mockResolvedValueOnce({ ready: false, authRequired: true })
      .mockResolvedValueOnce({ ready: false, delayed: true })
      .mockResolvedValue({ ready: true });
    const { result } = await run(api);
    expect(result.ok).toBe(true);
    expect(calls).not.toContain('installTool');
    expect(calls).toContain('startLogin');
    expect(calls[calls.length - 1]).toBe('verifyAnswer');
  });

  test('login never completes: stops at step 3 with a re-check hint', async () => {
    const { api } = fakeApi({ status: { tools: { claude: tool() }, profiles: [profile({ status: 'needs-login' })] } });
    api.checkLogin.mockResolvedValue({ ready: false, authRequired: true });
    const { result } = await run(api, { loginTimeoutMs: 3000 });
    expect(result).toMatchObject({ ok: false, step: 3 });
    expect(result.message).toContain('다시 확인');
  });

  test('a usage limit is "connected" - no model call is wasted on it', async () => {
    const { api, calls } = fakeApi({ check: { ready: false, quotaExceeded: true } });
    const { result } = await run(api);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('사용 한도');
    expect(calls).not.toContain('verifyAnswer');
  });

  test('the real answer is slow -> delayed at step 4; wrong answer -> plain failure at step 4', async () => {
    const slow = fakeApi({ answer: { ok: false, delayed: true } });
    expect((await run(slow.api)).result).toMatchObject({ ok: false, step: 4, delayed: true });
    const wrong = fakeApi({ answer: { ok: false, message: '확인 글자가 없습니다' } });
    const out = (await run(wrong.api)).result;
    expect(out).toMatchObject({ ok: false, step: 4, delayed: false });
    expect(out.message).toContain('확인 글자가 없습니다');
  });

  test('never throws: an error becomes the step that stopped', async () => {
    const { api } = fakeApi();
    api.checkLogin.mockRejectedValue(new Error('IPC closed'));
    const { result, lines } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 1 });
    expect(result.message).toContain('IPC closed');
    expect(lines[lines.length - 1]![1]).toBe('error');
  });
});

describe('wiring', () => {
  const mainTs = read('electron/main.ts');
  const mainJs = read('electron/main.js');
  const workshop = read('electron/ui/modules/codex-workshop.js');
  const html = read('electron/ui/index.html');

  test('main: a real-answer check asks a marker question through the selected profile and tells a slow answer from a wrong one', () => {
    const handler = blockBetween(mainTs, "ipcMain.handle('agent-mode:verify-answer'", "ipcMain.handle('agent-mode:start-login'");
    expect(handler).toContain('runAgentTextTask(');
    expect(handler).toContain('reply.includes(marker)');
    expect(handler).toContain('delayed: true');
    expect(handler).toContain('authRequired: true');
    expect(read('electron/preload.ts')).toContain("verifyAgentAnswer: (args) => ipcRenderer.invoke('agent-mode:verify-answer', args)");
    expect(mainJs).toContain('agent-mode:verify-answer');
  });

  test('screen: one status line and one connect button per engine, rules from the pure modules', () => {
    expect(workshop).toContain("import { agentStatusSignature, classifyAgentConnect, describeAgentConnect } from './agent-connect-state.js';");
    expect(workshop).toContain("import { runAgentConnect } from './agent-connect-flow.js';");
    const panel = blockBetween(workshop, 'function renderAgentProviderPanel()', 'function bindAgentProviderPanel(');
    expect(panel).toContain('describeAgentConnect(');
    expect(panel).toContain('data-agent-connect=');
    expect(panel).toContain('id="agentConnectProgress"');
  });

  test('screen: plan tables, usage, upgrade / official links and the extra buttons are behind "자세히"', () => {
    const panel = blockBetween(workshop, 'function renderAgentProviderPanel()', 'function bindAgentProviderPanel(');
    const more = panel.indexOf('<details class="agent-mode-more"');
    expect(more).toBeGreaterThan(-1);
    expect(panel.indexOf('<summary>자세히</summary>')).toBeGreaterThan(more);
    for (const heavy of ['agent-mode-plan-grid', '플랜별 글 작성 가능 수', 'data-open-url', 'data-agent-import-system', 'data-agent-refresh']) {
      expect(panel.indexOf(heavy)).toBeGreaterThan(more);
    }
    expect(panel.indexOf('data-agent-connect=')).toBeLessThan(more);
  });

  test('screen: the connect button runs the shared chain with the selected engine and never switches engines', () => {
    expect(workshop).toContain('async function connectAgent(provider');
    const fn = blockBetween(workshop, 'async function connectAgent(provider', '\nfunction ');
    expect(fn).toContain('runAgentConnect(');
    expect(fn).toContain('confirmAgentInstall(');
    expect(fn).not.toContain('state.activeAgentProvider =');
  });

  test('screen: the unused image API card is folded behind a details', () => {
    const cards = blockBetween(workshop, 'function renderApiProviderCards()', 'function renderAgentProviderTabs(');
    expect(cards).toContain('<details class="agent-mode-more">');
    expect(cards).toContain('이미지 API 카드');
  });

  test('screen: the long mode description is behind "설명 보기"', () => {
    expect(workshop).toContain('<summary>설명 보기</summary>');
  });

  test('html: the tab is "AI 연결" and the raw API key inputs stay inside it under "고급"', () => {
    const tabButton = blockBetween(html, '<button class="settings-tab active" data-tab="api-keys"', '</button>');
    expect(tabButton).toContain('AI 연결');
    expect(tabButton).not.toContain('API 키');
    const tab = html.slice(html.indexOf('<div id="tab-api-keys"'), html.indexOf('<div id="tab-platform"'));
    expect(tab).toContain('<details id="apiKeysAdvanced"');
    expect(tab).toContain('고급');
    for (const id of ['id="textEnginePicker"', 'id="apiKeyGuideBtn"']) {
      expect(tab.indexOf(id)).toBeGreaterThan(tab.indexOf('<details id="apiKeysAdvanced"'));
    }
  });

  test('screen: the connection section is the first thing in the tab (above the folded API keys)', () => {
    expect(workshop).toContain('tab.insertBefore(section, tab.firstChild)');
  });
});

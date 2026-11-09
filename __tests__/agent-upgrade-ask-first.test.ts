/**
 * Codex upgrade = ask first. Nothing is installed or upgraded behind the user's back.
 *
 * Before: when Codex said "requires a newer version of Codex", runAgentProcess upgraded it on its own
 * (ensureLatestCodexCliForCompatibility), and if the official download failed it went on to a global npm/winget
 * install - then tried other models. Now:
 *   - runAgentProcess never installs. It remembers "upgrade needed", stops right there (no other model, no other
 *     engine) and tells the caller with `upgradeRequired: true`.
 *   - the AI connection screen shows "업그레이드 필요" and the one button runs the same 4-step chain; the upgrade
 *     step asks in the in-app modal first, and only a "yes" calls agent-mode:upgrade-tool (main refuses without
 *     `confirmed: true`).
 *   - the upgrade is the official download only (portableOnly): when it fails it stops and says so.
 * Rules are in electron/agent-upgrade.ts (no Electron); wiring is checked on the source, as this repo does.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { blockBetween } from './helpers/source-block';
import { createEsmLoader } from './helpers/esm-vm-loader';
import { codexUpgradeRequiredMessage, createAgentUpgradeMemo, judgeCodexUpgrade } from '../electron/agent-upgrade';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('agent-upgrade rules (pure)', () => {
  test('the memo remembers an upgrade need per engine until it is cleared', () => {
    const memo = createAgentUpgradeMemo();
    expect(memo.needs('codex')).toBe(false);
    memo.mark('codex');
    expect(memo.needs('codex')).toBe(true);
    expect(memo.needs('claude')).toBe(false);
    memo.clear('codex');
    expect(memo.needs('codex')).toBe(false);
  });

  test('a changed version (the user upgraded by hand) drops the note; an unknown version keeps it', () => {
    const memo = createAgentUpgradeMemo();
    memo.mark('codex', { version: 'codex-cli 0.40.0' });
    expect(memo.needs('codex', 'codex-cli 0.40.0')).toBe(true);
    expect(memo.needs('codex')).toBe(true);
    expect(memo.needs('codex', 'codex-cli 0.55.0')).toBe(false);
    expect(memo.needs('codex', 'codex-cli 0.40.0')).toBe(false);
    memo.mark('codex');
    expect(memo.needs('codex', 'codex-cli 0.99.0')).toBe(true);
  });

  test('the notice names the state, the button and the promise that nothing changes behind the user', () => {
    const text = codexUpgradeRequiredMessage();
    expect(text).toContain('업그레이드 필요');
    expect(text).toContain('[업그레이드]');
    expect(text).toContain('AI 연결');
    expect(text).toMatch(/다른 엔진|다른 모델/);
    // main cuts external-traffic errors at 200 characters: the point must be in the first part
    expect(text.slice(0, 120)).toContain('업그레이드 필요');
  });

  test('judgeCodexUpgrade: ok only when the install finished, the program runs and the version moved', () => {
    const base = { exitCode: 0 as number | null, timedOut: false, versionBefore: 'codex-cli 0.40.0' };
    expect(judgeCodexUpgrade({ ...base, toolAfter: { installed: true, usable: true, version: 'codex-cli 0.55.0' } }).ok).toBe(true);
    // version of the old program unknown: nothing to compare, the run check is enough
    expect(judgeCodexUpgrade({ exitCode: 0, timedOut: false, toolAfter: { installed: true, usable: true, version: 'codex-cli 0.55.0' } }).ok).toBe(true);

    const same = judgeCodexUpgrade({ ...base, toolAfter: { installed: true, usable: true, version: 'codex-cli 0.40.0' } });
    expect(same.ok).toBe(false);
    expect(same.error).toContain('같은 버전');

    const failed = judgeCodexUpgrade({ ...base, exitCode: 1, toolAfter: { installed: true, usable: true, version: 'codex-cli 0.40.0' } });
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain('업그레이드');
    expect(judgeCodexUpgrade({ ...base, exitCode: null, timedOut: true, toolAfter: { installed: true, usable: true, version: 'codex-cli 0.40.0' } }).ok).toBe(false);

    const broken = judgeCodexUpgrade({ ...base, toolAfter: { installed: true, usable: false } });
    expect(broken.ok).toBe(false);
    expect(judgeCodexUpgrade({ ...base, toolAfter: { installed: false } }).ok).toBe(false);
  });

  test('a failed official download is reported as it is - no sentence about trying npm or winget', () => {
    const failed = judgeCodexUpgrade({ exitCode: 1, timedOut: false, toolAfter: { installed: true, usable: true, version: 'x' }, versionBefore: 'x' });
    expect(failed.error).toContain('다른 방법');
    expect(failed.error).toContain('설치하지 않');
  });
});

const context = vm.createContext({});
const loader = createEsmLoader({ context, stubs: {} });
const state = loader.load(path.join(root, 'electron/ui/modules/agent-connect-state.js'));
const flow = loader.load(path.join(root, 'electron/ui/modules/agent-connect-flow.js'));

const profile = (over: Record<string, unknown> = {}) => ({ id: 'p1', provider: 'codex', status: 'ready', useSystemHome: true, ...over });
const flagged = { tools: { codex: { installed: true, usable: true, version: 'codex-cli 0.40.0', upgradeRequired: true } }, profiles: [profile()] };
const cleared = { tools: { codex: { installed: true, usable: true, version: 'codex-cli 0.55.0' } }, profiles: [profile()] };

describe('connection screen rules - "업그레이드 필요"', () => {
  test('an installed engine that was told to upgrade is "upgrade", before "ready" and "delayed"', () => {
    expect(state.classifyAgentConnect({ tool: flagged.tools.codex, profile: profile() })).toBe('upgrade');
    expect(state.classifyAgentConnect({ tool: { ...flagged.tools.codex, usable: false, delayed: true }, profile: profile() })).toBe('upgrade');
    expect(state.classifyAgentConnect({ tool: cleared.tools.codex, profile: profile() })).toBe('ready');
    // not installed stays "install" (an upgrade note on a missing program means nothing)
    expect(state.classifyAgentConnect({ tool: { installed: false, upgradeRequired: true }, profile: null })).toBe('install');
  });

  test('wording: the line says 업그레이드 필요 and the one button says 업그레이드', () => {
    const d = state.describeAgentConnect('upgrade', 'Codex');
    expect(d.line).toBe('Codex · 업그레이드 필요');
    expect(d.buttonLabel).toBe('업그레이드');
    expect(d.tone).toBe('warn');
    expect(d.disabled).toBe(false);
  });

  test('the redraw signature changes when the upgrade note appears or goes away', () => {
    const a = state.agentStatusSignature({ ok: true, tools: { codex: { installed: true, usable: true, version: 'v1' } }, profiles: [] });
    const b = state.agentStatusSignature({ ok: true, tools: { codex: { installed: true, usable: true, version: 'v1', upgradeRequired: true } }, profiles: [] });
    expect(a).not.toBe(b);
  });
});

function fakeApi(statusAfter: unknown = cleared) {
  const calls: string[] = [];
  let upgraded = false;
  const api = {
    loadStatus: jest.fn(async () => { calls.push('loadStatus'); return upgraded ? statusAfter : flagged; }),
    getProfile: jest.fn((s: any) => (s.profiles && s.profiles[0]) || null),
    ensureProfile: jest.fn(async () => profile()),
    checkLogin: jest.fn(async () => { calls.push('checkLogin'); return { ready: true }; }),
    installTool: jest.fn(async () => { calls.push('installTool'); return { ok: true }; }),
    upgradeTool: jest.fn(async () => { calls.push('upgradeTool'); upgraded = true; return { ok: true }; }),
    startLogin: jest.fn(async () => { calls.push('startLogin'); return { ok: true }; }),
    verifyAnswer: jest.fn(async () => { calls.push('verifyAnswer'); return { ok: true }; }),
  };
  return { api, calls };
}

const run = (api: any, over: Record<string, unknown> = {}) => {
  const asked: string[] = [];
  const lines: Array<[string, string]> = [];
  const input: Record<string, unknown> = {
    provider: 'codex',
    label: 'Codex',
    api,
    confirmInstall: () => { asked.push('install'); return true; },
    confirmUpgrade: () => { asked.push('upgrade'); return true; },
    report: (line: string, tone: string) => lines.push([line, tone]),
    sleep: async () => undefined,
    ...over,
  };
  return flow.runAgentConnect(input).then((result: any) => ({ result, asked, lines }));
};

describe('runAgentConnect - the upgrade step asks first', () => {
  test('"no" stops at step 2: nothing is upgraded, installed or asked of the model', async () => {
    const { api, calls } = fakeApi();
    const { result, asked } = await run(api, { confirmUpgrade: async () => false });
    expect(result).toMatchObject({ ok: false, step: 2, delayed: false });
    expect(result.message).toContain('업그레이드를 하지 않았습니다');
    expect(calls).toEqual(['loadStatus']);
    expect(asked).toEqual([]);
  });

  test('no confirmation function at all means "no" (never an upgrade by default)', async () => {
    const { api, calls } = fakeApi();
    const { result } = await run(api, { confirmUpgrade: undefined });
    expect(result).toMatchObject({ ok: false, step: 2 });
    expect(calls).not.toContain('upgradeTool');
  });

  test('"yes": the upgrade runs once, the status is read again, then the real answer is checked - install is never used', async () => {
    const { api, calls } = fakeApi();
    const { result, asked } = await run(api, { confirmUpgrade: async () => { await Promise.resolve(); return true; } });
    expect(result.ok).toBe(true);
    expect(calls.filter((c) => c === 'upgradeTool')).toHaveLength(1);
    expect(calls.indexOf('upgradeTool')).toBeLessThan(calls.lastIndexOf('loadStatus'));
    expect(calls.indexOf('upgradeTool')).toBeLessThan(calls.indexOf('verifyAnswer'));
    expect(calls).not.toContain('installTool');
    expect(asked).toEqual([]); // the install question is a different question
  });

  test('the upgrade fails: it stops at step 2 with the reason - no second try by another method, no model call', async () => {
    const { api, calls } = fakeApi();
    api.upgradeTool.mockImplementation(async () => { calls.push('upgradeTool'); return { ok: false, message: '받기에 실패했습니다' }; });
    const { result, lines } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 2 });
    expect(result.message).toContain('받기에 실패했습니다');
    expect(calls.filter((c) => c === 'upgradeTool')).toHaveLength(1);
    expect(calls).not.toContain('installTool');
    expect(calls).not.toContain('verifyAnswer');
    expect(lines[lines.length - 1]![1]).toBe('error');
  });

  test('the upgrade finished but the note is still there: stops (no endless loop)', async () => {
    const { api, calls } = fakeApi(flagged);
    const { result } = await run(api);
    expect(result).toMatchObject({ ok: false, step: 2 });
    expect(result.message).toContain('새 버전을 확인하지 못했습니다');
    expect(calls.filter((c) => c === 'upgradeTool')).toHaveLength(1);
    expect(calls).not.toContain('verifyAnswer');
  });

  test('after the upgrade a missing login still goes to the login step', async () => {
    const { api, calls } = fakeApi({ tools: cleared.tools, profiles: [profile({ status: 'needs-login' })] });
    api.checkLogin.mockResolvedValue({ ready: true });
    await run(api);
    expect(calls).toContain('startLogin');
    expect(calls.indexOf('upgradeTool')).toBeLessThan(calls.indexOf('startLogin'));
  });
});

describe('main - nothing is installed or upgraded without the user', () => {
  const mainTs = read('electron/main.ts');
  const mainJs = read('electron/main.js');
  const preloadTs = read('electron/preload.ts');
  const workshop = read('electron/ui/modules/codex-workshop.js');
  const agentRun = blockBetween(mainTs, 'async function runAgentProcess(', 'function readTextFileIfExists(');

  test('the silent upgrader is gone (source and compiled)', () => {
    expect(mainTs).not.toContain('ensureLatestCodexCliForCompatibility');
    expect(mainJs).not.toContain('ensureLatestCodexCliForCompatibility');
  });

  test('runAgentProcess never installs: it notes the need, stops, and does not try another model', () => {
    expect(agentRun).not.toContain('installAgentForThisPc');
    expect(agentRun).not.toContain('runInlineAgentInstall');
    expect(agentRun).not.toMatch(/npm install|winget/);
    expect(agentRun).toContain('agentUpgradeMemo.mark(');
    expect(agentRun).toContain('upgradeRequired: true');
    // the upgrade check comes before the "retry with another model" decision
    expect(agentRun.indexOf('CODEX_UPGRADE_REQUIRED_RE.test(combined)')).toBeGreaterThan(-1);
    expect(agentRun.indexOf('CODEX_UPGRADE_REQUIRED_RE.test(combined)')).toBeLessThan(agentRun.indexOf('isCodexModelRetryableError(model, run)'));
  });

  test('a Codex run that finished well clears the note', () => {
    expect(agentRun).toContain("agentUpgradeMemo.clear('codex')");
  });

  test('the status handler tells the screen which engine needs an upgrade (without touching the cached tool)', () => {
    const handler = blockBetween(mainTs, "ipcMain.handle('agent-mode:get-status'", "ipcMain.handle('agent-mode:select-profile'");
    expect(handler).toContain('agentUpgradeMemo.needs(');
    expect(handler).toContain('upgradeRequired: true');
    expect(handler).toContain('...tool');
  });

  test('official download only: the portable-only upgrade never falls to npm / winget', () => {
    const installer = blockBetween(mainTs, 'async function installAgentForThisPc(', 'function runInlineAgentInstall(');
    expect(installer).toContain('portableOnly');
    // first branch (non-Windows / Claude): refused before it can reach the inline installer
    expect(installer.indexOf('options.portableOnly')).toBeLessThan(installer.indexOf('return runInlineAgentInstall(provider)'));
    // after a failed download: stop before the npm / winget retry
    const afterDownload = installer.indexOf('if (portable.ok)');
    expect(installer.indexOf('if (options.portableOnly)', afterDownload)).toBeGreaterThan(afterDownload);
    expect(installer.indexOf('if (options.portableOnly)', afterDownload)).toBeLessThan(installer.indexOf('const fallback = await runInlineAgentInstall(provider)'));
  });

  test('agent-mode:upgrade-tool refuses without confirmed, runs the portable-only upgrade, then judges and clears', () => {
    const handler = blockBetween(mainTs, "ipcMain.handle('agent-mode:upgrade-tool'", "ipcMain.handle('agent-mode:verify-answer'");
    expect(handler).toContain('args?.confirmed !== true');
    expect(handler).toContain('needsConfirm: true');
    expect(handler.indexOf('args?.confirmed !== true')).toBeLessThan(handler.indexOf('installAgentForThisPc('));
    expect(handler).toContain("installAgentForThisPc('codex'");
    expect(handler).toContain('portableOnly: true');
    expect(handler).toContain('judgeCodexUpgrade(');
    expect(handler).toContain("agentUpgradeMemo.clear('codex')");
    expect(handler).not.toContain('runInlineAgentInstall');
    expect(handler).not.toMatch(/npm install|winget/);
    expect(mainJs).toContain("'agent-mode:upgrade-tool'");
  });

  test('the install handler is unchanged: still needs confirmed', () => {
    const handler = blockBetween(mainTs, "ipcMain.handle('agent-mode:install-tool'", "ipcMain.handle('agent-mode:upgrade-tool'");
    expect(handler).toContain('args?.confirmed !== true');
  });

  test('preload exposes the channel (source and compiled)', () => {
    expect(preloadTs).toContain("upgradeAgentTool: (args) => ipcRenderer.invoke('agent-mode:upgrade-tool', args)");
    expect(read('electron/preload.js')).toContain("'agent-mode:upgrade-tool'");
  });

  test('every caller that used to fall back stops and says so', () => {
    // run-job: the failure answer carries the flag and the plain notice
    const failure = buildFailure();
    expect(failure).toContain('codexUpgradeRequiredMessage()');
    const runJob = blockBetween(mainTs, "ipcMain.handle('agent-mode:run-job'", "ipcMain.handle('transform-content'");
    expect(runJob).toContain('upgradeRequired: run.upgradeRequired === true');
    // 거미줄 (internal consistency): returns before the Gemini API fallback
    const spider = blockBetween(mainTs, 'Agent CLI로 통합글 생성', 'const agentContent = String(result.content');
    expect(spider).toContain('run.upgradeRequired');
    expect(spider).toContain('return { success: false');
    // external traffic: the agent path has no API fallback; it must not retry three times on an upgrade error
    const traffic = blockBetween(mainTs, 'async function runExternalTrafficAgent(', 'async function callLLMWithPreference(');
    expect(traffic).toContain('run.upgradeRequired');
    expect(traffic).toContain('codexUpgradeRequiredMessage()');
  });

  test('screen: the chain gets the upgrade question and call, and a failed run refreshes the status line', () => {
    expect(workshop).toContain('async function confirmAgentUpgrade(');
    const ask = blockBetween(workshop, 'async function confirmAgentUpgrade(', '\n/**');
    expect(ask).toContain('askAppConfirm(');
    expect(ask).toContain('업그레이드할까요?');
    expect(ask).not.toMatch(/window\.confirm\(|[^A-Za-z.]confirm\(/);
    const connect = blockBetween(workshop, 'async function connectAgent(provider', '\nasync function installAgentTool(');
    expect(connect).toContain('confirmUpgrade: () => confirmAgentUpgrade(label)');
    expect(connect).toContain('upgradeTool:');
    const upgrade = blockBetween(workshop, 'async function upgradeAgentTool(', '\nasync function ');
    expect(upgrade).toContain('confirmed: true');
    expect(upgrade).toContain("'agent-mode:upgrade-tool'");
    const runFailure = blockBetween(workshop, 'if (result?.authRequired) {', 'let content = String(result.content');
    expect(runFailure).toContain('result?.upgradeRequired');
    expect(runFailure).toContain('loadAgentModeStatus(true)');
  });

  function buildFailure() {
    return blockBetween(mainTs, 'function buildAgentFailureMessage(', 'CODEX_OUT_OF_CREDITS_RE.test(combined)');
  }
});

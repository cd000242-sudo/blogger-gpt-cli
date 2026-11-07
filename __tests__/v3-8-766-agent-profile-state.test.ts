/**
 * v3.8.766 - Codex login: every app profile was dead.
 *
 * Root cause: "import this PC's login" COPIED ~/.codex/auth.json. A Codex refresh token is single use,
 * so as soon as the original was refreshed the copy was invalid. On top of that
 * refreshAgentProfileStatuses() overwrote the server verdict (needs-login) with "auth.json exists = ready",
 * and background tasks took the first profile instead of the one the user picked.
 *
 * No Codex process and no login file content is read here.
 */
import fs from 'fs';
import path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';
import {
  usesSystemHome, applyAgentHomeEnv, decideRefreshedStatus, isAuthRejected, pickAgentProfile, authStampOf,
} from '../electron/agent-profile-state';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const mainTs = read('electron/main.ts');
const mainJs = read('electron/main.js');
const workshop = read('electron/ui/modules/codex-workshop.js');

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'codex-a', provider: 'codex', status: 'ready' as 'ready' | 'needs-login' | 'unknown', ...over,
});

describe('system-home profile (no copy)', () => {
  test('only a flagged Codex/Claude profile uses the system folder', () => {
    expect(usesSystemHome(profile({ useSystemHome: true }))).toBe(true);
    expect(usesSystemHome(profile({ provider: 'claude', useSystemHome: true }))).toBe(true);
    expect(usesSystemHome(profile())).toBe(false);
    expect(usesSystemHome(profile({ provider: 'gemini', useSystemHome: true }))).toBe(false);
  });

  test('the run env gets no CODEX_HOME for a system-home profile, and the isolated folder otherwise', () => {
    const sys = applyAgentHomeEnv({ PATH: 'x' }, profile({ useSystemHome: true }), 'CODEX_HOME', 'C:\\app\\p1');
    expect(sys).not.toHaveProperty('CODEX_HOME');
    const iso = applyAgentHomeEnv({ PATH: 'x' }, profile(), 'CODEX_HOME', 'C:\\app\\p1');
    expect(iso.CODEX_HOME).toBe('C:\\app\\p1');
  });

  test('a CODEX_HOME already inherited from the OS is left alone (same folder the terminal uses)', () => {
    const env = applyAgentHomeEnv({ CODEX_HOME: 'D:\\mine' }, profile({ useSystemHome: true }), 'CODEX_HOME', 'C:\\app\\p1');
    expect(env.CODEX_HOME).toBe('D:\\mine');
  });
});

describe('server verdict is not overwritten by "auth file exists"', () => {
  const stamp = authStampOf([{ name: 'auth.json', mtimeMs: 1000, size: 50 }]);

  test('rejected + auth file unchanged -> stays needs-login', () => {
    const p = profile({ status: 'needs-login', rejectedAuthStamp: stamp });
    expect(decideRefreshedStatus(p, true, stamp)).toBe('needs-login');
    expect(isAuthRejected(p, stamp)).toBe(true);
  });

  test('a new login rewrites the file -> evidence wins again', () => {
    const p = profile({ status: 'needs-login', rejectedAuthStamp: stamp });
    const fresh = authStampOf([{ name: 'auth.json', mtimeMs: 2000, size: 50 }]);
    expect(decideRefreshedStatus(p, true, fresh)).toBe('ready');
    expect(isAuthRejected(p, fresh)).toBe(false);
  });

  test('no auth evidence -> needs-login; fresh profile with evidence -> ready (old behaviour kept)', () => {
    expect(decideRefreshedStatus(profile(), false, '')).toBe('needs-login');
    expect(decideRefreshedStatus(profile({ status: 'needs-login' }), true, stamp)).toBe('ready');
  });
});

describe('profile choice', () => {
  const dead = profile({ id: 'dead', status: 'needs-login' });
  const live = profile({ id: 'live', status: 'ready' });
  const other = profile({ id: 'claude-1', provider: 'claude', status: 'ready' });

  test('an explicit id wins', () => {
    expect(pickAgentProfile([dead, live], { profileId: 'dead' })?.id).toBe('dead');
  });
  test('the profile the user chose wins over the first one', () => {
    const second = profile({ id: 'second', status: 'ready' });
    expect(pickAgentProfile([live, second], { provider: 'codex', preferredId: 'second' })?.id).toBe('second');
  });
  test('a dead first profile is skipped when no choice is known', () => {
    expect(pickAgentProfile([dead, live], { provider: 'codex' })?.id).toBe('live');
  });
  test('a dead chosen profile gives way to a live one of the same provider; all dead -> the chosen one (clear error)', () => {
    expect(pickAgentProfile([dead, live], { provider: 'codex', preferredId: 'dead' })?.id).toBe('live');
    const dead2 = profile({ id: 'dead2', status: 'needs-login' });
    expect(pickAgentProfile([dead, dead2], { provider: 'codex', preferredId: 'dead2' })?.id).toBe('dead2');
  });
  test('provider filter and empty list', () => {
    expect(pickAgentProfile([other], { provider: 'codex' })).toBeNull();
    expect(pickAgentProfile([], { provider: 'codex' })).toBeNull();
  });
});

describe('main.ts wiring', () => {
  test('buildAgentRunEnv delegates the home variable to applyAgentHomeEnv', () => {
    const fn = braceBlock(mainTs, 'function buildAgentRunEnv(');
    expect(fn).toContain('applyAgentHomeEnv(env, profile,');
    expect(fn).not.toMatch(/env\[agentProviderInfo\(profile\.provider\)\.envVar\]\s*=\s*profile\.profileDir/);
  });

  test('refreshAgentProfileStatuses keeps the server verdict', () => {
    const fn = braceBlock(mainTs, 'function refreshAgentProfileStatuses(');
    expect(fn).toContain('decideRefreshedStatus(');
  });

  test('findAgentProfile and runAgentTextTask use the shared chooser (not "first ready")', () => {
    expect(braceBlock(mainTs, 'function findAgentProfile(')).toContain('pickAgentProfile(');
    const task = blockBetween(mainTs, 'async function runAgentTextTask(', 'const command = resolveAgentBinaryCommand(profile.provider)');
    expect(task).toContain('pickAgentProfile(');
    expect(task).not.toContain("p.status === 'ready')");
  });

  test('server rejection stores the auth stamp (verify and in-run detection)', () => {
    expect(mainTs).toMatch(/updateAgentProfileStatus\(profile\.id, 'needs-login', \{ rejectedAuthStamp:/);
    expect(mainTs.match(/rejectedAuthStamp: readAgentAuthStamp\(profile\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('saved profiles keep the new fields across load', () => {
    const fn = braceBlock(mainTs, 'function normalizeAgentProfile(');
    expect(fn).toContain('useSystemHome');
    expect(fn).toContain('rejectedAuthStamp');
  });

  test('login command/script do not redirect CODEX_HOME for a system-home profile', () => {
    expect(braceBlock(mainTs, 'function buildAgentLoginCommand(')).toContain('usesSystemHome(profile)');
    expect(braceBlock(mainTs, 'function buildAgentLoginScript(')).toContain('usesSystemHome(profile)');
  });

  test('the import handler marks the profile instead of copying the login file', () => {
    const handler = mainTs.slice(mainTs.indexOf("ipcMain.handle('agent-mode:import-system-login'"));
    const body = handler.slice(0, handler.indexOf("ipcMain.handle('agent-mode:get-login-command'"));
    expect(body).toContain('useSystemHome: true');
    expect(body).not.toContain('copyFileSync');
    expect(body).not.toContain('renameSync');
    expect(body).not.toContain('rmSync');
    expect(body).toContain('await verifyAgentLoginSession(profile)');
  });

  test('profile views tell the screen whether the server rejected the login', () => {
    expect(braceBlock(mainTs, 'function toAgentProfileView(')).toContain('authRejected');
  });

  test('the compiled main.js carries the change', () => {
    expect(mainJs).toContain('applyAgentHomeEnv');
    expect(mainJs).toContain('decideRefreshedStatus');
    expect(mainJs).toContain('pickAgentProfile');
  });
});

describe('screen', () => {
  test('a rejected profile reads "다시 로그인 필요"', () => {
    expect(braceBlock(workshop, 'function getProviderLoginLabel(')).toContain('다시 로그인 필요');
  });
  test('"PC 로그인 그대로 쓰기" replaces the import wording and comes before "계정 추가"', () => {
    expect(workshop).toContain('PC 로그인 그대로 쓰기');
    expect(workshop).not.toContain('이 PC 로그인 가져오기');
    expect(workshop.indexOf('data-agent-import-system="')).toBeLessThan(workshop.indexOf('data-agent-add-account="'));
  });
  test('without an explicit choice the screen prefers a ready profile', () => {
    expect(braceBlock(workshop, 'function getActiveAgentProfile(')).toContain('isAgentProfileReady');
  });
});

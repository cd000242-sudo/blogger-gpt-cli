/**
 * Stage 1 wiring - the verdict rules (agent-connect-verdict.test.ts) are actually used.
 *
 * Reported on the owner's PC: Claude Code and Codex showed a red "login needed" card although the
 * login was fine. Roots found by reading the code:
 *   - a slow / failed / empty status probe was drawn as a logout ("CLI did not answer, update it")
 *   - the screen echoed its displayed account back as the "preferred" one, pinning an empty July folder
 *   - "log in" silently ran the official installer, replacing the user's own ~/.local/bin/claude.exe
 *   - a failed --version check was remembered for 5 minutes and the engine was switched behind the user
 *   - the header badge fell back to API mode when the login check failed
 * Source checks are this repo's convention for wiring (the full flow needs Electron and a real login).
 */
import fs from 'fs';
import path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const mainTs = read('electron/main.ts');
const mainJs = read('electron/main.js');
const preload = read('electron/preload.ts');
const workshop = read('electron/ui/modules/codex-workshop.js');
const badges = read('electron/ui/modules/header-badges.js');

/** Function body up to the first line that is exactly "}" (default params like `= {}` break braceBlock). */
const fnBody = (src: string, marker: string): string => {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end + 3);
};

const verifyFn = blockBetween(mainTs, 'async function verifyAgentLoginSession(', 'function testAgentBinary(');
const handlerBetween = (start: string, end: string) => blockBetween(mainTs, `ipcMain.handle('${start}'`, `ipcMain.handle('${end}'`);

describe('main: a probe that cannot answer is "delayed"', () => {
  test('verifyAgentLoginSession classifies with the shared rules and reuses a recent verification', () => {
    expect(verifyFn).toContain('classifyLoginProbe(');
    expect(verifyFn).toContain('settleLoginState(');
    expect(verifyFn).toContain('agentLoginMemo.recall(profile.id)');
    expect(verifyFn).toContain('agentLoginMemo.remember(profile.id)');
    expect(verifyFn).toContain('delayedLoginMessage(');
  });

  test('the old "CLI did not answer, update it" text is gone', () => {
    expect(mainTs).not.toContain('CLI가 로그인 상태를 응답하지 않았습니다');
  });

  test('only an explicit logout marks the profile needs-login (a delayed probe leaves the status alone)', () => {
    expect(verifyFn).toMatch(/else if \(authRequired\)\s*updateAgentProfileStatus\(profile\.id, 'needs-login'/);
    expect(verifyFn).toContain('agentLoginMemo.forget(profile.id)');
  });

  test('the result tells the screen delayed / reused / state', () => {
    expect(verifyFn).toMatch(/delayed: verdict\.delayed/);
    expect(verifyFn).toMatch(/reused: verdict\.reused/);
    expect(verifyFn).toMatch(/state: verdict\.state/);
  });

  test('the verified memo survives a restart (loaded once, saved on change)', () => {
    expect(mainTs).toContain('createVerifiedLoginMemo({');
    expect(mainTs).toContain('function getAgentLoginMemoPath(');
    expect(mainTs).toContain('function persistAgentLoginMemo(');
  });

  test('run-job blocks a delayed profile with its own reason (not as a logout)', () => {
    const job = blockBetween(mainTs, "ipcMain.handle('agent-mode:run-job'", 'const jobId = createAgentJobId(');
    expect(job).toContain('delayed: loginVerification.delayed');
  });

  test('check-login passes delayed / reused / state through to the screen', () => {
    const check = handlerBetween('agent-mode:check-login', 'agent-mode:install-tool');
    expect(check).toContain('delayed: verification.delayed');
    expect(check).toContain('reused: verification.reused');
    expect(check).toContain('state: verification.state');
  });
});

describe('main: the default account is this PC login and nothing pins a stale choice', () => {
  test('findAgentProfile no longer remembers whatever id the screen sent', () => {
    expect(braceBlock(mainTs, 'function findAgentProfile(')).not.toContain('rememberPreferredAgentProfile');
  });

  test('check-login no longer remembers the id it was asked about, and picks with the shared chooser', () => {
    const check = handlerBetween('agent-mode:check-login', 'agent-mode:install-tool');
    expect(check).not.toContain('rememberPreferredAgentProfile');
    expect(check).toContain('pickAgentProfile(');
  });

  test('the preference is stored only by the explicit select-profile channel (and the explicit "use PC login" button)', () => {
    const select = handlerBetween('agent-mode:select-profile', 'agent-mode:list-profiles');
    expect(select).toContain('rememberPreferredAgentProfile(');
    const remembered = mainTs.match(/rememberPreferredAgentProfile\(/g) || [];
    // definition + select-profile + import-system-login
    expect(remembered.length).toBe(3);
    expect(preload).toContain("selectAgentProfile: (args) => ipcRenderer.invoke('agent-mode:select-profile', args)");
  });

  test('a new account is the PC login unless "advanced / isolated" is requested', () => {
    const create = handlerBetween('agent-mode:create-profile', 'agent-mode:import-system-login');
    expect(create).toContain('args?.isolated !== true');
    expect(create).toContain('useSystemHome');
  });

  test('an isolated folder without a real token is not "ready"', () => {
    const fn = braceBlock(mainTs, 'function hasAgentAuthEvidence(');
    expect(fn).toContain('requiresTokenEvidence(profile.provider)');
    expect(fn).toContain('isolatedProfileHasRealLogin(profile.profileDir, profile.provider)');
  });
});

describe('main: no install without a yes, and never over an existing program', () => {
  const install = handlerBetween('agent-mode:install-tool', 'agent-mode:start-login');

  test('install-tool refuses unless the screen says the user confirmed', () => {
    const before = install.slice(0, install.indexOf('installAgentForThisPc('));
    expect(before).toContain('args?.confirmed !== true');
    expect(before).toContain('needsConfirm: true');
  });

  test('an existing Claude Code program is never replaced - the answer is "delayed + re-check"', () => {
    const before = install.slice(0, install.indexOf('installAgentForThisPc('));
    expect(before).toMatch(/provider === 'claude'/);
    expect(before).toContain('agentProgramExists(');
    expect(before).toContain('alreadyInstalled: true');
    expect(before).toContain('delayed: true');
  });
});

describe('main: a failed --version check is not remembered or acted on', () => {
  test('a timed out / failed check is reported as delayed on the tool status', () => {
    const fn = blockBetween(mainTs, 'function testAgentBinary(', 'async function detectAgentBinary(');
    expect(fn).toContain('delayed');
  });

  test('the 5-minute cache never stores a failed check', () => {
    const fn = braceBlock(mainTs, 'async function detectAgentBinariesCached(');
    expect(fn).toContain('usable === false');
    expect(fn).toContain('delayed');
  });
});

describe('compiled main.js carries the change', () => {
  test.each(['classifyLoginProbe', 'settleLoginState', 'agent-mode:select-profile', 'isolatedProfileHasRealLogin'])('%s', (needle) => {
    expect(mainJs).toContain(needle);
  });
});

describe('screen: no secret engine switch, no silent install, no auto-pinned account', () => {
  test('loading the status no longer moves the engine to whichever CLI is usable', () => {
    expect(workshop).not.toContain('const fallback = AGENT_PROVIDER_IDS.find');
    expect(braceBlock(workshop, 'async function loadAgentModeStatus(')).not.toContain('saveExecutionPrefs()');
  });

  test('the header badge keeps the user\'s agent mode when the login check fails', () => {
    const tail = blockBetween(badges, 'const loginCheck = ', 'function buildModelPop(');
    expect(tail).not.toContain("window.setAgentExecutionMode('api')");
    expect(tail).toContain('지연');
  });

  test('"log in" never installs first: the user is asked, and an existing program is only re-checked', () => {
    const body = fnBody(workshop, 'async function startAgentLogin(');
    expect(body).toContain('confirmAgentInstall(');
    expect(body).not.toContain('먼저 설치합니다');
    expect(body.indexOf('confirmAgentInstall(')).toBeLessThan(body.indexOf('installAgentTool('));
    // installed but the check failed -> delayed + re-check, not install
    expect(body).toContain('확인 지연');
  });

  test('the install call carries the confirmation main requires', () => {
    const body = fnBody(workshop, 'async function installAgentTool(');
    expect(body).toContain('confirmed: true');
  });

  test('the confirmation is a plain question with the program name, asked in the app (not the native confirm that can hide behind the window)', () => {
    const fn = braceBlock(workshop, 'function confirmAgentInstall(');
    expect(fn).toContain('설치할까요?');
    expect(fn).toContain('askAppConfirm(');
    expect(fn).not.toMatch(/window\.confirm\(|[^A-Za-z.]confirm\(/);
  });

  test('rendering never saves the displayed (derived) account as the user\'s choice', () => {
    for (const name of ['function renderAgentProfileSelect(', 'function getSelectedAgentProfile(', 'function renderSettingsProfileSelect(']) {
      expect(braceBlock(workshop, name)).not.toContain('setActiveAgentProfile(');
    }
  });

  test('the explicit choice is stored and told to main', () => {
    const fn = braceBlock(workshop, 'function setActiveAgentProfile(');
    expect(fn).toContain('selectAgentProfile');
  });

  test('without a choice the screen shows this PC login first', () => {
    const fn = braceBlock(workshop, 'function getActiveAgentProfile(');
    expect(fn).toContain('useSystemHome');
  });

  test('a delayed check is shown as delayed, with the login kept', () => {
    const msg = fnBody(workshop, 'function getAgentLoginResultMessage(');
    expect(msg).toContain('delayed');
    expect(msg).toContain('로그인은 그대로 유지됩니다');
  });
});

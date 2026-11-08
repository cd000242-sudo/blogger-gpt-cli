/**
 * Stage 2 wiring - speed. The caches are tested in agent-probe-cache.test.ts; this checks they are used.
 *
 * Measured causes (read from the code):
 *   - getCommandOutputSync ran `npm config get prefix` + `where.exe` with execFileSync on every candidate lookup
 *   - codexSupportsApproveForMe ran `codex exec --help` with spawnSync (up to 20 s) and the cache was wiped on
 *     every install/login click
 *   - the Codex image readiness check bypassed the CLI detection cache
 *   - identity / auth stamp walked the whole login folder (system-home profile = ~/.claude, hundreds of files)
 *   - the screen re-drew three panels on every status, and re-bound click handlers on every 5 s redraw
 *     (the HTML was unchanged so the buttons stayed, and each tick added another listener)
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { blockBetween, braceBlock } from './helpers/source-block';
import { createEsmLoader } from './helpers/esm-vm-loader';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const mainTs = read('electron/main.ts');
const mainJs = read('electron/main.js');
const workshop = read('electron/ui/modules/codex-workshop.js');

/** Function body up to the first line that is exactly "}" (default params like `= {}` break braceBlock). */
const fnBody = (src: string, marker: string): string => {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end + 3);
};

describe('main: nothing on the status path blocks the main process', () => {
  test('the blocking command helper is gone; lookups go through the session cache', () => {
    expect(mainTs).not.toContain('function getCommandOutputSync(');
    expect(mainTs).toContain('createCommandOutputCache(');
    expect(mainTs).toContain('agentCommandCache.getSync(');
    expect(mainTs).toContain('agentCommandCache.getAsync(');
  });

  test('the only blocking runner is the cache fallback (a failed attempt returns null, never throws)', () => {
    const runner = fnBody(mainTs, 'function runAgentCommandSync(');
    expect(runner).toContain('execFileSync');
    expect(runner).toMatch(/\? '' : null/);
    expect(mainTs.match(/execFileSync\(/g)?.length).toBe(2);
    expect(mainTs).not.toMatch(/spawnSync\(/);
  });

  test('CLI detection (the get-status path) looks programs up without blocking', () => {
    const fn = blockBetween(mainTs, 'async function detectAgentBinary(', 'async function getAgentModeAccessStatus(');
    expect(fn).toContain('await getAgentBinaryCandidatesAsync(');
    expect(fn).not.toContain('= getAgentBinaryCandidates(');
  });

  test('the lookups are warmed in the background once the app is ready', () => {
    expect(mainTs).toContain('function warmAgentBinaryLookups(');
    const ready = mainTs.slice(mainTs.indexOf('app.whenReady().then(async () => {'));
    expect(ready.slice(0, 6000)).toContain('warmAgentBinaryLookups()');
  });

  test('an install clears the lookup cache (a new program must be found); a login click does not', () => {
    expect(braceBlock(mainTs, 'function invalidateAgentProgramLookups(')).toContain('agentCommandCache.clear()');
    expect(braceBlock(mainTs, 'function invalidateAgentBinaryCache(')).not.toContain('agentCommandCache');
    const install = blockBetween(mainTs, "ipcMain.handle('agent-mode:install-tool'", "ipcMain.handle('agent-mode:start-login'");
    expect(install).toContain('invalidateAgentProgramLookups()');
    const login = blockBetween(mainTs, "ipcMain.handle('agent-mode:start-login'", "ipcMain.handle('agent-mode:run-job'");
    expect(login).not.toContain('invalidateAgentProgramLookups()');
  });

  test('codex --help is probed without blocking and remembered per program build', () => {
    const fn = braceBlock(mainTs, 'function codexSupportsApproveForMe(');
    expect(fn).not.toContain('spawnSync');
    expect(fn).toContain('codexApproveCache.peek(');
    expect(fnBody(mainTs, 'function codexApproveKey(')).toContain('binaryFingerprint(');
    expect(fnBody(mainTs, 'async function ensureCodexApproveSupport(')).toContain('codexApproveCache.ensure(');
    expect(fnBody(mainTs, 'function runCodexExecHelp(')).toContain("'exec', '--help'");
  });

  test('clicking install / login no longer throws the codex help answer away', () => {
    expect(braceBlock(mainTs, 'function invalidateAgentBinaryCache(')).not.toContain('codexApproveForMeCache');
    expect(mainTs).not.toContain('codexApproveForMeCache');
  });

  test('a run waits for the help answer before building the command', () => {
    const run = blockBetween(mainTs, 'async function runAgentProcess(', 'const isWindows = process.platform');
    expect(run).toContain('await ensureCodexApproveSupport(');
  });

  test('the Codex image readiness check uses the shared detection cache', () => {
    const fn = blockBetween(mainTs, 'async function collectCodexImageReadinessFacts(', 'function registerCodexImageRuntime(');
    expect(fn).toContain("detectAgentBinariesCached(['codex'])");
    expect(fn).not.toContain('await detectAgentBinary(');
  });

  test('login identity and the auth stamp read the one login file, and are remembered until it changes', () => {
    const identity = blockBetween(mainTs, 'function extractAgentLoginIdentity(', 'function toAgentProfileView(');
    expect(identity).toContain('agentCredentialFileName(');
    expect(identity).toContain('agentIdentityMemo.read(');
    const stamp = braceBlock(mainTs, 'function readAgentAuthStamp(');
    expect(stamp).toContain('agentCredentialFileName(');
  });

  test('compiled main.js carries the change', () => {
    for (const needle of ['createCommandOutputCache', 'getAgentBinaryCandidatesAsync', 'ensureCodexApproveSupport', 'warmAgentBinaryLookups']) {
      expect(mainJs).toContain(needle);
    }
    expect(mainJs).not.toContain('getCommandOutputSync');
  });
});

describe('screen: only a changed panel is redrawn, and handlers are bound once', () => {
  test('the status panel is written only when its HTML changed', () => {
    expect(braceBlock(workshop, 'function renderAgentStatusPanel(')).toContain('writeIfChanged(');
  });

  test('a status that did not change redraws nothing', () => {
    const fn = fnBody(workshop, 'async function loadAgentModeStatus(');
    expect(fn).toContain('agentStatusSignature(');
    expect(fn).toContain('state.agentStatusSignature');
  });

  test('provider panel: handlers are bound only when the HTML was actually replaced', () => {
    const fn = blockBetween(workshop, 'function renderAgentProviderPanel()', 'function getAgentReadinessActionLabel(');
    expect(fn).toMatch(/const panelChanged = writeIfChanged\(detail,/);
    expect(fn).toContain('if (panelChanged) bindAgentProviderPanel(detail, provider);');
    expect(workshop).toContain('function bindAgentProviderPanel(detail, provider)');
  });

  test('api cards: handlers are bound only when the HTML was actually replaced', () => {
    const fn = blockBetween(workshop, 'function renderApiProviderCards()', 'function renderAgentProviderPanel()');
    expect(fn).toMatch(/const cardsChanged = writeIfChanged\(target,/);
    expect(fn).toContain('if (cardsChanged)');
  });

  test('the 5 s timer skips a tick when nothing it draws has changed', () => {
    const fn = braceBlock(workshop, 'function startUsageTimer(');
    expect(fn).toContain('usageSignature()');
    expect(fn).toContain('usagePanelsVisible()');
    expect(workshop).toContain('function usageSignature(');
  });
});

describe('agent-connect-state.js: agentStatusSignature', () => {
  const context = vm.createContext({});
  const mod = createEsmLoader({ context, stubs: {} }).load(path.join(root, 'electron/ui/modules/agent-connect-state.js'));
  const base = () => ({
    ok: true, allowed: true, mode: 'max-agent', currentName: '영구', requiredName: '스탠다드',
    tools: { claude: { installed: true, usable: true, version: '2.1.0' }, codex: { installed: false } },
    profiles: [{ id: 'p1', provider: 'claude', status: 'ready', useSystemHome: true, label: 'Claude', loginCommand: 'x', loginIdentity: null, updatedAt: 'a' }],
  });

  test('the same status gives the same signature, even if a timestamp moved', () => {
    const a = base();
    const b = base();
    b.profiles[0]!.updatedAt = 'b';
    expect(mod.agentStatusSignature(a)).toBe(mod.agentStatusSignature(b));
  });

  test.each([
    ['a profile status', (s: any) => { s.profiles[0].status = 'needs-login'; }],
    ['a tool becoming usable', (s: any) => { s.tools.codex = { installed: true, usable: true }; }],
    ['a delayed tool check', (s: any) => { s.tools.claude = { installed: true, usable: false, delayed: true }; }],
    ['the license name', (s: any) => { s.currentName = '3개월'; }],
    ['a new profile', (s: any) => { s.profiles.push({ id: 'p2', provider: 'codex', status: 'ready' }); }],
    ['a login email', (s: any) => { s.profiles[0].loginIdentity = { email: 'a@b.c' }; }],
  ])('%s changes the signature', (_name, mutate) => {
    const changed = base();
    mutate(changed);
    expect(mod.agentStatusSignature(changed)).not.toBe(mod.agentStatusSignature(base()));
  });

  test('a missing status has its own stable signature', () => {
    expect(mod.agentStatusSignature(null)).toBe(mod.agentStatusSignature(undefined));
  });
});

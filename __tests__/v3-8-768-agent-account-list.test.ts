/**
 * v3.8.768 - account dropdown: real e-mail names, duplicates folded (display only), selection follows.
 *
 * Nothing here touches a real login file; profiles are plain objects.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { blockBetween, braceBlock } from './helpers/source-block';
import { createEsmLoader } from './helpers/esm-vm-loader';
import { arrangeAgentAccounts, attachAgentAccounts, buildAgentAccountLabel } from '../electron/agent-account-list';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const providerLabel = (p: string) => (p === 'claude' ? 'Claude Code' : p === 'codex' ? 'Codex' : p);

type P = { id: string; provider: string; status: 'ready' | 'needs-login' | 'unknown'; useSystemHome?: boolean; accountEmail?: string };
const p = (id: string, over: Partial<P> = {}): P => ({ id, provider: 'claude', status: 'ready', ...over });
const arrange = (list: P[], preferredIds: Record<string, string> = {}) => arrangeAgentAccounts(list, { providerLabel, preferredIds });

describe('display name', () => {
  test('this PC login and app profiles are told apart by name, then the e-mail', () => {
    expect(buildAgentAccountLabel({ providerLabel: 'Claude Code', useSystemHome: true, email: 'me@gmail.com', status: 'ready' })).toBe('이 PC 로그인 · me@gmail.com');
    expect(buildAgentAccountLabel({ providerLabel: 'Claude Code', email: 'me@gmail.com', status: 'ready' })).toBe('Claude Code · me@gmail.com');
  });

  test('no e-mail and not logged in: says so', () => {
    expect(buildAgentAccountLabel({ providerLabel: 'Claude Code', status: 'needs-login' })).toBe('Claude Code (로그인 필요)');
    expect(buildAgentAccountLabel({ providerLabel: 'Claude Code', useSystemHome: true, status: 'needs-login' })).toBe('이 PC 로그인 (로그인 필요)');
  });

  test('a known e-mail whose login is dead keeps the e-mail and says login is needed', () => {
    expect(buildAgentAccountLabel({ providerLabel: 'Codex', email: 'me@gmail.com', status: 'needs-login' })).toBe('Codex · me@gmail.com (로그인 필요)');
  });

  test('logged in but the e-mail is unknown: never claims "login needed", never invents a name', () => {
    expect(buildAgentAccountLabel({ providerLabel: 'Claude Code', status: 'ready' })).toBe('Claude Code (이메일 확인 안 됨)');
  });
});

describe('arrangeAgentAccounts: fold same account, display only', () => {
  test('same e-mail: only one stays, the rest are listed as merged', () => {
    const out = arrange([p('a', { accountEmail: 'me@gmail.com' }), p('b', { accountEmail: 'me@gmail.com' }), p('c', { accountEmail: 'other@gmail.com' })]);
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
    expect(out[0]!.mergedProfileIds).toEqual(['b']);
    expect(out[1]!.mergedProfileIds).toEqual([]);
  });

  test('e-mail match ignores case and spaces', () => {
    const out = arrange([p('a', { accountEmail: 'Me@Gmail.com' }), p('b', { accountEmail: ' me@gmail.com ' })]);
    expect(out).toHaveLength(1);
  });

  test('this PC login is kept first', () => {
    const out = arrange([p('iso', { accountEmail: 'me@gmail.com' }), p('sys', { accountEmail: 'me@gmail.com', useSystemHome: true })]);
    expect(out.map((x) => x.id)).toEqual(['sys']);
    expect(out[0]!.mergedProfileIds).toEqual(['iso']);
  });

  test('without this PC login, the selected profile is kept', () => {
    const list = [p('a', { accountEmail: 'me@gmail.com' }), p('b', { accountEmail: 'me@gmail.com' })];
    expect(arrange(list, { claude: 'b' }).map((x) => x.id)).toEqual(['b']);
    expect(arrange(list, {}).map((x) => x.id)).toEqual(['a']);
  });

  test('a working profile is never hidden behind a dead copy of the same account', () => {
    const out = arrange([p('sys', { accountEmail: 'me@gmail.com', useSystemHome: true, status: 'needs-login' }), p('iso', { accountEmail: 'me@gmail.com' })]);
    expect(out.map((x) => x.id)).toEqual(['iso']);
  });

  test('selection moves to the survivor: the hidden selected id is in mergedProfileIds', () => {
    const out = arrange([p('sys', { accountEmail: 'me@gmail.com', useSystemHome: true }), p('chosen', { accountEmail: 'me@gmail.com' })], { claude: 'chosen' });
    expect(out.map((x) => x.id)).toEqual(['sys']);
    expect(out[0]!.mergedProfileIds).toContain('chosen');
  });

  test('different providers with the same e-mail are not folded', () => {
    const out = arrange([p('c1', { accountEmail: 'me@gmail.com' }), p('x1', { provider: 'codex', accountEmail: 'me@gmail.com' })]);
    expect(out.map((x) => x.id)).toEqual(['c1', 'x1']);
  });

  test('empty profiles (no e-mail) are not folded, and are numbered so they can be told apart', () => {
    const out = arrange([p('e1', { status: 'needs-login' }), p('e2', { status: 'needs-login' }), p('e3', { status: 'needs-login' })]);
    expect(out.map((x) => x.id)).toEqual(['e1', 'e2', 'e3']);
    expect(out.map((x) => x.displayLabel)).toEqual(['Claude Code (로그인 필요 1)', 'Claude Code (로그인 필요 2)', 'Claude Code (로그인 필요 3)']);
  });

  test('a single empty profile gets no number', () => {
    expect(arrange([p('e1', { status: 'needs-login' })])[0]!.displayLabel).toBe('Claude Code (로그인 필요)');
  });

  test('original order of the survivors is kept', () => {
    const out = arrange([p('a', { accountEmail: 'a@x.com' }), p('b', { accountEmail: 'b@x.com' }), p('a2', { accountEmail: 'a@x.com' })]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });

  test('the input list is not changed', () => {
    const list = [p('a', { accountEmail: 'me@gmail.com' }), p('b', { accountEmail: 'me@gmail.com' })];
    const before = JSON.stringify(list);
    arrange(list);
    expect(JSON.stringify(list)).toBe(before);
    expect(list[0]).not.toHaveProperty('displayLabel');
  });

  test('every entry carries a name built from the e-mail', () => {
    const out = arrange([p('sys', { accountEmail: 'me@gmail.com', useSystemHome: true }), p('x', { accountEmail: 'two@gmail.com' })]);
    expect(out.map((x) => x.displayLabel)).toEqual(['이 PC 로그인 · me@gmail.com', 'Claude Code · two@gmail.com']);
  });
});

describe('attachAgentAccounts: reads e-mails, then folds', () => {
  const view = (id: string, over: Record<string, unknown> = {}) => ({ id, provider: 'claude', status: 'ready' as const, loginIdentity: null as null | { email?: string; provider?: string }, ...over });

  test('e-mail comes from the reader; no token-looking field is added', async () => {
    const out = await attachAgentAccounts([view('a')], { readEmail: async () => 'me@gmail.com', providerLabel, preferredIds: {} });
    expect(out[0]!.accountEmail).toBe('me@gmail.com');
    expect(out[0]!.loginIdentity?.email).toBe('me@gmail.com');
    expect(Object.keys(out[0]!).sort()).toEqual(['accountEmail', 'displayLabel', 'id', 'loginIdentity', 'mergedProfileIds', 'provider', 'status']);
  });

  test('falls back to the older login identity e-mail (providers the reader does not know)', async () => {
    const out = await attachAgentAccounts([view('g', { provider: 'gemini', loginIdentity: { email: 'g@gmail.com' } })], { readEmail: async () => undefined, providerLabel, preferredIds: {} });
    expect(out[0]!.displayLabel).toBe('gemini · g@gmail.com');
  });

  test('a reader that throws leaves that profile without an e-mail instead of failing the list', async () => {
    const out = await attachAgentAccounts([view('a'), view('b')], {
      readEmail: async (v) => { if (v.id === 'a') throw new Error('disk'); return 'b@x.com'; },
      providerLabel,
      preferredIds: {},
    });
    expect(out.map((x) => x.accountEmail)).toEqual([undefined, 'b@x.com']);
  });

  test('same account in two profiles shows once', async () => {
    const out = await attachAgentAccounts([view('a', { useSystemHome: true }), view('b')], { readEmail: async () => 'me@gmail.com', providerLabel, preferredIds: {} });
    expect(out.map((x) => x.id)).toEqual(['a']);
  });
});

describe('screen helpers (pure, in agent-connect-state.js)', () => {
  const mod = createEsmLoader({ context: vm.createContext({}), stubs: {} }).load(path.join(root, 'electron/ui/modules/agent-connect-state.js'));

  test('agentSelectLabel prefers the name main built, then the e-mail, then the old label', () => {
    expect(mod.agentSelectLabel({ displayLabel: '이 PC 로그인 · me@gmail.com', label: 'Claude Code 구독 계정' })).toBe('이 PC 로그인 · me@gmail.com');
    expect(mod.agentSelectLabel({ loginIdentity: { email: 'me@gmail.com' }, label: 'old' })).toBe('me@gmail.com');
    expect(mod.agentSelectLabel({ label: 'old', id: 'x' })).toBe('old');
    expect(mod.agentSelectLabel(null)).toBe('');
  });

  test('findProfileByIdOrAlias: direct id, a merged id (selection follows), or nothing', () => {
    const profiles = [{ id: 'sys', mergedProfileIds: ['iso'] }, { id: 'other' }];
    expect(mod.findProfileByIdOrAlias(profiles, 'other')!.id).toBe('other');
    expect(mod.findProfileByIdOrAlias(profiles, 'iso')!.id).toBe('sys');
    expect(mod.findProfileByIdOrAlias(profiles, 'nope')).toBeNull();
    expect(mod.findProfileByIdOrAlias(profiles, '')).toBeNull();
  });

  test('the status signature changes when a name or a merge changes', () => {
    const base = () => ({ ok: true, profiles: [{ id: 'a', provider: 'claude', status: 'ready', displayLabel: 'Claude Code · a@x.com', mergedProfileIds: [] as string[] }] });
    const renamed = base(); renamed.profiles[0]!.displayLabel = 'Claude Code · b@x.com';
    const merged = base(); merged.profiles[0]!.mergedProfileIds = ['z'];
    expect(mod.agentStatusSignature(renamed)).not.toBe(mod.agentStatusSignature(base()));
    expect(mod.agentStatusSignature(merged)).not.toBe(mod.agentStatusSignature(base()));
  });
});

describe('wiring', () => {
  const mainTs = read('electron/main.ts');
  const mainJs = read('electron/main.js');
  const workshop = read('electron/ui/modules/codex-workshop.js');

  test('every handler that returns the profile list goes through the one async builder', () => {
    expect(mainTs).toContain('async function buildAgentProfileViews(');
    // the builder itself is the only place that maps profiles to views
    expect(mainTs.match(/\.map\(toAgentProfileView\)/g)).toHaveLength(1);
    expect(braceBlock(mainTs, 'async function buildAgentProfileViews(')).toContain('.map(toAgentProfileView)');
    const status = blockBetween(mainTs, "ipcMain.handle('agent-mode:get-status'", "ipcMain.handle('agent-mode:select-profile'");
    expect(status).toContain('await buildAgentProfileViews(');
    const list = blockBetween(mainTs, "ipcMain.handle('agent-mode:list-profiles'", "ipcMain.handle('agent-mode:create-profile'");
    expect(list).toContain('await buildAgentProfileViews(');
  });

  test('building the list never writes the preferred account (only select-profile does)', () => {
    const builder = blockBetween(mainTs, 'async function buildAgentProfileViews(', 'function isIgnoredAgentAuthPath(');
    expect(builder).not.toMatch(/rememberPreferredAgentProfile|writeFileSync|saveAgentProfiles/);
    expect(builder).toContain('agentAccountEmails.read(');
    const select = blockBetween(mainTs, "ipcMain.handle('agent-mode:select-profile'", "ipcMain.handle('agent-mode:list-profiles'");
    expect(select).toContain('rememberPreferredAgentProfile(profile)');
  });

  test('the single-profile view keeps its older sync identity path untouched', () => {
    expect(braceBlock(mainTs, 'function toAgentProfileView(')).toContain('extractAgentLoginIdentity(profile)');
  });

  test('compiled .js pairs exist and carry the change', () => {
    expect(mainJs).toContain('buildAgentProfileViews');
    for (const name of ['agent-account-identity', 'agent-account-list']) {
      expect(fs.existsSync(path.join(root, 'electron', `${name}.js`))).toBe(true);
    }
    expect(read('electron/agent-account-list.js')).toContain('arrangeAgentAccounts');
  });

  test('the dropdown and the profile lookup use the shared pure helpers', () => {
    expect(workshop).toContain("import { agentSelectLabel, findProfileByIdOrAlias } from './agent-connect-state.js';");
    expect(braceBlock(workshop, 'function buildAgentSelectLabel(')).toContain('agentSelectLabel(');
    expect(braceBlock(workshop, 'function getProfileById(')).toContain('findProfileByIdOrAlias(');
  });

  test('showing a merged selection does not store a preference (only setActiveAgentProfile does)', () => {
    const render = braceBlock(workshop, 'function renderSettingsProfileSelect(');
    expect(render).not.toContain('selectAgentProfile');
    expect(render).not.toContain('setActiveAgentProfile(');
  });
});

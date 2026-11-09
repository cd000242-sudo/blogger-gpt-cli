/**
 * "Install it?" is asked inside the app, not with the browser's confirm().
 *
 * Why: alert()/confirm() have opened BEHIND the app window before, and the app then looked frozen. The question
 * is now a small in-app modal (app-confirm-modal.js) that hands back a Promise. Only an explicit "yes" gives
 * true; cancel, Escape, a click outside, or a missing document all give false, so nothing gets installed by
 * accident. Main keeps refusing an install that does not carry `confirmed: true`.
 *
 * The modal is loaded as it is on disk and driven with a tiny fake DOM (no browser, no jsdom, no install).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { blockBetween } from './helpers/source-block';
import { createEsmLoader } from './helpers/esm-vm-loader';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

type Handler = (event: any) => void;

class FakeEl {
  children: FakeEl[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  listeners: Record<string, Handler[]> = {};
  textContent = '';
  id = '';
  className = '';
  type = '';
  focused = false;
  parent: FakeEl | null = null;
  constructor(public tag: string) {}
  setAttribute(name: string, value: unknown) { this.attrs[name] = String(value); }
  appendChild(child: FakeEl) { child.parent = this; this.children.push(child); return child; }
  addEventListener(type: string, fn: Handler) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type: string, fn: Handler) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  focus() { this.focused = true; }
  find(match: (el: FakeEl) => boolean): FakeEl | null {
    if (match(this)) return this;
    for (const child of this.children) {
      const hit = child.find(match);
      if (hit) return hit;
    }
    return null;
  }
}

class FakeDoc extends FakeEl {
  body = new FakeEl('body');
  head = new FakeEl('head');
  constructor() { super('#document'); }
  createElement(tag: string) { return new FakeEl(tag); }
  getElementById(id: string) { return this.body.find((el) => el.id === id); }
}

const fire = (el: FakeEl, type: string, extra: Record<string, unknown> = {}) => {
  for (const fn of [...(el.listeners[type] || [])]) fn({ target: el, preventDefault() {}, stopPropagation() {}, ...extra });
};

const context = vm.createContext({});
const loader = createEsmLoader({ context, stubs: {} });
const modal = loader.load(path.join(root, 'electron/ui/modules/app-confirm-modal.js'));
const flow = loader.load(path.join(root, 'electron/ui/modules/agent-connect-flow.js'));

/** Resolves with the answer, or 'pending' when nothing has settled it yet. */
const settled = (promise: Promise<boolean>) => Promise.race([promise, new Promise((r) => setTimeout(() => r('pending'), 15))]);

const ask = (doc: FakeDoc, over: Record<string, unknown> = {}) => modal.askAppConfirm({
  title: 'Codex 설치',
  message: 'Codex 를 설치할까요?',
  detail: '공식 설치 파일을 받아 이 PC 에 설치합니다.',
  confirmLabel: '설치',
  cancelLabel: '취소',
  doc,
  ...over,
});

describe('askAppConfirm - an in-app yes/no that hands back a Promise', () => {
  test('shows the title, the question, the detail and both buttons; the yes button has focus', async () => {
    const doc = new FakeDoc();
    const answer = ask(doc);
    expect(doc.getElementById('appConfirmOverlay')).not.toBeNull();
    expect(doc.getElementById('appConfirmTitle')!.textContent).toBe('Codex 설치');
    expect(doc.getElementById('appConfirmMessage')!.textContent).toBe('Codex 를 설치할까요?');
    expect(doc.getElementById('appConfirmDetail')!.textContent).toContain('공식 설치 파일');
    expect(doc.getElementById('appConfirmYes')!.textContent).toBe('설치');
    expect(doc.getElementById('appConfirmNo')!.textContent).toBe('취소');
    expect(doc.getElementById('appConfirmYes')!.focused).toBe(true);
    fire(doc.getElementById('appConfirmNo')!, 'click');
    await answer;
  });

  test('the yes button gives true and the modal is gone afterwards', async () => {
    const doc = new FakeDoc();
    const answer = ask(doc);
    fire(doc.getElementById('appConfirmYes')!, 'click');
    expect(await answer).toBe(true);
    expect(doc.getElementById('appConfirmOverlay')).toBeNull();
    expect(doc.listeners.keydown || []).toHaveLength(0);
  });

  test('the cancel button, Escape and a click on the dark backdrop all give false', async () => {
    const byButton = new FakeDoc();
    const a = ask(byButton);
    fire(byButton.getElementById('appConfirmNo')!, 'click');
    expect(await a).toBe(false);

    const byEscape = new FakeDoc();
    const b = ask(byEscape);
    for (const fn of byEscape.listeners.keydown || []) fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    expect(await b).toBe(false);
    expect(byEscape.getElementById('appConfirmOverlay')).toBeNull();

    const byBackdrop = new FakeDoc();
    const c = ask(byBackdrop);
    const overlay = byBackdrop.getElementById('appConfirmOverlay')!;
    fire(overlay, 'click', { target: overlay });
    expect(await c).toBe(false);
  });

  test('a click inside the card does not close it, and other keys do nothing', async () => {
    const doc = new FakeDoc();
    const answer = ask(doc);
    fire(doc.getElementById('appConfirmOverlay')!, 'click', { target: doc.getElementById('appConfirmMessage') });
    for (const fn of doc.listeners.keydown || []) fn({ key: 'a', preventDefault() {}, stopPropagation() {} });
    expect(await settled(answer)).toBe('pending');
    fire(doc.getElementById('appConfirmNo')!, 'click');
    expect(await answer).toBe(false);
  });

  test('no document means "no" - never an install by default', async () => {
    expect(await modal.askAppConfirm({ message: 'x', doc: null })).toBe(false);
    expect(await modal.askAppConfirm({ message: 'x' })).toBe(false);
  });

  test('a second question while one is open closes the first with "no" and shows only one modal', async () => {
    const doc = new FakeDoc();
    const first = ask(doc, { message: 'first?' });
    const second = ask(doc, { message: 'second?' });
    expect(await first).toBe(false);
    expect(doc.body.children.filter((el) => el.id === 'appConfirmOverlay')).toHaveLength(1);
    expect(doc.getElementById('appConfirmMessage')!.textContent).toBe('second?');
    fire(doc.getElementById('appConfirmYes')!, 'click');
    expect(await second).toBe(true);
  });

  test('text is shown as text (a name with markup is not turned into HTML)', async () => {
    const doc = new FakeDoc();
    const answer = ask(doc, { message: '<img src=x onerror=alert(1)> 를 설치할까요?', detail: '' });
    expect(doc.getElementById('appConfirmMessage')!.textContent).toBe('<img src=x onerror=alert(1)> 를 설치할까요?');
    expect(doc.getElementById('appConfirmDetail')).toBeNull();
    expect(read('electron/ui/modules/app-confirm-modal.js')).not.toContain('innerHTML');
    fire(doc.getElementById('appConfirmNo')!, 'click');
    await answer;
  });
});

describe('runAgentConnect - waits for the answer of an async confirmation', () => {
  const tool = { installed: false };
  const make = () => {
    const calls: string[] = [];
    const api = {
      loadStatus: jest.fn(async () => { calls.push('loadStatus'); return { tools: { codex: tool }, profiles: [] }; }),
      getProfile: jest.fn(() => null),
      ensureProfile: jest.fn(async () => null),
      checkLogin: jest.fn(async () => ({ ready: false })),
      installTool: jest.fn(async () => { calls.push('installTool'); return { ok: false, message: 'stop here' }; }),
      startLogin: jest.fn(async () => ({ ok: false })),
      verifyAnswer: jest.fn(async () => ({ ok: true })),
    };
    return { api, calls };
  };
  const run = (api: any, confirmInstall: () => unknown) => flow.runAgentConnect({
    provider: 'codex', label: 'Codex', api, confirmInstall, report: () => undefined, sleep: async () => undefined,
  });

  test('a Promise that resolves to false stops at step 2 and installs nothing', async () => {
    const { api, calls } = make();
    const result = await run(api, async () => false);
    expect(result).toMatchObject({ ok: false, step: 2 });
    expect(result.message).toContain('설치를 하지 않았습니다');
    expect(calls).not.toContain('installTool');
  });

  test('a Promise that resolves to true installs once', async () => {
    const { api, calls } = make();
    await run(api, async () => true);
    expect(calls.filter((c) => c === 'installTool')).toHaveLength(1);
  });

  test('a plain true / false still works', async () => {
    const no = make();
    await run(no.api, () => false);
    expect(no.calls).not.toContain('installTool');
    const yes = make();
    await run(yes.api, () => true);
    expect(yes.calls).toContain('installTool');
  });
});

describe('wiring - the install question is the in-app modal, never the browser confirm()', () => {
  const workshop = read('electron/ui/modules/codex-workshop.js');
  const mainTs = read('electron/main.ts');

  test('codex-workshop imports the modal and asks through it', () => {
    expect(workshop).toContain("import { askAppConfirm } from './app-confirm-modal.js';");
    const fn = blockBetween(workshop, 'async function confirmAgentInstall(', '\n/**');
    expect(fn).toContain('askAppConfirm(');
    expect(fn).toContain('설치할까요?');
    expect(fn).toContain('공식 설치 파일을 받아 이 PC 에 설치합니다');
  });

  test('the install question never calls the native confirm', () => {
    const fn = blockBetween(workshop, 'async function confirmAgentInstall(', '\n/**');
    expect(fn).not.toMatch(/window\.confirm\(|[^A-Za-z.]confirm\(/);
    const modalCode = read('electron/ui/modules/app-confirm-modal.js').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(modalCode).not.toMatch(/window\.confirm\(|[^A-Za-z.]confirm\(/);
  });

  test('every place that uses the answer as a yes/no waits for it', () => {
    const uses = workshop.split('\n').filter((line) => line.includes('confirmAgentInstall(') && !line.includes('function confirmAgentInstall('));
    expect(uses.length).toBeGreaterThanOrEqual(3);
    for (const line of uses) {
      // the connect flow hands the function over (the flow awaits it); the other two must await it themselves
      if (line.includes('confirmInstall:')) continue;
      expect(line).toContain('await confirmAgentInstall(');
    }
  });

  test('the connect flow source awaits the confirmation', () => {
    const flowSrc = read('electron/ui/modules/agent-connect-flow.js');
    expect(flowSrc).toContain('await confirmInstall()');
    expect(flowSrc).not.toMatch(/if \(!confirmInstall\(\)\)/);
  });

  test('main still refuses an install that does not carry the confirmation', () => {
    const handler = blockBetween(mainTs, "ipcMain.handle('agent-mode:install-tool'", "ipcMain.handle('agent-mode:verify-answer'");
    expect(handler).toContain('args?.confirmed !== true');
    expect(handler).toContain('needsConfirm: true');
    expect(workshop).toContain('confirmed: true');
  });
});

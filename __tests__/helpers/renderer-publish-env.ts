/**
 * A fake renderer (window/document/localStorage + fake IPC) that runs the REAL posting.js,
 * agent-force-publish.js and republish-queue-store.js. Only the Agent CLI run and the publish IPC are fakes.
 * Nothing here calls an agent CLI, a paid API, a browser or a publishing platform.
 */
import path from 'path';
import vm from 'vm';
import { createEsmLoader } from './esm-vm-loader';

const MODULES = path.join(process.cwd(), 'electron/ui/modules');

export function fakeElement(value = ''): any {
  const el: any = {
    value, checked: false, style: {}, innerHTML: '', textContent: '', dataset: {}, disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild() {}, remove() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [],
  };
  return el;
}

export interface EnvOptions {
  /** wait inside the fake Agent CLI run (ms) */
  agentDelayMs?: number;
  /** what the fake publish IPC answers */
  publishAnswer?: (call: number) => any;
}

export function createPublishEnv(options: EnvOptions = {}) {
  const listeners: Record<string, Function[]> = {};
  const appState: any = { isRunning: false, isCanceled: false, generatedContent: null };
  // Like the real form controls: <input type=text> drops line breaks, <textarea> turns CRLF into LF when read back
  const sanitizedElement = (sanitize: (text: string) => string) => {
    let stored = '';
    const el = fakeElement();
    Object.defineProperty(el, 'value', {
      get: () => stored,
      set: (next: unknown) => { stored = sanitize(String(next ?? '')); },
    });
    return el;
  };
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const elements: Record<string, any> = {
    keywordInput: sanitizedElement((text) => text.split(CR).join('').split(LF).join('')),
    userRequestNote: sanitizedElement((text) => text.split(CR + LF).join(LF).split(CR).join(LF)),
    contentMode: fakeElement('external'),
    publishBtn: fakeElement(),
  };
  const invokeCalls: Array<{ channel: string; args: any }> = [];
  const agentCalls: any[] = [];
  let publishCount = 0;

  const win: any = {
    addEventListener: (type: string, fn: Function) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: (type: string, fn: Function) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    dispatchEvent: (event: any) => { (listeners[event.type] || []).slice().forEach((fn) => fn(event)); return true; },
    electronAPI: {
      invoke: async (channel: string, args: any) => {
        invokeCalls.push({ channel, args });
        if (channel === 'publish-content') {
          publishCount += 1;
          return options.publishAnswer ? options.publishAnswer(publishCount) : { ok: true, url: `https://example.test/p${publishCount}` };
        }
        return { ok: true };
      },
    },
    blogger: { runPost: async () => { throw new Error('API path must not run in Agent mode'); } },
    _enforcePublishGap: async () => true,
    // Agent mode is chosen by the saved execution mode, exactly like the app
    localStorage: undefined as any,
  };
  const store: Record<string, string> = { leadernamExecutionMode: JSON.stringify('agent'), leadernamActiveAgentProvider: JSON.stringify('claude') };
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };

  // Same state contract as codex-workshop runAgentJob -> applyCodexResult (fills the generated-content slot)
  win.runAgentJobFromPosting = async (payload: any) => {
    agentCalls.push(payload);
    await new Promise((r) => setTimeout(r, options.agentDelayMs ?? 0));
    const jobId = `job-${agentCalls.length}`;
    if (!appState.generatedContent) appState.generatedContent = {};
    appState.generatedContent.title = `title of ${payload.topic}`;
    appState.generatedContent.content = '<h2>body</h2><p>text</p>';
    appState.generatedContent.thumbnailUrl = '';
    appState.generatedContent.payload = { ...payload, agentJobId: jobId, provider: 'codex-workshop', codexWorkshop: true, previewOnly: true };
    return { ok: true, title: appState.generatedContent.title, content: appState.generatedContent.content, jobId };
  };

  const document: any = {
    readyState: 'complete', body: fakeElement(), head: fakeElement(),
    getElementById: (id: string) => elements[id] || null,
    querySelector: () => null, querySelectorAll: () => [], createElement: () => fakeElement(),
    addEventListener() {}, removeEventListener() {},
  };
  const context: any = {
    window: win, document, localStorage, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math, Promise, Object, Array, String, Number, RegExp,
    CustomEvent: class { constructor(public type: string, public init: any = {}) { (this as any).detail = init.detail; } },
    Event: class { constructor(public type: string) {} },
    alert() {}, confirm: () => true,
  };
  win.localStorage = localStorage;
  vm.createContext(context);

  const noop = () => {};
  const stubs = {
    'core.js': {
      DOMCache: { get: (id: string) => elements[id] || null },
      getAppState: () => appState,
      getErrorHandler: () => ({ handle: noop, showToast: noop }),
      getStorageManager: () => ({ getSync: () => null }),
      ButtonStateManager: { setLoading: noop, restore: noop, setEnabled: noop },
      getProgressManager: () => ({ updateProgress: noop, updateStatus: noop }),
      addLog: noop, debugLog: noop, errorLog: noop, successLog: noop,
    },
    'ui.js': {
      showProgressModal: noop, hideProgressModal: noop, showTab: noop, showNotification: noop,
      setRunning: (running: boolean) => { appState.isRunning = running; },
    },
    'settings.js': { loadSettings: async () => ({}) },
    'calendar.js': { addTodayWorkRecord: noop },
    'utils.js': { getAllKeywords: () => [], getH2ImageSections: () => [] },
    'quality-report-modal.js': { showQualityReportModal: noop, accumulateQualityReport: noop },
  };
  const loader = createEsmLoader({ context, stubs });
  const posting = loader.load(path.join(MODULES, 'posting.js'));
  win.runPosting = posting.runPosting;
  win.publishToPlatform = posting.publishToPlatform;

  /** What publish-queue.js does before it hands one item to runPosting (applyItemToMainForm + overrides). */
  function prepareQueueItem(keyword: string, overrides: Record<string, unknown> = {}) {
    elements.keywordInput.value = keyword;
    elements.userRequestNote.value = String(overrides.userRequest || '');
    appState.generatedContent = null;
    win.__publishQueuePayloadOverrides = { topic: keyword, title: keyword, platform: 'blogger', postingMode: 'immediate', fromQueue: true, ...overrides };
  }

  /** Loads another real renderer module (e.g. multi-account-agent.js) into the same sandbox. */
  const loadModule = (file: string) => loader.load(path.join(MODULES, file));

  return { win, appState, elements, invokeCalls, agentCalls, prepareQueueItem, posting, context, loadModule };
}

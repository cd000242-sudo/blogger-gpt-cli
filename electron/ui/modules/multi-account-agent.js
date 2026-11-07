// multi-account-agent.js
// Agent-mode helpers for multi-account publishing (v3.8.769).
//
// In Agent mode the article is written by Claude Code / Codex through the SAME path as a single publish
// (window.runAgentJobFromPosting), then published with each account's own credentials (main: run-multi-account-post
// with `preGenerated`). Everything here takes `win` (and deps) as arguments so it can be exercised without a browser.

const AGENT_MODULE_MISSING = 'Agent 실행 모듈을 아직 준비하지 못했습니다. 앱을 다시 실행한 뒤 시도해주세요.';

// Account credentials must never reach the agent job folder (payload.json is readable by the agent CLI).
const ACCOUNT_SECRET_KEYS = [
  'googleClientId', 'googleClientSecret',
  'wordpressUsername', 'wordpressPassword',
];

function readStored(win, key, fallback) {
  try {
    const raw = win.localStorage && win.localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === '') return fallback;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch {
    return fallback;
  }
}

/** { mode: 'agent' | 'api', provider } - the app's own state function first, the saved values otherwise. */
export function readAgentExecutionState(win) {
  try {
    if (typeof win.getAgentExecutionState === 'function') {
      const state = win.getAgentExecutionState();
      if (state && (state.mode === 'agent' || state.mode === 'api')) {
        return { mode: state.mode, provider: String(state.provider || 'codex') };
      }
    }
  } catch { /* fall back to the saved values */ }
  return {
    mode: readStored(win, 'leadernamExecutionMode', 'api') === 'agent' ? 'agent' : 'api',
    provider: String(readStored(win, 'leadernamActiveAgentProvider', 'codex') || 'codex').toLowerCase(),
  };
}

/** A copy of the payload without account credentials (the original is left untouched). */
export function stripAccountSecrets(payload) {
  const copy = { ...payload };
  for (const key of ACCOUNT_SECRET_KEYS) delete copy[key];
  return copy;
}

/** Image engines the run will use (thumbnail per account, heading images unless switched off) - de-duplicated. */
export function collectAgentImageEngines(accounts, advanced) {
  const engines = [];
  const add = (value) => {
    const engine = String(value || '').trim();
    if (engine && !engines.includes(engine)) engines.push(engine);
  };
  const headingsOff = String((advanced && advanced.h2ImageMode) || '').toLowerCase() === 'none';
  for (const account of accounts) {
    const own = account && account.settings ? account.settings.imageSource : '';
    add(own || (advanced && (advanced.thumbnailSource || advanced.thumbnailType)));
    if (!headingsOff) add((advanced && advanced.h2ImageSource) || own);
  }
  return engines;
}

/**
 * Before the first account: Agent login + the image engines. Platforms are NOT checked here - every account has its
 * own credentials and the main process validates them per account. Not ready => { ok: false } and nothing starts.
 */
export async function verifyMultiAccountAgentReady(accounts, advanced, win) {
  if (readAgentExecutionState(win).mode !== 'agent') return { ok: true, skipped: true, message: '' };
  if (typeof win.verifyAgentExecutionReadiness !== 'function') {
    return { ok: false, message: 'Agent 실행 준비 모듈을 아직 준비하지 못했습니다. 앱을 다시 실행한 뒤 시도해주세요.' };
  }
  try {
    const readiness = await win.verifyAgentExecutionReadiness({
      showStatus: true,
      imageEngines: collectAgentImageEngines(accounts, advanced),
      skipPlatforms: true,
    });
    if (readiness && readiness.ready) return { ok: true, message: readiness.message || '' };
    const blocked = Array.isArray(readiness && readiness.checks)
      ? readiness.checks.filter((check) => !check.ready).map((check) => `${check.label}: ${check.detail}`).join(' / ')
      : '';
    return {
      ok: false,
      message: `Agent 실행 준비 확인 실패: ${blocked || (readiness && readiness.message) || '환경설정에서 바로 연동하기를 진행해주세요.'}`,
    };
  } catch (error) {
    return { ok: false, message: `Agent 실행 준비 확인 실패: ${(error && error.message) || error}` };
  }
}

/**
 * One article through the single-publish generation path. Returns what the main process needs to publish it:
 * the platform-prepared HTML the app stored (falls back to the raw output), the title and the thumbnail.
 * The app's "generated content" slot is emptied before and after - a leftover article would be mistaken for a
 * re-publish by the next account or the next single publish.
 */
export async function generateArticleWithAgent(payload, win, deps) {
  if (typeof win.runAgentJobFromPosting !== 'function') throw new Error(AGENT_MODULE_MISSING);
  const state = deps && typeof deps.getAppState === 'function' ? deps.getAppState() : null;
  if (state) state.generatedContent = null;
  const result = await win.runAgentJobFromPosting(payload);
  const generated = (state && state.generatedContent) || {};
  const html = String(generated.content || (result && (result.content || result.html)) || '').trim();
  if (!html) throw new Error('Agent 출력물이 비어 있습니다. 상세설정을 확인한 뒤 다시 시도해주세요.');
  const article = {
    title: String(generated.title || (result && result.title) || '').trim(),
    html,
    thumbnailUrl: String((result && result.thumbnailUrl) || generated.thumbnailUrl || '').trim(),
    jobId: String((result && result.jobId) || ''),
  };
  if (state) state.generatedContent = null;
  try {
    const modal = win.document && win.document.getElementById && win.document.getElementById('previewModal');
    if (modal && modal.style) modal.style.display = 'none';
  } catch { /* the preview modal is display only */ }
  return article;
}

/**
 * Agent mode runs one account at a time (one generation job at a time - a second would fail as already_running);
 * API mode keeps running the accounts together. A stop request ends the loop before the next account starts.
 */
export async function runAccountsInOrder(accounts, runOne, options) {
  if (!options || !options.agent) return Promise.all(accounts.map((account) => runOne(account)));
  const results = [];
  for (const account of accounts) {
    if (options.shouldStop && options.shouldStop()) break;
    results.push(await runOne(account));
  }
  return results;
}

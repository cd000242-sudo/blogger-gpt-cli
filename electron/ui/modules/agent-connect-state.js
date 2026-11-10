// agent-connect-state.js
// Pure rules for the AI connection screen (no DOM, no IPC), kept apart so they can be tested as they are on disk.
//
// agentStatusSignature: a short text that changes only when something the connection screen DRAWS changes.
// The screen asks main for the status often (after every click, every login poll). Comparing signatures lets
// it skip the redraw of three panels when the answer is the same as the one already on screen.

/** Everything the connection screen draws from the status, and nothing it does not (no timestamps, no paths). */
export function agentStatusSignature(status) {
  if (!status) return 'none';
  const tools = status.tools && typeof status.tools === 'object' ? status.tools : {};
  const toolPart = Object.keys(tools).sort().map((id) => {
    const tool = tools[id] || {};
    return [
      id,
      tool.installed ? 1 : 0,
      tool.usable === true ? 'o' : tool.usable === false ? 'x' : '-',
      tool.delayed ? 'd' : '',
      tool.upgradeRequired ? 'u' : '',
      tool.version || '',
    ].join(':');
  });
  const profiles = Array.isArray(status.profiles) ? status.profiles : [];
  const profilePart = profiles.map((profile) => [
    profile.id,
    profile.provider,
    profile.status,
    profile.useSystemHome ? 1 : 0,
    profile.authRejected ? 1 : 0,
    profile.label || '',
    profile.loginIdentity && profile.loginIdentity.email ? profile.loginIdentity.email : '',
    // v3.8.768: the account name main builds and the duplicates it folded away are both drawn by the dropdown
    profile.displayLabel || '',
    Array.isArray(profile.mergedProfileIds) ? profile.mergedProfileIds.join(',') : '',
  ].join(':'));
  return JSON.stringify([
    status.ok ? 1 : 0,
    status.allowed ? 1 : 0,
    status.mode || '',
    status.currentName || '',
    status.requiredName || '',
    status.message || '',
    toolPart,
    profilePart,
  ]);
}

// ---- account dropdown (v3.8.768) -----------------------------------------------------------------------------

/**
 * Text of one dropdown entry. Main builds displayLabel from the real account e-mail ("이 PC 로그인 · me@gmail.com").
 * Older payloads without it fall back to the e-mail, then to the stored label.
 */
export function agentSelectLabel(profile) {
  if (!profile) return '';
  if (profile.displayLabel) return profile.displayLabel;
  const identity = profile.loginIdentity;
  if (identity && identity.email) return identity.email;
  return profile.label || profile.id || profile.provider || '';
}

/**
 * Finds a listed profile by id. An id that main folded into another profile of the same account (mergedProfileIds)
 * finds the profile that is still listed, so a remembered choice follows the account instead of vanishing.
 * Only looks; it never stores a preference.
 */
export function findProfileByIdOrAlias(profiles, id) {
  if (!id || !Array.isArray(profiles)) return null;
  const direct = profiles.find((profile) => profile && profile.id === id);
  if (direct) return direct;
  return profiles.find((profile) => profile && Array.isArray(profile.mergedProfileIds) && profile.mergedProfileIds.includes(id)) || null;
}

// ---- one engine = one status line + one button -------------------------------------------------------------

/**
 * Which of four states an engine is in, from what the screen already knows.
 *   install  - the program is not on this PC
 *   upgrade  - the program is there but a run was stopped because it needs a newer version (asked before upgrading)
 *   delayed  - the program is there but its check did not finish (slow PC, busy): nothing is known to be wrong
 *   login    - installed, but no working login
 *   ready    - installed and logged in
 *   checking - the status has not arrived yet
 * `check` is the latest verified login result (optional): a delayed or rejected one overrides a stale "ready".
 */
export function classifyAgentConnect({ tool, profile, check } = {}) {
  if (!tool) return 'checking';
  if (!tool.installed) return 'install';
  // A run was stopped because this program is too old: that is known, so it comes before "slow" and "ready".
  if (tool.upgradeRequired) return 'upgrade';
  if (tool.usable === false || tool.delayed) return 'delayed';
  if (check && check.ready !== true) {
    if (check.delayed) return 'delayed';
    if (check.authRequired) return 'login';
  }
  if (profile && profile.status === 'ready' && !profile.authRejected) return 'ready';
  return 'login';
}

const CONNECT_COPY = {
  ready: { text: '연결됨', tone: 'ok', button: '연결 확인' },
  delayed: { text: '확인 지연 — 로그인은 그대로 유지됩니다', tone: 'warn', button: '다시 확인' },
  login: { text: '로그인 필요', tone: 'bad', button: '연결하기' },
  install: { text: '설치 필요', tone: 'bad', button: '연결하기' },
  upgrade: { text: '업그레이드 필요', tone: 'warn', button: '업그레이드' },
  checking: { text: '확인 중…', tone: 'muted', button: '연결하기' },
};

/** Short, plain wording for the screen: the status line and the label of the one button. */
export function describeAgentConnect(kind, label) {
  const copy = CONNECT_COPY[kind] || CONNECT_COPY.checking;
  return { kind: CONNECT_COPY[kind] ? kind : 'checking', line: `${label} · ${copy.text}`, tone: copy.tone, buttonLabel: copy.button, disabled: kind === 'checking' };
}

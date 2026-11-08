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

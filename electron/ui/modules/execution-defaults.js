// execution-defaults.js
// New-install default (decided 2026-11-07): articles are written by Agent mode with Claude Code.
// Runs once, before the other scripts read these keys. A value the user already saved is never touched:
// a missing mode key seeds the mode, and a missing provider key seeds the provider, independently.
// The format is JSON.stringify(value), the same format codex-workshop.js (storage.setSync) writes and every reader parses.
(function seedExecutionDefaults() {
  try {
    var store = window.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    if (store.getItem('leadernamExecutionMode') === null) {
      store.setItem('leadernamExecutionMode', JSON.stringify('agent'));
    }
    if (store.getItem('leadernamActiveAgentProvider') === null) {
      store.setItem('leadernamActiveAgentProvider', JSON.stringify('claude'));
    }
  } catch (error) {
    // Storage can be blocked; the readers' own fallbacks then apply.
  }
})();

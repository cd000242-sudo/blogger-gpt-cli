// src/core/codex-image/codexImageReadiness.ts
// Decides, from facts the Electron main process collects, whether the Codex image engine can start.
// Pure on purpose: the main process knows where the CLI is and which login folder exists; this file only judges.
// It never reads a login file's content (existence only is passed in).

import { buildCodexImageFailure, type CodexImageError } from './codexImageErrors';

export interface CodexReadinessFacts {
  /** The codex executable was found. */
  installed: boolean;
  /** `codex --version` ran. */
  usable: boolean;
  /** Why it could not run (CLI words), when it could not. */
  binaryError?: string | undefined;
  /** The PC login file exists in the login folder (~/.codex or %CODEX_HOME%). Existence only, never its content. */
  loginFilePresent: boolean;
  /** The app's record of the PC login: 'needs-login' means the server rejected it and nothing has changed since. */
  systemProfileStatus?: 'ready' | 'needs-login' | 'unknown' | undefined;
}

/** null = ready. Otherwise a Korean-worded error that says what to connect and that no other engine was used. */
export function assessCodexImageReadiness(facts: CodexReadinessFacts): CodexImageError | null {
  if (!facts.installed) return buildCodexImageFailure('not_installed', '');
  if (!facts.usable) {
    const detail = facts.binaryError ?? '';
    return /update|upgrade|version/i.test(detail)
      ? buildCodexImageFailure('update_required', detail)
      : buildCodexImageFailure('nonzero_exit', detail || 'Codex CLI 실행 확인에 실패했습니다.');
  }
  if (!facts.loginFilePresent) return buildCodexImageFailure('not_logged_in', '');
  if (facts.systemProfileStatus === 'needs-login') return buildCodexImageFailure('not_logged_in', '');
  return null;
}

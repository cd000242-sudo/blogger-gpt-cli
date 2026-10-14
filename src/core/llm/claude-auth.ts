import { loadEnvFromFile } from '../../env';

export const CLAUDE_WORKSPACE_GUIDE = 'Claude 작업공간(Workspace) 설정을 확인해 주세요. Claude Console → Settings → Workspaces의 ID(wrkspc_...)를 앱 설정의 Claude Workspace ID에 입력하고 저장하세요. 해당 키의 사용자·서비스 계정에 작업공간 접근 권한이 있어야 합니다. 작업공간이 지정된 전용 API 키는 이 설정을 생략할 수 있습니다.';

export interface ClaudeAuthOptions {
  /** An explicitly supplied empty string deliberately omits the workspace header. */
  workspaceId?: string;
  /** Explicit env isolates callers/tests from persisted machine settings. */
  env?: Record<string, unknown>;
}

export function resolveClaudeWorkspaceId(options: ClaudeAuthOptions = {}): string {
  let value: unknown = options.workspaceId;
  if (value === undefined) {
    let saved: Record<string, unknown> = {};
    if (options.env) saved = options.env;
    else {
      try { saved = loadEnvFromFile(); } catch { /* process environment remains available */ }
    }
    const sources = options.env ? [saved] : [saved, process.env];
    for (const source of sources) {
      // The settings writer persists an empty canonical value when the user clears
      // this field. Do not resurrect an older process environment value afterward.
      if (Object.prototype.hasOwnProperty.call(source, 'ANTHROPIC_WORKSPACE_ID')
        && source['ANTHROPIC_WORKSPACE_ID'] === '') { value = ''; break; }
      for (const key of ['claudeWorkspaceId', 'ANTHROPIC_WORKSPACE_ID', 'CLAUDE_WORKSPACE_ID']) {
        const candidate = source[key];
        if (typeof candidate === 'string' && candidate.trim()) { value = candidate; break; }
      }
      if (value !== undefined) break;
    }
  }
  const id = String(value ?? '').trim();
  if (id && !/^wrkspc_[A-Za-z0-9]{8,128}$/.test(id)) {
    throw new Error(`CLAUDE_WORKSPACE_INVALID: Workspace ID 형식이 올바르지 않습니다. ${CLAUDE_WORKSPACE_GUIDE}`);
  }
  return id;
}

export function buildClaudeHeaders(apiKey: string, options: ClaudeAuthOptions = {}): Record<string, string> {
  const workspaceId = resolveClaudeWorkspaceId(options);
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
    ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
  };
}

export function isClaudeWorkspaceError(error: unknown): boolean {
  const e = error as any;
  const message = [typeof error === 'string' ? error : e?.message, e?.response?.data?.error?.message, e?.error?.message].filter(Boolean).join(' ');
  return /CLAUDE_WORKSPACE_|anthropic-workspace-id|workspace[^\n]*(?:not found|invalid|required|access|permission)/i.test(message);
}

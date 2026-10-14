import { buildClaudeHeaders, CLAUDE_WORKSPACE_GUIDE, isClaudeWorkspaceError } from './claude-auth';

/** Check authentication without generating tokens or charging for a message. */
export async function validateClaudeConnection(apiKey: string, workspaceId: string) {
  if (!apiKey.trim()) return { success: false, message: 'Claude API 키를 입력해 주세요.' };
  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: buildClaudeHeaders(apiKey.trim(), { workspaceId: workspaceId.trim() }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      return { success: true, message: 'Claude API 연결을 확인했습니다. 글 생성 비용은 발생하지 않았습니다.' };
    }
    const body: any = await response.json().catch(() => ({}));
    const detail = String(body?.error?.message || '');
    if (isClaudeWorkspaceError(detail)) return { success: false, message: CLAUDE_WORKSPACE_GUIDE };
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Claude API 키와 선택한 작업공간의 접근 권한을 확인해 주세요.' };
    }
    return { success: false, message: `Claude 연결 확인 실패 (HTTP ${response.status}). 잠시 후 다시 확인해 주세요.` };
  } catch (error: any) {
    return { success: false, message: isClaudeWorkspaceError(error)
      ? CLAUDE_WORKSPACE_GUIDE : 'Claude 연결 확인에 실패했습니다. 네트워크 연결과 작업공간 ID 형식을 확인해 주세요.' };
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_WORKSPACE_GUIDE = void 0;
exports.resolveClaudeWorkspaceId = resolveClaudeWorkspaceId;
exports.buildClaudeHeaders = buildClaudeHeaders;
exports.isClaudeWorkspaceError = isClaudeWorkspaceError;
const env_1 = require("../../env");
exports.CLAUDE_WORKSPACE_GUIDE = 'Claude 작업공간(Workspace) 설정을 확인해 주세요. Claude Console → Settings → Workspaces의 ID(wrkspc_...)를 앱 설정의 Claude Workspace ID에 입력하고 저장하세요. 해당 키의 사용자·서비스 계정에 작업공간 접근 권한이 있어야 합니다. 작업공간이 지정된 전용 API 키는 이 설정을 생략할 수 있습니다.';
function resolveClaudeWorkspaceId(options = {}) {
    let value = options.workspaceId;
    if (value === undefined) {
        let saved = {};
        if (options.env)
            saved = options.env;
        else {
            try {
                saved = (0, env_1.loadEnvFromFile)();
            }
            catch { }
        }
        const sources = options.env ? [saved] : [saved, process.env];
        for (const source of sources) {
            if (Object.prototype.hasOwnProperty.call(source, 'ANTHROPIC_WORKSPACE_ID')
                && source['ANTHROPIC_WORKSPACE_ID'] === '') {
                value = '';
                break;
            }
            for (const key of ['claudeWorkspaceId', 'ANTHROPIC_WORKSPACE_ID', 'CLAUDE_WORKSPACE_ID']) {
                const candidate = source[key];
                if (typeof candidate === 'string' && candidate.trim()) {
                    value = candidate;
                    break;
                }
            }
            if (value !== undefined)
                break;
        }
    }
    const id = String(value ?? '').trim();
    if (id && !/^wrkspc_[A-Za-z0-9]{8,128}$/.test(id)) {
        throw new Error(`CLAUDE_WORKSPACE_INVALID: Workspace ID 형식이 올바르지 않습니다. ${exports.CLAUDE_WORKSPACE_GUIDE}`);
    }
    return id;
}
function buildClaudeHeaders(apiKey, options = {}) {
    const workspaceId = resolveClaudeWorkspaceId(options);
    return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    };
}
function isClaudeWorkspaceError(error) {
    const e = error;
    const message = [typeof error === 'string' ? error : e?.message, e?.response?.data?.error?.message, e?.error?.message].filter(Boolean).join(' ');
    return /CLAUDE_WORKSPACE_|anthropic-workspace-id|workspace[^\n]*(?:not found|invalid|required|access|permission)/i.test(message);
}
//# sourceMappingURL=claude-auth.js.map
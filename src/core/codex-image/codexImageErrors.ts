// src/core/codex-image/codexImageErrors.ts
// Typed, Korean-worded failures of the Codex subscription image engine. The engine never switches to another
// (paid) engine on its own, so every message says what to do and that nothing else was used instead.

export type CodexImageErrorCode =
  | 'not_installed'
  | 'not_logged_in'
  | 'update_required'
  | 'rate_limited'
  | 'model_unavailable'
  | 'timeout'
  | 'aborted'
  | 'empty_output'
  | 'nonzero_exit';

/** Failures that repeat for every session of this PC login: starting more sessions only burns time. */
export const ACCOUNT_LEVEL_CODES: ReadonlySet<CodexImageErrorCode> = new Set<CodexImageErrorCode>([
  'not_installed', 'not_logged_in', 'update_required', 'rate_limited', 'model_unavailable',
]);

export const CODEX_IMAGE_CONNECT_MESSAGE = 'Codex 구독 이미지는 Codex 연결이 필요합니다 — 설정에서 [Agent 계정 연결]';
const NO_SWITCH = '다른 이미지 엔진으로 바꾸지 않았습니다.';

export class CodexImageError extends Error {
  readonly code: CodexImageErrorCode;
  readonly detail: string | undefined;

  constructor(code: CodexImageErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'CodexImageError';
    this.code = code;
    this.detail = detail;
  }
}

const LOGGED_OUT = /invalid_refresh_token|refresh token|not logged in|please (log|sign) ?in|log in again|unauthori[sz]ed|\b401\b|authentication/i;
const LIMIT_REACHED = /usage limit|rate.?limit|too many requests|\b429\b|limit (has been )?reached|exceeded your|quota/i;
const NEEDS_UPDATE = /upgrade|update (is )?required|newer version|unsupported (cli )?version/i;
const MODEL_GONE = /model[^\n]{0,80}(not found|unavailable|not supported|does not exist|not available)|unknown model/i;
const NOT_INSTALLED = /ENOENT|not recognized as|command not found|cannot find the (file|path)/i;

/** Reads the CLI's own words (stderr / error events) and decides which kind of failure this was. */
export function classifyCodexImageFailure(text: string): CodexImageErrorCode {
  const body = String(text ?? '');
  if (LOGGED_OUT.test(body)) return 'not_logged_in';
  if (LIMIT_REACHED.test(body)) return 'rate_limited';
  if (NEEDS_UPDATE.test(body)) return 'update_required';
  if (MODEL_GONE.test(body)) return 'model_unavailable';
  if (NOT_INSTALLED.test(body)) return 'not_installed';
  return 'nonzero_exit';
}

export function buildCodexImageFailure(code: CodexImageErrorCode, detail: string, model?: string): CodexImageError {
  const tail = String(detail ?? '').trim().slice(-400);
  switch (code) {
    case 'not_installed':
      return new CodexImageError(code, `${CODEX_IMAGE_CONNECT_MESSAGE}. Codex CLI 가 설치되어 있지 않습니다. ${NO_SWITCH}`, tail);
    case 'not_logged_in':
      return new CodexImageError(code, `${CODEX_IMAGE_CONNECT_MESSAGE}. ChatGPT 구독 로그인이 필요합니다(로그인이 만료됐을 수 있습니다). ${NO_SWITCH}`, tail);
    case 'update_required':
      return new CodexImageError(code, `${CODEX_IMAGE_CONNECT_MESSAGE}. Codex CLI 업데이트가 필요합니다. ${NO_SWITCH}`, tail);
    case 'rate_limited':
      return new CodexImageError(code, `Codex 구독 이미지를 지금은 쓸 수 없습니다 — 구독 사용 한도에 도달했습니다. 한도가 풀린 뒤 다시 시도해 주세요. ${NO_SWITCH}`, tail);
    case 'model_unavailable':
      return new CodexImageError(code, `Codex 구독 이미지 모델(${model || '기본'})을 이 계정에서 쓸 수 없습니다. ${NO_SWITCH}`, tail);
    case 'timeout':
      return new CodexImageError(code, `Codex 구독 이미지 생성이 제한 시간 안에 끝나지 않았습니다. 같은 요청은 다시 보내지 않았습니다. ${NO_SWITCH}`, tail);
    case 'aborted':
      return new CodexImageError(code, 'Codex 구독 이미지 생성을 중지했습니다.', tail);
    case 'empty_output':
      return new CodexImageError(code, `Codex 구독 이미지: 이미지 파일을 받지 못했습니다. ${NO_SWITCH}`, tail);
    default:
      return new CodexImageError('nonzero_exit', `Codex 구독 이미지 실행이 실패했습니다. ${tail ? `(${tail.slice(-160)}) ` : ''}${NO_SWITCH}`, tail);
  }
}

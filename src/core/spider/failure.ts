/**
 * Failure response for the spider post handler: { success:false, error, stage }.
 * The text names the failed stage, a one-line cause, and what the user should do. No key/token value is ever included.
 */
import type { SpiderEngineMode } from './engine';

export type SpiderStage = 'prepare' | 'engine' | 'generate' | 'image' | 'meta' | 'finalize' | 'title';

export const SPIDER_STAGE_LABELS: Record<SpiderStage, string> = {
  prepare: '원본 글 준비',
  engine: '엔진 확인',
  generate: '글 생성',
  image: '이미지',
  meta: '태그/메타',
  finalize: '글 마무리',
  title: '제목',
};

export interface SpiderFailure {
  success: false;
  error: string;
  stage: SpiderStage;
}

/** Mask anything that looks like a key or token before it can reach a message or a log. */
export function redactSecrets(text: unknown): string {
  return String(text ?? '')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '***')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, '***')
    .replace(/\bya29\.[0-9A-Za-z._-]+/g, '***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer ***')
    // `key=value`, `key: value`, and the JSON/JS-object forms `"key":"value"` / `'key': 'value'` (closing quote after the key name)
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)["']?\s*[=:]\s*)(["']?)[^\s"'&,;]{6,}/gi, '$1$2***')
    .replace(/([?&]key=)[^&\s]+/gi, '$1***')
    .replace(/[A-Za-z0-9_-]{48,}/g, '***');
}

function summarizeCause(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : cause == null ? '' : String(cause);
  const firstLine = redactSecrets(raw).split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
  if (!firstLine) return '알 수 없는 오류';
  return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine;
}

function looksLikeGeminiAuthError(cause: unknown): boolean {
  const raw = cause instanceof Error ? cause.message : String(cause ?? '');
  return /\b403\b|API Key|API 키|unregistered callers/i.test(raw);
}

function nextStep(stage: SpiderStage, mode: SpiderEngineMode, engineName: string, authProblem: boolean): string {
  // Only for the stages where Gemini itself is called; a 403 from an image host or a publisher is not a Gemini key problem
  if (mode === 'api' && authProblem && (stage === 'engine' || stage === 'generate')) return '설정 탭의 Gemini API 키가 맞는지 확인한 뒤 다시 시도해 주세요.';
  switch (stage) {
    case 'engine':
      return mode === 'agent'
        ? `설정에서 ${engineName} 연결(로그인·사용 권한)을 확인한 뒤 다시 시도해 주세요.`
        : '설정 탭의 Gemini API 키와 사용할 수 있는 모델을 확인한 뒤 다시 시도해 주세요.';
    case 'image':
      return '이미지 엔진 로그인·키를 확인한 뒤 다시 시도해 주세요.';
    case 'meta':
    case 'finalize':
      return '다시 시도해 주세요. 반복되면 이 단계 이름과 함께 알려 주세요.';
    default:
      return `다시 시도해 주세요. 반복되면 설정에서 선택한 엔진(${engineName})을 확인해 주세요.`;
  }
}

export function buildSpiderFailure(input: {
  stage: SpiderStage;
  cause: unknown;
  mode: SpiderEngineMode;
  providerLabel?: string;
}): SpiderFailure {
  const engineName = input.mode === 'agent' ? (input.providerLabel || '선택한 에이전트') : 'Gemini API';
  const authProblem = looksLikeGeminiAuthError(input.cause);
  const label = SPIDER_STAGE_LABELS[input.stage] || input.stage;
  const error = [
    `통합글 만들기가 [${label}] 단계에서 멈췄습니다. 글은 발행하지 않았습니다.`,
    `원인: ${summarizeCause(input.cause)}`,
    `할 일: ${nextStep(input.stage, input.mode, engineName, authProblem)}`,
  ].join('\n');
  return { success: false, error, stage: input.stage };
}

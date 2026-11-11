/**
 * Spider (cornerstone) post — which engine writes it, and what counts as an Agent answer.
 *
 * Rule: the engine the user picked is the engine that runs. Nothing here switches to another
 * engine or to a template. A failure is reported by `failure.ts`, never papered over.
 */

export type SpiderEngineMode = 'agent' | 'api';

export interface SpiderEngineDecision {
  mode: SpiderEngineMode;
  /** true only when Gemini itself writes the post (API mode). Agent mode never touches Gemini. */
  usesGemini: boolean;
}

/** Same rule the handler always used: only the exact value 'agent' selects the Agent CLI. */
export function decideSpiderEngine(payload: { executionMode?: unknown } | null | undefined): SpiderEngineDecision {
  const raw = payload && typeof payload === 'object' ? payload.executionMode : undefined;
  return raw === 'agent' ? { mode: 'agent', usesGemini: false } : { mode: 'api', usesGemini: true };
}

/** An Agent answer shorter than this is treated as "no answer" (same threshold as before). */
export const SPIDER_AGENT_MIN_CHARS = 500;

export type SpiderAgentVerdict =
  | { ok: true; content: string }
  | { ok: false; reason: 'empty' | 'short'; length: number };

export function judgeSpiderAgentContent(raw: unknown): SpiderAgentVerdict {
  const content = typeof raw === 'string' ? raw.trim() : '';
  if (!content) return { ok: false, reason: 'empty', length: 0 };
  if (content.length < SPIDER_AGENT_MIN_CHARS) return { ok: false, reason: 'short', length: content.length };
  return { ok: true, content };
}

export interface SpiderAgentRunFlags {
  timedOut?: boolean;
  canceled?: boolean;
}

/** User-facing cause when the Agent CLI gave back nothing usable. Names the engine, never mentions a fallback. */
export function spiderAgentNoContentMessage(providerLabel: string, length: number, flags: SpiderAgentRunFlags = {}): string {
  const who = providerLabel || '선택한 에이전트';
  if (flags.canceled) return `${who} 작업이 중지되어 글을 돌려주지 않았습니다.`;
  if (flags.timedOut) return `${who}가 글을 돌려주지 않았습니다 (제한 시간 안에 끝나지 않았습니다, 받은 글자 ${length}자).`;
  return `${who}가 글을 돌려주지 않았습니다 (받은 글자 ${length}자, 최소 ${SPIDER_AGENT_MIN_CHARS}자 필요).`;
}

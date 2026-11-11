/**
 * Spider post — what to do with an Agent run's result and with a short draft.
 *
 * Rules (owner decisions):
 *  - An Agent run that was stopped by the user or hit the time limit never counts as a result, however long
 *    article.html looks. It is a failure and nothing is published.
 *  - Body length is not a criterion: in Agent mode a short draft is NOT regenerated (a run can take 25 minutes),
 *    it only gets a warning. API mode keeps its automatic retry, but a failed retry never destroys the draft
 *    that was already good ("an optional step must not destroy the result").
 */
import { judgeSpiderAgentContent, spiderAgentNoContentMessage, type SpiderEngineMode } from './engine';
import { checkSpiderBody, spiderPlainTextLength } from './title';
import { redactSecrets } from './failure';

export interface SpiderAgentRunState {
  canceled?: boolean;
  timedOut?: boolean;
}

export type SpiderAgentRunVerdict =
  | { ok: true; content: string }
  | { ok: false; reason: 'canceled' | 'timedOut' | 'empty' | 'short'; error: string };

/** Judge the finished Agent process together with the text it left behind. canceled > timedOut > text. */
export function judgeSpiderAgentRun(
  run: SpiderAgentRunState,
  rawContent: unknown,
  ctx: { providerLabel: string; timeoutMinutes: number },
): SpiderAgentRunVerdict {
  const who = ctx.providerLabel || '선택한 에이전트';
  if (run.canceled) {
    return { ok: false, reason: 'canceled', error: `${who} 작업을 사용자가 중지해 글이 끝까지 써지지 않았습니다.` };
  }
  if (run.timedOut) {
    return { ok: false, reason: 'timedOut', error: `${who} 작업이 제한 시간(${ctx.timeoutMinutes}분)을 넘겨 글이 끝까지 써지지 않았습니다.` };
  }
  const verdict = judgeSpiderAgentContent(rawContent);
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason, error: spiderAgentNoContentMessage(who, verdict.length, {}) };
  }
  return { ok: true, content: verdict.content };
}

export const SPIDER_RETRY_MIN_PLAIN_CHARS = 3000;
export const SPIDER_RETRY_MIN_H2 = 3;
export const SPIDER_MAX_RETRIES = 2;

/** Same measuring as the old inline code: tags stripped, whitespace collapsed. */
export function measureSpiderDraft(html: string): { plainLen: number; h2Count: number } {
  return {
    plainLen: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length,
    h2Count: (html.match(/<h2[^>]*>/gi) || []).length,
  };
}

export function shouldRetrySpiderGeneration(input: {
  mode: SpiderEngineMode;
  plainLen: number;
  h2Count: number;
  retriesDone: number;
}): boolean {
  if (input.mode === 'agent') return false;
  if (input.retriesDone >= SPIDER_MAX_RETRIES) return false;
  return input.plainLen < SPIDER_RETRY_MIN_PLAIN_CHARS || input.h2Count < SPIDER_RETRY_MIN_H2;
}

export const SPIDER_RETRY_SHORTER_WARNING = '재시도 결과가 직전 글보다 더 짧아 직전 글을 사용했습니다.';

/**
 * A retry may replace the draft only with something usable and not shorter than what we already have;
 * otherwise the previous draft stays. `warning` is set only when a usable-but-shorter retry was turned down.
 */
export function chooseSpiderDraft(previous: string, retried: string | null): { draft: string; kept: boolean; warning?: string } {
  if (retried == null || !retried.trim()) return { draft: previous, kept: true };
  if (!checkSpiderBody(retried).ok && checkSpiderBody(previous).ok) return { draft: previous, kept: true };
  if (spiderPlainTextLength(retried) < spiderPlainTextLength(previous)) {
    return { draft: previous, kept: true, warning: SPIDER_RETRY_SHORTER_WARNING };
  }
  return { draft: retried, kept: false };
}

export interface SpiderDraftLoopResult {
  draft: string;
  plainLen: number;
  h2Count: number;
  retries: number;
  warnings: string[];
}

export async function runSpiderDraftLoop(input: {
  mode: SpiderEngineMode;
  first: string;
  /** Called with the retry number (1, 2). Only API mode ever gets here. */
  regenerate: (attempt: number) => Promise<string>;
  log: (message: string) => void;
}): Promise<SpiderDraftLoopResult> {
  let draft = input.first;
  let measured = measureSpiderDraft(draft);
  let retries = 0;
  const warnings: string[] = [];
  while (shouldRetrySpiderGeneration({ mode: input.mode, ...measured, retriesDone: retries })) {
    retries += 1;
    input.log(`⚠️ 본문 너무 짧음 (평문 ${measured.plainLen}자, H2 ${measured.h2Count}개) — ${retries}/${SPIDER_MAX_RETRIES} 재시도`);
    let retried: string | null = null;
    try {
      retried = await input.regenerate(retries);
    } catch (error) {
      input.log(`⚠️ 재시도 ${retries} 실패 — 직전 초안으로 진행: ${redactSecrets(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
    const pick = chooseSpiderDraft(draft, retried);
    draft = pick.draft;
    measured = measureSpiderDraft(draft);
    if (pick.kept) {
      warnings.push(pick.warning ?? '재시도에 실패해 직전 초안으로 진행했습니다.');
      break; // the same failure would just repeat
    }
    input.log(`📏 재시도 ${retries} 응답: ${draft.length}자 (평문 ${measured.plainLen}자, H2 ${measured.h2Count}개)`);
  }
  if (measured.plainLen < SPIDER_RETRY_MIN_PLAIN_CHARS || measured.h2Count < SPIDER_RETRY_MIN_H2) {
    const note = `본문이 짧습니다 (평문 ${measured.plainLen}자, H2 ${measured.h2Count}개). 길이는 발행 기준이 아니어서 이 글로 진행합니다. 발행 전 내용을 확인해 주세요.`;
    warnings.push(note);
    input.log(`⚠️ ${note}`);
  }
  return { draft, plainLen: measured.plainLen, h2Count: measured.h2Count, retries, warnings };
}

/**
 * 💰 이 글 한 편에 얼마 들었나 (v3.8.650)
 *
 * ## 왜 만들었나
 * 사장님: "한편당 얼마니 10편하면 5달러면 충분해?"
 *
 * 답을 할 수가 없었다. **지금까지 한 편에 얼마인지 아무도 몰랐다.**
 * provider 응답에 `usage` 가 들어오는데 그냥 버리고 있었기 때문이다.
 *
 * ## 무엇을 세나
 *   · 성공한 호출의 입력·출력 토큰 (응답의 usage 그대로)
 *   · **실패한 호출의 입력 토큰** — 응답이 없어도 요청은 이미 돈이다.
 *     실측 2026-09-05: 10편 중 4편이 엔진 문제로 죽었는데 그 비용이 빠져 있었다.
 *
 * ## 원칙
 * 단가는 pricing.ts 의 `usdPer1M` 만 쓴다 — 그 파일 규칙이 "확인된 모델만 채운다" 이므로,
 * 단가를 모르는 모델은 **비용을 지어내지 않고 모른다고 한다.**
 */

import { findTier } from './pricing';

export interface UsageTally {
  calls: number;
  failedCalls?: number;
  input: number;
  output: number;
  byModel?: Record<string, { calls: number; input: number; output: number }>;
}

export interface CostEstimate {
  usd: number;
  /** 단가를 모르는 모델이 섞였으면 그 목록 — 이때 usd 는 아랫값이다 */
  unpriced: string[];
  calls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
}

/** 지금까지 쌓인 사용량 (없으면 빈 값) */
export function readUsage(): UsageTally {
  const g: any = globalThis as any;
  const u = g.__llmUsage;
  if (!u) return { calls: 0, failedCalls: 0, input: 0, output: 0, byModel: {} };
  return u as UsageTally;
}

/** 글 한 편을 시작할 때 장부를 비운다 — 안 비우면 앞 글 비용이 묻어간다 */
export function resetUsage(): void {
  (globalThis as any).__llmUsage = { calls: 0, failedCalls: 0, input: 0, output: 0, byModel: {} };
}

export function estimateCost(usage: UsageTally = readUsage()): CostEstimate {
  const byModel = usage.byModel || {};
  const unpriced: string[] = [];
  let usd = 0;

  for (const [key, slot] of Object.entries(byModel)) {
    const modelId = key.split('/').pop() || key;
    const tier = findTier(modelId);
    const price = tier?.usdPer1M;
    if (!price) { unpriced.push(key); continue; }
    usd += (slot.input / 1_000_000) * price.input + (slot.output / 1_000_000) * price.output;
  }

  return {
    usd: Number(usd.toFixed(4)),
    unpriced,
    calls: usage.calls || 0,
    failedCalls: usage.failedCalls || 0,
    inputTokens: usage.input || 0,
    outputTokens: usage.output || 0,
  };
}

/** 원/달러 — 대략치라고 밝히고 쓴다 */
const KRW_PER_USD = 1400;

/** 사람이 읽을 한 줄 */
export function describeCost(cost: CostEstimate = estimateCost()): string {
  if (cost.calls === 0 && cost.failedCalls === 0) return '';
  const parts = [`호출 ${cost.calls}회`];
  if (cost.failedCalls > 0) parts.push(`실패 ${cost.failedCalls}회`);
  parts.push(`토큰 ${cost.inputTokens.toLocaleString()}→${cost.outputTokens.toLocaleString()}`);
  if (cost.unpriced.length) {
    // 단가를 모르는 모델이 섞였으면 "최소 얼마" 라고 말한다 — 지어내지 않는다
    parts.push(`$${cost.usd.toFixed(3)} 이상 (단가 미확인: ${cost.unpriced.join(', ')})`);
  } else {
    parts.push(`$${cost.usd.toFixed(3)} (약 ${Math.round(cost.usd * KRW_PER_USD).toLocaleString()}원)`);
  }
  return parts.join(' · ');
}

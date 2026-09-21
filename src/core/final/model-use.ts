/**
 * 🧠 고른 모델과 **실제로 쓴** 모델 (v3.8.734)
 *
 * llm-caller 가 남긴 실사용 기록(__llmActualModels)과 하향 기록(__llmDowngrades)을 읽는다.
 * 가장 많이 쓴 모델이 무엇이냐보다 **하향이 한 번이라도 있었는가**가 중요하다 —
 * 본문 호출 한 번이 저가 모델이면 그 글은 저가 모델이 쓴 글이다.
 *
 * 감사 실측: 시간초과가 나면 terra → luna 로 내려가는데 console 에만 찍히고, 발행 장부엔 모델 칸조차 없었다.
 */

import { findTier, resolveDefaultTierValue } from '../llm/pricing';

export interface ModelUse {
  requestedModel?: string;
  actualModel?: string;
  downgraded?: boolean;
  downgradeReason?: string;
}

export function describeModelUse(): ModelUse {
  try {
    const g: any = globalThis as any;
    const tier = findTier(process.env['PRIMARY_TEXT_MODEL'] || resolveDefaultTierValue());
    const requestedModel = tier ? `${tier.provider}/${tier.modelId}` : String(process.env['PRIMARY_TEXT_MODEL'] || '');
    const used: Record<string, number> = g.__llmActualModels || {};
    const downs: Array<{ from: string; to: string; reason?: string }> = Array.isArray(g.__llmDowngrades) ? g.__llmDowngrades : [];
    const actualModel = Object.entries(used).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(', ');
    return {
      ...(requestedModel ? { requestedModel } : {}),
      ...(actualModel ? { actualModel } : {}),
      downgraded: downs.length > 0,
      ...(downs.length ? { downgradeReason: downs.map((d) => `${d.from}→${d.to}(${d.reason || 'timeout'})`).join(', ') } : {}),
    };
  } catch {
    return {};
  }
}

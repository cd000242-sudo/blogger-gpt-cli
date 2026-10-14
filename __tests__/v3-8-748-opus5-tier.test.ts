/**
 * 748 Claude live — Opus 5 를 고를 수 있어야 한다.
 *
 * 그동안 텍스트 티어에 Opus 5 가 없어서 `PRIMARY_TEXT_MODEL=claude-opus-5` 는 findTier 에서 undefined 가 되고,
 * resolveModelChain 이 provider 대표 모델(Sonnet 5)로 조용히 떨어졌다 — 고른 모델과 실제 모델이 달라지는 "조용한 대체".
 * 2026-10-14: stored keys survive the 5.5 migration; Fable is no longer selectable.
 */
import { findTier, TIER_MODELS } from '../src/core/llm/pricing';

describe('Opus 5 티어', () => {
  it('legacy claude-opus-5 remains routable as current Opus 5.5', () => {
    const tier = findTier('claude-opus-5');
    expect(tier).toBeDefined();
    expect(tier!.provider).toBe('claude');
    expect(tier!.modelId).toBe('claude-opus-5-5');
  });

  it('stable UI keys map to the current namesake families', () => {
    expect(findTier('claude-opus')!.modelId).toBe('claude-opus-5-5');
    expect(findTier('claude-sonnet')!.modelId).toBe('claude-sonnet-5-5');
    expect(findTier('claude-haiku')!.modelId).toBe('claude-haiku-5-5');
  });

  it('티어 value 는 겹치지 않는다 (findTier 가 첫 항목만 돌려주므로)', () => {
    const values = TIER_MODELS.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('removed Fable settings migrate to Sonnet rather than an expensive default', () => {
    expect(findTier('claude-fable-5-1')!.modelId).toBe('claude-sonnet-5-5');
    expect(findTier('claude-fable-5')!.fallback.some(model => model.includes('fable'))).toBe(false);
  });
});

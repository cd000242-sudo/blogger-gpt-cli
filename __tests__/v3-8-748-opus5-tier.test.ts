/**
 * 748 Claude live — Opus 5 를 고를 수 있어야 한다.
 *
 * 그동안 텍스트 티어에 Opus 5 가 없어서 `PRIMARY_TEXT_MODEL=claude-opus-5` 는 findTier 에서 undefined 가 되고,
 * resolveModelChain 이 provider 대표 모델(Sonnet 5)로 조용히 떨어졌다 — 고른 모델과 실제 모델이 달라지는 "조용한 대체".
 * 기존 티어의 뜻은 그대로여야 한다(UI 👑 claude-opus = Fable 5.1).
 */
import { findTier, TIER_MODELS } from '../src/core/llm/pricing';

describe('Opus 5 티어', () => {
  it('claude-opus-5 는 provider=claude · modelId=claude-opus-5 로 찾힌다', () => {
    const tier = findTier('claude-opus-5');
    expect(tier).toBeDefined();
    expect(tier!.provider).toBe('claude');
    expect(tier!.modelId).toBe('claude-opus-5');
  });

  it('기존 티어 회귀 없음 — UI 👑(claude-opus) 는 여전히 Fable 5.1, claude-sonnet 은 Sonnet 5', () => {
    expect(findTier('claude-opus')!.modelId).toBe('claude-fable-5-1');
    expect(findTier('claude-sonnet')!.modelId).toBe('claude-sonnet-5');
    expect(findTier('claude-haiku')!.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('티어 value 는 겹치지 않는다 (findTier 가 첫 항목만 돌려주므로)', () => {
    const values = TIER_MODELS.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('Fable 5.1 의 폴백에 Opus 5 를 끼워 넣지 않았다 — 한도 소진 시 조용히 다른 모델로 가지 않는다', () => {
    const fable = findTier('claude-opus')!;
    expect(fable.fallback).not.toContain('claude-opus-5');
  });
});

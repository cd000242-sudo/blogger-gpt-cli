import { TIER_MODELS, findTier, tierCostKrw, describeModelForLog } from '../src/core/llm/pricing';
import { agentModelsFor, normalizeAgentModel, agentModelLabel } from '../src/core/agent-models';
import { routeTextToVision } from '../src/core/url-image-crawler/visionRouter';
const { resolveCandidateModels } = require('../src/core/external-traffic/_shared/llm-fallback');

describe('Claude 5.5 catalog and stored selection migration', () => {
  test.each([
    ['haiku', 0.1, 0.5, 4], ['sonnet', 2, 10, 76], ['opus', 4, 20, 153],
  ])('%s stable radio key uses verified model and price', (family, input, output, krw) => {
    const tier = findTier(`claude-${family}`)!;
    expect(tier.modelId).toBe(`claude-${family}-5-5`);
    expect(tier.usdPer1M).toMatchObject({ input, output });
    expect(tierCostKrw(tier)).toBe(krw);
    expect(tier.costKrw).toBe(krw);
    expect(tier.usdPer1M!.source).toContain('platform.claude.com');
  });

  test('Haiku price explicitly identifies the short-context band', () => {
    expect(findTier('claude-haiku')!.usdPer1M!.source).toContain('초과 $0.50/$2.50');
  });

  test.each(['claude-fable-5', 'claude-fable-5-1', 'fable', 'claude-fable'])('removed %s never reaches a model request', (value) => {
    expect(findTier(value)!.modelId).toBe('claude-sonnet-5-5');
    expect(normalizeAgentModel('claude', value)).toBe('claude-sonnet-5-5');
    expect(agentModelLabel('claude', value)).toBe('Sonnet 5.5');
    expect(describeModelForLog(value)).toBe('Claude Sonnet 5.5 (claude-sonnet-5-5)');
    expect(resolveCandidateModels('claude', { model: value }, [])).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
  });

  test('API/agent catalogs contain only current Claude choices and no expensive removed fallbacks', () => {
    for (const tier of TIER_MODELS.filter(t => t.provider === 'claude')) {
      expect(tier.modelId).toMatch(/^claude-(haiku|sonnet|opus)-5-5$/);
      expect(tier.fallback.every(m => !m.includes('fable'))).toBe(true);
    }
    expect(agentModelsFor('claude').map(m => m.value)).toEqual(['', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']);
  });

  test.each(['claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'])('legacy/current %s keeps Claude vision and model family', (value) => {
    const family = value.split('-')[1];
    expect(findTier(value)!.modelId).toBe(`claude-${family}-5-5`);
    expect(normalizeAgentModel('claude', value)).toBe(`claude-${family}-5-5`);
    expect(routeTextToVision(value)).toMatchObject({ vendor: 'claude', model: 'claude-sonnet-5-5' });
    expect(resolveCandidateModels('claude', { model: value }, [])[0]).toBe(`claude-${family}-5-5`);
  });
});

const llmFallback = require('../src/core/external-traffic/_shared/llm-fallback');

describe('external traffic LLM routing', () => {
  it('maps the GPT radio value to current OpenAI models, not Gemini', () => {
    expect(llmFallback.inferProviderFromModel('openai-gpt4o-mini')).toBe('openai');
    expect(
      llmFallback.resolveCandidateModels('openai', { primaryGeminiTextModel: 'openai-gpt4o-mini' }, [])
    ).toEqual(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5-mini']);
    expect(
      llmFallback.resolveCandidateModels('gemini', { primaryGeminiTextModel: 'openai-gpt4o-mini' }, ['gemini-3.5-flash'])
    ).toEqual(['gemini-3.5-flash']);
  });

  it('keeps native GPT-5.6 model ids inside the OpenAI provider chain', () => {
    expect(
      llmFallback.resolveCandidateModels('openai', { model: 'gpt-5.6-terra' }, ['gpt-5-mini'])
    ).toEqual(['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini']);
  });
});

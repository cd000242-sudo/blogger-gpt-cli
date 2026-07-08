const fs = require('fs');
const path = require('path');
const pricing = require('../src/core/llm/pricing.js');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('GPT model routing regression guard', () => {
  test('native GPT model IDs resolve to OpenAI tiers', () => {
    expect(pricing.findTier('gpt-5-nano')?.provider).toBe('openai');
    expect(pricing.findTier('gpt-5-mini')?.provider).toBe('openai');
    expect(pricing.findTier('gpt-5')?.provider).toBe('openai');
    expect(pricing.deriveProvider('gpt-5-nano')).toBe('openai');
  });

  test('posting payload keeps GPT radio values in the OpenAI provider', () => {
    const posting = read('electron/ui/modules/posting.js');
    const settings = read('electron/ui/modules/settings.js');

    expect(posting).toContain("v.startsWith('openai-') || v.startsWith('gpt-')");
    expect(posting).toContain("provider === 'openai' && (radioValue.startsWith('openai-') || radioValue.startsWith('gpt-')");
    expect(settings).toContain("m.startsWith('openai-') || m.startsWith('gpt-')");
  });

  test('final orchestration does not remap native GPT IDs back to Gemini defaults', () => {
    const orchestration = read('src/core/final/orchestration.ts');

    expect(orchestration).toContain("payload.provider === 'openai' && (modelValue.startsWith('openai-') || modelValue.startsWith('gpt-')");
    expect(orchestration).toContain("process.env['PRIMARY_TEXT_MODEL'] = finalModel!");
  });
});

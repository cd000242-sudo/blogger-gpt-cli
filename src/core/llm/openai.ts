// src/core/llm/openai.ts
import OpenAI from 'openai';
import { buildContentPrompt } from '../prompt';
import { resolveLlmMaxTokens } from './llm-caller';

type Input = {
  topic: string;
  keywordsCSV: string;
  minChars?: number;
};

export async function genWithOpenAI(apiKey: string, input: Input): Promise<string> {
  const client = new OpenAI({ apiKey });
  const prompt = buildContentPrompt(input);

  const model = process.env['OPENAI_MODEL'] || 'gpt-5.6-terra';
  const request: any = {
    model,
    messages: [
      {
        role: 'system',
        content: 'Write accurate Korean blog HTML. Use dates, amounts, eligibility, statistics, organizations, and URLs only when they are explicitly supplied in the request. Never invent a plausible fact or source; use a neutral official-verification note when evidence is missing.',
      },
      {
        role: 'system',
        content:
          '너는 한국어 SEO 전문 에디터다. HTML fragment만, 외부 리소스 없이 출력한다.',
      },
      { role: 'user', content: prompt },
    ],
    // 출력이 긴 편이므로 넉넉히
    // v3.8.434: 숫자를 직접 박지 않는다 — 모든 제공자가 같은 상한을 쓴다.
    //   6000 은 한국어 장문 본문에 부족해 잘림(=빈 섹션)의 원인이 된다.
    max_tokens: resolveLlmMaxTokens(),
  };
  if (/^gpt-5/i.test(model)) {
    request.max_completion_tokens = request.max_tokens;
    delete request.max_tokens;
    if (/^gpt-5\.6/i.test(model)) request.reasoning_effort = 'medium';
  } else {
    request.temperature = 0.45;
  }
  const res = await client.chat.completions.create(request);

  const text = res.choices?.[0]?.message?.content ?? '';
  return String(text).trim();
}

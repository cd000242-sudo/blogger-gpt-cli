// src/core/llm/openai.ts
import OpenAI from 'openai';
import { buildContentPrompt } from '../prompt';
import { resolveLlmMaxTokens } from './llm-caller';
import { applyOpenAiTokenParams } from './openai-params';

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
  // v3.8.714: 모델별 규칙은 openai-params 한 곳에서 (gpt-6-astra 가 400 나던 자리)
  applyOpenAiTokenParams(request as any, model, resolveLlmMaxTokens(), 0.45, { reasoningEffort: 'medium' });
  const res = await client.chat.completions.create(request);

  const text = res.choices?.[0]?.message?.content ?? '';
  return String(text).trim();
}

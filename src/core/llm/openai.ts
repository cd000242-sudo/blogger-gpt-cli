// src/core/llm/openai.ts
import OpenAI from 'openai';
import { buildContentPrompt } from '../prompt';

type Input = {
  topic: string;
  keywordsCSV: string;
  minChars?: number;
};

export async function genWithOpenAI(apiKey: string, input: Input): Promise<string> {
  const client = new OpenAI({ apiKey });
  const prompt = buildContentPrompt(input);

  const res = await client.chat.completions.create({
    model: process.env['OPENAI_MODEL'] || 'gpt-5-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          '너는 한국어 SEO 전문 에디터다. HTML fragment만, 외부 리소스 없이 출력한다.',
      },
      { role: 'user', content: prompt },
    ],
    // 출력이 긴 편이므로 넉넉히
    max_tokens: 6000,
  });

  const text = res.choices?.[0]?.message?.content ?? '';
  return String(text).trim();
}

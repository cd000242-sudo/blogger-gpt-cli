// src/core/llm/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildContentPrompt } from '../prompt';

type Input = {
  topic: string;
  keywordsCSV: string;
  minChars?: number;
};

// 텍스트 생성 모델 우선순위 (2026년 최신)
const TEXT_MODELS = [
  'gemini-3-pro-preview',       // Gemini 3 Pro (최고품질)
  'gemini-2.5-flash',           // Gemini 2.5 Flash (빠르고 안정 - 폴백)
];

export async function genWithGemini(apiKey: string, input: Input): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildContentPrompt(input);

  for (const modelName of TEXT_MODELS) {
    try {
      console.log(`[GEMINI] 🧠 ${modelName} 텍스트 생성 시도...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent([{ text: prompt }]);
      const text = res?.response?.text?.() ?? '';
      const result = String(text).trim();

      if (result.length > 0) {
        console.log(`[GEMINI] ✅ ${modelName} 성공! (${result.length}자)`);
        return result;
      }
      console.log(`[GEMINI] ⚠️ ${modelName} 빈 응답, 다음 모델 시도...`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`[GEMINI] ⚠️ ${modelName} 실패: ${errMsg.slice(0, 100)}, 다음 모델 시도...`);
    }
  }

  throw new Error('모든 Gemini 텍스트 모델 실패');
}

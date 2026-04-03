/**
 * Gemini API 호출 엔진
 * - callGeminiWithRetry (모델 폴백 + OpenAI/Claude/Perplexity 폴백)
 * - callGeminiWithGrounding (Google Search Grounding)
 * - 모델 리스트 및 Rate Limiter
 */

import {
  getGenAI, getOpenAIApiKey, getClaudeApiKey, getPerplexityApiKey,
  callOpenAIAPI, callClaudeAPI, callPerplexityAPI,
} from '../llm';

// 🔥 Gemini 모델 리스트 (2.5+ 모델만 사용!)
export const GEMINI_MODELS = [
  'gemini-2.5-flash',          // 🔥 가장 안정적, 빠른 응답
  'gemini-2.5-pro',            // 고품질 폴백
];

// 🌐 Grounding 모델
export const GROUNDING_MODELS = [
  'gemini-2.5-flash',          // Search Grounding에 가장 안정적
  'gemini-2.5-pro',            // 고품질 폴백
];

// 🔥 API 호출 간격 제어 (할당량 초과 방지)
let lastApiCallTime = 0;
let rateLimitLock: Promise<void> = Promise.resolve();
const MIN_API_INTERVAL = 500; // 최소 0.5초 간격
const GEMINI_TIMEOUT_MS = 30_000;

async function enforceRateLimit(): Promise<void> {
  // 직렬화: 이전 호출의 대기가 끝난 후 실행
  rateLimitLock = rateLimitLock.then(async () => {
    const now = Date.now();
    const elapsed = now - lastApiCallTime;
    if (elapsed < MIN_API_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - elapsed));
    }
    lastApiCallTime = Date.now();
  });
  return rateLimitLock;
}

// 🔥 Gemini API 호출 헬퍼 (재시도 + 모델 폴백 + 지능형 대기)
// 🔥 폴백 순서: Gemini(1순위) → OpenAI → Claude → Perplexity
export async function callGeminiWithRetry(prompt: string, maxRetries: number = 2): Promise<string> {
  const genAI = getGenAI();
  let lastError: any = null;
  let totalAttempts = 0;

  await enforceRateLimit();

  // 🤖 1순위: Gemini 모델들 (기본 엔진)
  for (const modelName of GEMINI_MODELS) {
    for (let retry = 0; retry < maxRetries; retry++) {
      totalAttempts++;
      try {
        console.log(`🤖 [Gemini] ${modelName} 시도 중... (${retry + 1}/${maxRetries})`);
        const model = genAI.getGenerativeModel({ model: modelName });
        // 🔥 30초 타임아웃 추가 (API 행 방지)
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${modelName} 30초 타임아웃`)), 30000))
        ]);
        const text = result.response.text();
        console.log(`✅ [Gemini] ${modelName} 성공!`);
        return text;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);
        const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);

        if (isRateLimit) {
          // 🔥 빠른 대기 시간 (최대 10초)
          const waitTime = Math.min(3 * (retry + 1), 10);

          console.log(`⏳ [Gemini] ${modelName} 할당량 초과, ${waitTime}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

          if (retry >= maxRetries - 1) {
            console.log(`⚠️ [Gemini] ${modelName} 할당량 소진, 다음 모델로 전환...`);
            break; // 다음 모델로
          }
        } else {
          // 다른 에러는 즉시 다음 모델로
          console.error(`❌ [Gemini] ${modelName} 오류:`, errorMsg.substring(0, 100));
          break;
        }
      }
    }
  }

  // 🧠 2순위: OpenAI 폴백 시도
  const openaiKey = getOpenAIApiKey();
  if (openaiKey) {
    try {
      console.log(`🧠 [Fallback] OpenAI로 폴백 시도...`);
      const result = await callOpenAIAPI(prompt);
      console.log(`✅ [Fallback] OpenAI 폴백 성공!`);
      return result;
    } catch (openaiError: any) {
      lastError = openaiError;
      console.error(`❌ [Fallback] OpenAI 폴백 실패:`, openaiError?.message?.substring(0, 100));
    }
  } else {
    console.log(`⚠️ [Fallback] OpenAI API 키 없음, 건너뜀`);
  }

  // 🟣 3순위: Claude 폴백 시도
  const claudeKey = getClaudeApiKey();
  if (claudeKey) {
    console.log(`🟣 [Fallback] Claude로 폴백 시도...`);
    try {
      const result = await callClaudeAPI(prompt);
      console.log(`✅ [Fallback] Claude 폴백 성공!`);
      return result;
    } catch (claudeError: any) {
      console.error(`❌ [Fallback] Claude 폴백 실패:`, claudeError?.message?.substring(0, 100));
    }
  } else {
    console.log(`⚠️ [Fallback] Claude API 키 없음, 건너뜀`);
  }

  // 🔮 4순위: Perplexity 폴백 시도
  const perplexityKey = getPerplexityApiKey();
  if (perplexityKey) {
    console.log(`🔮 [Fallback] Perplexity로 폴백 시도...`);
    try {
      const result = await callPerplexityAPI(prompt);
      console.log(`✅ [Fallback] Perplexity 폴백 성공!`);
      return result;
    } catch (perplexityError: any) {
      console.error(`❌ [Fallback] Perplexity 폴백도 실패:`, perplexityError?.message?.substring(0, 100));
    }
  } else {
    console.log(`⚠️ [Fallback] Perplexity API 키 없음, 건너뜀`);
  }

  // 🔥 최후의 시도: Gemini 재시도 (5초 쿨다운 후)
  console.log(`⚠️ [Gemini] 모든 엔진 실패! 5초 대기 후 최종 Gemini 시도...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS[0]! });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`최종 시도 ${GEMINI_TIMEOUT_MS / 1000}초 타임아웃`)), GEMINI_TIMEOUT_MS))
    ]);
    console.log(`✅ [Gemini] 최종 시도 성공!`);
    return result.response.text();
  } catch (finalError) {
    console.error(`❌ [ALL] 최종 시도도 실패. 총 ${totalAttempts}회 시도함.`);
    throw lastError || new Error('Gemini + OpenAI + Claude + Perplexity 모두 실패 - API 키와 할당량을 확인하세요');
  }
}

export async function callGeminiWithGrounding(prompt: string, maxRetries: number = 2): Promise<string> {
  let lastError: any = null;

  await enforceRateLimit();

  // 🌐 1순위: Gemini Search Grounding (기본 엔진)
  const genAI = getGenAI();
  let totalAttempts = 0;

  for (const modelName of GROUNDING_MODELS) {
    for (let retry = 0; retry < maxRetries; retry++) {
      totalAttempts++;
      try {
        console.log(`🌐 [Grounding] ${modelName} + Google Search 시도 중... (${retry + 1}/${maxRetries})`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: [{ googleSearchRetrieval: {} }],
        });
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${modelName} Grounding ${GEMINI_TIMEOUT_MS / 1000}초 타임아웃`)), GEMINI_TIMEOUT_MS))
        ]);
        const text = result.response.text();

        // 🔥 Grounding 메타데이터 로깅
        const metadata = result.response.candidates?.[0]?.groundingMetadata;
        if (metadata?.webSearchQueries?.length) {
          console.log(`🔍 [Grounding] 검색 쿼리: ${metadata.webSearchQueries.join(', ')}`);
        }
        if (metadata?.groundingChunks?.length) {
          console.log(`📚 [Grounding] ${metadata.groundingChunks.length}개 소스 참조`);
        }

        console.log(`✅ [Grounding] ${modelName} 성공! (${text.length}자)`);
        return text;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);
        const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);

        if (isRateLimit) {
          const waitTime = Math.min(3 * (retry + 1), 10);
          console.log(`⏳ [Grounding] ${modelName} 할당량 초과, ${waitTime}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          if (retry >= maxRetries - 1) {
            console.log(`⚠️ [Grounding] ${modelName} 할당량 소진, 다음 모델로 전환...`);
            break;
          }
        } else {
          console.error(`❌ [Grounding] ${modelName} 오류:`, errorMsg.substring(0, 150));
          break;
        }
      }
    }
  }

  // 🔥 Grounding 실패 → callGeminiWithRetry (OpenAI/Claude/Perplexity 포함)
  console.log(`⚠️ [Grounding] 모두 실패! 일반 모델로 폴백... (총 ${totalAttempts}회 시도)`);
  try {
    return await callGeminiWithRetry(prompt, maxRetries);
  } catch (fallbackError) {
    throw lastError || fallbackError || new Error('Gemini Grounding + 폴백 모두 실패');
  }
}

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
import { findTier, DEFAULT_TIER_VALUE } from '../llm/pricing';

// 🔥 Gemini 모델 베이스 리스트 (2.5+ 모델만 사용!)
const GEMINI_BASE_MODELS = [
  'gemini-2.5-flash-lite',     // 가성비 (신규)
  'gemini-2.5-flash',          // 🔥 가장 안정적, 빠른 응답
  'gemini-2.5-pro',            // 고품질 폴백
];

/**
 * 사용자 설정(PRIMARY_TEXT_MODEL)에 따라 Gemini 모델 폴백 체인을 동적 구성.
 * 비-Gemini 티어 선택 시에도 Gemini 폴백은 균형 모델부터 시도.
 */
function buildGeminiChain(): string[] {
  const tierValue = process.env['PRIMARY_TEXT_MODEL'] || DEFAULT_TIER_VALUE;
  const tier = findTier(tierValue);
  if (tier && tier.provider === 'gemini') {
    // 1순위 = 사용자 선택, 나머지는 베이스 순서 유지
    const seen = new Set<string>();
    const chain: string[] = [];
    [tier.modelId, ...GEMINI_BASE_MODELS].forEach(m => {
      if (!seen.has(m)) { seen.add(m); chain.push(m); }
    });
    return chain;
  }
  return [...GEMINI_BASE_MODELS];
}

/**
 * 사용자가 비-Gemini 티어를 선택했는지 확인.
 * 그렇다면 해당 provider를 1순위로 호출해야 함.
 */
function getPrimaryProvider(): 'gemini' | 'openai' | 'claude' | 'perplexity' {
  const tier = findTier(process.env['PRIMARY_TEXT_MODEL']);
  return tier?.provider ?? 'gemini';
}

// 하위호환: 다른 모듈에서 import할 수 있도록 유지
export const GEMINI_MODELS = GEMINI_BASE_MODELS;
export const GROUNDING_MODELS = GEMINI_BASE_MODELS;

// 🔥 API 호출 간격 제어 (v3.5.73 — 연속 발행 안정화)
//   Gemini 무료 티어 한도: 60 req/min (Pro), 1500 req/min (Flash 유료)
//   1500ms 간격 = 40 req/min 안전 마진 (무료 + 그라운딩 검색까지 안전)
let lastApiCallTime = 0;
let rateLimitLock: Promise<void> = Promise.resolve();
const MIN_API_INTERVAL = 1500;

// 타임아웃 — Pro는 긴 프롬프트/grounding에서 자주 초과
const GEMINI_TIMEOUT_MS = 60_000;
const GROUNDING_TIMEOUT_MS = 90_000;

// 타임아웃 후 backoff (네트워크 일시 지연 회복용)
const TIMEOUT_BACKOFF_MS = 3_000;

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

// 🔥 Provider 표시명 + 빌링 URL 매핑
const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
  perplexity: 'Perplexity',
};
const BILLING_URLS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/plan_billing',
  openai: 'https://platform.openai.com/settings/organization/billing',
  claude: 'https://console.anthropic.com/settings/billing',
  perplexity: 'https://www.perplexity.ai/settings/api',
};

// 🔥 선택된 엔진으로만 호출 — 실패 시 에러 (자동 폴백 없음)
export async function callGeminiWithRetry(prompt: string, maxRetries: number = 2): Promise<string> {
  await enforceRateLimit();

  const primaryProvider = getPrimaryProvider();
  const modelValue = process.env['PRIMARY_TEXT_MODEL'] || DEFAULT_TIER_VALUE;
  const tier = findTier(modelValue);
  const providerName = PROVIDER_NAMES[primaryProvider] || primaryProvider;

  // ── 비-Gemini 엔진 선택 시: 해당 엔진만 호출 ──
  if (primaryProvider !== 'gemini') {
    // API 키 체크
    const keyChecks: Record<string, () => string> = {
      openai: getOpenAIApiKey,
      claude: getClaudeApiKey,
      perplexity: getPerplexityApiKey,
    };
    const getKey = keyChecks[primaryProvider];
    if (!getKey || !getKey()) {
      throw new Error(
        `❌ ${providerName} API 키가 설정되지 않았습니다.\n` +
        `설정 → API 키 발급받기에서 ${providerName} API 키를 입력하거나, 다른 엔진을 선택해주세요.`
      );
    }

    // API 호출
    try {
      console.log(`🎯 [Engine] ${providerName} (${tier?.modelId || modelValue}) 호출 중...`);
      if (primaryProvider === 'openai') return await callOpenAIAPI(prompt);
      if (primaryProvider === 'claude') return await callClaudeAPI(prompt);
      if (primaryProvider === 'perplexity') return await callPerplexityAPI(prompt);
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded/i.test(errorMsg);
      const isAuth = /401|403|auth|unauthorized|forbidden|invalid.*key/i.test(errorMsg);

      let userMessage = `❌ ${providerName} 엔진 호출 실패\n`;
      if (isAuth) {
        userMessage += `원인: API 키가 유효하지 않습니다.\n해결: 올바른 ${providerName} API 키를 입력하거나, 다른 엔진을 선택해주세요.`;
      } else if (isRateLimit) {
        userMessage += `원인: API 할당량(크레딧)이 소진되었습니다.\n해결: 크레딧을 충전하거나, 다른 엔진을 선택해주세요.\n[BILLING:${primaryProvider}]`;
      } else {
        userMessage += `원인: ${errorMsg.substring(0, 150)}\n해결: 다른 엔진을 선택해주세요.`;
      }
      throw new Error(userMessage);
    }

    throw new Error(`❌ ${providerName} 엔진을 호출할 수 없습니다. 다른 엔진을 선택해주세요.`);
  }

  // ── Gemini 엔진 선택 시 ──
  const genAI = getGenAI();
  const geminiChain = buildGeminiChain();
  let lastError: any = null;
  let totalAttempts = 0;

  for (const modelName of geminiChain) {
    for (let retry = 0; retry < maxRetries; retry++) {
      totalAttempts++;
      try {
        console.log(`🤖 [Gemini] ${modelName} 시도 중... (${retry + 1}/${maxRetries})`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${modelName} ${GEMINI_TIMEOUT_MS / 1000}초 타임아웃`)), GEMINI_TIMEOUT_MS))
        ]);
        const text = result.response.text();
        console.log(`✅ [Gemini] ${modelName} 성공!`);
        return text;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || String(error);
        const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
        const isTimeout = /타임아웃|timeout/i.test(errorMsg);

        if (isRateLimit) {
          const waitTime = Math.min(3 * (retry + 1), 10);
          console.log(`⏳ [Gemini] ${modelName} 할당량 초과, ${waitTime}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          if (retry >= maxRetries - 1) break;
        } else if (isTimeout) {
          // v3.5.73: 타임아웃은 일시적 — 같은 모델 backoff 후 retry (사용자 모델 의도 보존)
          if (retry < maxRetries - 1) {
            console.log(`⏳ [Gemini] ${modelName} 타임아웃, ${TIMEOUT_BACKOFF_MS / 1000}초 backoff 후 같은 모델 재시도...`);
            await new Promise(resolve => setTimeout(resolve, TIMEOUT_BACKOFF_MS));
            // retry 계속 (break 없이)
          } else {
            console.warn(`⚠️ [Gemini] ${modelName} 타임아웃 ${maxRetries}회 — 폴백 모델로 전환`);
            break;
          }
        } else {
          console.error(`❌ [Gemini] ${modelName} 오류:`, errorMsg.substring(0, 100));
          break;
        }
      }
    }
  }

  // Gemini 모든 모델 실패
  const errorMsg = lastError?.message || '';
  const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded/i.test(errorMsg);
  const isAuth = /401|403|auth|unauthorized|forbidden|invalid.*key/i.test(errorMsg);

  let userMessage = `❌ Gemini 엔진 호출 실패 (${totalAttempts}회 시도)\n`;
  if (isAuth) {
    userMessage += `원인: Gemini API 키가 유효하지 않습니다.\n해결: 올바른 API 키를 입력하거나, 다른 엔진(OpenAI, Claude)을 선택해주세요.`;
  } else if (isRateLimit) {
    userMessage += `원인: Gemini API 할당량(크레딧)이 소진되었습니다.\n해결: 유료 플랜으로 업그레이드하거나, 다른 엔진을 선택해주세요.\n[BILLING:gemini]`;
  } else {
    userMessage += `원인: ${errorMsg.substring(0, 150)}\n해결: 다른 엔진을 선택해주세요.`;
  }
  throw new Error(userMessage);
}

export async function callGeminiWithGrounding(prompt: string, maxRetries: number = 2): Promise<string> {
  // 🎯 비-Gemini 엔진 선택 시 Grounding 스킵 → callGeminiWithRetry가 provider 분기 처리
  const primaryProvider = getPrimaryProvider();
  if (primaryProvider !== 'gemini') {
    console.log(`🎯 [Grounding] 비-Gemini 엔진 선택 (${primaryProvider}), 선택 엔진 우선 호출`);
    return callGeminiWithRetry(prompt, maxRetries);
  }

  let lastError: any = null;

  await enforceRateLimit();

  // 🌐 1순위: Gemini Search Grounding (기본 엔진)
  const genAI = getGenAI();
  let totalAttempts = 0;
  const groundingChain = buildGeminiChain();

  for (const modelName of groundingChain) {
    for (let retry = 0; retry < maxRetries; retry++) {
      totalAttempts++;
      try {
        console.log(`🌐 [Grounding] ${modelName} + Google Search 시도 중... (${retry + 1}/${maxRetries})`);
        // 🔥 Gemini 2.0+ 모델은 googleSearch 사용 (1.5는 googleSearchRetrieval)
        const is2xOrNewer = /gemini-[2-9]/.test(modelName);
        const groundingTool: any = is2xOrNewer
          ? [{ googleSearch: {} }]
          : [{ googleSearchRetrieval: {} }];
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: groundingTool,
        });
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${modelName} Grounding ${GROUNDING_TIMEOUT_MS / 1000}초 타임아웃`)), GROUNDING_TIMEOUT_MS))
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
        const isTimeout = /타임아웃|timeout/i.test(errorMsg);

        if (isRateLimit) {
          const waitTime = Math.min(3 * (retry + 1), 10);
          console.log(`⏳ [Grounding] ${modelName} 할당량 초과, ${waitTime}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          if (retry >= maxRetries - 1) {
            console.log(`⚠️ [Grounding] ${modelName} 할당량 소진, 다음 모델로 전환...`);
            break;
          }
        } else if (isTimeout) {
          // v3.5.73: 타임아웃은 일시적 — 같은 모델 backoff 후 retry
          if (retry < maxRetries - 1) {
            console.log(`⏳ [Grounding] ${modelName} 타임아웃, ${TIMEOUT_BACKOFF_MS / 1000}초 backoff 후 같은 모델 재시도...`);
            await new Promise(resolve => setTimeout(resolve, TIMEOUT_BACKOFF_MS));
          } else {
            console.warn(`⚠️ [Grounding] ${modelName} 타임아웃 ${maxRetries}회 — 폴백 모델로 전환`);
            break;
          }
        } else {
          console.error(`❌ [Grounding] ${modelName} 오류:`, errorMsg.substring(0, 150));
          break;
        }
      }
    }
  }

  // 🔥 Grounding 실패 → 비-Grounding 폴백 시 할루시네이션 경고 주입
  console.log(`⚠️ [Grounding] 모두 실패! 일반 모델로 폴백... (총 ${totalAttempts}회 시도)`);
  const safePrompt = prompt + `\n\n🔴🔴🔴 중요: 검색 기능을 사용할 수 없는 상태입니다. 반드시 아래 규칙을 지키세요:
- 확실하지 않은 숫자/날짜/통계/URL은 절대 작성하지 마세요.
- 검증할 수 없는 사실은 "정확한 수치는 공식 사이트에서 확인하세요"로 대체하세요.
- 추측이나 허위 정보를 만들어내면 안 됩니다.`;
  try {
    return await callGeminiWithRetry(safePrompt, maxRetries);
  } catch (fallbackError: any) {
    const msg = fallbackError?.message || lastError?.message || '';
    const isCreditError = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded/i.test(msg);
    throw new Error(
      `❌ Gemini 엔진 호출 실패 (Grounding + 일반 모두 실패)\n` +
      `원인: ${isCreditError ? 'Gemini API 할당량(크레딧)이 소진되었습니다.' : msg.substring(0, 150)}\n` +
      `해결: ${isCreditError ? '유료 플랜으로 업그레이드하거나, 다른 엔진을 선택해주세요.' : '다른 엔진(OpenAI, Claude)을 선택해주세요.'}` +
      (isCreditError ? '\n[BILLING:gemini]' : '')
    );
  }
}

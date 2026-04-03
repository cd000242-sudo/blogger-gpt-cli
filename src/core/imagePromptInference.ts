/**
 * 🧠 AI 기반 이미지 프롬프트 추론 모듈
 * 
 * 네이버 자동화 promptBuilder.ts REASONING 패턴 참고.
 * 단순 번역이 아닌, AI가 주제에서 색감/구도/조명/스타일까지 추론하여
 * 최적의 영어 이미지 프롬프트를 생성합니다.
 * 
 * 폴백 순서: OpenAI (최고 품질) → Gemini (무료) → Claude → 키워드 매핑 (오프라인)
 * 
 * @module imagePromptInference
 */

import { loadEnvFromFile } from '../env';

// ── 환경변수 캐시 ──
let _envCache: Record<string, string> | null = null;
let _envCacheTime = 0;
const ENV_CACHE_TTL = 30000;

function getCachedEnv(): Record<string, string> {
  const now = Date.now();
  if (!_envCache || now - _envCacheTime > ENV_CACHE_TTL) {
    _envCache = loadEnvFromFile();
    _envCacheTime = now;
  }
  return _envCache;
}

function getApiKey(primary: string, ...fallbacks: string[]): string {
  const env = getCachedEnv();
  for (const k of [primary, ...fallbacks]) {
    const v = (env[k] || process.env[k] || '').trim();
    if (v && v.length >= 10) return v;
  }
  return '';
}

// ── 추론 결과 캐시 ──
const _inferenceCache = new Map<string, string>();

// ── 한국어 감지 ──
function isKorean(text: string): boolean {
  return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text);
}

// ══════════════════════════════════════════════════════
// 🧠 시스템 프롬프트 (REASONING 패턴)
// ══════════════════════════════════════════════════════

function buildInferenceSystemPrompt(isThumbnail: boolean): string {
  const base = `You are an expert visual prompt engineer. Convert a blog heading into an optimal English image generation prompt.

REASONING INSTRUCTIONS:
1. Analyze the topic/heading to understand the SUBJECT and CONTEXT
2. Infer the most appropriate: color palette, lighting, composition, camera angle
3. Choose between: product photography, lifestyle scene, aerial view, close-up, flat lay, environmental portrait
4. Consider the Korean cultural context — modern Korean settings, Korean people (20-40s), Korean aesthetics

PERSON RULE: If any person appears, they MUST be Korean with East Asian features, wearing modern Korean fashion, in a realistic Korean environment.

OUTPUT RULES:
- Return ONLY the English image prompt, nothing else
- No explanations, no markdown, no quotes
- Maximum 100 words
- Include specific visual details: lighting type, color palette, composition style
- CRITICAL: Absolutely NO text, letters, words, numbers, logos, or watermarks in the image`;

  if (isThumbnail) {
    return base + `\n\nTHUMBNAIL SPECIFIC:\n- Eye-catching hero composition\n- Single strong focal point\n- Vibrant, high-contrast colors\n- Clean negative space for potential text overlay`;
  }

  return base + `\n\nBLOG SECTION IMAGE SPECIFIC:\n- Diverse visual approaches: product shots, flat lays, environmental scenes\n- Natural, editorial photography feel\n- Warm, inviting atmosphere\n- Pure visual — text-free`;
}

// ══════════════════════════════════════════════════════
// 🎯 PUBLIC API
// ══════════════════════════════════════════════════════

export interface InferenceResult {
  prompt: string;
  provider: string;
  cached: boolean;
}

/**
 * AI 기반 이미지 프롬프트 추론
 * 
 * section.h2 한국어 텍스트를 AI가 분석하여
 * 시각적 장면, 색감, 구도까지 추론한 영어 프롬프트를 생성합니다.
 * 
 * 폴백 순서: OpenAI → Gemini → Claude → 키워드 매핑
 * 
 * @param heading - H2 소제목 (한국어/영어)
 * @param keyword - 블로그 키워드 (맥락 보강)
 * @param isThumbnail - 썸네일용 여부
 * @returns `{prompt, provider, cached}`
 */
export async function inferImagePrompt(
  heading: string,
  keyword: string,
  isThumbnail: boolean = false,
): Promise<InferenceResult> {
  // 캐시 확인
  const cacheKey = `${heading.slice(0, 150)}_${keyword.slice(0, 50)}_${isThumbnail}`;
  if (_inferenceCache.has(cacheKey)) {
    return { prompt: _inferenceCache.get(cacheKey)!, provider: 'cache', cached: true };
  }

  const systemPrompt = buildInferenceSystemPrompt(isThumbnail);
  const userMsg = isKorean(heading)
    ? `Blog heading (Korean): "${heading}"\nBlog keyword: "${keyword}"\n\nGenerate an optimal English image prompt for this topic.`
    : `Blog heading: "${heading}"\nBlog keyword: "${keyword}"\n\nGenerate an optimal English image prompt.`;

  // ── 1순위: OpenAI (최고 품질) ──
  const openaiKey = getApiKey('openaiKey', 'OPENAI_API_KEY');
  if (openaiKey) {
    try {
      const result = await callOpenAIInference(openaiKey, systemPrompt, userMsg);
      if (result) {
        const enhanced = addSafetyRules(result, isThumbnail);
        _inferenceCache.set(cacheKey, enhanced);
        console.log(`[IMG-INFER] ✅ OpenAI 추론 성공: "${heading.slice(0, 20)}..." → "${enhanced.slice(0, 50)}..."`);
        return { prompt: enhanced, provider: 'OpenAI', cached: false };
      }
    } catch (e: any) {
      console.log(`[IMG-INFER] ⚠️ OpenAI 실패: ${e.message?.slice(0, 80)}`);
    }
  }

  // ── 2순위: Gemini (무료, 빠름) ──
  const geminiKey = getApiKey('geminiKey', 'GEMINI_API_KEY', 'geminiApiKey');
  if (geminiKey) {
    try {
      const result = await callGeminiInference(geminiKey, systemPrompt, userMsg);
      if (result) {
        const enhanced = addSafetyRules(result, isThumbnail);
        _inferenceCache.set(cacheKey, enhanced);
        console.log(`[IMG-INFER] ✅ Gemini 추론 성공: "${heading.slice(0, 20)}..." → "${enhanced.slice(0, 50)}..."`);
        return { prompt: enhanced, provider: 'Gemini', cached: false };
      }
    } catch (e: any) {
      console.log(`[IMG-INFER] ⚠️ Gemini 실패: ${e.message?.slice(0, 80)}`);
    }
  }

  // ── 3순위: Claude ──
  const claudeKey = getApiKey('claudeKey', 'claudeApiKey', 'CLAUDE_API_KEY', 'ANTHROPIC_API_KEY');
  if (claudeKey) {
    try {
      const result = await callClaudeInference(claudeKey, systemPrompt, userMsg);
      if (result) {
        const enhanced = addSafetyRules(result, isThumbnail);
        _inferenceCache.set(cacheKey, enhanced);
        console.log(`[IMG-INFER] ✅ Claude 추론 성공: "${heading.slice(0, 20)}..." → "${enhanced.slice(0, 50)}..."`);
        return { prompt: enhanced, provider: 'Claude', cached: false };
      }
    } catch (e: any) {
      console.log(`[IMG-INFER] ⚠️ Claude 실패: ${e.message?.slice(0, 80)}`);
    }
  }

  // ── 4순위: 오프라인 키워드 매핑 (API 없을 때) ──
  const fallback = buildFallbackPrompt(heading, keyword, isThumbnail);
  _inferenceCache.set(cacheKey, fallback);
  console.log(`[IMG-INFER] 📝 오프라인 폴백: "${heading.slice(0, 20)}..." → "${fallback.slice(0, 50)}..."`);
  return { prompt: fallback, provider: 'fallback', cached: false };
}

// ══════════════════════════════════════════════════════
// 🔧 Internal: LLM 호출 함수들
// ══════════════════════════════════════════════════════

async function callOpenAIInference(apiKey: string, system: string, user: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 300,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGeminiInference(apiKey: string, system: string, user: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callClaudeInference(apiKey: string, system: string, user: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ── 안전 규칙 추가 ──
function addSafetyRules(prompt: string, isThumbnail: boolean): string {
  // AI가 이미 좋은 프롬프트를 생성했으므로, 최소한의 안전 규칙만 추가
  const noText = 'Absolutely NO text, letters, words, numbers, logos, or watermarks.';
  const quality = 'Professional photograph, photorealistic, high quality, 4K.';

  // 이미 포함된 경우 중복 방지
  let result = prompt;
  if (!prompt.toLowerCase().includes('no text') && !prompt.toLowerCase().includes('text-free')) {
    result += ` ${noText}`;
  }
  if (!prompt.toLowerCase().includes('photorealistic') && !prompt.toLowerCase().includes('professional')) {
    result = `${quality} ${result}`;
  }
  return result;
}

// ── 오프라인 폴백 ──
function buildFallbackPrompt(heading: string, keyword: string, isThumbnail: boolean): string {
  const koToEn: Record<string, string> = {
    '세탁기': 'washing machine', '냉장고': 'refrigerator', '노트북': 'laptop',
    '스마트폰': 'smartphone', '여행': 'travel', '음식': 'food', '건강': 'health',
    '뷰티': 'beauty', '패션': 'fashion', '자동차': 'car', '부동산': 'real estate',
    '금융': 'finance', '기술': 'technology', '스포츠': 'sports', '게임': 'gaming',
    '추천': 'recommendation', '비교': 'comparison', '후기': 'review',
    '방법': 'method', '효과': 'effect', '가격': 'price', '인테리어': 'interior design',
    '요리': 'cooking', '카페': 'cafe', '육아': 'parenting', '다이어트': 'diet',
    '운동': 'exercise', '화장품': 'cosmetics', '가전': 'home appliances',
  };
  let result = heading;
  for (const [ko, en] of Object.entries(koToEn)) {
    result = result.replace(new RegExp(ko, 'gi'), en);
  }
  // 한글 잔여 제거
  result = result.replace(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]+/g, '').replace(/\s+/g, ' ').trim();
  if (!result || result.length < 5) result = keyword;

  const prefix = isThumbnail
    ? 'Eye-catching blog thumbnail, vibrant colors, hero composition,'
    : 'Professional blog section photograph, editorial quality,';

  return `${prefix} ${result}, Korean setting, natural lighting, photorealistic, 4K. Absolutely NO text, letters, or watermarks.`;
}

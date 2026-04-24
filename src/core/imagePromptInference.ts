/**
 * 🧠 AI 기반 이미지 프롬프트 추론 모듈
 * 
 * 네이버 자동화 promptBuilder.ts REASONING 패턴 참고.
 * 단순 번역이 아닌, AI가 주제에서 색감/구도/조명/스타일까지 추론하여
 * 최적의 영어 이미지 프롬프트를 생성합니다.
 * 
 * 폴백 순서: Gemini (callGeminiWithRetry) → 키워드 매핑 (오프라인)
 * 
 * @module imagePromptInference
 */

import { callGeminiWithRetry } from './final/gemini-engine';

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
 * 폴백 순서: Gemini (callGeminiWithRetry) → 키워드 매핑
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
  contentMode?: string,
): Promise<InferenceResult> {
  // 캐시 확인
  const cacheKey = `${heading.slice(0, 150)}_${keyword.slice(0, 50)}_${isThumbnail}_${contentMode || ''}`;
  if (_inferenceCache.has(cacheKey)) {
    return { prompt: _inferenceCache.get(cacheKey)!, provider: 'cache', cached: true };
  }

  const systemPrompt = buildInferenceSystemPrompt(isThumbnail);

  // 모드별 이미지 스타일 힌트
  const modeHint = contentMode === 'shopping'
    ? '\nSTYLE HINT: This is a PRODUCT/SHOPPING article. Focus on clean product photography, comparison layouts, unboxing scenes, or e-commerce lifestyle shots. Emphasize the product itself.'
    : contentMode === 'adsense'
    ? '\nSTYLE HINT: This is an EDUCATIONAL/INFORMATIONAL article for Google AdSense approval. Use professional, trustworthy imagery. No commercial or promotional feel. Think: textbook illustrations, infographics, editorial photography.'
    : '';

  const userMsg = isKorean(heading)
    ? `Blog heading (Korean): "${heading}"\nBlog keyword: "${keyword}"${modeHint}\n\nGenerate an optimal English image prompt for this topic.`
    : `Blog heading: "${heading}"\nBlog keyword: "${keyword}"${modeHint}\n\nGenerate an optimal English image prompt.`;

  // ── Gemini (callGeminiWithRetry) ──
  try {
    const combinedPrompt = `${systemPrompt}\n\n${userMsg}`;
    const result = await callGeminiWithRetry(combinedPrompt);
    if (result) {
      const enhanced = addSafetyRules(result, isThumbnail);
      _inferenceCache.set(cacheKey, enhanced);
      console.log(`[IMG-INFER] ✅ Gemini 추론 성공: "${heading.slice(0, 20)}..." → "${enhanced.slice(0, 50)}..."`);
      return { prompt: enhanced, provider: 'Gemini', cached: false };
    }
  } catch (e: any) {
    console.log(`[IMG-INFER] ⚠️ Gemini 실패: ${e.message?.slice(0, 80)}`);
  }

  // ── 오프라인 키워드 매핑 폴백 ──
  const fallback = buildFallbackPrompt(heading, keyword, isThumbnail);
  _inferenceCache.set(cacheKey, fallback);
  console.log(`[IMG-INFER] 📝 오프라인 폴백: "${heading.slice(0, 20)}..." → "${fallback.slice(0, 50)}..."`);
  return { prompt: fallback, provider: 'fallback', cached: false };
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

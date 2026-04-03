/**
 * 🎯 이미지 디스패치 모듈
 * 
 * 사용자가 선택한 이미지 소스(imageSource)에 따라
 * 정확히 해당 엔진을 실행하고, 실패 시에만 폴백.
 * 
 * 기존 문제: ultimate-final-functions.ts에서 imageSource 값을 무시하고
 * 항상 NanoBanana → DALL-E → Leonardo → DeepInfra 체인을 실행함.
 * 
 * 이 모듈의 역할:
 * 1. 사용자 선택 엔진을 1순위로 실행
 * 2. 실패 시 다른 엔진으로 폴백 (선택 엔진 제외)
 * 3. 모든 엔진이 `{ok, dataUrl, error}` 통일 형식 반환
 * 4. AI 추론 기반 이미지 프롬프트 생성 (OpenAI→Gemini→Claude 폴백)
 */

import { makeNanoBananaProThumbnail, makeAutoThumbnail, makeDalleThumbnail, makeLeonardoPhoenixImage } from '../thumbnail';
import { makeImageFxImage } from './imageFxGenerator';
import { inferImagePrompt } from './imagePromptInference';
import { loadEnvFromFile } from '../env';

// ── 타입 ──
export interface ImageResult {
  ok: boolean;
  dataUrl: string;
  source: string;
  error?: string;
}

// ── 환경 변수 캐시 (loadEnvFromFile 중복 호출 방지) ──
let _envCache: Record<string, string> | null = null;
let _envCacheTime = 0;
const ENV_CACHE_TTL = 30000; // 30초

function getCachedEnv(): Record<string, string> {
  const now = Date.now();
  if (!_envCache || now - _envCacheTime > ENV_CACHE_TTL) {
    _envCache = loadEnvFromFile();
    _envCacheTime = now;
  }
  return _envCache;
}

function getGeminiApiKey(): string {
  const env = getCachedEnv();
  return (env['geminiKey'] || env['GEMINI_API_KEY'] || env['geminiApiKey'] || '').trim();
}

// ── 한국어 → 영어 프롬프트 번역 (Gemini 기반) ──
let _translationCache = new Map<string, string>();

function isKorean(text: string): boolean {
  return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text);
}

/**
 * 한국어 프롬프트를 영어 이미지 프롬프트로 변환
 * - ImageFX/DALL-E/DeepInfra: 영어 프롬프트가 품질 더 높음
 * - NanoBanana Pro: 내부에서 자체 번역하므로 패스
 */
async function toEnglishImagePrompt(koreanPrompt: string, isThumbnail: boolean = false): Promise<string> {
  if (!isKorean(koreanPrompt)) return koreanPrompt;

  const cacheKey = `${koreanPrompt.slice(0, 200)}_${isThumbnail}`;
  if (_translationCache.has(cacheKey)) return _translationCache.get(cacheKey)!;

  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.length < 10) {
    // API 키 없으면 간단 폴백
    return buildFallbackPrompt(koreanPrompt, isThumbnail);
  }

  try {
    const instruction = isThumbnail
      ? `Convert this Korean blog title into a concise English image generation prompt for a thumbnail. Focus on atmosphere and visual composition. Return ONLY the English prompt, nothing else.`
      : `Convert this Korean blog heading into a concise English image generation prompt. Focus on the scene, objects, and atmosphere. The image must have ZERO text. Return ONLY the English prompt, nothing else.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${instruction}\n\nKorean: ${koreanPrompt}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (translated && translated.length > 5) {
        const enhanced = enhancePrompt(translated, isThumbnail);
        _translationCache.set(cacheKey, enhanced);
        console.log(`[DISPATCH] 🌐 프롬프트 번역: "${koreanPrompt.slice(0, 30)}..." → "${enhanced.slice(0, 50)}..."`);
        return enhanced;
      }
    }
  } catch (e: any) {
    console.log(`[DISPATCH] ⚠️ 프롬프트 번역 실패: ${e.message}`);
  }

  return buildFallbackPrompt(koreanPrompt, isThumbnail);
}

function enhancePrompt(basePrompt: string, isThumbnail: boolean): string {
  const noTextRule = isThumbnail ? '' :
    ' CRITICAL: Absolutely NO text, letters, words, numbers, logos, or watermarks in the image. Pure visual imagery only.';
  return `Professional photograph, ${basePrompt}, Korean setting, photorealistic, high quality, 4K.${noTextRule}`;
}

function buildFallbackPrompt(koreanPrompt: string, isThumbnail: boolean): string {
  // 간단 키워드 매핑
  const mappings: Record<string, string> = {
    '세탁기': 'washing machine', '냉장고': 'refrigerator', '노트북': 'laptop',
    '스마트폰': 'smartphone', '여행': 'travel', '음식': 'food', '건강': 'health',
    '뷰티': 'beauty', '패션': 'fashion', '자동차': 'car', '부동산': 'real estate',
    '금융': 'finance', '기술': 'technology', '스포츠': 'sports', '게임': 'gaming',
    '추천': 'recommendation', '비교': 'comparison', '후기': 'review',
    '방법': 'method', '효과': 'effect', '가격': 'price',
  };
  let result = koreanPrompt;
  for (const [ko, en] of Object.entries(mappings)) {
    result = result.replace(new RegExp(ko, 'gi'), en);
  }
  return enhancePrompt(result, isThumbnail);
}

// ═══════════════════════════════════════════════════
// 🎯 H2 소제목 이미지 생성 디스패치
// ═══════════════════════════════════════════════════

/**
 * 사용자 선택 소스로 이미지 생성 (H2 소제목용)
 * 
 * @param imageSource - 사용자가 드롭다운에서 선택한 값 (imagefx, nanobananapro, deepinfra, leonardo, dalle)
 * @param prompt - 이미지 프롬프트 (보통 H2 제목)
 * @param keyword - 블로그 키워드
 * @param onLog - 진행 로그 콜백
 * @returns `{ok, dataUrl, source, error}`
 */
export async function dispatchH2ImageGeneration(
  imageSource: string,
  prompt: string,
  keyword: string,
  onLog?: (msg: string) => void,
): Promise<ImageResult> {
  // 🚫 '없음' 선택 → 즉시 빈 결과 (폴백 체인 실행 방지)
  if (imageSource === 'none' || imageSource === 'skip') {
    return { ok: false, dataUrl: '', source: '', error: '이미지 생성 스킵 (사용자 선택)' };
  }

  const env = getCachedEnv();

  // ── 1순위: 사용자 선택 엔진 ──
  const primaryResult = await tryEngine(imageSource, prompt, keyword, env, onLog);
  if (primaryResult.ok) return primaryResult;

  console.log(`[DISPATCH] ⚠️ 1순위 ${imageSource} 실패 → 폴백 체인 시작`);
  onLog?.(`⚠️ ${imageSource} 실패 → 다른 엔진으로 폴백 중...`);

  // ── 2순위: 폴백 체인 (선택 엔진 제외) ──
  const fallbackOrder = ['nanobananapro', 'imagefx', 'deepinfra', 'leonardo', 'dalle']
    .filter(e => e !== imageSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, prompt, keyword, env, onLog);
    if (result.ok) {
      console.log(`[DISPATCH] ✅ 폴백 성공: ${engine}`);
      return result;
    }
  }

  return { ok: false, dataUrl: '', source: '', error: '모든 이미지 엔진 실패' };
}

// ═══════════════════════════════════════════════════
// 🎯 썸네일 이미지 생성 디스패치
// ═══════════════════════════════════════════════════

/**
 * 사용자 선택 소스로 썸네일 생성
 * 
 * @param thumbnailSource - 사용자가 선택한 값 (imagefx, nanobananapro, text 등)
 * @param title - 블로그 제목 (H1)
 * @param keyword - 블로그 키워드
 * @param onLog - 진행 로그 콜백
 * @returns `{ok, dataUrl, source, error}`
 */
export async function dispatchThumbnailGeneration(
  thumbnailSource: string,
  title: string,
  keyword: string,
  onLog?: (msg: string) => void,
): Promise<ImageResult> {
  // 🚫 '없음' 선택 → 즉시 빈 결과
  if (thumbnailSource === 'none' || thumbnailSource === 'skip') {
    return { ok: false, dataUrl: '', source: '', error: '썸네일 생성 스킵 (사용자 선택)' };
  }

  const env = getCachedEnv();

  // text/svg 모드 → SVG 텍스트 썸네일
  if (thumbnailSource === 'text' || thumbnailSource === 'svg') {
    try {
      const svgResult = await makeAutoThumbnail(title, { width: 1200, height: 630 });
      if (svgResult.ok) {
        return { ok: true, dataUrl: svgResult.dataUrl, source: 'SVG 텍스트' };
      }
    } catch (e: any) {
      console.error('[DISPATCH-THUMB] SVG 실패:', e.message);
    }
    return { ok: false, dataUrl: '', source: '', error: 'SVG 썸네일 생성 실패' };
  }

  // AI 이미지 엔진
  const primaryResult = await tryEngine(thumbnailSource, title, keyword, env, onLog, true);
  if (primaryResult.ok) return primaryResult;

  // 폴백
  const fallbackOrder = ['nanobananapro', 'imagefx', 'leonardo']
    .filter(e => e !== thumbnailSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, title, keyword, env, onLog, true);
    if (result.ok) return result;
  }

  // 최종 폴백: SVG 텍스트 썸네일
  try {
    const svgResult = await makeAutoThumbnail(title, { width: 1200, height: 630 });
    if (svgResult.ok) {
      return { ok: true, dataUrl: svgResult.dataUrl, source: 'SVG 텍스트 (폴백)' };
    }
  } catch { /* 무시 */ }

  return { ok: false, dataUrl: '', source: '', error: '모든 썸네일 엔진 실패' };
}

// ═══════════════════════════════════════════════════
// 🔧 Internal: 개별 엔진 실행
// ═══════════════════════════════════════════════════

async function tryEngine(
  engine: string,
  prompt: string,
  keyword: string,
  env: Record<string, string>,
  onLog?: (msg: string) => void,
  isThumbnail: boolean = false,
): Promise<ImageResult> {
  // 🧠 AI 추론 프롬프트: 1회만 호출하여 모든 엔진에서 재사용
  // NanoBanana는 자체 번역이 있으므로 원본 prompt 사용
  let inferredPrompt = prompt;
  if (engine !== 'nanobananapro' && engine !== 'nanobanana') {
    try {
      const inference = await inferImagePrompt(prompt, keyword, isThumbnail);
      inferredPrompt = inference.prompt;
      if (!inference.cached) {
        onLog?.(`🧠 AI 프롬프트 추론 완료 (${inference.provider})`);
      }
    } catch (e: any) {
      console.log(`[DISPATCH] ⚠️ AI 추론 실패, 원본 프롬프트 사용: ${e.message?.slice(0, 60)}`);
    }
  }

  switch (engine) {
    // ═══ ImageFX (Google, API 키 불필요) ═══
    case 'imagefx': {
      try {
        console.log(`[DISPATCH] 🖼️ ImageFX 시도...`);
        const result = await makeImageFxImage(inferredPrompt, {
          aspectRatio: '16:9',
          isThumbnail,
        }, onLog);
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'ImageFX' };
        }
        console.log(`[DISPATCH] ⚠️ ImageFX 실패: ${result.error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ ImageFX 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'ImageFX 실패' };
    }

    // ═══ Nano Banana Pro (Gemini Imagen — 자체 번역 내장) ═══
    case 'nanobananapro':
    case 'nanobanana': {
      const apiKey = getGeminiApiKey();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'Gemini API 키 없음' };
      }
      try {
        console.log(`[DISPATCH] 🍌 NanoBanana Pro 시도...`);
        // NanoBanana는 내부에서 자체 프롬프트 생성 → 원본 전달
        const result = await makeNanoBananaProThumbnail(prompt, keyword, {
          apiKey,
          aspectRatio: '16:9',
          isThumbnail,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'Nano Banana Pro' };
        }
        console.log(`[DISPATCH] ⚠️ NanoBanana 실패: ${(result as any).error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ NanoBanana 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'NanoBanana Pro 실패' };
    }

    // ═══ DeepInfra FLUX-2 ═══
    case 'deepinfra': {
      const apiKey = (env['deepInfraApiKey'] || env['DEEPINFRA_API_KEY'] || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'DeepInfra API 키 없음' };
      }
      try {
        console.log(`[DISPATCH] 🔥 DeepInfra 시도...`);
        const { makeDeepInfraThumbnail } = await import('../thumbnail');
        const result = await makeDeepInfraThumbnail(inferredPrompt, keyword, {
          apiKey,
          width: 1024,
          height: 576,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'DeepInfra FLUX-2' };
        }
        console.log(`[DISPATCH] ⚠️ DeepInfra 실패: ${(result as any).error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ DeepInfra 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'DeepInfra 실패' };
    }

    // ═══ Leonardo Phoenix ═══
    case 'leonardo': {
      const apiKey = (env['leonardoKey'] || env['LEONARDO_API_KEY'] || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'Leonardo API 키 없음' };
      }
      try {
        console.log(`[DISPATCH] 🦁 Leonardo Phoenix 시도...`);
        const result = await makeLeonardoPhoenixImage(inferredPrompt, keyword, {
          apiKey,
          width: 1024,
          height: 768,
          isThumbnail,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'Leonardo Phoenix' };
        }
        console.log(`[DISPATCH] ⚠️ Leonardo 실패: ${(result as any).error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ Leonardo 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'Leonardo Phoenix 실패' };
    }

    // ═══ DALL-E (OpenAI) ═══
    case 'dalle': {
      const apiKey = (env['dalleApiKey'] || env['DALLE_API_KEY'] || env['openaiKey'] || env['OPENAI_API_KEY'] || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'OpenAI API 키 없음' };
      }
      try {
        console.log(`[DISPATCH] 🎨 DALL-E 시도...`);
        const result = await makeDalleThumbnail(inferredPrompt, keyword, {
          apiKey,
          width: 1024,
          height: 1024,
          quality: 'standard',
          style: 'natural',
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'DALL-E' };
        }
        console.log(`[DISPATCH] ⚠️ DALL-E 실패: ${(result as any).error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ DALL-E 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'DALL-E 실패' };
    }

    default:
      console.log(`[DISPATCH] ⚠️ 알 수 없는 엔진: ${engine}`);
      return { ok: false, dataUrl: '', source: '', error: `알 수 없는 엔진: ${engine}` };
  }
}

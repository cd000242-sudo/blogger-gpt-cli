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

import { makeNanoBananaProThumbnail } from '../thumbnail';
import { makeImageFxImage } from './imageFxGenerator';
import { makeFlowImage } from './flowGenerator';
import { inferImagePrompt } from './imagePromptInference';
import { loadEnvFromFile } from '../env';

// ── 타입 ──
export interface ImageResult {
  ok: boolean;
  dataUrl: string;
  source: string;
  error?: string;
}

// ── 지원 엔진 목록 (단일 진실 소스) ──
//   2026-05-05 정리: dalle/leonardo/pollinations 제거 (verification 장벽 또는 좀비 코드).
//   nanobananapro 별칭은 aliasMap에서 nanobanana로 흡수.
export const SUPPORTED_IMAGE_ENGINES = [
  'imagefx',
  'flow',
  'nanobanana',
  'deepinfra',
  'text',
  'svg',
  'none',
  'skip',
] as const;

export type ImageEngine = typeof SUPPORTED_IMAGE_ENGINES[number];

/**
 * 사용자 입력(또는 UI 기본값)을 dispatcher가 인식하는 엔진명으로 정규화.
 * 미지원 값 ('auto', 'default', 'pollinations' 이외 레거시 등)이 들어오면 경고 후 'imagefx'로 치환.
 */
export function normalizeImageEngine(raw: string | undefined | null): ImageEngine {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return 'imagefx';
  // 레거시 별칭 매핑
  //   - nanobananapro/leonardo/dalle/pollinations: 모두 제거됨 → 가까운 활성 엔진으로 흡수
  //   - OpenAI 라우트는 verification 장벽 + dall-e 5/12 EOL로 비활성. 별칭은 'imagefx'로 안내성 폴백.
  const aliasMap: Record<string, ImageEngine> = {
    'auto': 'imagefx',
    'default': 'imagefx',
    'nb': 'nanobanana',
    'nano': 'nanobanana',
    'nanobanana2': 'nanobanana',
    'nanobananapro': 'nanobanana',
    'flux': 'deepinfra',
    'openai': 'imagefx',
    'dalle': 'imagefx',
    'leonardo': 'imagefx',
    'pollinations': 'imagefx',
    'labs-flow': 'flow',
    'labsflow': 'flow',
    'googleflow': 'flow',
    'gpt-image-2': 'imagefx',
    'gptimage2': 'imagefx',
    'ducktape': 'imagefx',
    'duct-tape': 'imagefx',
    '덕트테이프': 'imagefx',
    '덕테이프': 'imagefx',
  };
  if (aliasMap[value]) return aliasMap[value];
  if ((SUPPORTED_IMAGE_ENGINES as readonly string[]).includes(value)) {
    return value as ImageEngine;
  }
  console.warn(`[DISPATCH] ⚠️ 미지원 이미지 엔진 '${raw}' → 'imagefx'로 폴백 (지원: ${SUPPORTED_IMAGE_ENGINES.join(', ')})`);
  return 'imagefx';
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

  try {
    // 🔥 통합 디스패처 사용 — 사용자가 선택한 엔진으로 번역
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { callGeminiWithRetry } = require('./final/gemini-engine');

    const instruction = isThumbnail
      ? `Convert this Korean blog title into a concise English image generation prompt for a thumbnail. Focus on atmosphere and visual composition. Return ONLY the English prompt, nothing else.`
      : `Convert this Korean blog heading into a concise English image generation prompt. Focus on the scene, objects, and atmosphere. The image must have ZERO text. Return ONLY the English prompt, nothing else.`;

    const result = await callGeminiWithRetry(`${instruction}\n\nKorean: ${koreanPrompt}`);
    const translated = (typeof result === 'string' ? result : result?.text || '').trim();

    if (translated && translated.length > 5) {
      const enhanced = enhancePrompt(translated, isThumbnail);
      _translationCache.set(cacheKey, enhanced);
      console.log(`[DISPATCH] 🌐 프롬프트 번역: "${koreanPrompt.slice(0, 30)}..." → "${enhanced.slice(0, 50)}..."`);
      return enhanced;
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
  // 한국어→영어 키워드 매핑 (100+ 주요 블로그 키워드)
  const mappings: Record<string, string> = {
    // 가전/IT
    '세탁기': 'washing machine', '냉장고': 'refrigerator', '노트북': 'laptop',
    '스마트폰': 'smartphone', '에어컨': 'air conditioner', '청소기': 'vacuum cleaner',
    '모니터': 'monitor', '키보드': 'keyboard', '마우스': 'mouse', '태블릿': 'tablet',
    '이어폰': 'earbuds', '헤드폰': 'headphones', '카메라': 'camera', '프린터': 'printer',
    '공기청정기': 'air purifier', '건조기': 'dryer', '식기세척기': 'dishwasher',
    '전자레인지': 'microwave', '로봇청소기': 'robot vacuum', '정수기': 'water purifier',
    // 생활
    '여행': 'travel', '음식': 'food', '건강': 'health', '운동': 'exercise',
    '다이어트': 'diet', '요리': 'cooking', '레시피': 'recipe', '인테리어': 'interior design',
    '청소': 'cleaning', '수납': 'storage organization', '이사': 'moving',
    '반려동물': 'pet', '강아지': 'dog', '고양이': 'cat', '식물': 'plant',
    '캠핑': 'camping', '등산': 'hiking', '낚시': 'fishing', '자전거': 'bicycle',
    // 뷰티/패션
    '뷰티': 'beauty', '패션': 'fashion', '화장품': 'cosmetics', '스킨케어': 'skincare',
    '헤어': 'hair', '네일': 'nail art', '향수': 'perfume', '선크림': 'sunscreen',
    '메이크업': 'makeup', '의류': 'clothing', '신발': 'shoes', '가방': 'bag',
    // 금융/비즈니스
    '금융': 'finance', '투자': 'investment', '주식': 'stocks', '부동산': 'real estate',
    '보험': 'insurance', '대출': 'loan', '저축': 'savings', '연금': 'pension',
    '세금': 'tax', '카드': 'credit card', '은행': 'bank', '창업': 'startup',
    // 교육/자기개발
    '공부': 'study', '영어': 'English', '자격증': 'certification', '시험': 'exam',
    '독서': 'reading', '코딩': 'coding', '프로그래밍': 'programming',
    // 자동차
    '자동차': 'car', '전기차': 'electric vehicle', '중고차': 'used car',
    '타이어': 'tire', '세차': 'car wash', '주차': 'parking',
    // 음식/맛집
    '맛집': 'restaurant', '카페': 'cafe', '배달': 'delivery', '디저트': 'dessert',
    '커피': 'coffee', '빵': 'bakery', '라멘': 'ramen', '치킨': 'fried chicken',
    '피자': 'pizza', '삼겹살': 'grilled pork belly', '회': 'sashimi',
    // 기술/트렌드
    '기술': 'technology', '인공지능': 'artificial intelligence', 'AI': 'AI',
    '앱': 'app', '소프트웨어': 'software', '클라우드': 'cloud computing',
    // 일반 수식어
    '추천': 'recommendation', '비교': 'comparison', '후기': 'review',
    '방법': 'method', '효과': 'effect', '가격': 'price', '순위': 'ranking',
    '장단점': 'pros and cons', '선택': 'choosing', '구매': 'buying guide',
    '사용법': 'how to use', '설치': 'installation', '관리': 'maintenance',
    '핵심': 'key points', '정리': 'summary', '완벽': 'complete',
    '최신': 'latest', '트렌드': 'trend', '인기': 'popular', '필수': 'essential',
  };
  let result = koreanPrompt;
  for (const [ko, en] of Object.entries(mappings)) {
    result = result.replace(new RegExp(ko, 'gi'), en);
  }
  // 한국어가 여전히 남아있으면 generic prompt로 전환
  if (/[\uAC00-\uD7AF]/.test(result)) {
    // 매핑되지 않은 한국어가 있으면 주제를 추상적으로 해석
    const cleanedKorean = koreanPrompt.replace(/[^\uAC00-\uD7AF\s]/g, '').trim();
    result = `A professional, clean, modern blog illustration about "${cleanedKorean}", minimalist style, Korean aesthetic`;
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
  contentMode?: string,
): Promise<ImageResult> {
  // 🧹 입력 정규화 — 'auto'/'default'/미지원 값은 즉시 감지
  const normalizedSource = normalizeImageEngine(imageSource);
  if (normalizedSource !== imageSource) {
    console.log(`[DISPATCH] 🔧 엔진명 정규화: '${imageSource}' → '${normalizedSource}'`);
    onLog?.(`🔧 엔진명 정규화: '${imageSource}' → '${normalizedSource}'`);
  }
  imageSource = normalizedSource;

  // 🚫 '없음' 선택 → 즉시 빈 결과 (폴백 체인 실행 방지)
  if (imageSource === 'none' || imageSource === 'skip') {
    return { ok: false, dataUrl: '', source: '', error: '이미지 생성 스킵 (사용자 선택)' };
  }

  const env = getCachedEnv();

  // ── 1순위: 사용자 선택 엔진 ──
  const primaryResult = await tryEngine(imageSource, prompt, keyword, env, onLog, false, contentMode);
  if (primaryResult.ok) return primaryResult;

  console.log(`[DISPATCH] ⚠️ 1순위 ${imageSource} 실패 (${primaryResult.error || '사유 미상'}) → 폴백 체인 시작`);
  onLog?.(`⚠️ 사용자 선택 엔진(${imageSource}) 실패: ${primaryResult.error || '사유 미상'} → 다른 엔진으로 폴백 시도`);

  // ── 2순위: 폴백 체인 ──
  //   2026-05-05 정리: dalle/leonardo/pollinations 제거. nanobanana(나노바나나2) 우선.
  //   사용자 메인 타겟인 'nanobanana'를 첫 폴백으로 둬서 다른 엔진 실패 시 즉시 회복.
  const fallbackOrder = ['nanobanana', 'imagefx', 'flow', 'deepinfra']
    .filter(e => e !== imageSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, prompt, keyword, env, onLog, false, contentMode);
    if (result.ok) {
      console.log(`[DISPATCH] ✅ 폴백 성공: ${engine}`);
      onLog?.(`ℹ️ 폴백 성공: ${engine} 엔진으로 이미지 생성됨`);
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
  thumbnailSourceRaw: string,
  title: string,
  keyword: string,
  onLog?: (msg: string) => void,
): Promise<ImageResult> {
  // 🔍 사용자가 특정 엔진을 명시 선택했는지(=폴백으로 다른 AI 엔진에 자동으로 넘어가면 안 됨)
  //    'auto'/'default'/빈값 → 암묵적 선택, 폴백 체인 허용
  //    그 외 값 → 명시 선택, 실패 시 SVG로만 대체(다른 AI 엔진 금지)
  const rawLower = (thumbnailSourceRaw || '').trim().toLowerCase();
  const userPickedExplicitly = !!rawLower && rawLower !== 'auto' && rawLower !== 'default';

  // 🧹 입력 정규화 — 'auto'/'default'/미지원 값은 즉시 감지
  const normalizedSource = normalizeImageEngine(thumbnailSourceRaw);
  if (normalizedSource !== rawLower) {
    console.log(`[DISPATCH-THUMB] 🔧 엔진명 정규화: '${thumbnailSourceRaw}' → '${normalizedSource}'`);
    onLog?.(`🔧 썸네일 엔진명 정규화: '${thumbnailSourceRaw}' → '${normalizedSource}'`);
  }
  const thumbnailSource: ImageEngine = normalizedSource;

  // 🚫 '없음' 선택 → 즉시 빈 결과
  if (thumbnailSource === 'none' || thumbnailSource === 'skip') {
    return { ok: false, dataUrl: '', source: '', error: '썸네일 생성 스킵 (사용자 선택)' };
  }

  const env = getCachedEnv();

  // text/svg 모드 → 더 이상 지원하지 않음 (SVG 텍스트 썸네일 폐지)
  if (thumbnailSource === 'text' || thumbnailSource === 'svg') {
    onLog?.(`ℹ️ 'text/svg' 모드는 폐지되었습니다 — imagefx로 자동 전환합니다.`);
    const fallback = await tryEngine('imagefx', title, keyword, env, onLog, true);
    if (fallback.ok) return fallback;
    return { ok: false, dataUrl: '', source: '', error: 'SVG 텍스트 썸네일은 폐지되었고 imagefx 폴백도 실패했습니다.' };
  }

  // AI 이미지 엔진 1순위
  const primaryResult = await tryEngine(thumbnailSource, title, keyword, env, onLog, true);
  if (primaryResult.ok) return primaryResult;

  console.error(`[DISPATCH-THUMB] ❌ 1순위 ${thumbnailSource} 실패: ${primaryResult.error || '사유 미상'}`);
  onLog?.(`❌ ${thumbnailSource} 썸네일 실패: ${primaryResult.error || '사유 미상'}`);

  // 🛡️ 엄격 모드 — STRICT_THUMBNAIL_ENGINE=true 일 때 명시 선택 엔진 실패 시 즉시 fail (다른 AI도 SVG도 사용 안 함)
  //    SVG 텍스트 썸네일은 폐지됨. 흰배경 텍스트 결과 절대 안 나옴.
  const strictMode = String(process.env['STRICT_THUMBNAIL_ENGINE'] || '').toLowerCase() === 'true';
  if (userPickedExplicitly && strictMode) {
    onLog?.(`🛡️ 엄격 모드: '${thumbnailSource}' 실패 — 다른 엔진으로 폴백하지 않고 종료 (SVG 폐지)`);
    return { ok: false, dataUrl: '', source: '', error: `${thumbnailSource} 실패 (엄격 모드 — 다른 AI/SVG 폴백 금지)` };
  }

  // 🔄 기본 동작: 명시 선택이든 auto든 다른 AI 엔진으로 자동 폴백 (사용 가능한 첫 엔진 사용)
  if (userPickedExplicitly) {
    onLog?.(`🔄 '${thumbnailSource}' 실패 → 다른 AI 엔진으로 자동 폴백 시도 (엄격 모드 OFF)`);
  } else {
    onLog?.(`ℹ️ 'auto' 모드 → 폴백 체인 시작`);
  }

  // 폴백 체인 — 2026-05-05 정리: 사용자 메인 타겟(nanobanana) 우선, 무료/구독/유료 순.
  const fallbackOrder = ['nanobanana', 'imagefx', 'flow', 'deepinfra']
    .filter(e => e !== thumbnailSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, title, keyword, env, onLog, true);
    if (result.ok) {
      const sourceLabel = userPickedExplicitly
        ? `${result.source} (요청한 ${thumbnailSource} 실패 → 자동 폴백)`
        : result.source;
      console.log(`[DISPATCH-THUMB] ✅ 폴백 성공: ${engine} (원래 요청: ${rawLower || 'auto'})`);
      onLog?.(`🔄 폴백 성공: ${engine} (${rawLower || 'auto'} → ${engine})`);
      return { ...result, source: sourceLabel };
    }
  }

  // 모든 AI 엔진 실패 — SVG 폴백 폐지. 빈 결과 반환하여 호출자가 "썸네일 없음"으로 처리.
  onLog?.(`❌ 모든 AI 엔진 실패 — SVG 폴백은 폐지됐으므로 썸네일 없이 진행합니다.`);
  return { ok: false, dataUrl: '', source: '', error: '모든 AI 썸네일 엔진 실패 (SVG 폴백 폐지)' };
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
  contentMode?: string,
): Promise<ImageResult> {
  // 🧠 AI 추론 프롬프트: 1회만 호출하여 모든 엔진에서 재사용
  // NanoBanana와 Flow는 한국어 프롬프트 그대로 받아서 자체 번역 — 영어 추론 생략
  let inferredPrompt = prompt;
  if (engine !== 'nanobanana' && engine !== 'flow') {
    try {
      const inference = await inferImagePrompt(prompt, keyword, isThumbnail, contentMode);
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

    // ═══ Flow (Google Labs Flow — Nano Banana Pro 무료, API 키 불필요) ═══
    //    Google AI Pro 구독 + labs.google/flow 접근 권한 필요.
    //    ImageFX와 동일한 labs.google 세션 재사용 (별도 로그인 불필요).
    case 'flow': {
      try {
        console.log(`[DISPATCH] 🌊 Flow 시도...`);
        const result = await makeFlowImage(inferredPrompt, {
          aspectRatio: '16:9',
          isThumbnail,
        }, onLog);
        if (result.ok) {
          const modelTag = result.modelUsed ? ` (${result.modelUsed})` : '';
          return { ok: true, dataUrl: result.dataUrl, source: `Flow${modelTag}` };
        }
        console.log(`[DISPATCH] ⚠️ Flow 실패: ${result.error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ Flow 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: 'Flow 실패' };
    }

    // ═══ Nano Banana 2 (Gemini 3.1 Flash Image · 자체 번역 내장) ═══
    //   체인: gemini-3.1-flash-image-preview → gemini-2.5-flash-image (thumbnail.ts 내부)
    case 'nanobanana': {
      const apiKey = getGeminiApiKey();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'Gemini API 키 없음' };
      }
      try {
        console.log(`[DISPATCH] 🍌 나노바나나2 시도...`);
        const result = await makeNanoBananaProThumbnail(prompt, keyword, {
          apiKey,
          aspectRatio: '16:9',
          isThumbnail,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'Nano Banana 2' };
        }
        console.log(`[DISPATCH] ⚠️ 나노바나나2 실패: ${(result as any).error}`);
      } catch (e: any) {
        console.log(`[DISPATCH] ⚠️ 나노바나나2 예외: ${e.message}`);
      }
      return { ok: false, dataUrl: '', source: '', error: '나노바나나2 실패' };
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

    // Leonardo / DALL-E / Pollinations 케이스 제거 (2026-05-05)
    //   - DALL-E: dall-e 5/12 EOL + gpt-image-* verification 장벽
    //   - Leonardo: UI에 노출 안 됨 (좀비 호출 방지)
    //   - Pollinations: 저품질 → 사용자 메인 타겟(나노바나나2)으로 자동 폴백되도록 제거

    default:
      console.log(`[DISPATCH] ⚠️ 알 수 없는 엔진: ${engine}`);
      return { ok: false, dataUrl: '', source: '', error: `알 수 없는 엔진: ${engine}` };
  }
}

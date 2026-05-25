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
//   v3.5.74: 'crawled' 추가 — URL 수집 이미지를 그대로 사용 (orchestration이 분기 처리)
//   v3.5.88: 나노바나나 3종 + GPT 이미지 2종을 독립 엔진으로 분리
//     - nanobanana       = gemini-2.5-flash-image       (저비용 원조)
//     - nanobanana2      = gemini-3.1-flash-image-preview (Pro 품질·Flash 가격, 현재 메인)
//     - nanobananapro    = gemini-3-pro-image-preview    (Pro 모델, 비용 高)
//     - gptimage1        = OpenAI gpt-image-1
//     - gptimage2        = OpenAI gpt-image-2 (덕테이프) — 신분증 인증 필수
export const SUPPORTED_IMAGE_ENGINES = [
  'imagefx',
  'flow',
  'nanobanana',
  'nanobanana2',
  'nanobananapro',
  'gptimage1',
  'gptimage2',
  'prodia',       // v3.5.90: Prodia FLUX schnell (가성비 챔피언, ≈$0.001/장)
  'deepinfra',
  'crawled',
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
  //   v3.5.88: nanobanana 3종·gpt-image 2종이 정식 분리됨 → alias를 정식 엔진으로 매핑
  //   - leonardo/dalle/pollinations: 제거됨 → 가까운 활성 엔진으로 흡수
  const aliasMap: Record<string, ImageEngine> = {
    'auto': 'imagefx',
    'default': 'imagefx',
    'nb': 'nanobanana',
    'nano': 'nanobanana',
    // 나노바나나 별칭 — 정식 엔진으로 매핑
    'nanobanana-2': 'nanobanana2',
    'nano-banana-2': 'nanobanana2',
    'nanobanana-pro': 'nanobananapro',
    'nano-banana-pro': 'nanobananapro',
    // GPT 이미지 별칭
    'gpt-image-1': 'gptimage1',
    'gptimage-1': 'gptimage1',
    'gpt-image-2': 'gptimage2',
    'gptimage-2': 'gptimage2',
    'ducktape': 'gptimage2',
    'duct-tape': 'gptimage2',
    '덕트테이프': 'gptimage2',
    '덕테이프': 'gptimage2',
    // 기타 alias
    'flux': 'deepinfra',
    'flux-schnell': 'prodia',     // FLUX schnell 기본 라우트 → Prodia
    'flux_schnell': 'prodia',
    'fluxschnell': 'prodia',
    'openai': 'gptimage1',
    'dalle': 'gptimage1',
    'leonardo': 'imagefx',
    'pollinations': 'imagefx',
    'labs-flow': 'flow',
    'labsflow': 'flow',
    'googleflow': 'flow',
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

/** 🛡️ T-2 (v3.5.84): 글 단위 env 캐시 강제 reset
 *  큐 모드에서 첫 글 실행 중 env 변경(API 키 추가 등)이 30초 캐시에 막혀
 *  두 번째 글에서도 옛 캐시를 사용하던 문제 차단.
 *  orchestration 시작부에서 호출.
 */
export function resetImageDispatcherEnvCache(): void {
  if (_envCache !== null) {
    console.log('[DISPATCH] 🔄 _envCache 글 단위 reset');
    _envCache = null;
    _envCacheTime = 0;
  }
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
/**
 * 🛡️ v3.5.86: 한국어 위험 키워드 처리 — 의미 보존 변환 + 의미 파괴 키워드는 문장 통째 제거
 *
 *   기존 R-5의 문제: '시신' → '안전', '폭탄' → '안전' 같은 매핑이 의미 파괴 → 이미지 품질 저하
 *
 *   개선:
 *   - SAFE_REPHRASE: 의미 보존 매핑만 — 안전 필터 회피하면서 원 의미 유지
 *   - DROP_KEYWORDS: 의미 보존 변환 불가능한 강한 위험 키워드 — 해당 문장 통째 제거
 */
const SAFE_REPHRASE: Record<string, string> = {
  '탄핵': '정치 변화', '시위': '집회', '폭동': '소요',
  '사기': '소비자 피해', '도박': '레저', '파산': '재무 위기',
  '폭락': '하락', '음주': '음료',
};

const DROP_KEYWORDS = [
  '폭력', '범죄', '사망', '자살', '부상', '혈액', '마약',
  '공격', '살인', '테러', '폭탄', '전쟁', '시신', '총기', '흉기',
  '성인', '누드', '수술',
];

function preSanitizePrompt(prompt: string, onLog?: (msg: string) => void): string {
  let sanitized = prompt;
  let rephrased = 0;
  let dropped = 0;

  // 1단계: 의미 보존 변환
  for (const [risky, safe] of Object.entries(SAFE_REPHRASE)) {
    if (sanitized.includes(risky)) {
      sanitized = sanitized.split(risky).join(safe);
      rephrased++;
    }
  }

  // 2단계: 의미 파괴 키워드 → 해당 문장 제거 (마침표/물음표/느낌표/줄바꿈 단위)
  const dangerousFound = DROP_KEYWORDS.filter(kw => sanitized.includes(kw));
  if (dangerousFound.length > 0) {
    // 문장 단위로 split 후 위험 키워드 포함된 것만 제거
    const sentences = sanitized.split(/(?<=[.!?。\n])/);
    const safeSentences = sentences.filter(s => !DROP_KEYWORDS.some(kw => s.includes(kw)));
    if (safeSentences.length < sentences.length) {
      dropped = sentences.length - safeSentences.length;
      sanitized = safeSentences.join('').trim();
    }
    // 문장 분리 후에도 남은 위험 키워드는 단순 제거 (안전망)
    for (const kw of DROP_KEYWORDS) {
      sanitized = sanitized.split(kw).join('');
    }
  }

  if (rephrased > 0 || dropped > 0) {
    console.log(`[DISPATCH] 🛡️ 프롬프트 사전 안전화 — ${rephrased}개 변환, ${dropped}개 문장 제거`);
    onLog?.(`🛡️ 프롬프트 안전화 (변환 ${rephrased} / 문장 제거 ${dropped})`);
  }

  // 빈 문자열 방지
  return sanitized.trim() || prompt; // 모든 문장이 제거되면 원본 반환 (이미지 엔진이 안전필터로 막아냄)
}

// v3.5.89: GPT 이미지(gpt-image-1/2) 사용자 선택 quality 전달용
//   - low/medium/high — OpenAI 공식 가격은 quality 별로 다름
//   - dispatcher signature 호환성 유지를 위해 새 옵션 객체로 받음
export interface DispatchExtraOptions {
  gptImageQuality?: 'low' | 'medium' | 'high';
}

export async function dispatchH2ImageGeneration(
  imageSource: string,
  prompt: string,
  keyword: string,
  onLog?: (msg: string) => void,
  contentMode?: string,
  extra?: DispatchExtraOptions,
): Promise<ImageResult> {
  // 🔍 raw 값에서 사용자 명시 선택 여부 판단 (정규화 전에 검사 — 'auto'/'default'/빈값은 imagefx로 normalize되기 때문)
  const rawLower = (imageSource || '').trim().toLowerCase();
  const userPickedExplicitly = !!rawLower
    && rawLower !== 'auto'
    && rawLower !== 'default';

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

  // 🛡️ R-5 (v3.5.85): 모든 엔진 호출 전 프롬프트 사전 안전화
  prompt = preSanitizePrompt(prompt, onLog);

  const env = getCachedEnv();
  // 🛡️ v3.5.87: 사용자 명시 선택 = 자동 strict 모드 (env var 없이도 폴백 차단)
  //   기존: STRICT_H2_IMAGE_ENGINE=true 일 때만 폴백 차단 → 사용자가 'flow' 골라도 nanobanana 폴백
  //   변경: 사용자가 명시 선택했으면 무조건 strict — "선택한 엔진이 안 되면 에러"가 사용자 의도
  const envStrict = String(process.env['STRICT_H2_IMAGE_ENGINE'] || '').toLowerCase() === 'true';
  const strictMode = userPickedExplicitly || envStrict;

  // 🛡️ S-2 + S-4 (v3.5.84): Strict 모드 + 에러 분류기 통합
  //   사용자 요구: "선택한 엔진이 반드시 성공" / "폴백 차단" / "에러 분류 후 우회 가능한 것만 우회"
  //   동작:
  //     1. tryEngine 실패 → classifyImageError로 분류
  //     2. unrecoverable (Pro 미가입/billing/region) → 즉시 throw (사용자 알림)
  //     3. bypassable (401/503/safety/network) → cooldown 후 재시도 (최대 3회)
  //     4. 3회 모두 실패 → throw (발행 차단)
  if (strictMode) {
    const { classifyImageError, categoryLabel } = require('./image-error-classifier');
    console.log(`[DISPATCH] 🛡️ Strict 모드 ON — '${imageSource}' 엔진 고정 (폴백 차단)`);
    onLog?.(`🛡️ 엔진 고정 모드 ON — '${imageSource}'만 시도합니다 (폴백 차단)`);

    const MAX_STRICT_RETRIES = 3;
    let lastClassification: any = null;

    for (let attempt = 1; attempt <= MAX_STRICT_RETRIES; attempt++) {
      const result = await tryEngine(imageSource, prompt, keyword, env, onLog, false, contentMode, extra);
      if (result.ok) {
        if (attempt > 1) onLog?.(`✅ '${imageSource}' ${attempt}회차 시도 성공`);
        return result;
      }

      const classification = classifyImageError(result.error || '');
      lastClassification = classification;
      const label = categoryLabel(classification.category);

      console.log(`[DISPATCH] ❌ ${imageSource} 시도 ${attempt}/${MAX_STRICT_RETRIES} — ${label}: ${(result.error || '').substring(0, 200)}`);
      onLog?.(`❌ '${imageSource}' 시도 ${attempt}/${MAX_STRICT_RETRIES}: ${label} — ${classification.userMessage}`);

      // 우회 불가 에러 — 즉시 throw
      if (!classification.bypassable) {
        console.error(`[DISPATCH] 🛑 우회 불가 에러 — 즉시 발행 차단`);
        onLog?.(`🛑 ${label} — 자동 우회 불가, 발행 차단합니다`);
        throw new Error(`STRICT_ENGINE_FAILED:${classification.category}:${classification.userMessage}`);
      }

      // 우회 가능 에러 — recommendedAction 따라 처리
      if (attempt < MAX_STRICT_RETRIES) {
        if (classification.cooldownMs > 0) {
          const waitSec = Math.ceil(classification.cooldownMs / 1000);
          onLog?.(`⏳ ${waitSec}초 대기 후 재시도 (${attempt + 1}/${MAX_STRICT_RETRIES})`);
          await new Promise(r => setTimeout(r, classification.cooldownMs));
        }
      }
    }

    // 3회 모두 실패 → throw
    const finalCategory = lastClassification?.category || 'unknown';
    const finalMsg = lastClassification?.userMessage || '알 수 없는 에러';
    console.error(`[DISPATCH] ❌ Strict 모드 ${MAX_STRICT_RETRIES}회 모두 실패: ${imageSource} (${finalCategory})`);
    onLog?.(`❌ '${imageSource}' ${MAX_STRICT_RETRIES}회 시도 후 실패 — 발행 차단`);
    throw new Error(`STRICT_ENGINE_FAILED:${finalCategory}:${finalMsg}`);
  }

  // ── 일반 모드 (strict OFF) ──
  // 1순위: 사용자 선택 엔진
  const primaryResult = await tryEngine(imageSource, prompt, keyword, env, onLog, false, contentMode, extra);
  if (primaryResult.ok) return primaryResult;

  console.log(`[DISPATCH] ⚠️ 1순위 ${imageSource} 실패 (${primaryResult.error || '사유 미상'}) → 폴백 체인 시작`);
  onLog?.(`⚠️ 사용자 선택 엔진(${imageSource}) 실패: ${primaryResult.error || '사유 미상'} → 다른 엔진으로 폴백 시도`);

  // 2순위: 폴백 체인
  //   2026-05-05 정리: dalle/leonardo/pollinations 제거. nanobanana(나노바나나2) 우선.
  //   사용자 메인 타겟인 'nanobanana'를 첫 폴백으로 둬서 다른 엔진 실패 시 즉시 회복.
  const fallbackOrder = ['nanobanana', 'imagefx', 'flow', 'deepinfra']
    .filter(e => e !== imageSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, prompt, keyword, env, onLog, false, contentMode, extra);
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
  extra?: DispatchExtraOptions,
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

  // 🛡️ R-5 (v3.5.85): 썸네일 prompt(=title)도 사전 안전화
  title = preSanitizePrompt(title, onLog);

  const env = getCachedEnv();

  // text/svg 모드 → 더 이상 지원하지 않음 (SVG 텍스트 썸네일 폐지)
  if (thumbnailSource === 'text' || thumbnailSource === 'svg') {
    onLog?.(`ℹ️ 'text/svg' 모드는 폐지되었습니다 — imagefx로 자동 전환합니다.`);
    const fallback = await tryEngine('imagefx', title, keyword, env, onLog, true, undefined, extra);
    if (fallback.ok) return fallback;
    return { ok: false, dataUrl: '', source: '', error: 'SVG 텍스트 썸네일은 폐지되었고 imagefx 폴백도 실패했습니다.' };
  }

  // AI 이미지 엔진 1순위
  const primaryResult = await tryEngine(thumbnailSource, title, keyword, env, onLog, true, undefined, extra);
  if (primaryResult.ok) return primaryResult;

  console.error(`[DISPATCH-THUMB] ❌ 1순위 ${thumbnailSource} 실패: ${primaryResult.error || '사유 미상'}`);
  onLog?.(`❌ ${thumbnailSource} 썸네일 실패: ${primaryResult.error || '사유 미상'}`);

  // 🛡️ v3.5.87: 사용자 명시 선택 = 자동 엄격 모드 (env var 없이도 폴백 차단)
  //   기존: STRICT_THUMBNAIL_ENGINE=true 일 때만 차단 → 'flow' 골라도 nanobanana 폴백
  //   변경: 명시 선택이면 무조건 차단 — 선택한 엔진이 안 되면 에러가 사용자 의도
  //   'auto'/'default'/빈값일 때만 폴백 체인 허용.
  if (userPickedExplicitly) {
    onLog?.(`🛡️ 엄격 모드: '${thumbnailSource}' 실패 — 다른 엔진으로 폴백하지 않고 종료 (선택한 엔진 고정)`);
    return {
      ok: false,
      dataUrl: '',
      source: '',
      error: `${thumbnailSource} 실패: ${primaryResult.error || '사유 미상'} (사용자 명시 선택 — 폴백 차단)`,
    };
  }

  onLog?.(`ℹ️ 'auto' 모드 → 폴백 체인 시작`);

  // 폴백 체인 — 2026-05-05 정리: 사용자 메인 타겟(nanobanana) 우선, 무료/구독/유료 순.
  const fallbackOrder = ['nanobanana', 'imagefx', 'flow', 'deepinfra']
    .filter(e => e !== thumbnailSource);

  for (const engine of fallbackOrder) {
    const result = await tryEngine(engine, title, keyword, env, onLog, true, undefined, extra);
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
  extra?: DispatchExtraOptions,
): Promise<ImageResult> {
  // 🛡️ v3.5.86: 통계 자동 기록 — wrapper로 감싸 모든 return을 가로챔
  const result = await _tryEngineInternal(engine, prompt, keyword, env, onLog, isThumbnail, contentMode, extra);
  try {
    const { recordSuccess, recordFailure } = require('./engine-stats');
    if (result.ok) {
      recordSuccess(engine);
    } else {
      // 에러 메시지에서 카테고리 추출
      let category = 'unknown';
      try {
        const { classifyImageError } = require('./image-error-classifier');
        category = classifyImageError(result.error || '').category;
      } catch { /* ignore */ }
      recordFailure(engine, category);
    }
  } catch (e: any) {
    console.warn('[DISPATCH] 통계 기록 실패 (무시):', e?.message);
  }
  return result;
}

/** tryEngine 실제 구현 — stats wrapper 분리용 */
async function _tryEngineInternal(
  engine: string,
  prompt: string,
  keyword: string,
  env: Record<string, string>,
  onLog?: (msg: string) => void,
  isThumbnail: boolean = false,
  contentMode?: string,
  extra?: DispatchExtraOptions,
): Promise<ImageResult> {
  // 🧠 AI 추론 프롬프트: 1회만 호출하여 모든 엔진에서 재사용
  // NanoBanana 3종 + Flow + GPT Image + Prodia는 내부에서 generateEnglishPrompt 호출하므로 추론 불필요
  let inferredPrompt = prompt;
  if (
    engine !== 'nanobanana' &&
    engine !== 'nanobanana2' &&
    engine !== 'nanobananapro' &&
    engine !== 'gptimage1' &&
    engine !== 'gptimage2' &&
    engine !== 'flow' &&
    engine !== 'prodia'
  ) {
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
      let detail = '사유 미상';
      try {
        console.log(`[DISPATCH] 🖼️ ImageFX 시도...`);
        const result = await makeImageFxImage(inferredPrompt, {
          aspectRatio: '16:9',
          isThumbnail,
        }, onLog);
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'ImageFX' };
        }
        detail = result.error || detail;
        console.log(`[DISPATCH] ⚠️ ImageFX 실패: ${detail}`);
        onLog?.(`⚠️ ImageFX 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ ImageFX 예외: ${detail}`);
        onLog?.(`⚠️ ImageFX ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `ImageFX 실패: ${detail}` };
    }

    // ═══ Flow (Google Labs Flow — Nano Banana Pro 무료, API 키 불필요) ═══
    //    Google AI Pro 구독 + labs.google/flow 접근 권한 필요.
    //    ImageFX와 동일한 labs.google 세션 재사용 (별도 로그인 불필요).
    case 'flow': {
      let detail = '사유 미상';
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
        detail = result.error || detail;
        console.log(`[DISPATCH] ⚠️ Flow 실패: ${detail}`);
        onLog?.(`⚠️ Flow 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ Flow 예외: ${detail}`);
        onLog?.(`⚠️ Flow ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `Flow 실패: ${detail}` };
    }

    // ═══ 나노바나나 3종 (v3.5.88: 모델별 독립 케이스로 분리) ═══
    //   nanobanana    = gemini-2.5-flash-image        (저비용 원조)
    //   nanobanana2   = gemini-3.1-flash-image-preview (Pro 품질·Flash 가격)
    //   nanobananapro = gemini-3-pro-image-preview     (Pro 모델, 비용 高)
    case 'nanobanana':
    case 'nanobanana2':
    case 'nanobananapro': {
      const apiKey = getGeminiApiKey();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'Gemini API 키 없음' };
      }
      const modelMap = {
        'nanobanana':    { id: 'gemini-2.5-flash-image' as const,         label: 'Nano Banana (2.5 저비용)' },
        'nanobanana2':   { id: 'gemini-3.1-flash-image-preview' as const, label: 'Nano Banana 2' },
        'nanobananapro': { id: 'gemini-3-pro-image-preview' as const,     label: 'Nano Banana Pro' },
      };
      const m = modelMap[engine as 'nanobanana' | 'nanobanana2' | 'nanobananapro'];
      let detail = '사유 미상';
      try {
        console.log(`[DISPATCH] 🍌 ${m.label} 시도... (${m.id})`);
        const result = await makeNanoBananaProThumbnail(prompt, keyword, {
          apiKey,
          aspectRatio: '16:9',
          isThumbnail,
          modelId: m.id,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: m.label };
        }
        detail = (result as any).error || detail;
        console.log(`[DISPATCH] ⚠️ ${m.label} 실패: ${detail}`);
        onLog?.(`⚠️ ${m.label} 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ ${m.label} 예외: ${detail}`);
        onLog?.(`⚠️ ${m.label} ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `${m.label} 실패: ${detail}` };
    }

    // ═══ GPT Image 1 / 2 (OpenAI, 신분증 인증 필수) ═══
    //   v3.5.88: gpt-image-1 / gpt-image-2(덕테이프) 정식 라우트.
    //   인증 미완료 시 OPENAI_VERIFICATION_REQUIRED 코드 → UI가 인증 페이지로 안내.
    case 'gptimage1':
    case 'gptimage2': {
      const openaiKey = (env['openaiKey'] || env['OPENAI_API_KEY'] || '').trim();
      if (!openaiKey || openaiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'OpenAI API 키 없음 (OPENAI_API_KEY 설정 필요)' };
      }
      const gptMap = {
        'gptimage1': { id: 'gpt-image-1' as const, label: 'GPT Image 1' },
        'gptimage2': { id: 'gpt-image-2' as const, label: 'GPT Image 2 (덕테이프)' },
      };
      const g = gptMap[engine as 'gptimage1' | 'gptimage2'];
      const gptQuality = extra?.gptImageQuality ?? 'medium';
      let detail = '사유 미상';
      try {
        console.log(`[DISPATCH] 🎯 ${g.label} 시도... (${g.id}, quality=${gptQuality})`);
        const { makeGptImageThumbnail } = await import('../thumbnail');
        const result = await makeGptImageThumbnail(prompt, keyword, {
          apiKey: openaiKey,
          modelId: g.id,
          isThumbnail,
          size: '1536x1024',
          quality: gptQuality,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: `${g.label} · ${gptQuality}` };
        }
        detail = (result as any).error || detail;
        console.log(`[DISPATCH] ⚠️ ${g.label} 실패: ${detail}`);
        onLog?.(`⚠️ ${g.label} 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ ${g.label} 예외: ${detail}`);
        onLog?.(`⚠️ ${g.label} ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `${g.label} 실패: ${detail}` };
    }

    // ═══ Prodia FLUX schnell (가성비 챔피언, v3.5.90) ═══
    //   ≈$0.001/장 (DeepInfra의 1/12), 2~4초 생성, FLUX-1 schnell 2B 모델
    //   디테일 약함 + 한국 인물 약함 + 한글 텍스트 못 그림 — 가격/속도 우선 옵션
    case 'prodia': {
      const apiKey = (env['prodiaApiKey'] || env['PRODIA_API_KEY'] || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'Prodia API 키 없음 (PRODIA_API_KEY 설정 필요)' };
      }
      let detail = '사유 미상';
      try {
        console.log(`[DISPATCH] 🚀 Prodia FLUX schnell 시도...`);
        const { makeProdiaThumbnail } = await import('../thumbnail');
        const result = await makeProdiaThumbnail(inferredPrompt, keyword, {
          apiKey,
          width: isThumbnail ? 1280 : 1024,
          height: isThumbnail ? 720 : 576,
          model: 'flux-schnell',
          steps: 4,
        });
        if (result.ok) {
          return { ok: true, dataUrl: result.dataUrl, source: 'Prodia FLUX schnell' };
        }
        detail = (result as any).error || detail;
        console.log(`[DISPATCH] ⚠️ Prodia 실패: ${detail}`);
        onLog?.(`⚠️ Prodia 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ Prodia 예외: ${detail}`);
        onLog?.(`⚠️ Prodia ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `Prodia 실패: ${detail}` };
    }

    // ═══ DeepInfra FLUX-2 ═══
    case 'deepinfra': {
      const apiKey = (env['deepInfraApiKey'] || env['DEEPINFRA_API_KEY'] || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return { ok: false, dataUrl: '', source: '', error: 'DeepInfra API 키 없음' };
      }
      let detail = '사유 미상';
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
        detail = (result as any).error || detail;
        console.log(`[DISPATCH] ⚠️ DeepInfra 실패: ${detail}`);
        onLog?.(`⚠️ DeepInfra 실패 원인: ${String(detail).substring(0, 300)}`);
      } catch (e: any) {
        detail = `예외: ${e?.message || e}`;
        console.log(`[DISPATCH] ⚠️ DeepInfra 예외: ${detail}`);
        onLog?.(`⚠️ DeepInfra ${detail.substring(0, 300)}`);
      }
      return { ok: false, dataUrl: '', source: '', error: `DeepInfra 실패: ${detail}` };
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

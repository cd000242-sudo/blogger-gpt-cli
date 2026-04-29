// src/thumbnail.ts
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';
import { callGeminiWithRetry } from './core/final/gemini-engine';

export type ThumbOptions = {
  width?: number;   // 기본 800 (최적화)
  height?: number;  // 기본 420 (최적화)
  outDir?: string;  // 기본: os tmp
  titleMaxLines?: number; // 기본 3줄
  tags?: string[];  // 키워드 칩
  brand?: string;   // 좌하단 작은 텍스트 (예: 블로그명)
};


export type PexelsThumbOptions = {
  apiKey: string;   // Pexels API 키
  width?: number;   // 기본 1200
  height?: number;  // 기본 630
  orientation?: 'landscape' | 'portrait' | 'square'; // 기본 'landscape'
  size?: 'large' | 'medium' | 'small'; // 기본 'large'
};

export type CSEThumbOptions = {
  apiKey: string;   // Google CSE API 키
  cx: string;       // Custom Search Engine ID
  width?: number;   // 기본 1200
  height?: number;  // 기본 630
  num?: number;     // 검색 결과 수 (기본 1)
  safe?: 'active' | 'off'; // 안전 검색 (기본 'active')
};

export type DalleThumbOptions = {
  apiKey: string;   // OpenAI API 키
  width?: number;   // 기본 1200
  height?: number;  // 기본 630
  quality?: 'standard' | 'hd'; // 기본 'standard'
  style?: 'vivid' | 'natural'; // 기본 'natural'
};

// 🚀 Pollinations 옵션 (무료, 초고속)
export type PollinationsThumbOptions = {
  width?: number;   // 기본 1200
  height?: number;  // 기본 630
  model?: 'flux' | 'turbo'; // 기본 'turbo' (초고속)
  seed?: number;    // 랜덤 시드
  nologo?: boolean; // 로고 제거 (기본 true)
  enhance?: boolean; // 프롬프트 강화 (기본 false - 속도 우선)
};

// 🍌 Nano Banana Pro 옵션 (Google Imagen 이미지 생성, 최대 4K)
export type NanoBananaProOptions = {
  apiKey: string;   // Gemini API 키 (Imagen 호출용)
  width?: number;   // 기본 1024
  height?: number;  // 기본 1024
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'; // 기본 '16:9'
  isThumbnail?: boolean; // true: 썸네일용 (텍스트 허용), false: 소제목 이미지용 (텍스트 없음)
};

// 🚀 Prodia AI 옵션 (저렴하고 빠른 고품질 이미지 생성)
export type ProdiaThumbOptions = {
  apiKey: string;   // Prodia API 키
  width?: number;   // 기본 1024
  height?: number;  // 기본 1024 (16:9 비율은 1024x576 또는 1280x720)
  model?: 'flux-schnell' | 'flux-dev' | 'sdxl' | 'sd15'; // 기본 'flux-schnell' (가장 빠름)
  steps?: number;   // 생성 단계 수 (기본 4, flux-schnell 최적값)
};

// 🔥 DeepInfra FLUX-2-dev 옵션 (32B 파라미터 초고품질 이미지 생성)
export type DeepInfraThumbOptions = {
  apiKey: string;   // DeepInfra API 키
  width?: number;   // 128-1920, 기본 1024
  height?: number;  // 128-1920, 기본 1024
  numInferenceSteps?: number; // 1-100, 기본 28
  guidanceScale?: number;     // 0-20, 기본 2.5
  seed?: number;              // 랜덤 시드 (빈 값이면 무작위)
};


// 🦁 Leonardo Phoenix 옵션 (Leonardo.ai 최신 고품질 이미지 생성)
export type LeonardoPhoenixOptions = {
  apiKey: string;   // Leonardo.ai API 키
  width?: number;   // 기본 1024
  height?: number;  // 기본 768 (16:9)
  modelPreference?: 'phoenix-1.0' | 'phoenix-0.9'; // 기본 'phoenix-1.0'
  isThumbnail?: boolean; // 썸네일 vs 소제목 이미지
};

export type BackgroundImageOptions = {
  type: 'ai' | 'local' | 'url' | 'none';  // 배경 타입
  source?: string;  // 로컬 파일 경로 또는 URL
  apiKey?: string;  // Pexels/DALL-E API 키
  opacity?: number; // 배경 투명도 (0-1, 기본 0.7)
  blur?: number;    // 배경 블러 효과 (0-20, 기본 10)
  overlay?: {
    color: string;  // 오버레이 색상 (기본 '#000000')
    opacity: number; // 오버레이 투명도 (0-1, 기본 0.4)
  };
};

export type EnhancedThumbOptions = ThumbOptions & {
  background?: BackgroundImageOptions;
};

// 🔥 한국어 제목에서 핵심 키워드 추출 (네이버 SEO 최적화)
function extractKoreanKeywords(title: string): string[] {
  // 불용어 제거
  const stopWords = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과', '도', '만', '까지', '부터', '처럼', '같이', '보다', '위해', '대해', '관한', '통한', '위한', '있는', '없는', '하는', '되는', '된', '할', '될', '한', '그', '저', '이런', '그런', '어떤', '무슨', '왜', '어떻게', '얼마나', '언제', '어디', '누가', '뭐', '뭘', '이것', '그것', '저것'];

  // 특수문자 및 이모지 제거
  const cleaned = title
    .replace(/[🔥💡📋✅💎👉🚀📢🎯📊📌🧵📷]/g, '')
    .replace(/[^\w\s가-힣]/g, ' ')
    .trim();

  // 단어 분리 및 필터링
  const words = cleaned.split(/\s+/).filter(word => {
    if (word.length < 2) return false;
    if (stopWords.includes(word)) return false;
    // 숫자만 있는 단어 제외
    if (/^\d+$/.test(word)) return false;
    return true;
  });

  // 중복 제거 및 상위 5개 반환
  return [...new Set(words)].slice(0, 5);
}

// 🔥 Gemini API를 이용한 한→영 번역 (캐시 포함)
let _translationCache: Map<string, string> = new Map();
let _translationApiKey: string = '';

// 한국어→영어 번역 (🔥 통합 디스패처 사용 — 선택된 엔진)
async function translateToEnglish(koreanText: string, _apiKey?: string): Promise<string> {
  if (!koreanText) return '';
  // 이미 영어인 경우 그대로 반환
  if (!/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(koreanText)) return koreanText;

  // 캐시 확인
  const cacheKey = koreanText.trim().slice(0, 200);
  if (_translationCache.has(cacheKey)) {
    return _translationCache.get(cacheKey)!;
  }

  try {
    // 🔥 통합 디스패처 사용 — 사용자가 선택한 엔진으로 번역 (Gemini/OpenAI/Claude/Perplexity)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { callGeminiWithRetry } = require('./core/final/gemini-engine');
    const translated = await callGeminiWithRetry(
      `Translate the following Korean text to English. Return ONLY the English translation, nothing else. Keep proper nouns and brand names as-is.\n\nKorean: ${koreanText}`
    );
    const translatedText = (typeof translated === 'string' ? translated : translated?.text || '').trim();
    if (translatedText && translatedText.length > 0) {
      console.log(`[TRANSLATE] ✅ "${koreanText.slice(0, 30)}..." → "${translatedText.slice(0, 50)}..."`);
      _translationCache.set(cacheKey, translatedText);
      return translatedText;
    }
  } catch (e: any) {
    console.log(`[TRANSLATE] ⚠️ 번역 예외: ${e.message}, 폴백 사용`);
  }

  return fallbackKeywordTranslate(koreanText);
}

// 폴백: 키워드 매핑 기반 번역
function fallbackKeywordTranslate(text: string): string {
  const keywordMappings: { [key: string]: string } = {
    '세탁기': 'washing machine', '냉장고': 'refrigerator', 'TV': 'television',
    '노트북': 'laptop', '스마트폰': 'smartphone', '카메라': 'camera',
    '헤드폰': 'headphones', '키보드': 'keyboard', '마우스': 'mouse',
    '모니터': 'monitor', '프린터': 'printer', '이어폰': 'earphones',
    '스피커': 'speaker', '게임': 'gaming', '스포츠': 'sports',
    '여행': 'travel', '음식': 'food cuisine', '건강': 'health wellness',
    '뷰티': 'beauty skincare', '패션': 'fashion style', '인테리어': 'interior design',
    '자동차': 'automobile', '부동산': 'real estate', '교육': 'education',
    '금융': 'finance investment', '기술': 'technology', '비즈니스': 'business',
    '엔터테인먼트': 'entertainment', '예술': 'art design', '과학': 'science',
    '환경': 'environment', '동물': 'animal pet', '식물': 'plant garden',
    '음악': 'music', '영화': 'movie film', '책': 'book reading',
    '추천': 'recommendation', '비교': 'comparison', '후기': 'review',
    '방법': 'how to method', '효과': 'effect benefit', '가격': 'price cost',
    '장점': 'advantage benefit', '단점': 'disadvantage', '차이': 'difference',
  };
  let result = text;
  for (const [ko, en] of Object.entries(keywordMappings)) {
    result = result.replace(new RegExp(ko, 'gi'), en);
  }
  return result;
}

// 영어 프롬프트 생성 함수
// isThumbnail: true면 썸네일용 (텍스트 허용), false면 소제목 이미지용 (텍스트 없음)
function generateEnglishPrompt(title: string, topic: string, isThumbnail: boolean = false): string {
  // 입력이 한국어인지 영어인지 감지
  const isKorean = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(title + topic);

  // 🔥🔥🔥 소제목 이미지는 텍스트 완전 배제! (매우 강력한 지시)
  const noTextRule = isThumbnail
    ? ''
    : `

CRITICAL RULES - MUST FOLLOW:
NEVER TEXT.
1. ABSOLUTELY NO TEXT of any kind in the image
2. NO letters, words, numbers, symbols, logos, watermarks
3. NO Korean characters, NO English characters, NO any language text
4. NO signs, labels, banners, or any written content
5. Pure visual imagery ONLY - like a photograph with no text overlay

NEGATIVE PROMPT (STRICT): never text, never letters, never words, never numbers, no typography, no captions, no subtitles, no logo, no watermark.

This image must be 100% text-free.`;

  if (!isKorean && title && topic) {
    // 이미 영어인 경우 — 상황/행동 우선 프롬프트 (한국인 필수)
    return `Create a high-quality, professional photograph for a Korean blog post.
SCENE FOCUS (priority order):
1. SITUATION & ENVIRONMENT: Show the setting, atmosphere, and context related to "${topic}" in a KOREAN setting
2. ACTION & PROCESS: Depict the activity, workflow, or process being described
3. OBJECTS & TOOLS: Include relevant items, products, or equipment
4. PEOPLE: If people appear, they MUST be Korean/East Asian. Show natural, relatable Korean people in everyday situations.

CONTEXT: This is for a Korean audience. All people must look Korean. Setting should feel Korean (Korean office, Korean street, Korean home, etc.)
Concept: ${title}.
Style: modern, clean, engaging, photorealistic, professional stock photo quality. ${noTextRule}`;
  }

  // 한국어인 경우 — 폴백 키워드 매핑 사용 (비동기 번역은 별도 경로)
  const englishPrompt = fallbackKeywordTranslate(`${title} ${topic}`.trim());

  // 🔥 상황/행동 우선 프롬프트 구조 (한국인 필수)
  const basePrompt = isThumbnail
    ? `Create a high-quality, professional image for a Korean blog post about ${englishPrompt}.
SCENE FOCUS (priority order):
1. ENVIRONMENT: Show the relevant setting and atmosphere in a KOREAN context
2. ACTION: Depict the process or activity being described
3. OBJECTS: Include key items or products
4. PEOPLE: If people appear, they MUST be Korean/East Asian. Natural, relatable Korean people.

CONTEXT: For Korean audience. All people must look Korean. Korean setting.
Style: modern, clean, photorealistic, commercial quality, well-lit, sharp focus.`
    : `Generate a cinematic, photorealistic image representing: "${englishPrompt}"

IMAGE COMPOSITION PRIORITY:
1. SCENE & SETTING: The environment in a KOREAN context (Korean office, Korean city, Korean home, etc.)
2. ACTION & PROCESS: What is happening — the activity, workflow, or transformation
3. OBJECTS & TOOLS: Key items, products, or materials involved
4. PEOPLE: If people appear, they MUST be Korean/East Asian. Show natural Korean people in everyday situations.

CONTEXT: This is for a KOREAN blog. All people depicted must be Korean/East Asian.
Style: Cinematic quality, dramatic lighting, rich colors, editorial photography, 8K.
${noTextRule}`;

  return basePrompt;
}

// 🔥 Pollinations용 상세 영어 프롬프트 생성 (간결하지만 구체적)
function generateEnglishPromptForPollinations(title: string, topic: string): string {
  const isKorean = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(title + topic);

  // 한국어 → 영어 키워드 매핑 (뉴스/연예 추가)
  const keywordMappings: { [key: string]: string } = {
    // 연예/뉴스
    '박나래': 'Park Na-rae, Korean comedian',
    '갑질': 'workplace harassment controversy',
    '불법의료': 'illegal medical treatment',
    '활동중단': 'career hiatus announcement',
    '논란': 'controversy scandal',
    '의혹': 'allegations suspicion',
    '연예인': 'celebrity entertainer',
    '방송인': 'TV personality broadcaster',
    // 일반
    '세탁기': 'washing machine',
    '냉장고': 'refrigerator',
    '노트북': 'laptop',
    '스마트폰': 'smartphone',
    '여행': 'travel vacation',
    '음식': 'food cuisine',
    '건강': 'health wellness',
    '뷰티': 'beauty cosmetics',
    '패션': 'fashion style',
    '자동차': 'car automobile',
    '부동산': 'real estate',
    '금융': 'finance investment',
    '기술': 'technology innovation',
    '비즈니스': 'business corporate',
    '스포츠': 'sports athletic',
    '게임': 'gaming video game',
  };

  let englishText = `${title} ${topic}`.trim();

  if (isKorean) {
    // 키워드 변환
    for (const [korean, english] of Object.entries(keywordMappings)) {
      englishText = englishText.replace(new RegExp(korean, 'gi'), english);
    }
  }

  // Pollinations에 최적화된 프롬프트 (간결하지만 효과적)
  return `Professional editorial photograph, ${englishText}, high quality, photorealistic, editorial style, 4K resolution, dramatic lighting. ` +
    `CRITICAL RULES - MUST FOLLOW: NEVER TEXT. ABSOLUTELY NO TEXT, no letters, no words, no numbers, no symbols, no logos, no watermarks, no captions. ` +
    `NEGATIVE: never text, never letters, never words, never numbers, no typography, no subtitles, no watermark.`;
}

// ============================================
// 🖼️ 배경 이미지 생성 및 처리
// ============================================

/**
 * 배경 이미지 Base64 가져오기
 */
async function getBackgroundImageBase64(
  keyword: string,
  options: BackgroundImageOptions
): Promise<string | null> {
  try {
    if (options.type === 'none') {
      return null;
    }

    // 1. AI 배경 (Pexels/DALL-E)
    if (options.type === 'ai') {
      if (!options.apiKey) {
        console.warn('[배경] API 키 없음, AI 배경 생성 불가');
        return null;
      }

      // Pexels 우선 (무료)
      try {
        const result = await makePexelsThumbnail(keyword, keyword, {
          apiKey: options.apiKey,
          width: 1200,
          height: 630,
          orientation: 'landscape',
          size: 'large'
        });

        if (result.ok) {
          console.log('[배경] ✅ Pexels AI 배경 생성');
          return result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        }
      } catch (error) {
        console.log('[배경] Pexels 실패, 기본 배경 사용');
      }
    }

    // 2. 로컬 이미지
    if (options.type === 'local' && options.source) {
      try {
        const imageBuffer = await fs.readFile(options.source);
        const base64 = imageBuffer.toString('base64');
        console.log('[배경] ✅ 로컬 이미지 로드:', options.source);
        return base64;
      } catch (error) {
        console.error('[배경] 로컬 이미지 로드 실패:', error);
        return null;
      }
    }

    // 3. URL 이미지
    if (options.type === 'url' && options.source) {
      try {
        const response = await fetch(options.source);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        console.log('[배경] ✅ URL 이미지 다운로드:', options.source);
        return base64;
      } catch (error) {
        console.error('[배경] URL 이미지 다운로드 실패:', error);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('[배경] 이미지 처리 실패:', error);
    return null;
  }
}

/**
 * 배경 이미지에 텍스트 오버레이 합성
 */
async function compositeBackgroundWithText(
  backgroundBase64: string,
  title: string,
  options: EnhancedThumbOptions
): Promise<string> {
  const width = options.width ?? 1200;
  const height = options.height ?? 630;
  const bgOptions = options.background!;

  try {
    // 배경 이미지 처리
    const bgBuffer = Buffer.from(backgroundBase64, 'base64');
    let bgImage = sharp(bgBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    // 블러 효과
    if (bgOptions.blur && bgOptions.blur > 0) {
      bgImage = bgImage.blur(bgOptions.blur);
    }

    // 투명도 조절
    if (bgOptions.opacity && bgOptions.opacity < 1) {
      bgImage = bgImage.modulate({
        brightness: bgOptions.opacity
      });
    }

    const processedBg = await bgImage.toBuffer();

    // 오버레이 레이어 생성
    const overlayColor = bgOptions.overlay?.color || '#000000';
    const overlayOpacity = bgOptions.overlay?.opacity || 0.4;

    // SVG 텍스트 레이어 생성
    const fontSize = calculateFontSize(title, width, height);
    const maxCharsPerLine = Math.floor((width / 1200) * 30);
    const titleLines = wrapTitle(title, maxCharsPerLine, options.titleMaxLines ?? 4);
    const lineHeight = fontSize * 1.3;
    const totalTextHeight = titleLines.length * lineHeight;
    const startY = (height - totalTextHeight) / 2;

    const textSvg = `
<svg width="${width}" height="${height}">
  <!-- 오버레이 -->
  <rect width="${width}" height="${height}" 
        fill="${overlayColor}" 
        opacity="${overlayOpacity}"/>
  
  <!-- 텍스트 -->
  <text x="${width / 2}" y="${startY}" 
        font-family="'Noto Sans KR', 'Malgun Gothic', sans-serif" 
        font-size="${fontSize}" 
        font-weight="900" 
        fill="#FFFFFF" 
        text-anchor="middle"
        stroke="#000000"
        stroke-width="${Math.max(0.5, fontSize / 100)}"
        paint-order="stroke">
    ${titleLines.map((line, i) =>
      `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`
    ).join('\n    ')}
  </text>
  
  <!-- 브랜드 (선택) -->
  ${options.brand ? `
  <text x="${width / 2}" y="${height - 40}" 
        font-family="'Noto Sans KR', sans-serif" 
        font-size="24" 
        font-weight="700" 
        fill="#FFFFFF" 
        text-anchor="middle"
        opacity="0.8">
    ${esc(options.brand)}
  </text>
  ` : ''}
  
  <!-- 태그 칩 (선택) -->
  ${(options.tags || []).length > 0 ? (options.tags || []).map((tag, i) => {
      const chipWidth = 120;
      const chipHeight = 36;
      const spacing = 10;
      const totalWidth = (options.tags!.length * chipWidth) + ((options.tags!.length - 1) * spacing);
      const startX = (width - totalWidth) / 2;
      const x = startX + (i * (chipWidth + spacing));
      const y = height - 100;

      return `
    <rect x="${x}" y="${y}" 
          width="${chipWidth}" height="${chipHeight}" 
          rx="18" 
          fill="#f97316" 
          opacity="0.9"/>
    <text x="${x + chipWidth / 2}" y="${y + chipHeight / 2}" 
          font-family="'Noto Sans KR', sans-serif" 
          font-size="16" 
          font-weight="600" 
          fill="#FFFFFF" 
          text-anchor="middle" 
          dominant-baseline="middle">
      ${esc(tag)}
    </text>
    `;
    }).join('\n  ') : ''}
</svg>`;

    // 배경 + 텍스트 합성
    const finalImage = await sharp(processedBg)
      .composite([{
        input: Buffer.from(textSvg),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

    const dataUrl = `data:image/png;base64,${finalImage.toString('base64')}`;
    console.log('[배경] ✅ 배경 + 텍스트 합성 완료');

    return dataUrl;

  } catch (error) {
    console.error('[배경] 합성 실패:', error);
    throw error;
  }
}

// 성능 최적화: 텍스트 이스케이프 캐시
const escapeCache = new Map<string, string>();

function esc(s = ''): string {
  if (escapeCache.has(s)) {
    return escapeCache.get(s)!;
  }

  const escaped = String(s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[m]);

  escapeCache.set(s, escaped);
  return escaped;
}
// 제목 길이와 썸네일 크기에 따라 폰트 크기 자동 조절 (1200x630 최적화)
function calculateFontSize(title: string, width: number = 1200, height: number = 630): number {
  const length = title.length;
  const baseWidth = 1200; // 기준 너비
  const baseHeight = 630; // 기준 높이
  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  const scale = Math.min(scaleX, scaleY); // 비율 유지

  // 1200x630 기준 폰트 크기 (더 공격적으로 줄임)
  let baseFontSize: number;
  if (length <= 8) baseFontSize = 110;       // 매우 짧은 제목
  else if (length <= 12) baseFontSize = 90;  // 짧은 제목
  else if (length <= 18) baseFontSize = 75;  // 보통 제목
  else if (length <= 25) baseFontSize = 62;  // 긴 제목
  else if (length <= 32) baseFontSize = 52;  // 매우 긴 제목
  else if (length <= 40) baseFontSize = 44;  // 초장문 제목
  else if (length <= 50) baseFontSize = 38;  // 극초장문 제목
  else baseFontSize = 32;                     // 60자 이상: 최소 폰트

  // 썸네일 크기에 맞게 스케일 조정
  return Math.round(baseFontSize * scale);
}

// 제목을 간단명료하게 핵심만 추출
function extractKeyPhrase(title: string): string {
  // 불필요한 단어 제거 (더 공격적으로)
  // 🔥 제목을 자르지 않고 원본 그대로 사용 (줄바꿈으로 처리)
  // 불필요한 단어만 제거
  const removeWords = [
    '총정리', '완벽', '최신', '완전', '정복', '마스터', '꿀팁', '모음', '대공개',
    '총망라', '한눈에', '바로', '지금', '오늘', '이번', '최고', '베스트'
  ];
  let simplified = title;

  removeWords.forEach(word => {
    simplified = simplified.replace(new RegExp(word, 'g'), '');
  });

  // 공백 정리
  simplified = simplified.trim().replace(/\s+/g, ' ');

  // 🔥 자르지 않음 - 줄바꿈으로 처리할 것이므로 원본 유지
  // 너무 짧으면 원본 제목 사용
  if (simplified.length < 5) {
    simplified = title;
  }

  return simplified;
}

function wrapTitle(title: string, maxLen = 20, maxLines = 6) {
  // 🔥 자연스러운 줄바꿈 - 의미 단위로 분리
  const text = title.trim();

  // 🇰🇷 한국어 감지: 공백이 적은 경우 문자 단위 줄바꿈 필요
  const isKorean = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text);
  const spaceCount = (text.match(/\s+/g) || []).length;
  const needsCharWrap = isKorean && text.length > maxLen && spaceCount < text.length / 10;

  // 🔥 한국어이고 공백이 적으면 문자 단위로 강제 줄바꿈
  if (needsCharWrap) {
    const lines: string[] = [];
    let currentLine = '';

    for (const char of text) {
      // 공백은 현재 줄에 추가하고 다음 문자에서 줄바꿈 판단
      if (char === ' ' || char === '\t') {
        if (currentLine.length > 0 && currentLine.length + 1 <= maxLen) {
          currentLine += char;
        } else if (currentLine.length > 0) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
        continue;
      }

      if (currentLine.length >= maxLen) {
        lines.push(currentLine.trim());
        currentLine = char;
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines.filter(l => l.length > 0).slice(0, maxLines);
  }

  // 1️⃣ 먼저 의미 단위로 분리 시도 (?, !, : 뒤에서 줄바꿈)
  const meaningfulSplit = text.split(/([?!:]\s*)/);
  if (meaningfulSplit.length >= 2 && meaningfulSplit[0] && meaningfulSplit[0].length <= maxLen) {
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < meaningfulSplit.length; i++) {
      const part = meaningfulSplit[i]?.trim() || '';
      if (!part) continue;

      // 구두점만 있는 경우 현재 줄에 붙이기
      if (/^[?!:]+$/.test(part)) {
        currentLine += part;
        continue;
      }

      if (currentLine && currentLine.length + part.length > maxLen) {
        // 현재 줄 저장하고 새 줄 시작
        lines.push(currentLine.trim());
        currentLine = part;
      } else if (currentLine) {
        // 공백 추가해서 붙이기
        currentLine += ' ' + part;
      } else {
        currentLine = part;
      }
    }

    if (currentLine) {
      lines.push(currentLine.trim());
    }

    if (lines.length > 0 && lines.length <= maxLines) {
      return lines.filter(l => l.length > 0);
    }
  }

  // 2️⃣ 의미 단위로 안 되면 단어 단위로 자연스럽게 줄바꿈
  const lines: string[] = [];
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;

    const testLine = currentLine ? currentLine + ' ' + word : word;

    if (testLine.length <= maxLen) {
      currentLine = testLine;
    } else {
      // 현재 줄 저장하고 새 줄 시작
      if (currentLine) {
        lines.push(currentLine);
      }
      // 🔥 긴 단어도 maxLen으로 분할 (한국어 포함 대응)
      if (word.length > maxLen) {
        for (let i = 0; i < word.length; i += maxLen) {
          const chunk = word.substring(i, i + maxLen);
          if (i + maxLen < word.length) {
            lines.push(chunk);
          } else {
            currentLine = chunk;
          }
        }
      } else {
        currentLine = word;
      }
    }
  }

  // 마지막 줄 추가
  if (currentLine) {
    lines.push(currentLine);
  }

  // 🔥 모든 줄 반환 (자르지 않음 - ...으로 끝내지 않음)
  return lines.filter(line => line.length > 0).slice(0, maxLines);
}

/**
 * @deprecated SVG 텍스트 썸네일은 v3.5.54부터 폐지됨.
 * imageDispatcher 어디에서도 더 이상 호출하지 않습니다.
 * 호출 시 빈 결과를 반환해 호출자가 "썸네일 없음"으로 처리하도록 합니다.
 */
export async function makeAutoThumbnail(_title: string, _opt: ThumbOptions = {}): Promise<{ ok: false; error: string }> {
  console.warn('[THUMB] makeAutoThumbnail is deprecated and disabled. SVG 텍스트 썸네일 폐지.');
  return { ok: false, error: 'SVG 텍스트 썸네일은 폐지되었습니다 (v3.5.54+).' };
}

/** @internal — 기존 본문 보존용 (호출 차단됨) */
async function _disabledLegacyMakeAutoThumbnail(title: string, opt: ThumbOptions = {}) {
  const width = opt.width ?? 1200;   // ✅ 1200x630 최적화
  const height = opt.height ?? 630;    // ✅ 1200x630 최적화
  const outDir = opt.outDir ?? process.cwd();

  // 🔥 제목 줄바꿈 처리 (자르지 않고 자연스럽게)
  // 1200px 기준으로 최대 18자/줄 (한글 기준, 더 보수적으로 설정하여 텍스트 잘림 방지)
  const maxCharsPerLine = Math.floor((width / 1200) * 18);
  const titleLines = wrapTitle(title, maxCharsPerLine, opt.titleMaxLines ?? 8);

  // 🔥 줄 수에 따라 폰트 크기 동적 조절 (더 보수적으로 - 텍스트 잘림 방지)
  let fontSize: number;
  if (titleLines.length <= 1) {
    fontSize = Math.floor(height / 6);  // 1줄: 큰 폰트
  } else if (titleLines.length <= 2) {
    fontSize = Math.floor(height / 7);  // 2줄: 중간 폰트
  } else if (titleLines.length <= 3) {
    fontSize = Math.floor(height / 8);  // 3줄: 작은 폰트
  } else if (titleLines.length <= 4) {
    fontSize = Math.floor(height / 9);  // 4줄: 더 작은 폰트
  } else if (titleLines.length <= 5) {
    fontSize = Math.floor(height / 10); // 5줄: 매우 작은 폰트
  } else if (titleLines.length <= 6) {
    fontSize = Math.floor(height / 11); // 6줄: 6줄용 폰트
  } else {
    fontSize = Math.floor(height / 13); // 7줄 이상: 최소 폰트
  }
  const tags = (opt.tags ?? []).filter(Boolean).slice(0, 6);

  // SVG 템플릿 (흰색 배경, 주황색 테두리, 검은 텍스트 - 블로그스팟/워드프레스 최적화)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 주황색 테두리 그라디언트 (블로그스팟/워드프레스 최적화) -->
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="50%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <!-- 텍스트 그림자 -->
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <style><![CDATA[
      .title { 
        font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
        font-weight: 900; 
        font-stretch: condensed;
        fill: #000000; 
        stroke: #000000;
        stroke-width: 0.5;
        paint-order: stroke fill;
        text-anchor: middle;
        dominant-baseline: middle;
        filter: url(#textShadow);
        letter-spacing: -0.5px;
      }
      .chip  { 
        font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif;
        font-weight: 700; 
        fill: #ffffff; 
        text-anchor: middle;
        dominant-baseline: middle;
      }
      .brand { 
        font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif; 
        fill: #7c2d12; 
        font-weight: 700; 
        text-anchor: middle;
        dominant-baseline: middle;
      }
    ]]></style>
  </defs>

  <!-- 흰색 배경 (블로그스팟/워드프레스 최적화) -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" rx="24" ry="24"/>
  
  <!-- 주황색 테두리 (블로그스팟/워드프레스 최적화) -->
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="url(#border)" stroke-width="12" rx="20" ry="20"/>
  
  <!-- 제목 (완벽한 중앙 정렬, 썸네일 크기 최적화, 굵은 텍스트) -->
  <g transform="translate(${width / 2}, ${height / 2})">
    ${titleLines.map((line, i) => {
    // 여러 줄일 경우 정확한 중앙 정렬을 위한 y 오프셋 계산
    const lineHeight = fontSize * 1.2; // 줄 간격
    const totalHeight = (titleLines.length - 1) * lineHeight;
    const yOffset = (i - (titleLines.length - 1) / 2) * lineHeight;
    // stroke-width는 폰트 크기에 비례하여 조정
    const strokeWidth = Math.max(0.5, fontSize / 100);
    return `<text class="title" x="0" y="${yOffset}" font-size="${fontSize}" font-weight="900" stroke-width="${strokeWidth}" text-anchor="middle" dominant-baseline="middle">${esc(line)}</text>`;
  }).join('\n')}
  </g>

  <!-- chips -->
  <g transform="translate(80, ${height - 90})">
    ${tags.map((t, i) => {
    const x = i * 180;
    return `
        <g transform="translate(${x},0)">
          <rect x="0" y="-40" rx="18" ry="18" width="160" height="48"
                fill="#ffffff" opacity="0.85" stroke="#e6eefc"/>
          <text class="chip" x="80" y="-9" font-size="28" text-anchor="middle">${esc(t)}</text>
        </g>`;
  }).join('')}
  </g>

  <!-- brand -->
  ${opt.brand ? `<text class="brand" x="80" y="${height - 24}" font-size="22">${esc(opt.brand)}</text>` : ''}

</svg>`;

  // PNG 랜더링 (최적화된 압축 설정)
  const png = await sharp(Buffer.from(svg))
    .png({
      compressionLevel: 9,
      quality: 85,        // 품질 최적화
      progressive: true,  // 점진적 로딩
      adaptiveFiltering: true  // 적응형 필터링
    })
    .toBuffer();

  // 파일 저장
  const file = path.join(outDir, `thumb-${Date.now()}.png`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(file, png);

  // dataURL 생성 및 최적화
  const base64String = png.toString('base64');
  const dataUrl = `data:image/png;base64,${base64String}`;

  // 데이터 크기 로깅 (디버깅용)
  console.log(`[THUMBNAIL] SVG 썸네일 크기: ${Math.round(base64String.length / 1024)}KB`);

  // 너무 큰 경우 경고
  if (base64String.length > 500000) { // 500KB 이상
    console.warn('[THUMBNAIL] 썸네일 데이터가 큽니다:', Math.round(base64String.length / 1024) + 'KB');
  }

  return { ok: true as const, path: file, dataUrl };
}

/**
 * 배경 이미지 + 텍스트 오버레이 썸네일 생성
 */
export async function makeEnhancedThumbnail(
  title: string,
  keyword: string,
  options: EnhancedThumbOptions = {}
): Promise<{ ok: true; dataUrl: string; path?: string } | { ok: false; error: string }> {
  try {
    const width = options.width ?? 1200;
    const height = options.height ?? 630;

    // 배경 이미지 없으면 SVG 텍스트 폴백 — v3.5.54부터 폐지
    if (!options.background || options.background.type === 'none') {
      return { ok: false, error: '배경 이미지가 없습니다. SVG 텍스트 폴백은 폐지됐습니다 (v3.5.54+).' };
    }

    console.log('[썸네일] 배경 이미지 처리 시작:', options.background.type);

    // 배경 이미지 가져오기
    const backgroundBase64 = await getBackgroundImageBase64(keyword, options.background);

    if (!backgroundBase64) {
      return { ok: false, error: '배경 이미지 로드 실패 (SVG 텍스트 폴백 폐지)' };
    }

    // 배경 + 텍스트 합성
    const dataUrl = await compositeBackgroundWithText(backgroundBase64, title, options);

    // 파일 저장 (선택)
    if (options.outDir) {
      const outPath = path.join(options.outDir, `thumb-${Date.now()}.png`);
      await fs.mkdir(options.outDir, { recursive: true });
      const buffer = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      await fs.writeFile(outPath, buffer);

      return {
        ok: true,
        dataUrl,
        path: outPath
      };
    }

    return {
      ok: true,
      dataUrl
    };

  } catch (error: any) {
    console.error('[썸네일] Enhanced 썸네일 생성 실패:', error);
    return {
      ok: false,
      error: error.message || '썸네일 생성 오류'
    };
  }
}

// CSE 썸네일 생성 함수
export async function makeCSEThumbnail(
  title: string,
  topic: string,
  options: CSEThumbOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    // 주제와 제목을 기반으로 검색 키워드 생성
    const searchQuery = `${topic} ${title}`.replace(/[^\w\s가-힣]/g, ' ').trim();

    // Rate Limiter import 및 사용
    const { safeCSERequest } = await import('./utils/google-cse-rate-limiter');
    const cacheKey = `thumbnail-cse:${searchQuery}`;

    const data = await safeCSERequest<{ items?: Array<{ link: string }> }>(
      searchQuery,
      async () => {
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${options.apiKey}&cx=${options.cx}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${options.num || 1}&safe=${options.safe || 'active'}&imgSize=large&imgType=photo`, {
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`CSE API 오류: ${(errorData as any)?.error?.message || 'Unknown error'}`);
        }

        return await response.json();
      },
      { useCache: true, cacheKey, priority: 'low' }
    );

    const item = data?.items?.[0];

    if (!item) {
      return { ok: false, error: 'CSE에서 적절한 이미지를 찾지 못했습니다' };
    }

    const imageUrl = item.link;

    if (!imageUrl) {
      return { ok: false, error: 'CSE 이미지 URL을 받지 못했습니다' };
    }

    // 이미지를 Base64로 변환
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return { ok: true, dataUrl };
  } catch (error: any) {
    return { ok: false, error: error.message || 'CSE 썸네일 생성 오류' };
  }
}

// Pexels 썸네일 생성 함수
export async function makePexelsThumbnail(
  title: string,
  topic: string,
  options: PexelsThumbOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    // 검색 키워드 후보 목록 (우선순위 순)
    const searchQueries = [
      `${topic} ${title}`.replace(/[^\w\s가-힣]/g, ' ').trim(),
      topic.replace(/[^\w\s가-힣]/g, ' ').trim(),
      title.replace(/[^\w\s가-힣]/g, ' ').trim(),
      // 영어 키워드로 변환 시도 (간단한 키워드만)
      topic.split(' ')[0] || topic
    ].filter(q => q.length > 0);

    // 여러 키워드로 시도
    for (const searchQuery of searchQueries) {
      if (!searchQuery || searchQuery.length < 2) continue;

      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=${options.orientation || 'landscape'}&size=${options.size || 'large'}`, {
        method: 'GET',
        headers: {
          'Authorization': options.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        // 마지막 시도가 아니면 계속 시도
        if (searchQueries.indexOf(searchQuery) < searchQueries.length - 1) {
          continue;
        }
        return { ok: false, error: `Pexels API 오류: ${errorData.error || 'Unknown error'}` };
      }

      const data = await response.json();
      const photo = data.photos?.[0];

      if (photo) {
        // 이미지를 찾았으면 바로 반환
        const imageUrl = photo.src?.large || photo.src?.medium || photo.src?.small || photo.src?.original;

        if (!imageUrl) {
          // 마지막 시도가 아니면 계속 시도
          if (searchQueries.indexOf(searchQuery) < searchQueries.length - 1) {
            continue;
          }
          return { ok: false, error: 'Pexels 이미지 URL을 받지 못했습니다' };
        }

        // 이미지를 Base64로 변환 및 크기 조정
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        // width/height가 지정된 경우 Sharp로 리사이즈
        if (options.width || options.height) {
          const resizedBuffer = await sharp(Buffer.from(imageBuffer))
            .resize(options.width || null, options.height || null, {
              fit: 'cover',
              withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toBuffer();
          const base64 = resizedBuffer.toString('base64');
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          return { ok: true, dataUrl };
        }

        // 크기 조정 없이 원본 사용
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        return { ok: true, dataUrl };
      }

      // 이미지를 찾지 못했지만 마지막 시도가 아니면 계속 시도
      if (searchQueries.indexOf(searchQuery) < searchQueries.length - 1) {
        continue;
      }
    }

    // 모든 키워드로 시도했지만 실패
    return { ok: false, error: 'Pexels에서 적절한 이미지를 찾지 못했습니다' };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Pexels 썸네일 생성 오류' };
  }
}

// DALL-E 썸네일 생성 함수
export async function makeDalleThumbnail(
  title: string,
  topic: string,
  options: DalleThumbOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    // API 키 trim 처리 (앞뒤 공백 제거)
    const apiKey = (options.apiKey || '').trim();

    if (!apiKey || apiKey.length < 20) {
      return { ok: false, error: 'DALL-E API 키가 유효하지 않습니다' };
    }

    // 키워드나 제목을 기반으로 자동 영어 프롬프트 생성
    const prompt = generateEnglishPrompt(title, topic);

    // gpt-image-2 (구 코드명 "duct-tape"): 2026-04-21 OpenAI 공식 출시, API 즉시 사용 가능.
    // 다만 조직별 점진적 롤아웃 + 파라미터 스키마가 dall-e-3와 다르므로 모델별로 body를 분기한다.
    //   - gpt-image-2: prompt/size/n만 안전 (style·response_format 거절 가능, 새 quality enum 사용)
    //   - gpt-image-1: dall-e-3 호환 스키마
    //   - dall-e-3   : style/quality/response_format 모두 지원
    // 권한 없거나 미지원 모델이면 다음 후보로 자동 폴백.
    const dalleSize = '1024x1024';
    const modelChain: string[] = ['gpt-image-2', 'gpt-image-1', 'dall-e-3'];

    const buildBody = (m: string): Record<string, any> => {
      if (m === 'gpt-image-2') {
        // 새 모델 — 검증된 파라미터만 전송
        return { model: m, prompt, n: 1, size: dalleSize };
      }
      // dall-e-3 / gpt-image-1 — 기존 스키마 유지
      return {
        model: m,
        prompt,
        n: 1,
        size: dalleSize,
        quality: options.quality || 'standard',
        style: options.style || 'natural',
        response_format: 'url',
      };
    };

    let response: Response | null = null;
    let usedModel = '';
    let lastErrorBody: any = null;
    for (const m of modelChain) {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBody(m)),
      });
      if (r.ok) {
        response = r;
        usedModel = m;
        break;
      }
      try {
        lastErrorBody = await r.clone().json();
      } catch { lastErrorBody = null; }
      const code = lastErrorBody?.error?.code || '';
      const msg = lastErrorBody?.error?.message || '';
      // 모델 자체가 없거나 권한 없는 경우만 폴백 (인증·결제·rate-limit은 즉시 중단)
      const isModelMissing = r.status === 404
        || /model_not_found|invalid_model|deprecated_model|unsupported_model/i.test(String(code))
        || (r.status === 403 && /access|permission/i.test(String(msg)));
      if (!isModelMissing) {
        response = r;
        usedModel = m;
        break;
      }
      console.log(`[OPENAI-IMG] ⚠️ ${m} 미지원/권한없음 — 다음 모델로 폴백`);
    }
    if (!response) {
      return { ok: false, error: 'OpenAI 이미지 모델 후보 전체 실패' };
    }
    if (response.ok) {
      console.log(`[OPENAI-IMG] 🎨 사용 모델: ${usedModel}`);
    }

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      let errorDetails = '';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || 'Unknown error';
        errorDetails = errorData.error?.code || '';

        // 상세한 에러 메시지 생성
        if (response.status === 401) {
          if (apiKey.startsWith('sk-proj-')) {
            errorMessage = `인증 실패: Organization key의 DALL-E API 접근 권한이 없을 수 있습니다. OpenAI 대시보드(https://platform.openai.com/org-settings)에서 DALL-E API 권한을 확인하세요. 원본 에러: ${errorData.error?.message || 'Unknown error'}`;
          } else {
            errorMessage = `인증 실패: API 키가 올바르지 않거나 만료되었습니다. 원본 에러: ${errorData.error?.message || 'Unknown error'}`;
          }
        } else if (response.status === 429) {
          errorMessage = `할당량 초과: 요청 한도가 초과되었습니다. 잠시 후 다시 시도하세요. 원본 에러: ${errorData.error?.message || 'Unknown error'}`;
        } else if (response.status === 402) {
          errorMessage = `결제 문제: 계정에 충분한 크레딧이 없습니다. https://platform.openai.com/account/billing 에서 확인하세요. 원본 에러: ${errorData.error?.message || 'Unknown error'}`;
        } else {
          errorMessage = `DALL-E API 오류 (${response.status}): ${errorData.error?.message || 'Unknown error'}`;
        }
      } catch (e) {
        // JSON 파싱 실패 시 기본 메시지
        errorMessage = `DALL-E API 오류 (${response.status}): 응답을 파싱할 수 없습니다`;
      }

      return { ok: false, error: errorMessage };
    }

    const data = await response.json();
    // 🔥 응답 호환: dall-e-3/gpt-image-1은 url, gpt-image-2는 b64_json 기본 → 양쪽 모두 처리
    const first = data?.data?.[0];
    const imageUrl: string = first?.url
      || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '');

    if (!imageUrl) {
      return { ok: false, error: `${usedModel || 'OpenAI'} 응답에 이미지가 없습니다` };
    }

    console.log(`[OPENAI-IMG] ✅ 이미지 생성 완료 (모델: ${usedModel}): ${imageUrl.substring(0, 60)}...`);
    return { ok: true, dataUrl: imageUrl };
  } catch (error: any) {
    return { ok: false, error: error.message || 'DALL-E 썸네일 생성 오류' };
  }
}

// Stability AI 옵션 타입
interface StabilityThumbOptions {
  apiKey: string;
  width?: number;
  height?: number;
  style?: 'photographic' | 'digital-art' | 'anime' | 'cinematic' | '3d-model' | 'comic-book';
}

// 🎨 Stability AI 썸네일 생성 함수
export async function makeStabilityThumbnail(
  title: string,
  topic: string,
  options: StabilityThumbOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    const apiKey = (options.apiKey || '').trim();

    if (!apiKey || apiKey.length < 20) {
      return { ok: false, error: 'Stability AI API 키가 유효하지 않습니다' };
    }

    // 영어 프롬프트 생성
    const prompt = generateEnglishPrompt(title, topic);

    console.log(`[STABILITY] 🎨 이미지 생성 중...`);
    console.log(`[STABILITY] 📝 프롬프트: ${prompt.slice(0, 80)}...`);

    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          { text: prompt, weight: 1 },
          { text: 'blurry, low quality, text, watermark, logo', weight: -1 }  // 네거티브 프롬프트
        ],
        cfg_scale: 7,
        width: 1024,  // SDXL은 1024x1024만 지원
        height: 1024,
        samples: 1,
        steps: 20,   // 🔥 속도 최적화 (30 → 20)
        style_preset: options.style || 'photographic'
      }),
    });

    if (!response.ok) {
      let errorMsg = `Stability API 오류 (${response.status})`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.name || errorMsg;
        console.log(`[STABILITY] ❌ API 오류: ${response.status} - ${JSON.stringify(errorData)}`);
      } catch { }
      console.log(`[STABILITY] ❌ 실패: ${errorMsg}`);
      return { ok: false, error: errorMsg };
    }

    const data = await response.json();
    const imageData = data.artifacts?.[0]?.base64;

    if (!imageData) {
      return { ok: false, error: 'Stability AI에서 이미지를 생성하지 못했습니다' };
    }

    console.log(`[STABILITY] ✅ 이미지 생성 완료!`);

    // 🔥 Base64를 freeimage.host에 업로드하여 URL로 변환
    try {
      const formData = new FormData();
      formData.append('source', imageData);  // Base64 데이터 (data: 접두어 없이)
      formData.append('type', 'base64');
      formData.append('action', 'upload');
      formData.append('format', 'json');

      const uploadResponse = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        if (uploadData.status_code === 200 && uploadData.image?.url) {
          console.log(`[STABILITY] ✅ 이미지 URL 변환 완료: ${uploadData.image.url.substring(0, 60)}...`);
          return { ok: true, dataUrl: uploadData.image.url };
        }
      }
      console.log(`[STABILITY] ⚠️ 업로드 실패, Base64 폴백 사용`);
    } catch (uploadError: any) {
      console.log(`[STABILITY] ⚠️ 업로드 오류: ${uploadError.message}, Base64 폴백`);
    }

    // 업로드 실패 시 Base64 폴백 (용량 문제 있음)
    const dataUrl = `data:image/png;base64,${imageData}`;
    return { ok: true, dataUrl };

  } catch (error: any) {
    console.error(`[STABILITY] ❌ 오류:`, error.message);
    return { ok: false, error: error.message || 'Stability AI 썸네일 생성 오류' };
  }
}

// 🔥 DeepInfra FLUX-2-dev 썸네일 생성 함수 (32B 파라미터 초고품질)
// 🎯 텍스트는 AI가 아닌 하단 오버레이로 자동 삽입 (깨짐 방지)
export async function makeDeepInfraThumbnail(
  title: string,
  topic: string,
  options: DeepInfraThumbOptions & { overlayText?: string; skipOverlay?: boolean }
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    const apiKey = (options.apiKey || '').trim();

    if (!apiKey || apiKey.length < 10) {
      return { ok: false, error: 'DeepInfra API 키가 유효하지 않습니다. https://deepinfra.com/dash/api_keys 에서 발급받으세요.' };
    }

    // 🔥 Clean Prompt: Gemini API로 한→영 번역 후 상황우선 프롬프트 생성
    const cleanPrompt = await generateCleanImagePromptAsync(title, topic, options.apiKey);

    const width = Math.min(1920, Math.max(128, options.width ?? 1024));
    const height = Math.min(1920, Math.max(128, options.height ?? 1024));
    const numInferenceSteps = Math.min(100, Math.max(1, options.numInferenceSteps ?? 28));
    const guidanceScale = Math.min(20, Math.max(0, options.guidanceScale ?? 2.5));

    console.log(`[DEEPINFRA] 🎨 FLUX-2-dev 이미지 생성 중... (${width}x${height})`);
    console.log(`[DEEPINFRA] 📝 Clean Prompt (텍스트 없음): ${cleanPrompt.substring(0, 100)}...`);

    const requestBody: any = {
      prompt: cleanPrompt,
      width: width,
      height: height,
      num_inference_steps: numInferenceSteps,
      guidance_scale: guidanceScale
    };

    // 시드가 있으면 추가
    if (options.seed !== undefined) {
      requestBody.seed = options.seed;
    }

    const response = await fetch('https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-2-dev', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `DeepInfra API 오류 (${response.status})`;

      try {
        const errorData = await response.json();
        if (response.status === 401) {
          errorMessage = `인증 실패: DeepInfra API 키가 올바르지 않습니다. https://deepinfra.com/dash/api_keys 에서 확인하세요.`;
        } else if (response.status === 402) {
          errorMessage = `결제 필요: DeepInfra 크레딧이 부족합니다. https://deepinfra.com/dash/billing 에서 충전하세요.`;
        } else if (response.status === 429) {
          errorMessage = `요청 한도 초과: 잠시 후 다시 시도하세요.`;
        } else {
          errorMessage = `DeepInfra API 오류: ${errorData.error || errorData.message || 'Unknown error'}`;
        }
      } catch (e) {
        // JSON 파싱 실패
      }

      console.log(`[DEEPINFRA] ❌ ${errorMessage}`);
      return { ok: false, error: errorMessage };
    }

    const data = await response.json();

    // DeepInfra는 images 배열에 URL 또는 base64 반환
    const imageData = data.images?.[0] || data.image || data.output;

    if (!imageData) {
      console.log(`[DEEPINFRA] ❌ 응답에 이미지가 없습니다:`, JSON.stringify(data).substring(0, 200));
      return { ok: false, error: 'DeepInfra에서 이미지를 생성하지 못했습니다' };
    }

    console.log(`[DEEPINFRA] ✅ 이미지 생성 완료!`);

    // 🔥 하단 텍스트 오버레이 적용 (skipOverlay가 아닌 경우)
    if (!options.skipOverlay) {
      const overlayTitle = options.overlayText || title;
      console.log(`[DEEPINFRA] 📝 하단 텍스트 오버레이 적용 중: "${overlayTitle.substring(0, 30)}..."`);

      try {
        const overlayedImage = await applyBottomTextOverlay(imageData, overlayTitle, width, height);
        console.log(`[DEEPINFRA] ✅ 텍스트 오버레이 완료!`);
        return { ok: true, dataUrl: overlayedImage };
      } catch (overlayError: any) {
        console.warn(`[DEEPINFRA] ⚠️ 오버레이 실패, 원본 반환:`, overlayError.message);
        // 오버레이 실패 시 원본 이미지 반환
      }
    }

    // URL인 경우 그대로 반환, base64인 경우 data URL로 변환
    if (imageData.startsWith('http')) {
      return { ok: true, dataUrl: imageData };
    } else if (imageData.startsWith('data:')) {
      return { ok: true, dataUrl: imageData };
    } else {
      // Base64 문자열인 경우
      return { ok: true, dataUrl: `data:image/png;base64,${imageData}` };
    }

  } catch (error: any) {
    console.error(`[DEEPINFRA] ❌ 오류:`, error.message);
    return { ok: false, error: error.message || 'DeepInfra 썸네일 생성 오류' };
  }
}

// 🔥 Clean Prompt 생성 (텍스트 없이 순수 이미지만 — 상황/행동 우선)
// DeepInfra 등 외부 이미지 엔진에 사용
async function generateCleanImagePromptAsync(title: string, topic: string, apiKey?: string): Promise<string> {
  // 한국어인 경우 Gemini API로 정확한 영어 번역
  const isKorean = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(title + topic);
  let translatedTitle = title;
  let translatedTopic = topic;

  if (isKorean && apiKey) {
    translatedTitle = await translateToEnglish(title, apiKey);
    translatedTopic = await translateToEnglish(topic, apiKey);
    console.log(`[CLEAN-PROMPT] 🌐 번역: "${title}" → "${translatedTitle}"`);
  }

  return `Still life and environment photograph. Subject: ${translatedTitle}. Context: ${translatedTopic}.

STRICT COMPOSITION RULES:
- Focus ONLY on objects, products, tools, scenery, and environments
- Show the setting, materials, and items relevant to the topic
- Capture the atmosphere and mood through lighting and color
- Frame as a product shot, flat lay, or landscape — NEVER a portrait

ABSOLUTELY FORBIDDEN (will be rejected if present):
- NO people, NO human figures, NO person, NO man, NO woman, NO child
- NO faces, NO eyes, NO hands, NO fingers, NO skin, NO body parts
- NO silhouettes of humans, NO shadows of people
- NO portraits, NO characters, NO models, NO selfies
- NO text, NO words, NO letters, NO numbers, NO watermarks, NO logos

Style: Clean editorial stock photography, bright natural lighting, sharp focus, 4K, commercially appealing.
This must be a PURE OBJECT/SCENE photograph with ZERO human presence.`;
}

// 동기 버전 (폴백용)
function generateCleanImagePrompt(title: string, topic: string): string {
  const basePrompt = generateEnglishPrompt(title, topic, false);
  return `${basePrompt}, NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WATERMARKS, NO LOGOS, NO CAPTIONS, NO TYPOGRAPHY, clean professional photography, visually stunning composition`;
}

// 🔥 하단 텍스트 오버레이 적용 함수
async function applyBottomTextOverlay(
  imageData: string,
  title: string,
  width: number,
  height: number
): Promise<string> {
  // 이미지 데이터 버퍼로 변환
  let imageBuffer: Buffer;

  if (imageData.startsWith('http')) {
    // URL인 경우 다운로드
    const response = await fetch(imageData);
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } else if (imageData.startsWith('data:')) {
    // Data URL인 경우 base64 추출
    const base64 = imageData.split(',')[1] || '';
    imageBuffer = Buffer.from(base64, 'base64');
  } else {
    // 순수 base64인 경우
    imageBuffer = Buffer.from(imageData, 'base64');
  }

  // 제목 줄바꿈 처리 (최대 2줄, 하단 배치에 적합하게)
  const maxCharsPerLine = Math.floor(width / 28); // 대략적인 계산
  const lines = wrapTitleForBottom(title, maxCharsPerLine, 2);

  // 폰트 크기 계산 (하단 배치에 맞게 조정)
  const fontSize = Math.min(48, Math.max(32, Math.floor(width / 20)));
  const lineHeight = fontSize * 1.3;
  const paddingBottom = 30;
  const overlayHeight = (lines.length * lineHeight) + (paddingBottom * 2);

  // 하단 오버레이 SVG 생성 (그라데이션 배경 + 텍스트)
  const overlayY = height - overlayHeight;

  const overlaySvg = `
<svg width="${width}" height="${height}">
  <!-- 하단 그라데이션 배경 -->
  <defs>
    <linearGradient id="bottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
      <stop offset="30%" style="stop-color:rgb(0,0,0);stop-opacity:0.5" />
      <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.85" />
    </linearGradient>
  </defs>
  <rect x="0" y="${overlayY}" width="${width}" height="${overlayHeight}" fill="url(#bottomGrad)" />
  
  <!-- 하단 텍스트 -->
  <text x="${width / 2}" y="${height - paddingBottom - ((lines.length - 1) * lineHeight)}" 
        font-family="'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" 
        font-size="${fontSize}" 
        font-weight="700" 
        fill="#FFFFFF" 
        text-anchor="middle"
        filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))">
    ${lines.map((line, i) =>
    `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`
  ).join('\n    ')}
  </text>
</svg>`;

  // Sharp로 이미지에 오버레이 합성
  const finalImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .composite([{
      input: Buffer.from(overlaySvg),
      top: 0,
      left: 0
    }])
    .png({ quality: 90 })
    .toBuffer();

  return `data:image/png;base64,${finalImage.toString('base64')}`;
}

// 하단 배치용 제목 줄바꿈
function wrapTitleForBottom(title: string, maxLen: number, maxLines: number): string[] {
  const lines: string[] = [];
  let remaining = title;

  while (remaining.length > 0 && lines.length < maxLines) {
    if (remaining.length <= maxLen) {
      lines.push(remaining);
      break;
    }

    // 적절한 위치에서 줄바꿈
    let breakPoint = remaining.lastIndexOf(' ', maxLen);
    if (breakPoint <= 0) breakPoint = maxLen;

    lines.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  // 남은 내용이 있으면 마지막 줄에 추가
  if (remaining.length > 0 && lines.length === maxLines && lines[maxLines - 1]) {
    lines[maxLines - 1] = (lines[maxLines - 1] || '').substring(0, maxLen - 3) + '...';
  }

  return lines;
}


// 🚀 Pollinations 썸네일 생성 함수 (무료, 초고속, 100% 성공률)
export async function makePollinationsThumbnail(
  title: string,
  topic: string,
  options: PollinationsThumbOptions = {}
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 60000; // 60초로 늘림

  const width = options.width ?? 1200;
  const height = options.height ?? 630;
  const nologo = options.nologo ?? true;

  // 🔥 키워드 기반 상세 영어 프롬프트 생성
  const englishPrompt = generateEnglishPromptForPollinations(title, topic);
  const encodedPrompt = encodeURIComponent(englishPrompt);

  console.log(`[POLLINATIONS] 📝 프롬프트: ${englishPrompt.slice(0, 100)}...`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const seed = Math.floor(Math.random() * 999999);

      // 🚀 심플한 URL (model 파라미터 제외 - 더 안정적)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=${nologo}`;

      console.log(`[POLLINATIONS] 🚀 요청 ${attempt}/${MAX_RETRIES}...`);

      // 🔥 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'image/jpeg,image/png,image/*',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 이미지 데이터 가져오기
      const imageBuffer = await response.arrayBuffer();

      if (imageBuffer.byteLength < 5000) {
        throw new Error('이미지가 너무 작음');
      }

      const base64 = Buffer.from(imageBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${contentType};base64,${base64}`;

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[POLLINATIONS] ✅ 완료! (${duration}초, ${Math.round(base64.length / 1024)}KB)`);

      return { ok: true, dataUrl };

    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[POLLINATIONS] ⚠️ 시도 ${attempt} 실패 (${duration}초): ${error.message}`);

      if (attempt < MAX_RETRIES) {
        // 재시도 전 대기
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.error(`[POLLINATIONS] ❌ ${MAX_RETRIES}회 시도 후 실패`);
  return { ok: false, error: `Pollinations ${MAX_RETRIES}회 시도 후 실패` };
}

// 실제 이미지 API를 우선적으로 사용하는 통합 함수 (SVG는 마지막 fallback)
export async function makeSmartThumbnail(
  title: string,
  topic: string,
  _svgOptions: ThumbOptions = {},
  pexelsOptions?: PexelsThumbOptions,
  _cseOptions?: CSEThumbOptions,
  dalleOptions?: DalleThumbOptions
): Promise<{ ok: true; dataUrl: string; type: 'dalle' | 'pexels' } | { ok: false; error: string }> {

  // 환경 변수에서 API 키 자동 로드
  const envApiKeys = {
    openai: process.env['OPENAI_API_KEY'],
    pexels: process.env['PEXELS_API_KEY'],
    cse: process.env['GOOGLE_CSE_API_KEY'],
    cseId: process.env['GOOGLE_CSE_ID']
  };

  // 1. DALL-E 우선 시도 (고품질 AI 생성 이미지)
  const dalleKey = dalleOptions?.apiKey || envApiKeys.openai;
  if (dalleKey) {
    try {
      // DALL-E 3는 1024x1024만 지원하므로 크기 무시
      const dalleResult = await makeDalleThumbnail(title, topic, {
        apiKey: dalleKey,
        width: 1024,  // DALL-E 3는 1024x1024만 지원
        height: 1024,
        quality: dalleOptions?.quality || 'standard',
        style: dalleOptions?.style || 'natural'
      });
      if (dalleResult.ok) {
        console.log('[THUMBNAIL] DALL-E 이미지 생성 성공');
        return { ...dalleResult, type: 'dalle' as const };
      }
      console.warn('[THUMBNAIL] DALL-E 실패, Pexels로 대체:', dalleResult.ok === false ? dalleResult.error : 'Unknown error');
    } catch (error) {
      console.warn('[THUMBNAIL] DALL-E 오류, Pexels로 대체:', error);
    }
  }

  // 2. Pexels 시도 (무료 고품질 스톡 이미지)
  const pexelsKey = pexelsOptions?.apiKey || envApiKeys.pexels;
  if (pexelsKey) {
    try {
      const pexelsResult = await makePexelsThumbnail(title, topic, {
        apiKey: pexelsKey,
        width: pexelsOptions?.width || 1200,
        height: pexelsOptions?.height || 630,
        orientation: pexelsOptions?.orientation || 'landscape',
        size: pexelsOptions?.size || 'large'
      });
      if (pexelsResult.ok) {
        console.log('[THUMBNAIL] Pexels 이미지 검색 성공');
        return { ...pexelsResult, type: 'pexels' as const };
      }
      console.warn('[THUMBNAIL] Pexels 실패, Google CSE로 대체:', pexelsResult.ok === false ? pexelsResult.error : 'Unknown error');
    } catch (error) {
      console.warn('[THUMBNAIL] Pexels 오류, Google CSE로 대체:', error);
    }
  }

  // 3. 모든 실제 이미지 API 실패 시 오류 반환 (SVG는 실제 이미지가 아니므로 사용하지 않음)
  console.error('[THUMBNAIL] 모든 실제 이미지 API 실패 - 실제 이미지 생성 불가');
  return { ok: false, error: '모든 실제 이미지 API가 실패했습니다. API 키를 확인해주세요.' };
}

/**
 * SVG 자동 썸네일 생성 (주황색 테두리, 흰색 배경, 검은 텍스트)
 * 블로그스팟과 워드프레스에 최적화된 디자인
 */
export async function generateAutoSvgThumbnail(
  title: string,
  options: {
    width?: number;
    height?: number;
    outDir?: string;
  } = {}
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  try {
    const width = options.width || 1200;
    const height = options.height || 630;
    const outDir = options.outDir || path.join(process.cwd(), 'thumbnails');

    // 출력 디렉토리 생성
    await fs.mkdir(outDir, { recursive: true });

    // 제목 줄바꿈 처리 (최대 3줄, 각 줄 최대 20자)
    const maxCharsPerLine = 20;
    const maxLines = 3;
    const words = title.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // 🔥 남은 단어가 있으면 추가 줄로 모두 표시 (... 없이)
    const usedWords = lines.join(' ').split(' ').length;
    if (words.length > usedWords) {
      const remainingWords = words.slice(usedWords);
      let remainingLine = '';
      for (const word of remainingWords) {
        if (remainingLine) {
          remainingLine += ' ' + word;
        } else {
          remainingLine = word;
        }
        if (remainingLine.length >= maxCharsPerLine) {
          lines.push(remainingLine);
          remainingLine = '';
        }
      }
      if (remainingLine) {
        lines.push(remainingLine);
      }
    }

    // SVG 생성
    // 🔥 제목 길이에 따라 폰트 크기 동적 조절 (자동 크기 조정)
    const totalChars = title.length;
    let fontSize = 72; // 기본값

    if (totalChars > 40) fontSize = 48;
    else if (totalChars > 30) fontSize = 56;
    else if (totalChars > 20) fontSize = 64;
    else if (totalChars < 12) fontSize = 90;

    // 🔥 줄 수가 많아지면 폰트 크기 추가 축소
    if (lines.length > 3) fontSize = Math.max(40, fontSize - 10);
    if (lines.length > 4) fontSize = Math.max(36, fontSize - 15);

    const lineHeight = fontSize * 1.3;
    const startY = (height - (lines.length * lineHeight)) / 2 + fontSize;

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- 흰색 배경 -->
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  
  <!-- 주황색 테두리 (두께 12px) -->
  <rect x="6" y="6" width="${width - 12}" height="${height - 12}" 
        fill="none" stroke="#FF8C00" stroke-width="12" rx="16"/>
  
  <!-- 제목 텍스트 (검은색, 중앙 정렬) -->
  <text x="${width / 2}" y="${startY}" 
        font-family="'Noto Sans KR', 'Malgun Gothic', sans-serif" 
        font-size="${fontSize}" 
        font-weight="700" 
        fill="#000000" 
        text-anchor="middle">
${lines.map((line, index) => `    <tspan x="${width / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('\n')}
  </text>
</svg>`;

    // 파일 저장
    const timestamp = Date.now();
    const filename = `auto-thumb-${timestamp}.svg`;
    const filepath = path.join(outDir, filename);
    await fs.writeFile(filepath, svgContent, 'utf-8');

    console.log(`[THUMBNAIL] SVG 자동 썸네일 생성 완료: ${filepath}`);

    return {
      ok: true,
      path: filepath,
      url: `file://${filepath}`
    };
  } catch (error) {
    console.error('[THUMBNAIL] SVG 자동 썸네일 생성 실패:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * XML 특수 문자 이스케이프
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 🍌 Nano Banana Pro 이미지 생성 (Google Imagen API)
export async function makeNanoBananaProThumbnail(
  title: string,
  topic: string,
  options: NanoBananaProOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();

  // 영어 프롬프트 생성 (isThumbnail: true면 텍스트 허용, false면 텍스트 없음)
  const isThumbnail = options.isThumbnail ?? false;
  const prompt = generateEnglishPrompt(title, topic, isThumbnail);

  console.log(`[NANO-BANANA-PRO] 🍌 Gemini 이미지 생성 시작...`);
  console.log(`[NANO-BANANA-PRO] 📝 프롬프트: ${prompt.slice(0, 80)}...`);

  // Imagen 3 제거 → Gemini 네이티브 이미지 생성 직접 호출
  return await tryGeminiExperimentalImageGeneration(title, topic, options.apiKey, isThumbnail);
}

// 🔥 Gemini 3 이미지 생성 (Nano Banana / Nano Banana Pro)
async function tryGeminiExperimentalImageGeneration(
  title: string,
  topic: string,
  apiKey: string,
  isThumbnail: boolean = false
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();

  // Gemini 이미지 생성 모델 우선순위 (2026-04-29 — Pro 우선 폴백 체인)
  // 🍌 나노바나나프로 → 나노바나나2 → Imagen4 → 나노바나나(레거시)
  // 사용자가 'nanobananapro' 선택 시 가장 고품질(4K, $0.134~0.24)부터 시도
  const IMAGE_MODELS = [
    { id: 'gemini-3-pro-image-preview', name: '나노바나나프로 (Gemini 3 Pro Image, 4K)' },
    { id: 'gemini-3.1-flash-image-preview', name: '나노바나나2 (Gemini 3.1 Flash Image)' },
  ];

  // 나노바나나 (최종 폴백용 — 레거시 저비용)
  const FALLBACK_MODEL = { id: 'gemini-2.5-flash-image', name: '나노바나나 레거시 (Gemini 2.5 Flash Image)' };

  // 프롬프트 생성 — 🔥 AI 추론 기반 동적 프롬프트 생성
  let prompt: string;

  // 한국어 제목을 영어로 번역
  const translatedTitle = await translateToEnglish(title, apiKey);
  const translatedTopic = await translateToEnglish(topic, apiKey);

  // 🔥 AI 추론으로 동적 프롬프트 생성 시도 (Gemini — callGeminiWithRetry)
  let aiGeneratedPrompt: string | null = null;
  try {
    const aiPrompt = `You are an expert visual prompt engineer for AI image generation. The images are for a KOREAN blog targeting Korean audience. All people in the image MUST be Korean/East Asian. Output ONLY the English image prompt, nothing else. Max 100 words.

Given the blog section title and topic below, create a SINGLE, highly specific visual scene description for a professional stock photograph.

Section Title: ${title}
Topic/Keyword: ${topic}

CRITICAL: The image MUST be directly about "${topic}". Every element in the scene must relate to this topic.
CRITICAL: All people depicted MUST be Korean/East Asian. The setting should be Korean (Korean office, Korean city, Korean home, etc.)

Requirements:
1. Describe a SPECIFIC visual scene (NOT abstract concepts) — what exactly would a photographer capture?
2. Include: specific objects, setting/location, lighting, colors, camera angle
3. The scene must OBVIOUSLY and DIRECTLY relate to "${topic}" — a viewer should immediately understand the topic
4. If people appear, they MUST be Korean/East Asian. Show natural Korean people in everyday situations.
5. NO text, letters, watermarks, or labels in the image.
6. NO cameras, photography equipment, or unrelated objects.

Topic-to-Scene Examples:
- "대출" (loan) → "Korean woman in her 30s reviewing loan documents at a clean modern Korean bank office, Korean won banknotes and calculator on desk, warm office lighting, over-shoulder angle"
- "다이어트" (diet) → "Korean man preparing healthy bibimbap ingredients in a modern Korean kitchen, fresh vegetables and tofu on marble counter, natural daylight, overhead shot"
- "자동차 보험" (car insurance) → "Korean couple examining car insurance paperwork at a Korean insurance office desk, miniature car model nearby, soft professional lighting"
- "주식 투자" (stock investing) → "Korean businessman analyzing stock charts on laptop at a Korean-style cafe, coffee cup beside, Seoul cityscape visible through window"

Now generate a scene for "${topic}" — "${title}":`;

    const generated = await callGeminiWithRetry(aiPrompt);
    if (generated && generated.length > 20 && generated.length < 500) {
      aiGeneratedPrompt = generated;
      console.log(`[NANO-BANANA] 🧠 Gemini 추론 프롬프트 생성 완료: "${aiGeneratedPrompt?.slice(0, 80)}..."`);
    }
  } catch (e: any) {
    console.log(`[NANO-BANANA] ⚠️ Gemini 프롬프트 추론 실패 (폴백 사용): ${e.message}`);
  }

  if (isThumbnail) {
    prompt = `Generate a professional blog thumbnail image for a KOREAN audience.
Topic: ${translatedTopic}.
Concept: ${translatedTitle}.

COMPOSITION PRIORITY:
1. SCENE: Show the relevant environment and setting in a KOREAN context
2. ACTION: Depict the process or situation
3. OBJECTS: Include key items or products
4. PEOPLE: If people appear, they MUST be Korean/East Asian
5. TEXT OVERLAY: Include the title as stylish KOREAN text overlay

CONTEXT: For Korean blog. All people must be Korean. Use Korean text if any text appears.
Style: Modern, vibrant, eye-catching, bold typography.`;
  } else if (aiGeneratedPrompt) {
    // 🔥 AI 추론 프롬프트 사용 (동적 생성 성공 시)
    prompt = `TOPIC: ${translatedTopic}

${aiGeneratedPrompt}

STYLE: Clean, professional stock photography (Shutterstock/Getty quality), bright clear lighting, modern trustworthy aesthetic.

CRITICAL RULES:
- This image MUST be about "${translatedTopic}" — every element must relate to this topic
- All people MUST be Korean/East Asian
- ABSOLUTELY NO TEXT, letters, words, numbers, or symbols
- NO watermarks, NO banners, NO signs, NO labels
- NO cameras, photography equipment, or unrelated objects
- Pure photographic image only
- KOREAN context and setting`;
  } else {
    // 🔄 폴백: 기존 템플릿 기반 프롬프트 (주제 강조 + 한국인 필수)
    prompt = `Create a professional stock photograph that DIRECTLY represents the topic: "${translatedTopic}"

SECTION TITLE: "${translatedTitle}"

The image MUST be about "${translatedTopic}". Every object in the scene must relate to this specific topic.

IMAGE COMPOSITION (strict priority order):
1. SCENE & ENVIRONMENT: Setting and context that OBVIOUSLY represents "${translatedTopic}" in a KOREAN context
2. OBJECTS & TOOLS: Products, documents, equipment directly related to "${translatedTopic}"
3. ACTION & PROCESS: The activity or situation related to "${translatedTopic}"
4. PEOPLE: If people appear, they MUST be Korean/East Asian. Show natural Korean people in everyday situations.

STYLE: Clean, professional stock photography (Shutterstock/Getty quality), bright clear lighting, modern trustworthy aesthetic.

CRITICAL RULES:
- All people MUST be Korean/East Asian
- ABSOLUTELY NO TEXT, letters, words, numbers, or symbols
- NO watermarks, NO banners, NO signs, NO labels
- NO cameras, photography equipment, or unrelated decorative objects
- Pure photographic image only
- KOREAN setting and context
- A viewer must IMMEDIATELY understand this image is about "${translatedTopic}"`;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelInfo of IMAGE_MODELS) {
      for (let retry = 0; retry < 2; retry++) {
        try {
          console.log(`[NANO-BANANA] 🧪 ${modelInfo.name} 시도 중... (${retry + 1}/2)`);

          const model = genAI.getGenerativeModel({
            model: modelInfo.id,
            generationConfig: {
              responseModalities: ['image', 'text'] as any,
            } as any,
          });

          const result = await model.generateContent(prompt);
          const response = result.response;

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if ((part as any).inlineData) {
              const imageData = (part as any).inlineData.data;
              const mimeType = (part as any).inlineData.mimeType || 'image/png';
              const dataUrl = `data:${mimeType};base64,${imageData}`;

              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const sizeKB = Math.round(imageData.length / 1024);
              console.log(`[NANO-BANANA] ✅ ${modelInfo.name} 성공! (${elapsed}초, ${sizeKB}KB)`);

              return { ok: true, dataUrl };
            }
          }

          console.log(`[NANO-BANANA] ⚠️ ${modelInfo.name} - 이미지 데이터 없음, 다음 모델 시도...`);
          break; // 이미지 데이터 없으면 다음 모델로

        } catch (modelError: any) {
          const errMsg = modelError.message || String(modelError);
          const is429 = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errMsg);
          if (is429 && retry < 1) {
            const waitSec = 5;
            console.log(`[NANO-BANANA] ⏳ ${modelInfo.name} 할당량 초과, ${waitSec}초 대기 후 다음 모델 시도...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            break; // 즉시 다음 모델로 전환
          }
          console.log(`[NANO-BANANA] ⚠️ ${modelInfo.name} 실패: ${errMsg.substring(0, 150)}, 다음 모델 시도...`);
          break; // 다음 모델로
        }
      }
    }

    // 🔥 3순위: Imagen 4 폴백
    console.log(`[NANO-BANANA] 🔄 3순위: Imagen 4 폴백 시도...`);
    try {
      const imagen4Result = await tryImagen4Generation(prompt, apiKey);
      if (imagen4Result.ok) {
        return imagen4Result;
      }
      console.log(`[NANO-BANANA] ⚠️ Imagen 4 실패: ${(imagen4Result as any).error}`);
    } catch (e: any) {
      console.log(`[NANO-BANANA] ⚠️ Imagen 4 예외: ${e.message}`);
    }

    // 🔥 4순위: 나노바나나 최종 폴백 (gemini-2.5-flash-image)
    try {
      console.log(`[NANO-BANANA] 🔄 4순위: ${FALLBACK_MODEL.name} 최종 폴백 시도...`);
      const fallbackModel = genAI.getGenerativeModel({
        model: FALLBACK_MODEL.id,
        generationConfig: {
          responseModalities: ['image', 'text'] as any,
        } as any,
      });

      const fallbackResult = await fallbackModel.generateContent(prompt);
      const fallbackResponse = fallbackResult.response;

      for (const part of fallbackResponse.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
          const imageData = (part as any).inlineData.data;
          const mimeType = (part as any).inlineData.mimeType || 'image/png';
          const dataUrl = `data:${mimeType};base64,${imageData}`;

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const sizeKB = Math.round(imageData.length / 1024);
          console.log(`[NANO-BANANA] ✅ ${FALLBACK_MODEL.name} 성공! (${elapsed}초, ${sizeKB}KB)`);

          return { ok: true, dataUrl };
        }
      }
      console.log(`[NANO-BANANA] ⚠️ ${FALLBACK_MODEL.name} - 이미지 데이터 없음`);
    } catch (fallbackErr: any) {
      console.log(`[NANO-BANANA] ⚠️ ${FALLBACK_MODEL.name} 실패: ${fallbackErr.message}`);
    }

    return { ok: false, error: '모든 이미지 모델 실패 (나노바나나프로 → 나노바나나2 → Imagen4 → 나노바나나 레거시)' };

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[NANO-BANANA] ❌ 이미지 생성 실패 (${elapsed}초): ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// 🎨 Imagen 4 이미지 생성 (Gemini API 키로 호출 가능한 REST API)
async function tryImagen4Generation(
  prompt: string,
  apiKey: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();
  const IMAGEN4_MODELS = [
    'imagen-4.0-generate-001',      // 표준 (고품질)
    'imagen-4.0-fast-generate-001',  // 빠른 생성
  ];

  for (const modelId of IMAGEN4_MODELS) {
    try {
      console.log(`[IMAGEN4] 🎨 ${modelId} 시도 중...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            personGeneration: 'allow_adult',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.log(`[IMAGEN4] ⚠️ ${modelId} 실패 (${response.status}): ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (!imageBase64) {
        console.log(`[IMAGEN4] ⚠️ ${modelId} - 이미지 데이터 없음`);
        continue;
      }

      const dataUrl = `data:image/png;base64,${imageBase64}`;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const sizeKB = Math.round(imageBase64.length / 1024);
      console.log(`[IMAGEN4] ✅ ${modelId} 성공! (${elapsed}초, ${sizeKB}KB)`);

      return { ok: true, dataUrl };
    } catch (modelError: any) {
      console.log(`[IMAGEN4] ⚠️ ${modelId} 예외: ${modelError.message}`);
      continue;
    }
  }

  return { ok: false, error: 'Imagen 4 모든 모델 실패' };
}

// 🚀 Prodia AI 썸네일 생성 함수 (저렴하고 빠른 고품질)
export async function makeProdiaThumbnail(
  title: string,
  topic: string,
  options: ProdiaThumbOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();
  const MAX_RETRIES = 2;
  const POLL_INTERVAL = 1000; // 1초
  const MAX_POLL_TIME = 60000; // 최대 60초 대기

  const width = options.width ?? 1024;
  const height = options.height ?? 576; // 16:9 비율
  const model = options.model ?? 'flux-schnell';
  const steps = options.steps ?? 4;

  // 영어 프롬프트 생성
  const prompt = generateEnglishPrompt(title, topic, false);

  console.log(`[PRODIA] 🚀 이미지 생성 시작...`);
  console.log(`[PRODIA] 📝 프롬프트: ${prompt.slice(0, 80)}...`);
  console.log(`[PRODIA] 🎯 모델: ${model}, 크기: ${width}x${height}`);

  // 모델별 타입 설정
  const modelTypeMap: { [key: string]: string } = {
    'flux-schnell': 'inference.flux.schnell.txt2img.v1',
    'flux-dev': 'inference.flux.dev.txt2img.v1',
    'sdxl': 'inference.sdxl.txt2img.v1',
    'sd15': 'inference.sd.txt2img.v1'
  };

  const jobType = modelTypeMap[model] || modelTypeMap['flux-schnell'];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1. 작업 생성
      const createResponse = await fetch('https://inference.prodia.com/v2/job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          type: jobType,
          config: {
            prompt: prompt,
            width: width,
            height: height,
            steps: steps,
            cfg_scale: 3.5,  // Flux 최적값
            sampler: 'euler_a',
            negative_prompt: 'text, letters, words, numbers, watermark, logo, blurry, low quality'
          }
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(`작업 생성 실패 (${createResponse.status}): ${(errorData as any)?.error || 'Unknown error'}`);
      }

      const createData = await createResponse.json();
      const jobId = (createData as any).job;

      if (!jobId) {
        throw new Error('작업 ID를 받지 못했습니다');
      }

      console.log(`[PRODIA] 📋 작업 생성됨: ${jobId}`);

      // 2. 작업 완료 대기 (폴링)
      const pollStartTime = Date.now();
      let imageUrl = '';

      while (Date.now() - pollStartTime < MAX_POLL_TIME) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const statusResponse = await fetch(`https://inference.prodia.com/v2/job/${jobId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            'Accept': 'application/json'
          }
        });

        if (!statusResponse.ok) {
          continue; // 재시도
        }

        const statusData = await statusResponse.json();
        const status = (statusData as any).status;

        if (status === 'succeeded') {
          imageUrl = (statusData as any).imageUrl;
          break;
        } else if (status === 'failed') {
          throw new Error(`작업 실패: ${(statusData as any).error || 'Unknown error'}`);
        }
        // 'pending' 또는 'generating' 상태면 계속 대기
      }

      if (!imageUrl) {
        throw new Error('이미지 생성 시간 초과');
      }

      console.log(`[PRODIA] 🖼️ 이미지 URL 획득: ${imageUrl.substring(0, 60)}...`);

      // 3. 이미지를 Base64로 변환
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('이미지 다운로드 실패');
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${contentType};base64,${base64}`;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const sizeKB = Math.round(base64.length / 1024);
      console.log(`[PRODIA] ✅ 완료! (${elapsed}초, ${sizeKB}KB, ${model})`);

      return { ok: true, dataUrl };

    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[PRODIA] ⚠️ 시도 ${attempt}/${MAX_RETRIES} 실패 (${elapsed}초): ${error.message}`);

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.error(`[PRODIA] ❌ ${MAX_RETRIES}회 시도 후 실패`);
  return { ok: false, error: `Prodia ${MAX_RETRIES}회 시도 후 실패` };
}

// 🦁 Leonardo AI 이미지 생성 (NanoBananaPro + Phoenix 폴백)
export async function makeLeonardoPhoenixImage(
  title: string,
  topic: string,
  options: LeonardoPhoenixOptions
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const startTime = Date.now();
  const MAX_RETRIES = 2;
  const POLL_INTERVAL = 2000; // 2초
  const MAX_POLL_TIME = 120000; // 최대 120초 대기

  const width = options.width ?? 1024;
  const height = options.height ?? 1024;
  const isThumbnail = options.isThumbnail ?? false;

  // 🔥 AI로 영어 프롬프트 추론 생성 (Gemini 활용)
  let prompt: string;
  try {
    prompt = await generateLeonardoPromptWithAI(title, topic, isThumbnail);
    console.log(`[LEONARDO] 🤖 AI 프롬프트 생성 완료: ${prompt.slice(0, 100)}...`);
  } catch (e: any) {
    prompt = generateEnglishPrompt(title, topic, isThumbnail);
    console.log(`[LEONARDO] ⚠️ AI 프롬프트 생성 실패, 폴백 사용: ${e.message}`);
  }

  console.log(`[LEONARDO] 🦁 Leonardo 이미지 생성 시작...`);
  console.log(`[LEONARDO] 📝 프롬프트: ${prompt.slice(0, 80)}...`);

  // ===== v2 API 모델들 (최신 → 안정 순서) =====
  const V2_MODELS = [
    { model: 'seedream-4.5', name: 'Seedream 4.5' },
    { model: 'gemini-image-2', name: 'NanoBananaPro' },
  ];

  for (const v2Model of V2_MODELS) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[LEONARDO] 🎨 ${v2Model.name} 시도 ${attempt}/${MAX_RETRIES}...`);

        const createResponse = await fetch('https://cloud.leonardo.ai/api/rest/v2/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: v2Model.model,
            parameters: {
              width: width,
              height: height,
              prompt: prompt,
              quantity: 1,
              style_ids: ['111dc692-d470-4eec-b791-3475abac4c46'], // Photography 스타일
              prompt_enhance: 'OFF'
            },
            public: false
          })
        });

        if (!createResponse.ok) {
          const errData = await createResponse.text().catch(() => '');
          console.log(`[LEONARDO] ⚠️ ${v2Model.name} 요청 실패 (${createResponse.status}): ${errData.slice(0, 200)}`);
          if (createResponse.status === 401) {
            return { ok: false, error: 'Leonardo API 키가 유효하지 않습니다' };
          }
          continue;
        }

        const createData = await createResponse.json() as any;
        const generationId = createData.generation?.id || createData.id || createData.sdGenerationJob?.generationId;

        if (!generationId) {
          console.log(`[LEONARDO] ⚠️ generation ID 없음:`, JSON.stringify(createData).slice(0, 300));
          continue;
        }

        console.log(`[LEONARDO] 📋 ${v2Model.name} 생성 ID: ${generationId}`);

        const result = await pollLeonardoGeneration(generationId, options.apiKey, MAX_POLL_TIME, POLL_INTERVAL);
        if (result.ok) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[LEONARDO] ✅ ${v2Model.name} 완료! (${elapsed}초)`);
          return result;
        }

      } catch (error: any) {
        console.log(`[LEONARDO] ⚠️ ${v2Model.name} 시도 ${attempt} 실패: ${error.message}`);
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log(`[LEONARDO] ⚠️ ${v2Model.name} 실패, 다음 모델...`);
  }

  // ===== 2단계: Phoenix 폴백 (v1 API) =====
  const PHOENIX_MODELS = [
    { id: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3', name: 'Phoenix 1.0' },
    { id: '6b645e3a-d64f-4341-a6d8-7a3690fbf042', name: 'Phoenix 0.9' },
  ];

  for (const phoenixModel of PHOENIX_MODELS) {
    try {
      console.log(`[LEONARDO] 🔄 ${phoenixModel.name} 폴백 시도...`);

      const createResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          modelId: phoenixModel.id,
          width: width,
          height: height,
          num_images: 1,
          alchemy: true,
          presetStyle: 'PHOTOGRAPHY',
          negative_prompt: 'text, letters, words, numbers, watermark, logo, blurry, low quality, distorted'
        })
      });

      if (!createResponse.ok) {
        console.log(`[LEONARDO] ⚠️ ${phoenixModel.name} 실패 (${createResponse.status})`);
        continue;
      }

      const createData = await createResponse.json() as any;
      const generationId = createData.sdGenerationJob?.generationId;

      if (!generationId) continue;

      console.log(`[LEONARDO] 📋 ${phoenixModel.name} 생성 ID: ${generationId}`);

      const result = await pollLeonardoGeneration(generationId, options.apiKey, MAX_POLL_TIME, POLL_INTERVAL);
      if (result.ok) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[LEONARDO] ✅ ${phoenixModel.name} 완료! (${elapsed}초)`);
        return result;
      }

    } catch (error: any) {
      console.log(`[LEONARDO] ⚠️ ${phoenixModel.name} 실패: ${error.message}`);
    }
  }

  console.error(`[LEONARDO] ❌ 모든 모델 실패 (NanoBananaPro + Phoenix)`);
  return { ok: false, error: 'Leonardo 모든 모델 실패' };
}

// 🔄 Leonardo 이미지 생성 폴링 (v1/v2 공통)
async function pollLeonardoGeneration(
  generationId: string,
  apiKey: string,
  maxPollTime: number,
  pollInterval: number
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const pollStartTime = Date.now();

  while (Date.now() - pollStartTime < maxPollTime) {
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      const statusResponse = await fetch(
        `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json() as any;
      const generation = statusData.generations_by_pk;

      if (!generation) continue;

      if (generation.status === 'COMPLETE') {
        const images = generation.generated_images;
        if (images && images.length > 0) {
          const imageUrl = images[0].url;

          // 이미지를 Base64로 변환
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            return { ok: false, error: '이미지 다운로드 실패' };
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString('base64');
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const dataUrl = `data:${contentType};base64,${base64}`;
          const sizeKB = Math.round(base64.length / 1024);
          console.log(`[LEONARDO] 🖼️ 이미지 다운로드 완료 (${sizeKB}KB)`);

          return { ok: true, dataUrl };
        }
      } else if (generation.status === 'FAILED') {
        return { ok: false, error: `생성 실패: ${generation.error || 'Unknown'}` };
      }

      // 진행 상황 로그
      const waitSec = ((Date.now() - pollStartTime) / 1000).toFixed(0);
      if (parseInt(waitSec) % 10 === 0) {
        console.log(`[LEONARDO] ⏳ 대기 중... (${waitSec}초, 상태: ${generation.status})`);
      }
    } catch {
      continue;
    }
  }

  return { ok: false, error: '이미지 생성 시간 초과' };
}

// 🤖 AI 기반 이미지 프롬프트 생성 (멀티 AI 폴백: Gemini → OpenAI → Claude → Perplexity)
async function generateLeonardoPromptWithAI(
  title: string,
  topic: string,
  isThumbnail: boolean
): Promise<string> {
  const systemInstruction = isThumbnail
    ? `You are an expert AI image prompt engineer. Given a blog post title and topic, create a detailed, creative English prompt for AI image generation. The image will be used as a KOREAN blog thumbnail.
Requirements:
- Describe the scene, lighting, mood, and composition in detail
- Use photorealistic, professional stock photography style
- Include specific visual elements related to the topic
- If people appear, they MUST be Korean/East Asian. Show natural Korean people.
- Settings should feel Korean (Korean office, Korean city, Korean home, etc.)
- Mention camera angle, lens type, and lighting setup
- The prompt should produce a visually striking, click-worthy thumbnail
- Keep the prompt under 200 words
- Output ONLY the prompt, nothing else`
    : `You are an expert AI image prompt engineer. Given a blog post subtitle/section heading and topic, create a detailed, creative English prompt for AI image generation. The image will illustrate a KOREAN blog section.
Requirements:
- ABSOLUTELY NO TEXT, letters, words, or symbols in the generated image
- Focus on SCENE and ENVIRONMENT in a KOREAN context (primary focus)
- Show ACTION and PROCESS related to the topic (secondary)
- Include relevant OBJECTS and TOOLS
- If people appear, they MUST be Korean/East Asian. Show natural Korean people.
- Settings should feel Korean (Korean office, Korean street, Korean home, etc.)
- Use professional stock photography style with cinematic lighting
- Keep the prompt under 200 words
- Output ONLY the prompt, nothing else`;

  const userMessage = `Blog Title: ${title}\nTopic: ${topic}\n\nGenerate the image prompt:`;

  // 🔥 통합 디스패처로 한 번만 호출 (사용자 선택 엔진 자동 사용)
  try {
    console.log(`[AI-PROMPT] 🔵 통합 디스패처로 프롬프트 생성 시도...`);
    const combinedPrompt = `${systemInstruction}\n\n${userMessage}`;
    const result: any = await callGeminiWithRetry(combinedPrompt);
    const prompt: string = typeof result === 'string' ? result : (result?.text || '');
    if (prompt && prompt.length > 20) {
      console.log(`[AI-PROMPT] ✅ AI 프롬프트 생성 성공`);
      return prompt.trim();
    }
  } catch (e: any) {
    console.log(`[AI-PROMPT] ⚠️ AI 오류: ${e.message}`);
  }

  // ===== 3. 최종 폴백: 키워드 기반 번역 =====
  console.log(`[AI-PROMPT] 📝 모든 AI 실패 → 키워드 기반 프롬프트 생성`);
  return generateEnglishPrompt(title, topic, isThumbnail);
}


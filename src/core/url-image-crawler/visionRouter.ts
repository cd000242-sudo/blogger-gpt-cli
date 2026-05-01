// src/core/url-image-crawler/visionRouter.ts
// Vision 모델 라우팅 SSOT — 글 생성 AI 키 → vision provider 매핑
// 원본: cd000242-sudo/naver — src/runtime/modelRegistry.ts (v2.7.62)

export const VISION_MODELS = {
  GEMINI_FLASH: 'gemini-2.5-flash',
  GEMINI_PRO: 'gemini-2.5-pro',
  CLAUDE_SONNET: 'claude-sonnet-4-6',
  OPENAI_41: 'gpt-4.1',
  OPENAI_41_MINI: 'gpt-4.1-mini',
} as const;

export type VisionProviderKey =
  | 'gemini-flash'
  | 'gemini-pro'
  | 'claude-sonnet'
  | 'openai-41'
  | 'openai-41-mini';

export interface VisionRouting {
  provider: VisionProviderKey;
  model: string;
  vendor: 'gemini' | 'claude' | 'openai';
  fellBack: boolean;
  reason?: string;
}

/**
 * 글 생성 AI 키 → vision provider 라우팅.
 *   사용자 요청: "글 생성에 고른 AI랑 같은 vendor로 이미지 검증"
 *   Perplexity는 vision 미지원 → Gemini Flash 폴백
 */
export function routeTextToVision(textKey: string): VisionRouting {
  switch (textKey) {
    case 'gemini-2.5-flash-lite':
    case 'gemini-flash-lite':
      return { provider: 'gemini-flash', model: VISION_MODELS.GEMINI_FLASH, vendor: 'gemini', fellBack: true, reason: 'Lite는 vision 없음 → Flash 자동' };
    case 'gemini-2.5-flash':
    case 'gemini':
      return { provider: 'gemini-flash', model: VISION_MODELS.GEMINI_FLASH, vendor: 'gemini', fellBack: false };
    case 'gemini-2.5-pro':
      return { provider: 'gemini-pro', model: VISION_MODELS.GEMINI_PRO, vendor: 'gemini', fellBack: false };
    case 'claude-sonnet':
    case 'claude':
      return { provider: 'claude-sonnet', model: VISION_MODELS.CLAUDE_SONNET, vendor: 'claude', fellBack: false };
    case 'openai-gpt41':
    case 'openai':
      return { provider: 'openai-41', model: VISION_MODELS.OPENAI_41, vendor: 'openai', fellBack: false };
    case 'openai-gpt4o-mini':
    case 'openai-mini':
      return { provider: 'openai-41-mini', model: VISION_MODELS.OPENAI_41_MINI, vendor: 'openai', fellBack: false };
    case 'perplexity-sonar':
    case 'perplexity':
      return { provider: 'gemini-flash', model: VISION_MODELS.GEMINI_FLASH, vendor: 'gemini', fellBack: true, reason: 'Perplexity vision 미지원 → Gemini Flash 폴백' };
    default:
      return { provider: 'gemini-flash', model: VISION_MODELS.GEMINI_FLASH, vendor: 'gemini', fellBack: true, reason: `미지원 키(${textKey}) → Gemini Flash 기본` };
  }
}

/**
 * AI 텍스트 엔진 단가 + 티어 정의
 *
 * 글 1편당 비용 추정 기준 (Naver 자동화와 동일한 산식):
 *   입력 ~15K 토큰 + 출력 ~1.2K 토큰 × 평균 1.3회 시도
 *   환율 ₩1,400 / $1
 *
 * ⚠️ 주의: blogger-gpt-cli는 글 1편 생성 시 약 8회의 LLM 호출이 일어남
 * (제목, H2, 팩트체크, 본문, FAQ, CTA, 요약표, 해시태그). 실제 비용은
 * 아래 표시 금액 × 약 8배. UI 표시는 Naver 자동화 기준 그대로 유지함.
 */

export type AiProvider = 'gemini' | 'openai' | 'claude' | 'perplexity';
export type TierLabel = '가성비' | '균형' | '프리미엄' | '실시간';

export interface TierModel {
  /** 라디오 value (settings.json: primaryGeminiTextModel) */
  value: string;
  /** 카드 제목 */
  title: string;
  /** 티어 배지 */
  tier: TierLabel;
  /** 한 줄 설명 */
  description: string;
  /** 글 1편당 표시 비용 (₩, 정수) */
  costKrw: number;
  /** 라우팅 시 사용하는 provider */
  provider: AiProvider;
  /** 실제 호출 모델 (1순위) */
  modelId: string;
  /** 동일 provider 내 폴백 체인 (1순위 포함) */
  fallback: string[];
  /** 기본 선택 여부 */
  default?: boolean;
}

/**
 * 10개 티어 모델 (Naver 자동화 priceInfoModal 기반)
 */
export const TIER_MODELS: readonly TierModel[] = [
  // ─── Gemini ───────────────────────────────
  {
    value: 'gemini-2.5-flash-lite',
    title: 'Gemini 2.5 Flash-Lite',
    tier: '가성비',
    description: '대량 발행 · 가장 저렴 · 빠른 속도',
    costKrw: 15,
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-lite',
    fallback: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  },
  {
    value: 'gemini-2.5-flash',
    title: 'Gemini 2.5 Flash',
    tier: '균형',
    description: '품질·속도·가격 균형 · 일반 블로그 글에 최적',
    costKrw: 80,
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    fallback: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    default: true,
  },
  {
    value: 'gemini-2.5-pro',
    title: 'Gemini 2.5 Pro',
    tier: '프리미엄',
    description: '심층 추론 · 깊이 있는 글쓰기 · 최고 품질',
    costKrw: 300,
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    fallback: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },

  // ─── OpenAI ───────────────────────────────
  {
    value: 'openai-gpt4o-mini',
    title: 'GPT-4.1 mini',
    tier: '가성비',
    description: '빠른 속도 · 합리적 가격 · 안정적 품질',
    costKrw: 16,
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    fallback: ['gpt-4.1-mini', 'gpt-4.1'],
  },
  {
    value: 'openai-gpt41',
    title: 'GPT-4.1',
    tier: '균형',
    description: '균형 잡힌 품질 · 안정적 · 가격 대비 성능 우수',
    costKrw: 42,
    provider: 'openai',
    modelId: 'gpt-4.1',
    fallback: ['gpt-4.1', 'gpt-4.1-mini'],
  },
  {
    value: 'openai-gpt4o',
    title: 'GPT-4o',
    tier: '프리미엄',
    description: '최신 GPT-4o · 강력한 추론 · 정확한 지시 이행',
    costKrw: 101,
    provider: 'openai',
    modelId: 'gpt-4o',
    fallback: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  },

  // ─── Claude ───────────────────────────────
  {
    value: 'claude-haiku',
    title: 'Claude Haiku 4.5',
    tier: '가성비',
    description: '빠른 응답 · 자연스러운 한국어 · 창의적 문체',
    costKrw: 39,
    provider: 'claude',
    modelId: 'claude-haiku-4-5-20251001',
    fallback: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514'],
  },
  {
    value: 'claude-sonnet',
    title: 'Claude Sonnet 4.6',
    tier: '균형',
    description: '균형 잡힌 품질 · 자연스러운 한국어 · 안정적',
    costKrw: 63,
    provider: 'claude',
    modelId: 'claude-sonnet-4-20250514',
    fallback: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  },
  {
    value: 'claude-opus',
    title: 'Claude Opus 4.6',
    tier: '프리미엄',
    description: '최상급 추론 · 완벽한 글쓰기 · 프리미엄 품질',
    costKrw: 735,
    provider: 'claude',
    modelId: 'claude-opus-4-20250514',
    fallback: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'],
  },

  // ─── Perplexity ───────────────────────────
  {
    value: 'perplexity-sonar',
    title: 'Perplexity Sonar',
    tier: '실시간',
    description: '최신 웹 정보 기반 실시간 검색 + AI 분석',
    costKrw: 15,
    provider: 'perplexity',
    modelId: 'sonar-pro',
    fallback: ['sonar-pro', 'sonar'],
  },
] as const;

export const DEFAULT_TIER_VALUE = 'gemini-2.5-flash';

export function findTier(value: string | undefined | null): TierModel | undefined {
  if (!value) return undefined;
  return TIER_MODELS.find(t => t.value === value);
}

/**
 * primaryGeminiTextModel → defaultAiProvider 자동 파생
 */
export function deriveProvider(value: string | undefined | null): AiProvider {
  return findTier(value)?.provider ?? 'gemini';
}

/**
 * 환경변수에서 현재 선택된 티어를 읽음. 없으면 기본값.
 */
export function getCurrentTier(): TierModel {
  const fromEnv = process.env['PRIMARY_TEXT_MODEL'];
  return findTier(fromEnv) ?? findTier(DEFAULT_TIER_VALUE)!;
}

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

/**
 * v3.8.392: 금액 단일 출처(single source of truth).
 *
 * 왜 만들었나 — 같은 모델 금액이 세 곳에서 전부 달랐다 (2026-07-31 실측):
 *   Gemini 3.5 Flash   pricing.ts costKrw=80 / index.html data-cost=20 / 화면 라벨 ~₩20
 *   Gemini Flash-Lite  costKrw=15 / data-cost=15 / 화면 라벨 ~₩12
 * 근본 원인은 **토큰 단가가 없어서** 어느 숫자도 검증할 수 없었던 것이다.
 * 이제 토큰 단가를 적고 금액을 계산으로 뽑는다. 화면·로그·설정은 이 값만 읽는다.
 */
export const COST_MODEL = {
  /** 표시 기준: LLM 호출 1회 (실제 발행은 약 8회 — UI 안내 문구에서 별도 고지) */
  inputTokens: 15_000,
  outputTokens: 1_200,
  /** 평균 재시도 배수 */
  retryFactor: 1.3,
  /** 환율 (₩/$) */
  usdToKrw: 1_400,
} as const;

/** 100만 토큰당 USD 단가 */
export interface TokenPrice {
  input: number;
  output: number;
  /** 단가 출처·확인일 — 근거 없는 숫자를 넣지 않기 위해 필수 */
  source: string;
}

/**
 * 토큰 단가로 글 1편(호출 1회) 표시 금액을 계산한다.
 * 단가를 모르는 모델은 계산하지 않고 선언된 costKrw 를 그대로 쓴다(추측 금지).
 */
export function deriveCostKrw(price: TokenPrice | undefined, declared: number): number {
  if (!price) return declared;
  const usd = (
    (COST_MODEL.inputTokens / 1_000_000) * price.input
    + (COST_MODEL.outputTokens / 1_000_000) * price.output
  ) * COST_MODEL.retryFactor;
  return Math.round(usd * COST_MODEL.usdToKrw);
}

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
  /**
   * 100만 토큰당 USD 단가. **확인된 모델만 채운다.**
   * 없으면 costKrw 를 선언값 그대로 쓴다 — 모르는 단가를 지어내지 않기 위해서다.
   */
  usdPer1M?: TokenPrice;
}

/**
 * 10개 티어 모델 (Naver 자동화 priceInfoModal 기반)
 */
export const TIER_MODELS: readonly TierModel[] = [
  // ─── Gemini ───────────────────────────────
  {
    value: 'gemini-2.5-flash-lite',
    title: 'Gemini 3.1 Flash-Lite',
    tier: '가성비',
    description: '대량 발행 · 가장 저렴 · 빠른 속도',
    costKrw: 15,
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-lite',
    fallback: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
  },
  /**
   * v3.8.483 — Gemini 3.6 Flash 도입, 3.1 Pro Preview 제거.
   *
   * 공식 문서 확인(2026-08-11, ai.google.dev/gemini-api/docs/pricing):
   *   gemini-3.6-flash  Stable   입력 $1.50 / 출력 $7.50
   *   gemini-3.5-flash  Stable   입력 $1.50 / 출력 $9.00
   *   gemini-3.1-pro    **Preview**
   *
   * 3.6 은 3.5 보다 **새로우면서 출력이 17% 싸다** — 품질·비용 둘 다 이기므로 기본값으로 올린다.
   * 3.1 Pro 는 Preview 라 선불 티어에서 호출이 막힌다(사용자 실측). 목록에서 뺀다 —
   * 고를 수 있는데 안 되는 모델은 조용한 실패를 만든다.
   *
   * ⚠️ `value` 는 사용자 저장 설정 키다. 옛 이름(gemini-2.5-*)을 그대로 둬야
   *    기존 사용자의 선택이 안 깨진다. 바뀌는 것은 modelId·title·가격뿐이다.
   */
  {
    value: 'gemini-2.5-flash',
    title: 'Gemini 3.6 Flash',
    tier: '균형',
    description: '최신 · 품질·속도·가격 균형 · 일반 블로그 글에 최적',
    // 실단가에서 계산된 값(₩57). 예전 선언값 80 은 실제보다 비싸게 잡혀 있었다.
    costKrw: 57,
    provider: 'gemini',
    modelId: 'gemini-3.6-flash',
    fallback: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
    default: true,
    usdPer1M: { input: 1.50, output: 7.50, source: 'Gemini API 공식 가격표 2026-08-11 (Standard)' },
  },
  {
    value: 'gemini-2.5-pro',
    title: 'Gemini 3.5 Flash',
    tier: '프리미엄',
    description: '지속 추론 강점 · 긴 글·복잡한 주제에 유리',
    costKrw: 61,
    provider: 'gemini',
    modelId: 'gemini-3.5-flash',
    fallback: ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
    usdPer1M: { input: 1.50, output: 9.00, source: 'Gemini API 공식 가격표 2026-08-11 (Standard)' },
  },

  // ─── OpenAI (GPT-5 시리즈로 최신화, 2026-04) ───────────────────────────────
  //   기존 value 키(openai-gpt4o-mini/openai-gpt41/openai-gpt4o)는 사용자 저장 설정 호환을 위해 유지,
  //   modelId/title/description/costKrw만 최신 GPT-5 플래그십으로 업그레이드.
  {
    value: 'openai-gpt4o-mini',
    title: 'GPT-5.6 Luna',
    tier: '가성비',
    // 2026-07-30 인하: 입력 $1 → $0.20, 출력 $6 → $1.20 (80% 인하)
    description: 'GPT-5.6 Luna · 초저비용 · 빠른 속도 · 대량 발행',
    costKrw: 8,
    provider: 'openai',
    modelId: 'gpt-5.6-luna',
    fallback: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    usdPer1M: { input: 0.20, output: 1.20, source: 'OpenAI 공식 블로그 2026-07-30 인하 (입력 $1→$0.20, 출력 $6→$1.20)' },
  },
  {
    value: 'openai-gpt41',
    title: 'GPT-5.6 Terra',
    tier: '균형',
    // 2026-07-30 인하: 입력 $2.5 → $2, 출력 $15 → $12 (20% 인하)
    description: 'GPT-5.6 Terra · 품질/가격 균형 · 일반 블로그에 최적',
    costKrw: 81,
    provider: 'openai',
    modelId: 'gpt-5.6-terra',
    fallback: ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    usdPer1M: { input: 2, output: 12, source: 'OpenAI 공식 블로그 2026-07-30 인하 (입력 $2.5→$2, 출력 $15→$12)' },
  },
  {
    value: 'openai-gpt4o',
    title: 'GPT-5.6 Sol',
    tier: '프리미엄',
    // 2026-07-30 인하 대상 아님 — $5/$30 유지
    description: 'OpenAI 최신 플래그십 · 강력한 추론 · 정확한 지시 이행',
    costKrw: 202,
    provider: 'openai',
    modelId: 'gpt-5.6-sol',
    fallback: ['gpt-5.6-sol', 'gpt-5.6-terra'],
    usdPer1M: { input: 5, output: 30, source: 'OpenAI 공식 블로그 2026-07-30 (인하 대상 아님, $5/$30 유지)' },
  },

  // ─── Claude (2026-04 기준 최신 ID로 교정) ───────────────────────────────
  //   기존 코드의 'claude-sonnet-4-20250514' / 'claude-opus-4-20250514'는 1년 전 버전.
  //   최신: claude-sonnet-4-6 (2025-09-29), claude-opus-4-7 (2025-12, 1M context).
  {
    value: 'claude-haiku',
    title: 'Claude Haiku 4.5',
    tier: '가성비',
    description: '빠른 응답 · 자연스러운 한국어 · 창의적 문체',
    costKrw: 39,
    provider: 'claude',
    modelId: 'claude-haiku-4-5-20251001',
    fallback: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
  },
  {
    value: 'claude-sonnet',
    title: 'Claude Sonnet 5',
    tier: '균형',
    description: 'Claude Sonnet 5 · 균형 잡힌 품질 · 자연스러운 한국어',
    costKrw: 63,
    provider: 'claude',
    modelId: 'claude-sonnet-5',
    fallback: ['claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  },
  {
    value: 'claude-opus',
    title: 'Claude Fable 5',
    tier: '프리미엄',
    description: 'Claude Fable 5 · 최상급 추론 · 프리미엄 글쓰기',
    costKrw: 735,
    provider: 'claude',
    modelId: 'claude-fable-5',
    fallback: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
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

/**
 * v3.8.483 — 'gemini-3.5-flash' → 'gemini-3.6-flash'.
 *
 * 이 값은 findTier 가 modelId 로 찾는다. 3.5 는 이제 **프리미엄** 항목의 modelId 라
 * 그대로 두면 기본값이 `default: true` 인 균형 티어가 아니라 프리미엄을 가리킨다.
 * 기본 모델이 조용히 바뀌는 종류의 사고다.
 */
/**
 * v3.8.489 - 로그에 찍을 모델 표기.
 *
 * 사장님 보고: "로그에는 2.5플래쉬라뜹니다".
 * `value` 는 **사용자 설정 키**라 옛 이름(gemini-2.5-*)을 유지해야 한다 —
 * 바꾸면 기존 사용자의 선택이 통째로 깨진다. 그래서 키는 두되,
 * 로그에는 사람이 읽는 이름과 **실제 호출되는 모델 id** 를 함께 찍는다.
 */
export function describeModelForLog(tierValue: string): string {
  const value = String(tierValue || '').trim();
  if (!value) return '';
  const tier = TIER_MODELS.find((t) => t.value === value || t.modelId === value);
  return tier ? `${tier.title} (${tier.modelId})` : value;
}

export const DEFAULT_TIER_VALUE = 'gemini-3.6-flash';

/**
 * 화면·로그·설정이 공통으로 읽는 표시 금액.
 * 단가를 아는 모델은 계산값, 모르는 모델은 선언값을 돌려준다.
 */
export function tierCostKrw(tier: TierModel): number {
  return deriveCostKrw(tier.usdPer1M, tier.costKrw);
}

/** 표시 문자열까지 한 곳에서 만든다 — 화면마다 포맷이 달라지지 않게. */
export function formatTierCost(tier: TierModel): string {
  return `~₩${tierCostKrw(tier).toLocaleString('ko-KR')}/글`;
}

/**
 * 렌더러(설정 화면·선택창)로 넘길 납작한 표.
 * UI 가 자기 숫자를 들고 있지 않게 하는 것이 목적이다.
 */
export function getPricingTable(): Array<{
  value: string;
  modelId: string;
  title: string;
  tier: TierLabel;
  description: string;
  provider: AiProvider;
  costKrw: number;
  costLabel: string;
  priceSource: string;
  derived: boolean;
}> {
  return TIER_MODELS.map(t => ({
    value: t.value,
    modelId: t.modelId,
    title: t.title,
    tier: t.tier,
    description: t.description,
    provider: t.provider,
    costKrw: tierCostKrw(t),
    costLabel: formatTierCost(t),
    priceSource: t.usdPer1M?.source ?? '단가 미확인 — 선언값 표시',
    derived: Boolean(t.usdPer1M),
  }));
}

export function findTier(value: string | undefined | null): TierModel | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim();
  const exact = TIER_MODELS.find(t => t.value === normalized || t.modelId === normalized);
  if (exact) return exact;
  return TIER_MODELS.find(t => t.fallback.includes(normalized));
}

/**
 * 🎯 v3.8.446 — **기본값이 늘 Gemini 로 떨어지던 뿌리.**
 *
 * 사용자 지적(2026-08-04): "제미나이 충전을 못해서 안쓴다고".
 * `.env` 는 `AI_PROVIDER=openai` 인데 이 파일의 `DEFAULT_TIER_VALUE` 가
 * 'gemini-3.5-flash' 로 고정이라, 모델이 안 정해진 모든 경로가 Gemini 로 갔다.
 * 그 키는 차단된 상태라 그 경로들은 전부 실패한다.
 *
 * 이제 설정을 먼저 본다. 설정이 없거나 모르는 값일 때만 예전 기본값을 쓴다.
 * (여기 한 곳을 고치면 getCurrentTier·deriveProvider·gemini-engine 이 함께 따라온다.)
 */
const PROVIDER_DEFAULT_TIER: Record<string, string> = {
  openai: 'openai-gpt41',
  claude: 'claude-sonnet',
  perplexity: 'perplexity-sonar',
  gemini: 'gemini-3.5-flash',
};

/**
 * 🩹 v3.8.468 — **설정 파일도 읽는다.**
 *
 * v3.8.446 이 "payload 에 모델이 없으면 설정값을 쓴다" 는 안전망을 넣었는데,
 * 그 설정값을 `process.env.AI_PROVIDER` 에서만 읽었다. 그런데 앱 어디에서도
 * 그 환경변수를 세우지 않는다(전수 확인). 그래서 사용자가 .env 에
 * `AI_PROVIDER=openai` 를 넣어 두어도 **항상 gemini-3.5-flash 로 떨어졌다.**
 * 안전망이 있는데 작동하지 않는 상태였다.
 *
 * 실측(2026-08-06): .env 의 AI_PROVIDER=openai · resolveDefaultProvider() → gemini
 *
 * 이제 환경변수가 없으면 .env 파일을 직접 본다. 읽기 실패는 무시한다 —
 * 설정을 못 읽는다고 생성이 멈추면 안 된다.
 */
function readProviderFromSettings(): string {
  const fromProcess = String(process.env['AI_PROVIDER'] || '').trim().toLowerCase();
  if (fromProcess) return fromProcess;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadEnvFromFile } = require('../../env');
    const env = loadEnvFromFile() || {};
    return String(env['AI_PROVIDER'] || env['aiProvider'] || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function resolveDefaultTierValue(): string {
  const p = readProviderFromSettings();
  const mapped = PROVIDER_DEFAULT_TIER[p];
  if (mapped && findTier(mapped)) return mapped;
  return DEFAULT_TIER_VALUE;
}

/** 설정에서 파생한 기본 제공자 (모델을 못 정했을 때 쓰는 값) */
export function resolveDefaultProvider(): AiProvider {
  return findTier(resolveDefaultTierValue())?.provider ?? 'gemini';
}

/**
 * primaryGeminiTextModel → defaultAiProvider 자동 파생
 */
export function deriveProvider(value: string | undefined | null): AiProvider {
  return findTier(value)?.provider ?? resolveDefaultProvider();
}

/**
 * 환경변수에서 현재 선택된 티어를 읽음. 없으면 설정 기반 기본값.
 */
export function getCurrentTier(): TierModel {
  const fromEnv = process.env['PRIMARY_TEXT_MODEL'];
  return findTier(fromEnv) ?? findTier(resolveDefaultTierValue()) ?? findTier(DEFAULT_TIER_VALUE)!;
}

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIER_VALUE = exports.TIER_MODELS = void 0;
exports.findTier = findTier;
exports.deriveProvider = deriveProvider;
exports.getCurrentTier = getCurrentTier;
/**
 * 10개 티어 모델 (Naver 자동화 priceInfoModal 기반)
 */
exports.TIER_MODELS = [
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
    {
        value: 'gemini-2.5-flash',
        title: 'Gemini 3.5 Flash',
        tier: '균형',
        description: '품질·속도·가격 균형 · 일반 블로그 글에 최적',
        costKrw: 80,
        provider: 'gemini',
        modelId: 'gemini-3.5-flash',
        fallback: ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
        default: true,
    },
    {
        value: 'gemini-2.5-pro',
        title: 'Gemini 3.1 Pro Preview',
        tier: '프리미엄',
        description: '심층 추론 · 최고 품질 · Preview API',
        costKrw: 300,
        provider: 'gemini',
        modelId: 'gemini-3.1-pro-preview',
        fallback: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
    },
    // ─── OpenAI (GPT-5 시리즈로 최신화, 2026-04) ───────────────────────────────
    //   기존 value 키(openai-gpt4o-mini/openai-gpt41/openai-gpt4o)는 사용자 저장 설정 호환을 위해 유지,
    //   modelId/title/description/costKrw만 최신 GPT-5 플래그십으로 업그레이드.
    {
        value: 'openai-gpt4o-mini',
        title: 'GPT-5.6 Luna',
        tier: '가성비',
        description: 'GPT-5.6 Luna · 초저비용 · 빠른 속도 · 대량 발행',
        costKrw: 12,
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
        fallback: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    },
    {
        value: 'openai-gpt41',
        title: 'GPT-5.6 Terra',
        tier: '균형',
        description: 'GPT-5.6 Terra · 품질/가격 균형 · 일반 블로그에 최적',
        costKrw: 30,
        provider: 'openai',
        modelId: 'gpt-5.6-terra',
        fallback: ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    },
    {
        value: 'openai-gpt4o',
        title: 'GPT-5.6 Sol',
        tier: '프리미엄',
        description: 'OpenAI 최신 플래그십 · 강력한 추론 · 정확한 지시 이행',
        costKrw: 60,
        provider: 'openai',
        modelId: 'gpt-5.6-sol',
        fallback: ['gpt-5.6-sol', 'gpt-5.6-terra'],
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
];
exports.DEFAULT_TIER_VALUE = 'gemini-3.5-flash';
function findTier(value) {
    if (!value)
        return undefined;
    const normalized = String(value).trim();
    const exact = exports.TIER_MODELS.find(t => t.value === normalized || t.modelId === normalized);
    if (exact)
        return exact;
    return exports.TIER_MODELS.find(t => t.fallback.includes(normalized));
}
/**
 * primaryGeminiTextModel → defaultAiProvider 자동 파생
 */
function deriveProvider(value) {
    return findTier(value)?.provider ?? 'gemini';
}
/**
 * 환경변수에서 현재 선택된 티어를 읽음. 없으면 기본값.
 */
function getCurrentTier() {
    const fromEnv = process.env['PRIMARY_TEXT_MODEL'];
    return findTier(fromEnv) ?? findTier(exports.DEFAULT_TIER_VALUE);
}

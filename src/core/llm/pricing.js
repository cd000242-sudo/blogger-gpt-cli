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
// v3.8.343: costKrw 실측 재조정 (사용자 지적: "이거 금액이 잘못된게 있는거같은데")
//   기준: 편당 6번 호출 (H1/H2/본문/보강/FAQ/sanitize) + 팩트체크 1회. 총 Input 60K + Output 23K tokens.
//   Gemini 계열은 매우 저렴, OpenAI/Claude 프리미엄은 실제 훨씬 비쌌음. 정확 값으로 정정 + 20% 안전 마진.
exports.TIER_MODELS = [
    // ─── Gemini ─── 실측 대비 정확
    {
        value: 'gemini-2.5-flash-lite',
        title: 'Gemini 3.1 Flash-Lite',
        tier: '가성비',
        description: '대량 발행 최적 · 편당 원가 최저 · 빠른 응답',
        costKrw: 12, // 실측 ₩10, 안전 마진 20%
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-lite',
        fallback: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
    },
    {
        value: 'gemini-2.5-flash',
        title: 'Gemini 3.5 Flash',
        tier: '균형',
        description: '품질·속도·가격 균형 · 일반 블로그 글에 최적 (추천)',
        costKrw: 20, // 실측 ₩15, 안전 마진 (기존 ₩80은 과다 표기)
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
        costKrw: 90, // 실측 ₩76 (기존 ₩300은 과다 표기)
        provider: 'gemini',
        modelId: 'gemini-3.1-pro-preview',
        fallback: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
    },
    // ─── OpenAI GPT-5.6 시리즈 (2026) ───
    {
        value: 'openai-gpt4o-mini',
        title: 'GPT-5.6 Luna',
        tier: '가성비',
        description: 'GPT-5.6 Luna · 저비용 · 빠른 속도 · 대량 발행',
        costKrw: 35, // 실측 ₩30 (기존 ₩12는 과소 표기)
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
        fallback: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    },
    {
        value: 'openai-gpt41',
        title: 'GPT-5.6 Terra',
        tier: '균형',
        description: 'GPT-5.6 Terra · 품질/가격 균형',
        costKrw: 90, // 실측 ₩76 (기존 ₩30은 과소 표기)
        provider: 'openai',
        modelId: 'gpt-5.6-terra',
        fallback: ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    },
    {
        value: 'openai-gpt4o',
        title: 'GPT-5.6 Sol',
        tier: '프리미엄',
        description: 'OpenAI 최신 플래그십 · 강력한 추론 · 정확한 지시 이행',
        costKrw: 600, // 실측 ₩500 (기존 ₩60은 심각한 과소 표기)
        provider: 'openai',
        modelId: 'gpt-5.6-sol',
        fallback: ['gpt-5.6-sol', 'gpt-5.6-terra'],
    },
    // ─── Anthropic Claude (2026 최신) ───
    {
        value: 'claude-haiku',
        title: 'Claude Haiku 4.5',
        tier: '가성비',
        description: '빠른 응답 · 자연스러운 한국어 · 창의적 문체',
        costKrw: 220, // 실측 ₩185 (기존 ₩39는 과소 표기)
        provider: 'claude',
        modelId: 'claude-haiku-4-5-20251001',
        fallback: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
    },
    {
        value: 'claude-sonnet',
        title: 'Claude Sonnet 5',
        tier: '균형',
        description: '균형 잡힌 품질 · 자연스러운 한국어',
        costKrw: 840, // 실측 ₩700 (기존 ₩63은 심각한 과소 표기)
        provider: 'claude',
        modelId: 'claude-sonnet-5',
        fallback: ['claude-sonnet-5', 'claude-haiku-4-5-20251001'],
    },
    {
        value: 'claude-opus',
        title: 'Claude Fable 5',
        tier: '프리미엄',
        description: '최상급 추론 · 완벽한 글쓰기 · 매우 비쌈',
        costKrw: 4200, // 실측 ₩3500 (기존 ₩735는 심각한 과소 표기 — 실제 5배 이상 비쌈)
        provider: 'claude',
        modelId: 'claude-fable-5',
        fallback: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
    },
    // ─── Perplexity ───
    {
        value: 'perplexity-sonar',
        title: 'Perplexity Sonar Pro',
        tier: '실시간',
        description: '최신 웹 정보 기반 실시간 검색 · 팩트체크 소스',
        costKrw: 70, // 팩트체크 소량 호출 ~₩60 실측
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

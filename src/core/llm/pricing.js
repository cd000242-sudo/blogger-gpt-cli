"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIER_VALUE = exports.TIER_MODELS = exports.COST_MODEL = void 0;
exports.deriveCostKrw = deriveCostKrw;
exports.describeModelForLog = describeModelForLog;
exports.tierCostKrw = tierCostKrw;
exports.formatTierCost = formatTierCost;
exports.getPricingTable = getPricingTable;
exports.findTier = findTier;
exports.resolveDefaultTierValue = resolveDefaultTierValue;
exports.resolveDefaultProvider = resolveDefaultProvider;
exports.deriveProvider = deriveProvider;
exports.getCurrentTier = getCurrentTier;
exports.COST_MODEL = {
    inputTokens: 15000,
    outputTokens: 1200,
    retryFactor: 1.3,
    usdToKrw: 1400,
};
function deriveCostKrw(price, declared) {
    if (!price)
        return declared;
    const usd = ((exports.COST_MODEL.inputTokens / 1000000) * price.input
        + (exports.COST_MODEL.outputTokens / 1000000) * price.output) * exports.COST_MODEL.retryFactor;
    return Math.round(usd * exports.COST_MODEL.usdToKrw);
}
exports.TIER_MODELS = [
    {
        value: 'gemini-2.5-flash-lite',
        title: 'Gemini 3.1 Flash-Lite',
        tier: '가성비',
        description: '대량 발행 · 가장 저렴 · 빠른 속도',
        costKrw: 15,
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-lite',
        fallback: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
    },
    {
        value: 'gemini-2.5-flash',
        title: 'Gemini 3.8 Flash',
        tier: '균형',
        description: '최신 · 품질·속도·가격 균형 · 일반 블로그 글에 최적',
        costKrw: 29,
        provider: 'gemini',
        modelId: 'gemini-3.8-flash',
        fallback: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
        default: true,
        usdPer1M: { input: 0.75, output: 3.75, source: 'Gemini API 공식 가격표 2026-11-07 (3.8 Flash · 2027-01-01 부터 $1.50/$7.50)' },
    },
    {
        value: 'gemini-2.5-pro',
        title: 'Gemini 4 Argon',
        tier: '프리미엄',
        description: '최상위 추론 · 비용 큼(3.8 Flash의 약 2.6배) · 12/1부터 단가 2배',
        costKrw: 76,
        provider: 'gemini',
        modelId: 'gemini-4-argon',
        fallback: ['gemini-4-argon', 'gemini-3.8-flash'],
        usdPer1M: { input: 2, output: 10, source: 'Gemini API 공식 가격표 2026-11-07 (4 Argon · 2026-12-01 부터 $4/$20)' },
    },
    {
        value: 'openai-gpt4o-mini',
        title: 'GPT-6 Luna',
        tier: '가성비',
        description: 'GPT-6 Luna · 초저비용 · 빠른 속도 · 대량 발행',
        costKrw: 4,
        provider: 'openai',
        modelId: 'gpt-6-luna',
        fallback: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-5.6-luna'],
        usdPer1M: { input: 0.10, output: 0.50, source: 'OpenAI 공식 가격 2026-11-07 (GPT-6 Luna 입력 $0.10 / 출력 $0.50)' },
    },
    {
        value: 'openai-gpt41',
        title: 'GPT-6.1 Terra',
        tier: '균형',
        description: 'GPT-6.1 Terra · 품질/가격 균형 · 일반 블로그에 최적',
        costKrw: 38,
        provider: 'openai',
        modelId: 'gpt-6.1-terra',
        fallback: ['gpt-6.1-terra', 'gpt-6-luna', 'gpt-5.6-terra'],
        usdPer1M: { input: 1, output: 5, source: 'OpenAI 공식 가격 2026-11-07 (GPT-6.1 Terra 입력 $1 / 출력 $5)' },
    },
    {
        value: 'openai-gpt4o',
        title: 'GPT-6.1 Sol',
        tier: '프리미엄',
        description: 'GPT-6.1 Sol · 강력한 추론 · 고품질 글',
        costKrw: 76,
        provider: 'openai',
        modelId: 'gpt-6.1-sol',
        fallback: ['gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-5.6-sol'],
        usdPer1M: { input: 2, output: 10, source: 'OpenAI 공식 가격 2026-11-07 (GPT-6.1 Sol 입력 $2 / 출력 $10)' },
    },
    {
        value: 'openai-gpt6-astra',
        title: 'GPT-6 Astra',
        tier: '프리미엄',
        description: 'GPT-6 Astra · OpenAI 최신 플래그십 · 최상급 추론 · 고비용',
        costKrw: 382,
        provider: 'openai',
        modelId: 'gpt-6-astra',
        fallback: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra'],
        usdPer1M: { input: 10, output: 50, source: 'OpenAI 2026-09-03 출시가 (입력 $10 / 출력 $50 · 캐시 입력 $1)' },
    },
    {
        value: 'claude-haiku',
        title: 'Claude Haiku 5.5',
        tier: '가성비',
        description: '빠른 응답 · 저비용 · 표시 단가는 입력 10만 토큰 이하 기준',
        costKrw: 4,
        provider: 'claude',
        modelId: 'claude-haiku-5-5',
        fallback: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
        usdPer1M: { input: 0.10, output: 0.50, source: 'https://platform.claude.com/docs/en/models/haiku-5-5/overview · 2026-10-14 확인 · 입력 100,000토큰 이하 $0.10/$0.50; 초과 $0.50/$2.50 per MTok' },
    },
    {
        value: 'claude-sonnet',
        title: 'Claude Sonnet 5.5',
        tier: '균형',
        description: 'Claude Sonnet 5.5 · 품질과 속도의 균형 · 자연스러운 한국어',
        costKrw: 76,
        provider: 'claude',
        modelId: 'claude-sonnet-5-5',
        fallback: ['claude-sonnet-5-5', 'claude-haiku-5-5'],
        usdPer1M: { input: 2, output: 10, source: 'https://platform.claude.com/docs/en/models/overview · 2026-10-14 확인 · Standard $2/$10 per MTok' },
    },
    {
        value: 'claude-opus',
        title: 'Claude Opus 5.5',
        tier: '프리미엄',
        description: 'Claude Opus 5.5 · 고급 추론 · 복잡한 글쓰기',
        costKrw: 153,
        provider: 'claude',
        modelId: 'claude-opus-5-5',
        fallback: ['claude-opus-5-5', 'claude-sonnet-5-5'],
        usdPer1M: { input: 4, output: 20, source: 'https://platform.claude.com/docs/en/models/overview · 2026-10-14 확인 · Standard $4/$20 per MTok' },
    },
    {
        value: 'claude-opus-5',
        title: 'Claude Opus 5.5',
        tier: '프리미엄',
        description: 'Claude Opus 5.5 · 고급 추론 · 이전 설정 호환',
        costKrw: 153,
        provider: 'claude',
        modelId: 'claude-opus-5-5',
        fallback: ['claude-opus-5-5', 'claude-sonnet-5-5'],
        usdPer1M: { input: 4, output: 20, source: 'https://platform.claude.com/docs/en/models/overview · 2026-10-14 확인 · Standard $4/$20 per MTok' },
        hiddenFromUi: true,
    },
    {
        value: 'perplexity-sonar',
        title: 'Perplexity Sonar',
        tier: '실시간',
        description: '최신 웹 정보 기반 실시간 검색 + AI 분석',
        costKrw: 40,
        provider: 'perplexity',
        modelId: 'sonar-pro',
        fallback: ['sonar-pro', 'sonar'],
    },
];
function describeModelForLog(tierValue) {
    const value = String(tierValue || '').trim();
    if (!value)
        return '';
    const tier = findTier(value);
    return tier ? `${tier.title} (${tier.modelId})` : value;
}
exports.DEFAULT_TIER_VALUE = 'gemini-3.8-flash';
function tierCostKrw(tier) {
    return deriveCostKrw(tier.usdPer1M, tier.costKrw);
}
function formatTierCost(tier) {
    return `~₩${tierCostKrw(tier).toLocaleString('ko-KR')}/글`;
}
function getPricingTable() {
    return exports.TIER_MODELS.map(t => ({
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
function findTier(value) {
    if (!value)
        return undefined;
    let normalized = String(value).trim();
    if (/^(?:claude-)?fable(?:-|$)/i.test(normalized))
        normalized = 'claude-sonnet';
    const aliases = {
        'haiku': 'claude-haiku', 'sonnet': 'claude-sonnet', 'opus': 'claude-opus',
        'claude-haiku-4-5-20251001': 'claude-haiku', 'claude-haiku-4-5': 'claude-haiku',
        'claude-sonnet-5': 'claude-sonnet', 'claude-sonnet-4-6': 'claude-sonnet',
        'claude-opus-4-8': 'claude-opus', 'claude-opus-4-7': 'claude-opus',
    };
    normalized = aliases[normalized.toLowerCase()] || normalized;
    const exact = exports.TIER_MODELS.find(t => t.value === normalized || t.modelId === normalized);
    if (exact)
        return exact;
    return exports.TIER_MODELS.find(t => t.fallback.includes(normalized));
}
const PROVIDER_DEFAULT_TIER = {
    openai: 'openai-gpt41',
    claude: 'claude-sonnet',
    perplexity: 'perplexity-sonar',
    gemini: 'gemini-3.8-flash',
};
function readProviderFromSettings() {
    const fromProcess = String(process.env['AI_PROVIDER'] || '').trim().toLowerCase();
    if (fromProcess)
        return fromProcess;
    try {
        const { loadEnvFromFile } = require('../../env');
        const env = loadEnvFromFile() || {};
        return String(env['AI_PROVIDER'] || env['aiProvider'] || '').trim().toLowerCase();
    }
    catch {
        return '';
    }
}
function resolveDefaultTierValue() {
    const p = readProviderFromSettings();
    const mapped = PROVIDER_DEFAULT_TIER[p];
    if (mapped && findTier(mapped))
        return mapped;
    return exports.DEFAULT_TIER_VALUE;
}
function resolveDefaultProvider() {
    return findTier(resolveDefaultTierValue())?.provider ?? 'gemini';
}
function deriveProvider(value) {
    return findTier(value)?.provider ?? resolveDefaultProvider();
}
function getCurrentTier() {
    const fromEnv = process.env['PRIMARY_TEXT_MODEL'];
    return findTier(fromEnv) ?? findTier(resolveDefaultTierValue()) ?? findTier(exports.DEFAULT_TIER_VALUE);
}
//# sourceMappingURL=pricing.js.map
"use strict";
/**
 * Provider-wide text engine throttle.
 *
 * A single publish click can trigger multiple text calls: title, H2, body,
 * FAQ, CTA, table, tags, and image prompt helpers. Provider limits are
 * project/account scoped, so every text call must share one local queue.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTextProviderMinIntervalMs = getTextProviderMinIntervalMs;
exports.getTextProviderMaxRetries = getTextProviderMaxRetries;
exports.getDefaultRateLimitDelayMs = getDefaultRateLimitDelayMs;
exports.waitForTextProviderTurn = waitForTextProviderTurn;
exports.extractRetryDelayMs = extractRetryDelayMs;
exports.applyTextProviderCooldown = applyTextProviderCooldown;
exports.waitAfterProviderBackoff = waitAfterProviderBackoff;
exports.waitAfterProviderRateLimit = waitAfterProviderRateLimit;
const DEFAULT_MIN_INTERVAL_MS = {
    gemini: 2200,
    openai: 1500,
    claude: 1800,
    perplexity: 1800,
};
const DEFAULT_RETRY_DELAY_MS = {
    gemini: 4000,
    openai: 5000,
    claude: 5000,
    perplexity: 5000,
};
const states = {
    gemini: { lastStartedAt: 0, lock: Promise.resolve(), cooldownUntil: 0 },
    openai: { lastStartedAt: 0, lock: Promise.resolve(), cooldownUntil: 0 },
    claude: { lastStartedAt: 0, lock: Promise.resolve(), cooldownUntil: 0 },
    perplexity: { lastStartedAt: 0, lock: Promise.resolve(), cooldownUntil: 0 },
};
function envInt(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function providerEnvPrefix(provider) {
    return `TEXT_ENGINE_${provider.toUpperCase()}`;
}
function getTextProviderMinIntervalMs(provider) {
    const providerSpecific = envInt(`${providerEnvPrefix(provider)}_MIN_INTERVAL_MS`, -1);
    if (providerSpecific >= 0)
        return providerSpecific;
    if (provider === 'gemini') {
        const legacyGemini = envInt('GEMINI_MIN_INTERVAL_MS', -1);
        if (legacyGemini >= 0)
            return legacyGemini;
    }
    return envInt('TEXT_ENGINE_MIN_INTERVAL_MS', DEFAULT_MIN_INTERVAL_MS[provider]);
}
function getTextProviderMaxRetries(provider) {
    return Math.max(1, envInt(`${providerEnvPrefix(provider)}_MAX_RETRIES`, envInt('TEXT_ENGINE_MAX_RETRIES', 2)));
}
function getDefaultRateLimitDelayMs(provider, attempt) {
    const base = envInt(`${providerEnvPrefix(provider)}_RATE_LIMIT_BACKOFF_MS`, DEFAULT_RETRY_DELAY_MS[provider]);
    const multiplier = Math.max(1, attempt + 1);
    return Math.min(base * multiplier, getMaxRetryDelayMs());
}
function getMaxRetryDelayMs() {
    return Math.max(1000, envInt('TEXT_ENGINE_MAX_RETRY_DELAY_MS', 120000));
}
async function waitForTextProviderTurn(provider, label = 'text call') {
    const state = states[provider];
    const minInterval = getTextProviderMinIntervalMs(provider);
    state.lock = state.lock.catch(() => undefined).then(async () => {
        const now = Date.now();
        const waitUntil = Math.max(state.lastStartedAt + minInterval, state.cooldownUntil);
        const delayMs = waitUntil - now;
        if (delayMs > 0) {
            console.log(`[TEXT-QUEUE] ${provider} ${label} 대기 ${Math.ceil(delayMs / 1000)}초 (provider 공통 큐)`);
            await sleep(delayMs);
        }
        state.lastStartedAt = Date.now();
    });
    return state.lock;
}
function getHeaderValue(headers, name) {
    if (!headers)
        return undefined;
    if (typeof headers.get === 'function') {
        const direct = headers.get(name) ?? headers.get(name.toLowerCase());
        if (direct != null)
            return Array.isArray(direct) ? String(direct[0] ?? '') : String(direct);
    }
    const lowerName = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== lowerName)
            continue;
        const value = headers[key];
        if (Array.isArray(value))
            return value[0] != null ? String(value[0]) : undefined;
        if (value != null)
            return String(value);
    }
    return undefined;
}
function parseDelayMs(value) {
    if (!value)
        return undefined;
    const raw = value.trim();
    if (!raw)
        return undefined;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }
    const dateMs = Date.parse(raw);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, dateMs - Date.now());
    }
    const durationMatch = raw.match(/(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?/i);
    if (durationMatch && durationMatch[0]) {
        const hours = Number(durationMatch[1] || 0);
        const minutes = Number(durationMatch[2] || 0);
        const secs = Number(durationMatch[3] || 0);
        const total = ((hours * 60 + minutes) * 60 + secs) * 1000;
        return total > 0 ? total : undefined;
    }
    return undefined;
}
function extractRetryDelayMs(error, fallbackMs) {
    const headers = error?.response?.headers ?? error?.headers ?? error?.cause?.headers;
    const retryAfter = getHeaderValue(headers, 'retry-after');
    const resetRequests = getHeaderValue(headers, 'x-ratelimit-reset-requests') ||
        getHeaderValue(headers, 'anthropic-ratelimit-requests-reset') ||
        getHeaderValue(headers, 'x-ratelimit-reset');
    const parsed = parseDelayMs(retryAfter) ?? parseDelayMs(resetRequests) ?? fallbackMs;
    return Math.min(Math.max(parsed, 1000), getMaxRetryDelayMs());
}
function applyTextProviderCooldown(provider, delayMs) {
    const state = states[provider];
    state.cooldownUntil = Math.max(state.cooldownUntil, Date.now() + Math.max(0, delayMs));
}
async function waitAfterProviderBackoff(provider, error, attempt, label = 'rate limit', reason = 'provider backoff') {
    const delayMs = extractRetryDelayMs(error, getDefaultRateLimitDelayMs(provider, attempt));
    applyTextProviderCooldown(provider, delayMs);
    console.warn(`[TEXT-QUEUE] ${provider} ${label}: ${reason} → ${Math.ceil(delayMs / 1000)}초 쿨다운`);
    await sleep(delayMs);
    return delayMs;
}
function waitAfterProviderRateLimit(provider, error, attempt, label = 'rate limit') {
    return waitAfterProviderBackoff(provider, error, attempt, label, '429/rate limit 감지');
}

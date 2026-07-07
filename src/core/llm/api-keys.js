"use strict";
/**
 * LLM API 키 로더 — 팩토리 패턴
 * 4개 중복 함수를 1개로 통합
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClaudeApiKey = exports.getOpenAIApiKey = exports.getPerplexityApiKey = exports.getGeminiApiKey = void 0;
exports.getApiKey = getApiKey;
const env_1 = require("../../env");
const KEY_CONFIGS = {
    gemini: {
        envKeys: ['geminiKey', 'GEMINI_API_KEY'],
        processEnvKeys: ['GEMINI_API_KEY'],
        minLength: 20,
    },
    perplexity: {
        envKeys: ['perplexityKey', 'PERPLEXITY_API_KEY'],
        processEnvKeys: ['PERPLEXITY_API_KEY'],
        minLength: 10,
    },
    openai: {
        envKeys: ['openaiKey', 'OPENAI_API_KEY'],
        processEnvKeys: ['OPENAI_API_KEY'],
        minLength: 10,
    },
    claude: {
        envKeys: ['claudeKey', 'claudeApiKey', 'CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'],
        processEnvKeys: ['ANTHROPIC_API_KEY'],
        minLength: 10,
    },
};
function getApiKey(provider) {
    const config = KEY_CONFIGS[provider];
    if (!config) {
        throw new Error(`Unknown provider: ${provider}`);
    }
    try {
        const envData = (0, env_1.loadEnvFromFile)();
        for (const envKey of config.envKeys) {
            const val = envData[envKey];
            if (typeof val === 'string' && val.trim().length >= config.minLength) {
                return val.trim();
            }
        }
    }
    catch {
        // loadEnvFromFile 실패 시 process.env 폴백
    }
    for (const processKey of config.processEnvKeys) {
        const val = process.env[processKey];
        if (typeof val === 'string' && val.trim().length >= config.minLength) {
            return val.trim();
        }
    }
    return '';
}
// 하위호환: 기존 함수명 유지
const getGeminiApiKey = () => getApiKey('gemini');
exports.getGeminiApiKey = getGeminiApiKey;
const getPerplexityApiKey = () => getApiKey('perplexity');
exports.getPerplexityApiKey = getPerplexityApiKey;
const getOpenAIApiKey = () => getApiKey('openai');
exports.getOpenAIApiKey = getOpenAIApiKey;
const getClaudeApiKey = () => getApiKey('claude');
exports.getClaudeApiKey = getClaudeApiKey;

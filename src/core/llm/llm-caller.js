"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.callClaudeAPI = exports.callOpenAIAPI = exports.callPerplexityAPI = void 0;
exports.resolveLlmMaxTokens = resolveLlmMaxTokens;
exports.claudeAcceptsTemperature = claudeAcceptsTemperature;
exports.resolveClaudeMaxTokens = resolveClaudeMaxTokens;
exports.buildClaudeCacheContent = buildClaudeCacheContent;
exports.assertLiveLlmAllowed = assertLiveLlmAllowed;
exports.callLLM = callLLM;
exports.getGenAI = getGenAI;
const axios_1 = __importStar(require("axios"));
const generative_ai_1 = require("@google/generative-ai");
const api_keys_1 = require("./api-keys");
const pricing_1 = require("./pricing");
const openai_params_1 = require("./openai-params");
const claude_auth_1 = require("./claude-auth");
const language_rules_1 = require("../final/language-rules");
const provider_throttle_1 = require("./provider-throttle");
const FACTUAL_SYSTEM_TAIL = [
    'Preserve the requested structure and supplied evidence.',
    'Treat dates, amounts, eligibility, schedules, statistics, organization names, and URLs as factual claims.',
    'Use an exact factual claim only when it appears in supplied evidence; never combine unrelated facts into a new claim.',
    'Never invent a source, citation, URL, or plausible-looking value. When evidence is missing, use a neutral official-verification note instead of guessing.',
].join(' ');
function factualSystemPrompt() {
    return `${(0, language_rules_1.systemLanguageLine)()} ${FACTUAL_SYSTEM_TAIL}`;
}
function getGenerationTemperature(prompt) {
    return /\[FACT EVIDENCE|FACT INTEGRITY|Verified source URLs|grounding response/i.test(prompt) ? 0.28 : 0.52;
}
function resolveLlmMaxTokens() {
    const raw = Number(process.env['LLM_MAX_OUTPUT_TOKENS'] || '');
    if (Number.isFinite(raw) && raw >= 1024)
        return Math.floor(raw);
    return 16384;
}
function claudeAcceptsTemperature(model) {
    return /^claude-(?:haiku-4-5(?:-|$)|(?:2|3)[.-])/i.test(String(model || ''));
}
const CLAUDE_REASONING_MAX_TOKENS = 32768;
function resolveClaudeMaxTokens(model) {
    const raw = Number(process.env['LLM_MAX_OUTPUT_TOKENS'] || '');
    if (Number.isFinite(raw) && raw >= 1024)
        return Math.floor(raw);
    return claudeAcceptsTemperature(model) ? resolveLlmMaxTokens() : CLAUDE_REASONING_MAX_TOKENS;
}
function buildOpenAIChatBody(model, prompt) {
    const body = {
        model,
        messages: [
            { role: 'system', content: factualSystemPrompt() },
            { role: 'user', content: prompt },
        ],
    };
    return (0, openai_params_1.applyOpenAiTokenParams)(body, model, resolveLlmMaxTokens(), getGenerationTemperature(prompt), { reasoningEffort: 'medium' });
}
const PROVIDERS = {
    perplexity: {
        name: 'Perplexity',
        provider: 'perplexity',
        endpoint: 'https://api.perplexity.ai/chat/completions',
        models: ['sonar-pro', 'sonar'],
        timeout: 60000,
        rateLimitPattern: /429|rate.*limit|quota/i,
        authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key/i,
        buildHeaders: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        }),
        buildBody: (model, prompt) => ({
            model,
            messages: [
                { role: 'system', content: factualSystemPrompt() },
                { role: 'user', content: prompt },
            ],
            max_tokens: resolveLlmMaxTokens(),
            temperature: getGenerationTemperature(prompt),
        }),
        extractText: (data) => data?.choices?.[0]?.message?.content || '',
    },
    openai: {
        name: 'OpenAI',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.1-sol'],
        timeout: 90000,
        rateLimitPattern: /429|rate.*limit|quota|insufficient_quota/i,
        authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key/i,
        buildHeaders: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        }),
        buildBody: buildOpenAIChatBody,
        extractText: (data) => data?.choices?.[0]?.message?.content || '',
    },
    claude: {
        name: 'Claude',
        provider: 'claude',
        endpoint: 'https://api.anthropic.com/v1/messages',
        models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-haiku-4-5-20251001'],
        timeout: 90000,
        rateLimitPattern: /429|rate.*limit|overloaded/i,
        authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key|authentication/i,
        buildHeaders: (key) => (0, claude_auth_1.buildClaudeHeaders)(key),
        buildBody: (model, prompt) => ({
            model,
            max_tokens: resolveClaudeMaxTokens(model),
            messages: [{ role: 'user', content: prompt }],
            system: factualSystemPrompt(),
            ...(claudeAcceptsTemperature(model) ? { temperature: getGenerationTemperature(prompt) } : {}),
        }),
        extractText: (data) => {
            const content = data?.content;
            if (Array.isArray(content)) {
                return content
                    .filter((block) => block.type === 'text' && typeof block.text === 'string')
                    .map((block) => block.text)
                    .join('');
            }
            return '';
        },
    },
};
function resolveModelChain(provider) {
    const baseModels = PROVIDERS[provider].models;
    const tier = (0, pricing_1.findTier)(process.env['PRIMARY_TEXT_MODEL']);
    if (tier && tier.provider === provider)
        return [tier.modelId];
    return baseModels.slice(0, 1);
}
const SLOW_REASONING_MODEL = /astra|sol\b|terra|^o\d|opus|sonnet/i;
const SLOW_MODEL_TIMEOUT_MS = 240000;
function resolveCallTimeout(config, model) {
    const override = Number(process.env['LLM_TIMEOUT_MS'] || '');
    if (Number.isFinite(override) && override >= 10000)
        return Math.floor(override);
    return SLOW_REASONING_MODEL.test(model) ? Math.max(config.timeout, SLOW_MODEL_TIMEOUT_MS) : config.timeout;
}
const FASTER_SIBLING = {
    openai: {
        'gpt-6-astra': 'gpt-6-luna',
        'gpt-6.1-sol': 'gpt-6-luna',
        'gpt-6.1-terra': 'gpt-6-luna',
        'gpt-5.6-sol': 'gpt-6-luna',
        'gpt-5.6-terra': 'gpt-6-luna',
    },
    claude: {
        'claude-opus-5': 'claude-sonnet-5-5',
        'claude-opus-5-5': 'claude-sonnet-5-5',
    },
    perplexity: {
        'sonar-pro': 'sonar',
    },
};
function fasterSiblingOf(provider, model) {
    return FASTER_SIBLING[provider]?.[model] || null;
}
function recordDowngrade(provider, from, to, reason = 'timeout') {
    try {
        const g = globalThis;
        if (!g.__llmDowngrades)
            g.__llmDowngrades = [];
        g.__llmDowngrades.push({ provider, from, to, reason, at: Date.now() });
    }
    catch { }
}
function notifyUser(message) {
    console.warn(`[LLM] ${message}`);
    try {
        globalThis.__llmNotice?.(message);
    }
    catch { }
}
function recordActualModel(provider, model) {
    try {
        const g = globalThis;
        if (!g.__llmActualModels)
            g.__llmActualModels = {};
        const key = `${provider}/${model}`;
        g.__llmActualModels[key] = (g.__llmActualModels[key] || 0) + 1;
    }
    catch { }
}
function extractErrorMessage(error) {
    if (error instanceof axios_1.AxiosError) {
        const data = error.response?.data;
        const providerMessage = data?.error?.message || data?.error?.type || data?.message;
        const status = error.response?.status ? `HTTP ${error.response.status}` : '';
        return [status, providerMessage, error.message].filter(Boolean).join(' | ');
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function classifyProviderFailure(config, error) {
    const msg = extractErrorMessage(error).toLowerCase();
    const status = error instanceof axios_1.AxiosError ? error.response?.status : undefined;
    if (config.provider === 'claude' && (0, claude_auth_1.isClaudeWorkspaceError)(error))
        return 'workspace';
    if (/quota|insufficient_quota|resource_exhausted|credits?|exceeded.*current|exceeded.*limit/i.test(msg))
        return 'quota';
    if (/billing|payment|paid plan|pay-as-you-go|billing account|project.*billing|disabled billing/i.test(msg))
        return 'billing';
    if (config.authErrorPattern.test(msg) || status === 401 || status === 403)
        return 'auth';
    if (config.rateLimitPattern.test(msg) || status === 429)
        return 'rate_limit';
    if (/model.*not.*found|invalid.*model|does not exist|unsupported model|404/i.test(msg))
        return 'model';
    if (/timeout|timed out|time out|abort|deadline/i.test(msg))
        return 'timeout';
    if (/network|econnreset|enotfound|etimedout|socket|dns|connection/i.test(msg))
        return 'network';
    if (/empty response|empty text|빈 응답/i.test(msg))
        return 'empty';
    return 'unknown';
}
function shouldStopModelChain(kind) {
    return kind === 'workspace' || kind === 'auth' ||
        kind === 'billing' ||
        kind === 'quota' ||
        kind === 'rate_limit';
}
function buildProviderError(config, kind, model, attempts, rawMessage) {
    const detail = rawMessage.replace(/\s+/g, ' ').slice(0, 260);
    const guide = {
        workspace: claude_auth_1.CLAUDE_WORKSPACE_GUIDE,
        auth: 'API 키가 만료되었거나 해당 프로젝트/조직에서 사용할 권한이 없습니다.',
        billing: '결제 연결 또는 유료 플랜/프로젝트 연결 상태를 확인해야 합니다.',
        quota: '결제 잔액이 있어도 분당/일일/토큰 한도 또는 프로젝트 쿼터에 걸릴 수 있습니다.',
        rate_limit: '짧은 시간에 요청이 몰렸습니다. 앱이 자동 대기 후 재시도했지만 provider 제한이 계속 반환되었습니다.',
        model: '현재 선택된 모델을 사용할 수 없습니다. 같은 provider의 다른 모델로 변경해 주세요.',
        timeout: '응답 시간이 제한을 넘었습니다(같은 엔진의 빠른 모델로 한 번 더 시도한 뒤에도 실패). provider 가 붐비는 시간일 수 있습니다 — 잠시 후 다시 시도하거나 글 길이를 줄여 보세요.',
        network: '네트워크, VPN, 방화벽 또는 provider 일시 장애를 확인해 주세요.',
        empty: 'provider가 빈 응답을 반환했습니다.',
        unknown: 'provider에서 분류되지 않은 오류가 반환되었습니다.',
    };
    return new Error(`${kind === 'workspace' ? 'CLAUDE_WORKSPACE_ERROR: ' : ''}${config.name} 엔진 호출 실패 (${attempts}회 시도, model=${model})\n` +
        `원인: ${guide[kind]}\n` +
        `세부: ${detail}`);
}
function buildClaudeCacheContent(segments) {
    const list = (segments || []).filter((s) => String(s?.text || '').length > 0);
    if (list.length === 0 || !list.some((s) => s.cache))
        return null;
    return list.map((s) => ({
        type: 'text',
        text: s.text,
        ...(s.cache ? { cache_control: { type: 'ephemeral' } } : {}),
    }));
}
function assertLiveLlmAllowed(where) {
    if (process.env['NO_LIVE_LLM'] === '1')
        throw new Error(`NO_LIVE_LLM=1 — 유료 LLM 호출이 막혀 있습니다 (${where})`);
    const allow = String(process.env['LLM_PROVIDER_ALLOWLIST'] || '').trim();
    if (allow) {
        const provider = where.split('/')[1] || '';
        const allowed = allow.split(',').map((s) => s.trim()).filter(Boolean);
        if (provider && !allowed.includes(provider))
            throw new Error(`LLM_PROVIDER_ALLOWLIST=${allow} — ${provider} 호출이 막혀 있습니다 (${where})`);
    }
}
async function callLLM(provider, prompt, options = {}) {
    assertLiveLlmAllowed(`callLLM/${String(provider)}`);
    const config = PROVIDERS[provider];
    if (!config) {
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
    const apiKey = (0, api_keys_1.getApiKey)(provider);
    if (!apiKey) {
        throw new Error(`${config.name} API 키가 설정되지 않았습니다.`);
    }
    let lastError = null;
    const modelChain = resolveModelChain(provider);
    const maxRetries = (0, provider_throttle_1.getTextProviderMaxRetries)(config.provider);
    let totalAttempts = 0;
    let cancelToken = null;
    try {
        cancelToken = require('../cancel-token');
    }
    catch { }
    const cancelSignal = cancelToken?.getCancelSignal?.() || undefined;
    const queue = [...modelChain];
    const tried = new Set();
    let downgraded = false;
    let useJsonMode = options.json === true && provider === 'openai';
    const droppedParams = new Set();
    while (queue.length > 0) {
        const model = queue.shift();
        tried.add(model);
        let lastKind = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            totalAttempts++;
            try {
                await (0, provider_throttle_1.waitForTextProviderTurn)(config.provider, `${config.name}/${model}`);
                const callTimeout = resolveCallTimeout(config, model);
                console.log(`[LLM] ${config.name} ${model} attempt ${attempt + 1}/${maxRetries} (제한 ${Math.round(callTimeout / 1000)}초)`);
                const requestBody = config.buildBody(model, prompt);
                if (useJsonMode)
                    requestBody['response_format'] = { type: 'json_object' };
                for (const p of droppedParams)
                    delete requestBody[p];
                if (provider === 'claude' && options.cacheSegments) {
                    const content = buildClaudeCacheContent(options.cacheSegments);
                    if (content)
                        requestBody['messages'] = [{ role: 'user', content }];
                }
                const response = await axios_1.default.post(config.endpoint, requestBody, {
                    headers: config.buildHeaders(apiKey),
                    timeout: callTimeout,
                    ...(cancelSignal ? { signal: cancelSignal } : {}),
                });
                try {
                    const usage = response.data?.usage;
                    if (usage) {
                        const g = globalThis;
                        if (!g.__llmUsage)
                            g.__llmUsage = { calls: 0, input: 0, output: 0, byModel: {} };
                        const inTok = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
                        const outTok = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
                        const cacheWrite = Number(usage.cache_creation_input_tokens ?? 0) || 0;
                        const cacheRead = Number(usage.cache_read_input_tokens ?? 0) || 0;
                        const thinkTok = Number(usage.output_tokens_details?.thinking_tokens ?? 0) || 0;
                        g.__llmUsage.cacheWrite = (g.__llmUsage.cacheWrite || 0) + cacheWrite;
                        g.__llmUsage.cacheRead = (g.__llmUsage.cacheRead || 0) + cacheRead;
                        g.__llmUsage.thinking = (g.__llmUsage.thinking || 0) + thinkTok;
                        if (cacheRead > 0)
                            g.__llmUsage.cacheHits = (g.__llmUsage.cacheHits || 0) + 1;
                        else if (cacheWrite > 0)
                            g.__llmUsage.cacheMisses = (g.__llmUsage.cacheMisses || 0) + 1;
                        g.__llmUsage.calls += 1;
                        g.__llmUsage.input += inTok;
                        g.__llmUsage.output += outTok;
                        const key = `${config.provider}/${model}`;
                        const slot = g.__llmUsage.byModel[key] || { calls: 0, input: 0, output: 0 };
                        slot.calls += 1;
                        slot.input += inTok;
                        slot.output += outTok;
                        g.__llmUsage.byModel[key] = slot;
                        if (!Array.isArray(g.__llmCallLog))
                            g.__llmCallLog = [];
                        g.__llmCallLog.push({ at: Date.now(), provider: config.provider, model, input: inTok, output: outTok, cacheWrite, cacheRead, thinking: thinkTok, promptHead: String(prompt || '').slice(0, 80), promptChars: String(prompt || '').length });
                        if (cacheWrite || cacheRead)
                            console.log(`[CACHE] ${config.provider}/${model} write ${cacheWrite} · read ${cacheRead} (입력 ${inTok})`);
                    }
                }
                catch { }
                const text = config.extractText(response.data);
                if (text) {
                    recordActualModel(config.provider, model);
                    return text;
                }
                throw new Error('빈 응답');
            }
            catch (error) {
                if (cancelToken && (error?.code === 'ERR_CANCELED' || cancelToken.isCancellation?.(error) || cancelToken.isCanceled?.())) {
                    throw new cancelToken.CanceledError(`${config.name} 호출 중`);
                }
                try {
                    const g = globalThis;
                    if (!g.__llmUsage)
                        g.__llmUsage = { calls: 0, input: 0, output: 0, failedCalls: 0, byModel: {} };
                    g.__llmUsage.failedCalls = (g.__llmUsage.failedCalls || 0) + 1;
                    g.__llmUsage.input += Math.ceil(String(prompt || '').length / 2);
                }
                catch { }
                const errorMsg = extractErrorMessage(error);
                if (useJsonMode && /response_format|json_object|json mode/i.test(errorMsg)) {
                    useJsonMode = false;
                    console.warn(`[LLM] ${model} 은(는) JSON 모드를 받지 않습니다 — 프롬프트 지시만으로 다시 부릅니다`);
                    attempt -= 1;
                    continue;
                }
                if (!droppedParams.size && /`?(temperature|top_p|top_k)`? is deprecated|unsupported parameter|not supported for this model/i.test(errorMsg)) {
                    const param = (errorMsg.match(/`?(temperature|top_p|top_k)`?/i) || [])[1];
                    if (param) {
                        droppedParams.add(param.toLowerCase());
                        console.warn(`[LLM] ${model} 은(는) ${param} 을(를) 받지 않습니다 — 그 값만 빼고 다시 부릅니다`);
                        attempt -= 1;
                        continue;
                    }
                }
                const kind = classifyProviderFailure(config, error);
                lastKind = kind;
                lastError = buildProviderError(config, kind, model, totalAttempts, errorMsg);
                console.warn(`[LLM] ${config.name} ${model} 실패 (${kind}): ${errorMsg.slice(0, 140)}`);
                if (kind === 'rate_limit' && attempt < maxRetries - 1) {
                    await (0, provider_throttle_1.waitAfterProviderRateLimit)(config.provider, error, attempt, `${config.name}/${model}`);
                    continue;
                }
                if (kind === 'timeout' || kind === 'network') {
                    if (attempt < maxRetries - 1) {
                        await (0, provider_throttle_1.waitAfterProviderBackoff)(config.provider, error, attempt, `${config.name}/${model} transient`, `${kind} 재시도`);
                        continue;
                    }
                }
                if (shouldStopModelChain(kind)) {
                    throw lastError;
                }
                break;
            }
        }
        if (lastKind === 'timeout' && !downgraded) {
            const faster = fasterSiblingOf(provider, model);
            if (faster && !tried.has(faster)) {
                downgraded = true;
                recordDowngrade(provider, model, faster, 'timeout');
                notifyUser(`⚠️ 모델 하향: ${config.name} ${model} 이(가) 제한시간을 넘겼습니다 → 같은 엔진의 빠른 모델 ${faster} 로 한 번 더 시도합니다. 이 호출은 ${faster} 가 씁니다 (다른 엔진으로는 넘어가지 않습니다).`);
                queue.push(faster);
            }
        }
    }
    throw lastError || new Error(`모든 ${config.name} 모델 호출 실패`);
}
const callPerplexityAPI = (prompt, options) => callLLM('perplexity', prompt, options);
exports.callPerplexityAPI = callPerplexityAPI;
const callOpenAIAPI = (prompt, options) => callLLM('openai', prompt, options);
exports.callOpenAIAPI = callOpenAIAPI;
const callClaudeAPI = (prompt, options) => callLLM('claude', prompt, options);
exports.callClaudeAPI = callClaudeAPI;
let _genAI = null;
function getGenAI() {
    if (!_genAI) {
        const apiKey = (0, api_keys_1.getApiKey)('gemini');
        if (!apiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.');
        }
        _genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return _genAI;
}
//# sourceMappingURL=llm-caller.js.map
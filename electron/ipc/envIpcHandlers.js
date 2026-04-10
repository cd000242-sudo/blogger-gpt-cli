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
exports.registerEnvIpcHandlers = registerEnvIpcHandlers;
/**
 * 환경 설정 IPC 핸들러
 * electron/main.ts에서 분리
 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/** camelCase → 대문자 환경변수 키 매핑 */
const ENV_KEY_MAP = {
    blogId: 'BLOG_ID',
    bloggerId: 'BLOG_ID',
    googleClientId: 'GOOGLE_CLIENT_ID',
    googleClientSecret: 'GOOGLE_CLIENT_SECRET',
    naverClientId: 'NAVER_CLIENT_ID',
    naverClientSecret: 'NAVER_CLIENT_SECRET',
    naverCustomerId: 'NAVER_CLIENT_ID',
    naverSecretKey: 'NAVER_CLIENT_SECRET',
    geminiKey: 'GEMINI_API_KEY',
    geminiApiKey: 'GEMINI_API_KEY',
    openaiKey: 'OPENAI_API_KEY',
    openaiApiKey: 'OPENAI_API_KEY',
    dalleApiKey: 'DALLE_API_KEY',
    pexelsApiKey: 'PEXELS_API_KEY',
    stabilityApiKey: 'STABILITY_API_KEY',
    stabilityKey: 'STABILITY_API_KEY',
    googleCseKey: 'GOOGLE_CSE_KEY',
    googleCseCx: 'GOOGLE_CSE_CX',
    youtubeApiKey: 'YOUTUBE_API_KEY',
    wordpressSiteUrl: 'WORDPRESS_SITE_URL',
    wordpressUsername: 'WORDPRESS_USERNAME',
    wordpressPassword: 'WORDPRESS_PASSWORD',
    minChars: 'MIN_CHARS',
    adspowerPort: 'ADSPOWER_PORT',
    adspowerProfileId: 'ADSPOWER_PROFILE_ID',
    adspowerApiKey: 'ADSPOWER_API_KEY',
    crawlProxy: 'CRAWL_PROXY',
    generationEngine: 'GENERATION_ENGINE',
    primaryGeminiTextModel: 'PRIMARY_TEXT_MODEL',
    defaultAiProvider: 'DEFAULT_AI_PROVIDER',
};
function parseEnvContent(content) {
    const envMap = new Map();
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            envMap.set(match[1].trim(), match[2].trim());
        }
    }
    return envMap;
}
function registerEnvIpcHandlers() {
    const envPath = () => path.join(electron_1.app.getPath('userData'), '.env');
    electron_1.ipcMain.handle('get-env', async () => {
        try {
            const p = envPath();
            if (!fs.existsSync(p))
                return { ok: true, data: {} };
            const content = fs.readFileSync(p, 'utf-8');
            const env = {};
            for (const [key, value] of parseEnvContent(content)) {
                env[key] = value;
            }
            return { ok: true, data: env };
        }
        catch (error) {
            console.error('[ENV] .env 읽기 실패:', error);
            return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', data: {} };
        }
    });
    electron_1.ipcMain.handle('save-env', async (_evt, envData) => {
        try {
            const p = envPath();
            const envMap = fs.existsSync(p)
                ? parseEnvContent(fs.readFileSync(p, 'utf-8'))
                : new Map();
            for (const [key, value] of Object.entries(envData)) {
                if (value !== undefined && value !== null && value !== '') {
                    const envKey = ENV_KEY_MAP[key] || key.toUpperCase();
                    envMap.set(envKey, String(value));
                    if (ENV_KEY_MAP[key] && key !== envKey) {
                        envMap.set(key, String(value));
                    }
                }
            }
            const lines = Array.from(envMap.entries()).map(([k, v]) => `${k}=${v}`);
            fs.writeFileSync(p, lines.join('\n'), 'utf-8');
            console.log('[ENV] .env 파일 저장 완료:', { 총개수: envMap.size });
            return { ok: true };
        }
        catch (error) {
            console.error('[ENV] .env 저장 실패:', error);
            return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
        }
    });
}

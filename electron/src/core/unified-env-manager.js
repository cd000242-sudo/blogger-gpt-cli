"use strict";
/**
 * 통합 환경변수 관리자
 * 모든 환경변수 로드 로직을 하나로 통합하여 중복 제거
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedEnvManager = void 0;
var fs = require("fs");
var path = require("path");
var electron_1 = require("electron");
var UnifiedEnvManager = /** @class */ (function () {
    function UnifiedEnvManager() {
        this.config = null;
        // 사용자 데이터 폴더에 .env 파일 저장
        this.configPath = path.join(electron_1.app.getPath('userData'), '.env');
    }
    UnifiedEnvManager.getInstance = function () {
        if (!UnifiedEnvManager.instance) {
            UnifiedEnvManager.instance = new UnifiedEnvManager();
        }
        return UnifiedEnvManager.instance;
    };
    /**
     * 환경변수 로드 (통합 버전)
     */
    UnifiedEnvManager.prototype.loadConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var defaultConfig, fileConfig, envContent, processConfig, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.config) {
                            return [2 /*return*/, this.config];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        console.log('[ENV] 통합 환경변수 로드 시작');
                        defaultConfig = {
                            openaiApiKey: '',
                            geminiApiKey: '',
                            claudeApiKey: '',
                            naverClientId: '',
                            naverClientSecret: '',
                            googleApiKey: '',
                            googleCseId: '',
                            googleClientId: '',
                            googleClientSecret: '',
                            blogId: '',
                            wordpressSiteUrl: '',
                            wordpressUsername: '',
                            wordpressPassword: '',
                            pexelsApiKey: '',
                            minChars: 2000,
                            platform: 'wordpress',
                            massCrawlingEnabled: true,
                            maxConcurrentRequests: 20,
                            maxResultsPerSource: 1000,
                            enableFullContentCrawling: true,
                            crawlingTimeout: 30000,
                            rssFeedTimeout: 10000,
                            naverApiTimeout: 10000,
                            cseApiTimeout: 10000,
                            enableCaching: true,
                            cacheExpirySeconds: 3600,
                            cacheMaxSize: 1000,
                            puppeteerHeadless: true,
                            puppeteerTimeout: 30000,
                            logLevel: 'info',
                            logFile: 'logs/crawler.log',
                            enablePerformanceMonitoring: true,
                            enableDetailedLogging: true,
                            performanceMonitoring: true,
                            memoryLimitMb: 1024
                        };
                        fileConfig = {};
                        if (!fs.existsSync(this.configPath)) return [3 /*break*/, 2];
                        try {
                            envContent = fs.readFileSync(this.configPath, 'utf8');
                            fileConfig = this.parseEnvFile(envContent);
                            console.log('[ENV] .env 파일에서 로드 완료');
                        }
                        catch (error) {
                            console.warn('[ENV] .env 파일 읽기 실패:', error);
                        }
                        return [3 /*break*/, 4];
                    case 2:
                        console.log('[ENV] .env 파일이 없음, 기본 템플릿 생성');
                        return [4 /*yield*/, this.createDefaultEnvFile()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        processConfig = {
                            openaiApiKey: process.env['OPENAI_API_KEY'] || '',
                            geminiApiKey: process.env['GEMINI_API_KEY'] || '',
                            claudeApiKey: process.env['CLAUDE_API_KEY'] || '',
                            naverClientId: process.env['NAVER_CLIENT_ID'] || '',
                            naverClientSecret: process.env['NAVER_CLIENT_SECRET'] || '',
                            googleApiKey: process.env['GOOGLE_API_KEY'] || '',
                            googleCseId: process.env['GOOGLE_CSE_ID'] || '',
                            googleClientId: process.env['GOOGLE_CLIENT_ID'] || '',
                            googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
                            blogId: process.env['BLOG_ID'] || '',
                            wordpressSiteUrl: process.env['WORDPRESS_SITE_URL'] || '',
                            wordpressUsername: process.env['WORDPRESS_USERNAME'] || '',
                            wordpressPassword: process.env['WORDPRESS_PASSWORD'] || '',
                            pexelsApiKey: process.env['PEXELS_API_KEY'] || '',
                            minChars: parseInt(process.env['MIN_CHARS'] || '2000'),
                            platform: (process.env['PLATFORM'] || 'wordpress'),
                            massCrawlingEnabled: process.env['MASS_CRAWLING_ENABLED'] !== 'false',
                            maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] || '20'),
                            maxResultsPerSource: parseInt(process.env['MAX_RESULTS_PER_SOURCE'] || '1000'),
                            enableFullContentCrawling: process.env['ENABLE_FULL_CONTENT_CRAWLING'] !== 'false',
                            crawlingTimeout: parseInt(process.env['CRAWLING_TIMEOUT'] || '30000'),
                            rssFeedTimeout: parseInt(process.env['RSS_FEED_TIMEOUT'] || '10000'),
                            naverApiTimeout: parseInt(process.env['NAVER_API_TIMEOUT'] || '10000'),
                            cseApiTimeout: parseInt(process.env['CSE_API_TIMEOUT'] || '10000'),
                            enableCaching: process.env['ENABLE_CACHING'] !== 'false',
                            cacheExpirySeconds: parseInt(process.env['CACHE_EXPIRY_SECONDS'] || '3600'),
                            cacheMaxSize: parseInt(process.env['CACHE_MAX_SIZE'] || '1000'),
                            puppeteerHeadless: process.env['PUPPETEER_HEADLESS'] !== 'false',
                            puppeteerTimeout: parseInt(process.env['PUPPETEER_TIMEOUT'] || '30000'),
                            logLevel: process.env['LOG_LEVEL'] || 'info',
                            logFile: process.env['LOG_FILE'] || 'logs/crawler.log',
                            enablePerformanceMonitoring: process.env['ENABLE_PERFORMANCE_MONITORING'] !== 'false',
                            enableDetailedLogging: process.env['ENABLE_DETAILED_LOGGING'] !== 'false',
                            performanceMonitoring: process.env['PERFORMANCE_MONITORING'] !== 'false',
                            memoryLimitMb: parseInt(process.env['MEMORY_LIMIT_MB'] || '1024')
                        };
                        // 4. 우선순위: 파일 > process.env > 기본값
                        this.config = __assign(__assign(__assign({}, defaultConfig), processConfig), fileConfig);
                        console.log('[ENV] 통합 환경변수 로드 완료');
                        return [2 /*return*/, this.config];
                    case 5:
                        error_1 = _a.sent();
                        console.error('[ENV] 환경변수 로드 실패:', error_1);
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * .env 파일 파싱
     */
    UnifiedEnvManager.prototype.parseEnvFile = function (content) {
        var config = {};
        var lines = content.split('\n');
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                var _a = trimmedLine.split('='), key = _a[0], valueParts = _a.slice(1);
                if (key && valueParts.length > 0) {
                    var value = valueParts.join('=').trim();
                    // 키 매핑
                    switch (key.trim()) {
                        case 'OPENAI_API_KEY':
                            config.openaiApiKey = value;
                            break;
                        case 'GEMINI_API_KEY':
                            config.geminiApiKey = value;
                            break;
                        case 'CLAUDE_API_KEY':
                            config.claudeApiKey = value;
                            break;
                        case 'NAVER_CLIENT_ID':
                            config.naverClientId = value;
                            break;
                        case 'NAVER_CLIENT_SECRET':
                            config.naverClientSecret = value;
                            break;
                        case 'GOOGLE_API_KEY':
                            config.googleApiKey = value;
                            break;
                        case 'GOOGLE_CSE_ID':
                            config.googleCseId = value;
                            break;
                        case 'GOOGLE_CLIENT_ID':
                            config.googleClientId = value;
                            break;
                        case 'GOOGLE_CLIENT_SECRET':
                            config.googleClientSecret = value;
                            break;
                        case 'BLOG_ID':
                            config.blogId = value;
                            break;
                        case 'WORDPRESS_SITE_URL':
                            config.wordpressSiteUrl = value;
                            break;
                        case 'WORDPRESS_USERNAME':
                            config.wordpressUsername = value;
                            break;
                        case 'WORDPRESS_PASSWORD':
                            config.wordpressPassword = value;
                            break;
                        case 'PEXELS_API_KEY':
                            config.pexelsApiKey = value;
                            break;
                        case 'MIN_CHARS':
                            config.minChars = parseInt(value) || 2000;
                            break;
                        case 'PLATFORM':
                            config.platform = value;
                            break;
                        case 'MASS_CRAWLING_ENABLED':
                            config.massCrawlingEnabled = value.toLowerCase() !== 'false';
                            break;
                        case 'MAX_CONCURRENT_REQUESTS':
                            config.maxConcurrentRequests = parseInt(value) || 20;
                            break;
                        case 'MAX_RESULTS_PER_SOURCE':
                            config.maxResultsPerSource = parseInt(value) || 1000;
                            break;
                        case 'ENABLE_FULL_CONTENT_CRAWLING':
                            config.enableFullContentCrawling = value.toLowerCase() !== 'false';
                            break;
                        case 'CRAWLING_TIMEOUT':
                            config.crawlingTimeout = parseInt(value) || 30000;
                            break;
                        case 'RSS_FEED_TIMEOUT':
                            config.rssFeedTimeout = parseInt(value) || 10000;
                            break;
                        case 'NAVER_API_TIMEOUT':
                            config.naverApiTimeout = parseInt(value) || 10000;
                            break;
                        case 'CSE_API_TIMEOUT':
                            config.cseApiTimeout = parseInt(value) || 10000;
                            break;
                        case 'ENABLE_CACHING':
                            config.enableCaching = value.toLowerCase() !== 'false';
                            break;
                        case 'CACHE_EXPIRY_SECONDS':
                            config.cacheExpirySeconds = parseInt(value) || 3600;
                            break;
                        case 'CACHE_MAX_SIZE':
                            config.cacheMaxSize = parseInt(value) || 1000;
                            break;
                        case 'PUPPETEER_HEADLESS':
                            config.puppeteerHeadless = value.toLowerCase() !== 'false';
                            break;
                        case 'PUPPETEER_TIMEOUT':
                            config.puppeteerTimeout = parseInt(value) || 30000;
                            break;
                        case 'LOG_LEVEL':
                            config.logLevel = value;
                            break;
                        case 'LOG_FILE':
                            config.logFile = value;
                            break;
                        case 'ENABLE_PERFORMANCE_MONITORING':
                            config.enablePerformanceMonitoring = value.toLowerCase() !== 'false';
                            break;
                        case 'ENABLE_DETAILED_LOGGING':
                            config.enableDetailedLogging = value.toLowerCase() !== 'false';
                            break;
                        case 'PERFORMANCE_MONITORING':
                            config.performanceMonitoring = value.toLowerCase() !== 'false';
                            break;
                        case 'MEMORY_LIMIT_MB':
                            config.memoryLimitMb = parseInt(value) || 1024;
                            break;
                    }
                }
            }
        }
        return config;
    };
    /**
     * 기본 .env 파일 생성
     */
    UnifiedEnvManager.prototype.createDefaultEnvFile = function () {
        return __awaiter(this, void 0, void 0, function () {
            var defaultContent;
            return __generator(this, function (_a) {
                defaultContent = "# LEADERNAM Orbit \uD658\uACBD \uC124\uC815\n\n# AI API Keys\nOPENAI_API_KEY=\nGEMINI_API_KEY=\nCLAUDE_API_KEY=\n\n# Naver API Keys\nNAVER_CLIENT_ID=\nNAVER_CLIENT_SECRET=\n\n# Google API Keys\nGOOGLE_API_KEY=\nGOOGLE_CSE_ID=\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n\n# Blog Settings\nBLOG_ID=\nWORDPRESS_SITE_URL=\nWORDPRESS_USERNAME=\nWORDPRESS_PASSWORD=\n\n# Image API Keys\nPEXELS_API_KEY=\n\n# App Settings\nMIN_CHARS=2000\nPLATFORM=blogger\nMASS_CRAWLING_ENABLED=true\nMAX_CONCURRENT_REQUESTS=20\nMAX_RESULTS_PER_SOURCE=1000\nENABLE_FULL_CONTENT_CRAWLING=true\n\n# Performance Settings\nCRAWLING_TIMEOUT=30000\nRSS_FEED_TIMEOUT=10000\nNAVER_API_TIMEOUT=10000\nCSE_API_TIMEOUT=10000\n\n# Cache Settings\nENABLE_CACHING=true\nCACHE_EXPIRY_SECONDS=3600\nCACHE_MAX_SIZE=1000\n\n# Puppeteer Settings\nPUPPETEER_HEADLESS=true\nPUPPETEER_TIMEOUT=30000\n\n# Logging Settings\nLOG_LEVEL=info\nLOG_FILE=logs/crawler.log\nENABLE_PERFORMANCE_MONITORING=true\nENABLE_DETAILED_LOGGING=true\n\n# Performance Settings\nPERFORMANCE_MONITORING=true\nMEMORY_LIMIT_MB=1024\n";
                try {
                    fs.writeFileSync(this.configPath, defaultContent, 'utf8');
                    console.log('[ENV] 기본 .env 파일 생성 완료');
                }
                catch (error) {
                    console.error('[ENV] 기본 .env 파일 생성 실패:', error);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 설정 저장
     */
    UnifiedEnvManager.prototype.saveConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var envContent, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!!this.config) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.loadConfig()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // 기존 설정과 병합
                        this.config = __assign(__assign({}, this.config), config);
                        envContent = this.generateEnvContent(this.config);
                        fs.writeFileSync(this.configPath, envContent, 'utf8');
                        console.log('[ENV] 설정 저장 완료');
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[ENV] 설정 저장 실패:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * .env 파일 내용 생성
     */
    UnifiedEnvManager.prototype.generateEnvContent = function (config) {
        return "# LEADERNAM Orbit \uD658\uACBD \uC124\uC815\n\n# AI API Keys\nOPENAI_API_KEY=".concat(config.openaiApiKey, "\nGEMINI_API_KEY=").concat(config.geminiApiKey, "\nCLAUDE_API_KEY=").concat(config.claudeApiKey, "\n\n# Naver API Keys\nNAVER_CLIENT_ID=").concat(config.naverClientId, "\nNAVER_CLIENT_SECRET=").concat(config.naverClientSecret, "\n\n# Google API Keys\nGOOGLE_API_KEY=").concat(config.googleApiKey, "\nGOOGLE_CSE_ID=").concat(config.googleCseId, "\nGOOGLE_CLIENT_ID=").concat(config.googleClientId, "\nGOOGLE_CLIENT_SECRET=").concat(config.googleClientSecret, "\n\n# Blog Settings\nBLOG_ID=").concat(config.blogId, "\nWORDPRESS_SITE_URL=").concat(config.wordpressSiteUrl, "\nWORDPRESS_USERNAME=").concat(config.wordpressUsername, "\nWORDPRESS_PASSWORD=").concat(config.wordpressPassword, "\n\n# Image API Keys\nPEXELS_API_KEY=").concat(config.pexelsApiKey, "\n\n# App Settings\nMIN_CHARS=").concat(config.minChars, "\nPLATFORM=").concat(config.platform, "\nMASS_CRAWLING_ENABLED=").concat(config.massCrawlingEnabled, "\nMAX_CONCURRENT_REQUESTS=").concat(config.maxConcurrentRequests, "\nMAX_RESULTS_PER_SOURCE=").concat(config.maxResultsPerSource, "\nENABLE_FULL_CONTENT_CRAWLING=").concat(config.enableFullContentCrawling, "\n\n# Performance Settings\nCRAWLING_TIMEOUT=").concat(config.crawlingTimeout, "\nRSS_FEED_TIMEOUT=").concat(config.rssFeedTimeout, "\nNAVER_API_TIMEOUT=").concat(config.naverApiTimeout, "\nCSE_API_TIMEOUT=").concat(config.cseApiTimeout, "\n\n# Cache Settings\nENABLE_CACHING=").concat(config.enableCaching, "\nCACHE_EXPIRY_SECONDS=").concat(config.cacheExpirySeconds, "\nCACHE_MAX_SIZE=").concat(config.cacheMaxSize, "\n\n# Puppeteer Settings\nPUPPETEER_HEADLESS=").concat(config.puppeteerHeadless, "\nPUPPETEER_TIMEOUT=").concat(config.puppeteerTimeout, "\n\n# Logging Settings\nLOG_LEVEL=").concat(config.logLevel, "\nLOG_FILE=").concat(config.logFile, "\nENABLE_PERFORMANCE_MONITORING=").concat(config.enablePerformanceMonitoring, "\nENABLE_DETAILED_LOGGING=").concat(config.enableDetailedLogging, "\n\n# Performance Settings\nPERFORMANCE_MONITORING=").concat(config.performanceMonitoring, "\nMEMORY_LIMIT_MB=").concat(config.memoryLimitMb, "\n");
    };
    /**
     * 설정 가져오기
     */
    UnifiedEnvManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * 특정 키 값 가져오기
     */
    UnifiedEnvManager.prototype.getValue = function (key) {
        var _a;
        return (_a = this.config) === null || _a === void 0 ? void 0 : _a[key];
    };
    /**
     * 설정 초기화
     */
    UnifiedEnvManager.prototype.reset = function () {
        this.config = null;
    };
    return UnifiedEnvManager;
}());
exports.UnifiedEnvManager = UnifiedEnvManager;

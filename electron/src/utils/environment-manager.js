"use strict";
/**
 * 환경변수 로딩 및 네이버 API 연동 확인 시스템
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
exports.EnvironmentManager = void 0;
exports.testNaverApiConnection = testNaverApiConnection;
exports.testMassCrawlingSystem = testMassCrawlingSystem;
exports.diagnoseSystem = diagnoseSystem;
var path = require("path");
var fs = require("fs");
var EnvironmentManager = /** @class */ (function () {
    function EnvironmentManager() {
        // 사용자별 환경변수 경로 설정
        // Electron 앱인 경우 app.getPath('userData') 사용
        var basePath;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            var app = require('electron').app;
            if (app && typeof app.getPath === 'function') {
                basePath = app.getPath('userData');
                console.log('[ENV] Electron 앱 경로 사용:', basePath);
            }
            else {
                throw new Error('app.getPath not available');
            }
        }
        catch (_a) {
            // Electron이 아닌 환경 (CLI 등)
            basePath = process.env['APPDATA'] || process.env['HOME'] || process.cwd();
            console.log('[ENV] 일반 환경 경로 사용:', basePath);
        }
        this.configPath = path.join(basePath, 'config.json');
        console.log('[ENV] Config 파일 경로:', this.configPath);
        this.config = this.loadConfig();
    }
    /**
     * 설정 강제 리로드 (config.json 파일에서 다시 읽기)
     */
    EnvironmentManager.prototype.reloadConfig = function () {
        var _a, _b, _c;
        console.log('[ENV] 설정 강제 리로드 시작...');
        this.config = this.loadConfig();
        console.log('[ENV] 설정 리로드 완료:', {
            hasSearchAdLicense: !!this.config.naverSearchAdAccessLicense,
            hasSearchAdSecret: !!this.config.naverSearchAdSecretKey,
            hasSearchAdCustomerId: !!this.config.naverSearchAdCustomerId,
            licenseLength: ((_a = this.config.naverSearchAdAccessLicense) === null || _a === void 0 ? void 0 : _a.length) || 0,
            secretLength: ((_b = this.config.naverSearchAdSecretKey) === null || _b === void 0 ? void 0 : _b.length) || 0,
            customerIdLength: ((_c = this.config.naverSearchAdCustomerId) === null || _c === void 0 ? void 0 : _c.length) || 0,
            customerIdValue: this.config.naverSearchAdCustomerId || '없음'
        });
    };
    EnvironmentManager.getInstance = function () {
        if (!EnvironmentManager.instance) {
            EnvironmentManager.instance = new EnvironmentManager();
        }
        return EnvironmentManager.instance;
    };
    /**
     * .env 파일 경로 가져오기
     */
    EnvironmentManager.prototype.getEnvPath = function () {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            var app = require('electron').app;
            if (app && typeof app.getPath === 'function') {
                var userDataPath = app.getPath('userData');
                return path.join(userDataPath, '.env');
            }
        }
        catch ( /* no electron */_a) { /* no electron */ }
        var base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
        return path.join(base, 'blogger-gpt-cli', '.env');
    };
    /**
     * .env 파일 파싱
     */
    EnvironmentManager.prototype.parseDotEnv = function (str) {
        var out = {};
        if (!str)
            return out;
        // JSON 형식인지 확인
        if (str.trim().startsWith('{')) {
            try {
                var jsonData = JSON.parse(str);
                // JSON에서 apiKeys 섹션 추출
                if (jsonData.apiKeys) {
                    var apiKeys = jsonData.apiKeys;
                    // 환경 변수 이름으로 매핑
                    if (apiKeys['gemini'])
                        out['GEMINI_API_KEY'] = apiKeys['gemini'];
                    if (apiKeys['naverClientId'])
                        out['NAVER_CLIENT_ID'] = apiKeys['naverClientId'];
                    if (apiKeys['naverClientSecret'])
                        out['NAVER_CLIENT_SECRET'] = apiKeys['naverClientSecret'];
                    if (apiKeys['googleClientId'])
                        out['GOOGLE_CLIENT_ID'] = apiKeys['googleClientId'];
                    if (apiKeys['googleClientSecret'])
                        out['GOOGLE_CLIENT_SECRET'] = apiKeys['googleClientSecret'];
                    if (apiKeys['youtubeApiKey'])
                        out['YOUTUBE_API_KEY'] = apiKeys['youtubeApiKey'];
                }
                return out;
            }
            catch (e) {
                console.warn('[ENV] JSON 파싱 실패, 일반 형식으로 시도:', e);
            }
        }
        // 일반 KEY=VALUE 형식 파싱
        for (var _i = 0, _a = str.split(/\r?\n/); _i < _a.length; _i++) {
            var raw = _a[_i];
            var line = (raw || '').trim();
            if (!line || line.startsWith('#'))
                continue;
            var m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!m || !m[1])
                continue;
            var k = m[1];
            var v = (m[2] || '').trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
                v = v.slice(1, -1);
            v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
            out[k] = v;
        }
        return out;
    };
    /**
     * 설정 로드 (개선된 버전 - .env 파일 지원 추가)
     */
    EnvironmentManager.prototype.loadConfig = function () {
        var _a, _b, _c;
        try {
            // 1. 먼저 .env 파일에서 로드 (기존에 저장된 API 키)
            var envFileConfig = {};
            // 프로젝트 루트의 .env 파일도 확인
            var projectRootEnv = path.join(process.cwd(), '.env');
            if (fs.existsSync(projectRootEnv)) {
                try {
                    var raw = fs.readFileSync(projectRootEnv, 'utf-8');
                    var parsed = this.parseDotEnv(raw);
                    envFileConfig = __assign(__assign({}, envFileConfig), parsed);
                    console.log('[ENV] 프로젝트 루트 .env 파일에서 설정 로드:', projectRootEnv);
                }
                catch (error) {
                    console.warn('[ENV] 프로젝트 루트 .env 파일 읽기 실패:', error);
                }
            }
            // 사용자 데이터 디렉토리의 .env 파일 확인
            var envPath = this.getEnvPath();
            if (fs.existsSync(envPath)) {
                try {
                    var raw = fs.readFileSync(envPath, 'utf-8');
                    var parsed = this.parseDotEnv(raw);
                    envFileConfig = __assign(__assign({}, envFileConfig), parsed); // 병합 (사용자 데이터 디렉토리가 우선)
                    console.log('[ENV] 사용자 데이터 디렉토리 .env 파일에서 설정 로드:', envPath);
                }
                catch (envFileError) {
                    console.warn('[ENV] 사용자 데이터 디렉토리 .env 파일 읽기 실패:', envFileError);
                }
            }
            // 2. 환경변수에서 로드 (process.env 직접 확인)
            // Electron 앱에서 환경변수가 제대로 로드되지 않을 수 있으므로 더 자세한 로그
            var naverClientIdFromEnv = process.env['NAVER_CLIENT_ID'];
            var naverClientSecretFromEnv = process.env['NAVER_CLIENT_SECRET'];
            if (naverClientIdFromEnv || naverClientSecretFromEnv) {
                console.log('[ENV] 환경변수에서 네이버 API 키 발견:', {
                    hasClientId: !!naverClientIdFromEnv,
                    hasClientSecret: !!naverClientSecretFromEnv,
                    clientIdLength: (naverClientIdFromEnv === null || naverClientIdFromEnv === void 0 ? void 0 : naverClientIdFromEnv.length) || 0,
                    clientSecretLength: (naverClientSecretFromEnv === null || naverClientSecretFromEnv === void 0 ? void 0 : naverClientSecretFromEnv.length) || 0
                });
            }
            var envConfig = {
                openaiApiKey: envFileConfig['OPENAI_API_KEY'] || process.env['OPENAI_API_KEY'] || '',
                geminiApiKey: envFileConfig['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] || '',
                naverClientId: envFileConfig['NAVER_CLIENT_ID'] || process.env['NAVER_CLIENT_ID'] || '',
                naverClientSecret: envFileConfig['NAVER_CLIENT_SECRET'] || process.env['NAVER_CLIENT_SECRET'] || '',
                naverSearchAdAccessLicense: envFileConfig['NAVER_SEARCH_AD_ACCESS_LICENSE'] || envFileConfig['naverSearchAdAccessLicense'] || envFileConfig['naver_search_ad_access_license'] ||
                    process.env['NAVER_SEARCH_AD_ACCESS_LICENSE'] || process.env['naverSearchAdAccessLicense'] || process.env['naver_search_ad_access_license'] || '',
                naverSearchAdSecretKey: envFileConfig['NAVER_SEARCH_AD_SECRET_KEY'] || envFileConfig['naverSearchAdSecretKey'] || envFileConfig['naver_search_ad_secret_key'] ||
                    process.env['NAVER_SEARCH_AD_SECRET_KEY'] || process.env['naverSearchAdSecretKey'] || process.env['naver_search_ad_secret_key'] || '',
                naverSearchAdCustomerId: envFileConfig['NAVER_SEARCH_AD_CUSTOMER_ID'] || envFileConfig['naverSearchAdCustomerId'] || envFileConfig['naver_search_ad_customer_id'] ||
                    process.env['NAVER_SEARCH_AD_CUSTOMER_ID'] || process.env['naverSearchAdCustomerId'] || process.env['naver_search_ad_customer_id'] || '',
                googleApiKey: envFileConfig['GOOGLE_API_KEY'] || process.env['GOOGLE_API_KEY'] || '',
                googleCseId: envFileConfig['GOOGLE_CSE_ID'] || process.env['GOOGLE_CSE_ID'] || '',
                youtubeApiKey: envFileConfig['YOUTUBE_API_KEY'] || envFileConfig['youtubeApiKey'] || envFileConfig['youtube_api_key'] ||
                    process.env['YOUTUBE_API_KEY'] || process.env['youtubeApiKey'] || process.env['youtube_api_key'] || '',
                massCrawlingEnabled: process.env['MASS_CRAWLING_ENABLED'] !== 'false',
                maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] || '30'),
                maxResultsPerSource: parseInt(process.env['MAX_RESULTS_PER_SOURCE'] || '1000'),
                enableFullContentCrawling: process.env['ENABLE_FULL_CONTENT_CRAWLING'] !== 'false'
            };
            // 3. config.json 파일에서 설정 로드 시도 (가장 우선순위 높음)
            // Electron 앱인 경우 app.getPath('userData')로 경로 재확인
            var actualConfigPath = this.configPath;
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                var app = require('electron').app;
                if (app && typeof app.getPath === 'function') {
                    var electronConfigPath = path.join(app.getPath('userData'), 'config.json');
                    console.log('[ENV] Electron 경로 확인:', electronConfigPath);
                    if (fs.existsSync(electronConfigPath)) {
                        actualConfigPath = electronConfigPath;
                        console.log('[ENV] ✅ Electron 경로의 config.json 파일 발견:', actualConfigPath);
                    }
                }
            }
            catch (_d) {
                // Electron이 아니거나 app이 아직 준비되지 않음
            }
            if (fs.existsSync(actualConfigPath)) {
                try {
                    var fileConfigRaw = fs.readFileSync(actualConfigPath, 'utf8');
                    // BOM 제거 (UTF-8 BOM이 있는 경우)
                    if (fileConfigRaw.charCodeAt(0) === 0xFEFF) {
                        fileConfigRaw = fileConfigRaw.slice(1);
                        console.log('[ENV] BOM 제거됨');
                    }
                    // 앞뒤 공백 및 줄바꿈 제거
                    fileConfigRaw = fileConfigRaw.trim();
                    // 빈 파일 체크
                    if (!fileConfigRaw || fileConfigRaw.length === 0) {
                        console.warn('[ENV] ⚠️ config.json 파일이 비어있습니다');
                        throw new Error('Empty config file');
                    }
                    var fileConfig = JSON.parse(fileConfigRaw);
                    console.log('[ENV] ✅ config.json 파일 내용 로드 성공:', {
                        filePath: actualConfigPath,
                        fileSize: fileConfigRaw.length,
                        hasSearchAdLicense: !!fileConfig.naverSearchAdAccessLicense,
                        hasSearchAdSecret: !!fileConfig.naverSearchAdSecretKey,
                        hasSearchAdCustomerId: !!fileConfig.naverSearchAdCustomerId,
                        licenseLength: ((_a = fileConfig.naverSearchAdAccessLicense) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        secretLength: ((_b = fileConfig.naverSearchAdSecretKey) === null || _b === void 0 ? void 0 : _b.length) || 0,
                        customerIdLength: ((_c = fileConfig.naverSearchAdCustomerId) === null || _c === void 0 ? void 0 : _c.length) || 0,
                        customerIdValue: fileConfig.naverSearchAdCustomerId || '없음',
                        allKeys: Object.keys(fileConfig)
                    });
                    // 파일 설정이 .env와 환경변수보다 우선 (가장 최신 설정)
                    var mergedConfig = __assign(__assign({}, envConfig), fileConfig);
                    console.log('[ENV] ✅ config.json에서 설정 로드 완료:', actualConfigPath);
                    console.log('[ENV] ✅ 최종 설정 상태:', {
                        naverClientId: mergedConfig.naverClientId ? "\u2705 (".concat(mergedConfig.naverClientId.length, "\uC790)") : '❌',
                        naverClientSecret: mergedConfig.naverClientSecret ? "\u2705 (".concat(mergedConfig.naverClientSecret.length, "\uC790)") : '❌',
                        youtubeApiKey: mergedConfig.youtubeApiKey ? "\u2705 (".concat(mergedConfig.youtubeApiKey.length, "\uC790)") : '❌',
                        naverSearchAdAccessLicense: mergedConfig.naverSearchAdAccessLicense ? "\u2705 (".concat(mergedConfig.naverSearchAdAccessLicense.length, "\uC790)") : '❌',
                        naverSearchAdSecretKey: mergedConfig.naverSearchAdSecretKey ? "\u2705 (".concat(mergedConfig.naverSearchAdSecretKey.length, "\uC790)") : '❌',
                        naverSearchAdCustomerId: mergedConfig.naverSearchAdCustomerId ? "\u2705 (".concat(mergedConfig.naverSearchAdCustomerId.length, "\uC790) [").concat(mergedConfig.naverSearchAdCustomerId, "]") : '❌',
                        source: 'config.json'
                    });
                    return mergedConfig;
                }
                catch (fileError) {
                    console.error('[ENV] ❌ config.json 읽기 실패:', fileError);
                    console.error('[ENV] 에러 상세:', fileError.message);
                    console.warn('[ENV] .env와 환경변수만 사용');
                }
            }
            else {
                // config.json 파일이 없어도 정상 (.env 파일 사용)
                // 대체 경로들도 확인
                var alternatePaths = [
                    path.join(process.env['APPDATA'] || '', 'blogger-gpt-cli', 'config.json'),
                    path.join(process.env['LOCALAPPDATA'] || '', 'blogger-gpt-cli', 'config.json')
                ];
                var foundInAlternate = false;
                for (var _i = 0, alternatePaths_1 = alternatePaths; _i < alternatePaths_1.length; _i++) {
                    var altPath = alternatePaths_1[_i];
                    if (fs.existsSync(altPath)) {
                        console.log('[ENV] ✅ 대체 경로에서 config.json 발견:', altPath);
                        foundInAlternate = true;
                        try {
                            var fileConfigRaw = fs.readFileSync(altPath, 'utf8');
                            // BOM 제거 (UTF-8 BOM이 있는 경우)
                            if (fileConfigRaw.charCodeAt(0) === 0xFEFF) {
                                fileConfigRaw = fileConfigRaw.slice(1);
                                console.log('[ENV] 대체 경로 BOM 제거됨');
                            }
                            // 앞뒤 공백 및 줄바꿈 제거
                            fileConfigRaw = fileConfigRaw.trim();
                            // 빈 파일 체크
                            if (!fileConfigRaw || fileConfigRaw.length === 0) {
                                console.warn('[ENV] ⚠️ 대체 경로 config.json 파일이 비어있습니다');
                                continue;
                            }
                            var fileConfig = JSON.parse(fileConfigRaw);
                            var mergedConfig = __assign(__assign({}, envConfig), fileConfig);
                            console.log('[ENV] ✅ 대체 경로에서 설정 로드 완료:', altPath);
                            console.log('[ENV] ✅ 최종 설정 상태:', {
                                naverClientId: mergedConfig.naverClientId ? "\u2705 (".concat(mergedConfig.naverClientId.length, "\uC790)") : '❌',
                                naverClientSecret: mergedConfig.naverClientSecret ? "\u2705 (".concat(mergedConfig.naverClientSecret.length, "\uC790)") : '❌',
                                youtubeApiKey: mergedConfig.youtubeApiKey ? "\u2705 (".concat(mergedConfig.youtubeApiKey.length, "\uC790)") : '❌',
                                naverSearchAdAccessLicense: mergedConfig.naverSearchAdAccessLicense ? "\u2705 (".concat(mergedConfig.naverSearchAdAccessLicense.length, "\uC790)") : '❌',
                                naverSearchAdSecretKey: mergedConfig.naverSearchAdSecretKey ? "\u2705 (".concat(mergedConfig.naverSearchAdSecretKey.length, "\uC790)") : '❌',
                                naverSearchAdCustomerId: mergedConfig.naverSearchAdCustomerId ? "\u2705 (".concat(mergedConfig.naverSearchAdCustomerId.length, "\uC790) [").concat(mergedConfig.naverSearchAdCustomerId, "]") : '❌',
                                source: '대체 경로 config.json'
                            });
                            return mergedConfig;
                        }
                        catch (altError) {
                            console.error('[ENV] 대체 경로 파일 읽기 실패:', altError);
                            continue;
                        }
                    }
                }
                // 대체 경로에서도 찾지 못했으면 .env 파일 사용 (정상 동작, 경고 불필요)
                // config.json이 없어도 .env 파일로 정상 동작하므로 경고 제거
            }
            // .env 파일과 환경변수만 사용
            console.log('[ENV] .env 파일과 환경변수에서 설정 로드 완료');
            console.log('[ENV] 최종 설정 상태:', {
                naverClientId: envConfig.naverClientId ? "\u2705 (".concat(envConfig.naverClientId.length, "\uC790)") : '❌',
                naverClientSecret: envConfig.naverClientSecret ? "\u2705 (".concat(envConfig.naverClientSecret.length, "\uC790)") : '❌',
                youtubeApiKey: envConfig.youtubeApiKey ? "\u2705 (".concat(envConfig.youtubeApiKey.length, "\uC790)") : '❌',
                naverSearchAdAccessLicense: envConfig.naverSearchAdAccessLicense ? "\u2705 (".concat(envConfig.naverSearchAdAccessLicense.length, "\uC790)") : '❌',
                naverSearchAdSecretKey: envConfig.naverSearchAdSecretKey ? "\u2705 (".concat(envConfig.naverSearchAdSecretKey.length, "\uC790)") : '❌',
                naverSearchAdCustomerId: envConfig.naverSearchAdCustomerId ? "\u2705 (".concat(envConfig.naverSearchAdCustomerId.length, "\uC790) [").concat(envConfig.naverSearchAdCustomerId, "]") : '❌',
                source: '.env + 환경변수'
            });
            return envConfig;
        }
        catch (error) {
            console.error('[ENV] 설정 로드 실패:', error);
            return {
                massCrawlingEnabled: true,
                maxConcurrentRequests: 30,
                maxResultsPerSource: 1000,
                enableFullContentCrawling: true
            };
        }
    };
    /**
     * 설정 저장
     */
    EnvironmentManager.prototype.saveConfig = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var actualConfigPath, app, dir, configJson, savedContent, savedConfig, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        this.config = __assign(__assign({}, this.config), config);
                        actualConfigPath = this.configPath;
                        try {
                            app = require('electron').app;
                            if (app && typeof app.getPath === 'function') {
                                actualConfigPath = path.join(app.getPath('userData'), 'config.json');
                                console.log('[ENV] ✅ Electron 경로로 저장:', actualConfigPath);
                            }
                        }
                        catch (_b) {
                            // Electron이 아니거나 app이 아직 준비되지 않음
                            console.log('[ENV] 일반 경로로 저장:', actualConfigPath);
                        }
                        dir = path.dirname(actualConfigPath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                            console.log('[ENV] ✅ 디렉토리 생성:', dir);
                        }
                        configJson = JSON.stringify(this.config, null, 2);
                        fs.writeFileSync(actualConfigPath, configJson, 'utf8');
                        console.log('[ENV] ✅ 설정 저장 완료:', actualConfigPath);
                        console.log('[ENV] 저장할 설정:', {
                            naverSearchAdAccessLicense: this.config.naverSearchAdAccessLicense ? "\u2705 (".concat(this.config.naverSearchAdAccessLicense.length, "\uC790)") : '❌',
                            naverSearchAdSecretKey: this.config.naverSearchAdSecretKey ? "\u2705 (".concat(this.config.naverSearchAdSecretKey.length, "\uC790)") : '❌',
                            naverSearchAdCustomerId: this.config.naverSearchAdCustomerId ? "\u2705 (".concat(this.config.naverSearchAdCustomerId.length, "\uC790) [").concat(this.config.naverSearchAdCustomerId, "]") : '❌',
                            naverClientId: this.config.naverClientId ? "\u2705 (".concat(this.config.naverClientId.length, "\uC790)") : '❌',
                            naverClientSecret: this.config.naverClientSecret ? "\u2705 (".concat(this.config.naverClientSecret.length, "\uC790)") : '❌',
                            youtubeApiKey: this.config.youtubeApiKey ? "\u2705 (".concat(this.config.youtubeApiKey.length, "\uC790)") : '❌'
                        });
                        if (!fs.existsSync(actualConfigPath)) return [3 /*break*/, 2];
                        // 약간의 지연을 두고 파일 읽기 (파일 시스템 동기화 보장)
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 1:
                        // 약간의 지연을 두고 파일 읽기 (파일 시스템 동기화 보장)
                        _a.sent();
                        savedContent = fs.readFileSync(actualConfigPath, 'utf8');
                        // BOM 제거
                        if (savedContent.charCodeAt(0) === 0xFEFF) {
                            savedContent = savedContent.slice(1);
                        }
                        savedContent = savedContent.trim();
                        savedConfig = JSON.parse(savedContent);
                        console.log('[ENV] ✅ 저장된 설정 검증 완료:', {
                            naverSearchAdAccessLicense: savedConfig.naverSearchAdAccessLicense ? "\u2705 (".concat(savedConfig.naverSearchAdAccessLicense.length, "\uC790)") : '❌',
                            naverSearchAdSecretKey: savedConfig.naverSearchAdSecretKey ? "\u2705 (".concat(savedConfig.naverSearchAdSecretKey.length, "\uC790)") : '❌',
                            naverSearchAdCustomerId: savedConfig.naverSearchAdCustomerId ? "\u2705 (".concat(savedConfig.naverSearchAdCustomerId.length, "\uC790) [").concat(savedConfig.naverSearchAdCustomerId, "]") : '❌',
                            naverClientId: savedConfig.naverClientId ? "\u2705 (".concat(savedConfig.naverClientId.length, "\uC790)") : '❌',
                            naverClientSecret: savedConfig.naverClientSecret ? "\u2705 (".concat(savedConfig.naverClientSecret.length, "\uC790)") : '❌',
                            youtubeApiKey: savedConfig.youtubeApiKey ? "\u2705 (".concat(savedConfig.youtubeApiKey.length, "\uC790)") : '❌',
                            fileSize: savedContent.length,
                            allKeys: Object.keys(savedConfig).filter(function (k) { return k.includes('naver') || k.includes('youtube'); })
                        });
                        // 메모리의 config도 업데이트 (저장된 값과 동기화)
                        this.config = __assign(__assign({}, this.config), savedConfig);
                        // configPath 업데이트 (다음 로드 시 올바른 경로 사용)
                        this.configPath = actualConfigPath;
                        return [3 /*break*/, 3];
                    case 2:
                        console.error('[ENV] ❌ 저장된 파일이 존재하지 않습니다:', actualConfigPath);
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error('[ENV] 설정 저장 실패:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 설정 가져오기
     */
    EnvironmentManager.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * 네이버 API 키 확인
     */
    EnvironmentManager.prototype.isNaverApiConfigured = function () {
        return !!(this.config.naverClientId && this.config.naverClientSecret);
    };
    /**
     * Google API 키 확인
     */
    EnvironmentManager.prototype.isGoogleApiConfigured = function () {
        return !!(this.config.googleApiKey && this.config.googleCseId);
    };
    /**
     * AI API 키 확인
     */
    EnvironmentManager.prototype.isAiApiConfigured = function () {
        return !!(this.config.openaiApiKey || this.config.geminiApiKey);
    };
    /**
     * 설정 상태 출력
     */
    EnvironmentManager.prototype.printConfigStatus = function () {
        console.log('\n📋 환경변수 설정 상태:');
        console.log('='.repeat(50));
        console.log("\uD83D\uDD11 OpenAI API: ".concat(this.config.openaiApiKey ? '✅ 설정됨' : '❌ 미설정'));
        console.log("\uD83D\uDD11 Gemini API: ".concat(this.config.geminiApiKey ? '✅ 설정됨' : '❌ 미설정'));
        console.log("\uD83D\uDD11 \uB124\uC774\uBC84 API: ".concat(this.isNaverApiConfigured() ? '✅ 설정됨' : '❌ 미설정'));
        console.log("\uD83D\uDD11 Google CSE: ".concat(this.isGoogleApiConfigured() ? '✅ 설정됨' : '❌ 미설정'));
        console.log("\uD83D\uDE80 \uB300\uB7C9 \uD06C\uB864\uB9C1: ".concat(this.config.massCrawlingEnabled ? '✅ 활성화' : '❌ 비활성화'));
        console.log("\u26A1 \uCD5C\uB300 \uB3D9\uC2DC \uC694\uCCAD: ".concat(this.config.maxConcurrentRequests, "\uAC1C"));
        console.log("\uD83D\uDCCA \uC18C\uC2A4\uBCC4 \uCD5C\uB300 \uACB0\uACFC: ".concat(this.config.maxResultsPerSource, "\uAC1C"));
        console.log("\uD83D\uDCC4 \uC804\uCCB4 \uBCF8\uBB38 \uD06C\uB864\uB9C1: ".concat(this.config.enableFullContentCrawling ? '✅ 활성화' : '❌ 비활성화'));
        console.log('='.repeat(50));
    };
    return EnvironmentManager;
}());
exports.EnvironmentManager = EnvironmentManager;
/**
 * 네이버 API 연동 테스트
 */
function testNaverApiConnection(clientId, clientSecret) {
    return __awaiter(this, void 0, void 0, function () {
        var env, naverClientId, naverClientSecret, testQuery, encodedQuery, apiUrl, response, data, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    env = EnvironmentManager.getInstance();
                    naverClientId = clientId || env.getConfig().naverClientId;
                    naverClientSecret = clientSecret || env.getConfig().naverClientSecret;
                    if (!naverClientId || !naverClientSecret) {
                        return [2 /*return*/, {
                                success: false,
                                message: '네이버 API 키가 설정되지 않았습니다.'
                            }];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    console.log('[NAVER API] 연결 테스트 시작...');
                    testQuery = '블로그 마케팅';
                    encodedQuery = encodeURIComponent(testQuery);
                    apiUrl = "https://openapi.naver.com/v1/search/blog.json?query=".concat(encodedQuery, "&display=10&sort=sim");
                    return [4 /*yield*/, fetch(apiUrl, {
                            headers: {
                                'X-Naver-Client-Id': naverClientId,
                                'X-Naver-Client-Secret': naverClientSecret
                            }
                        })];
                case 2:
                    response = _b.sent();
                    if (!response.ok) {
                        return [2 /*return*/, {
                                success: false,
                                message: "\uB124\uC774\uBC84 API \uD638\uCD9C \uC2E4\uD328: ".concat(response.status, " ").concat(response.statusText)
                            }];
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _b.sent();
                    if (data.items && data.items.length > 0) {
                        return [2 /*return*/, {
                                success: true,
                                message: "\uB124\uC774\uBC84 API \uC5F0\uACB0 \uC131\uACF5! ".concat(data.items.length, "\uAC1C \uACB0\uACFC \uC218\uC2E0"),
                                data: {
                                    totalResults: data.total,
                                    itemsCount: data.items.length,
                                    sampleTitle: (_a = data.items[0]) === null || _a === void 0 ? void 0 : _a.title
                                }
                            }];
                    }
                    else {
                        return [2 /*return*/, {
                                success: false,
                                message: '네이버 API는 연결되었지만 결과가 없습니다.'
                            }];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _b.sent();
                    return [2 /*return*/, {
                            success: false,
                            message: "\uB124\uC774\uBC84 API \uC5F0\uACB0 \uC2E4\uD328: ".concat(error_2.message)
                        }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * 대량 크롤링 시스템 테스트
 */
function testMassCrawlingSystem() {
    return __awaiter(this, void 0, void 0, function () {
        var env, config, naverTest, MassCrawlingSystem, crawler, testResult, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log('[MASS CRAWLING] 시스템 테스트 시작...');
                    env = EnvironmentManager.getInstance();
                    config = env.getConfig();
                    if (!config.massCrawlingEnabled) {
                        return [2 /*return*/, {
                                success: false,
                                message: '대량 크롤링이 비활성화되어 있습니다.'
                            }];
                    }
                    return [4 /*yield*/, testNaverApiConnection()];
                case 1:
                    naverTest = _a.sent();
                    if (!naverTest.success) {
                        return [2 /*return*/, {
                                success: false,
                                message: "\uB124\uC774\uBC84 API \uD14C\uC2A4\uD2B8 \uC2E4\uD328: ".concat(naverTest.message)
                            }];
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../core/mass-crawler'); })];
                case 2:
                    MassCrawlingSystem = (_a.sent()).MassCrawlingSystem;
                    crawler = new MassCrawlingSystem(config.naverClientId, config.naverClientSecret, config.googleApiKey, config.googleCseId);
                    return [4 /*yield*/, crawler.crawlAll('블로그 마케팅', {
                            maxResults: 100,
                            enableFullContent: false,
                            maxConcurrent: 10
                        })];
                case 3:
                    testResult = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            message: "\uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC2A4\uD15C \uD14C\uC2A4\uD2B8 \uC131\uACF5! ".concat(testResult.stats.totalItems, "\uAC1C \uB370\uC774\uD130 \uC218\uC9D1"),
                            results: testResult.stats
                        }];
                case 4:
                    error_3 = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            message: "\uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC2A4\uD15C \uD14C\uC2A4\uD2B8 \uC2E4\uD328: ".concat(error_3.message)
                        }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * 전체 시스템 진단
 */
function diagnoseSystem() {
    return __awaiter(this, void 0, void 0, function () {
        var env, naverTest, crawlingTest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n🔍 시스템 진단 시작...');
                    console.log('='.repeat(60));
                    env = EnvironmentManager.getInstance();
                    env.printConfigStatus();
                    // 네이버 API 테스트
                    console.log('\n🌐 네이버 API 연결 테스트...');
                    return [4 /*yield*/, testNaverApiConnection()];
                case 1:
                    naverTest = _a.sent();
                    console.log("\uACB0\uACFC: ".concat(naverTest.success ? '✅' : '❌', " ").concat(naverTest.message));
                    if (naverTest.data) {
                        console.log("   - \uCD1D \uACB0\uACFC: ".concat(naverTest.data.totalResults, "\uAC1C"));
                        console.log("   - \uC218\uC2E0 \uD56D\uBAA9: ".concat(naverTest.data.itemsCount, "\uAC1C"));
                        console.log("   - \uC0D8\uD50C \uC81C\uBAA9: ".concat(naverTest.data.sampleTitle));
                    }
                    if (!env.isNaverApiConfigured()) return [3 /*break*/, 3];
                    console.log('\n🚀 대량 크롤링 시스템 테스트...');
                    return [4 /*yield*/, testMassCrawlingSystem()];
                case 2:
                    crawlingTest = _a.sent();
                    console.log("\uACB0\uACFC: ".concat(crawlingTest.success ? '✅' : '❌', " ").concat(crawlingTest.message));
                    if (crawlingTest.results) {
                        console.log("   - \uB124\uC774\uBC84: ".concat(crawlingTest.results.naverCount, "\uAC1C"));
                        console.log("   - RSS: ".concat(crawlingTest.results.rssCount, "\uAC1C"));
                        console.log("   - CSE: ".concat(crawlingTest.results.cseCount, "\uAC1C"));
                        console.log("   - \uCC98\uB9AC \uC2DC\uAC04: ".concat(crawlingTest.results.processingTimeMs, "ms"));
                    }
                    _a.label = 3;
                case 3:
                    console.log('\n' + '='.repeat(60));
                    console.log('🎯 진단 완료!');
                    return [2 /*return*/];
            }
        });
    });
}

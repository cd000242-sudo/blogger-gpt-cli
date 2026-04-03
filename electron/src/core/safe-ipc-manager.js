"use strict";
/**
 * 안전한 IPC 통신 관리자
 * UnhandledPromiseRejectionWarning 및 객체 복제 오류 해결
 */
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeIpcManager = void 0;
var electron_1 = require("electron");
var unified_env_manager_1 = require("./unified-env-manager");
var SafeIpcManager = /** @class */ (function () {
    function SafeIpcManager() {
        this.envManager = unified_env_manager_1.UnifiedEnvManager.getInstance();
    }
    SafeIpcManager.getInstance = function () {
        if (!SafeIpcManager.instance) {
            SafeIpcManager.instance = new SafeIpcManager();
        }
        return SafeIpcManager.instance;
    };
    /**
     * 안전한 IPC 핸들러 등록
     */
    SafeIpcManager.prototype.setupHandlers = function () {
        var _this = this;
        console.log('[IPC] 안전한 IPC 핸들러 설정 시작');
        // 환경변수 로드 핸들러
        electron_1.ipcMain.handle('load-environment-settings', this.safeHandler(function () { return __awaiter(_this, void 0, void 0, function () {
            var config, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.envManager.loadConfig()];
                    case 1:
                        config = _a.sent();
                        return [2 /*return*/, { ok: true, data: config }];
                    case 2:
                        error_1 = _a.sent();
                        console.error('[IPC] 환경변수 로드 실패:', error_1);
                        return [2 /*return*/, { ok: false, error: error_1 instanceof Error ? error_1.message : String(error_1) }];
                    case 3: return [2 /*return*/];
                }
            });
        }); }));
        // 환경변수 저장 핸들러
        electron_1.ipcMain.handle('save-environment-settings', this.safeHandler(function (_event, settings) { return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.envManager.saveConfig(settings)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { ok: true }];
                    case 2:
                        error_2 = _a.sent();
                        console.error('[IPC] 환경변수 저장 실패:', error_2);
                        return [2 /*return*/, { ok: false, error: error_2 instanceof Error ? error_2.message : String(error_2) }];
                    case 3: return [2 /*return*/];
                }
            });
        }); }));
        // 네이버 세션 확인 핸들러
        electron_1.ipcMain.handle('check-naver-session', this.safeHandler(function () { return __awaiter(_this, void 0, void 0, function () {
            var config, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.envManager.loadConfig()];
                    case 1:
                        config = _a.sent();
                        if (!config.naverClientId || !config.naverClientSecret) {
                            return [2 /*return*/, {
                                    hasSession: false,
                                    isValid: false,
                                    error: '네이버 API 키가 설정되지 않았습니다'
                                }];
                        }
                        // 실제 세션 확인 로직은 여기에 구현
                        // 현재는 API 키 존재 여부만 확인
                        return [2 /*return*/, {
                                hasSession: true,
                                isValid: true,
                                username: '사용자'
                            }];
                    case 2:
                        error_3 = _a.sent();
                        console.error('[IPC] 네이버 세션 확인 실패:', error_3);
                        return [2 /*return*/, {
                                hasSession: false,
                                isValid: false,
                                error: error_3 instanceof Error ? error_3.message : String(error_3)
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        }); }));
        // 지식iN 크롤링 핸들러
        electron_1.ipcMain.handle('crawl-kin', this.safeHandler(function (_event, options) { return __awaiter(_this, void 0, void 0, function () {
            var mockData;
            return __generator(this, function (_a) {
                try {
                    mockData = this.generateMockKinData(options);
                    return [2 /*return*/, mockData];
                }
                catch (error) {
                    console.error('[IPC] 지식iN 크롤링 실패:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        }); }));
        // Excel 내보내기 핸들러
        electron_1.ipcMain.handle('export-kin-excel', this.safeHandler(function (_event, _data) { return __awaiter(_this, void 0, void 0, function () {
            var filename;
            return __generator(this, function (_a) {
                try {
                    filename = "kin_analysis_".concat(Date.now(), ".xlsx");
                    return [2 /*return*/, filename];
                }
                catch (error) {
                    console.error('[IPC] Excel 내보내기 실패:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        }); }));
        console.log('[IPC] 안전한 IPC 핸들러 설정 완료');
    };
    /**
     * 안전한 핸들러 래퍼
     * Promise rejection 및 객체 복제 오류 방지
     */
    SafeIpcManager.prototype.safeHandler = function (handler) {
        var _this = this;
        return function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return __awaiter(_this, void 0, void 0, function () {
                var cleanArgs, result, cleanResult, error_4, safeError;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            cleanArgs = this.sanitizeArgs(args);
                            return [4 /*yield*/, handler.apply(void 0, __spreadArray([event], cleanArgs, false))];
                        case 1:
                            result = _a.sent();
                            cleanResult = this.sanitizeResult(result);
                            return [2 /*return*/, cleanResult];
                        case 2:
                            error_4 = _a.sent();
                            console.error('[IPC] 핸들러 실행 오류:', error_4);
                            safeError = this.sanitizeError(error_4);
                            throw safeError;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
    };
    /**
     * 입력 인수 정리 및 검증
     */
    SafeIpcManager.prototype.sanitizeArgs = function (args) {
        var _this = this;
        return args.map(function (arg) {
            if (typeof arg === 'string') {
                return _this.sanitizeString(arg);
            }
            else if (Array.isArray(arg)) {
                return arg.map(function (item) { return _this.sanitizeArgs([item])[0]; });
            }
            else if (arg && typeof arg === 'object') {
                return _this.sanitizeObject(arg);
            }
            return arg;
        });
    };
    /**
     * 결과 데이터 정리 및 검증
     */
    SafeIpcManager.prototype.sanitizeResult = function (result) {
        var _this = this;
        if (typeof result === 'string') {
            return this.sanitizeString(result);
        }
        else if (Array.isArray(result)) {
            return result.map(function (item) { return _this.sanitizeResult(item); });
        }
        else if (result && typeof result === 'object') {
            return this.sanitizeObject(result);
        }
        return result;
    };
    /**
     * 문자열 정리
     */
    SafeIpcManager.prototype.sanitizeString = function (str) {
        return str
            .replace(/[\uD800-\uDFFF]/g, '') // 유효하지 않은 유니코드 서로게이트 쌍 제거
            .replace(/\0/g, '') // null 바이트 제거
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 제어 문자 제거
            .trim();
    };
    /**
     * 객체 정리 및 검증
     */
    SafeIpcManager.prototype.sanitizeObject = function (obj) {
        var sanitized = {};
        for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (typeof key === 'string' && key.length > 0) {
                var cleanKey = this.sanitizeString(key);
                if (cleanKey) {
                    sanitized[cleanKey] = this.sanitizeResult(value);
                }
            }
        }
        return sanitized;
    };
    /**
     * 에러 객체 안전하게 변환
     */
    SafeIpcManager.prototype.sanitizeError = function (error) {
        if (error instanceof Error) {
            return new Error(this.sanitizeString(error.message));
        }
        else if (typeof error === 'string') {
            return new Error(this.sanitizeString(error));
        }
        else {
            return new Error('알 수 없는 오류가 발생했습니다');
        }
    };
    /**
     * 지식iN 시뮬레이션 데이터 생성
     */
    SafeIpcManager.prototype.generateMockKinData = function (options) {
        var count = Math.min(options.maxResults || 10, 50);
        var categories = ['컴퓨터통신', '경제', '생활', '건강', '사회', '문화', '스포츠', '여행'];
        return Array.from({ length: count }, function (_, index) { return ({
            id: "kin_".concat(Date.now(), "_").concat(index),
            title: "\uC0D8\uD50C \uC9C8\uBB38 ".concat(index + 1, ": ").concat(options.keyword || '일반적인', " \uAD00\uB828 \uC9C8\uBB38\uC785\uB2C8\uB2E4"),
            url: "https://kin.naver.com/qna/detail.nhn?d1Id=1&dirId=1&docId=".concat(Date.now() + index),
            views: Math.floor(Math.random() * 50000) + 1000,
            answers: Math.floor(Math.random() * 15) + 1,
            acceptedAnswer: Math.random() > 0.3,
            topAnswerLikes: Math.floor(Math.random() * 100) + 1,
            category: categories[Math.floor(Math.random() * categories.length)],
            timestamp: new Date().toISOString()
        }); });
    };
    /**
     * 핸들러 정리
     */
    SafeIpcManager.prototype.cleanup = function () {
        console.log('[IPC] IPC 핸들러 정리');
        // 필요한 경우 핸들러 제거 로직 추가
    };
    return SafeIpcManager;
}());
exports.SafeIpcManager = SafeIpcManager;

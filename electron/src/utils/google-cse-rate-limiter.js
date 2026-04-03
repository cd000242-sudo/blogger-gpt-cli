"use strict";
/**
 * Google CSE Rate Limiter 및 Cache 시스템
 * 429 오류 방지를 위한 요청 큐 및 캐싱 시스템
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCSECache = exports.GoogleCSERateLimiter = void 0;
exports.safeCSERequest = safeCSERequest;
var fs = require("fs");
var path = require("path");
// Electron app은 선택적으로 import (Node.js 환경에서도 동작하도록)
var app;
try {
    app = (_a = require('electron')) === null || _a === void 0 ? void 0 : _a.app;
}
catch (_b) {
    // Electron이 없는 환경에서는 무시
}
/**
 * Google CSE Rate Limiter
 * - 요청 간 최소 1초 딜레이
 * - 일일 할당량 추적 (무료: 100회/일)
 * - 요청 큐 시스템으로 순차 처리
 */
var GoogleCSERateLimiter = /** @class */ (function () {
    function GoogleCSERateLimiter() {
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.dailyRequestCount = 0;
        this.dailyResetTime = 0;
        this.minDelay = 500; // 최소 0.5초 간격 (성능 최적화: 1초 -> 0.5초)
        this.maxDailyRequests = 100; // 무료 계정 기준
        this.concurrentRequests = 0; // 동시 요청 수 추적
        this.maxConcurrent = 2; // 최대 동시 요청 수 (성능 최적화)
        // 사용량 파일 경로 설정
        try {
            var userDataPath = (app === null || app === void 0 ? void 0 : app.getPath('userData')) || process.cwd();
            this.usageFilePath = path.join(userDataPath, 'google-cse-usage.json');
            this.loadDailyUsage();
        }
        catch (_a) {
            this.usageFilePath = path.join(process.cwd(), 'google-cse-usage.json');
            this.loadDailyUsage();
        }
        this.resetDailyCounter();
    }
    GoogleCSERateLimiter.getInstance = function () {
        if (!GoogleCSERateLimiter.instance) {
            GoogleCSERateLimiter.instance = new GoogleCSERateLimiter();
        }
        return GoogleCSERateLimiter.instance;
    };
    /**
     * 일일 사용량 로드
     */
    GoogleCSERateLimiter.prototype.loadDailyUsage = function () {
        try {
            if (fs.existsSync(this.usageFilePath)) {
                var data = JSON.parse(fs.readFileSync(this.usageFilePath, 'utf8'));
                var savedDate = new Date(data.date);
                var today = new Date();
                // 같은 날이면 사용량 복원
                if (savedDate.toDateString() === today.toDateString()) {
                    this.dailyRequestCount = data.count || 0;
                }
                else {
                    // 다른 날이면 리셋
                    this.dailyRequestCount = 0;
                }
            }
        }
        catch (error) {
            console.warn('[CSE-RATE-LIMITER] 사용량 로드 실패:', error);
            this.dailyRequestCount = 0;
        }
    };
    /**
     * 일일 사용량 저장
     */
    GoogleCSERateLimiter.prototype.saveDailyUsage = function () {
        try {
            fs.writeFileSync(this.usageFilePath, JSON.stringify({
                date: new Date().toISOString(),
                count: this.dailyRequestCount
            }, null, 2), 'utf8');
        }
        catch (error) {
            console.warn('[CSE-RATE-LIMITER] 사용량 저장 실패:', error);
        }
    };
    /**
     * 일일 카운터 리셋 (자정)
     */
    GoogleCSERateLimiter.prototype.resetDailyCounter = function () {
        var _this = this;
        var now = Date.now();
        var tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        this.dailyResetTime = tomorrow.getTime();
        this.dailyRequestCount = 0;
        this.saveDailyUsage();
        // 다음 자정까지 대기
        var msUntilMidnight = tomorrow.getTime() - now;
        if (msUntilMidnight > 0) {
            setTimeout(function () { return _this.resetDailyCounter(); }, msUntilMidnight);
        }
    };
    /**
     * 요청 큐에 추가하고 처리
     */
    GoogleCSERateLimiter.prototype.request = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.requestQueue.push(function () { return __awaiter(_this, void 0, void 0, function () {
                            var result, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, fn()];
                                    case 1:
                                        result = _a.sent();
                                        resolve(result);
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_1 = _a.sent();
                                        reject(error_1);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        _this.processQueue();
                    })];
            });
        });
    };
    /**
     * 요청 큐 처리 (성능 최적화: 병렬 처리 지원)
     */
    GoogleCSERateLimiter.prototype.processQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var remainingTime, hours, minutes, requestFn;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.requestQueue.length === 0)
                            return [2 /*return*/];
                        // 일일 할당량 체크
                        if (this.dailyRequestCount >= this.maxDailyRequests) {
                            remainingTime = this.dailyResetTime - Date.now();
                            hours = Math.floor(remainingTime / (1000 * 60 * 60));
                            minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                            throw new Error("Google CSE \uC77C\uC77C \uD560\uB2F9\uB7C9 \uCD08\uACFC (".concat(this.dailyRequestCount, "/").concat(this.maxDailyRequests, "\uD68C). ").concat(hours, "\uC2DC\uAC04 ").concat(minutes, "\uBD84 \uD6C4 \uC7AC\uC0AC\uC6A9 \uAC00\uB2A5\uD569\uB2C8\uB2E4."));
                        }
                        _a.label = 1;
                    case 1:
                        if (!(this.concurrentRequests >= this.maxConcurrent)) return [3 /*break*/, 3];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 3:
                        requestFn = this.requestQueue.shift();
                        if (!requestFn)
                            return [2 /*return*/];
                        this.concurrentRequests++;
                        // 비동기로 처리 (블로킹 방지)
                        this.processRequest(requestFn).finally(function () {
                            _this.concurrentRequests--;
                            // 다음 요청 처리
                            if (_this.requestQueue.length > 0) {
                                _this.processQueue();
                            }
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 개별 요청 처리
     */
    GoogleCSERateLimiter.prototype.processRequest = function (requestFn) {
        return __awaiter(this, void 0, void 0, function () {
            var now, timeSinceLastRequest, error_2;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = Date.now();
                        timeSinceLastRequest = now - this.lastRequestTime;
                        if (!(timeSinceLastRequest < this.minDelay)) return [3 /*break*/, 2];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, _this.minDelay - timeSinceLastRequest); })];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, requestFn()];
                    case 3:
                        _b.sent();
                        this.lastRequestTime = Date.now();
                        this.dailyRequestCount++;
                        this.saveDailyUsage();
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        // 429 오류인 경우 조용히 처리
                        if ((error_2 === null || error_2 === void 0 ? void 0 : error_2.status) === 429 || ((_a = error_2 === null || error_2 === void 0 ? void 0 : error_2.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                            console.warn('[CSE-RATE-LIMITER] 429 오류 - 요청 건너뜀');
                            // 다음 요청까지 더 긴 대기 (하지만 블로킹하지 않음)
                            setTimeout(function () { }, 2000);
                        }
                        else {
                            throw error_2;
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 일일 사용량 조회
     */
    GoogleCSERateLimiter.prototype.getDailyUsage = function () {
        return {
            used: this.dailyRequestCount,
            remaining: this.maxDailyRequests - this.dailyRequestCount,
            resetTime: new Date(this.dailyResetTime)
        };
    };
    /**
     * 할당량 초기화 (테스트용)
     */
    GoogleCSERateLimiter.prototype.reset = function () {
        this.dailyRequestCount = 0;
        this.saveDailyUsage();
    };
    return GoogleCSERateLimiter;
}());
exports.GoogleCSERateLimiter = GoogleCSERateLimiter;
/**
 * Google CSE Cache
 * - 쿼리 결과 캐싱 (TTL: 1시간)
 * - 동일 쿼리 재호출 방지
 */
var GoogleCSECache = /** @class */ (function () {
    function GoogleCSECache() {
        var _this = this;
        this.cache = new Map();
        this.ttl = 60 * 60 * 1000; // 1시간
        // 주기적으로 만료된 캐시 정리 (10분마다)
        setInterval(function () { return _this.cleanExpired(); }, 10 * 60 * 1000);
    }
    GoogleCSECache.getInstance = function () {
        if (!GoogleCSECache.instance) {
            GoogleCSECache.instance = new GoogleCSECache();
        }
        return GoogleCSECache.instance;
    };
    /**
     * 캐시에서 조회
     */
    GoogleCSECache.prototype.get = function (key) {
        var cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    };
    /**
     * 캐시에 저장
     */
    GoogleCSECache.prototype.set = function (key, data) {
        this.cache.set(key, {
            data: data,
            expiry: Date.now() + this.ttl
        });
    };
    /**
     * 캐시 키 생성 (쿼리 기반)
     */
    GoogleCSECache.generateKey = function (query, options) {
        var optionsStr = options ? JSON.stringify(options) : '';
        return "cse:".concat(query, ":").concat(optionsStr);
    };
    /**
     * 만료된 캐시 정리
     */
    GoogleCSECache.prototype.cleanExpired = function () {
        var _this = this;
        var now = Date.now();
        var keysToDelete = [];
        this.cache.forEach(function (value, key) {
            if (now > value.expiry) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(function (key) { return _this.cache.delete(key); });
    };
    /**
     * 캐시 전체 삭제
     */
    GoogleCSECache.prototype.clear = function () {
        this.cache.clear();
    };
    /**
     * 캐시 통계
     */
    GoogleCSECache.prototype.getStats = function () {
        var keys = [];
        this.cache.forEach(function (_value, key) { return keys.push(key); });
        return {
            size: this.cache.size,
            keys: keys
        };
    };
    return GoogleCSECache;
}());
exports.GoogleCSECache = GoogleCSECache;
/**
 * Google CSE 안전한 요청 래퍼
 * Rate Limiter와 Cache를 통합하여 사용
 */
function safeCSERequest(query, requestFn, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, useCache, cacheKey, _c, priority, limiter, cache, key, cached, result;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options || {}, _b = _a.useCache, useCache = _b === void 0 ? true : _b, cacheKey = _a.cacheKey, _c = _a.priority, priority = _c === void 0 ? 'normal' : _c;
                    limiter = GoogleCSERateLimiter.getInstance();
                    cache = GoogleCSECache.getInstance();
                    key = cacheKey || GoogleCSECache.generateKey(query);
                    // 캐시 확인 (동기 처리로 즉시 반환)
                    if (useCache) {
                        cached = cache.get(key);
                        if (cached) {
                            console.log("[CSE-CACHE] \uCE90\uC2DC \uD788\uD2B8: ".concat(query.substring(0, 50), "..."));
                            return [2 /*return*/, cached];
                        }
                    }
                    // 우선순위가 낮은 요청은 비동기로 처리 (포스팅 발행 블로킹 방지)
                    if (priority === 'low') {
                        // 비동기로 처리하되 결과는 기다림
                        return [2 /*return*/, limiter.request(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result_1, error_3;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, requestFn()];
                                        case 1:
                                            result_1 = _b.sent();
                                            if (useCache && result_1) {
                                                cache.set(key, result_1);
                                            }
                                            return [2 /*return*/, result_1];
                                        case 2:
                                            error_3 = _b.sent();
                                            if ((error_3 === null || error_3 === void 0 ? void 0 : error_3.status) === 429 || ((_a = error_3 === null || error_3 === void 0 ? void 0 : error_3.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                                                console.warn("[CSE-RATE-LIMITER] 429 \uC624\uB958 \uBC1C\uC0DD: ".concat(query.substring(0, 50), "..."));
                                                throw new Error('Google CSE Rate Limit 초과. 잠시 후 다시 시도해주세요.');
                                            }
                                            throw error_3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    }
                    return [4 /*yield*/, limiter.request(function () { return __awaiter(_this, void 0, void 0, function () {
                            var error_4;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, requestFn()];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        error_4 = _b.sent();
                                        // 429 오류인 경우 특별 처리
                                        if ((error_4 === null || error_4 === void 0 ? void 0 : error_4.status) === 429 || ((_a = error_4 === null || error_4 === void 0 ? void 0 : error_4.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                                            console.warn("[CSE-RATE-LIMITER] 429 \uC624\uB958 \uBC1C\uC0DD: ".concat(query.substring(0, 50), "..."));
                                            throw new Error('Google CSE Rate Limit 초과. 잠시 후 다시 시도해주세요.');
                                        }
                                        throw error_4;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    result = _d.sent();
                    // 결과 캐싱
                    if (useCache && result) {
                        cache.set(key, result);
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}

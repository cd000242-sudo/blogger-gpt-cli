"use strict";
// src/core/schedule-manager.ts
// 스케줄 관리 및 예약 상태 확인 시스템
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
exports.ScheduleManager = void 0;
exports.getScheduleManager = getScheduleManager;
var fs = require("fs");
var path = require("path");
var electron_1 = require("electron");
var ScheduleManager = /** @class */ (function () {
    function ScheduleManager() {
        this.scheduleData = [];
        this.isMonitoring = false;
        this.monitoringInterval = null;
        // Electron 앱의 userData 디렉토리에 스케줄 파일 저장
        var userDataPath = electron_1.app.getPath('userData');
        this.scheduleFilePath = path.join(userDataPath, 'scheduled-posts.json');
        this.loadScheduleData();
    }
    // 스케줄 데이터 로드
    ScheduleManager.prototype.loadScheduleData = function () {
        try {
            if (fs.existsSync(this.scheduleFilePath)) {
                var data = fs.readFileSync(this.scheduleFilePath, 'utf8');
                this.scheduleData = JSON.parse(data);
                console.log("\uD83D\uDCC5 \uC2A4\uCF00\uC904 \uB370\uC774\uD130 \uB85C\uB4DC\uB428: ".concat(this.scheduleData.length, "\uAC1C \uD56D\uBAA9"));
            }
            else {
                this.scheduleData = [];
                this.saveScheduleData();
                console.log('📅 새로운 스케줄 파일 생성됨');
            }
        }
        catch (error) {
            console.error('❌ 스케줄 데이터 로드 실패:', error);
            this.scheduleData = [];
        }
    };
    // 스케줄 데이터 저장
    ScheduleManager.prototype.saveScheduleData = function () {
        try {
            fs.writeFileSync(this.scheduleFilePath, JSON.stringify(this.scheduleData, null, 2));
            console.log("\uD83D\uDCBE \uC2A4\uCF00\uC904 \uB370\uC774\uD130 \uC800\uC7A5\uB428: ".concat(this.scheduleData.length, "\uAC1C \uD56D\uBAA9"));
        }
        catch (error) {
            console.error('❌ 스케줄 데이터 저장 실패:', error);
        }
    };
    // 새 스케줄 추가
    ScheduleManager.prototype.addSchedule = function (post) {
        var id = "schedule_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
        var now = new Date().toISOString();
        var scheduledPost = __assign(__assign({}, post), { id: id, createdAt: now, updatedAt: now, status: 'pending', retryCount: 0, maxRetries: 3 });
        this.scheduleData.push(scheduledPost);
        this.saveScheduleData();
        console.log("\u2705 \uC0C8 \uC2A4\uCF00\uC904 \uCD94\uAC00\uB428: ".concat(id, " - ").concat(post.topic));
        return id;
    };
    // 스케줄 업데이트
    ScheduleManager.prototype.updateSchedule = function (id, updates) {
        var index = this.scheduleData.findIndex(function (post) { return post.id === id; });
        if (index === -1) {
            console.error("\u274C \uC2A4\uCF00\uC904\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C: ".concat(id));
            return false;
        }
        var filteredUpdates = {};
        for (var key in updates) {
            if (key in updates && updates[key] !== undefined) {
                var value = updates[key];
                if (value !== undefined) {
                    filteredUpdates[key] = value;
                }
            }
        }
        var existingPost = this.scheduleData[index];
        if (existingPost) {
            this.scheduleData[index] = __assign(__assign(__assign({}, existingPost), filteredUpdates), { updatedAt: new Date().toISOString() });
        }
        this.saveScheduleData();
        console.log("\uD83D\uDD04 \uC2A4\uCF00\uC904 \uC5C5\uB370\uC774\uD2B8\uB428: ".concat(id));
        return true;
    };
    // 스케줄 삭제
    ScheduleManager.prototype.deleteSchedule = function (id) {
        var index = this.scheduleData.findIndex(function (post) { return post.id === id; });
        if (index === -1) {
            console.error("\u274C \uC2A4\uCF00\uC904\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC74C: ".concat(id));
            return false;
        }
        var deletedPost = this.scheduleData.splice(index, 1)[0];
        this.saveScheduleData();
        if (deletedPost) {
            console.log("\uD83D\uDDD1\uFE0F \uC2A4\uCF00\uC904 \uC0AD\uC81C\uB428: ".concat(id, " - ").concat(deletedPost.topic));
        }
        return true;
    };
    // 스케줄 조회
    ScheduleManager.prototype.getSchedule = function (id) {
        return this.scheduleData.find(function (post) { return post.id === id; }) || null;
    };
    // 모든 스케줄 조회
    ScheduleManager.prototype.getAllSchedules = function () {
        return __spreadArray([], this.scheduleData, true);
    };
    // 상태별 스케줄 조회
    ScheduleManager.prototype.getSchedulesByStatus = function (status) {
        return this.scheduleData.filter(function (post) { return post.status === status; });
    };
    // 예약된 포스트 조회 (현재 시간 기준)
    ScheduleManager.prototype.getPendingSchedules = function () {
        var now = new Date();
        return this.scheduleData.filter(function (post) {
            var scheduleTime = new Date(post.scheduleDateTime);
            return post.status === 'pending' && scheduleTime <= now;
        });
    };
    // 스케줄 통계 조회
    ScheduleManager.prototype.getScheduleStats = function () {
        var stats = {
            total: this.scheduleData.length,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
        };
        this.scheduleData.forEach(function (post) {
            stats[post.status]++;
        });
        return stats;
    };
    // 스케줄 모니터링 시작
    ScheduleManager.prototype.startMonitoring = function () {
        var _this = this;
        if (this.isMonitoring) {
            console.log('⚠️ 스케줄 모니터링이 이미 실행 중입니다');
            return;
        }
        this.isMonitoring = true;
        console.log('🔄 스케줄 모니터링 시작됨');
        // 30초마다 예약된 포스트 확인
        this.monitoringInterval = setInterval(function () {
            _this.checkPendingSchedules();
        }, 30000);
        // 즉시 한 번 실행
        this.checkPendingSchedules();
    };
    // 스케줄 모니터링 중지
    ScheduleManager.prototype.stopMonitoring = function () {
        if (!this.isMonitoring) {
            console.log('⚠️ 스케줄 모니터링이 실행 중이 아닙니다');
            return;
        }
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        console.log('⏹️ 스케줄 모니터링 중지됨');
    };
    // 예약된 포스트 확인 및 처리
    ScheduleManager.prototype.checkPendingSchedules = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pendingSchedules, _i, pendingSchedules_1, schedule, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pendingSchedules = this.getPendingSchedules();
                        if (pendingSchedules.length === 0) {
                            return [2 /*return*/];
                        }
                        console.log("\uD83D\uDD0D \uC608\uC57D\uB41C \uD3EC\uC2A4\uD2B8 \uD655\uC778: ".concat(pendingSchedules.length, "\uAC1C \uBC1C\uACAC"));
                        _i = 0, pendingSchedules_1 = pendingSchedules;
                        _a.label = 1;
                    case 1:
                        if (!(_i < pendingSchedules_1.length)) return [3 /*break*/, 6];
                        schedule = pendingSchedules_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.processScheduledPost(schedule)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("\u274C \uC2A4\uCF00\uC904 \uCC98\uB9AC \uC2E4\uD328: ".concat(schedule.id), error_1);
                        this.updateSchedule(schedule.id, {
                            status: 'failed',
                            errorMessage: error_1 instanceof Error ? error_1.message : '알 수 없는 오류'
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // 예약된 포스트 처리
    ScheduleManager.prototype.processScheduledPost = function (schedule) {
        return __awaiter(this, void 0, void 0, function () {
            var runPost, result, updates, error_2, errorMessage, retryCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDE80 \uC608\uC57D\uB41C \uD3EC\uC2A4\uD2B8 \uCC98\uB9AC \uC2DC\uC791: ".concat(schedule.id, " - ").concat(schedule.topic));
                        // 상태를 processing으로 변경
                        this.updateSchedule(schedule.id, { status: 'processing' });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('./index'); })];
                    case 2:
                        runPost = (_a.sent()).runPost;
                        return [4 /*yield*/, runPost(schedule.payload)];
                    case 3:
                        result = _a.sent();
                        if (result.ok) {
                            updates = { status: 'completed' };
                            // errorMessage가 있으면 제거하기 위해 명시적으로 설정하지 않음
                            this.updateSchedule(schedule.id, updates);
                            console.log("\u2705 \uC608\uC57D\uB41C \uD3EC\uC2A4\uD2B8 \uCC98\uB9AC \uC644\uB8CC: ".concat(schedule.id));
                        }
                        else {
                            throw new Error(result.error || '포스팅 실패');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : '알 수 없는 오류';
                        retryCount = schedule.retryCount + 1;
                        if (retryCount < schedule.maxRetries) {
                            // 재시도 가능
                            this.updateSchedule(schedule.id, {
                                status: 'pending',
                                retryCount: retryCount,
                                errorMessage: "".concat(errorMessage, " (\uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(schedule.maxRetries, ")")
                            });
                            console.log("\uD83D\uDD04 \uC7AC\uC2DC\uB3C4 \uC608\uC57D: ".concat(schedule.id, " (").concat(retryCount, "/").concat(schedule.maxRetries, ")"));
                        }
                        else {
                            // 최대 재시도 횟수 초과
                            this.updateSchedule(schedule.id, {
                                status: 'failed',
                                retryCount: retryCount,
                                errorMessage: "".concat(errorMessage, " (\uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD69F\uC218 \uCD08\uACFC)")
                            });
                            console.log("\u274C \uCD5C\uC885 \uC2E4\uD328: ".concat(schedule.id));
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // 스케줄 상태 확인 (UI용)
    ScheduleManager.prototype.getScheduleStatus = function () {
        var stats = this.getScheduleStats();
        var pendingSchedules = this.getSchedulesByStatus('pending');
        var nextSchedule = pendingSchedules.length > 0
            ? pendingSchedules.sort(function (a, b) { return new Date(a.scheduleDateTime).getTime() - new Date(b.scheduleDateTime).getTime(); })[0] || null
            : null;
        var recentActivity = this.scheduleData
            .sort(function (a, b) { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); })
            .slice(0, 10);
        return {
            isMonitoring: this.isMonitoring,
            stats: stats,
            nextSchedule: nextSchedule,
            recentActivity: recentActivity
        };
    };
    // 스케줄 정리 (오래된 완료/실패된 스케줄 삭제)
    ScheduleManager.prototype.cleanupOldSchedules = function (daysToKeep) {
        if (daysToKeep === void 0) { daysToKeep = 30; }
        var cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        var initialCount = this.scheduleData.length;
        this.scheduleData = this.scheduleData.filter(function (post) {
            var createdAt = new Date(post.createdAt);
            var isOld = createdAt < cutoffDate;
            var isCompletedOrFailed = post.status === 'completed' || post.status === 'failed';
            return !(isOld && isCompletedOrFailed);
        });
        var deletedCount = initialCount - this.scheduleData.length;
        if (deletedCount > 0) {
            this.saveScheduleData();
            console.log("\uD83E\uDDF9 \uC624\uB798\uB41C \uC2A4\uCF00\uC904 \uC815\uB9AC\uB428: ".concat(deletedCount, "\uAC1C \uC0AD\uC81C"));
        }
        return deletedCount;
    };
    return ScheduleManager;
}());
exports.ScheduleManager = ScheduleManager;
// 싱글톤 인스턴스
var scheduleManagerInstance = null;
function getScheduleManager() {
    if (!scheduleManagerInstance) {
        scheduleManagerInstance = new ScheduleManager();
    }
    return scheduleManagerInstance;
}

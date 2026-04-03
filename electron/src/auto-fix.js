"use strict";
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
exports.AutoFixSystem = void 0;
// 자동 오류 감지 및 수정 시스템
var fs = require("fs");
var ERROR_PATTERNS = [
    {
        pattern: /```html/g,
        description: '```html 마커 제거',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C ").concat(match, " \uC81C\uAC70"));
            return '';
        }
    },
    {
        pattern: /```[\w]*[\s\S]*?```/g,
        description: '모든 마크다운 코드 블록 제거',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uB9C8\uD06C\uB2E4\uC6B4 \uBE14\uB85D ").concat(match, " \uC81C\uAC70"));
            return '';
        }
    },
    {
        pattern: /```[\w]*/g,
        description: '모든 마크다운 마커 제거',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uB9C8\uD06C\uB2E4\uC6B4 \uB9C8\uCEE4 ").concat(match, " \uC81C\uAC70"));
            return '';
        }
    },
    {
        pattern: /```/g,
        description: '모든 백틱 마커 제거',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uBC31\uD2F1 \uB9C8\uCEE4 ").concat(match, " \uC81C\uAC70"));
            return '';
        }
    },
    {
        pattern: /🚫|📝|🔑|📋|🎯|📊|🚨|✅|❌|⚠️/g,
        description: '이모지 제거',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uC774\uBAA8\uC9C0 ").concat(match, " \uC81C\uAC70"));
            return '';
        }
    },
    {
        pattern: /Cannot find module ['"](\.\.\/cli)['"]/,
        description: '모듈 경로 수정',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uBAA8\uB4C8 \uACBD\uB85C \uC218\uC815"));
            return match.replace('../cli', './cli');
        }
    },
    {
        pattern: /Missing \) after argument list/,
        description: '괄호 누락 수정',
        fix: function (match, filePath) {
            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C \uAD04\uD638 \uB204\uB77D \uC218\uC815"));
            return match + ')';
        }
    }
];
var AutoFixSystem = /** @class */ (function () {
    function AutoFixSystem() {
        this.errorLog = [];
    }
    AutoFixSystem.getInstance = function () {
        if (!AutoFixSystem.instance) {
            AutoFixSystem.instance = new AutoFixSystem();
        }
        return AutoFixSystem.instance;
    };
    /**
     * 파일에서 오류 패턴을 감지하고 자동 수정
     */
    AutoFixSystem.prototype.fixFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var content, modified, _i, ERROR_PATTERNS_1, errorPattern, matches, _a, matches_1, match, fixed, backupPath;
            return __generator(this, function (_b) {
                try {
                    if (!fs.existsSync(filePath)) {
                        console.log("[AUTO-FIX] \uD30C\uC77C\uC774 \uC874\uC7AC\uD558\uC9C0 \uC54A\uC74C: ".concat(filePath));
                        return [2 /*return*/, false];
                    }
                    content = fs.readFileSync(filePath, 'utf8');
                    modified = false;
                    for (_i = 0, ERROR_PATTERNS_1 = ERROR_PATTERNS; _i < ERROR_PATTERNS_1.length; _i++) {
                        errorPattern = ERROR_PATTERNS_1[_i];
                        matches = content.match(errorPattern.pattern);
                        if (matches) {
                            console.log("[AUTO-FIX] ".concat(filePath, "\uC5D0\uC11C ").concat(errorPattern.description, " \uAC10\uC9C0"));
                            for (_a = 0, matches_1 = matches; _a < matches_1.length; _a++) {
                                match = matches_1[_a];
                                fixed = errorPattern.fix(match, filePath);
                                content = content.replace(match, fixed);
                                modified = true;
                            }
                        }
                    }
                    if (modified) {
                        backupPath = "".concat(filePath, ".backup.").concat(Date.now());
                        fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
                        console.log("[AUTO-FIX] \uBC31\uC5C5 \uC0DD\uC131: ".concat(backupPath));
                        // 수정된 내용 저장
                        fs.writeFileSync(filePath, content);
                        console.log("[AUTO-FIX] ".concat(filePath, " \uC218\uC815 \uC644\uB8CC"));
                        this.errorLog.push("\u2705 ".concat(filePath, ": ").concat(ERROR_PATTERNS.length, "\uAC1C \uD328\uD134 \uC218\uC815"));
                        return [2 /*return*/, true];
                    }
                    return [2 /*return*/, false];
                }
                catch (error) {
                    console.error("[AUTO-FIX] ".concat(filePath, " \uC218\uC815 \uC2E4\uD328:"), error);
                    this.errorLog.push("\u274C ".concat(filePath, ": \uC218\uC815 \uC2E4\uD328 - ").concat(error instanceof Error ? error.message : String(error)));
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 프로젝트 전체에서 오류 패턴 검사 및 수정
     */
    AutoFixSystem.prototype.fixProject = function () {
        return __awaiter(this, void 0, void 0, function () {
            var filesToCheck, fixedCount, errors, _i, filesToCheck_1, filePath, wasFixed, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[AUTO-FIX] 프로젝트 전체 오류 검사 시작...');
                        filesToCheck = [
                            'src/core/index.ts',
                            'src/core/max-mode-structure.ts',
                            'electron/main.ts',
                            'electron/ui/script.js',
                            'electron/ui/index.html'
                        ];
                        fixedCount = 0;
                        errors = [];
                        _i = 0, filesToCheck_1 = filesToCheck;
                        _a.label = 1;
                    case 1:
                        if (!(_i < filesToCheck_1.length)) return [3 /*break*/, 6];
                        filePath = filesToCheck_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.fixFile(filePath)];
                    case 3:
                        wasFixed = _a.sent();
                        if (wasFixed) {
                            fixedCount++;
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        errors.push("".concat(filePath, ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        console.log("[AUTO-FIX] \uC644\uB8CC: ".concat(fixedCount, "\uAC1C \uD30C\uC77C \uC218\uC815, ").concat(errors.length, "\uAC1C \uC624\uB958"));
                        return [2 /*return*/, { fixed: fixedCount, errors: errors }];
                }
            });
        });
    };
    /**
     * 빌드 오류 자동 감지 및 수정
     */
    AutoFixSystem.prototype.fixBuildErrors = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[AUTO-FIX] 빌드 오류 자동 수정 시작...');
                        // 1. TypeScript 문법 오류 수정
                        return [4 /*yield*/, this.fixFile('src/core/max-mode-structure.ts')];
                    case 1:
                        // 1. TypeScript 문법 오류 수정
                        _a.sent();
                        // 2. 모듈 경로 오류 수정
                        return [4 /*yield*/, this.fixFile('src/core/index.ts')];
                    case 2:
                        // 2. 모듈 경로 오류 수정
                        _a.sent();
                        // 3. UI 파일 오류 수정
                        return [4 /*yield*/, this.fixFile('electron/ui/script.js')];
                    case 3:
                        // 3. UI 파일 오류 수정
                        _a.sent();
                        console.log('[AUTO-FIX] 빌드 오류 수정 완료');
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * 오류 로그 가져오기
     */
    AutoFixSystem.prototype.getErrorLog = function () {
        return __spreadArray([], this.errorLog, true);
    };
    /**
     * 오류 로그 초기화
     */
    AutoFixSystem.prototype.clearErrorLog = function () {
        this.errorLog = [];
    };
    return AutoFixSystem;
}());
exports.AutoFixSystem = AutoFixSystem;
// 전역 오류 핸들러 등록
process.on('uncaughtException', function (_error) { return __awaiter(void 0, void 0, void 0, function () {
    var autoFix;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('[AUTO-FIX] 예상치 못한 오류 감지, 자동 수정 시도...');
                autoFix = AutoFixSystem.getInstance();
                return [4 /*yield*/, autoFix.fixBuildErrors()];
            case 1:
                _a.sent();
                console.log('[AUTO-FIX] 자동 수정 완료, 앱 재시작 권장');
                return [2 /*return*/];
        }
    });
}); });
process.on('unhandledRejection', function (_reason, _promise) { return __awaiter(void 0, void 0, void 0, function () {
    var autoFix;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('[AUTO-FIX] 처리되지 않은 Promise 거부 감지, 자동 수정 시도...');
                autoFix = AutoFixSystem.getInstance();
                return [4 /*yield*/, autoFix.fixBuildErrors()];
            case 1:
                _a.sent();
                console.log('[AUTO-FIX] 자동 수정 완료');
                return [2 /*return*/];
        }
    });
}); });

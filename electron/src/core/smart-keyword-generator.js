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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartKeywordGenerator = void 0;
var SmartKeywordGenerator = /** @class */ (function () {
    function SmartKeywordGenerator() {
    }
    SmartKeywordGenerator.prototype.generateSmartKeywords = function (topic, _baseKeywords) {
        return __awaiter(this, void 0, void 0, function () {
            var combinations, recommendedApproach, differentiationPoints, seoOptimization;
            return __generator(this, function (_a) {
                combinations = [
                    {
                        primary: "".concat(topic, " \uC644\uBCBD \uB9C8\uC2A4\uD130"),
                        secondary: ['전문가', '비법', '노하우'],
                        longTail: ["".concat(topic, " \uC804\uBB38\uAC00\uAC00 \uC54C\uB824\uC8FC\uB294 \uBE44\uBC00"), "".concat(topic, " \uB9C8\uC2A4\uD130\uD558\uB294 7\uAC00\uC9C0 \uBC29\uBC95"), "".concat(topic, " \uC644\uC804 \uC815\uBCF5 \uAC00\uC774\uB4DC")],
                        searchVolume: 8500,
                        competition: 'medium',
                        uniqueness: 85,
                        adsenseFriendly: true
                    },
                    {
                        primary: "".concat(topic, " \uD601\uC2E0\uC801 \uC811\uADFC\uBC95"),
                        secondary: ['차별화', '독창적', '혁신'],
                        longTail: ["".concat(topic, " \uCC28\uBCC4\uD654 \uC804\uB7B5"), "".concat(topic, " \uB3C5\uCC3D\uC801 \uD574\uACB0\uCC45"), "".concat(topic, " \uD601\uC2E0\uC801 \uBC29\uBC95\uB860")],
                        searchVolume: 3200,
                        competition: 'low',
                        uniqueness: 95,
                        adsenseFriendly: true
                    },
                    {
                        primary: "".concat(topic, " \uB370\uC774\uD130 \uAE30\uBC18 \uBD84\uC11D"),
                        secondary: ['통계', '연구', '분석'],
                        longTail: ["".concat(topic, " \uD1B5\uACC4 \uBD84\uC11D"), "".concat(topic, " \uC5F0\uAD6C \uACB0\uACFC"), "".concat(topic, " \uB370\uC774\uD130 \uAE30\uBC18 \uC778\uC0AC\uC774\uD2B8")],
                        searchVolume: 1200,
                        competition: 'low',
                        uniqueness: 90,
                        adsenseFriendly: true
                    }
                ];
                recommendedApproach = "\"".concat(topic, " \uD601\uC2E0\uC801 \uC811\uADFC\uBC95\"\uACFC \"\uB370\uC774\uD130 \uAE30\uBC18 \uBD84\uC11D\" \uD0A4\uC6CC\uB4DC\uB97C \uC911\uC2EC\uC73C\uB85C \n    \uB3C5\uCC3D\uC801\uC774\uACE0 \uC804\uBB38\uC801\uC778 \uCF58\uD150\uCE20\uB97C \uC791\uC131\uD558\uC138\uC694. \uC774\uB294 \uACBD\uC7C1\uC774 \uC801\uC73C\uBA74\uC11C\uB3C4 \n    \uC560\uB4DC\uC13C\uC2A4\uC5D0 \uCE5C\uD654\uC801\uC778 \uD0A4\uC6CC\uB4DC \uC870\uD569\uC785\uB2C8\uB2E4.");
                differentiationPoints = [
                    '기존 "가이드" 키워드 대신 "혁신적 접근법" 사용',
                    '데이터와 통계를 활용한 전문적 접근',
                    '롱테일 키워드로 구체적 니즈 타겟팅',
                    '애드센스 친화적 키워드 조합'
                ];
                seoOptimization = [
                    '주요 키워드를 제목과 소제목에 자연스럽게 배치',
                    '롱테일 키워드를 본문에 2-3회 포함',
                    '관련 키워드를 메타 설명에 활용',
                    '내부 링크에 키워드 포함'
                ];
                return [2 /*return*/, {
                        combinations: combinations,
                        recommendedApproach: recommendedApproach,
                        differentiationPoints: differentiationPoints,
                        seoOptimization: seoOptimization
                    }];
            });
        });
    };
    SmartKeywordGenerator.prototype.generateKeywordVariations = function (topic) {
        var variations = [
            "".concat(topic, " \uC644\uBCBD \uC815\uBCF5"),
            "".concat(topic, " \uB9C8\uC2A4\uD130 \uD074\uB798\uC2A4"),
            "".concat(topic, " \uC804\uBB38\uAC00 \uBE44\uBC95"),
            "".concat(topic, " \uD601\uC2E0\uC801 \uBC29\uBC95"),
            "".concat(topic, " \uB370\uC774\uD130 \uAE30\uBC18 \uC811\uADFC"),
            "".concat(topic, " \uCC28\uBCC4\uD654 \uC804\uB7B5"),
            "".concat(topic, " \uB3C5\uCC3D\uC801 \uD574\uACB0\uCC45"),
            "".concat(topic, " \uC2E4\uC804 \uB178\uD558\uC6B0"),
            "".concat(topic, " \uACE0\uAE09 \uAE30\uBC95"),
            "".concat(topic, " \uD504\uB9AC\uBBF8\uC5C4 \uAC00\uC774\uB4DC")
        ];
        return variations;
    };
    SmartKeywordGenerator.prototype.analyzeKeywordCompetition = function (_keyword) {
        // 실제 구현에서는 키워드 검색 API를 사용
        var mockData = {
            competition: '중간',
            opportunity: '롱테일 키워드와 구체적 접근법으로 차별화 가능'
        };
        return mockData;
    };
    return SmartKeywordGenerator;
}());
exports.SmartKeywordGenerator = SmartKeywordGenerator;

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
exports.CompetitorAnalyzer = void 0;
var CompetitorAnalyzer = /** @class */ (function () {
    function CompetitorAnalyzer() {
    }
    CompetitorAnalyzer.prototype.analyzeCompetitors = function (topic, _keywords) {
        return __awaiter(this, void 0, void 0, function () {
            var mockCompetitors, commonPatterns, differentiationStrategy, recommendedApproach, uniquenessScore;
            return __generator(this, function (_a) {
                mockCompetitors = [
                    {
                        title: "".concat(topic, " \uC644\uBCBD \uAC00\uC774\uB4DC - \uCD08\uBCF4\uC790\uB3C4 \uC27D\uAC8C \uB530\uB77C\uD558\uB294 \uBC29\uBC95"),
                        url: 'https://example1.com',
                        structure: ['도입부', '기본 개념', '단계별 가이드', '주의사항', '마무리'],
                        keywords: ['가이드', '방법', '초보자', '쉽게'],
                        tone: '친근하고 설명적',
                        length: 2500,
                        qualityScore: 7.2,
                        differentiationPoints: ['기본적인 접근', '일반적인 구조']
                    },
                    {
                        title: "".concat(topic, " \uC804\uBB38\uAC00\uAC00 \uC54C\uB824\uC8FC\uB294 \uD575\uC2EC \uBE44\uBC95"),
                        url: 'https://example2.com',
                        structure: ['문제 제기', '해결책 제시', '사례 분석', '결론'],
                        keywords: ['전문가', '비법', '핵심', '해결책'],
                        tone: '전문적이고 권위적',
                        length: 3200,
                        qualityScore: 8.1,
                        differentiationPoints: ['전문성 강조', '사례 중심']
                    }
                ];
                commonPatterns = [
                    'Q&A 형식 사용',
                    '단계별 가이드 구조',
                    '기본적인 키워드 사용',
                    '일반적인 도입부'
                ];
                differentiationStrategy = [
                    '스토리텔링 기반 접근법',
                    '데이터 기반 분석',
                    '혁신적인 구조 사용',
                    '고유한 키워드 조합'
                ];
                recommendedApproach = "\uAE30\uC874 \uAE00\uB4E4\uACFC \uC644\uC804\uD788 \uB2E4\uB978 \uC811\uADFC\uBC95\uC744 \uC0AC\uC6A9\uD558\uC138\uC694. \n    \uC2A4\uD1A0\uB9AC\uD154\uB9C1\uC744 \uD1B5\uD574 \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB04C\uACE0, \uAC80\uC99D\uB41C \uB370\uC774\uD130\uB97C \uBC14\uD0D5\uC73C\uB85C \n    \uC804\uBB38\uC801\uC778 \uBD84\uC11D\uC744 \uC81C\uACF5\uD558\uBA70, \uD601\uC2E0\uC801\uC778 \uAD6C\uC870\uB85C \uCC28\uBCC4\uD654\uD558\uC138\uC694.";
                uniquenessScore = 85;
                return [2 /*return*/, {
                        competitors: mockCompetitors,
                        commonPatterns: commonPatterns,
                        differentiationStrategy: differentiationStrategy,
                        recommendedApproach: recommendedApproach,
                        uniquenessScore: uniquenessScore
                    }];
            });
        });
    };
    return CompetitorAnalyzer;
}());
exports.CompetitorAnalyzer = CompetitorAnalyzer;

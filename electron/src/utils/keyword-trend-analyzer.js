"use strict";
/**
 * 키워드 급상승 이유 분석 유틸리티
 * 네이버 뉴스/블로그 검색을 통해 키워드가 급상승한 이유 파악
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
exports.analyzeKeywordTrendingReason = analyzeKeywordTrendingReason;
var naver_crawler_1 = require("../naver-crawler");
var environment_manager_1 = require("./environment-manager");
/**
 * 키워드 급상승 이유 분석
 */
function analyzeKeywordTrendingReason(keyword, keywordData) {
    return __awaiter(this, void 0, void 0, function () {
        var defaultData, envManager, env, clientId, clientSecret, recentNews, newsResults, error_1, growthRate, searchVolume, documentCount, trendingReason_1, whyNow_1, titles, descriptions, fullText, trendingReason, whyNow, defaultReason, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    defaultData = keywordData || { searchVolume: 3000, documentCount: 500, growthRate: 100 };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    envManager = environment_manager_1.EnvironmentManager.getInstance();
                    env = envManager.getConfig();
                    clientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
                    clientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';
                    recentNews = [];
                    if (!(clientId && clientSecret)) return [3 /*break*/, 5];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, naver_crawler_1.searchNaverWithApi)(keyword, { customerId: clientId, secretKey: clientSecret }, 'news', { timeout: 5000, retries: 1 })];
                case 3:
                    newsResults = _a.sent();
                    recentNews = newsResults.slice(0, 5);
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    // API 실패해도 계속 진행 (다른 소스에서 정보 추출)
                    console.warn("[TREND-ANALYZER] \uB124\uC774\uBC84 \uB274\uC2A4 \uAC80\uC0C9 \uC2E4\uD328:", error_1.message);
                    return [3 /*break*/, 5];
                case 5:
                    // API 실패 또는 뉴스 없음 시에도 기본 정보 제공
                    if (recentNews.length === 0) {
                        growthRate = defaultData.growthRate || 0;
                        searchVolume = defaultData.searchVolume || 0;
                        documentCount = defaultData.documentCount || 0;
                        trendingReason_1 = '';
                        if (growthRate > 200) {
                            trendingReason_1 = "\uAC80\uC0C9\uB7C9\uC774 ".concat(Math.round(growthRate), "% \uAE09\uC0C1\uC2B9\uD558\uBA70 \uC2E4\uC2DC\uAC04 \uC774\uC288\uD654 \uC9C4\uD589 \uC911");
                        }
                        else if (growthRate > 100) {
                            trendingReason_1 = "\uAC80\uC0C9\uB7C9\uC774 ".concat(Math.round(growthRate), "% \uC99D\uAC00\uD558\uBA70 \uC8FC\uBAA9\uB3C4 \uC0C1\uC2B9 \uC911");
                        }
                        else if (searchVolume > 5000) {
                            trendingReason_1 = "\uC6D4 \uAC80\uC0C9\uB7C9 ".concat(searchVolume.toLocaleString(), "\uD68C\uB85C \uB192\uC740 \uAD00\uC2EC\uB3C4 \uC720\uC9C0 \uC911");
                        }
                        else {
                            trendingReason_1 = '최근 검색 트렌드 급상승 중';
                        }
                        whyNow_1 = generateDefaultWhyNow(defaultData);
                        if (documentCount < 100) {
                            whyNow_1 = "\uACBD\uC7C1 \uBB38\uC11C\uAC00 ".concat(documentCount, "\uAC1C\uB85C \uB9E4\uC6B0 \uC801\uC5B4 \uC870\uAE30 \uC9C4\uC785 \uC2DC \uC0C1\uC704 \uB178\uCD9C \uD655\uB960 \uB192\uC74C \u2022 \uAC80\uC0C9\uB7C9 \uAE09\uC0C1\uC2B9 \uC911\uC73C\uB85C \uD2B8\uB798\uD53D \uC720\uC785 \uC7A0\uC7AC\uB825 \uD07C");
                        }
                        return [2 /*return*/, {
                                trendingReason: trendingReason_1,
                                whyNow: whyNow_1
                            }];
                    }
                    titles = recentNews.map(function (n) { return n.title; }).join(' ');
                    descriptions = recentNews.map(function (n) { return n.description || ''; }).join(' ');
                    fullText = titles + ' ' + descriptions;
                    trendingReason = extractTrendingReason(keyword, fullText, recentNews);
                    whyNow = extractWhyNow(keyword, fullText, recentNews);
                    defaultReason = trendingReason || extractReasonFromTitles(recentNews) || '최근 뉴스에서 이슈화';
                    return [2 /*return*/, {
                            trendingReason: defaultReason,
                            whyNow: whyNow || generateDefaultWhyNow(defaultData)
                        }];
                case 6:
                    error_2 = _a.sent();
                    console.warn("[TREND-ANALYZER] \uD0A4\uC6CC\uB4DC \"".concat(keyword, "\" \uBD84\uC11D \uC2E4\uD328:"), error_2.message);
                    return [2 /*return*/, {
                            trendingReason: '최근 검색 트렌드 급상승 중 (상세 분석 실패)',
                            whyNow: generateDefaultWhyNow(defaultData)
                        }];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * 급상승 이유 추출 (강화 버전 - 실제 사건/이슈 중심)
 */
function extractTrendingReason(keyword, text, news) {
    // 최상위 뉴스 제목에서 구체적인 이유 추출
    if (news.length > 0 && news[0]) {
        var topTitle = news[0].title || '';
        var topDesc = news[0].description || '';
        // 제목에서 핵심 이슈 추출
        var reason = '';
        // 패턴 1: 구체적 사건 추출 (인물명 + 사건)
        // 예: "머스크 '1조달러 보상안'", "김성태 날...수원지검" 같은 핵심 키워드 추출
        var specificEventPatterns = [
            // 인물명 + 사건/발표/확인 등
            /([가-힣A-Za-z]{2,15})\s*['""]?([가-힣A-Za-z0-9\s]{3,30})['""]?\s*(?:발표|공개|확인|밝혀|알려|제안|제시|공약|선언|발언|주장)/g,
            // 인물명 + 금액/수치 관련
            /([가-힣A-Za-z]{2,15})\s*['""]?([0-9조억만원달러]{2,20})['""]?\s*(?:보상|지원|투자|기부|보상안|지원안)/g,
            // 사건/이슈 + 장소/기관
            /([가-힣]{2,10})\s*(?:날|사건|논란|이슈)\s*\.\.\.\s*([가-힣]{2,15})/g,
            // 일반 사건 패턴
            /([가-힣A-Za-z]{2,15})\s*(?:발표|공개|확인|밝혀|알려|공개|오픈|출시|런칭|시작|개막|발견|제안|제시|공약|선언|발언|주장)/g,
            /([가-힣A-Za-z]{2,15})\s*(?:사건|사고|소식|이슈|논란|논쟁|쟁점|보상안|지원안|정책|법안)/g,
        ];
        for (var _i = 0, specificEventPatterns_1 = specificEventPatterns; _i < specificEventPatterns_1.length; _i++) {
            var pattern = specificEventPatterns_1[_i];
            var matches = Array.from(topTitle.matchAll(pattern));
            if (matches && matches.length > 0) {
                // 첫 번째 매치에서 핵심 키워드 추출
                var match = matches[0];
                if (match && match.length >= 2) {
                    // 인물명 + 사건 조합 추출
                    if (match.length >= 3 && match[1] && match[2]) {
                        reason = "".concat(match[1], " '").concat(match[2], "'");
                    }
                    else if (match[1]) {
                        reason = match[1] + (match[2] ? ' ' + match[2] : '');
                    }
                    // 키워드와 중복되는 부분 제거
                    reason = reason.replace(new RegExp(keyword, 'gi'), '').trim();
                    if (reason.length > 3 && reason.length < 50) {
                        return reason + ' 관련 최근 이슈';
                    }
                }
            }
        }
        // 패턴 2: 제목에서 핵심 키워드만 추출 (문장 전체가 아닌)
        if (!reason && topTitle.length > 10) {
            // 제목을 단어로 분리
            var titleWords = topTitle
                .replace(/[\/\#\:\-\[\]()【】「」<>|]/g, ' ')
                .split(/\s+/)
                .filter(function (w) { return w.trim().length > 1; });
            // 키워드 제외하고 핵심 단어만 추출
            var coreWords = titleWords
                .filter(function (w) {
                var wLower = w.toLowerCase();
                // 불필요한 단어 제외
                var stopWords = ['뉴스', '속보', '기사', '보도', '관련', '이슈', '논란', '사건', '확인', '발표', '공개'];
                if (stopWords.some(function (sw) { return wLower.includes(sw); }))
                    return false;
                // 키워드와 동일한 단어 제외
                if (wLower === keyword.toLowerCase())
                    return false;
                // 숫자만 있는 경우 제외
                if (/^\d+$/.test(w))
                    return false;
                return true;
            })
                .slice(0, 3); // 최대 3개 단어만
            if (coreWords.length >= 2) {
                // 핵심 키워드 조합 (예: "머스크 '1조달러 보상안'")
                reason = coreWords.join(' ');
                // 따옴표가 있으면 유지
                if (topTitle.includes("'") || topTitle.includes('"')) {
                    var quotedMatch = topTitle.match(/['"]([^'"]{3,30})['"]/);
                    if (quotedMatch) {
                        reason = "".concat(coreWords[0], " '").concat(quotedMatch[1], "'");
                    }
                }
                if (reason.length >= 5 && reason.length <= 50) {
                    return reason + ' 관련 최근 이슈';
                }
            }
        }
        // 패턴 3: 설명에서 핵심 추출
        if (!reason && topDesc && topDesc.length > 20) {
            // 설명에서도 핵심 키워드만 추출
            var descWords = topDesc
                .split(/[\.\s]/)
                .filter(function (w) { return w.length > 2 && w.length < 15; })
                .filter(function (w) { return !/^(뉴스|속보|기사|보도|관련|이슈|논란|사건|확인|발표|공개)$/.test(w); })
                .slice(0, 3)
                .join(' ');
            if (descWords.length > 5 && descWords.length < 50) {
                reason = descWords;
                return reason + ' 관련 최근 이슈';
            }
        }
        // 패턴 4: 여러 뉴스 제목에서 공통 핵심 키워드 추출
        if (!reason && news.length >= 2) {
            var titles = news.slice(0, 3).map(function (n) { return n.title || ''; }).join(' ');
            var commonWords = extractCommonKeywords(titles, keyword);
            if (commonWords.length > 0) {
                // 핵심 키워드만 조합 (최대 2-3개)
                var coreKeywords = commonWords.slice(0, 2).join(' ');
                reason = coreKeywords;
                if (reason.length >= 5 && reason.length <= 50) {
                    return reason + ' 관련 이슈';
                }
            }
        }
        if (reason) {
            // 최종 정제
            reason = reason.replace(/^[^\w가-힣]+/, '').replace(/[^\w가-힣]+$/, '').trim();
            if (reason.length >= 5 && reason.length <= 50) {
                return reason + ' 관련 최근 이슈';
            }
        }
    }
    // 기본 패턴 분석 (더 구체적으로)
    var patterns = [
        /(발표|공개|발견|확인|밝혀|알려|오픈|출시|런칭|시작|개막|제안|제시|공약|선언|발언|주장)/g,
        /(사건|사고|소식|이슈|논란|논쟁|쟁점|보상안|지원안|정책|법안)/g,
    ];
    var matchedPatterns = [];
    for (var _a = 0, patterns_1 = patterns; _a < patterns_1.length; _a++) {
        var pattern = patterns_1[_a];
        var matches = text.match(pattern);
        if (matches && matches.length > 0) {
            matchedPatterns.push.apply(matchedPatterns, matches);
        }
    }
    if (matchedPatterns.length > 0) {
        var uniquePatterns = __spreadArray([], new Set(matchedPatterns), true).slice(0, 2);
        // 패턴 앞뒤로 핵심 키워드 추출 시도
        var contextWords = [];
        for (var _b = 0, uniquePatterns_1 = uniquePatterns; _b < uniquePatterns_1.length; _b++) {
            var pattern = uniquePatterns_1[_b];
            var patternIndex = text.indexOf(pattern);
            if (patternIndex > 0) {
                var beforeText = text.substring(Math.max(0, patternIndex - 15), patternIndex).trim();
                var words = beforeText.split(/\s+/).filter(function (w) { return w.length > 2 && w.length < 10; });
                if (words.length > 0) {
                    var lastWord = words[words.length - 1];
                    if (lastWord) {
                        contextWords.push(lastWord);
                    }
                }
            }
        }
        if (contextWords.length > 0) {
            return "".concat(contextWords[0], " ").concat(uniquePatterns[0], " \uAD00\uB828 \uCD5C\uADFC \uC774\uC288");
        }
        return "".concat(uniquePatterns.join(', '), " \uAD00\uB828 \uCD5C\uADFC \uC774\uC288");
    }
    return '최근 검색 트렌드 급상승 중';
}
/**
 * 공통 키워드 추출
 */
function extractCommonKeywords(text, excludeKeyword) {
    var words = text.split(/\s+/).filter(function (w) {
        var wTrimmed = w.trim();
        if (wTrimmed.length < 2)
            return false;
        if (wTrimmed === excludeKeyword)
            return false;
        if (/^\d+$/.test(wTrimmed))
            return false;
        return true;
    });
    // 단어 빈도 계산
    var wordCount = {};
    words.forEach(function (w) {
        wordCount[w] = (wordCount[w] || 0) + 1;
    });
    // 2번 이상 나온 단어만 반환
    return Object.entries(wordCount)
        .filter(function (_a) {
        var _ = _a[0], count = _a[1];
        return count >= 2;
    })
        .sort(function (_a, _b) {
        var _ = _a[0], a = _a[1];
        var __ = _b[0], b = _b[1];
        return b - a;
    })
        .slice(0, 5)
        .map(function (_a) {
        var word = _a[0], _ = _a[1];
        return word;
    });
}
/**
 * 뉴스 제목에서 직접 이유 추출
 */
function extractReasonFromTitles(news) {
    if (news.length === 0 || !news[0])
        return '';
    // 최상위 뉴스 제목에서 핵심 문구 추출
    var topTitle = news[0].title || '';
    if (!topTitle)
        return '';
    // 제목이 너무 길면 앞부분만
    if (topTitle.length > 60) {
        return "\"".concat(topTitle.substring(0, 60), "...\" \uAD00\uB828 \uB274\uC2A4 \uC99D\uAC00");
    }
    // 제목에서 핵심 문구 추출 (키워드 제외)
    var titleWords = topTitle.split(/[·\s\-_]/).filter(function (w) { return w.length > 2; });
    if (titleWords.length > 2) {
        var coreWords = titleWords.slice(0, 3).join(' ');
        return "\"".concat(coreWords, "\" \uAD00\uB828 \uCD5C\uADFC \uC774\uC288");
    }
    return "\"".concat(topTitle, "\" \uAD00\uB828 \uCD5C\uADFC \uB274\uC2A4 \uC99D\uAC00");
}
/**
 * 왜 지금 쓰면 좋은지 추출 (강화 버전)
 */
function extractWhyNow(keyword, text, news) {
    var reasons = [];
    // 1. 최근 뉴스 타이밍 및 이슈화 정도
    if (news.length >= 5) {
        reasons.push("\uCD5C\uADFC ".concat(news.length, "\uAC1C \uC774\uC0C1\uC758 \uB274\uC2A4\uC5D0\uC11C \uB2E4\uB904\uC9C0\uBA70 \uC774\uC288\uD654 \uC9C4\uD589 \uC911"));
    }
    else if (news.length >= 3) {
        reasons.push('최근 3개 이상의 뉴스에서 다뤄지며 주목도 상승 중');
    }
    else if (news.length >= 1) {
        reasons.push('최근 뉴스에서 이슈화되며 검색량 급증 중');
    }
    // 2. 구체적인 사건/이슈 언급
    var eventKeywords = ['발표', '공개', '확인', '밝혀', '사건', '사고', '논란', '이슈', '출시', '런칭'];
    var hasEvent = eventKeywords.some(function (word) { return text.includes(word); });
    if (hasEvent) {
        var eventWord = eventKeywords.find(function (word) { return text.includes(word); });
        reasons.push("\"".concat(eventWord, "\" \uAD00\uB828 \uAD6C\uCCB4\uC801 \uC0AC\uAC74\uC73C\uB85C \uC2E4\uC2DC\uAC04 \uAD00\uC2EC \uC9D1\uC911"));
    }
    // 3. 검색 트렌드 키워드 포함 여부
    var trendingWords = ['급상승', '화제', '인기', '주목', '이슈', '관심', '논란', '충격', '폭발', '급증'];
    var foundTrendingWords = trendingWords.filter(function (word) { return text.includes(word); });
    if (foundTrendingWords.length > 0) {
        reasons.push("\uB274\uC2A4\uC5D0\uC11C \"".concat(foundTrendingWords[0], "\" \uD0A4\uC6CC\uB4DC\uB85C \uC5B8\uAE09\uB418\uBA70 \uD654\uC81C\uC131 \uD655\uBCF4"));
    }
    // 4. 시기적절성
    var timeKeywords = ['오늘', '당일', '실시간', '급', '신규', '최신'];
    var hasTimeKeyword = timeKeywords.some(function (word) { return text.includes(word); });
    if (hasTimeKeyword) {
        reasons.push('최신 이슈로 실시간 관심 집중 중');
    }
    // 5. 뉴스 제목에서 구체적 이유 추출
    if (news.length > 0 && news[0]) {
        var topTitle = news[0].title || '';
        // 제목에서 핵심 문구 추출 (키워드 제외)
        var titleWithoutKeyword = topTitle.replace(new RegExp(keyword, 'gi'), '').trim();
        if (titleWithoutKeyword.length > 5 && titleWithoutKeyword.length < 40) {
            reasons.push("\"".concat(titleWithoutKeyword.substring(0, 40), "\" \uAD00\uB828 \uCD5C\uC2E0 \uB274\uC2A4\uB85C \uC870\uAE30 \uC9C4\uC785 \uD6A8\uACFC \uAE30\uB300"));
        }
    }
    // 기본 이유 추가 (구체적으로)
    if (reasons.length === 0) {
        reasons.push('검색량 급상승 중으로 조기 진입 시 상위 노출 가능성 높음');
        reasons.push('경쟁 문서가 적어 노출 확률이 높음');
    }
    return reasons.join(' • ');
}
/**
 * 기본 "왜 지금 쓰면 좋은지" 생성
 */
function generateDefaultWhyNow(keywordData) {
    var searchVolume = keywordData.searchVolume || 1000;
    var documentCount = keywordData.documentCount || 100;
    var growthRate = keywordData.growthRate || 0;
    var reasons = [];
    if (growthRate > 100) {
        reasons.push("\uAC80\uC0C9\uB7C9\uC774 ".concat(Math.round(growthRate), "% \uAE09\uC0C1\uC2B9 \uC911"));
    }
    if (documentCount < 100) {
        reasons.push('경쟁 문서가 매우 적어 조기 진입 시 상위 노출 확률 높음');
    }
    else if (documentCount < 500) {
        reasons.push('경쟁 문서가 적어 노출 가능성 높음');
    }
    if (searchVolume > 5000) {
        reasons.push('검색량이 높아 트래픽 유입 잠재력 큼');
    }
    if (reasons.length === 0) {
        reasons.push('검색 트렌드 상승 중으로 조기 진입 효과 기대');
    }
    return reasons.join(' • ');
}

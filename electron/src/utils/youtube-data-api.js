"use strict";
/**
 * YouTube Data API v3를 사용한 트렌드 키워드 수집
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYouTubeTrendKeywords = getYouTubeTrendKeywords;
exports.extractYouTubeTrendingKeywords = extractYouTubeTrendingKeywords;
/**
 * YouTube 트렌드 키워드 수집 (오늘 기준 핫한 영상 제목 추출)
 */
function getYouTubeTrendKeywords(config) {
    return __awaiter(this, void 0, void 0, function () {
        var maxResults, filterRising, regionCode, videosWithStats, searchApiUrl, now, oneDayAgo, publishedAfter, newsCategoryId, generalQueries, _loop_1, _i, _a, query, newsError_1, trendingApiUrl, trendingParams, trendingResponse, trendingData, trendingVideos, existingIds_1, newVideos, trendingError_1, filteredVideos, finalResults, keywords, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    maxResults = config.maxResults || 25;
                    filterRising = config.filterRising !== false;
                    regionCode = config.regionCode || 'KR';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 15, , 16]);
                    console.log('[YOUTUBE-API] 오늘 기준 핫한 영상 제목 추출 시작');
                    videosWithStats = [];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 7, , 8]);
                    searchApiUrl = 'https://www.googleapis.com/youtube/v3/search';
                    now = new Date();
                    oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    publishedAfter = oneDayAgo.toISOString();
                    newsCategoryId = '25';
                    generalQueries = ['', '오늘', '최신', '인기', '화제'];
                    _loop_1 = function (query) {
                        var searchParams, searchResponse, searchData, videoIds, videosApiUrl, videosParams, videosResponse, videosData, newsVideos, existingIds_2, newVideos, queryError_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 6, , 7]);
                                    searchParams = new URLSearchParams({
                                        part: 'snippet',
                                        type: 'video',
                                        maxResults: '20', // 각 검색어당 20개
                                        order: 'viewCount', // 조회수순 정렬
                                        publishedAfter: publishedAfter,
                                        regionCode: regionCode,
                                        videoCategoryId: newsCategoryId, // 뉴스 & 정치 카테고리 (카테고리 중심)
                                        key: config.apiKey
                                    });
                                    // 검색어가 있을 때만 q 파라미터 추가
                                    if (query) {
                                        searchParams.append('q', query);
                                    }
                                    return [4 /*yield*/, fetch("".concat(searchApiUrl, "?").concat(searchParams))];
                                case 1:
                                    searchResponse = _c.sent();
                                    if (!searchResponse.ok) return [3 /*break*/, 5];
                                    return [4 /*yield*/, searchResponse.json()];
                                case 2:
                                    searchData = _c.sent();
                                    videoIds = (searchData.items || []).map(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.videoId; }).filter(Boolean);
                                    if (!(videoIds.length > 0)) return [3 /*break*/, 5];
                                    videosApiUrl = 'https://www.googleapis.com/youtube/v3/videos';
                                    videosParams = new URLSearchParams({
                                        part: 'snippet,statistics',
                                        id: videoIds.join(','),
                                        key: config.apiKey
                                    });
                                    return [4 /*yield*/, fetch("".concat(videosApiUrl, "?").concat(videosParams))];
                                case 3:
                                    videosResponse = _c.sent();
                                    if (!videosResponse.ok) return [3 /*break*/, 5];
                                    return [4 /*yield*/, videosResponse.json()];
                                case 4:
                                    videosData = _c.sent();
                                    newsVideos = (videosData.items || []).map(function (item) {
                                        var _a, _b, _c, _d, _e, _f;
                                        var viewCount = parseInt(((_a = item.statistics) === null || _a === void 0 ? void 0 : _a.viewCount) || '0', 10);
                                        var publishedAt = ((_b = item.snippet) === null || _b === void 0 ? void 0 : _b.publishedAt) || '';
                                        var publishedDate = publishedAt ? new Date(publishedAt) : new Date();
                                        var hoursSincePublished = Math.max(1, (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60));
                                        var viewsPerHour = viewCount / hoursSincePublished;
                                        var categoryId = ((_c = item.snippet) === null || _c === void 0 ? void 0 : _c.categoryId) || '';
                                        return {
                                            id: item.id,
                                            title: ((_d = item.snippet) === null || _d === void 0 ? void 0 : _d.title) || '',
                                            channelTitle: ((_e = item.snippet) === null || _e === void 0 ? void 0 : _e.channelTitle) || '',
                                            viewCount: viewCount,
                                            viewCountStr: ((_f = item.statistics) === null || _f === void 0 ? void 0 : _f.viewCount) || '0',
                                            publishedAt: publishedAt,
                                            viewsPerHour: viewsPerHour,
                                            categoryId: categoryId,
                                            isNews: categoryId === '25' // 뉴스 & 정치 카테고리만 포함
                                        };
                                    });
                                    existingIds_2 = new Set(videosWithStats.map(function (v) { return v.id; }));
                                    newVideos = newsVideos.filter(function (v) { return !existingIds_2.has(v.id); });
                                    videosWithStats.push.apply(videosWithStats, newVideos);
                                    _c.label = 5;
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    queryError_1 = _c.sent();
                                    console.warn("[YOUTUBE-API] \"".concat(query, "\" \uAC80\uC0C9 \uC2E4\uD328:"), queryError_1.message);
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = generalQueries.slice(0, 5);
                    _b.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    query = _a[_i];
                    return [5 /*yield**/, _loop_1(query)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("[YOUTUBE-API] \uB274\uC2A4 \uC601\uC0C1 ".concat(videosWithStats.length, "\uAC1C \uC218\uC9D1"));
                    return [3 /*break*/, 8];
                case 7:
                    newsError_1 = _b.sent();
                    console.warn('[YOUTUBE-API] 뉴스 영상 조회 실패:', newsError_1.message);
                    return [3 /*break*/, 8];
                case 8:
                    if (!(videosWithStats.length < maxResults)) return [3 /*break*/, 14];
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 13, , 14]);
                    trendingApiUrl = 'https://www.googleapis.com/youtube/v3/videos';
                    trendingParams = new URLSearchParams({
                        part: 'snippet,statistics',
                        chart: 'mostPopular',
                        regionCode: regionCode,
                        videoCategoryId: '25', // 뉴스 카테고리만
                        maxResults: String(Math.min(maxResults - videosWithStats.length, 50)),
                        key: config.apiKey
                    });
                    return [4 /*yield*/, fetch("".concat(trendingApiUrl, "?").concat(trendingParams))];
                case 10:
                    trendingResponse = _b.sent();
                    if (!trendingResponse.ok) return [3 /*break*/, 12];
                    return [4 /*yield*/, trendingResponse.json()];
                case 11:
                    trendingData = _b.sent();
                    if (trendingData.items && trendingData.items.length > 0) {
                        trendingVideos = trendingData.items.map(function (item) {
                            var _a, _b, _c, _d, _e, _f;
                            var viewCount = parseInt(((_a = item.statistics) === null || _a === void 0 ? void 0 : _a.viewCount) || '0', 10);
                            var publishedAt = ((_b = item.snippet) === null || _b === void 0 ? void 0 : _b.publishedAt) || '';
                            var publishedDate = publishedAt ? new Date(publishedAt) : new Date();
                            var hoursSincePublished = Math.max(1, (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60));
                            var viewsPerHour = viewCount / hoursSincePublished;
                            return {
                                id: item.id,
                                title: ((_c = item.snippet) === null || _c === void 0 ? void 0 : _c.title) || '',
                                channelTitle: ((_d = item.snippet) === null || _d === void 0 ? void 0 : _d.channelTitle) || '',
                                viewCount: viewCount,
                                viewCountStr: ((_e = item.statistics) === null || _e === void 0 ? void 0 : _e.viewCount) || '0',
                                publishedAt: publishedAt,
                                viewsPerHour: viewsPerHour,
                                categoryId: ((_f = item.snippet) === null || _f === void 0 ? void 0 : _f.categoryId) || '',
                                isNews: true
                            };
                        });
                        existingIds_1 = new Set(videosWithStats.map(function (v) { return v.id; }));
                        newVideos = trendingVideos.filter(function (v) { return !existingIds_1.has(v.id); });
                        videosWithStats.push.apply(videosWithStats, newVideos);
                        console.log("[YOUTUBE-API] \uD2B8\uB80C\uB529 \uB274\uC2A4 \uC601\uC0C1 \uCD94\uAC00, \uCD1D ".concat(videosWithStats.length, "\uAC1C"));
                    }
                    _b.label = 12;
                case 12: return [3 /*break*/, 14];
                case 13:
                    trendingError_1 = _b.sent();
                    console.warn('[YOUTUBE-API] 트렌딩 뉴스 영상 조회 실패:', trendingError_1.message);
                    return [3 /*break*/, 14];
                case 14:
                    filteredVideos = videosWithStats.filter(function (v) { return v.isNews || v.categoryId === '25'; });
                    // 조회수순으로 정렬 (내림차순)
                    filteredVideos.sort(function (a, b) {
                        return (b.viewCount || 0) - (a.viewCount || 0);
                    });
                    videosWithStats = filteredVideos;
                    finalResults = videosWithStats.slice(0, Math.max(maxResults, 20));
                    keywords = finalResults.map(function (item, index) {
                        var title = item.title || '';
                        // 제목에서 핵심 키워드 추출 (태그 제거, 불필요한 단어 제거)
                        // 오늘 기준 핫한 영상 제목을 그대로 사용하되, 불필요한 태그만 제거
                        var keyword = title
                            .replace(/\[.*?\]/g, '') // [ ] 안 내용 제거
                            .replace(/\(.*?\)/g, '') // ( ) 안 내용 제거
                            .replace(/【.*?】/g, '') // 【 】 안 내용 제거
                            .replace(/\|/g, ' ') // 구분자 제거
                            .replace(/\s+/g, ' ') // 공백 정리
                            .trim();
                        // 제목이 너무 길면 첫 40자만 사용 (키워드 추출을 위해 더 길게 허용)
                        if (keyword.length > 40) {
                            keyword = keyword.substring(0, 40).trim();
                            // 마지막 단어가 잘리면 제거
                            var lastSpace = keyword.lastIndexOf(' ');
                            if (lastSpace > 0) {
                                keyword = keyword.substring(0, lastSpace);
                            }
                        }
                        // 키워드가 비어있으면 기본값 사용
                        if (!keyword || keyword.length < 2) {
                            keyword = title.substring(0, 30).trim() || '키워드';
                        }
                        var viewCount = item.viewCount || 0;
                        // 급상승 지표 계산 (시간당 조회수 기반, 트렌딩 영상은 더 높게)
                        var viewsPerHour = item.viewsPerHour || 0;
                        var changeRate = Math.min(200, Math.floor(viewsPerHour / 1000) * 10 + 30);
                        // 트렌딩 영상은 기본적으로 높은 변화율 부여
                        if (item.isTrending) {
                            changeRate = Math.min(200, changeRate + 50);
                        }
                        return {
                            keyword: keyword,
                            rank: index + 1,
                            viewCount: viewCount,
                            changeRate: changeRate,
                            videoId: item.id,
                            videoTitle: title,
                            channelTitle: item.channelTitle,
                            publishedAt: item.publishedAt
                        };
                    });
                    console.log("[YOUTUBE-API] \uC624\uB298 \uAE30\uC900 \uD56B\uD55C \uC601\uC0C1 \uC81C\uBAA9 ".concat(keywords.length, "\uAC1C \uCD94\uCD9C \uC644\uB8CC"));
                    return [2 /*return*/, keywords];
                case 15:
                    error_1 = _b.sent();
                    console.error('[YOUTUBE-API] API 호출 실패:', error_1);
                    throw error_1;
                case 16: return [2 /*return*/];
            }
        });
    });
}
/**
 * YouTube 트렌드 영상 제목에서 키워드 추출 (빈도수 기반)
 * 제공된 코드를 참고하여 구현
 */
function extractYouTubeTrendingKeywords(config) {
    return __awaiter(this, void 0, void 0, function () {
        var trendKeywords, allKeywords_1, frequency_1, sortedKeywords, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('[YOUTUBE-API] 트렌드 영상 제목에서 키워드 추출 시작');
                    return [4 /*yield*/, getYouTubeTrendKeywords(config)];
                case 1:
                    trendKeywords = _a.sent();
                    allKeywords_1 = [];
                    trendKeywords.forEach(function (item) {
                        var title = item.videoTitle || '';
                        if (!title || title.length < 3)
                            return;
                        // HTML 태그 제거
                        var cleanTitle = title.replace(/<[^>]*>/g, '').trim();
                        // 제목을 단어로 분리 (제공된 코드 참고)
                        var words = cleanTitle
                            .split(/[\s\[\]\(\)｜|/\-:·]+/)
                            .map(function (w) { return w.trim(); })
                            .filter(function (word) {
                            return (word.length >= 2 &&
                                word.length <= 15 &&
                                !/^\d+$/.test(word) && // 숫자만 있는 것 제외
                                !/^[a-z]+$/i.test(word) || word.length >= 3 // 영문 단일 단어는 3자 이상
                            );
                        })
                            .filter(function (word) {
                            // 불필요한 단어 제외 (일부만 제외하여 더 많은 키워드 추출)
                            var stopWords = ['영상', '동영상', '비디오', '보기', '시청', '구독', '좋아요', '클릭', '알림설정'];
                            return !stopWords.includes(word);
                        });
                        // 2-3단어 조합도 추가 (뉴스/이슈 관련 키워드 우선)
                        if (words.length >= 2) {
                            // 핵심 키워드가 포함된 조합 우선 추가
                            var hasNewsKeyword = words.some(function (w) { return ['뉴스', '이슈', '속보', '화제', '사건', '논란', '발표', '공개'].includes(w); });
                            if (hasNewsKeyword || words.length >= 2) {
                                var phrase2 = words.slice(0, 2).join(' ');
                                if (phrase2.length >= 4 && phrase2.length <= 20) {
                                    allKeywords_1.push(phrase2);
                                }
                                if (words.length >= 3) {
                                    var phrase3 = words.slice(0, 3).join(' ');
                                    if (phrase3.length >= 4 && phrase3.length <= 25) {
                                        allKeywords_1.push(phrase3);
                                    }
                                }
                            }
                        }
                        // 개별 단어 추가 (더 많이 포함)
                        words.slice(0, 8).forEach(function (word) {
                            if (word.length >= 2 && word.length <= 15) {
                                allKeywords_1.push(word);
                            }
                        });
                    });
                    frequency_1 = {};
                    allKeywords_1.forEach(function (keyword) {
                        var lower = keyword.toLowerCase().trim();
                        if (lower.length > 0) {
                            frequency_1[lower] = (frequency_1[lower] || 0) + 1;
                        }
                    });
                    sortedKeywords = Object.entries(frequency_1)
                        .sort(function (a, b) { return b[1] - a[1]; })
                        .slice(0, 20)
                        .map(function (_a) {
                        var keyword = _a[0];
                        return keyword;
                    });
                    console.log("[YOUTUBE-API] ".concat(sortedKeywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC644\uB8CC"));
                    return [2 /*return*/, sortedKeywords];
                case 2:
                    error_2 = _a.sent();
                    console.error('[YOUTUBE-API] 키워드 추출 실패:', error_2);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}

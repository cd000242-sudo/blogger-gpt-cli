"use strict";
/**
 * 다음(Daum) 실시간 검색어 API 유틸리티
 * Puppeteer를 사용하여 실제 다음 메인 페이지를 크롤링
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
exports.getDaumRealtimeKeywordsWithPuppeteer = getDaumRealtimeKeywordsWithPuppeteer;
/**
 * Puppeteer를 사용하여 다음 실시간 검색어 크롤링
 */
function getDaumRealtimeKeywordsWithPuppeteer() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var browser, puppeteer, page, daumUrl, e_1, keywords, realtimeKeywords, error_1, e_2;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    browser = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 15, 16, 21]);
                    console.log('[DAUM-REALTIME] 다음 실시간 검색어 크롤링 시작 (Puppeteer)');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('puppeteer'); })];
                case 2:
                    puppeteer = _a.sent();
                    console.log('[DAUM-REALTIME] 브라우저 실행 중...');
                    return [4 /*yield*/, puppeteer.default.launch({
                            headless: 'new',
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-blink-features=AutomationControlled',
                                '--disable-dev-shm-usage'
                            ]
                        })];
                case 3:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 4:
                    page = _a.sent();
                    // User-Agent 설정
                    return [4 /*yield*/, page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')];
                case 5:
                    // User-Agent 설정
                    _a.sent();
                    // 언어 설정
                    return [4 /*yield*/, page.setExtraHTTPHeaders({
                            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                        })];
                case 6:
                    // 언어 설정
                    _a.sent();
                    daumUrl = 'https://www.daum.net/';
                    console.log('[DAUM-REALTIME] 페이지 로딩 중:', daumUrl);
                    return [4 /*yield*/, page.goto(daumUrl, {
                            waitUntil: 'networkidle0', // 모든 네트워크 요청이 완료될 때까지 대기 (동적 콘텐츠 로딩 보장)
                            timeout: 30000 // 30초로 증가 (동적 콘텐츠 로딩 대기)
                        })];
                case 7:
                    _a.sent();
                    // 페이지 로딩 대기 (동적 콘텐츠 로딩을 위해 충분한 시간 확보)
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 8:
                    // 페이지 로딩 대기 (동적 콘텐츠 로딩을 위해 충분한 시간 확보)
                    _a.sent();
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    // 다음 실시간 검색어 섹션의 다양한 선택자 시도
                    return [4 /*yield*/, page.waitForSelector('#issueKeyword, #realtimeKeyword, .realtime_keyword, .issue_keyword, .list_issue, [class*="issue"], [id*="issue"], [data-tiara-id*="issue"], [data-tiara-id*="keyword"], a[href*="/search?q="], .rank_issue, .rank_keyword', { timeout: 8000 } // 8초로 증가 (동적 콘텐츠 로딩 대기)
                        )];
                case 10:
                    // 다음 실시간 검색어 섹션의 다양한 선택자 시도
                    _a.sent();
                    console.log('[DAUM-REALTIME] 실시간 검색어 섹션 요소 발견');
                    return [3 /*break*/, 12];
                case 11:
                    e_1 = _a.sent();
                    console.log('[DAUM-REALTIME] 실시간 검색어 섹션 선택자 대기 실패 (계속 진행)');
                    return [3 /*break*/, 12];
                case 12: 
                // 추가 대기 (JavaScript로 동적 로딩되는 경우 대비)
                return [4 /*yield*/, page.waitForTimeout(2000)];
                case 13:
                    // 추가 대기 (JavaScript로 동적 로딩되는 경우 대비)
                    _a.sent();
                    console.log('[DAUM-REALTIME] 페이지 크롤링 중...');
                    return [4 /*yield*/, page.evaluate(function (maxLimit) {
                            var result = [];
                            var allKeywords = new Set(); // 중복 방지를 위한 Set
                            // 제외할 텍스트 패턴 (강화)
                            var excludePatterns = [
                                /^더보기$/i,
                                /^전체보기$/i,
                                /^검색$/i,
                                /^다음$/i,
                                /^DAUM$/i,
                                /^로그인$/i,
                                /^회원가입$/i,
                                /^메일$/i,
                                /^카페$/i,
                                /^블로그$/i,
                                /^뉴스$/i,
                                /^지도$/i,
                                /^쇼핑$/i,
                                /^영화$/i,
                                /^웹툰$/i,
                                /^실시간$/i,
                                /^인기$/i,
                                /^이슈$/i,
                                /.*바로가기.*/i,
                                /.*서비스.*바로가기.*/i,
                                /.*본문.*바로가기.*/i,
                                /.*홈.*화면.*설정.*/i,
                                /.*로그인.*MY정보.*/i,
                                /^설정$/i,
                                /^MY정보$/i,
                                // 다음 UI 텍스트 필터링
                                /.*오늘의.*주요.*소식.*/i,
                                /.*도움말.*보기.*/i,
                                /.*자세히.*보기.*/i,
                                /^닫기$/i,
                                /.*많이.*본.*스포츠.*/i,
                                /^오늘의$/i,
                                /^주요 소식$/i,
                                /^도움말$/i,
                                /^보기$/i,
                                /^자세히$/i,
                                /^많이 본$/i,
                                /^스포츠$/i,
                                // 다음 UI 요소 추가
                                /.*웹\s*접근성.*/i,
                                /.*안내.*/i,
                                /.*새창.*/i,
                                /.*열림.*/i,
                                /.*입력.*내용.*지우기.*/i,
                                /.*입력\s*도구.*/i,
                                /.*입력\s*도구\s*검색.*/i,
                                /^입력$/i,
                                /^내용$/i,
                                /^지우기$/i,
                                /^도구$/i,
                            ];
                            // UI 요소 필터링 키워드 (강화) - 다음 UI 텍스트 포함
                            var uiKeywords = [
                                '바로가기', '서비스 바로가기', '본문 바로가기', '홈 화면 설정',
                                '로그인', 'MY정보', '설정', '메뉴', '네비게이션',
                                '오늘의 주요 소식', '도움말보기', '자세히보기', '닫기',
                                '많이 본 스포츠', '오늘의', '주요 소식', '도움말', '보기',
                                '자세히', '많이 본', '스포츠', '닫기',
                                // 다음 UI 요소 추가
                                '웹 접근성', '안내', '새창', '열림', '입력', '내용', '지우기', '도구',
                                '웹 접근성 안내', '새창 열림', '입력 내용 지우기', '입력 도구', '입력 도구 검색'
                            ];
                            // 방법 0: 다음의 다양한 섹션에서 키워드 수집 (뉴스, 카페, 블로그, 쇼핑 등)
                            var daumSections = [
                                // 뉴스 섹션
                                '.list_news',
                                '.news_keyword',
                                '.news_issue',
                                '.news_list',
                                '[class*="news"]',
                                // 카페 섹션
                                '.cafe_keyword',
                                '.cafe_issue',
                                '[class*="cafe"]',
                                // 블로그 섹션
                                '.blog_keyword',
                                '.blog_issue',
                                '[class*="blog"]',
                                // 쇼핑 섹션
                                '.shopping_keyword',
                                '[class*="shopping"]',
                                // 인기 검색어
                                '.popular_keyword',
                                '.popular_search',
                                '[class*="popular"]',
                                // 트렌드
                                '.trend_keyword',
                                '.trending',
                                '[class*="trend"]',
                                // 브리핑
                                '.briefing',
                                '.briefing_keyword',
                                '[class*="briefing"]'
                            ];
                            console.log('[DAUM-REALTIME] 방법 0: 다양한 섹션에서 키워드 수집 시작');
                            daumSections.forEach(function (selector, sectionIndex) {
                                if (result.length >= maxLimit)
                                    return;
                                try {
                                    var sections = document.querySelectorAll(selector);
                                    sections.forEach(function (section) {
                                        if (result.length >= maxLimit)
                                            return;
                                        var links = section.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="], a[href*="keyword"]');
                                        links.forEach(function (link) {
                                            var _a;
                                            if (result.length >= maxLimit)
                                                return;
                                            var keyword = '';
                                            var href = link.href || '';
                                            var hrefMatch = href.match(/[?&]q=([^&]+)/);
                                            if (hrefMatch && hrefMatch[1]) {
                                                try {
                                                    keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                }
                                                catch (e) {
                                                    keyword = hrefMatch[1].trim();
                                                }
                                            }
                                            if (!keyword || keyword.length < 2) {
                                                keyword = ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                                keyword = keyword
                                                    .replace(/^\d+\.?\s*/, '')
                                                    .replace(/^\d+위\s*/, '')
                                                    .replace(/^위,\s*/, '')
                                                    .replace(/^▶\s*/, '')
                                                    .replace(/^▶/, '')
                                                    .replace(/^▲\s*/, '')
                                                    .replace(/^▼\s*/, '')
                                                    .replace(/^NEW\s*/i, '')
                                                    .replace(/^HOT\s*/i, '')
                                                    .replace(/\s+/g, ' ')
                                                    .trim();
                                            }
                                            if (keyword &&
                                                keyword.length >= 2 &&
                                                keyword.length <= 50 &&
                                                /[가-힣a-zA-Z0-9]/.test(keyword) &&
                                                !/^\d+$/.test(keyword) &&
                                                !['통합검색', '로그인', '로그아웃', '더보기', '전체보기'].includes(keyword)) {
                                                var keywordLower = keyword.toLowerCase();
                                                if (!allKeywords.has(keywordLower)) {
                                                    allKeywords.add(keywordLower);
                                                    result.push({
                                                        keyword: keyword,
                                                        rank: result.length + 1
                                                    });
                                                    console.log("[DAUM-REALTIME] \uC139\uC158 \"".concat(selector, "\"\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: \"").concat(keyword, "\" (").concat(result.length, "\uBC88\uC9F8)"));
                                                }
                                            }
                                        });
                                    });
                                }
                                catch (e) {
                                    // 선택자 오류 무시
                                }
                            });
                            console.log("[DAUM-REALTIME] \uB2E4\uC591\uD55C \uC139\uC158\uC5D0\uC11C ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uC218\uC9D1"));
                            // 방법 1: "실시간 검색어" 텍스트가 포함된 섹션을 명시적으로 찾기 (최우선)
                            var targetSection = null;
                            // 우선순위 1: "실시간 검색어" 텍스트가 포함된 섹션 찾기
                            var allElements = document.querySelectorAll('*');
                            for (var _i = 0, _a = Array.from(allElements); _i < _a.length; _i++) {
                                var el = _a[_i];
                                var text = el.textContent || '';
                                // "실시간 검색어" 또는 "실시간이슈" 텍스트가 정확히 포함된 섹션 찾기
                                if ((/실시간\s*검색어/i.test(text) || /실시간\s*이슈/i.test(text)) &&
                                    el.querySelectorAll('a[href*="/search"], a[href*="q="]').length >= 5) {
                                    // 부모 섹션 찾기 (실제 키워드 리스트가 있는 컨테이너)
                                    var parent_1 = el;
                                    for (var i = 0; i < 5; i++) {
                                        parent_1 = (parent_1 === null || parent_1 === void 0 ? void 0 : parent_1.parentElement) || null;
                                        if (!parent_1)
                                            break;
                                        var linkCount = parent_1.querySelectorAll('a[href*="/search"], a[href*="q="]').length;
                                        if (linkCount >= 5) {
                                            targetSection = parent_1;
                                            console.log("[DAUM-REALTIME] \"\uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4\" \uC139\uC158 \uBC1C\uACAC (\uB808\uBCA8 ".concat(i, "):"), parent_1.className || parent_1.id);
                                            break;
                                        }
                                    }
                                    if (targetSection)
                                        break;
                                }
                            }
                            // 우선순위 2: 특정 ID/클래스로 찾기
                            if (!targetSection) {
                                var issueSelectors = [
                                    // 최신 다음 페이지 구조 (실시간 검색어 전용)
                                    '#issueKeyword',
                                    '#realtimeKeyword',
                                    '#rankKeyword',
                                    '.realtime_keyword',
                                    '.realtime_keyword_list',
                                    '.rank_keyword_list',
                                    '.list_issue',
                                    '.rank_issue',
                                    '.list_issue_keyword',
                                    '.issue_keyword',
                                    '.issue_list',
                                    '[data-tiara-layer="issue"]',
                                    '[data-tiara-id*="issue"]',
                                    '[data-tiara-id*="keyword"]',
                                    '[data-tiara-id*="realtime"]',
                                    // 브리핑/트렌드 영역
                                    '.list_briefing_wrap',
                                    '.list_trend_wrap',
                                    '.list_briefing',
                                    '.list_trend',
                                    // 실시간 검색어 관련 클래스
                                    '.link_issue',
                                    '.rank_keyword',
                                    '.keyword_list'
                                ];
                                for (var _b = 0, issueSelectors_1 = issueSelectors; _b < issueSelectors_1.length; _b++) {
                                    var selector = issueSelectors_1[_b];
                                    try {
                                        var sections = document.querySelectorAll(selector);
                                        for (var _c = 0, _d = Array.from(sections); _c < _d.length; _c++) {
                                            var section = _d[_c];
                                            var sectionText = section.textContent || '';
                                            // "실시간", "이슈", "검색어" 등의 텍스트가 포함된 섹션인지 확인
                                            var hasIssueText = /실시간|이슈|검색어/i.test(sectionText);
                                            // 섹션 내에 검색 링크가 있는지 확인 (최소 5개 이상)
                                            var hasSearchLinks = section.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="]').length >= 5;
                                            if (hasIssueText && hasSearchLinks) {
                                                targetSection = section;
                                                console.log("[DAUM-REALTIME] \uC2E4\uC2DC\uAC04 \uC774\uC288 \uC139\uC158 \uBC1C\uACAC: ".concat(selector));
                                                break;
                                            }
                                        }
                                        if (targetSection)
                                            break;
                                    }
                                    catch (e) {
                                        // 선택자 오류 무시
                                    }
                                }
                            }
                            // 우선순위 2: 모든 검색 링크를 찾아서 실시간 이슈 영역인지 판단 (더 적극적으로)
                            if (!targetSection || result.length < maxLimit) {
                                console.log('[DAUM-REALTIME] 전체 페이지에서 검색 링크 찾기 (적극적 수집)');
                                // 더 넓은 범위의 검색 링크 찾기
                                var allSearchLinks = document.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="], a[href*="keyword"], a[href*="issue"]');
                                console.log("[DAUM-REALTIME] \uC804\uCCB4 \uAC80\uC0C9 \uB9C1\uD06C ".concat(allSearchLinks.length, "\uAC1C \uBC1C\uACAC"));
                                var candidates_1 = [];
                                allSearchLinks.forEach(function (link, index) {
                                    var _a;
                                    if (candidates_1.length >= maxLimit * 3)
                                        return; // 충분한 후보 수집
                                    var keyword = '';
                                    // href에서 키워드 추출 (우선순위 1)
                                    var href = link.href || '';
                                    var hrefMatch = href.match(/[?&]q=([^&]+)/);
                                    if (hrefMatch && hrefMatch[1]) {
                                        try {
                                            keyword = decodeURIComponent(hrefMatch[1]).trim();
                                        }
                                        catch (e) {
                                            keyword = hrefMatch[1].trim();
                                        }
                                    }
                                    // 텍스트에서 추출 (우선순위 2)
                                    if (!keyword || keyword.length < 2) {
                                        keyword = ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                        keyword = keyword
                                            .replace(/^\d+\.?\s*/, '')
                                            .replace(/^\d+위\s*/, '')
                                            .replace(/^위,\s*/, '')
                                            .replace(/^▶\s*/, '')
                                            .replace(/^▶/, '')
                                            .replace(/^▲\s*/, '')
                                            .replace(/^▼\s*/, '')
                                            .replace(/^NEW\s*/i, '')
                                            .replace(/^HOT\s*/i, '')
                                            .replace(/\s+/g, ' ')
                                            .trim();
                                    }
                                    // 기본 필터링 (최소한만)
                                    if (keyword &&
                                        keyword.length >= 2 &&
                                        keyword.length <= 50 &&
                                        /[가-힣a-zA-Z0-9]/.test(keyword) &&
                                        !/^\d+$/.test(keyword) &&
                                        !['통합검색', '로그인', '로그아웃', '더보기', '전체보기'].includes(keyword)) {
                                        candidates_1.push({
                                            element: link,
                                            keyword: keyword,
                                            rank: index + 1
                                        });
                                    }
                                });
                                console.log("[DAUM-REALTIME] \uD6C4\uBCF4 \uD0A4\uC6CC\uB4DC ".concat(candidates_1.length, "\uAC1C \uC218\uC9D1"));
                                // 후보가 1개 이상이면 실시간 이슈로 판단 (3개 -> 1개로 완화)
                                if (candidates_1.length >= 1) {
                                    var uniqueKeywords_1 = [];
                                    // 기존 result에 있는 키워드 제외
                                    var existingKeywords = result.map(function (r) { return r.keyword.toLowerCase(); });
                                    candidates_1.forEach(function (candidate) {
                                        if (result.length >= maxLimit)
                                            return;
                                        var keywordLower = candidate.keyword.toLowerCase();
                                        // 중복 체크 (allKeywords Set 사용)
                                        if (!allKeywords.has(keywordLower)) {
                                            allKeywords.add(keywordLower);
                                            uniqueKeywords_1.push(candidate.keyword);
                                            result.push({
                                                keyword: candidate.keyword,
                                                rank: result.length + 1
                                            });
                                        }
                                    });
                                    console.log("[DAUM-REALTIME] \uC804\uCCB4 \uD398\uC774\uC9C0\uC5D0\uC11C ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC644\uB8CC"));
                                    // 10개 미만이면 더 많은 후보에서 추가 수집
                                    if (result.length < maxLimit && candidates_1.length > result.length) {
                                        candidates_1.forEach(function (candidate) {
                                            if (result.length >= maxLimit)
                                                return;
                                            var keywordLower = candidate.keyword.toLowerCase();
                                            if (!allKeywords.has(keywordLower)) {
                                                allKeywords.add(keywordLower);
                                                result.push({
                                                    keyword: candidate.keyword,
                                                    rank: result.length + 1
                                                });
                                            }
                                        });
                                        console.log("[DAUM-REALTIME] \uCD94\uAC00 \uC218\uC9D1 \uD6C4 ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC"));
                                    }
                                    // 10개를 확보했으면 여기서 반환
                                    if (result.length >= maxLimit) {
                                        return result;
                                    }
                                }
                            }
                            // 우선순위 3: targetSection에서 키워드 추출 (targetSection이 있어도 전체 페이지에서 추가 수집)
                            if (targetSection) {
                                console.log("[DAUM-REALTIME] \uC2E4\uC2DC\uAC04 \uC774\uC288 \uC139\uC158 \uD655\uC778: ".concat(targetSection.id || targetSection.className));
                                // 섹션 내의 모든 링크 찾기
                                var keywordLinks = targetSection.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="], a[href*="issue"]');
                                console.log("[DAUM-REALTIME] \uAC80\uC0C9 \uB9C1\uD06C ".concat(keywordLinks.length, "\uAC1C \uBC1C\uACAC"));
                                var tempKeywords_1 = [];
                                // 최소 10개 확보를 위해 더 많은 링크 확인 (maxLimit * 3까지)
                                keywordLinks.forEach(function (el, index) {
                                    var _a;
                                    if (tempKeywords_1.length >= maxLimit * 3)
                                        return;
                                    var keyword = '';
                                    // 1. href에서 키워드 추출 (가장 확실한 방법)
                                    if (el.tagName === 'A') {
                                        var href = el.href || '';
                                        // 다음 검색 URL 패턴: /search?w=tot&...&q=검색어 또는 ?q=검색어
                                        var hrefMatch = href.match(/[?&]q=([^&]+)/);
                                        if (hrefMatch && hrefMatch[1]) {
                                            try {
                                                keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                console.log("[DAUM-REALTIME] \uB9C1\uD06C ".concat(index, " href\uC5D0\uC11C \uCD94\uCD9C: \"").concat(keyword, "\""));
                                            }
                                            catch (e) {
                                                keyword = hrefMatch[1].trim();
                                            }
                                        }
                                    }
                                    // 2. data 속성 확인 (실시간 이슈 관련 속성)
                                    if (!keyword || keyword.length < 2) {
                                        keyword = el.getAttribute('data-keyword') ||
                                            el.getAttribute('data-query') ||
                                            el.getAttribute('data-tiara-keyword') ||
                                            el.getAttribute('title') || '';
                                    }
                                    // 3. 텍스트에서 추출 (마지막 수단) - 브리핑/트렌드 영역의 경우
                                    if (!keyword || keyword.length < 2) {
                                        keyword = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                        // 순위 번호, 아이콘, UI 텍스트 제거
                                        keyword = keyword
                                            .replace(/^\d+\.?\s*/, '')
                                            .replace(/^\d+위\s*/, '')
                                            .replace(/^위,\s*/, '')
                                            .replace(/^▶\s*/, '')
                                            .replace(/^▶/, '')
                                            .replace(/^▲\s*/, '')
                                            .replace(/^▼\s*/, '')
                                            .replace(/^NEW\s*/i, '')
                                            .replace(/^HOT\s*/i, '')
                                            .trim();
                                    }
                                    // 기본 필터링 (길이 제한 완화: 30자 -> 50자)
                                    if (!keyword || keyword.length < 2 || keyword.length > 50) {
                                        return;
                                    }
                                    // 한글/영어/숫자 포함 필터 (더 완화)
                                    if (!/[가-힣a-zA-Z0-9]/.test(keyword)) {
                                        return;
                                    }
                                    // UI 요소 제외 (최소한만 - 필수 UI 요소만)
                                    var essentialUiKeywords = ['통합검색', '로그인', '로그아웃', '더보기', '전체보기'];
                                    if (essentialUiKeywords.includes(keyword)) {
                                        return;
                                    }
                                    // 숫자만 있는 키워드 제외 (예: "1위", "2위")
                                    if (/^\d+$/.test(keyword)) {
                                        return;
                                    }
                                    // 너무 짧은 단일 단어 제외 (단, 2자 이상이면 허용)
                                    if (keyword.length === 1) {
                                        return;
                                    }
                                    // 중복 체크 (allKeywords Set 사용)
                                    var keywordLower = keyword.toLowerCase();
                                    if (!allKeywords.has(keywordLower)) {
                                        allKeywords.add(keywordLower);
                                        tempKeywords_1.push(keyword);
                                        console.log("[DAUM-REALTIME] \uC2E4\uC2DC\uAC04 \uC774\uC288 \uD0A4\uC6CC\uB4DC \uCD94\uAC00 (".concat(tempKeywords_1.length, "\uBC88\uC9F8): \"").concat(keyword, "\""));
                                    }
                                });
                                // 결과에 추가 (최대 maxLimit개)
                                tempKeywords_1.slice(0, maxLimit).forEach(function (keyword, index) {
                                    if (result.length >= maxLimit)
                                        return;
                                    result.push({
                                        keyword: keyword,
                                        rank: index + 1
                                    });
                                });
                                console.log("[DAUM-REALTIME] \uC2E4\uC2DC\uAC04 \uC774\uC288 \uC139\uC158\uC5D0\uC11C ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC644\uB8CC"));
                            }
                            // 최소 10개 확보를 위한 추가 수집 (아직 부족한 경우 - 반복 시도)
                            var retryCount = 0;
                            var maxRetries = 3;
                            var _loop_1 = function () {
                                console.log("[DAUM-REALTIME] \uCD94\uAC00 \uC218\uC9D1 \uC2DC\uC791 (\uD604\uC7AC ".concat(result.length, "\uAC1C, \uBAA9\uD45C ").concat(maxLimit, "\uAC1C, \uC2DC\uB3C4 ").concat(retryCount + 1, "/").concat(maxRetries, ")"));
                                // 전체 페이지에서 추가 키워드 찾기 (더 넓은 범위)
                                var allSearchLinks = document.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="], a[href*="keyword"], a[href*="issue"]');
                                var additionalKeywords = [];
                                allSearchLinks.forEach(function (link) {
                                    var _a;
                                    if (additionalKeywords.length >= (maxLimit - result.length) * 3)
                                        return;
                                    var keyword = '';
                                    var href = link.href || '';
                                    var hrefMatch = href.match(/[?&]q=([^&]+)/);
                                    if (hrefMatch && hrefMatch[1]) {
                                        try {
                                            keyword = decodeURIComponent(hrefMatch[1]).trim();
                                        }
                                        catch (e) {
                                            keyword = hrefMatch[1].trim();
                                        }
                                    }
                                    if (!keyword || keyword.length < 2) {
                                        keyword = ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                        keyword = keyword
                                            .replace(/^\d+\.?\s*/, '')
                                            .replace(/^\d+위\s*/, '')
                                            .replace(/^위,\s*/, '')
                                            .replace(/^▶\s*/, '')
                                            .replace(/^▶/, '')
                                            .replace(/^▲\s*/, '')
                                            .replace(/^▼\s*/, '')
                                            .replace(/^NEW\s*/i, '')
                                            .replace(/^HOT\s*/i, '')
                                            .trim();
                                    }
                                    // 기본 필터링 (더 완화 - 최소한만 필터링)
                                    if (keyword &&
                                        keyword.length >= 2 &&
                                        keyword.length <= 50 &&
                                        /[가-힣a-zA-Z0-9]/.test(keyword) &&
                                        !/^\d+$/.test(keyword) &&
                                        !['통합검색', '로그인', '로그아웃', '더보기', '전체보기'].includes(keyword)) {
                                        var keywordLower = keyword.toLowerCase();
                                        if (!allKeywords.has(keywordLower)) {
                                            allKeywords.add(keywordLower);
                                            additionalKeywords.push(keyword);
                                        }
                                    }
                                });
                                // 추가 키워드를 결과에 합치기
                                additionalKeywords.slice(0, maxLimit - result.length).forEach(function (keyword) {
                                    if (result.length >= maxLimit)
                                        return;
                                    result.push({
                                        keyword: keyword,
                                        rank: result.length + 1
                                    });
                                });
                                console.log("[DAUM-REALTIME] \uCD94\uAC00 \uC218\uC9D1 \uC644\uB8CC: \uCD1D ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC (\uBAA9\uD45C: ").concat(maxLimit, "\uAC1C)"));
                                // 10개를 확보했으면 중단
                                if (result.length >= maxLimit) {
                                    return "break";
                                }
                                retryCount++;
                                // 재시도 전에 더 많은 선택자 시도
                                if (retryCount < maxRetries) {
                                    // 다른 선택자로 추가 시도
                                    var alternativeSelectors = [
                                        'a[href*="/search"]',
                                        'a[title*="검색"]',
                                        '[class*="keyword"] a',
                                        '[class*="rank"] a',
                                        '[class*="issue"] a',
                                        '[class*="trend"] a'
                                    ];
                                    for (var _e = 0, alternativeSelectors_1 = alternativeSelectors; _e < alternativeSelectors_1.length; _e++) {
                                        var selector = alternativeSelectors_1[_e];
                                        if (result.length >= maxLimit)
                                            break;
                                        var altLinks = document.querySelectorAll(selector);
                                        altLinks.forEach(function (link) {
                                            var _a;
                                            if (result.length >= maxLimit)
                                                return;
                                            var keyword = '';
                                            var href = link.href || '';
                                            var hrefMatch = href.match(/[?&]q=([^&]+)/);
                                            if (hrefMatch && hrefMatch[1]) {
                                                try {
                                                    keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                }
                                                catch (e) {
                                                    keyword = hrefMatch[1].trim();
                                                }
                                            }
                                            if (!keyword || keyword.length < 2) {
                                                keyword = ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                                keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
                                            }
                                            if (keyword &&
                                                keyword.length >= 2 &&
                                                keyword.length <= 50 &&
                                                /[가-힣a-zA-Z0-9]/.test(keyword) &&
                                                !/^\d+$/.test(keyword) &&
                                                !['통합검색', '로그인', '로그아웃', '더보기', '전체보기'].includes(keyword)) {
                                                var keywordLower = keyword.toLowerCase();
                                                if (!allKeywords.has(keywordLower)) {
                                                    allKeywords.add(keywordLower);
                                                    result.push({
                                                        keyword: keyword,
                                                        rank: result.length + 1
                                                    });
                                                    console.log("[DAUM-REALTIME] \uB300\uCCB4 \uC120\uD0DD\uC790\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: \"".concat(keyword, "\" (\uCD1D ").concat(result.length, "\uAC1C)"));
                                                }
                                            }
                                        });
                                    }
                                }
                            };
                            while (result.length < maxLimit && retryCount < maxRetries) {
                                var state_1 = _loop_1();
                                if (state_1 === "break")
                                    break;
                            }
                            // 최종적으로 10개 미만이면 경고 및 디버깅 정보
                            if (result.length < maxLimit) {
                                console.warn("[DAUM-REALTIME] \u26A0\uFE0F \uBAA9\uD45C(".concat(maxLimit, "\uAC1C) \uBBF8\uB2EC: ").concat(result.length, "\uAC1C\uB9CC \uC218\uC9D1\uB428"));
                                console.log("[DAUM-REALTIME] \uC218\uC9D1\uB41C \uD0A4\uC6CC\uB4DC \uBAA9\uB85D:", result.map(function (r) { return r.keyword; }));
                                // 전체 페이지에서 검색 링크 개수 확인
                                var totalSearchLinks = document.querySelectorAll('a[href*="/search"], a[href*="q="], a[href*="query="]').length;
                                console.log("[DAUM-REALTIME] \uC804\uCCB4 \uAC80\uC0C9 \uB9C1\uD06C: ".concat(totalSearchLinks, "\uAC1C"));
                            }
                            else {
                                console.log("[DAUM-REALTIME] \u2705 \uBAA9\uD45C(".concat(maxLimit, "\uAC1C) \uB2EC\uC131: ").concat(result.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC"));
                                console.log("[DAUM-REALTIME] \uC218\uC9D1\uB41C \uD0A4\uC6CC\uB4DC:", result.map(function (r) { return r.keyword; }));
                            }
                            return result;
                        }, limit)];
                case 14:
                    keywords = _a.sent();
                    console.log("[DAUM-REALTIME] ".concat(keywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                    realtimeKeywords = keywords
                        .slice(0, limit)
                        .map(function (item, index) { return ({
                        rank: index + 1,
                        keyword: item.keyword,
                        source: 'daum',
                        timestamp: new Date().toISOString()
                    }); });
                    console.log("[DAUM-REALTIME] \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 ".concat(realtimeKeywords.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC (\uBAA9\uD45C: ").concat(limit, "\uAC1C)"));
                    // 목표 개수보다 적으면 경고하되, 수집된 것이라도 반환
                    if (realtimeKeywords.length < limit) {
                        console.warn("[DAUM-REALTIME] \u26A0\uFE0F \uBAA9\uD45C(".concat(limit, "\uAC1C)\uBCF4\uB2E4 \uC801\uC740 ").concat(realtimeKeywords.length, "\uAC1C\uB9CC \uC218\uC9D1\uB428"));
                    }
                    // 1개 이상이면 반환 (목표보다 적어도 수집된 것 반환)
                    if (realtimeKeywords.length > 0) {
                        return [2 /*return*/, realtimeKeywords];
                    }
                    // 0개일 경우에만 에러 발생
                    throw new Error("\uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uBD80\uC871: 0\uAC1C");
                case 15:
                    error_1 = _a.sent();
                    console.warn('[DAUM-REALTIME] Puppeteer 크롤링 실패:', error_1.message || error_1);
                    throw error_1;
                case 16:
                    if (!browser) return [3 /*break*/, 20];
                    _a.label = 17;
                case 17:
                    _a.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, browser.close()];
                case 18:
                    _a.sent();
                    console.log('[DAUM-REALTIME] 브라우저 종료 완료');
                    return [3 /*break*/, 20];
                case 19:
                    e_2 = _a.sent();
                    console.warn('[DAUM-REALTIME] 브라우저 종료 오류:', e_2);
                    return [3 /*break*/, 20];
                case 20: return [7 /*endfinally*/];
                case 21: return [2 /*return*/];
            }
        });
    });
}

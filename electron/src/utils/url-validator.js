"use strict";
/**
 * URL 검증 유틸리티
 * 404 오류를 방지하고 공식 사이트만 허용
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedOfficialSite = isAllowedOfficialSite;
exports.filterOfficialCTAs = filterOfficialCTAs;
exports.isMainPage = isMainPage;
exports.getSafeOfficialUrl = getSafeOfficialUrl;
// 허용된 공식 도메인 목록
var ALLOWED_DOMAINS = [
    // 정부/공공 기관
    'gov.kr',
    'go.kr',
    'bokjiro.go.kr',
    'nhis.or.kr',
    'kca.go.kr',
    'mfds.go.kr',
    'kcab.or.kr',
    'kftc.go.kr',
    // 쇼핑몰
    'coupang.com',
    'shopping.naver.com',
    '11st.co.kr',
    'gmarket.co.kr',
    'auction.co.kr',
    'ssg.com',
    'lotte.com',
    // 공식 브랜드
    'samsung.com',
    'lge.co.kr',
    'lg.com',
    'apple.com',
    'microsoft.com',
    'google.com',
    // 금융
    'kfcc.or.kr',
    'fss.or.kr',
    'kcredit.or.kr'
];
// 금지된 도메인 패턴
var BLOCKED_PATTERNS = [
    'blog.naver.com',
    'cafe.naver.com',
    'tistory.com',
    'daum.net/cafe',
    'naver.com/search',
    'google.com/search',
    'naver.me',
    'bit.ly',
    'm.blog.naver',
    'post.naver.com'
];
/**
 * URL이 허용된 공식 사이트인지 확인
 */
function isAllowedOfficialSite(url) {
    if (!url || typeof url !== 'string')
        return false;
    try {
        var urlObj = new URL(url);
        var hostname = urlObj.hostname.toLowerCase();
        // 금지된 패턴 체크
        for (var _i = 0, BLOCKED_PATTERNS_1 = BLOCKED_PATTERNS; _i < BLOCKED_PATTERNS_1.length; _i++) {
            var pattern = BLOCKED_PATTERNS_1[_i];
            if (hostname.includes(pattern) || url.includes(pattern)) {
                console.log("[URL-VALIDATOR] \uAE08\uC9C0\uB41C \uD328\uD134 \uAC10\uC9C0: ".concat(pattern, " in ").concat(url));
                return false;
            }
        }
        // 허용된 도메인 체크
        for (var _a = 0, ALLOWED_DOMAINS_1 = ALLOWED_DOMAINS; _a < ALLOWED_DOMAINS_1.length; _a++) {
            var domain = ALLOWED_DOMAINS_1[_a];
            if (hostname.endsWith(domain) || hostname === domain) {
                console.log("[URL-VALIDATOR] \uD5C8\uC6A9\uB41C \uACF5\uC2DD \uC0AC\uC774\uD2B8: ".concat(url));
                return true;
            }
        }
        console.log("[URL-VALIDATOR] \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uB3C4\uBA54\uC778: ".concat(hostname));
        return false;
    }
    catch (error) {
        console.log("[URL-VALIDATOR] URL \uD30C\uC2F1 \uC2E4\uD328: ".concat(url));
        return false;
    }
}
/**
 * CTA 링크 목록에서 공식 사이트만 필터링
 */
function filterOfficialCTAs(ctas) {
    return ctas.filter(function (cta) {
        var isAllowed = isAllowedOfficialSite(cta.url);
        if (!isAllowed) {
            console.log("[URL-VALIDATOR] CTA \uC81C\uAC70\uB428 (\uBE44\uACF5\uC2DD \uC0AC\uC774\uD2B8): ".concat(cta.url));
        }
        return isAllowed;
    });
}
/**
 * URL이 메인 페이지인지 확인 (서브 경로가 적은지)
 */
function isMainPage(url) {
    try {
        var urlObj = new URL(url);
        var pathname = urlObj.pathname;
        // 메인 페이지: /, /kr, /ko 등 최상위 경로만
        return pathname === '/' ||
            pathname === '/kr' ||
            pathname === '/ko' ||
            pathname === '/kr/' ||
            pathname === '/ko/';
    }
    catch (_a) {
        return false;
    }
}
/**
 * 안전한 공식 사이트 URL 생성
 */
function getSafeOfficialUrl(topic) {
    var topicLower = topic.toLowerCase();
    // 주제에 따라 가장 적합한 공식 사이트 반환
    if (topicLower.includes('정부') || topicLower.includes('행정') || topicLower.includes('신청')) {
        return 'https://www.gov.kr';
    }
    if (topicLower.includes('복지') || topicLower.includes('지원금') || topicLower.includes('혜택')) {
        return 'https://www.bokjiro.go.kr';
    }
    if (topicLower.includes('건강') || topicLower.includes('보험') || topicLower.includes('의료')) {
        return 'https://www.nhis.or.kr';
    }
    if (topicLower.includes('쇼핑') || topicLower.includes('구매') || topicLower.includes('제품')) {
        return 'https://www.coupang.com';
    }
    if (topicLower.includes('소비자') || topicLower.includes('피해') || topicLower.includes('신고')) {
        return 'https://www.kca.go.kr';
    }
    // 기본값: 정부24
    return 'https://www.gov.kr';
}

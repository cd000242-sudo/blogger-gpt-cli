"use strict";
/**
 * CTA URL 유효성 검증 유틸리티
 * - 형식 검증, 차단 호스트 필터, HTTP HEAD 검증을 통합
 * - 기존 naver-search-validator.ts의 validateLink()를 재사용
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCtaUrl = validateCtaUrl;
exports.validateCtaUrlFormat = validateCtaUrlFormat;
// ============================================================
// Constants
// ============================================================
/** 차단 호스트 — 검색엔진, 블로그, URL 단축기 */
const BLOCKED_HOSTS = new Set([
    // 검색엔진 결과 페이지
    'search.naver.com', 'm.search.naver.com',
    'www.google.com', 'google.com',
    'search.daum.net', 'www.bing.com',
    // 블로그/커뮤니티 (CTA로 부적절)
    'blog.naver.com', 'cafe.naver.com',
    'm.blog.naver.com', 'm.cafe.naver.com',
    // URL 단축기
    'bit.ly', 't.co', 'shorturl.at', 'tinyurl.com', 'wa.me',
    'goo.gl', 'is.gd', 'v.gd', 'ow.ly',
]);
/** 블로그 도메인 패턴 (부분 일치) */
const BLOG_PATTERNS = [
    'tistory.com', 'brunch.co.kr', 'velog.io',
    'medium.com', 'blogspot.com', 'wordpress.com',
];
// ============================================================
// Core Validation
// ============================================================
/**
 * CTA URL 유효성 검증 (통합)
 * 1단계: 형식 검증
 * 2단계: 차단 호스트/블로그 필터
 * 3단계: HTTP HEAD 요청으로 실제 응답 확인
 */
async function validateCtaUrl(url, options = {}) {
    const { timeout = 5000, skipHttp = false } = options;
    const start = Date.now();
    // 1단계: 형식 검증
    if (!url || typeof url !== 'string') {
        return { isValid: false, reason: 'invalid-format', elapsedMs: Date.now() - start };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { isValid: false, reason: 'invalid-format', elapsedMs: Date.now() - start };
    }
    // 2단계: 호스트 검증
    let hostname;
    try {
        hostname = new URL(url).hostname.toLowerCase();
    }
    catch {
        return { isValid: false, reason: 'malformed-url', elapsedMs: Date.now() - start };
    }
    if (BLOCKED_HOSTS.has(hostname)) {
        return { isValid: false, reason: 'blocked-host', elapsedMs: Date.now() - start };
    }
    // 블로그 패턴 부분 일치 체크
    for (const pattern of BLOG_PATTERNS) {
        if (hostname.includes(pattern.replace('.com', '').replace('.co.kr', '').replace('.io', ''))) {
            // tistory, brunch, velog, medium, blogspot, wordpress 등
            if (hostname.includes('tistory') || hostname.includes('brunch') ||
                hostname.includes('velog') || hostname.endsWith('medium.com') ||
                hostname.includes('blogspot') || hostname.endsWith('wordpress.com')) {
                return { isValid: false, reason: 'blocked-host', elapsedMs: Date.now() - start };
            }
        }
    }
    // 3단계: HTTP HEAD 검증 (옵션)
    if (skipHttp) {
        return { isValid: true, elapsedMs: Date.now() - start };
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);
        const statusCode = response.status;
        const isValid = statusCode >= 200 && statusCode < 400; // 2xx + 3xx(리다이렉트) 허용
        return {
            isValid,
            statusCode,
            reason: isValid ? undefined : `http-${statusCode}`,
            elapsedMs: Date.now() - start,
        };
    }
    catch (error) {
        const elapsed = Date.now() - start;
        if (error.name === 'AbortError') {
            return { isValid: false, reason: 'timeout', elapsedMs: elapsed };
        }
        // 네트워크 오류 등 — URL 자체는 형식적으로 유효하므로 통과시킴
        // (일부 사이트가 HEAD 요청을 차단할 수 있으므로)
        console.warn(`[CTA-VALIDATE] ⚠️ HEAD 요청 실패 (네트워크 오류), URL 허용: ${url} — ${error.message}`);
        return { isValid: true, reason: 'head-blocked-passthrough', elapsedMs: elapsed };
    }
}
/**
 * CTA URL 형식만 검증 (HTTP 요청 하지 않음)
 * 수동 CTA 등 빠른 검증이 필요한 경우 사용
 */
function validateCtaUrlFormat(url) {
    if (!url || typeof url !== 'string') {
        return { isValid: false, reason: 'invalid-format' };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { isValid: false, reason: 'invalid-format' };
    }
    try {
        new URL(url);
    }
    catch {
        return { isValid: false, reason: 'malformed-url' };
    }
    return { isValid: true };
}

/**
 * CTA URL 유효성 검증 유틸리티
 * - 형식 검증, 차단 호스트 필터, HTTP HEAD 검증을 통합
 * - 기존 naver-search-validator.ts의 validateLink()를 재사용
 */

// ============================================================
// Types
// ============================================================

export interface CtaValidationResult {
    isValid: boolean;
    reason?: string | undefined;       // 실패 시: 'invalid-format' | 'blocked-host' | 'malformed-url' | 'http-XXX' | 'timeout'
    statusCode?: number | undefined;   // HTTP 상태 코드 (성공 시)
    elapsedMs?: number | undefined;    // 검증 소요 시간
    /**
     * AI 2차 검증 권장 플래그 — HTTP 검증은 통과했으나 의심 정황이 있는 경우 true.
     * 호출자(generation.ts)가 strict 모드 또는 의심 케이스에서 추가 LLM 검증을 수행할 수 있도록 힌트.
     * 예: .go.kr/.or.kr 200 OK + Content-Type HTML이지만 본문 시그니처는 없는 경우
     */
    aiRecommended?: boolean;
}

// ============================================================
// Constants
// ============================================================

/** 차단 호스트 — 검색엔진, 블로그, URL 단축기 */
const BLOCKED_HOSTS = new Set<string>([
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

/**
 * 세션/리퍼러 바인딩 URL 패턴 — 직접 접속 시 에러 페이지를 200 OK로 반환하는 URL들.
 * 이런 URL은 HEAD/GET 모두 200을 돌려주므로 HTTP 코드만으로는 걸러지지 않아
 * 패턴 기반으로 사전 차단해야 한다. 대신 도메인 루트로 폴백하도록 CTA 측에서 처리.
 */
const SESSION_BOUND_PATTERNS: RegExp[] = [
    // 복지로 서비스 상세 — ssisTbuId 쿼리 기반 세션 필수
    /bokjiro\.go\.kr\/.*\/svcinfoDtl\.do/i,
    /bokjiro\.go\.kr\/.*[?&]ssisTbuId=/i,
    // 정부24 서비스 상세 — 세션 없이 직접 접속 시 오류
    /gov\.kr\/.*\/AA020InfoCappView\.do/i,
    /gov\.kr\/.*[?&]CappBizCD=/i,
    // 국민연금공단 민원 상세
    /nps\.or\.kr\/.*\/jsppage\/.*\.jsp\?/i,
];

/** 세션 에러 페이지 본문 시그니처 — 200 OK로 응답하지만 실제로는 에러 */
const ERROR_CONTENT_SIGNATURES: string[] = [
    '요청하신 페이지를 바르게 표시',
    '요청하신 페이지를 표시할 수 없',
    '잘못된 접근입니다',
    '정상적인 접근이 아닙',
    '세션이 만료',
    '비정상적인 접근',
];

/** GET 본문 검증이 필요한 호스트 접미사 — 200 OK 에러 페이지가 흔한 정부/공공 사이트 */
const CONTENT_CHECK_SUFFIXES: string[] = [
    '.go.kr', '.or.kr',
];

// ============================================================
// Core Validation
// ============================================================

// 🗂️ In-flight + 완료 결과 캐시 — 동일 URL 중복 HTTP 호출 방지 (rate-limit/과부하 차단)
//    key: normalized URL, value: Promise of result. 완료 후 TTL 10분간 유지.
const CTA_CACHE = new Map<string, { result: Promise<CtaValidationResult>; expireAt: number }>();
const CTA_CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeCacheKey(url: string): string {
    // 공백 제거 + trailing slash 통일 정도의 가벼운 정규화
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/+$/, '') || '/';
        return `${u.protocol}//${u.hostname}${path}${u.search}`.toLowerCase();
    } catch {
        return url.trim().toLowerCase();
    }
}

/**
 * CTA URL 유효성 검증 (통합) — in-flight dedup 포함
 * 1단계: 형식 검증
 * 2단계: 차단 호스트/블로그 필터
 * 3단계: HTTP HEAD 요청으로 실제 응답 확인
 */
export async function validateCtaUrl(
    url: string,
    options: { timeout?: number; skipHttp?: boolean } = {}
): Promise<CtaValidationResult> {
    const { timeout = 5000, skipHttp = false } = options;

    // 🗂️ 캐시 조회 — 같은 URL이 진행 중이면 해당 Promise 공유, 완료됐고 TTL 유효하면 재사용
    const cacheKey = normalizeCacheKey(url);
    const now = Date.now();
    const cached = CTA_CACHE.get(cacheKey);
    if (cached && cached.expireAt > now) {
        return cached.result;
    }

    // 만료된 엔트리 정리 (맵 비대화 방지)
    if (CTA_CACHE.size > 500) {
        for (const [k, v] of CTA_CACHE.entries()) {
            if (v.expireAt <= now) CTA_CACHE.delete(k);
        }
    }

    const promise = performValidation(url, timeout, skipHttp);
    CTA_CACHE.set(cacheKey, { result: promise, expireAt: now + CTA_CACHE_TTL_MS });
    return promise;
}

async function performValidation(
    url: string,
    timeout: number,
    skipHttp: boolean,
): Promise<CtaValidationResult> {
    const start = Date.now();

    // 1단계: 형식 검증
    if (!url || typeof url !== 'string') {
        return { isValid: false, reason: 'invalid-format', elapsedMs: Date.now() - start };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { isValid: false, reason: 'invalid-format', elapsedMs: Date.now() - start };
    }

    // 2단계: 호스트 검증
    let hostname: string;
    try {
        hostname = new URL(url).hostname.toLowerCase();
    } catch {
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

    // 2.5단계: 세션 바인딩 URL 패턴 차단 (HEAD/GET이 200을 돌려줘도 에러 페이지인 케이스)
    for (const pattern of SESSION_BOUND_PATTERNS) {
        if (pattern.test(url)) {
            console.warn(`[CTA-VALIDATE] 🚫 세션 바인딩 URL 차단: ${url}`);
            return { isValid: false, reason: 'session-bound-url', elapsedMs: Date.now() - start };
        }
    }

    // 3단계: HTTP HEAD 검증 (옵션)
    if (skipHttp) {
        return { isValid: true, elapsedMs: Date.now() - start };
    }

    // 3.5단계: 정부/공공 도메인은 본문 검증 필요 여부 플래그
    const needsContentCheck = CONTENT_CHECK_SUFFIXES.some(suffix => hostname.endsWith(suffix));

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: needsContentCheck ? 'GET' : 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const statusCode = response.status;
        const httpOk = statusCode >= 200 && statusCode < 400;
        if (!httpOk) {
            clearTimeout(timeoutId);
            return {
                isValid: false,
                statusCode,
                reason: `http-${statusCode}`,
                elapsedMs: Date.now() - start,
            };
        }

        // 200 OK여도 본문에 에러 문구가 있으면 무효 처리 (정부/공공 사이트 대상)
        // 본문 읽기도 동일한 AbortController 타임아웃 보호 아래 수행 (clearTimeout은 읽기 완료 후)
        if (needsContentCheck) {
            // 과대 응답 조기 차단 — Content-Length 500KB 초과 시 본문 스캔 생략
            const contentLength = Number(response.headers.get('content-length') || '0');
            if (contentLength > 0 && contentLength > 500_000) {
                clearTimeout(timeoutId);
                console.warn(`[CTA-VALIDATE] ⚠️ 대형 응답(${contentLength}B), 본문 스캔 생략: ${url}`);
                return { isValid: true, statusCode, elapsedMs: Date.now() - start };
            }
            // Content-Type이 HTML이 아니면 본문 검증 무의미 — 헤더 기반 통과
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (contentType && !contentType.includes('html')) {
                clearTimeout(timeoutId);
                return { isValid: true, statusCode, elapsedMs: Date.now() - start };
            }
            try {
                // 스트림 reader로 20KB까지만 읽고 조기 취소 (전체 버퍼링 방지)
                const reader = response.body?.getReader();
                if (!reader) {
                    clearTimeout(timeoutId);
                    return { isValid: true, statusCode, elapsedMs: Date.now() - start };
                }
                const decoder = new TextDecoder('utf-8', { fatal: false });
                let accumulated = '';
                const limit = 20_000;
                while (accumulated.length < limit) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    accumulated += decoder.decode(value, { stream: true });
                }
                try { await reader.cancel(); } catch { /* 무시 */ }
                clearTimeout(timeoutId);

                const head = accumulated.slice(0, limit);
                for (const sig of ERROR_CONTENT_SIGNATURES) {
                    if (head.includes(sig)) {
                        console.warn(`[CTA-VALIDATE] 🚫 200 OK이나 에러 본문 감지 (${sig}): ${url}`);
                        return {
                            isValid: false,
                            statusCode,
                            reason: 'error-content',
                            elapsedMs: Date.now() - start,
                        };
                    }
                }
            } catch (bodyErr: any) {
                clearTimeout(timeoutId);
                console.warn(`[CTA-VALIDATE] ⚠️ 본문 읽기 실패, HTTP 코드만으로 판정: ${bodyErr.message}`);
            }
        } else {
            clearTimeout(timeoutId);
        }

        return {
            isValid: true,
            statusCode,
            elapsedMs: Date.now() - start,
            // 정부/공공 사이트는 200 OK여도 의미적 적합성 의심 — AI 2차 검증 권장
            aiRecommended: needsContentCheck,
        };
    } catch (error: any) {
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
export function validateCtaUrlFormat(url: string): CtaValidationResult {
    if (!url || typeof url !== 'string') {
        return { isValid: false, reason: 'invalid-format' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { isValid: false, reason: 'invalid-format' };
    }

    try {
        new URL(url);
    } catch {
        return { isValid: false, reason: 'malformed-url' };
    }

    return { isValid: true };
}

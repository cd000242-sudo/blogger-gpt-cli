/**
 * 🏆 Keyword Verifier — 황금키워드 검증 엔진
 * 
 * SERP 실제 방문 → 경쟁자 약체 판정 → 수익의도 분류 → 황금 점수 산출
 * 
 * 3단계 폴백:
 *   full     — Playwright로 상위 5개 글 실제 방문
 *   quick    — API 스니펫만으로 판단 (Playwright 불가 시)
 *   fallback — 기존 GAP 점수 기반 (모든 외부 호출 실패 시)
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CompetitorPost {
    title: string;
    blogName: string;
    postDate: string;          // YYYYMMDD or formatted
    daysAgo: number;
    link: string;
    // ── 실제 방문 분석 결과 ──
    contentLength: number;     // 글자 수
    imageCount: number;        // 이미지 수
    hasKeywordInTitle: boolean;
    isWeak: boolean;
    weakReasons: string[];
}

export interface VerificationResult {
    keyword: string;
    goldenScore: number;       // 0~100
    goldenGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    // ── 세부 점수 ──
    searchVolumeScore: number; // 0~20
    competitorScore: number;   // 0~30
    revenueScore: number;      // 0~20
    viewTabScore: number;      // 0~15
    trendScore: number;        // 0~15
    // ── 상세 데이터 ──
    competitors: CompetitorPost[];
    weakCount: number;
    revenueIntent: 'purchase' | 'info' | 'navigation';
    viewTabPresent: boolean;
    estimatedCpc: number;      // 원
    // ── 메타 ──
    verifiedAt: number;
    verificationMethod: 'full' | 'quick' | 'fallback';
}

// ─────────────────────────────────────────────
// Revenue Intent Patterns
// ─────────────────────────────────────────────

const PURCHASE_PATTERNS = /추천|비교|순위|가격|후기|리뷰|최저가|할인|쿠폰|구매|사는곳|구입|가성비|입문|입문용|브랜드|제품|모델/;
const INFO_PATTERNS = /방법|하는법|하는 법|뜻|차이|설정|원인|증상|효과|부작용|이유|장단점|종류|특징|주의사항|기간|비용|과정/;
const NAVIGATION_PATTERNS = /로그인|홈페이지|공식|사이트|고객센터|전화번호|위치|영업시간|매장/;

// CPC 카테고리 기반 추정 (SearchAd API에 CPC 금액 없음)
const CPC_CATEGORY_MAP: Record<string, number> = {
    '금융': 5000, '대출': 8000, '보험': 6000, '카드': 4000,
    '건강': 2000, '의료': 3000, '성형': 5000, '피부': 2500,
    '부동산': 4000, '인테리어': 2000, '이사': 2500,
    '교육': 2000, '학원': 1500, '자격증': 1500,
    '여행': 1200, '호텔': 1500, '항공': 2000,
    '자동차': 3000, '중고차': 2500, '렌트': 2000,
    '다이어트': 1800, '운동': 1000, '헬스': 1200,
    '뷰티': 1500, '화장품': 1200, '향수': 1000,
};

// ─────────────────────────────────────────────
// Main: verifyKeyword — 단일 키워드 풀 검증
// ─────────────────────────────────────────────

export async function verifyKeyword(
    keyword: string,
    searchVolume?: number,
    trendGrowth?: number,
    competition?: string,
    onProgress?: (msg: string) => void,
): Promise<VerificationResult> {
    console.log(`[VERIFIER] 🔬 검증 시작: "${keyword}"`);
    const startTime = Date.now();

    try {
        // Step 1: SERP 상위 5개 수집 (Naver OpenAPI)
        onProgress?.(`🔬 "${keyword}" SERP 분석 중...`);
        const serpItems = await fetchSerpTop5(keyword);

        if (serpItems.length === 0) {
            console.warn(`[VERIFIER] ⚠️ SERP 결과 없음 → fallback`);
            return buildFallbackResult(keyword, searchVolume, trendGrowth);
        }

        // Step 2: 실제 글 방문 → 경쟁자 분석
        let competitors: CompetitorPost[];
        let method: 'full' | 'quick' | 'fallback' = 'full';

        try {
            onProgress?.(`🔬 "${keyword}" 상위 ${serpItems.length}개 글 분석 중...`);
            competitors = await visitAndAnalyzeCompetitors(keyword, serpItems);
        } catch (playwrightErr) {
            console.warn(`[VERIFIER] ⚠️ Playwright 실패 → quick 모드:`, (playwrightErr as Error)?.message);
            competitors = buildQuickCompetitors(keyword, serpItems);
            method = 'quick';
        }

        // Step 3: 약체 카운트
        const weakCount = competitors.filter(c => c.isWeak).length;

        // Step 4: 수익 의도 분류
        const revenueIntent = classifyRevenueIntent(keyword);

        // Step 5: VIEW 탭 존재 확인
        let viewTabPresent = true; // 기본적으로 true (블로그 키워드는 VIEW 있다고 가정)
        try {
            viewTabPresent = await checkViewTabPresence(keyword);
        } catch {
            console.warn(`[VERIFIER] ⚠️ VIEW 탭 확인 실패 → true 가정`);
        }

        // Step 6: CPC 추정
        const estimatedCpc = estimateCpc(keyword, competition, revenueIntent);

        // Step 7: 황금 점수 계산
        const scores = calculateGoldenScore(
            searchVolume || 100,
            weakCount,
            competitors.length,
            revenueIntent,
            viewTabPresent,
            trendGrowth || 0,
            estimatedCpc,
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[VERIFIER] ✅ "${keyword}" 검증 완료: ${scores.goldenScore}점 (${scores.goldenGrade}) [${elapsed}초]`);

        return {
            keyword,
            ...scores,
            competitors,
            weakCount,
            revenueIntent,
            viewTabPresent,
            estimatedCpc,
            verifiedAt: Date.now(),
            verificationMethod: method,
        };
    } catch (err) {
        console.error(`[VERIFIER] ❌ "${keyword}" 검증 실패:`, (err as Error)?.message);
        return buildFallbackResult(keyword, searchVolume, trendGrowth);
    }
}

// ─────────────────────────────────────────────
// verifyBatch — 상위 N개 일괄 검증
// ─────────────────────────────────────────────

export async function verifyBatch(
    keywords: Array<{
        keyword: string;
        estimatedVolume?: number;
        trendGrowth?: number;
        competition?: string;
    }>,
    top: number = 20,
    onProgress?: (msg: string, percent: number) => void,
): Promise<VerificationResult[]> {
    const targets = keywords.slice(0, top);
    const results: VerificationResult[] = [];

    console.log(`[VERIFIER] 🔬 일괄 검증 시작: ${targets.length}개 키워드`);

    for (const [i, kw] of targets.entries()) {
        const pct = Math.round(((i + 1) / targets.length) * 100);
        onProgress?.(`🔬 검증 중... ${i + 1}/${targets.length} (${kw.keyword})`, pct);

        try {
            const result = await verifyKeyword(
                kw.keyword,
                kw.estimatedVolume,
                kw.trendGrowth,
                kw.competition,
            );
            results.push(result);
        } catch (err) {
            console.error(`[VERIFIER] ❌ 일괄 검증 실패 (${kw.keyword}):`, (err as Error)?.message);
            results.push(buildFallbackResult(kw.keyword, kw.estimatedVolume, kw.trendGrowth));
        }

        // 네이버 차단 방지 딜레이 (1~2초 랜덤)
        if (i < targets.length - 1) {
            await sleep(1000 + Math.random() * 1000);
        }
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.goldenScore - a.goldenScore);

    console.log(`[VERIFIER] ✅ 일괄 검증 완료: ${results.length}개`);
    return results;
}

// ─────────────────────────────────────────────
// Internal: SERP 상위 5개 수집 (Naver OpenAPI)
// ─────────────────────────────────────────────

interface SerpItem {
    title: string;
    link: string;
    description: string;
    bloggername: string;
    postdate: string; // YYYYMMDD
}

async function fetchSerpTop5(keyword: string): Promise<SerpItem[]> {
    try {
        const { EnvironmentManager } = await import('./environment-manager');
        const envManager = EnvironmentManager.getInstance();
        const config = envManager.getConfig();

        const clientId = config.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
        const clientSecret = config.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

        if (!clientId || !clientSecret) {
            console.warn('[VERIFIER] ⚠️ Naver API 키 없음, SERP 수집 불가');
            return [];
        }

        const params = new URLSearchParams({
            query: keyword,
            display: '5',
            sort: 'sim',
        });

        const response = await fetch(`https://openapi.naver.com/v1/search/blog.json?${params}`, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
            },
        });

        if (!response.ok) {
            console.warn(`[VERIFIER] ⚠️ Naver API ${response.status}`);
            return [];
        }

        const data = await response.json();
        return (data.items || []).slice(0, 5);
    } catch (err) {
        console.error('[VERIFIER] ❌ SERP 수집 실패:', (err as Error)?.message);
        return [];
    }
}

// ─────────────────────────────────────────────
// Internal: 실제 글 방문 → 분석 (Playwright)
// ─────────────────────────────────────────────

async function visitAndAnalyzeCompetitors(
    keyword: string,
    serpItems: SerpItem[],
): Promise<CompetitorPost[]> {
    const pw = await import('playwright');
    const { chromium } = pw;

    let browser: any = null;
    const competitors: CompetitorPost[] = [];

    try {
        browser = await chromium.launch({
            headless: true,  // 검증은 백그라운드에서 조용히
        } as any);

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 },
            locale: 'ko-KR',
        });

        for (const item of serpItems) {
            try {
                const page = await context.newPage();

                // 네이버 블로그 링크는 리다이렉트될 수 있음
                let blogUrl = item.link;
                // blog.naver.com 형식으로 변환 시도
                if (blogUrl.includes('blog.naver.com')) {
                    // 모바일 변환 (더 가볍고 빠름)
                    blogUrl = blogUrl.replace('blog.naver.com', 'm.blog.naver.com');
                }

                await page.goto(blogUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000,
                });
                await page.waitForTimeout(1500);

                // iframe 내부 접근 (네이버 블로그 구조)
                let contentLength = 0;
                let imageCount = 0;

                try {
                    // 모바일 블로그: #postViewArea 또는 .se-main-container
                    const result = await page.evaluate(() => {
                        // 모바일 블로그
                        const postArea = (document.querySelector('#postViewArea')
                            || document.querySelector('.se-main-container')
                            || document.querySelector('#post-area')
                            || document.querySelector('.post_ct')
                            || document.body) as HTMLElement;

                        const text = postArea?.innerText || '';
                        const images = postArea?.querySelectorAll('img') || [];

                        return {
                            textLength: text.length,
                            imgCount: images.length,
                        };
                    });

                    contentLength = result.textLength;
                    imageCount = result.imgCount;
                } catch {
                    // iframe 구조일 수도 있음
                    try {
                        const frame = page.frameLocator('iframe#mainFrame');
                        const result = await frame.locator('body').evaluate((body: HTMLElement) => {
                            const postArea = body.querySelector('#postViewArea')
                                || body.querySelector('.se-main-container')
                                || body;
                            return {
                                textLength: (postArea as HTMLElement)?.innerText?.length || 0,
                                imgCount: postArea?.querySelectorAll('img')?.length || 0,
                            };
                        });
                        contentLength = result.textLength;
                        imageCount = result.imgCount;
                    } catch {
                        // 글 분석 완전 실패 → 기본값
                        contentLength = 0;
                        imageCount = 0;
                    }
                }

                await page.close();

                // 날짜 계산
                const daysAgo = calculateDaysAgo(item.postdate);
                const hasKeywordInTitle = stripHtml(item.title).toLowerCase().includes(keyword.toLowerCase());

                // 약체 판정
                const weakReasons: string[] = [];
                if (contentLength > 0 && contentLength < 1500) weakReasons.push('짧은 글 (1,500자 미만)');
                if (imageCount < 3 && contentLength > 0) weakReasons.push('이미지 부족 (3개 미만)');
                if (daysAgo > 180) weakReasons.push('오래된 글 (180일+)');
                if (!hasKeywordInTitle) weakReasons.push('제목에 키워드 미포함');

                const isWeak = weakReasons.length >= 2; // 2개 이상이면 약체

                competitors.push({
                    title: stripHtml(item.title),
                    blogName: item.bloggername,
                    postDate: item.postdate,
                    daysAgo,
                    link: item.link,
                    contentLength,
                    imageCount,
                    hasKeywordInTitle,
                    isWeak,
                    weakReasons,
                });
            } catch (pageErr) {
                console.warn(`[VERIFIER] ⚠️ 글 방문 실패 (${item.bloggername}):`, (pageErr as Error)?.message);
                // 방문 실패한 글은 스킵하지 않고 기본값으로 추가
                competitors.push(buildQuickCompetitorFromItem(keyword, item));
            }
        }

        await browser.close();
    } catch (err) {
        if (browser) {
            try { await browser.close(); } catch { }
        }
        throw err; // 상위에서 quick 모드로 전환
    }

    return competitors;
}

// ─────────────────────────────────────────────
// Internal: Quick 모드 (API 스니펫만으로 분석)
// ─────────────────────────────────────────────

function buildQuickCompetitors(keyword: string, serpItems: SerpItem[]): CompetitorPost[] {
    return serpItems.map(item => buildQuickCompetitorFromItem(keyword, item));
}

function buildQuickCompetitorFromItem(keyword: string, item: SerpItem): CompetitorPost {
    const title = stripHtml(item.title);
    const desc = stripHtml(item.description);
    const daysAgo = calculateDaysAgo(item.postdate);
    const hasKeywordInTitle = title.toLowerCase().includes(keyword.toLowerCase());

    // 스니펫 길이로 약체 추정 (설명이 짧으면 글도 짧을 가능성)
    const weakReasons: string[] = [];
    if (desc.length < 100) weakReasons.push('설명 짧음 (콘텐츠 부족 추정)');
    if (daysAgo > 180) weakReasons.push('오래된 글 (180일+)');
    if (!hasKeywordInTitle) weakReasons.push('제목에 키워드 미포함');
    if (title.length < 15) weakReasons.push('짧은 제목');

    return {
        title,
        blogName: item.bloggername,
        postDate: item.postdate,
        daysAgo,
        link: item.link,
        contentLength: desc.length * 10, // rough estimate
        imageCount: 0, // unknown in quick
        hasKeywordInTitle,
        isWeak: weakReasons.length >= 2,
        weakReasons,
    };
}

// ─────────────────────────────────────────────
// Internal: 수익 의도 분류
// ─────────────────────────────────────────────

function classifyRevenueIntent(keyword: string): 'purchase' | 'info' | 'navigation' {
    if (PURCHASE_PATTERNS.test(keyword)) return 'purchase';
    if (NAVIGATION_PATTERNS.test(keyword)) return 'navigation';
    if (INFO_PATTERNS.test(keyword)) return 'info';

    // 형태소 단서가 없으면 기본 'info'
    return 'info';
}

// ─────────────────────────────────────────────
// Internal: VIEW 탭 존재 확인
// ─────────────────────────────────────────────

async function checkViewTabPresence(keyword: string): Promise<boolean> {
    try {
        // 네이버 통합검색에서 VIEW 탭 존재 확인
        // 모바일 통합검색이 더 가볍고 빠름
        const url = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            },
        });

        if (!response.ok) return true; // 실패 시 true 가정

        const html = await response.text();

        // VIEW 탭 확인: "view" 링크가 있으면 VIEW 탭 존재
        const hasViewTab = html.includes('where=view') || html.includes('tab_view') || html.includes('"VIEW"');

        // 블로그 섹션 확인: 블로그 결과가 통합검색에 나타나는지
        const hasBlogSection = html.includes('blog.naver.com') || html.includes('type_blog') || html.includes('블로그');

        return hasViewTab || hasBlogSection;
    } catch {
        return true; // 실패 시 true 가정
    }
}

// ─────────────────────────────────────────────
// Internal: CPC 추정
// ─────────────────────────────────────────────

function estimateCpc(
    keyword: string,
    competition?: string,
    revenueIntent?: string,
): number {
    // Base: competition 레벨 기반
    let baseCpc = 500;
    if (competition === '높음' || competition === 'HIGH') baseCpc = 1500;
    else if (competition === '보통' || competition === 'MEDIUM') baseCpc = 800;
    else if (competition === '낮음' || competition === 'LOW') baseCpc = 300;

    // 카테고리 보정
    for (const [cat, cpc] of Object.entries(CPC_CATEGORY_MAP)) {
        if (keyword.includes(cat)) {
            baseCpc = Math.max(baseCpc, cpc);
            break;
        }
    }

    // 구매 의도 보정
    if (revenueIntent === 'purchase') baseCpc = Math.round(baseCpc * 1.3);

    return baseCpc;
}

// ─────────────────────────────────────────────
// Internal: 황금 점수 계산
// ─────────────────────────────────────────────

function calculateGoldenScore(
    searchVolume: number,
    weakCount: number,
    totalCompetitors: number,
    revenueIntent: string,
    viewTabPresent: boolean,
    trendGrowth: number,
    estimatedCpc: number,
): {
    goldenScore: number;
    goldenGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    searchVolumeScore: number;
    competitorScore: number;
    revenueScore: number;
    viewTabScore: number;
    trendScore: number;
} {
    // 1. 검색량 점수 (0~20)
    // log10(100)=2, log10(1000)=3, log10(10000)=4
    const logVol = searchVolume > 0 ? Math.log10(searchVolume) : 0;
    const searchVolumeScore = Math.min(20, Math.round(logVol * 5));

    // 2. 경쟁자 약체 점수 (0~30)
    // 5개 중 약체 비율에 따라
    const weakRatio = totalCompetitors > 0 ? weakCount / totalCompetitors : 0;
    const competitorScore = Math.min(30, Math.round(weakRatio * 30));

    // 3. 수익 의도 점수 (0~20)
    let revenueScore = 10; // info 기본
    if (revenueIntent === 'purchase') revenueScore = 20;
    else if (revenueIntent === 'navigation') revenueScore = 3;
    // CPC 보정: 높은 CPC면 추가 점수
    if (estimatedCpc >= 3000) revenueScore = Math.min(20, revenueScore + 5);
    else if (estimatedCpc >= 1500) revenueScore = Math.min(20, revenueScore + 3);

    // 4. VIEW 탭 점수 (0~15)
    const viewTabScore = viewTabPresent ? 15 : 0;

    // 5. 트렌드 점수 (0~15)
    // trendGrowth: 양수면 상승, 음수면 하락
    const trendScore = Math.min(15, Math.max(0, Math.round((trendGrowth + 5) * 1.5)));

    // 총점
    const goldenScore = Math.min(100, Math.max(0,
        searchVolumeScore + competitorScore + revenueScore + viewTabScore + trendScore
    ));

    // 등급 판정
    let goldenGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    if (goldenScore >= 80) goldenGrade = 'S';
    else if (goldenScore >= 65) goldenGrade = 'A';
    else if (goldenScore >= 50) goldenGrade = 'B';
    else if (goldenScore >= 35) goldenGrade = 'C';
    else goldenGrade = 'D';

    return { goldenScore, goldenGrade, searchVolumeScore, competitorScore, revenueScore, viewTabScore, trendScore };
}

// ─────────────────────────────────────────────
// Internal: Fallback 결과 생성
// ─────────────────────────────────────────────

function buildFallbackResult(
    keyword: string,
    searchVolume?: number,
    trendGrowth?: number,
): VerificationResult {
    const revenueIntent = classifyRevenueIntent(keyword);
    const estimatedCpc = estimateCpc(keyword, undefined, revenueIntent);

    const scores = calculateGoldenScore(
        searchVolume || 100,
        2, // 보수적: 약체 2개 가정
        5,
        revenueIntent,
        true, // VIEW 있다고 가정
        trendGrowth || 0,
        estimatedCpc,
    );

    return {
        keyword,
        ...scores,
        competitors: [],
        weakCount: 2,
        revenueIntent,
        viewTabPresent: true,
        estimatedCpc,
        verifiedAt: Date.now(),
        verificationMethod: 'fallback',
    };
}

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

function stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '').trim();
}

function calculateDaysAgo(postdate: string): number {
    if (!postdate) return 999;
    try {
        // YYYYMMDD 형식
        const year = parseInt(postdate.substring(0, 4));
        const month = parseInt(postdate.substring(4, 6)) - 1;
        const day = parseInt(postdate.substring(6, 8));
        const postDateObj = new Date(year, month, day);
        const now = new Date();
        return Math.floor((now.getTime() - postDateObj.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
        return 999;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

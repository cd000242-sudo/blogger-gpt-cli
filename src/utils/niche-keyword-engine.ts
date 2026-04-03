/**
 * 🏆 Niche Keyword Engine v5 — 틈새 키워드 발굴 시스템
 * 
 * 핵심 원칙: "검색은 있는데 블로그 포스트가 없는 틈새를 발견한다"
 * 
 * 파이프라인:
 *   Phase 1: 씨앗 수집 (시드 + 뉴스/지식인 토픽 추출)
 *   Phase 2: 깊은 자동완성 채굴 (BFS depth 5~7 → 롱테일 틈새)
 *   Phase 3: 품질 게이트 (isRealKeyword)
 *   Phase 4: 데이터 분석 (검색량 + 문서수)
 *   Phase 5: 5-Pillar 황금점수 (틈새도 + 검색량 + 수익성 + 적합성 + SERP)
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { fetchNaverAutocomplete, fetchGoogleAutocomplete } from './naver-autocomplete';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PillarScores {
    nicheGap: number;    // 0~30 (핵심! 검색량÷문서수)
    demand: number;      // 0~25
    revenue: number;     // 0~20
    blogFit: number;     // 0~15
    serp: number;        // 0~10
}

export type RevenueIntent = 'purchase' | 'commercial' | 'howto' | 'info' | 'nav';

export interface NicheKeyword {
    keyword: string;
    goldenScore: number;           // 0~100 5-Pillar 황금점수
    goldenGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    pillarScores: PillarScores;
    revenueIntent: RevenueIntent;
    estimatedVolume: number;
    documentCount: number;
    difficulty: DifficultyLevel;
    urgency: UrgencyLevel;
    category: RevenueCategory;
    source: KeywordSource;
    trendGrowth: number;
    firstSeenAt: number;
    isNew: boolean;
    isEvergreen: boolean;
    shoppingCategory?: string | undefined;
    // ── 하위호환 (deprecated) ──
    gapScore: number;              // = goldenScore (하위호환)
}

export interface ShoppingKeywordResult {
    category: string;      // '패션의류', '화장품/미용', '디지털/가전' 등
    keywords: string[];    // 브랜드 필터링 완료된 제품명만
}

export type DifficultyLevel = 'anyone' | 'easy' | 'normal' | 'hard';
export type UrgencyLevel = 'now' | 'today' | 'this-week' | 'anytime';
export type RevenueCategory = 'adpost' | 'adsense' | 'shopping' | 'google-seo' | 'ali-express';
export type KeywordSource = 'naver' | 'google' | 'naver-kin' | 'naver-news' | 'naver-shopping';

export interface ScanOptions {
    maxKeywords?: number;
    categoryFilter?: RevenueCategory | 'all';
    platform?: RevenueCategory;       // 🎯 플랫폼별 스캔
    maxRecursionCalls?: number;        // 재귀 자동완성 최대 호출 수 (기본: 80)
    maxRecursionDepth?: number;        // 재귀 깊이 (기본: 5)
    enableKinCrawling?: boolean;       // 지식인 크롤링 활성화 (기본: true)
}

export interface ScanResult {
    keywords: NicheKeyword[];
    scannedAt: number;
    totalScanned: number;
    sources: KeywordSource[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<RevenueCategory, RegExp[]> = {
    'adpost': [
        /건강|다이어트|운동|피트니스|영양제|비타민|혈압|당뇨|피부|탈모/,
        /금융|재테크|저축|대출|보험|연금|세금|절약|적금|투자/,
        /정보|꿀팁|방법|하는법|차이|비교|장단점|후기|리뷰|추천/,
    ],
    'adsense': [
        /글로벌|해외|영어|영문|tech|IT|AI|인공지능|GPT|챗봇/,
        /프로그래밍|코딩|개발|앱|소프트웨어|하드웨어|가젯/,
        /트렌드|이슈|뉴스|속보|화제|논란/,
    ],
    'shopping': [
        /제품|상품|구매|쇼핑|가격|할인|세일|쿠폰|특가/,
        /리뷰|후기|비교|추천|TOP|베스트|인기|랭킹/,
        /전자제품|가전|패션|뷰티|식품|생활용품/,
    ],
    'google-seo': [
        /how\s*to|tutorial|guide|방법|하는\s*법|만들기|설정/i,
        /what\s*is|뜻|의미|정의|차이점|vs|비교/i,
        /best|top|추천|리스트|목록/i,
    ],
    'ali-express': [
        /알리|해외직구|직구|중국|배대지|관세|통관/,
        /저렴|싸게|가성비|최저가|직배|무료배송/,
    ],
};

// ⭐ 플랫폼별 고단가 Seed 키워드
const PLATFORM_SEEDS: Record<RevenueCategory, string[]> = {
    'adpost': [
        // 금융 (CPC 최고: 3000~15000원)
        '전세자금대출 조건', '자동차보험 비교', '적금 금리 비교', '연말정산 환급',
        '주택담보대출 금리', '신용카드 추천', '퇴직금 계산',
        // 건강/의료 (CPC 높음: 1500~5000원)
        '임플란트 가격', '비타민D 효능', '탈모 치료', '라식 비용',
        '비염 수술 후기', '영양제 추천',
        // 교육/생활
        '자격증 추천', '재택근무 꿀팁', '이사 비용', '인테리어 비용',
    ],
    'adsense': [
        'AI 이미지 생성', 'ChatGPT 활용법', '코딩 독학', 'Mac 단축키',
        '무료 폰트 추천', '포토샵 대안', '노션 활용법', '엑셀 함수',
        'AI 툴 추천', '무료 동영상 편집',
    ],
    'shopping': [
        '정수기 추천', '공기청정기 비교', '로봇청소기 추천', '안마의자 비교',
        '침대 매트리스 추천', '건조기 추천', '식기세척기 추천',
        '노트북 추천', '무선 이어폰 추천', '모니터 추천',
    ],
    'google-seo': [
        'best AI tools', 'how to start blog', 'passive income ideas',
        'best laptop 2026', 'home office setup', 'best VPN',
    ],
    'ali-express': [
        '알리 추천템', '해외직구 가성비', '직구 가전', '알리 인테리어',
        '중국 전자제품 추천', '알리 캠핑용품', '알리 주방용품',
    ],
};

// ⭐ 지식인 크롤링용 플랫폼별 검색어
const KIN_SEARCH_QUERIES: Record<RevenueCategory, string[]> = {
    'adpost': ['대출 추천', '보험 비교', '적금 추천', '건강 영양제', '다이어트 방법'],
    'adsense': ['AI 사용법', '코딩 방법', '프로그래밍 독학', '엑셀 팁'],
    'shopping': ['추천해주세요', '뭐가 좋아요', '비교 추천', '어디서 사야'],
    'google-seo': ['how to', 'best way', 'tutorial'],
    'ali-express': ['알리 추천', '직구 후기', '중국 제품 추천'],
};

// 상업의도 탐지 패턴
const COMMERCIAL_INTENT: Record<string, RegExp> = {
    'adpost': /추천|비교|가격|후기|장단점|순위|방법|하는법|꿀팁|정리/,
    'shopping': /추천|비교|가격|후기|구매|리뷰|할인|쿠폰|특가|최저가|순위/,
    'ali-express': /추천|가성비|직구|배송|후기|리뷰|할인|쿠폰|사도 되나/,
    'adsense': /방법|하는법|사용법|활용|팁|추천|비교|무료|설치/,
    'google-seo': /best|how|guide|review|vs|comparison|top|tips/i,
};

// 플랫폼별 Gap Score 가중치
const PLATFORM_WEIGHTS: Record<RevenueCategory, { cpcMultiplier: number; commercialBonus: number; recencyBonus: number }> = {
    'adpost': { cpcMultiplier: 1.0, commercialBonus: 1.5, recencyBonus: 2.0 },
    'adsense': { cpcMultiplier: 1.2, commercialBonus: 1.0, recencyBonus: 1.5 },
    'shopping': { cpcMultiplier: 0.8, commercialBonus: 3.0, recencyBonus: 1.0 },
    'google-seo': { cpcMultiplier: 1.5, commercialBonus: 1.0, recencyBonus: 1.2 },
    'ali-express': { cpcMultiplier: 0.6, commercialBonus: 2.5, recencyBonus: 1.3 },
};

const DIFFICULTY_THRESHOLDS = {
    anyone: 50,
    easy: 500,
    normal: 5000,
};

const URGENCY_HOURS = {
    now: 2,
    today: 12,
    thisWeek: 72,
};

// ─────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCacheDir(): string {
    const userDataPath = app.getPath('userData');
    const dir = path.join(userDataPath, 'keyword-cache');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getTodayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// 1. Document Count — Naver OpenAPI (100% 신뢰)
// ─────────────────────────────────────────────

/**
 * 네이버 OpenAPI /v1/search/blog.json의 data.total을 사용
 * HTML 크롤링 대비 100% 안정적
 */
export async function crawlNaverBlogDocCount(keyword: string): Promise<number> {
    try {
        // EnvironmentManager에서 API 키 로드
        const { EnvironmentManager } = await import('./environment-manager');
        const envManager = EnvironmentManager.getInstance();
        const config = envManager.getConfig();
        const clientId = config.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
        const clientSecret = config.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

        if (!clientId || !clientSecret) {
            console.warn('[NicheEngine] 네이버 API 키 없음 → 기본값 500 반환');
            return 500;
        }

        const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`;
        const resp = await fetch(url, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) {
            console.warn(`[NicheEngine] Blog API HTTP ${resp.status} (${keyword})`);
            return 500;
        }

        const data = await resp.json();
        const total = parseInt(data.total || '0', 10);
        return total > 0 ? total : 1;
    } catch (err: any) {
        console.error(`[NicheEngine] 문서수 조회 실패 (${keyword}):`, err?.message || err);
        return 500;
    }
}

// ─────────────────────────────────────────────
// 2. Search Volume — SearchAd API (100% 신뢰)
// ─────────────────────────────────────────────

/**
 * 네이버 검색광고 API로 정확한 PC/모바일 검색량 조회
 * 실패 시 문서수 기반으로 보수적 추정
 */
export async function estimateSearchVolume(keyword: string, docCount?: number): Promise<number> {
    try {
        const { EnvironmentManager } = await import('./environment-manager');
        const envManager = EnvironmentManager.getInstance();
        const config = envManager.getConfig();

        const accessLicense = config.naverSearchAdAccessLicense || process.env['NAVER_SEARCH_AD_ACCESS_LICENSE'] || '';
        const secretKey = config.naverSearchAdSecretKey || process.env['NAVER_SEARCH_AD_SECRET_KEY'] || '';
        const customerId = config.naverSearchAdCustomerId || process.env['NAVER_SEARCH_AD_CUSTOMER_ID'] || '';

        if (accessLicense && secretKey) {
            try {
                const { getNaverSearchAdKeywordVolume } = await import('./naver-searchad-api');
                const results = await getNaverSearchAdKeywordVolume(
                    { accessLicense, secretKey, customerId },
                    [keyword]
                );

                if (results && results.length > 0) {
                    const result = results[0];
                    const totalVolume = (result as any).totalSearchVolume
                        || (result as any).totalSearch
                        || ((result as any).pcSearchVolume || 0) + ((result as any).mobileSearchVolume || 0)
                        || 0;
                    if (totalVolume > 0) {
                        console.log(`[NicheEngine] SearchAd 검색량: ${keyword} = ${totalVolume}`);
                        return totalVolume;
                    }
                }
            } catch (searchAdErr: any) {
                console.warn(`[NicheEngine] SearchAd API 실패 (${keyword}):`, searchAdErr?.message || searchAdErr);
            }
        }

        // Fallback: 문서수 기반 보수적 추정
        if (docCount && docCount > 0) {
            const estimated = Math.round(docCount * 0.3);
            return Math.max(estimated, 10);
        }

        return 100; // 최소 기본값
    } catch (err: any) {
        console.error(`[NicheEngine] 검색량 추정 실패 (${keyword}):`, err?.message || err);
        return 100;
    }
}

// ─────────────────────────────────────────────
// 3. 재귀 자동완성 확장 (Depth 5, ~100회)
// ─────────────────────────────────────────────

/**
 * seed 키워드에서 시작하여 자동완성을 재귀적으로 확장
 * BFS(너비 우선)로 탐색하여 깊은 롱테일 키워드 발굴
 */
export async function recursiveAutocompleteExpansion(
    seeds: string[],
    maxDepth: number = 5,
    maxTotalCalls: number = 80,
    platform?: RevenueCategory,
    onProgress?: (msg: string) => void
): Promise<string[]> {
    const visited = new Set<string>();
    const discovered: string[] = [];
    const queue: { keyword: string; depth: number }[] = [];
    let apiCallCount = 0;

    // 모든 seed를 큐에 추가
    for (const seed of seeds) {
        queue.push({ keyword: seed, depth: 0 });
    }

    while (queue.length > 0 && apiCallCount < maxTotalCalls) {
        const item = queue.shift()!;
        if (visited.has(item.keyword) || item.depth > maxDepth) continue;
        visited.add(item.keyword);

        // 플랫폼에 따라 네이버/구글 자동완성 선택
        const isGlobalPlatform = platform === 'google-seo' || platform === 'adsense';
        let suggestions: string[] = [];
        try {
            suggestions = isGlobalPlatform
                ? await fetchGoogleAutocomplete(item.keyword)
                : await fetchNaverAutocomplete(item.keyword);
        } catch (acCallErr: any) {
            console.error(`[NicheEngine] ❌ 자동완성 호출 실패 (${item.keyword}):`, acCallErr?.message);
        }
        apiCallCount++;

        if (apiCallCount <= 3 || apiCallCount % 10 === 0) {
            console.log(`[NicheEngine] 🔄 자동완성 #${apiCallCount}: "${item.keyword}" → ${suggestions.length}개 제안`);
            onProgress?.(`🔄 재귀 확장 중... (${apiCallCount}/${maxTotalCalls}, 발견: ${discovered.length}개)`);
        }

        for (const suggestion of suggestions) {
            if (!visited.has(suggestion)) {
                discovered.push(suggestion);
                // 깊이 제한 내에서 큐에 추가
                if (item.depth < maxDepth) {
                    queue.push({ keyword: suggestion, depth: item.depth + 1 });
                }
            }
        }

        // Rate limiting: 300ms (100회 × 300ms = 30초)
        await sleep(300);
    }

    console.log(`[NicheEngine] 재귀 확장 완료: ${apiCallCount}회 호출, ${discovered.length}개 키워드 발견`);
    return discovered;
}

// ─────────────────────────────────────────────
// 4. 네이버 지식인 실시간 "많이 본 Q&A" 크롤링 (Playwright)
// ─────────────────────────────────────────────

/**
 * 네이버 지식인 메인 페이지의 "많이 본 Q&A"에서 실시간 인기 질문 크롤링
 * Playwright를 사용하여 실제 브라우저 창을 띄워 정확한 크롤링 수행
 * 
 * DOM 구조 (2026-02-16 검증):
 *   #rankingChart > ul.ranking_list > li.ranking_item > a.ranking_title
 *   30개 질문이 한 번에 로드됨 (페이지네이션 불필요)
 * 
 * @param _queries - (미사용, 호환성 유지) 기존 파라미터
 * @param onProgress - 진행 상황 콜백
 */
export async function crawlNaverKinQuestions(
    _queries: string[],
    onProgress?: (msg: string) => void
): Promise<string[]> {
    const allKeywords: string[] = [];

    try {
        // Playwright 모듈 동적 로드
        const pw = await import('playwright');
        const { chromium } = pw;
        let browser: any = null;

        try {
            onProgress?.('🔍 지식인 "많이 본 Q&A" 실시간 크롤링 시작...');

            // 실제 브라우저 창을 띄워서 크롤링 (headless: false)
            browser = await chromium.launch({
                headless: false,
            } as any);

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 900 },
                locale: 'ko-KR',
                timezoneId: 'Asia/Seoul',
            });

            const page = await context.newPage();

            // 지식인 메인 페이지로 이동
            await page.goto('https://kin.naver.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2000);

            // "많이 본 Q&A" (#rankingChart) 섹션까지 스크롤
            await page.evaluate(() => {
                const section = document.getElementById('rankingChart')
                    || document.querySelector('.stats_ranking_area, .ranking_section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    window.scrollTo(0, document.body.scrollHeight * 0.4);
                }
            });
            await page.waitForTimeout(1000);

            onProgress?.('🔍 많이 본 Q&A 질문 추출 중...');

            // 질문 제목 추출 — 검증된 셀렉터 사용
            const questions: string[] = await page.evaluate(() => {
                const results: string[] = [];
                const seen = new Set<string>();

                // 1차: 검증된 정확한 셀렉터 (#rankingChart > a.ranking_title)
                const primaryLinks = document.querySelectorAll('#rankingChart a.ranking_title, .ranking_list a.ranking_title');
                primaryLinks.forEach((el: Element) => {
                    const text = (el as HTMLElement).innerText?.trim();
                    if (text && text.length >= 4 && text.length <= 80 && !seen.has(text)) {
                        seen.add(text);
                        results.push(text);
                    }
                });

                // 2차 fallback: 1차에서 못 찾으면 대체 셀렉터 시도
                if (results.length === 0) {
                    const fallbackSelectors = [
                        '.stats_ranking_area a',
                        '[class*="ranking"] a',
                        'ul li a[href*="qna/detail"]',
                        'a[href*="docId="]',
                    ];
                    for (const selector of fallbackSelectors) {
                        document.querySelectorAll(selector).forEach((el: Element) => {
                            const text = (el as HTMLElement).innerText?.trim();
                            if (text && text.length >= 4 && text.length <= 80 && !seen.has(text)) {
                                if (/^\d+$/.test(text)) return;
                                if (/^조회수|^답변수|^이전|^다음|^더보기/.test(text)) return;
                                if (/^(지식iN|NAVER|로그인|회원가입)/.test(text)) return;
                                seen.add(text);
                                results.push(text);
                            }
                        });
                        if (results.length > 0) break;
                    }
                }

                return results;
            });

            console.log(`[NicheEngine] 🔍 많이 본 Q&A: ${questions.length}개 질문 발견`);
            onProgress?.(`🔍 ${questions.length}개 인기 질문에서 키워드 추출 중...`);

            // 질문에서 씨앗 토픽 추출 (질문 원문은 키워드로 사용하지 않음!)
            for (const question of questions) {
                const extracted = extractSeedTopicsFromQuestion(question);
                allKeywords.push(...extracted);
            }

            console.log(`[NicheEngine] ✅ 많이 본 Q&A 크롤링 완료: 총 ${allKeywords.length}개 씨앗 토픽 추출`);
            await context.close();
        } finally {
            if (browser) {
                try { await browser.close(); } catch { /* ignore */ }
            }
        }
    } catch (err: any) {
        console.warn('[NicheEngine] 지식인 크롤링 전체 실패 (건너뜀):', err?.message || err);
    }

    // 중복 제거
    return [...new Set(allKeywords)];
}

/**
 * 지식인 질문에서 자동완성 씨앗 토픽을 추출 (2~3단어 명사구)
 * ⚠️ 질문 원문은 키워드가 아님! 토픽만 추출하여 씨앗으로 사용.
 */
function extractSeedTopicsFromQuestion(question: string): string[] {
    const topics: string[] = [];

    // 특수문자, 조사, 어미 제거 → 순수 명사구만
    const cleaned = question
        .replace(/[?\uff1f!\uff01~\uff5e.\u3002,\uff0c\[\]()\uff08\uff09"'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 한국어 단어 분리 (조사/어미 제거)
    const words = cleaned.split(/\s+/).filter(w => {
        if (w.length < 2) return false;
        // 조사/어미/접속사 제거
        if (/^(이|가|은|는|을|를|이랑|하고|에서|로|으로|에|대해|그리고|인데|건데|요|는데|한데)$/.test(w)) return false;
        // 동사/형용사 어미
        if (/(해요|\uc5b4요|\uc744까요|\ub098요|\ub098요|\uc2ed니까|\uc2b5니까|\ud574주세요|\ud574줄|\uc5c6나요)$/.test(w)) return false;
        return true;
    });

    // 2~3단어 조합을 씨앗 토픽으로 추출
    if (words.length >= 2) {
        topics.push(words.slice(0, 2).join(' '));
    }
    if (words.length >= 3) {
        topics.push(words.slice(0, 3).join(' '));
    }

    return topics.filter(t => t.length >= 4 && t.length <= 20);
}

// ─────────────────────────────────────────────
// 4.5. 키워드 품질 게이트
// ─────────────────────────────────────────────

/**
 * isRealKeyword — 이것이 진짜 "검색어"인지 판단
 * 
 * 통과: "에어프라이어 고구마 시간", "전세자금대출 조건"
 * 차단: "대출 막혀 현금 7~8억 있어야", "동양엘리베이터가 티케이로 바뀐거에요"
 */
export function isRealKeyword(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const trimmed = text.trim();

    // 길이 제한: 2~30자
    if (trimmed.length < 2 || trimmed.length > 30) return false;

    // 단어 수 제한: 1~6단어
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > 6) return false;

    // 뉴스 제목 패턴 차단
    if (/[\[\]\(\)"'“”‘’「」『』〈〉]/.test(trimmed)) return false;  // 괄호/인용부호
    if (/\.\.\.|\u2026|~{2,}/.test(trimmed)) return false;  // 말줄임표
    if (/^\d{1,2}\.\s/.test(trimmed)) return false;  // 번호 목록

    // 문장형 패턴 차단 (서술어미/종결어미)
    if (/(이다|니다|습니다|에요|이에요|군요|대요|네요|세요|해요|어요|지요|의요|까요|나요|보이다|된다|한다|했다|있다)$/.test(trimmed)) return false;

    // 질문형 패턴 차단
    if (/[?\uff1f]/.test(trimmed)) return false;
    if (/(\uc778가요|\ub098요|\uc744까요|\uc2ed니까|\uc990까|\uc758까|\ud574주\uc138\uc694|\uc54c\ub824\uc8fc\uc138\uc694|\ubb50\uc57c|\uc5b4\ub514|\uc5b8\uc81c|\uc5b4\ub5bb\uac8c)/.test(trimmed)) return false;

    // 수치 펬함 뉴스 패턴: "7~8억", "200만원"
    if (/\d+[~\-]\d+\s*(억|만|천|원|년|세)/.test(trimmed)) return false;

    // 순수 숫자만
    if (/^\d+$/.test(trimmed)) return false;

    // 영어 문장 (대문자 시작 + 단어 5개+)
    if (/^[A-Z]/.test(trimmed) && wordCount >= 5) return false;

    // 한국어 포함 필수 (영문 플랫폼 제외)
    const hasKorean = /[\uac00-\ud7af]/.test(trimmed);
    const hasAlpha = /[a-zA-Z]/.test(trimmed);
    if (!hasKorean && !hasAlpha) return false;

    return true;
}

// ─────────────────────────────────────────────
// 5. 실시간 트렌드 수집 (뉴스 API)
// ─────────────────────────────────────────────

/**
 * 네이버 뉴스 API에서 씨앗 토픽 추출
 * ⚠️ 뉴스 헤드라인 원문은 키워드가 아님! 2~3단어 핵심 토픽만 추출.
 */
async function getRealtimeNewsSeedTopics(seeds: string[]): Promise<string[]> {
    const topics: string[] = [];

    try {
        const { EnvironmentManager } = await import('./environment-manager');
        const envManager = EnvironmentManager.getInstance();
        const config = envManager.getConfig();
        const clientId = config.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
        const clientSecret = config.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

        if (!clientId || !clientSecret) return [];

        for (const seed of seeds.slice(0, 3)) {
            try {
                const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(seed)}&display=20&sort=date`;
                const resp = await fetch(url, {
                    headers: {
                        'X-Naver-Client-Id': clientId,
                        'X-Naver-Client-Secret': clientSecret,
                    },
                    signal: AbortSignal.timeout(8000),
                });

                if (resp.ok) {
                    const data = await resp.json();
                    for (const item of (data.items || [])) {
                        const title = (item.title || '')
                            .replace(/<[^>]*>/g, '')
                            .replace(/&quot;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/[\[\](){}"'""'']/g, '')
                            .trim();
                        // 헤드라인에서 2~3단어 핵심 명사구 추출
                        const words = title.split(/\s+/).filter((w: string) => w.length >= 2 && !/^(은|는|이|가|을|를|에|의|로|과|와|도|만)$/.test(w));
                        if (words.length >= 2) {
                            topics.push(words.slice(0, 2).join(' '));
                        }
                        if (words.length >= 3) {
                            topics.push(words.slice(0, 3).join(' '));
                        }
                    }
                }
                await sleep(300);
            } catch { /* skip */ }
        }
    } catch { /* skip */ }

    // 중복 제거 + 품질 게이트 적용
    return [...new Set(topics)].filter(t => t.length >= 4 && t.length <= 20);
}

// ─────────────────────────────────────────────
// 5.5. DataLab 쇼핑인사이트 — 실시간 인기 쇼핑 키워드 자동 발견
// ─────────────────────────────────────────────

/**
 * 네이버 DataLab 쇼핑인사이트의 내부 API를 활용하여
 * 카테고리별 실시간 인기 검색어 TOP 100을 자동 수집합니다.
 * 
 * 다른 키워드 도구(블랙키위, 키자드)에서는 제공하지 않는 독보적 기능:
 * - 키워드 입력 없이 자동 발견
 * - 네이버 쇼핑 실제 검색 데이터 기반
 * - 시즌/트렌드 키워드 자동 감지
 * - 브랜드명 자동 필터링 (제품명만 반환)
 * - 카테고리별 분류 반환
 * 
 * API: POST datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver
 * Playwright 세션 내 fetch로 호출 (CORS/레퍼러 우회)
 */

const DATALAB_SHOPPING_CATEGORIES = [
    { cid: '50000000', name: '패션의류' },
    { cid: '50000001', name: '패션잡화' },
    { cid: '50000002', name: '화장품/미용' },
    { cid: '50000003', name: '디지털/가전' },
    { cid: '50000004', name: '가구/인테리어' },
    { cid: '50000005', name: '출산/육아' },
    { cid: '50000006', name: '식품' },
    { cid: '50000007', name: '스포츠/레저' },
    { cid: '50000008', name: '생활/건강' },
    { cid: '50000009', name: '여가/생활편의' },
    { cid: '50000010', name: '면세점/해외직구' },
    { cid: '50000011', name: '도서' },
];

// ─── 브랜드 블랙리스트: 단독 브랜드명은 제거, "브랜드+제품" 조합은 유지 ───
const BRAND_BLACKLIST = new Set([
    // 패션 브랜드
    '자라', '유니클로', '나이키', '아디다스', '푸마', '뉴발란스', '컨버스', '반스',
    '구찌', '프라다', '샤넬', '버버리', '디올', '루이비통', '에르메스', '발렌시아가',
    '몽클레어', '막스마라', '폴로랄프로렌', '타미힐피거', '캘빈클라인',
    '에고이스트', '모조에스핀', '써스데이아일랜드', '잇미샤', '쉬즈미스', '지컷',
    '올리비아로렌', '제시뉴욕', '럭키슈에뜨', '시슬리', '케네스레이디',
    '올리브데올리브', '듀엘', '베네통', '스파오', '에잇세컨즈', '쥬시쥬디',
    '스튜디오톰보이', '지고트', '리스트', '잇미샤', '탑텐', '미쏘',
    '더한섬', '코오롱스포츠', '노스페이스', '디스커버리', '파타고니아',
    'mlb', 'fila', 'reebok', 'asics', 'descente', 'hazzys',
    // 화장품/뷰티 브랜드  
    '설화수', '이니스프리', '라네즈', '아모레퍼시픽', '헤라', '에뛰드',
    '클리오', '토니모리', '네이처리퍼블릭', '미샤', '더페이스샵', '스킨푸드',
    '달바', '세포랩', '이지듀', '라로슈포제', '바이오더마', '키엘',
    '에스티로더', '맥', '시세이도', '클라랑스', '랑콤', '입생로랑',
    '조말론', '록시땅', '디올', '아베다', '모로칸오일', '라셀턴',
    '닥터지', '이자녹스', '자민경', '달링태그', '이솝', '바르비아',
    '정샘물', '도미나', '아넷사', '그래비티', '르라보',
    // 디지털/가전 브랜드
    '삼성', '엘지', 'lg', '소니', '다이슨', '필립스', '보쉬', '일렉트로룩스',
    '브라운', '파나소닉', '캐논', '니콘', '애플', '레노버', '에이서', 'hp', 'dell',
    '샤오미', '화웨이', '마샬', '뱅앤올룹슨', 'jbl', '보스', 'bose',
    '포코피아',
    // 가구/인테리어 브랜드
    '이케아', '한샘', '일룸', '에이스침대', '시몬스', '리바트',
    // 식품 브랜드
    '풀무원', 'cj', '오뚜기', '비비고', '해태', '농심', '삼양',
    // 생활/건강 브랜드
    '스타벅스', '바세린', '도브', '피죤', '다우니', '페브리즈',
]);

/**
 * 브랜드 단독 키워드인지 판별합니다.
 * "나이키" → true (제거), "나이키운동화" → false (유지)
 */
function isBrandOnly(keyword: string): boolean {
    // 정확히 브랜드명과 일치하는 경우만 제거
    const lower = keyword.toLowerCase().trim();
    return BRAND_BLACKLIST.has(lower);
}

export async function crawlDataLabShoppingKeywords(
    onProgress?: (msg: string) => void
): Promise<ShoppingKeywordResult[]> {
    const categoryResults: ShoppingKeywordResult[] = [];

    try {
        const pw = await import('playwright');
        const { chromium } = pw;
        let browser: any = null;

        try {
            onProgress?.('🛒 DataLab 쇼핑인사이트 실시간 키워드 수집 시작...');

            browser = await chromium.launch({
                headless: false,
            } as any);

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 900 },
                locale: 'ko-KR',
                timezoneId: 'Asia/Seoul',
            });

            const page = await context.newPage();

            // DataLab 쇼핑인사이트 페이지 접속 (API 호출을 위한 도메인 컨텍스트)
            await page.goto('https://datalab.naver.com/shoppingInsight/sCategory.naver', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
            await page.waitForTimeout(2000);

            // 날짜 범위 설정: 최근 3일 (실시간에 가장 근접)
            const now = new Date();
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() - 1); // 어제
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 2); // 3일 전

            const formatDate = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const startStr = formatDate(startDate);
            const endStr = formatDate(endDate);

            console.log(`[DataLab-Shopping] 📅 조회 기간: ${startStr} ~ ${endStr}`);

            // 핵심 카테고리 6개에서 각 TOP 100 수집 (페이지네이션: 20개 × 5페이지)
            const targetCategories = DATALAB_SHOPPING_CATEGORIES.filter(c =>
                ['50000003', '50000008', '50000000', '50000002', '50000006', '50000004'].includes(c.cid)
            );

            const PAGES_PER_CATEGORY = 5; // 20개 × 5페이지 = 최대 100개

            for (const category of targetCategories) {
                onProgress?.(`🛒 [${category.name}] 인기 키워드 수집 중...`);
                const catKeywords: string[] = [];

                for (let pageNum = 1; pageNum <= PAGES_PER_CATEGORY; pageNum++) {
                    try {
                        const result = await page.evaluate(async (params: { cid: string; startDate: string; endDate: string; page: number }) => {
                            const body = `cid=${params.cid}&timeUnit=date&startDate=${params.startDate}&endDate=${params.endDate}&age=&gender=&device=&page=${params.page}&count=20`;
                            const resp = await fetch('https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    'X-Requested-With': 'XMLHttpRequest',
                                },
                                body,
                            });
                            return resp.json();
                        }, { cid: category.cid, startDate: startStr, endDate: endStr, page: pageNum });

                        if (result?.ranks && Array.isArray(result.ranks) && result.ranks.length > 0) {
                            const keywords = result.ranks
                                .map((r: any) => r.keyword)
                                .filter((k: string) => k && k.length >= 2);
                            catKeywords.push(...keywords);
                        } else {
                            break;
                        }
                    } catch (pageErr: any) {
                        console.warn(`[DataLab-Shopping] ⚠️ [${category.name}] 페이지 ${pageNum} 실패:`, pageErr?.message?.slice(0, 100));
                        break;
                    }

                    await new Promise(r => setTimeout(r, 300));
                }

                // 브랜드 필터링: 단독 브랜드명 제거, 제품명만 유지
                const filtered = [...new Set(catKeywords)].filter(kw => !isBrandOnly(kw));
                const brandRemoved = catKeywords.length - filtered.length;

                if (filtered.length > 0) {
                    categoryResults.push({
                        category: category.name,
                        keywords: filtered,
                    });
                }

                console.log(`[DataLab-Shopping] ✅ [${category.name}] ${filtered.length}개 제품 키워드 (브랜드 ${brandRemoved}개 제거)`);

                await new Promise(r => setTimeout(r, 500));
            }

            await browser.close();
            browser = null;

        } catch (browserErr: any) {
            console.error('[DataLab-Shopping] ❌ 브라우저 오류:', browserErr?.message);
            if (browser) {
                try { await browser.close(); } catch { /* ignore */ }
            }
        }
    } catch (importErr: any) {
        console.error('[DataLab-Shopping] ❌ Playwright 로드 실패:', importErr?.message);
    }

    const totalKeywords = categoryResults.reduce((sum, c) => sum + c.keywords.length, 0);
    console.log(`[DataLab-Shopping] 🏆 총 ${totalKeywords}개 제품 키워드 수집 (${categoryResults.length}개 카테고리)`);
    return categoryResults;
}

// ─────────────────────────────────────────────
// 6. 5-Pillar Golden Score — 틈새 발굴 핵심
// ─────────────────────────────────────────────

function getDifficulty(docCount: number): DifficultyLevel {
    if (docCount < DIFFICULTY_THRESHOLDS.anyone) return 'anyone';
    if (docCount < DIFFICULTY_THRESHOLDS.easy) return 'easy';
    if (docCount < DIFFICULTY_THRESHOLDS.normal) return 'normal';
    return 'hard';
}

function getUrgency(firstSeenAt: number): UrgencyLevel {
    const hoursAgo = (Date.now() - firstSeenAt) / (1000 * 60 * 60);
    if (hoursAgo < URGENCY_HOURS.now) return 'now';
    if (hoursAgo < URGENCY_HOURS.today) return 'today';
    if (hoursAgo < URGENCY_HOURS.thisWeek) return 'this-week';
    return 'anytime';
}

function classifyCategory(keyword: string): RevenueCategory {
    for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS) as [RevenueCategory, RegExp[]][]) {
        for (const pattern of patterns) {
            if (pattern.test(keyword)) return cat;
        }
    }
    return 'adpost';
}

/** 수익 의도 분류 */
function classifyRevenueIntent(keyword: string): RevenueIntent {
    if (/(구매|구입|가격|최저가|할인|쿠폰|직구|배송|주문)/.test(keyword)) return 'purchase';
    if (/(추천|비교|후기|리뷰|순위|랭킹|TOP|베스트|인기)/.test(keyword)) return 'commercial';
    if (/(방법|하는법|만들기|설치|사용법|세팅|설정|만드는)/.test(keyword)) return 'howto';
    if (/(뜻|의미|차이|종류|원인|효과|효능|부작용)/.test(keyword)) return 'info';
    return 'info';
}

/** 등급 산정 */
function getGoldenGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    if (score >= 80) return 'S';
    if (score >= 60) return 'A';
    if (score >= 40) return 'B';
    if (score >= 20) return 'C';
    return 'D';
}

/**
 * 🏆 5-Pillar Golden Score (0~100)
 * 
 * Pillar 1: 틈새 갭 (30점) — volume ÷ docCount 비율
 * Pillar 2: 검색 수요 (25점) — 월간 검색량 100~9999 최적
 * Pillar 3: 수익 잠재력 (20점) — 의도 + 카테고리 CPC
 * Pillar 4: 블로그 적합성 (15점) — 단어수, 액션워드, 에버그린
 * Pillar 5: SERP 기회 (10점) — 문서 경쟁도
 */
function calculateGoldenScore(
    keyword: string,
    volume: number,
    docCount: number,
    platform: RevenueCategory
): { goldenScore: number; pillarScores: PillarScores; revenueIntent: RevenueIntent } {
    if (docCount === 0) docCount = 1;

    // ━━━ Pillar 1: 틈새 갭 (0~30) ━━━
    const gapRatio = volume / docCount;
    let nicheGap: number;
    if (gapRatio >= 10) nicheGap = 30;
    else if (gapRatio >= 5) nicheGap = 25;
    else if (gapRatio >= 2) nicheGap = 20;
    else if (gapRatio >= 1) nicheGap = 15;
    else if (gapRatio >= 0.5) nicheGap = 10;
    else if (gapRatio >= 0.1) nicheGap = 5;
    else nicheGap = 2;

    // ━━━ Pillar 2: 검색 수요 (0~25) ━━━
    let demand: number;
    if (volume >= 1000 && volume <= 9999) demand = 25;
    else if (volume >= 500) demand = 22;
    else if (volume >= 300) demand = 18;
    else if (volume >= 200) demand = 15;
    else if (volume >= 100) demand = 10;
    else demand = 3;

    // ━━━ Pillar 3: 수익 잠재력 (0~20) ━━━
    const intent = classifyRevenueIntent(keyword);
    let revenue: number;
    switch (intent) {
        case 'purchase': revenue = 18; break;
        case 'commercial': revenue = 15; break;
        case 'howto': revenue = 10; break;
        case 'info': revenue = 6; break;
        default: revenue = 4;
    }
    const highCpcCategories: RevenueCategory[] = ['shopping', 'adsense'];
    if (highCpcCategories.includes(platform)) {
        revenue = Math.min(20, revenue + 3);
    }
    if (/(대출|보험|카드|투자|적금|예금|세금|연금)/.test(keyword)) revenue = 20;
    if (/(병원|치과|피부과|성형|시술|약|처방)/.test(keyword)) revenue = Math.min(20, revenue + 4);
    if (/(학원|과외|자격증|시험|공부|합격)/.test(keyword)) revenue = Math.min(20, revenue + 3);

    // ━━━ Pillar 4: 블로그 적합성 (0~15) ━━━
    const wordCount = keyword.split(/\s+/).length;
    let blogFit = 0;
    if (wordCount >= 2 && wordCount <= 4) blogFit += 8;
    else if (wordCount === 1 || wordCount === 5) blogFit += 4;
    else blogFit += 2;
    if (/(방법|추천|비교|후기|정리|총정리|가이드|꿀팁|핵심)/.test(keyword)) blogFit += 4;
    if (!(/(오늘|어제|내일|속보|긴급|단독|\d{4}년)/.test(keyword))) blogFit += 3;
    blogFit = Math.min(15, blogFit);

    // ━━━ Pillar 5: SERP 기회 (0~10) ━━━
    let serp = 0;
    if (docCount < 100) serp = 10;
    else if (docCount < 500) serp = 8;
    else if (docCount < 2000) serp = 5;
    else if (docCount < 10000) serp = 3;
    else serp = 1;

    const pillarScores: PillarScores = { nicheGap, demand, revenue, blogFit, serp };
    const goldenScore = nicheGap + demand + revenue + blogFit + serp;

    return {
        goldenScore: Math.min(100, Math.max(0, goldenScore)),
        pillarScores,
        revenueIntent: intent,
    };
}

// ─────────────────────────────────────────────
// 7. Cache Manager
// ─────────────────────────────────────────────

interface CacheEntry {
    keywords: NicheKeyword[];
    scannedAt: number;
    version: number;
    platform?: RevenueCategory | undefined;
}

function loadCache(platform?: RevenueCategory): CacheEntry | null {
    try {
        const suffix = platform ? `-${platform}` : '';
        const cacheFile = path.join(getCacheDir(), `niche-${getTodayKey()}${suffix}.json`);
        if (fs.existsSync(cacheFile)) {
            const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            return data as CacheEntry;
        }
    } catch { /* ignore */ }
    return null;
}

function saveCache(keywords: NicheKeyword[], platform?: RevenueCategory): void {
    try {
        const suffix = platform ? `-${platform}` : '';
        const cacheFile = path.join(getCacheDir(), `niche-${getTodayKey()}${suffix}.json`);
        const entry: CacheEntry = {
            keywords,
            scannedAt: Date.now(),
            version: 5,
            platform,
        };
        fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (err) {
        console.error('[NicheEngine] 캐시 저장 실패:', err);
    }
}

function loadYesterdayKeywords(): string[] {
    try {
        const yesterday = new Date(Date.now() - 86400000);
        const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        const cacheFile = path.join(getCacheDir(), `niche-${key}.json`);
        if (fs.existsSync(cacheFile)) {
            const data: CacheEntry = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            return data.keywords.map(k => k.keyword);
        }
    } catch { /* ignore */ }
    return [];
}

function countConsecutiveDays(keyword: string): number {
    let count = 0;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(Date.now() - i * 86400000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const cacheFile = path.join(getCacheDir(), `niche-${key}.json`);
        try {
            if (fs.existsSync(cacheFile)) {
                const data: CacheEntry = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                if (data.keywords.some(k => k.keyword === keyword)) {
                    count++;
                } else {
                    break;
                }
            } else {
                break;
            }
        } catch { break; }
    }
    return count;
}

// ─────────────────────────────────────────────
// 8. Main Scan Function (v4 전면 개편)
// ─────────────────────────────────────────────

export async function scanNicheKeywords(
    options: ScanOptions = {},
    onProgress?: (msg: string, percent: number) => void
): Promise<ScanResult> {
    const {
        maxKeywords = 30,
        categoryFilter = 'all',
        platform = 'adpost',
        maxRecursionCalls = 80,
        maxRecursionDepth = 5,
        enableKinCrawling = true,
    } = options;

    console.log(`[NicheEngine v4] 🚀 플랫폼별 스캔 시작: ${platform}`);

    // Check cache first (플랫폼별 캐시)
    const cached = loadCache(platform);
    if (cached && Date.now() - cached.scannedAt < 3600000) {
        console.log('[NicheEngine] 캐시 데이터 반환 (1시간 이내)');
        let kws = cached.keywords;
        if (categoryFilter !== 'all') {
            kws = kws.filter(k => k.category === categoryFilter);
        }
        return {
            keywords: kws.slice(0, maxKeywords),
            scannedAt: cached.scannedAt,
            totalScanned: cached.keywords.length,
            sources: ['naver', 'google', 'naver-kin'],
        };
    }

    onProgress?.('🎯 플랫폼별 Seed 키워드 준비 중...', 2);

    // ━━━ Step 1: 플랫폼별 Seed 키워드 수집 ━━━
    const seeds = PLATFORM_SEEDS[platform] || PLATFORM_SEEDS['adpost'];
    const allRawKeywords = new Set<string>();
    const keywordSourceMap = new Map<string, KeywordSource>();

    // seed 자체를 추가
    for (const seed of seeds) {
        allRawKeywords.add(seed);
        keywordSourceMap.set(seed, 'naver');
    }

    onProgress?.('🔍 네이버 지식인 크롤링 중...', 5);

    // ━━━ Step 2: 지식인 → 씨앗 토픽 추출 (직접 키워드 아님!) ━━━
    if (enableKinCrawling) {
        const kinQueries = KIN_SEARCH_QUERIES[platform] || KIN_SEARCH_QUERIES['adpost'];
        const kinSeedTopics = await crawlNaverKinQuestions(
            kinQueries,
            (msg) => onProgress?.(msg, 10)
        );
        // 지식인 토픽은 씨앗으로만 사용 (자동완성 확장용)
        for (const topic of kinSeedTopics) {
            allRawKeywords.add(topic);
            keywordSourceMap.set(topic, 'naver-kin');
        }
        console.log(`[NicheEngine] 지식인에서 ${kinSeedTopics.length}개 씨앗 토픽 추출`);
    }
    console.log(`[NicheEngine] 📊 Step 2 완료 - 씨앗 토픽 수: ${allRawKeywords.size}개 (Kin: ${Array.from(keywordSourceMap.values()).filter(v => v === 'naver-kin').length}개)`);

    onProgress?.('📰 실시간 뉴스 토픽 수집 중...', 15);

    // ━━━ Step 3: 뉴스 → 씨앗 토픽 추출 (헤드라인 원문이 아님!) ━━━
    let newsTopics: string[] = [];
    try {
        newsTopics = await getRealtimeNewsSeedTopics(seeds.slice(0, 3));
        console.log(`[NicheEngine] 뉴스 씨앗 토픽: ${newsTopics.length}개`);
    } catch (newsErr: any) {
        console.error(`[NicheEngine] ❌ 뉴스 토픽 수집 실패:`, newsErr?.message || newsErr);
    }
    for (const topic of newsTopics.slice(0, 30)) {
        allRawKeywords.add(topic);
        keywordSourceMap.set(topic, 'naver-news');
    }
    console.log(`[NicheEngine] 📊 Step 3 완료 - 뉴스 씨앗 토픽 ${newsTopics.length}개 추가, 현재 총: ${allRawKeywords.size}개`);

    // ━━━ Step 3.5: DataLab 쇼핑인사이트 실시간 인기 키워드 (shopping 플랫폼 전용) ━━━
    // 카테고리별 쇼핑 키워드 매핑 (shoppingCategory 할당용)
    const shoppingCategoryMap = new Map<string, string>();

    if (platform === 'shopping') {
        onProgress?.('🛒 DataLab 쇼핑 실시간 인기 키워드 수집 중...', 18);
        try {
            const shoppingResults = await crawlDataLabShoppingKeywords(
                (msg) => onProgress?.(msg, 20)
            );
            let addedCount = 0;
            for (const result of shoppingResults) {
                for (const kw of result.keywords) {
                    if (!allRawKeywords.has(kw)) {
                        allRawKeywords.add(kw);
                        keywordSourceMap.set(kw, 'naver-shopping');
                        shoppingCategoryMap.set(kw, result.category);
                        addedCount++;
                    }
                }
            }
            const totalShoppingKws = shoppingResults.reduce((s, r) => s + r.keywords.length, 0);
            console.log(`[NicheEngine] 📊 Step 3.5 완료 - DataLab 쇼핑 키워드 ${totalShoppingKws}개 (${shoppingResults.length}개 카테고리), 신규 추가: ${addedCount}개, 현재 총: ${allRawKeywords.size}개`);
        } catch (shoppingErr: any) {
            console.error(`[NicheEngine] ❌ DataLab 쇼핑 키워드 수집 실패:`, shoppingErr?.message || shoppingErr);
        }
    }

    onProgress?.(`🔄 재귀 자동완성 확장 시작 (최대 ${maxRecursionCalls}회)...`, 20);

    // ━━━ Step 4: 재귀 자동완성 확장 (핵심!) ━━━
    let expandedKeywords: string[] = [];
    try {
        console.log(`[NicheEngine] 자동완성 확장 시작 - seeds: [${seeds.join(', ')}], depth: ${maxRecursionDepth}, maxCalls: ${maxRecursionCalls}`);
        expandedKeywords = await recursiveAutocompleteExpansion(
            seeds,
            maxRecursionDepth,
            maxRecursionCalls,
            platform,
            (msg) => onProgress?.(msg, 40)
        );
        console.log(`[NicheEngine] 자동완성 확장 성공: ${expandedKeywords.length}개 키워드 발견`);
    } catch (acErr: any) {
        console.error(`[NicheEngine] ❌ 자동완성 확장 실패:`, acErr?.message || acErr);
        console.error(`[NicheEngine] ❌ 스택:`, acErr?.stack);
    }
    for (const kw of expandedKeywords) {
        if (!allRawKeywords.has(kw)) {
            allRawKeywords.add(kw);
            keywordSourceMap.set(kw, 'naver');
        }
    }
    console.log(`[NicheEngine] 📊 Step 4 완료 - 자동완성 ${expandedKeywords.length}개 발견, 현재 총: ${allRawKeywords.size}개`);

    // 소스별 통계 출력
    const sourceStats: Record<string, number> = {};
    for (const src of keywordSourceMap.values()) {
        sourceStats[src] = (sourceStats[src] || 0) + 1;
    }
    console.log(`[NicheEngine] 📊 소스별 키워드 분포:`, JSON.stringify(sourceStats));

    // ━━━ Step 4.5: 품질 게이트 (isRealKeyword) ━━━
    const qualityFiltered: string[] = [];
    let filteredOutCount = 0;
    for (const kw of allRawKeywords) {
        if (isRealKeyword(kw)) {
            qualityFiltered.push(kw);
        } else {
            filteredOutCount++;
        }
    }
    console.log(`[NicheEngine] 📊 품질 게이트: ${allRawKeywords.size}개 → ${qualityFiltered.length}개 통과 (${filteredOutCount}개 제거)`);

    onProgress?.(`📊 ${qualityFiltered.length}개 키워드 분석 시작...`, 45);

    // ━━━ Step 5: 각 키워드의 문서수 + 검색량 + Golden Score ━━━
    const yesterdayKws = new Set(loadYesterdayKeywords());
    const nicheKeywords: NicheKeyword[] = [];
    const totalToAnalyze = Math.min(qualityFiltered.length, 120); // 최대 120개 분석 (확장)
    const keywordsToProcess = qualityFiltered.slice(0, totalToAnalyze);
    let processed = 0;

    // 배치 처리 (5개씩)
    for (let i = 0; i < keywordsToProcess.length; i += 5) {
        const batch = keywordsToProcess.slice(i, i + 5);
        const results = await Promise.allSettled(
            batch.map(async (kw) => {
                // OpenAPI 문서수 조회
                const docCount = await crawlNaverBlogDocCount(kw);
                // SearchAd API 검색량 조회 (fallback: 문서수 기반)
                const volume = await estimateSearchVolume(kw, docCount);

                // ⚡ 최소 검색량 게이트 (100 미만 제거)
                if (volume < 100) return null;

                const firstSeenAt = yesterdayKws.has(kw)
                    ? Date.now() - 86400000
                    : Date.now();

                const trendGrowth = yesterdayKws.has(kw) ? 20 : 100;
                const category = classifyCategory(kw);

                // 🏆 5-Pillar Golden Score 계산
                const { goldenScore, pillarScores, revenueIntent } = calculateGoldenScore(
                    kw, volume, docCount, platform
                );

                const nicheKw: NicheKeyword = {
                    keyword: kw,
                    goldenScore,
                    goldenGrade: getGoldenGrade(goldenScore),
                    pillarScores,
                    revenueIntent,
                    gapScore: goldenScore,  // 하위호환
                    estimatedVolume: volume,
                    documentCount: docCount,
                    difficulty: getDifficulty(docCount),
                    urgency: getUrgency(firstSeenAt),
                    category,
                    source: keywordSourceMap.get(kw) || 'naver',
                    trendGrowth,
                    firstSeenAt,
                    isNew: !yesterdayKws.has(kw),
                    isEvergreen: countConsecutiveDays(kw) >= 3,
                    shoppingCategory: shoppingCategoryMap.get(kw),
                };

                return nicheKw;
            })
        );

        for (const r of results) {
            if (r.status === 'fulfilled' && r.value !== null) {
                nicheKeywords.push(r.value);
            }
        }

        processed += batch.length;
        const pct = Math.round(45 + (processed / totalToAnalyze) * 50);
        onProgress?.(`📊 분석 중... (${processed}/${totalToAnalyze})`, pct);

        // Rate limiting
        await sleep(500 + Math.random() * 300);
    }

    // ━━━ Step 6: 정렬 (Golden Score 내림차순) ━━━
    nicheKeywords.sort((a, b) => b.goldenScore - a.goldenScore);

    // ━━━ Step 7: 캐시 저장 (플랫폼별) ━━━
    saveCache(nicheKeywords, platform);

    onProgress?.('✅ 분석 완료!', 100);

    const topKw = nicheKeywords[0];
    console.log(`[NicheEngine v5] ✅ 완료: ${nicheKeywords.length}개 키워드, 상위: ${topKw?.keyword || '-'} (${topKw?.goldenGrade || '-'}, ${topKw?.goldenScore || 0}점)`);

    // ━━━ Step 8: 카테고리 필터 적용 ━━━
    let filtered = nicheKeywords;
    if (categoryFilter !== 'all') {
        filtered = nicheKeywords.filter(k => k.category === categoryFilter);
    }

    return {
        keywords: filtered.slice(0, maxKeywords),
        scannedAt: Date.now(),
        totalScanned: nicheKeywords.length,
        sources: platform === 'shopping'
            ? ['naver', 'google', 'naver-kin', 'naver-news', 'naver-shopping']
            : ['naver', 'google', 'naver-kin', 'naver-news'],
    };
}

// ─────────────────────────────────────────────
// 9. Export cached keywords by category
// ─────────────────────────────────────────────

export function getCachedKeywordsByCategory(): Record<RevenueCategory, NicheKeyword[]> {
    const cached = loadCache();
    const result: Record<RevenueCategory, NicheKeyword[]> = {
        'adpost': [],
        'adsense': [],
        'shopping': [],
        'google-seo': [],
        'ali-express': [],
    };

    if (cached) {
        for (const kw of cached.keywords) {
            result[kw.category].push(kw);
        }
    }

    return result;
}

// ─────────────────────────────────────────────
// 10. CSV Export
// ─────────────────────────────────────────────

export function exportKeywordsToCSV(keywords: NicheKeyword[]): string {
    const header = '키워드,등급,황금점수,틈새갭,검색수요,수익잠재력,블로그적합,SERP기회,수익의도,추정검색량,문서수,난이도,긴급도,카테고리,출처,에버그린';
    const rows = keywords.map(k =>
        `"${k.keyword}",${k.goldenGrade},${k.goldenScore},${k.pillarScores.nicheGap},${k.pillarScores.demand},${k.pillarScores.revenue},${k.pillarScores.blogFit},${k.pillarScores.serp},${k.revenueIntent},${k.estimatedVolume},${k.documentCount},${k.difficulty},${k.urgency},${k.category},${k.source},${k.isEvergreen}`
    );
    return [header, ...rows].join('\n');
}

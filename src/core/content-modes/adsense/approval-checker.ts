// src/core/content-modes/adsense/approval-checker.ts
// 블로그 22개 항목 자동 진단 — 0-100점 스코어링
// HTML 파싱 기반 (Electron BrowserWindow 또는 fetch + DOM 파서 사용)

/**
 * 개별 체크 항목 결과
 */
export interface CheckItem {
    id: string;
    category: 'content' | 'essential_pages' | 'seo' | 'design' | 'policy' | 'technical';
    name: string;
    status: 'pass' | 'warn' | 'fail';
    score: number;      // 0-4 (항목당 최대 4점)
    detail: string;
    fix?: string;       // 수정 제안 (fail/warn 시)
}

/**
 * 카테고리별 진단 결과
 */
export interface CategoryResult {
    category: string;
    categoryLabel: string;
    score: number;       // 합산 점수
    maxScore: number;    // 최대 점수
    items: CheckItem[];
}

/**
 * 전체 진단 결과
 */
export interface ApprovalCheckResult {
    totalScore: number;          // 0-100
    categories: CategoryResult[];
    passCount: number;
    warnCount: number;
    failCount: number;
    topFixes: string[];          // 우선 수정 사항 TOP 5
}

// ── 체크 항목 정의 ──
const CHECK_DEFINITIONS: Array<{
    id: string;
    category: CheckItem['category'];
    name: string;
    weight: number;
    check: (data: BlogAnalysisData) => { status: CheckItem['status']; detail: string; fix?: string };
}> = [
        // 콘텐츠 (5개 항목)
        {
            id: 'post_count', category: 'content', name: '게시글 15개+ 존재', weight: 4,
            check: (d) => d.postCount >= 15
                ? { status: 'pass', detail: `${d.postCount}개 게시글 확인` }
                : d.postCount >= 10
                    ? { status: 'warn', detail: `${d.postCount}개 (최소 15개 권장)`, fix: `${15 - d.postCount}개 추가 작성 필요` }
                    : { status: 'fail', detail: `${d.postCount}개 (절대 부족)`, fix: `최소 ${15 - d.postCount}개 추가 작성 필요` },
        },
        {
            id: 'avg_length', category: 'content', name: '평균 글자수 1000자+', weight: 4,
            check: (d) => d.avgPostLength >= 1000
                ? { status: 'pass', detail: `평균 ${d.avgPostLength}자` }
                : { status: 'fail', detail: `평균 ${d.avgPostLength}자 (1000자 미만)`, fix: '각 글을 1000자 이상으로 보강' },
        },
        {
            id: 'category_count', category: 'content', name: '카테고리 3개+ 분포', weight: 4,
            check: (d) => d.categoryCount >= 3
                ? { status: 'pass', detail: `${d.categoryCount}개 카테고리` }
                : { status: 'warn', detail: `${d.categoryCount}개 (최소 3개 권장)`, fix: '다양한 카테고리로 글 분산' },
        },
        {
            id: 'recent_posts', category: 'content', name: '최근 30일 내 5개+ 게시', weight: 4,
            check: (d) => d.recentPostCount >= 5
                ? { status: 'pass', detail: `최근 30일: ${d.recentPostCount}개` }
                : { status: 'warn', detail: `최근 30일: ${d.recentPostCount}개`, fix: '정기적인 포스팅 필요' },
        },
        {
            id: 'original_content', category: 'content', name: '독창적 콘텐츠', weight: 4,
            check: (d) => d.hasOriginalContent
                ? { status: 'pass', detail: '독창적 콘텐츠 확인' }
                : { status: 'warn', detail: '독창성 확인 필요', fix: '직접 경험/분석 기반 콘텐츠 추가' },
        },

        // 필수 페이지 (4개 항목)
        {
            id: 'privacy_page', category: 'essential_pages', name: '개인정보처리방침 존재', weight: 4,
            check: (d) => d.hasPrivacyPage
                ? { status: 'pass', detail: '개인정보처리방침 확인' }
                : { status: 'fail', detail: '개인정보처리방침 없음', fix: '필수 페이지 자동 생성 기능 사용' },
        },
        {
            id: 'disclaimer_page', category: 'essential_pages', name: '면책조항 존재', weight: 4,
            check: (d) => d.hasDisclaimerPage
                ? { status: 'pass', detail: '면책조항 확인' }
                : { status: 'fail', detail: '면책조항 없음', fix: '필수 페이지 자동 생성 기능 사용' },
        },
        {
            id: 'about_page', category: 'essential_pages', name: '소개 페이지 존재', weight: 4,
            check: (d) => d.hasAboutPage
                ? { status: 'pass', detail: '소개 페이지 확인' }
                : { status: 'fail', detail: '소개 페이지 없음', fix: '필수 페이지 자동 생성 기능 사용' },
        },
        {
            id: 'contact_page', category: 'essential_pages', name: '연락처 페이지 존재', weight: 4,
            check: (d) => d.hasContactPage
                ? { status: 'pass', detail: '연락처 페이지 확인' }
                : { status: 'fail', detail: '연락처 페이지 없음', fix: '필수 페이지 자동 생성 기능 사용' },
        },

        // SEO (6개 항목)
        {
            id: 'title_tag', category: 'seo', name: 'title 태그 존재', weight: 4,
            check: (d) => d.hasTitleTag ? { status: 'pass', detail: 'title 태그 확인' } : { status: 'fail', detail: 'title 태그 없음', fix: '각 글에 title 태그 추가' },
        },
        {
            id: 'meta_description', category: 'seo', name: 'meta description 존재', weight: 4,
            check: (d) => d.hasMetaDescription ? { status: 'pass', detail: 'meta description 확인' } : { status: 'warn', detail: 'meta description 없음', fix: '검색 설명 추가' },
        },
        {
            id: 'single_h1', category: 'seo', name: 'H1 1개만 존재', weight: 4,
            check: (d) => d.h1Count === 1 ? { status: 'pass', detail: 'H1 1개 확인' } : { status: 'warn', detail: `H1 ${d.h1Count}개`, fix: 'H1은 페이지당 1개만 사용' },
        },
        {
            id: 'img_alt', category: 'seo', name: '이미지 alt 태그 90%+', weight: 4,
            check: (d) => d.imgAltRate >= 90 ? { status: 'pass', detail: `alt 태그 ${d.imgAltRate}%` } : { status: 'warn', detail: `alt 태그 ${d.imgAltRate}%`, fix: '모든 이미지에 설명적 alt 텍스트 추가' },
        },
        {
            id: 'sitemap', category: 'seo', name: 'sitemap.xml 존재', weight: 4,
            check: (d) => d.hasSitemap ? { status: 'pass', detail: 'sitemap 확인' } : { status: 'warn', detail: 'sitemap 없음', fix: 'Blogger 설정에서 sitemap 활성화' },
        },
        {
            id: 'robots', category: 'seo', name: 'robots.txt 존재', weight: 4,
            check: (d) => d.hasRobotsTxt ? { status: 'pass', detail: 'robots.txt 확인' } : { status: 'warn', detail: 'robots.txt 없음', fix: 'Blogger 설정에서 robots.txt 구성' },
        },

        // 디자인 (3개 항목)
        {
            id: 'responsive', category: 'design', name: '반응형 디자인', weight: 4,
            check: (d) => d.isResponsive ? { status: 'pass', detail: '반응형 디자인 확인' } : { status: 'fail', detail: '반응형 미지원', fix: '반응형 템플릿으로 변경' },
        },
        {
            id: 'navigation', category: 'design', name: '메뉴/내비게이션 존재', weight: 4,
            check: (d) => d.hasNavigation ? { status: 'pass', detail: '내비게이션 확인' } : { status: 'warn', detail: '내비게이션 없음', fix: '메뉴 위젯 추가' },
        },
        {
            id: 'logo', category: 'design', name: '로고/블로그명 존재', weight: 4,
            check: (d) => d.hasLogo ? { status: 'pass', detail: '로고/블로그명 확인' } : { status: 'warn', detail: '로고 없음', fix: '블로그 헤더에 로고 추가' },
        },

        // 정책 (3개 항목)
        {
            id: 'no_adult', category: 'policy', name: '성인 콘텐츠 없음', weight: 4,
            check: (d) => d.noAdultContent ? { status: 'pass', detail: '성인 콘텐츠 없음' } : { status: 'fail', detail: '성인 콘텐츠 감지', fix: '즉시 삭제 필요' },
        },
        {
            id: 'no_ads', category: 'policy', name: '광고 코드 없음 (승인 전)', weight: 4,
            check: (d) => d.noExistingAds ? { status: 'pass', detail: '광고 코드 없음' } : { status: 'fail', detail: '기존 광고 코드 감지', fix: '모든 광고 코드 제거 후 재신청' },
        },
        {
            id: 'no_affiliate', category: 'policy', name: '외부 제휴 링크 없음', weight: 4,
            check: (d) => d.noAffiliateLinks ? { status: 'pass', detail: '제휴 링크 없음' } : { status: 'warn', detail: '제휴 링크 감지', fix: '승인 전까지 제휴 링크 제거' },
        },

        // 기술 (3개 항목)
        {
            id: 'https', category: 'technical', name: 'HTTPS 적용', weight: 4,
            check: (d) => d.isHttps ? { status: 'pass', detail: 'HTTPS 확인' } : { status: 'fail', detail: 'HTTP만 사용', fix: 'Blogger 설정에서 HTTPS 활성화' },
        },
        {
            id: 'no_404', category: 'technical', name: '404 페이지 없음', weight: 4,
            check: (d) => d.no404Pages ? { status: 'pass', detail: '깨진 링크 없음' } : { status: 'warn', detail: '깨진 링크 감지', fix: '깨진 링크 수정 또는 제거' },
        },
        {
            id: 'load_speed', category: 'technical', name: '로딩 속도 3초 이내', weight: 4,
            check: (d) => d.loadTimeMs < 3000
                ? { status: 'pass', detail: `${(d.loadTimeMs / 1000).toFixed(1)}초` }
                : { status: 'warn', detail: `${(d.loadTimeMs / 1000).toFixed(1)}초`, fix: '이미지 최적화, 불필요한 위젯 제거' },
        },
    ];

/**
 * 블로그 분석 데이터 (크롤링/파싱 결과)
 */
export interface BlogAnalysisData {
    postCount: number;
    avgPostLength: number;
    categoryCount: number;
    recentPostCount: number;
    hasOriginalContent: boolean;
    hasPrivacyPage: boolean;
    hasDisclaimerPage: boolean;
    hasAboutPage: boolean;
    hasContactPage: boolean;
    hasTitleTag: boolean;
    hasMetaDescription: boolean;
    h1Count: number;
    imgAltRate: number;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    isResponsive: boolean;
    hasNavigation: boolean;
    hasLogo: boolean;
    noAdultContent: boolean;
    noExistingAds: boolean;
    noAffiliateLinks: boolean;
    isHttps: boolean;
    no404Pages: boolean;
    loadTimeMs: number;
}

// ── 카테고리 라벨 ──
const CATEGORY_LABELS: Record<string, string> = {
    content: '📝 콘텐츠',
    essential_pages: '📄 필수 페이지',
    seo: '🔍 SEO',
    design: '🎨 디자인',
    policy: '📋 정책',
    technical: '⚙️ 기술',

};

/**
 * 블로그 분석 데이터를 기반으로 22개 항목 진단 실행
 */
export function runApprovalCheck(data: BlogAnalysisData): ApprovalCheckResult {
    const items: CheckItem[] = [];

    for (const def of CHECK_DEFINITIONS) {
        const result = def.check(data);
        const score = result.status === 'pass' ? def.weight : result.status === 'warn' ? Math.floor(def.weight / 2) : 0;
        const item: CheckItem = {
            id: def.id,
            category: def.category,
            name: def.name,
            status: result.status,
            score,
            detail: result.detail,
        };
        if (result.fix) item.fix = result.fix;
        items.push(item);
    }

    // 카테고리별 그룹핑
    const categoryMap = new Map<string, CheckItem[]>();
    for (const item of items) {
        if (!categoryMap.has(item.category)) categoryMap.set(item.category, []);
        categoryMap.get(item.category)!.push(item);
    }

    const categories: CategoryResult[] = [];
    for (const [cat, catItems] of categoryMap) {
        const maxScore = catItems.length * 4;
        const score = catItems.reduce((sum, item) => sum + item.score, 0);
        categories.push({
            category: cat,
            categoryLabel: CATEGORY_LABELS[cat] || cat,
            score,
            maxScore,
            items: catItems,
        });
    }

    const totalMaxScore = items.length * 4;
    const totalRawScore = items.reduce((sum, item) => sum + item.score, 0);
    const totalScore = Math.round((totalRawScore / totalMaxScore) * 100);

    const passCount = items.filter(i => i.status === 'pass').length;
    const warnCount = items.filter(i => i.status === 'warn').length;
    const failCount = items.filter(i => i.status === 'fail').length;

    // 수정 우선순위: fail → warn 순서로 TOP 5
    const topFixes = items
        .filter(i => i.fix)
        .sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1))
        .slice(0, 5)
        .map(i => `[${i.name}] ${i.fix}`);

    return { totalScore, categories, passCount, warnCount, failCount, topFixes };
}

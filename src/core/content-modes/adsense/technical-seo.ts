// src/core/content-modes/adsense/technical-seo.ts
// 기술 SEO 가이드 생성 — Search Console, sitemap, robots.txt, ads.txt

/**
 * 기술 SEO 가이드 항목
 */
export interface TechSEOGuide {
    id: string;
    title: string;
    description: string;
    steps: string[];
    code?: string;      // 코드 스니펫 (있으면)
    priority: 'required' | 'recommended' | 'optional';
}

/**
 * Blogger 플랫폼 전용 기술 SEO 가이드 생성
 */
export function generateBloggerTechSEOGuides(): TechSEOGuide[] {
    return [
        {
            id: 'search_console',
            title: 'Google Search Console 등록',
            description: '블로그를 Google Search Console에 등록하여 검색 노출을 관리합니다.',
            priority: 'required',
            steps: [
                '1. https://search.google.com/search-console 접속',
                '2. "속성 추가" → URL 접두사 방식 선택',
                '3. 메타 태그 방식으로 소유권 확인',
                '4. Blogger 설정 → 기본 설정 → 메타 태그 → "예"',
                '5. 제공된 메타 태그를 Blogger HTML에 붙여넣기',
                '6. Search Console에서 "확인" 클릭',
                '7. 사이트맵 제출 (아래 항목 참고)',
            ],
        },
        {
            id: 'sitemap',
            title: 'sitemap.xml 설정',
            description: 'Google이 블로그의 모든 글을 크롤링할 수 있도록 사이트맵을 제출합니다.',
            priority: 'required',
            steps: [
                '1. Blogger는 자동으로 sitemap.xml을 생성합니다',
                '2. URL: https://[블로그주소]/sitemap.xml',
                '3. Search Console → 색인 → Sitemaps',
                '4. sitemap.xml URL 입력 → 제출',
                '5. 상태가 "성공"인지 확인',
            ],
            code: `<!-- Blogger 기본 sitemap URL -->
https://yourblog.blogspot.com/sitemap.xml

<!-- 게시글이 많은 경우 (자동 분할) -->
https://yourblog.blogspot.com/sitemap.xml?page=1
https://yourblog.blogspot.com/sitemap.xml?page=2`,
        },
        {
            id: 'robots_txt',
            title: 'robots.txt 설정',
            description: '검색 엔진 크롤러에게 허용/차단할 경로를 지시합니다.',
            priority: 'required',
            steps: [
                '1. Blogger 대시보드 → 설정 → 크롤러 및 색인 생성',
                '2. "맞춤 robots.txt 사용" → "예"',
                '3. 아래 코드 저장',
            ],
            code: `User-agent: *
Allow: /
Disallow: /search

Sitemap: https://yourblog.blogspot.com/sitemap.xml`,
        },
        {
            id: 'ads_txt',
            title: 'ads.txt 설정 (승인 후)',
            description: 'AdSense 승인 후 광고 사기를 방지하는 ads.txt를 설정합니다.',
            priority: 'recommended',
            steps: [
                '1. AdSense 승인 후 AdSense 대시보드에서 게시자 ID 확인',
                '2. Blogger 설정 → 수익화 → 맞춤 ads.txt',
                '3. "맞춤 ads.txt 사용" → "예"',
                '4. 아래 코드를 게시자 ID와 함께 붙여넣기',
            ],
            code: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`,
        },
        {
            id: 'meta_tags',
            title: '메타 태그 최적화',
            description: '각 글의 검색 결과 표시를 최적화합니다.',
            priority: 'required',
            steps: [
                '1. Blogger 설정 → 기본 설정 → 메타 태그 → "예"',
                '2. 블로그 검색 설명 (150자 이내)에 블로그 주제 요약',
                '3. 각 글 작성 시 "검색 설명"에 해당 글 요약 (150자 이내)',
                '4. 핵심 키워드를 자연스럽게 포함',
            ],
        },
        {
            id: 'https',
            title: 'HTTPS 강제 설정',
            description: '모든 트래픽을 보안 연결(HTTPS)로 강제합니다.',
            priority: 'required',
            steps: [
                '1. Blogger 설정 → 기본 설정 → HTTPS',
                '2. "HTTPS 가용성" → "예"',
                '3. "HTTPS 리디렉션" → "예"',
                '4. 커스텀 도메인인 경우 SSL 인증서 확인',
            ],
        },
        {
            id: 'mobile_optimization',
            title: '모바일 최적화 확인',
            description: 'Google의 모바일 최적화 테스트를 통과해야 합니다.',
            priority: 'required',
            steps: [
                '1. https://search.google.com/test/mobile-friendly 접속',
                '2. 블로그 URL 입력 → 테스트 실행',
                '3. "페이지가 모바일에서 사용하기 쉽습니다" 확인',
                '4. 문제 발견 시 반응형 테마로 변경',
            ],
        },
        {
            id: 'structured_data',
            title: '구조화 데이터 (Schema.org)',
            description: 'FAQ, 기사 등 구조화 데이터로 검색 결과 부가 정보를 표시합니다.',
            priority: 'recommended',
            steps: [
                '1. FAQ 섹션 포함 글에 JSON-LD 마크업 추가',
                '2. Rich Results Test로 검증: https://search.google.com/test/rich-results',
                '3. Search Console에서 구조화 데이터 오류 확인',
            ],
            code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "질문 예시",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "답변 예시"
      }
    }
  ]
}
</script>`,
        },
    ];
}

/**
 * 기술 SEO 체크리스트 요약
 */
export function getTechSEOChecklist(): Array<{ item: string; priority: string; done: boolean }> {
    return [
        { item: 'Google Search Console 등록', priority: '필수', done: false },
        { item: 'sitemap.xml 제출', priority: '필수', done: false },
        { item: 'robots.txt 설정', priority: '필수', done: false },
        { item: 'HTTPS 강제 설정', priority: '필수', done: false },
        { item: '메타 태그 최적화', priority: '필수', done: false },
        { item: '모바일 최적화 확인', priority: '필수', done: false },
        { item: 'ads.txt 설정 (승인 후)', priority: '권장', done: false },
        { item: '구조화 데이터 추가', priority: '권장', done: false },
    ];
}

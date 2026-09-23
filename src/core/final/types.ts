/**
 * ultimate-final-functions 타입 및 설정
 */

export const FINAL_CONFIG = {
  // 대량 크롤링
  NAVER_BLOG_MAX: 50,
  RSS_MAX: 30,
  TISTORY_MAX: 20,
  WORDPRESS_MAX: 20,
  NEWS_MAX: 20,
  CAFE_MAX: 10,
  DETAIL_CRAWL: 20,

  // 글자수
  H2_MIN_CHARS: 1500,  // H2당 1500자
  H3_MIN_CHARS: 500,   // H3당 500자

  // 구조
  H2_COUNT: 5,         // H2 5개
  H3_PER_H2: 3,        // H2당 H3 3개

  // 성능
  CRAWL_TIMEOUT: 5000,
  PARALLEL_LIMIT: 5,
  MAX_TIME: 60000,
};

export interface FinalCrawledPost {
  title: string;
  url: string;
  content: string;
  subheadings: string[];
  date?: string;
  viewCount?: number;
  /**
   * 'naver-kin'·'google-suggest' 는 질문 소재(근거 아님). 키워드 글은 v3.8.374 부터 이 표시를 실어 왔는데
   * (as any 로 넣어서) 타입만 몰랐다 — v3.8.750 URL 모드가 같은 재료를 실으면서 타입을 맞췄다.
   */
  source: 'naver' | 'rss' | 'tistory' | 'wordpress' | 'news' | 'cafe' | 'external' | 'naver-kin' | 'google-suggest';
}

export interface FinalTableData {
  type: 'feature' | 'example' | 'summary' | 'info' | 'comparison' | 'checklist';
  headers: string[];
  rows: string[][];
  /**
   * v3.8.559 — 글 맨 위 "결론부터" 블록의 재료.
   * 요약표를 만드는 호출에서 함께 받아 온다(AI 호출을 새로 늘리지 않기 위해).
   * 셋 다 없을 수 있다 — 없으면 결론 블록을 그리지 않는다.
   */
  question?: string;
  answer?: string;
  /** 근거가 되는 기관과 기준일 (예: "국세청 · 2026-08 기준") */
  basis?: string;
}

export interface FinalCTAData {
  hookingMessage: string;
  buttonText: string;
  url: string;
  position?: number; // 선택적 속성으로 변경
  type?: string;     // 'link' | 'button'
  design?: string;   // 'button' | 'text'
  text?: string;     // buttonText 별칭
  hook?: string;     // hookingMessage 별칭
  searchFallback?: boolean; // 검증된 직접 URL을 못 찾았을 때 쓰는 투명한 검색 fallback
  /** v3.8.745 — 지금 할 수 있는가(근거·패킷으로만 정함). 없으면 UNKNOWN. "바로 할 수 있다" 는 AVAILABLE 일 때만 */
  actionStatus?: 'AVAILABLE' | 'UNKNOWN' | 'UNAVAILABLE';
}

export interface FinalArticleStructure {
  h1Title: string;
  thumbnail: string;
  tocHtml: string; // 목차 HTML
  h2Sections: Array<{
    h2: string;
    h3Sections: Array<{
      h3: string;
      content: string;
      tables: FinalTableData[];
      cta?: FinalCTAData;
    }>;
  }>;
  summaryTable: FinalTableData;
  disclaimer: string;
  hashtags: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

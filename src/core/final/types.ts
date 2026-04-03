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
  source: 'naver' | 'rss' | 'tistory' | 'wordpress' | 'news' | 'cafe' | 'external';
}

export interface FinalTableData {
  type: 'feature' | 'example' | 'summary' | 'info' | 'comparison' | 'checklist';
  headers: string[];
  rows: string[][];
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

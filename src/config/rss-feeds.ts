/**
 * RSS 피드 설정
 */

export interface FeedSource {
  url: string;
  name: string;
  category: string;
  priority: number; // 1-10, 높을수록 우선순위
  enabled: boolean;
  lastChecked?: string;
  errorCount: number;
}

export const RSS_FEEDS: FeedSource[] = [
  // 네이버 관련 RSS
  {
    url: 'https://search.naver.com/search.naver?where=rss&query={keyword}',
    name: '네이버 검색 RSS',
    category: 'search',
    priority: 10,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/100.xml',
    name: '네이버 뉴스 - 정치',
    category: 'news',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/101.xml',
    name: '네이버 뉴스 - 경제',
    category: 'news',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/102.xml',
    name: '네이버 뉴스 - 사회',
    category: 'news',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/103.xml',
    name: '네이버 뉴스 - 생활',
    category: 'news',
    priority: 9,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/104.xml',
    name: '네이버 뉴스 - 세계',
    category: 'news',
    priority: 7,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://news.naver.com/rss/section/105.xml',
    name: '네이버 뉴스 - IT',
    category: 'news',
    priority: 9,
    enabled: true,
    errorCount: 0
  },

  // 주요 언론사 RSS
  {
    url: 'https://www.chosun.com/arc/outboundfeeds/rss/',
    name: '조선일보',
    category: 'newspaper',
    priority: 9,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://www.joongang.co.kr/rss/home.xml',
    name: '중앙일보',
    category: 'newspaper',
    priority: 9,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://www.hani.co.kr/rss/',
    name: '한겨레',
    category: 'newspaper',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.donga.com/total.xml',
    name: '동아일보',
    category: 'newspaper',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.khan.co.kr/kh_news.xml',
    name: '경향신문',
    category: 'newspaper',
    priority: 7,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.mk.co.kr/rss/30000001.xml',
    name: '매일경제',
    category: 'newspaper',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.hankyung.com/new/news_main.xml',
    name: '한국경제',
    category: 'newspaper',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.edaily.co.kr/edaily.xml',
    name: '이데일리',
    category: 'newspaper',
    priority: 7,
    enabled: true,
    errorCount: 0
  },

  // 방송사 RSS
  {
    url: 'https://rss.news.naver.com/sbs.xml',
    name: 'SBS 뉴스',
    category: 'broadcast',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.news.naver.com/kbs.xml',
    name: 'KBS 뉴스',
    category: 'broadcast',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://rss.news.naver.com/mbc.xml',
    name: 'MBC 뉴스',
    category: 'broadcast',
    priority: 8,
    enabled: true,
    errorCount: 0
  },

  // 블로그 플랫폼
  {
    url: 'https://medium.com/feed/tag/{keyword}',
    name: 'Medium',
    category: 'blog',
    priority: 6,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://brunch.co.kr/rss/{keyword}',
    name: '브런치',
    category: 'blog',
    priority: 7,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://www.tistory.com/rss/{keyword}',
    name: '티스토리',
    category: 'blog',
    priority: 8,
    enabled: true,
    errorCount: 0
  },

  // 기술/IT 관련
  {
    url: 'https://feeds.feedburner.com/techcrunch/startups',
    name: 'TechCrunch',
    category: 'tech',
    priority: 6,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://feeds.feedburner.com/oreilly/radar',
    name: 'O\'Reilly Radar',
    category: 'tech',
    priority: 5,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://feeds.feedburner.com/naver/datalab',
    name: '네이버 데이터랩',
    category: 'tech',
    priority: 8,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://feeds.feedburner.com/kakao/tech',
    name: '카카오 기술블로그',
    category: 'tech',
    priority: 7,
    enabled: true,
    errorCount: 0
  },

  // 쇼핑/리뷰
  {
    url: 'https://feeds.feedburner.com/coupang/blog',
    name: '쿠팡 블로그',
    category: 'shopping',
    priority: 7,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://feeds.feedburner.com/11st/blog',
    name: '11번가 블로그',
    category: 'shopping',
    priority: 6,
    enabled: true,
    errorCount: 0
  },

  // 라이프스타일
  {
    url: 'https://feeds.feedburner.com/ohmynews',
    name: '오마이뉴스',
    category: 'lifestyle',
    priority: 6,
    enabled: true,
    errorCount: 0
  },
  {
    url: 'https://feeds.feedburner.com/pressian',
    name: '프레시안',
    category: 'lifestyle',
    priority: 6,
    enabled: true,
    errorCount: 0
  }
];

export const getFeedsByCategory = (category: string): FeedSource[] => {
  return RSS_FEEDS.filter(feed => feed.category === category && feed.enabled);
};

export const getEnabledFeeds = (): FeedSource[] => {
  return RSS_FEEDS.filter(feed => feed.enabled);
};

export const getHighPriorityFeeds = (minPriority: number = 8): FeedSource[] => {
  return RSS_FEEDS.filter(feed => feed.enabled && feed.priority >= minPriority);
};

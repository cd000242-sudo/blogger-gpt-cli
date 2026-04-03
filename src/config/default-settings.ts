/**
 * 기본 설정값들
 */

export interface CrawlSettings {
  // 네이버 API 설정
  naver: {
    maxResults: number;
    sort: 'sim' | 'date';
    includeViews: boolean;
    useCache: boolean;
    cacheExpiry: number; // seconds
  };
  
  // RSS 설정
  rss: {
    maxResults: number;
    concurrentFeeds: number;
    timeout: number;
    dateFilter: string; // ISO date string
  };
  
  // Google CSE 설정
  cse: {
    maxResults: number;
    dateRestrict: 'd1' | 'w1' | 'm1' | 'y1' | 'y2' | 'y5' | 'y10' | 'y20';
    siteSearch: string;
    language: string;
    country: string;
  };
  
  // Puppeteer 설정
  puppeteer: {
    timeout: number;
    takeScreenshot: boolean;
    extractImages: boolean;
    extractMetadata: boolean;
    concurrentPages: number;
  };
  
  // 중복 제거 설정
  deduplication: {
    strategies: Array<'url' | 'title' | 'similarity'>;
    similarityThreshold: number;
    caseSensitive: boolean;
    normalizeWhitespace: boolean;
  };
  
  // 정렬 설정
  sorting: {
    primary: 'date' | 'popularity' | 'relevance';
    secondary: 'date' | 'popularity' | 'relevance';
    order: 'asc' | 'desc';
  };
  
  // 성능 설정
  performance: {
    enableMonitoring: boolean;
    memoryLimitMB: number;
    maxConcurrentRequests: number;
    requestDelay: number; // ms
  };
}

export const DEFAULT_CRAWL_SETTINGS: CrawlSettings = {
  naver: {
    maxResults: 1000,
    sort: 'sim',
    includeViews: true,
    useCache: true,
    cacheExpiry: 3600 // 1시간
  },
  
  rss: {
    maxResults: 5000,
    concurrentFeeds: 100,
    timeout: 10000,
    dateFilter: '2024-01-01T00:00:00.000Z' // 1년 전부터
  },
  
  cse: {
    maxResults: 100,
    dateRestrict: 'y1', // 최근 1년
    siteSearch: 'blog.naver.com OR tistory.com OR *.co.kr OR brunch.co.kr',
    language: 'ko',
    country: 'kr'
  },
  
  puppeteer: {
    timeout: 30000,
    takeScreenshot: false,
    extractImages: true,
    extractMetadata: true,
    concurrentPages: 5
  },
  
  deduplication: {
    strategies: ['url', 'title', 'similarity'],
    similarityThreshold: 0.8,
    caseSensitive: false,
    normalizeWhitespace: true
  },
  
  sorting: {
    primary: 'date',
    secondary: 'popularity',
    order: 'desc'
  },
  
  performance: {
    enableMonitoring: true,
    memoryLimitMB: 1024,
    maxConcurrentRequests: 50,
    requestDelay: 100
  }
};

export interface SiteConfig {
  selectors: {
    content: string[];
    title: string[];
    author: string[];
    date: string[];
    tags: string[];
    description: string[];
  };
  waitFor?: string;
  removeSelectors?: string[];
}

export const SITE_CONFIGS: Record<string, SiteConfig> = {
  'blog.naver.com': {
    selectors: {
      content: [
        '.se-main-container',
        '#postViewArea',
        '.post-view',
        '.post-content',
        '.se-text-paragraph',
        '.se-component-content'
      ],
      title: [
        '.se-title-text',
        '.post-title',
        'h1',
        'title'
      ],
      author: [
        '.nick',
        '.blogger',
        '.author',
        '[data-module="BlogAuthor"]'
      ],
      date: [
        '.se_publishDate',
        '.post-date',
        '.publish-date',
        'time'
      ],
      tags: [
        '.tag',
        '.tags a',
        '.post-tags a'
      ],
      description: [
        '.se-text-paragraph p:first-child',
        '.post-summary',
        'meta[name="description"]'
      ]
    },
    waitFor: '.se-main-container',
    removeSelectors: [
      '.ad',
      '.advertisement',
      '.sponsor',
      '.related-posts',
      '.comments'
    ]
  },
  
  'tistory.com': {
    selectors: {
      content: [
        '.entry-content',
        '.post-content',
        '.article-content',
        '.content'
      ],
      title: [
        '.entry-title',
        '.post-title',
        'h1',
        'title'
      ],
      author: [
        '.author',
        '.writer',
        '.blogger'
      ],
      date: [
        '.date',
        '.publish-date',
        'time'
      ],
      tags: [
        '.tag',
        '.tags a',
        '.post-tags a'
      ],
      description: [
        '.entry-summary',
        '.post-summary'
      ]
    },
    waitFor: '.entry-content',
    removeSelectors: [
      '.ad',
      '.advertisement',
      '.sponsor',
      '.related-posts'
    ]
  },
  
  'brunch.co.kr': {
    selectors: {
      content: [
        '.wrap_article',
        '.article_content',
        '.content'
      ],
      title: [
        '.wrap_title h1',
        '.article_title',
        'h1'
      ],
      author: [
        '.wrap_author',
        '.author_name',
        '.writer'
      ],
      date: [
        '.wrap_date',
        '.publish_date',
        'time'
      ],
      tags: [
        '.wrap_tag a',
        '.tags a'
      ],
      description: [
        '.wrap_summary',
        '.article_summary'
      ]
    },
    waitFor: '.wrap_article',
    removeSelectors: [
      '.ad',
      '.advertisement',
      '.sponsor'
    ]
  },
  
  'default': {
    selectors: {
      content: [
        'article',
        '.content',
        '.post-content',
        '.entry-content',
        'main',
        '.main-content'
      ],
      title: [
        'h1',
        '.title',
        '.post-title',
        'title'
      ],
      author: [
        '.author',
        '.writer',
        '.byline'
      ],
      date: [
        'time',
        '.date',
        '.publish-date'
      ],
      tags: [
        '.tags a',
        '.tag',
        '.categories a'
      ],
      description: [
        'meta[name="description"]',
        '.summary',
        '.excerpt'
      ]
    },
    removeSelectors: [
      '.ad',
      '.advertisement',
      '.sponsor',
      '.related-posts',
      '.comments',
      '.sidebar'
    ]
  }
};

export const getSiteConfig = (hostname: string): SiteConfig => {
  // 정확한 매치
  if (SITE_CONFIGS[hostname]) {
    return SITE_CONFIGS[hostname];
  }
  
  // 부분 매치
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site) || site.includes(hostname)) {
      return config;
    }
  }
  
  // 기본 설정 반환
  const defaultConfig = SITE_CONFIGS['default'];
  if (!defaultConfig) {
    throw new Error('Default site config not found');
  }
  return defaultConfig;
};

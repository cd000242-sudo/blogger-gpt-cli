# 🚀 프리미엄 블로그 자동화 앱 - 대량 크롤링 시스템

## 📋 개요

이 앱은 AI 기반 블로그 콘텐츠 생성과 **대량 크롤링 시스템**을 결합한 프리미엄 블로그 자동화 도구입니다. 네이버 API, RSS 피드, Google CSE를 활용하여 수천 개의 데이터를 수집하고 분석하여 고품질 콘텐츠를 생성합니다.

## ✨ 주요 기능

### 🔥 대량 크롤링 시스템 (NEW!)

- **네이버 API 크롤러**: 동시 50개 요청으로 1000개+ 데이터 수집
- **RSS 대량 크롤러**: 200개+ RSS 피드에서 병렬 크롤링
- **Google CSE 크롤러**: 보완용 검색으로 누락 데이터 보충
- **Puppeteer 통합**: 전체 본문 크롤링 및 이미지 추출
- **스마트 중복 제거**: URL, 제목, 유사도 기반 다중 전략
- **인기도 분석**: 최신성, 제목 길이, 키워드 포함도 기반 점수 계산
- **성능 모니터링**: 실시간 처리 속도 및 메모리 사용량 추적

### 🤖 AI 콘텐츠 생성

- **다중 AI 지원**: OpenAI GPT-4, Google Gemini
- **스마트 제목 생성**: SEO 최적화된 제목 자동 생성
- **구조화된 본문**: H2/H3 구조로 체계적인 콘텐츠 구성
- **동적 CTA 생성**: AI 기반 행동 유도 버튼 및 링크 생성
- **키워드 분석**: 트렌딩 키워드 및 경쟁사 분석

### 📊 고급 분석 기능

- **콘텐츠 품질 분석**: 제목 길이, 내용 풍부도, 구조화 데이터 기반 점수
- **키워드 빈도 분석**: 상위 키워드 및 트렌딩 토픽 추출
- **경쟁사 분석**: 도메인별 콘텐츠 수 및 평균 점수 분석
- **성능 리포트**: 크롤링 속도, 메모리 사용량, API 호출 통계

## 🛠️ 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env` 파일을 생성하고 다음 정보를 입력하세요:

```env
# OpenAI API 키
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API 키
GEMINI_API_KEY=your_gemini_api_key_here

# 네이버 API 설정 (대량 크롤링용)
NAVER_CLIENT_ID=your_naver_client_id_here
NAVER_CLIENT_SECRET=your_naver_client_secret_here

# Google API 설정 (대량 크롤링용)
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CSE_ID=your_google_cse_id_here

# 대량 크롤링 설정
MASS_CRAWLING_ENABLED=true
MAX_CONCURRENT_REQUESTS=20
MAX_RESULTS_PER_SOURCE=1000
ENABLE_FULL_CONTENT_CRAWLING=true
```

### 3. API 키 발급 방법

#### 네이버 검색 API
1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. 애플리케이션 등록
3. 검색 API 사용 설정
4. Client ID, Client Secret 발급

#### Google Custom Search Engine
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. Custom Search API 활성화
3. API 키 생성
4. [Custom Search Engine](https://cse.google.com/) 생성
5. 검색 엔진 ID 발급

## 🚀 사용법

### 기본 사용법

```bash
# 앱 실행
npm start

# 또는 직접 실행
node src/cli.ts
```

### 대량 크롤링 테스트

```bash
# 기본 크롤링 테스트
node test-mass-crawler.js "블로그 마케팅"

# 대량 크롤링 테스트 (200개 수집)
node test-mass-crawler.js "AI 도구" --max-results=200 --full-content

# 성능 벤치마크 테스트
node test-mass-crawler.js "SEO" --benchmark

# 다중 키워드 테스트
node test-mass-crawler.js "마케팅" --multi-keyword
```

### 프로그래밍 방식 사용

```typescript
import { MassCrawlingSystem, ContentCrawler } from './src/core';

// 대량 크롤링 시스템 초기화
const massCrawler = new MassCrawlingSystem(
  'your_naver_client_id',
  'your_naver_client_secret',
  'your_google_api_key',
  'your_google_cse_id'
);

// 기본 크롤링
const result = await massCrawler.crawlAll('블로그 마케팅', {
  maxResults: 1000,
  enableFullContent: true,
  maxConcurrent: 20
});

console.log(`수집된 데이터: ${result.stats.totalItems}개`);
console.log(`네이버: ${result.stats.naverCount}개`);
console.log(`RSS: ${result.stats.rssCount}개`);
console.log(`CSE: ${result.stats.cseCount}개`);

// ContentCrawler를 통한 고급 크롤링
const contentCrawler = new ContentCrawler('your_openai_key', 'your_gemini_key');
contentCrawler.initializeMassCrawler(
  'your_naver_client_id',
  'your_naver_client_secret',
  'your_google_api_key',
  'your_google_cse_id'
);

// 다중 키워드 크롤링
const multiResult = await contentCrawler.crawlMassiveMultiKeyword(
  '블로그 마케팅',
  ['블로그 마케팅', '콘텐츠 마케팅', 'SEO', '인플루언서 마케팅'],
  {
    maxResults: 2000,
    enableFullContent: true,
    maxConcurrent: 20
  }
);

console.log('분석 결과:', multiResult.analysis);
console.log('생성된 CTA:', multiResult.ctas);
```

## 📊 성능 특징

### 크롤링 성능
- **네이버 API**: 동시 50개 요청, 초당 100개+ 수집
- **RSS 크롤러**: 200개+ 피드 병렬 처리, 초당 200개+ 수집
- **Google CSE**: 보완용 검색, 초당 50개+ 수집
- **전체 본문**: Puppeteer 기반, 동시 20개 처리

### 메모리 최적화
- 스트리밍 처리로 메모리 사용량 최소화
- 중복 제거로 저장 공간 절약
- 배치 처리로 안정성 향상

### 안정성
- 자동 재시도 메커니즘
- Rate Limiting 준수
- 에러 핸들링 및 폴백 시스템

## 🔧 고급 설정

### 크롤링 옵션

```typescript
interface MassCrawlingOptions {
  maxResults?: number;           // 최대 수집 개수
  sort?: 'sim' | 'date';        // 정렬 방식
  includeViews?: boolean;       // 조회수 포함 여부
  dateRestrict?: string;        // 날짜 제한
  siteSearch?: string;          // 사이트 검색
  enableFullContent?: boolean;  // 전체 본문 크롤링
  maxConcurrent?: number;       // 최대 동시 요청 수
}
```

### 성능 튜닝

```typescript
// 고성능 설정
const highPerformanceOptions = {
  maxResults: 5000,
  maxConcurrent: 50,
  enableFullContent: true,
  sort: 'sim' as const
};

// 안정성 우선 설정
const stableOptions = {
  maxResults: 1000,
  maxConcurrent: 10,
  enableFullContent: false,
  sort: 'date' as const
};
```

## 📈 모니터링 및 분석

### 성능 리포트

```typescript
// 성능 모니터링 활성화
const crawler = new MassCrawlingSystem(/* ... */);
const result = await crawler.crawlAll('키워드', {
  enablePerformanceMonitoring: true
});

// 성능 리포트 출력
crawler.generatePerformanceReport();
```

### 콘텐츠 분석

```typescript
const analysis = result.analysis;

console.log('상위 키워드:', analysis.topKeywords);
console.log('트렌딩 토픽:', analysis.trendingTopics);
console.log('고품질 콘텐츠:', analysis.contentQuality);
console.log('경쟁사 분석:', analysis.competitorAnalysis);
```

## 🚨 주의사항

### API 제한
- **네이버 API**: 일일 25,000회 제한
- **Google CSE**: 일일 100회 제한 (유료 플랜 필요)
- **RSS 피드**: 사이트별 Rate Limiting 준수

### 법적 고려사항
- 저작권 준수
- robots.txt 준수
- 개인정보 보호
- 서비스 약관 준수

### 성능 고려사항
- 메모리 사용량 모니터링
- 네트워크 대역폭 고려
- 서버 리소스 관리

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 다음을 통해 연락해주세요:

- GitHub Issues
- 이메일: support@example.com
- 문서: [Wiki 페이지](https://github.com/your-repo/wiki)

---

**⚡ 대량 크롤링 시스템으로 블로그 콘텐츠의 새로운 차원을 경험해보세요!**

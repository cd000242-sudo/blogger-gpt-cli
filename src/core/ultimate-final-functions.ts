/**
 * 🔥 최종 끝판왕 블로그 자동화 시스템
 *
 * ✅ 대량 크롤링 (네이버50 + RSS30 + 티스토리/워드프레스/뉴스/카페)
 * ✅ 폴백 시스템 (RSS → 네이버API → 구글CSE → Gemini 직접생성)
 * ✅ 완벽한 글 구조 (H1 → 썸네일 → 목차 → H2 5개 → H3 각3개 → CTA → 요약표 → 면책)
 * ✅ SEO 최적화 (네이버/구글)
 * ✅ 워드프레스/블로그스팟 자동 설정
 * ✅ 1분 내 생성
 *
 * 📁 실제 구현은 ./final/ 모듈에 분할되어 있습니다.
 */

export {
  // Types & Config
  FINAL_CONFIG,
  type FinalCrawledPost,
  type FinalTableData,
  type FinalCTAData,
  type FinalArticleStructure,
  type FAQItem,

  // Image Helpers
  uploadBase64ToImageHost,
  getShoppingCrawler,

  // Crawlers
  isNaverShoppingUrl,
  extractShopInfoFromUrl,
  formatStoreName,
  extractNaverShoppingInfo,
  generateShoppingReviewContent,
  generateFallbackShoppingContent,
  generateSmartShoppingContent,
  generateBasicShoppingContent,
  crawlSingleUrlFast,
  crawlTistory,
  crawlWordPress,
  crawlNews,
  crawlCafe,
  crawlNaverFinal,
  crawlRSSFinal,
  crawlFullContentFinal,
  crawlAllWithFallback,

  // Gemini Engine
  GEMINI_MODELS,
  GROUNDING_MODELS,
  callGeminiWithRetry,
  callGeminiWithGrounding,

  // Generation
  generateH1TitleFinal,
  generateH2TitlesFinal,
  generateH3TitlesFinal,
  generateAllSectionsFinal,
  generateFAQFinal,
  buildFAQHtml,
  generateH2SectionFinal,
  generateH3ContentFinal,
  applySmartLinkToContent,
  generateCTAsFinal,
  generateSummaryTableFinal,
  generateHashtagsFinal,

  // HTML/CSS
  generateCSSFinal,
  generateTOCFinal,
  generateWPFloatingTOC,
  generateBloggerTOCFinal,

  // Orchestration
  generateUltimateMaxModeArticleFinal,
} from './final';

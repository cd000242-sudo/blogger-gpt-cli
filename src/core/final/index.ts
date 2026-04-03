/**
 * ultimate-final-functions 모듈 통합 진입점
 *
 * 원본: src/core/ultimate-final-functions.ts (4,669줄)
 * 분할: types, image-helpers, crawlers, gemini-engine, generation, html, orchestration
 */

// Types & Config
export {
  FINAL_CONFIG,
  type FinalCrawledPost,
  type FinalTableData,
  type FinalCTAData,
  type FinalArticleStructure,
  type FAQItem,
} from './types';

// Image Helpers
export { uploadBase64ToImageHost, getShoppingCrawler } from './image-helpers';

// Crawlers
export {
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
} from './crawlers';

// Gemini Engine
export {
  GEMINI_MODELS,
  GROUNDING_MODELS,
  callGeminiWithRetry,
  callGeminiWithGrounding,
} from './gemini-engine';

// Generation (titles, sections, FAQ, CTA, etc.)
export {
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
} from './generation';

// HTML/CSS
export {
  generateCSSFinal,
  generateTOCFinal,
  generateWPFloatingTOC,
  generateBloggerTOCFinal,
} from './html';

// Orchestration (main function)
export { generateUltimateMaxModeArticleFinal } from './orchestration';

// src/core/url-image-crawler/index.ts
// URL 이미지 자동 수집 + 부족분 AI 생성 — 통합 진입점
// 원본: cd000242-sudo/naver v2.7.66~77 시리즈 이식
//
// 사용 흐름:
//   1) 사용자가 글 입력 영역에 URL 입력 + [부족분 AI] 체크박스 ON
//   2) IPC 핸들러가 crawlAndCollect() 호출
//   3) URL → Puppeteer로 본문 이미지 추출 (BANNED 차단, 150px+ 필터, iframe 20개 순회)
//   4) AI 검증 옵션 시 글 생성 AI와 동일 vendor로 vision 평가 (60점 미만 차단)
//   5) Downloads/{projectName}-images/{postTitle}/ 자동 저장
//   6) 부족분(목표 N - 수집 M < 0) 시 imageDispatcher로 AI 생성 트리거

import { crawlImagesFromUrl, downloadImagesToFolder, type CrawlImageResult, type DownloadResult } from './urlImageCrawler';
import { filterImagesByRelevance, type RelevanceCheckOptions } from './imageRelevanceScorer';
import { resetVisionBudget, getVisionBudget } from './visionBudgetGuard';
import { routeTextToVision, type VisionRouting } from './visionRouter';

export { crawlImagesFromUrl, downloadImagesToFolder } from './urlImageCrawler';
export { filterImagesByRelevance, fetchImageBuffer, detectMimeType, parseScoreJson } from './imageRelevanceScorer';
export { resetVisionBudget, getVisionBudget, chargeAndCheck } from './visionBudgetGuard';
export { routeTextToVision, VISION_MODELS } from './visionRouter';
export type { VisionRouting, VisionProviderKey } from './visionRouter';
export type { CrawlImageResult, DownloadResult } from './urlImageCrawler';
export type { RelevanceCheckOptions } from './imageRelevanceScorer';

export interface CrawlAndCollectOptions {
  url: string;
  postTitle: string;
  mainKeyword: string;
  /** Downloads 베이스 경로 (Electron app.getPath('downloads')) */
  downloadsBase: string;
  /** 프로젝트명 (폴더 prefix) */
  projectName?: string;
  /** AI 검증 ON 여부 */
  aiCheckEnabled?: boolean;
  /** 글 생성 AI 키 (vision 라우팅용) */
  textGenerator?: string;
  /** API 키 묶음 */
  apiKeys?: { gemini?: string; claude?: string; openai?: string };
  /** 60점 임계값 (기본 60) */
  threshold?: number;
}

export interface CrawlAndCollectResult {
  ok: boolean;
  /** 추출된 모든 이미지 URL (필터 전) */
  rawImages: string[];
  /** AI 검증 통과 또는 검증 비활성 */
  acceptedImages: string[];
  /** 저장된 로컬 경로 */
  savedFiles: string[];
  /** 저장 디렉토리 절대 경로 */
  saveDir: string;
  /** 검증된 vendor (vision 사용 시) */
  routing?: VisionRouting | undefined;
  /** 누적 비용 (KRW) */
  costKrw: number;
  /** 오류 메시지 */
  error?: string;
}

/**
 * URL 이미지 수집 + AI 검증 + 저장 통합 실행.
 *
 * payload 흐름:
 *   payload.urlImageSource = { url, aiCheckEnabled, textGenerator, threshold }
 *   orchestration이 본문 이미지 보강 시 acceptedImages 사용
 */
export async function crawlAndCollect(opts: CrawlAndCollectOptions): Promise<CrawlAndCollectResult> {
  if (!opts.url || !/^https?:\/\//i.test(opts.url)) {
    return {
      ok: false,
      rawImages: [],
      acceptedImages: [],
      savedFiles: [],
      saveDir: '',
      costKrw: 0,
      error: 'URL이 비었거나 http(s) 프로토콜이 아닙니다',
    };
  }

  resetVisionBudget();
  const projectName = opts.projectName || 'LEADERNAM-Orbit';

  // 1) 크롤링
  const crawled: CrawlImageResult = await crawlImagesFromUrl(opts.url);
  if (crawled.images.length === 0) {
    return {
      ok: false,
      rawImages: [],
      acceptedImages: [],
      savedFiles: [],
      saveDir: '',
      costKrw: 0,
      error: 'URL에서 이미지를 찾지 못했습니다 (BANNED 패턴 차단 또는 빈 페이지)',
    };
  }

  // 2) AI 검증 (옵션)
  let accepted = crawled.images;
  let routing: VisionRouting | undefined;
  if (opts.aiCheckEnabled) {
    const relOpts: RelevanceCheckOptions = {
      enabled: true,
      textGenerator: opts.textGenerator || 'gemini-2.5-flash',
      apiKeys: opts.apiKeys || {},
      threshold: opts.threshold ?? 60,
    };
    const r = await filterImagesByRelevance(crawled.images, opts.postTitle, opts.mainKeyword, relOpts);
    accepted = r.filtered;
    routing = r.routing;
  }

  // 3) 다운로드 저장
  const dl: DownloadResult = await downloadImagesToFolder(accepted, {
    downloadsBase: opts.downloadsBase,
    projectName,
    postTitle: opts.postTitle,
  });

  return {
    ok: true,
    rawImages: crawled.images,
    acceptedImages: accepted,
    savedFiles: dl.saved,
    saveDir: dl.saveDir,
    routing,
    costKrw: getVisionBudget().krw,
  };
}

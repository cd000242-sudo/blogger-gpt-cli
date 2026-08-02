/**
 * 메인 오케스트레이션 함수
 * generateUltimateMaxModeArticleFinal: 끝판왕 블로그 글 생성 메인 함수
 */

import axios from 'axios';
import { loadEnvFromFile } from '../../env';
import {
  getGeminiApiKey, getPerplexityApiKey, getOpenAIApiKey,
  callPerplexityAPI,
} from '../llm';
import { makeNanoBananaProThumbnail } from '../../thumbnail';
import { dispatchH2ImageGeneration, dispatchThumbnailGeneration } from '../imageDispatcher';
import { runImageGenerationQueued } from '../image-generation-queue';
import '../content-modes/register-all'; // 5개 모드 플러그인 자동 등록
import { generateContentFromUrl, generateContentFromUrls } from '../url-content-generator';
import { validateCtaUrl, validateCtaUrlFormat } from '../../cta/validate-cta-url';
import { findRelatedPosts, insertInternalLinks } from '../internal-links';
import { analyzeKeywordDemand } from '../keyword-demand';
import { analyzeKeywordAngle, composeTitleDirective } from '../keyword-angle';
import { buildUniquenessBlock } from './substance-rules';
import { collectOfficialSources, buildOfficialSourceBlock } from './official-sources';
import {
  normalizeExperience, hasExperience, buildExperienceBlock, NO_EXPERIENCE_GUARD,
} from './experience-block';
import { suggestNarrowerKeywords, buildNarrowFocusBlock } from '../keyword-narrowing';
import { INTERNAL_CONSISTENCY_SECTIONS } from '../max-mode-structure';
import { SHOPPING_CONVERSION_MODE_SECTIONS, PARAPHRASING_PROFESSIONAL_MODE_SECTIONS } from '../max-mode/mode-sections-extended';
import { fetchFactContext, type FactCheckMode } from '../perplexityFactCheck';
import { searchCoupangProducts, createCoupangDeeplink, formatProductsForPrompt, renderCoupangProductBlock, renderCoupangDisclosureBanner, enforceCoupangCompliance } from '../coupang-partners';
import { uploadBase64ToImageHost } from './image-helpers';
import { resolveUrlModeKeyword } from './url-mode';
import { crawlSingleUrlFast } from './crawlers';
import { callGeminiWithGrounding, callGeminiWithRetry } from './gemini-engine';
import { FinalCrawledPost, FinalTableData, FinalCTAData } from './types';
import {
  generateH1TitleFinal, generateH2TitlesFinal, generateSectionTitlesFromRoles,
  generateAllSectionsFinal, generateFAQFinal, buildFAQHtml,
  sanitizeCtaText,
  generateCTAsFinal, generateSummaryTableFinal, generateHashtagsFinal,
  detectKeywordScope,
  generateIntentAwareFallbackH2Titles,
  isContextuallySafeCtaUrl,
} from './generation';

function normalizeFolderHeadingKey(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*\d+[.)\-:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getFolderImageH2Titles(payload: any): string[] {
  const direct = Array.isArray(payload?.folderImageH2Titles) ? payload.folderImageH2Titles : [];
  const fromMappings = Array.isArray(payload?.preGeneratedImages)
    ? payload.preGeneratedImages.map((item: any) => item?.h2Title)
    : [];
  return [...(direct.length > 0 ? direct : fromMappings)]
    .map((title) => String(title || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
}
import { generateCSSFinal, generateTOCFinal } from './html';
import { buildEeatMeta, EEAT_META_CSS } from './eeat-meta';
import { scanSubstance, buildSubstanceRetryBlock } from './substance-gate';
import { acquireEngineLock } from './engine-lock';
import { buildSchemaJsonLd } from './schema-jsonld';
import { scanAdsensePolicy } from './policy-scanner';
import { scanAdsenseHardening } from './adsense-hardening';
import { scanContentQuality } from './quality-gate';
import { validateArticleQuality } from './quality-gate';
import { dispatchMode } from './mode-dispatcher';
import { applyFinalSeoEnhancements } from './seo-enhancements';
import {
  buildFactIntegrityPrompt,
  inspectArticleFactIntegrity,
  inspectFactIntegrity,
  sanitizeArticleFactClaims,
  sanitizeFactUnsafeHtml,
  sanitizeFactUnsafeHeading,
  type FactEvidence,
} from './fact-integrity';

// 🎯 동시 실행 시 process.env 충돌 방지 세마포어 — v3.8.380부터 ./engine-lock.ts 로 이동 (대기자 워치독 포함)

const FINAL_CTA_BOX_STYLE = 'margin:32px auto !important;padding:26px 24px !important;background:var(--rv-cta-bg,linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%)) !important;border:1px solid var(--rv-cta-border,#93c5fd) !important;border-radius:10px !important;text-align:center !important;display:flex !important;flex-direction:column !important;align-items:center !important;gap:12px !important;box-sizing:border-box !important;max-width:100% !important;';
const FINAL_CTA_BADGE_STYLE = 'display:inline-flex !important;align-items:center !important;justify-content:center !important;padding:5px 12px !important;background:var(--rv-cta-badge-bg,#eff6ff) !important;color:var(--rv-cta-note,#0369a1) !important;-webkit-text-fill-color:var(--rv-cta-note,#0369a1) !important;border:1px solid var(--rv-cta-border,#bae6fd) !important;border-radius:999px !important;font-size:12px !important;font-weight:800 !important;line-height:1.2 !important;margin:0 !important;';
const FINAL_CTA_HOOK_STYLE = 'margin:0 !important;color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;font-size:16px !important;font-weight:700 !important;line-height:1.55 !important;word-break:keep-all !important;max-width:92% !important;';
const FINAL_CTA_BUTTON_STYLE = 'display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:220px !important;max-width:100% !important;min-height:48px !important;margin:2px auto 0 !important;padding:14px 28px !important;background:linear-gradient(135deg,var(--rv-cta-button-start,#0891b2) 0%,var(--rv-cta-button-end,#0284c7) 100%) !important;color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;border:0 !important;border-radius:8px !important;text-decoration:none !important;font-size:16px !important;font-weight:800 !important;line-height:1.35 !important;box-shadow:0 8px 18px var(--rv-cta-shadow,rgba(2,132,199,0.24)) !important;box-sizing:border-box !important;white-space:normal !important;word-break:keep-all !important;';
const FINAL_CTA_MICROCOPY_STYLE = 'display:block !important;width:100% !important;margin:0 !important;color:var(--rv-cta-note,#0369a1) !important;-webkit-text-fill-color:var(--rv-cta-note,#0369a1) !important;font-size:12px !important;font-weight:600 !important;line-height:1.5 !important;opacity:.86 !important;text-align:center !important;';
const FINAL_CTA_ACTION_STACK_STYLE = 'display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;gap:8px !important;width:100% !important;max-width:100% !important;margin:0 auto !important;text-align:center !important;';

const CTA_PLACEHOLDER_DOMAINS = [
  'example.com', 'your-site.com', 'placeholder.com', 'test.com',
  'yoursite.com', 'yourblog.com', 'myblog.com', 'mysite.com',
  'domain.com', 'website.com', 'sample.com', 'xxx.com',
  'abc.com', 'url.com', 'link.com'
];

function emitGeneratedImage(kind: string, label: string, url: string, meta: Record<string, any> = {}): void {
  if (!url) return;
  try {
    // Electron main process에서 실행될 때만 실시간 미리보기 이벤트를 전송한다.
    // CLI/테스트 환경에서는 require('electron')이 실패하므로 조용히 무시한다.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BrowserWindow } = require('electron');
    if (!BrowserWindow?.getAllWindows) return;
    BrowserWindow.getAllWindows().forEach((w: any) => {
      try {
        if (!w?.isDestroyed?.()) {
          w.webContents.send('sw-image-generated', { kind, label, url, ts: Date.now(), ...meta });
        }
      } catch { /* ignore per-window */ }
    });
  } catch { /* non-electron runtime */ }
}

type RenderableCtaCandidate = {
  label?: string;
  hookingMessage: string;
  buttonText: string;
  url: string;
  searchFallback?: boolean;
};

function isCtaUrlShapeSafe(url?: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  const formatCheck = validateCtaUrlFormat(value);
  if (!formatCheck.isValid) return false;
  const lower = value.toLowerCase();
  return !CTA_PLACEHOLDER_DOMAINS.some(d => lower.includes(d)) &&
    !value.includes('{{') && !value.includes('}}') &&
    !value.includes('[') && !value.includes(']') &&
    !/google\.com\/search|search\.naver\.com|search\.daum\.net|bing\.com\/search|m\.search/i.test(lower);
}

function isSearchFallbackUrl(url?: string): boolean {
  const value = String(url || '').trim().toLowerCase();
  return /^https:\/\//.test(value) &&
    /google\.com\/search|search\.naver\.com|search\.daum\.net|bing\.com\/search/i.test(value);
}

function isRenderableCta(item?: { url?: string; searchFallback?: boolean }): boolean {
  if (!item) return false;
  if (item.searchFallback === true) return isSearchFallbackUrl(item.url);
  return isCtaUrlShapeSafe(item.url);
}

function normalizeCtaUrlKey(url?: string): string {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const u = new URL(value);
    u.hash = '';
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString().toLowerCase();
  } catch {
    return value.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

function markRenderedCta(usedUrls: Set<string>, url?: string): void {
  const key = normalizeCtaUrlKey(url);
  if (key) usedUrls.add(key);
}

function pickRenderableCta<T extends { url: string; searchFallback?: boolean }>(
  items: T[],
  usedUrls?: Set<string>,
): T | undefined {
  return items.find(item => {
    if (!isRenderableCta(item)) return false;
    const key = normalizeCtaUrlKey(item.url);
    return !key || !usedUrls?.has(key);
  });
}

function toRenderableCtaCandidate(
  cta: FinalCTAData,
  fallbackHook: string,
  fallbackButton: string,
  label?: string,
): RenderableCtaCandidate {
  const candidate: RenderableCtaCandidate = {
    hookingMessage: cta.hookingMessage || fallbackHook,
    buttonText: cta.buttonText || fallbackButton,
    url: cta.url,
  };
  if (label) candidate.label = label;
  if (cta.searchFallback === true) candidate.searchFallback = true;
  return candidate;
}

function escapeHtmlText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFinalCtaBlock(input: {
  badge?: string;
  hook?: string;
  buttonText?: string;
  url?: string;
  microcopy?: string;
  marginTop?: number;
}): string {
  const badge = input.badge ? escapeHtmlText(sanitizeCtaText(input.badge)) : '';
  const hook = escapeHtmlText(sanitizeCtaText(input.hook || ''));
  const buttonText = escapeHtmlText(sanitizeCtaText(input.buttonText || 'Details'));
  const url = escapeHtmlAttr(input.url || '#');
  const ariaLabel = escapeHtmlAttr(sanitizeCtaText(input.buttonText || 'Details'));
  const microcopy = input.microcopy ? escapeHtmlText(sanitizeCtaText(input.microcopy)) : '';
  const boxStyle = input.marginTop != null
    ? FINAL_CTA_BOX_STYLE.replace(/margin:[^;]+;/, `margin:${input.marginTop}px auto 32px !important;`)
    : FINAL_CTA_BOX_STYLE;

  return `
<div class="cta-box" style="${boxStyle}">
  ${badge ? `<span class="cta-badge" style="${FINAL_CTA_BADGE_STYLE}">${badge}</span>` : ''}
  <p class="cta-hook" style="${FINAL_CTA_HOOK_STYLE}"><strong>${hook}</strong></p>
  <div class="cta-action-stack" style="${FINAL_CTA_ACTION_STACK_STYLE}">
    <a class="cta-btn" href="${url}" target="_blank" rel="nofollow noopener noreferrer" role="button" aria-label="${ariaLabel}" style="${FINAL_CTA_BUTTON_STYLE}">
      <span style="position:relative !important;z-index:2 !important;">${buttonText}</span>
    </a>
    ${microcopy ? `<span class="cta-microcopy" style="${FINAL_CTA_MICROCOPY_STYLE}">${microcopy}</span>` : ''}
  </div>
</div>
`;
}

function normalizeArticleBodySpacing(content: string): string {
  const addArticleClass = (attrs: string): string => {
    let nextAttrs = (attrs || '').replace(/style\s*=\s*(["'])[\s\S]*?\1/gi, '').trim();
    if (/class\s*=\s*(["'])[\s\S]*?\1/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/class\s*=\s*(["'])([\s\S]*?)\1/i, (_m, quote, className) => {
        const classes = String(className || '').split(/\s+/).filter(Boolean);
        if (!classes.includes('article-p')) classes.push('article-p');
        return `class=${quote}${classes.join(' ')}${quote}`;
      });
    } else {
      nextAttrs = `class="article-p"${nextAttrs ? ' ' + nextAttrs : ''}`;
    }
    return nextAttrs;
  };

  return String(content || '')
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/gi, '')
    .replace(/<p\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/p>/gi, '')
    .replace(/<div\b[^>]*(?:height\s*:|min-height\s*:|clear\s*:|margin\s*:)[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/div>/gi, '')
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>')
    .replace(/<p\b([^>]*)>/gi, (_match, attrs) => {
      const nextAttrs = addArticleClass(attrs);
      return `<p ${nextAttrs} style="margin:0 0 14px !important;line-height:1.75 !important;">`;
    })
    .replace(/(<\/p>)\s*<br\s*\/?>/gi, '$1')
    .trim();
}

export async function generateUltimateMaxModeArticleFinal(
  payload: any,
  env: any,
  onLog?: (s: string) => void
): Promise<{ html: string; title: string; labels: string[]; thumbnail: string; qualityReport?: any }> {
  // v3.8.356: 사용자가 선택한 말투/어투를 final 생성 경로에 전달 (module-scope 상태)
  //   generation.ts의 프롬프트 조립과 반말 치환 로직이 이 값을 참조
  try {
    const { setActiveToneStyle } = require('./generation');
    setActiveToneStyle(payload?.toneStyle);
    onLog?.(`[PROGRESS] 5% - 🎭 말투/어투 적용: ${payload?.toneStyle || 'professional'}`);
  } catch (e) {
    console.warn('[orchestration] setActiveToneStyle 실패:', (e as any)?.message);
  }
  const queueImageToken = typeof payload?.queueImageToken === 'string' ? payload.queueImageToken : '';

  // v3.8.397: 쇼핑 모드 차단 해제.
  //   v3.5.38(2026-04-24)에 "점검 중" 임시 차단으로 들어온 뒤 3개월 넘게 남아 있었다.
  //   당시엔 UI 드롭다운도 disabled 였고 이건 IPC/스케줄 우회를 막는 이중 가드였다.
  //   v3.8.386 에서 UI 잠금을 풀었지만 **이 백엔드 가드를 놓쳤고**, 그 위에
  //   쇼핑 이미지 전략(v3.8.385)·제휴마케팅(v3.8.395~396)을 전부 쌓아 올렸다.
  //   즉 만들어 놓은 기능 전체가 도달 불가 상태였다.
  //   차단 이유(점검)는 이미 해소됐고 사용자가 명시적으로 쇼핑 모드를 요구했으므로 제거한다.
  //   재발 방지: __tests__/shopping-mode-unblocked.test.ts 가 이 차단의 부활을 감시한다.

  // 🛡️ v3.7.11 — 라이선스 게이트: AI 이미지 사용 의도가 있으면 본문 생성 시작 전에 즉시 차단.
  //   무료 체험의 글포스팅 발행 컨텍스트는 이미지 포함 여부와 무관하게 허용한다.
  //   throw 시 IPC 핸들러가 캐치 → UI는 error.message로 PAYMENT_REQUIRED:<reason> 감지 → 결제 유도 모달.
  try {
    const isSkip = (v: any) => v === 'none' || v === 'skip';
    const placementMode = String(payload?.h2ImageMode || payload?.imagePolicy || payload?.h2Images?.mode || 'all').toLowerCase();
    const configuredSources = [
      payload?.h2ImageSource || payload?.h2Images?.source,
      payload?.thumbnailSource || payload?.thumbnailType || payload?.thumbnailMode,
      payload?.imageSource,
      payload?.preGeneratedThumbnail?.dataUrl || payload?.preGeneratedThumbnail?.url,
    ].filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
    const wantsImage = placementMode !== 'none' && configuredSources.some((value) => !isSkip(value));
    if (wantsImage) {
      const { checkImageGenAccess } = require('../../utils/license-tier-manager');
      const access = checkImageGenAccess({ allowFreeTrialPublishing: true });
      if (!access.allowed) {
        const blockMsg = `${access.message}\n\n결제: ${access.paymentUrl}\n1대1 문의: ${access.kakaoUrl}`;
        onLog?.(`[PROGRESS] 0% - 🛡️ ${access.message.split('\n')[0]}`);
        const err = new Error(`PAYMENT_REQUIRED:${access.reason}:${blockMsg}`);
        (err as any).paymentUrl = access.paymentUrl;
        (err as any).kakaoUrl = access.kakaoUrl;
        (err as any).reason = access.reason;
        throw err;
      }
    }
  } catch (e: any) {
    if (e?.message?.startsWith('PAYMENT_REQUIRED:')) throw e;
    console.warn('[orchestration] license gate check skipped (init error):', e?.message);
  }

  // CTA AI 엄격 검증은 기본 OFF. 사용자가 명시적으로 켠 경우에만 외부 AI 검증을 수행한다.
  // 기본 발행은 사이트 라이브러리/커스텀 CTA를 우선해 속도와 안정성을 확보한다.
  process.env['CTA_AI_VALIDATE_STRICT'] = payload?.ctaAiStrictMode === true ? 'true' : 'false';

  // 🖼️ 썸네일 엔진 엄격 모드 — 기본 OFF (다른 AI로 자동 폴백이 합리적)
  process.env['STRICT_THUMBNAIL_ENGINE'] = payload?.strictThumbnailEngine === true ? 'true' : 'false';

  // 🛡️ S-1 (v3.5.84): H2 섹션 이미지 엔진 엄격 모드 — 사용자 요청
  //   ON: 폴백 차단 — 선택한 엔진만 시도, 실패 시 자동 우회 가능한 에러만 우회, 우회 불가 시 발행 차단
  //   OFF (기본): 기존 폴백 체인 유지 (nanobanana → flow → deepinfra)
  process.env['STRICT_H2_IMAGE_ENGINE'] = payload?.strictH2ImageEngine === true ? 'true' : 'false';

  // 🛡️ S-3 (v3.5.84): 글 단위 Flow 차단 플래그 reset (5분 쿨다운 만료 전이라도 강제 해제)
  //   큐 모드에서 첫 글이 reCAPTCHA 차단되면 둘째 글부터 즉시 disable 회귀 차단.
  //   PERMISSION_DENIED(24h)는 reset 안 함 — Pro 미가입은 재시도 무의미.
  try {
    const { resetFlowDisabledFlag } = require('../flowGenerator');
    resetFlowDisabledFlag();
  } catch (e: any) {
    console.warn('[orchestration] resetFlowDisabledFlag 호출 실패 (skip):', e?.message);
  }

  // 🛡️ T-2 (v3.5.84): 글 단위 env 캐시 reset (큐 연속 발행 시 옛 캐시 사용 차단)
  try {
    const { resetImageDispatcherEnvCache } = require('../imageDispatcher');
    resetImageDispatcherEnvCache();
  } catch (e: any) {
    console.warn('[orchestration] resetImageDispatcherEnvCache 호출 실패 (skip):', e?.message);
  }

  // 🆕 URL 이미지 자동 수집 (cd000242-sudo/naver v2.7.77 이식)
  //    payload.urlImageSource = { url, aiCheckEnabled, aiFillEnabled, threshold }
  //    수집 결과를 payload.manualCrawlUrls 풀에 합류하여 이후 imageDispatcher가 활용
  if (payload?.urlImageSource?.url && /^https?:\/\//i.test(payload.urlImageSource.url)) {
    try {
      const { crawlAndCollect } = require('../url-image-crawler');
      const { app } = require('electron');
      const downloadsBase = (app && typeof app.getPath === 'function') ? app.getPath('downloads') : (process.env['USERPROFILE'] || '.') + '/Downloads';
      onLog?.(`[PROGRESS] 1% - 🔗 URL 이미지 자동 수집 시작: ${String(payload.urlImageSource.url).slice(0, 80)}`);
      const apiKeys = {
        gemini: env?.GEMINI_API_KEY,
        claude: env?.CLAUDE_API_KEY || env?.ANTHROPIC_API_KEY,
        openai: env?.OPENAI_API_KEY,
      };
      const urlResult = await crawlAndCollect({
        url: payload.urlImageSource.url,
        postTitle: payload.keyword || payload.topic || '제목없음',
        mainKeyword: payload.keyword || payload.topic || '',
        downloadsBase,
        projectName: 'LEADERNAM-Orbit',
        aiCheckEnabled: !!payload.urlImageSource.aiCheckEnabled,
        textGenerator: payload.provider || 'gemini-3.5-flash',
        apiKeys,
        threshold: Number(payload.urlImageSource.threshold) || 60,
      });
      if (urlResult.ok && urlResult.acceptedImages?.length > 0) {
        const accepted: string[] = urlResult.acceptedImages;
        // manualCrawlUrls에 통합 (orchestration이 이미 활용하는 풀)
        payload.manualCrawlUrls = [...(payload.manualCrawlUrls || []), ...accepted];
        // v3.5.74: productImages에도 미러 — 'crawled' 이미지 소스 선택 시 즉시 사용
        (payload as any).productImages = [...((payload as any).productImages || []), ...accepted];
        onLog?.(`[PROGRESS] 3% - ✅ URL 이미지 ${accepted.length}개 수집 (raw ${urlResult.rawImages.length}개, vision ₩${urlResult.costKrw}, → ${urlResult.saveDir})`);
        // aiFillEnabled가 false면 부족분 AI 생성 차단
        if (payload.urlImageSource.aiFillEnabled === false) {
          payload.h2ImageSource = 'none';
        }
      } else if (urlResult.error) {
        onLog?.(`[PROGRESS] 3% - ⚠️ URL 이미지 수집 실패(폴백 진행): ${urlResult.error}`);
      }
    } catch (urlErr: any) {
      onLog?.(`[PROGRESS] 3% - ⚠️ URL 이미지 수집 예외(폴백 진행): ${urlErr?.message || urlErr}`);
    }
  }

  // 🏆 AdSense 승인률 강화 — adsense 모드면 모두 자동 ON (사용자가 토글하지 않아도 됨)
  if (payload?.contentMode === 'adsense') {
    payload.llmRotation = payload.llmRotation !== false; // 명시적 false 아니면 ON
    payload.adsenseScoreGate = payload.adsenseScoreGate !== false;
    const requestedAdsenseMinScore = Number(payload.adsenseMinScore);
    payload.adsenseMinScore = Number.isFinite(requestedAdsenseMinScore)
      ? Math.max(requestedAdsenseMinScore, 78)
      : 78;
    payload.adsenseGateMode = payload.adsenseGateMode || 'warn'; // 초보자에게 안전한 warn 기본
    payload.adsensePolicyScan = payload.adsensePolicyScan !== false;
    payload.adsenseHardeningScan = payload.adsenseHardeningScan !== false;
    onLog?.(`[PROGRESS] 0% - 🏆 adsense 모드 — 승인률 강화 자동 적용 (LLM 로테이션·점수 ${payload.adsenseMinScore}+·정책/반복 스캔·외부 출처 강제)`);
  }

  // 🎯 동시 실행 시 순차 처리 (process.env 보호)
  // v3.8.380(R5): 락을 engine-lock.ts로 추출 — 대기자 워치독(기본 60분, ENGINE_LOCK_WAIT_MS='0'=무제한).
  //   보유자가 멈춰도 대기자는 유한 시간 안에 명확한 에러로 실패한다 (조용한 무한 대기 제거).
  //   "강제 해제"가 아니라 "대기자 타임아웃"인 이유는 engine-lock.ts 상단 주석 참조.
  let releaseLock: () => void = () => { /* no-op until assigned */ };
  releaseLock = await acquireEngineLock('generateUltimateMaxModeArticleFinal');
  const previousTextModel = process.env['PRIMARY_TEXT_MODEL'] || '';
  const startTime = Date.now();
  // v3.8.380(R5): 락 획득 직후 곧바로 try 진입 — 기존에는 락을 쥔 채 try 밖에서 ~80줄이 실행되어
  //   거기서 예외가 나면 finally(releaseLock)가 없어 영구 데드락이었다 (engine-lock.test.ts가 고정).
  //   아래 블록 들여쓰기는 diff·앵커 안정성을 위해 유지한다.
  try {
  // 🎯 사용자 선택 AI 엔진을 런타임에 반영
  // 🔥 우선순위 수정: provider(드롭다운, 최신 UI)가 primaryGeminiTextModel(라디오, 모달)보다 우선
  const providerModelMap: Record<string, string> = {
    openai: 'openai-gpt41',
    claude: 'claude-sonnet',
    perplexity: 'perplexity-sonar',
    gemini: 'gemini-3.5-flash',
  };

  // 🎲 LLM 모델 로테이션 (옵션) — adsense 모드에서 같은 모델로 양산하면 "scaled content abuse" 패턴 잡힘.
  //    payload.llmRotation === true 이면 발행마다 사용 가능한 모델 중 1개 무작위 선택.
  if (payload?.llmRotation === true && payload?.contentMode === 'adsense') {
    const envCheck = (key: string) => !!(process.env[key] && String(process.env[key]).length > 10);
    const candidates: string[] = [];
    if (envCheck('GEMINI_API_KEY')) candidates.push('gemini');
    if (envCheck('OPENAI_API_KEY')) candidates.push('openai');
    if (envCheck('CLAUDE_API_KEY') || envCheck('ANTHROPIC_API_KEY')) candidates.push('claude');
    if (envCheck('PERPLEXITY_API_KEY')) candidates.push('perplexity');
    if (candidates.length >= 2) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
      console.log(`[ROTATION] 🎲 LLM 로테이션 활성 — 후보 ${candidates.length}개 중 ${picked} 선택 (양산 패턴 방지)`);
      onLog?.(`[PROGRESS] 0% - 🎲 이번 글 모델: ${picked} (로테이션)`);
      payload.provider = picked;
      payload.primaryGeminiTextModel = providerModelMap[picked];
    }
  }

  if (payload.provider && providerModelMap[payload.provider]) {
    // 🔥 1순위: 사용자가 포스팅 탭 드롭다운에서 직접 선택한 엔진
    const mapped = providerModelMap[payload.provider];
    // provider와 primaryGeminiTextModel이 일치하면 구체적 모델 사용
    const modelValue = String(payload.primaryGeminiTextModel || '');
    const isConsistent =
      (payload.provider === 'gemini' && modelValue.startsWith('gemini-')) ||
      (payload.provider === 'openai' && (modelValue.startsWith('openai-') || modelValue.startsWith('gpt-') || /^o\d/i.test(modelValue))) ||
      (payload.provider === 'claude' && modelValue.startsWith('claude-')) ||
      (payload.provider === 'perplexity' && modelValue.startsWith('perplexity-'));
    const finalModel = isConsistent ? payload.primaryGeminiTextModel : mapped;
    process.env['PRIMARY_TEXT_MODEL'] = finalModel!;
    onLog?.(`[PROGRESS] 0% - 🎯 AI 엔진: ${payload.provider} → ${finalModel}`);
  } else if (payload.primaryGeminiTextModel) {
    // 2순위: provider가 없으면 primaryGeminiTextModel 직접 사용
    process.env['PRIMARY_TEXT_MODEL'] = payload.primaryGeminiTextModel;
    onLog?.(`[PROGRESS] 0% - 🎯 AI 엔진 (모델 직접): ${payload.primaryGeminiTextModel}`);
  }

  const rawPlacementMode = String(payload.h2ImageMode || payload.imagePolicy || payload.h2Images?.mode || 'all').toLowerCase();
  const h2ImageMode = rawPlacementMode === 'odd-only'
    ? 'odd'
    : rawPlacementMode === 'even-only'
      ? 'even'
      : rawPlacementMode;

  // 🔥 빠른 모드 설정 (이미지 생성 최소화)
  const skipImages = payload.skipImages === true || h2ImageMode === 'none';
  const fastMode = payload.fastMode === true || skipImages;

  // 🔥 이미지 소스 설정 - 안정 기본값
  const rawImageSource = (h2ImageMode === 'thumbnail-only' || h2ImageMode === 'none')
    ? 'none'
    : (payload.h2ImageSource || payload.h2Images?.source || '');
  const imageSource = rawImageSource || 'nanobanana2';

  console.log('[ULTIMATE] 🎯 이미지 소스 설정:');
  console.log('[ULTIMATE]    - payload.h2ImageSource:', payload.h2ImageSource);
  console.log('[ULTIMATE]    - payload.h2Images?.source:', payload.h2Images?.source);
  console.log('[ULTIMATE]    - 최종 imageSource:', imageSource);

  onLog?.(`[PROGRESS] 0% - 🔥 끝판왕 콘텐츠 생성 시작! ${fastMode ? '(빠른 모드)' : ''}`);
  onLog?.(`[PROGRESS] 0% - 🎯 이미지 소스: ${imageSource} (원본: ${payload.h2ImageSource || '없음'})`);
  // v3.8.380(R5): startTime 선언과 try 진입은 락 획득 직후로 이동됨 (위 참조)
    // v3.8.403: let 으로 바꿨다 — 쇼핑모드에서 제휴 링크의 상품명을 주제로 삼기 위해서다(아래 참조)
    let keyword = payload.topic || '';
    const platform = payload.platform || 'wordpress'; // wordpress or blogspot

    // 🛡️ v3.8.376: 리더스(Dropshot) 엔진 프리플라이트 — 본문 생성 "전에" 이미지 엔진 상태를 확인한다.
    //   실측(2026-07-26 연속발행): 본문+보강+FAQ+CTA를 전부 생성(유료 호출 ~5회)한 뒤 이미지 단계에서
    //   STRICT_ENGINE_FAILED로 발행이 차단되어 그 텍스트 비용이 전액 낭비됐다 (같은 글을 두 번 생성 = $0.68).
    //   strict 엔진은 폴백이 없으므로, 준비가 안 됐으면 토큰을 쓰기 전에 여기서 중단한다.
    const thumbSourceForPreflight = String(payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || '');
    const needsDropshotPreflight = String(imageSource).toLowerCase().includes('dropshot')
      || thumbSourceForPreflight.toLowerCase().includes('dropshot');
    if (needsDropshotPreflight) {
      onLog?.('[PROGRESS] 2% - 🛡️ 리더스 이미지 엔진 사전 점검 중... (비용 보호)');
      let preflightFailReason = '';
      try {
        const { verifyDropshotGenerationReady } = await import('../dropshotGenerator');
        const readiness: any = await verifyDropshotGenerationReady();
        if (!readiness?.ready) preflightFailReason = String(readiness?.message || '준비 상태 확인 실패');
      } catch (preflightErr: any) {
        preflightFailReason = String(preflightErr?.message || preflightErr).slice(0, 160);
      }
      if (preflightFailReason) {
        throw new Error(
          `STRICT_ENGINE_PREFLIGHT: 리더스 이미지 엔진이 준비되지 않아 본문 생성 전에 중단했습니다 (LLM 비용 소모 0). `
          + `사유: ${preflightFailReason}. 설정 → 이미지 엔진에서 Dropshot 로그인 상태를 확인한 뒤 다시 시도해주세요.`,
        );
      }
      onLog?.('[PROGRESS] 3% - ✅ 리더스 이미지 엔진 준비 확인 — 본문 생성 시작');
    }

    // 1. 크롤링 - URL이 있으면 URL 크롤링, 없으면 키워드 크롤링
    const manualUrls: string[] = payload.manualCrawlUrls || [];
    const sourceUrl = payload.sourceUrl || payload.crawlUrl || '';

    // sourceUrl도 manualUrls에 포함
    if (sourceUrl && !manualUrls.includes(sourceUrl)) {
      manualUrls.unshift(sourceUrl);
    }

    // 🛒 쿠팡 URL은 자동으로 제휴 딥링크로 변환 (키가 있을 때만)
    try {
      const coupangUrls = manualUrls.filter(u => /(?:link\.)?coupang\.com/i.test(u));
      if (coupangUrls.length > 0) {
        const envForCoupang = loadEnvFromFile();
        const ak = (payload as any).coupangAccessKey || envForCoupang['coupangAccessKey'] || envForCoupang['COUPANG_ACCESS_KEY'] || '';
        const sk = (payload as any).coupangSecretKey || envForCoupang['coupangSecretKey'] || envForCoupang['COUPANG_SECRET_KEY'] || '';
        if (ak && sk) {
          onLog?.('[PROGRESS] 3% - 🛒 쿠팡 URL → 제휴 딥링크 자동 변환 중...');
          const deeplinks = await createCoupangDeeplink(coupangUrls, ak, sk);
          deeplinks.forEach(dl => {
            const idx = manualUrls.indexOf(dl.originalUrl);
            if (idx !== -1 && dl.shortenUrl) {
              manualUrls[idx] = dl.shortenUrl;
            }
          });
          (payload as any).coupangDeeplinks = deeplinks;
          onLog?.(`[PROGRESS] 4% - ✅ 쿠팡 제휴 딥링크 ${deeplinks.length}개 변환 완료`);
        }
      }
    } catch (dlErr: any) {
      onLog?.(`[PROGRESS] 4% - ⚠️ 쿠팡 딥링크 변환 실패 (원본 URL 사용): ${dlErr.message?.slice(0, 60)}`);
    }

    // 🔀 v3.8.402 — 원본 URL 칸에 들어온 **제휴 링크**를 골라낸다.
    //
    //   실측 사고(2026-08-02): 사용자가 쿠팡 단축링크를 '원본 URL' 칸에 넣고 발행했다.
    //   그러면 아래 urlOnlyMode 가 켜져 **URL 분석 1회 호출로 글을 뽑고 즉시 반환**한다.
    //   그 결과 쇼핑모드 파이프라인(쿠팡 API 상품·후기·스펙·제휴 컴플라이언스)이
    //   통째로 건너뛰어졌다. 게다가 쿠팡이 403 을 주니 분석기가 주제를 못 뽑아
    //   단축코드("fRJGxvXas8")를 제목 소재로 삼았다.
    //
    //   제휴 링크는 '참고할 원본 글'이 아니라 '팔 상품'이다. 성격이 다르므로 분리한다.
    const affiliateInUrls: string[] = [];
    try {
      const { getPolicy, AFFILIATE_PROVIDER_IDS } = require('../affiliate/policies');
      for (let i = manualUrls.length - 1; i >= 0; i -= 1) {
        const u = String(manualUrls[i] || '');
        if (AFFILIATE_PROVIDER_IDS.some((id: any) => getPolicy(id)!.linkHosts.test(u))) {
          affiliateInUrls.unshift(u);
          manualUrls.splice(i, 1);       // URL 분석 대상에서 제외한다
        }
      }
    } catch { /* 판정 실패 시 기존 동작 유지 */ }

    if (affiliateInUrls.length > 0) {
      const existing = String((payload as any).affiliateLinks || '').trim();
      (payload as any).affiliateLinks = existing
        ? `${existing}\n${affiliateInUrls.join('\n')}`
        : affiliateInUrls.join('\n');
      onLog?.(`[PROGRESS] 4% - 🔗 원본 URL 칸의 제휴 링크 ${affiliateInUrls.length}개를 제휴 상품으로 처리합니다`);
      // contentMode 변수는 아래에서 선언되므로 payload 에서 직접 읽는다
      if (String((payload as any).contentMode || '') !== 'shopping') {
        // 조용히 넘어가면 '상품 정보 없는 밋밋한 글'이 나가고 사용자는 이유를 모른다
        onLog?.('[PROGRESS] 4% - ⚠️ 제휴 링크를 넣으셨는데 **쇼핑모드가 아닙니다**. '
          + '상품명·가격·후기·대가성 문구가 반영되지 않습니다. 쇼핑/구매유도 모드로 바꿔 다시 발행하세요.');
      }
    }

    // 🛒 v3.8.403 — **제목을 짓기 전에** 상품을 확정한다.
    //
    //   실측 사고(2026-08-02): 쿠팡 링크를 넣었는데 제목이
    //   "와플래시 게임 아카이브 실행 안 될 때 해결법 총정리" 로 나왔다.
    //   키워드 칸에 남아 있던 이전 키워드가 글의 주제가 됐기 때문이다.
    //   그 키워드로 쿠팡 API 를 검색하니 당연히 0개였고("쿠팡 검색 결과 없음"),
    //   결과가 0개라 productId 대조 구제 경로도 실행조차 못 했다.
    //
    //   순서가 문제였다 — 제목(25%)이 상품 조회(41%)보다 먼저였다.
    //   링크에서 상품명을 먼저 알아내 주제로 삼으면 그 뒤가 전부 풀린다:
    //     제목이 상품에 맞고 → API 검색이 상품명으로 돌아 상품을 찾고 → 가격·이미지·후기가 붙는다.
    //   사용자 요구: "제목도 쇼핑모드면 그 제품에 딱 맞는 제목으로 최적화되어서 생성해줘야 돼요"
    const affiliateAll = String((payload as any).affiliateLinks || '')
      .split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const coupangLink = affiliateAll.find((u) => /coupang\.com|coupa\.ng/i.test(u));
    if (coupangLink && String((payload as any).contentMode || '') === 'shopping') {
      try {
        const { resolveCoupangProductId } = await import('../affiliate/crawl');
        const pid = await resolveCoupangProductId(coupangLink);
        if (pid) {
          const { enrichCoupangProduct, cleanProductName } = await import('../affiliate/coupang-enrich');
          const cacheDir = (payload as any).userDataPath || process.env['ORBIT_USER_DATA'] || undefined;
          // 이름을 모르는 상태로 부른다(2번째 인자 '') — 이 페이지가 이름의 출처다
          const enriched = await enrichCoupangProduct(pid, '', { onLog, cacheDir });
          const productName = cleanProductName(enriched?.pageTitle || '');
          if (productName) {
            // 뒤의 후기 보강이 브라우저를 또 열지 않도록 결과를 넘겨둔다
            (payload as any).coupangEnrichment = enriched;
            (payload as any).resolvedProductName = productName;

            // v3.8.404 — **상품 사진을 여기서 확보한다.**
            //   실측 사고(2026-08-02): 발행글 이미지 10장이 전부 AI 생성이고 쿠팡 사진은 0장이었다.
            //   상품명만 가져오고 이미지를 안 가져왔기 때문이다.
            //   썸네일이 "어떤 제품인지"를 보여줘야 구매로 이어진다.
            const ogImg = String(enriched?.imageUrl || '').trim();
            if (ogImg && !((payload as any).productImages || []).length) {
              (payload as any).productImages = [ogImg];
              onLog?.('[PROGRESS] 5% - 🖼️ 상품 대표 사진 확보 — 썸네일로 씁니다');
            }
            if (keyword.trim() && keyword.trim() !== productName) {
              onLog?.(`[PROGRESS] 5% - 🛒 쇼핑 글이라 주제를 상품으로 바꿉니다: "${keyword.slice(0, 24)}" → "${productName.slice(0, 40)}"`);
            } else {
              onLog?.(`[PROGRESS] 5% - 🛒 링크 상품 확인: "${productName.slice(0, 40)}"`);
            }
            keyword = productName;
            (payload as any).topic = productName;
          }
        }
      } catch (nameErr: any) {
        // 상품명을 못 얻어도 발행은 그대로 진행한다
        onLog?.(`[PROGRESS] 5% - ⚠️ 링크에서 상품명을 얻지 못했습니다 (계속 진행): ${String(nameErr?.message || nameErr).slice(0, 60)}`);
      }
    }

    // 🔥 URL 전용 모드: URL만 있고 키워드가 없거나 URL 기반 생성 요청 시
    // 완전히 새로운 콘텐츠를 AI가 생성 (중복 문서 방지)
    //   ⚠️ 제휴 링크만 넣은 경우에는 켜지지 않는다(위에서 manualUrls 에서 빠졌다).
    const urlOnlyMode = (manualUrls.length > 0) && (!keyword || keyword.trim() === '' || payload.urlBasedGeneration === true);

    if (urlOnlyMode) {
      onLog?.('[PROGRESS] 2% - 🔗 URL 기반 완전 새로운 콘텐츠 생성 모드');
      onLog?.(`   📋 ${manualUrls.length}개 URL을 참고하여 완전히 새로운 글 작성`);
      onLog?.('   ⚠️ 원본 복사 없이 AI가 100% 새롭게 작성합니다 (중복 문서 방지)');

      const urlModeKeyword = resolveUrlModeKeyword(payload.urlBasedGeneration, keyword);
      if (payload.urlBasedGeneration === true && keyword && keyword.trim()) {
        onLog?.(`   ℹ️ URL 모드 — 전달된 키워드("${keyword.slice(0, 30)}")는 무시하고 URL 본문에서 주제를 추출합니다`);
      }

      try {
        // URL 콘텐츠 생성기 사용
        const firstUrl = manualUrls[0];
        if (!firstUrl) {
          throw new Error('URL이 유효하지 않습니다.');
        }
        const urlResult = manualUrls.length === 1
          ? await generateContentFromUrl(firstUrl, urlModeKeyword || undefined, onLog)
          : await generateContentFromUrls(manualUrls, urlModeKeyword || undefined, onLog);

        // 썸네일 생성 — 🎯 사용자 선택 엔진 사용 (dispatcher 경유)
        // v3.8.359: h2ImageMode와 썸네일 소스 분리 — 사용자가 명시한 썸네일 소스가 있으면 h2ImageMode='none'이어도 존중
        let thumbnailUrl = '';
        const explicitUrlThumb = String(payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || '').trim().toLowerCase();
        const urlThumbnailSource = explicitUrlThumb && explicitUrlThumb !== 'none' && explicitUrlThumb !== 'skip'
          ? explicitUrlThumb
          : (h2ImageMode === 'none' ? 'none' : (explicitUrlThumb || 'nanobanana2'));
        const urlThumbnailDisabled = urlThumbnailSource === 'none' || urlThumbnailSource === 'skip';
        const preGeneratedThumbnail = String(payload.preGeneratedThumbnail?.dataUrl || payload.preGeneratedThumbnail?.url || '').trim();
        if (!skipImages && preGeneratedThumbnail) {
          thumbnailUrl = preGeneratedThumbnail.startsWith('data:')
            ? (await uploadBase64ToImageHost(preGeneratedThumbnail, 'folder-thumbnail') || '')
            : preGeneratedThumbnail;
          if (thumbnailUrl) {
            emitGeneratedImage('thumbnail', `썸네일: ${urlResult.title}`, preGeneratedThumbnail, { queueImageToken });
            onLog?.('[PROGRESS] 92% - 📁 내 폴더 썸네일 사용 (새 이미지 생성 생략)');
          }
        }
        if (!thumbnailUrl && !skipImages && !urlThumbnailDisabled) {
          onLog?.(`[PROGRESS] 92% - 🖼️ 썸네일 생성 중 (${urlThumbnailSource})...`);
          try {
            const urlThumbExtra: { gptImageQuality?: 'low' | 'medium' | 'high'; leonardoModel?: string; allowFreeTrialPublishing?: boolean; thumbnailNoText?: boolean } = {
              allowFreeTrialPublishing: true,
              thumbnailNoText: payload.thumbnailNoText === true,
            };
            if (payload.gptImageQuality === 'low' || payload.gptImageQuality === 'medium' || payload.gptImageQuality === 'high') {
              urlThumbExtra.gptImageQuality = payload.gptImageQuality;
            }
            const urlLeonardoModel = payload.leonardoModel || payload.leonardoModelPreference || payload.imageSettings?.leonardoModel;
            if (typeof urlLeonardoModel === 'string' && urlLeonardoModel.trim()) {
              urlThumbExtra.leonardoModel = urlLeonardoModel.trim();
            }
            const thumbResult = await dispatchThumbnailGeneration(
              urlThumbnailSource,
              urlResult.title,
              urlModeKeyword || urlResult.title,
              (msg) => onLog?.(`   ${msg}`),
              urlThumbExtra,
            );
            if (thumbResult.ok && thumbResult.dataUrl) {
              thumbnailUrl = thumbResult.dataUrl;
              emitGeneratedImage('thumbnail', `썸네일: ${urlResult.title}`, thumbResult.dataUrl, { queueImageToken });
              onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료`);
            } else {
              onLog?.(`   ⚠️ 썸네일 생성 실패: ${thumbResult.error || '알 수 없음'}`);
            }
          } catch (thumbErr: any) {
            onLog?.(`   ⚠️ 썸네일 생성 실패: ${thumbErr.message}`);
          }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        onLog?.(`[PROGRESS] 100% - ✅ URL 기반 콘텐츠 생성 완료! (${duration}초)`);
        onLog?.(`   📝 제목: "${urlResult.title}"`);
        onLog?.(`   📊 H2: ${urlResult.h2Sections.length}개`);
        onLog?.(`   🏷️ 태그: ${urlResult.tags.length}개`);
        onLog?.(`   📄 글자수: ${urlResult.html.length}자`);

        return {
          html: urlResult.html,
          title: urlResult.title,
          labels: urlResult.tags,
          thumbnail: thumbnailUrl,
        };
      } catch (urlGenError: any) {
        onLog?.(`⚠️ URL 기반 생성 실패, 기존 방식으로 전환: ${urlGenError.message}`);
        // 실패 시 기존 방식으로 폴백
      }
    }

    let crawledPosts: FinalCrawledPost[] = [];

    if (manualUrls.length > 0) {
      // 🔗 URL 직접 크롤링 모드 (사용자가 참고 URL 입력한 경우 → 유지!)
      onLog?.('[PROGRESS] 5% - 🔗 URL 직접 크롤링 중...');
      onLog?.(`   📋 ${manualUrls.length}개 URL 크롤링`);

      for (let i = 0; i < manualUrls.length; i++) {
        const url = manualUrls[i];
        if (!url) continue;

        const progress = 5 + Math.floor((i / manualUrls.length) * 10);
        onLog?.(`[PROGRESS] ${progress}% - 🔗 URL ${i + 1}/${manualUrls.length} 크롤링 중...`);

        try {
          const result = await crawlSingleUrlFast(url);
          if (result) {
            crawledPosts.push(result);
            onLog?.(`   ✅ "${result.title.substring(0, 30)}..." 수집 완료`);
          }
        } catch (err: any) {
          onLog?.(`   ⚠️ URL 크롤링 실패: ${err.message}`);
        }
      }
    } else {
      // 🔥 2026 모드: 키워드 기반 → 네이버 API 실제 크롤링 + Grounding 병행
      //   네이버 API 키 있으면 실제 블로그 데이터 수집 → 할루시네이션 원천 차단
      //   네이버 없으면 RSS/CSE 폴백
      onLog?.('[PROGRESS] 5% - 🔎 네이버/Google 실시간 크롤링 시작...');

      try {
        const envKw = loadEnvFromFile();
        const naverClientId = (payload as any).naverClientId || (payload as any).naverCustomerId ||
          envKw['naverClientId'] || envKw['NAVER_CLIENT_ID'] || envKw['naverCustomerId'] || '';
        const naverClientSecret = (payload as any).naverClientSecret || (payload as any).naverSecretKey ||
          envKw['naverClientSecret'] || envKw['NAVER_CLIENT_SECRET'] || envKw['naverSecretKey'] || '';
        const googleCseKey = (payload as any).googleCseKey || envKw['googleCseKey'] || envKw['GOOGLE_CSE_KEY'] || '';
        const googleCseCx = (payload as any).googleCseCx || envKw['googleCseCx'] || envKw['GOOGLE_CSE_CX'] || '';

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ContentCrawler } = require('../content-crawler');
        const crawler = new ContentCrawler();
        const crawlerConfig = {
          topic: keyword,
          keywords: [keyword],
          maxResults: 5,
          naverClientId,
          naverClientSecret,
          googleCseKey,
          googleCseCx,
        };

        let crawledFromAPI: any[] = [];

        // 1순위: 네이버 블로그 + 지식인 + 뉴스 + Google Suggest 병렬 수집 (v3.8.332)
        //   사용자 요구: "궁금한 정보·모르는 정보·소제목·키워드에 딱 맞는 궁금증 해결"
        //   지식인 = 실제 유저 질문 (궁금증 소스), Suggest = 실제 검색 키워드, News = 최신 트렌드
        if (naverClientId && naverClientSecret) {
          onLog?.(`   📘 네이버 블로그 + 지식인 + 뉴스 + Google Suggest 병렬 검색 중...`);
          const [blogResults, kinResults, newsResults, suggestResults] = await Promise.all([
            crawler.crawlFromNaverAPI(crawlerConfig).catch((e: any) => { console.warn('[CRAWL] 블로그 실패:', e.message); return []; }),
            crawler.crawlFromNaverKin(crawlerConfig).catch((e: any) => { console.warn('[CRAWL] 지식인 실패:', e.message); return []; }),
            crawler.crawlFromNaverNews(crawlerConfig).catch((e: any) => { console.warn('[CRAWL] 뉴스 실패:', e.message); return []; }),
            crawler.crawlGoogleSuggest(crawlerConfig).catch((e: any) => { console.warn('[CRAWL] Suggest 실패:', e.message); return []; }),
          ]);
          crawledFromAPI.push(...blogResults, ...kinResults, ...newsResults, ...suggestResults);
          onLog?.(`   ✅ 블로그 ${blogResults.length} + 지식인 ${kinResults.length} + 뉴스 ${newsResults.length} + 자동완성 ${suggestResults.length} = 총 ${crawledFromAPI.length}개 (궁금증·검색의도 파악)`);
        } else {
          // 네이버 키 없어도 Google Suggest는 무료 → 실행
          const suggestOnly = await crawler.crawlGoogleSuggest(crawlerConfig).catch(() => []);
          crawledFromAPI.push(...suggestOnly);
          onLog?.(`   ⚠️ 네이버 API 키 없음 → Google Suggest만 수집 (${suggestOnly.length}개)`);
        }

        // 2순위: Google CSE (네이버 결과가 부족할 때)
        if (crawledFromAPI.length < 2 && googleCseKey && googleCseCx) {
          try {
            onLog?.(`   🔍 Google CSE 검색 중...`);
            const cseResults = await crawler.crawlFromCSE(crawlerConfig);
            crawledFromAPI.push(...cseResults);
            onLog?.(`   ✅ CSE에서 ${cseResults.length}개 추가 수집`);
          } catch (cseErr: any) {
            onLog?.(`   ⚠️ CSE 크롤링 실패: ${cseErr.message?.slice(0, 80)}`);
          }
        }

        // 3순위: RSS 폴백 (API 키 없을 때)
        if (crawledFromAPI.length === 0) {
          try {
            onLog?.(`   📡 RSS 폴백 검색 중...`);
            const rssResults = await crawler.crawlFromRSS(crawlerConfig);
            crawledFromAPI.push(...rssResults);
            onLog?.(`   ✅ RSS에서 ${rssResults.length}개 수집`);
          } catch (rssErr: any) {
            onLog?.(`   ⚠️ RSS 실패: ${rssErr.message?.slice(0, 80)}`);
          }
        }

        // CrawledContent → FinalCrawledPost 변환
        // v3.8.374: 크롤러가 붙인 source 태그를 보존한다.
        //   기존에는 여기서 전부 'external'로 덮어써서 content-crawler가 붙인 'naver-kin'/'google-suggest'
        //   태그가 사라졌고, 그 결과 아래 bySource()가 항상 []를 반환 → v3.8.372/373의 demandSignals가
        //   한 번도 채워진 적이 없었다(항상 "검색자 질문 데이터 없음" 로그).
        if (crawledFromAPI.length > 0) {
          for (const item of crawledFromAPI) {
            crawledPosts.push({
              title: item.title || '',
              url: item.url || '',
              content: item.content || '',
              subheadings: item.subheadings || [],
              source: (item as any).source || 'external',
            } as any);
          }
        }
      } catch (crawlErr: any) {
        onLog?.(`⚠️ 크롤링 모듈 오류: ${crawlErr.message?.slice(0, 80)}`);
      }

      if (crawledPosts.length === 0) {
        // v3.8.333: Grounding 자동 폴백 완전 차단. 대신 Perplexity 팩트체크 결과 = 크롤링 소스로 통합 (사용자 제안).
        onLog?.('[PROGRESS] 15% - ⚠️ 크롤링 4중 소스 결과 없음 — Perplexity 팩트체크 결과를 자동 통합 (Grounding 자동 폴백 X)');
        onLog?.('[PROGRESS] 15% - 💡 Perplexity 저렴 (~₩5/편) + 실시간 검색 + 신뢰 소스 인용. Grounding (~₩700/편) 대체.');
      } else {
        onLog?.(`[PROGRESS] 15% - ✅ 실시간 크롤링 ${crawledPosts.length}개 → 할루시네이션 차단`);
      }
    }

    // 🌐 크롤링 데이터 유무와 상관없이 진행 (Search Grounding이 보완)
    if (crawledPosts.length === 0) {
      onLog?.('[PROGRESS] 20% - 🌐 검색 기반 생성 모드 (크롤링 데이터 없음 → AI 직접 검색)');
    } else {
      onLog?.(`[PROGRESS] 20% - ✅ ${crawledPosts.length}개 자료 수집 완료 + Search Grounding 병행`);
    }

    const titles = crawledPosts.map(p => p.title);
    const contents = crawledPosts.map(p => p.content);
    const subheadings = crawledPosts.flatMap(p => p.subheadings);

    // v3.8.372: 검색자의 실제 궁금증을 H2 생성에 최우선 근거로 전달
    //   지식인 질문/자동완성 키워드는 그동안 subheadings에 뭉뚱그려 섞여 "실제 검색자 수요"라는
    //   신호를 잃고 경쟁 글 소제목 빈도에 묻혔다. source 태그로 분리해 별도 인자로 넘긴다.
    const bySource = (tag: string) => crawledPosts
      .filter((p: any) => String(p?.source || '') === tag)
      .flatMap((p: any) => Array.isArray(p?.subheadings) ? p.subheadings : []);
    const demandSignals = {
      userQuestions: bySource('naver-kin'),
      searchQueries: bySource('google-suggest'),
    };
    if (demandSignals.userQuestions.length > 0 || demandSignals.searchQueries.length > 0) {
      onLog?.(`[PROGRESS] 34% - 🎯 검색자 수요 신호 확보: 지식인 질문 ${demandSignals.userQuestions.length}개 · 자동완성 ${demandSignals.searchQueries.length}개 → 소제목 생성에 반영`);
    } else {
      onLog?.('[PROGRESS] 34% - ⚠️ 검색자 질문 데이터 없음 — 경쟁 글 소제목 기준으로 생성합니다');
    }

    // 2. H1 생성 — 🔥 키워드 제목 옵션 체크박스 반영
    // 🛡️ 제목 연도 복구기 — 단독 토큰 '년'에만 currentYear 주입.
    //    단독 토큰 = (문장 시작 또는 공백) + '년' + (공백 또는 문장 끝)
    //    한글 합성어(청년/노년/작년/내년/올해)는 '년'이 한글 직후라 매치되지 않아 안전.
    //
    //    예시:
    //      (a) "년 정부정책" (선두 단독)         → "2026년 정부정책" ✓
    //      (b) "올해 년 달라진" (중간 단독)      → "올해 2026년 달라진" ✓
    //      (c) "청년도약계좌" (한글합성어)        → 변경 없음 ✓ (이전 버그: "청2026년도약계좌")
    //      (d) "노년 보험" (단어 끝 한글+년)     → 변경 없음 ✓ (`년` 앞이 한글)
    //      (e) "3년차", "20년 만에", "2026년" (숫자-년) → 변경 없음 ✓
    //      (f) "2026 년 조회" (숫자+공백+년)     → 변경 없음 ✓ (digit-space lookbehind)
    const currentYearForTitle = new Date().getFullYear();
    const repairTitleYear = (title: string): string => {
      if (!title) return title;
      // 패턴: (문장시작 OR 공백)년(공백 OR 문장끝)
      //   매치는 (^|\s) 위치에서 시작하므로 lookbehind `(?<!\d)`는 그 직전 한 글자가
      //   숫자인지만 검사하면 충분 (예: "2026 년" — 매치는 공백 위치 시작 → 직전 '6' 차단)
      return title.replace(/(?<!\d)(^|\s)년(?=\s|$)/g,
        (_m, prefix: string) => `${prefix}${currentYearForTitle}년`
      );
    };

    // 🔎 키워드 수요 실측 게이트 (v3.8.383, 관측 전용 — 발행을 절대 막지 않는다)
    //    검색광고 자격증명이 등록된 적이 없어 앱의 "검색량"은 문서수×0.3 추정 폴백이었다
    //    (naver-datalab-api.ts getBlogSearchFallback — 경쟁도를 수요로 오인시키는 거꾸로 된 신호).
    //    여기서는 DataLab 실측으로 "이 표현을 실제로 검색하는가"를 판정해 제목 생성에 반영한다.
    //    실측 근거: GSC 90일 — 4~10위 26편의 페이지당 노출 17회. 순위가 아니라 표현이 병목.
    let demandTitleHint: string | undefined;
    try {
      const envForDemand = loadEnvFromFile();
      const dlId = (envForDemand['NAVER_CLIENT_ID'] || '').trim();
      const dlSecret = (envForDemand['NAVER_CLIENT_SECRET'] || '').trim();
      let demandHint: string | null = null;
      if (dlId && dlSecret) {
        const demand = await analyzeKeywordDemand(keyword, { clientId: dlId, clientSecret: dlSecret });
        if (demand.verdict !== 'error') {
          onLog?.(`[PROGRESS] 24% - 🔎 수요 실측: ${demand.summary}`);
          if (demand.verdict === 'no-demand') {
            onLog?.('[DEMAND-GATE] ⚠️ 이 키워드 계열 전체가 검색량 측정 하한 미만 — 색인돼도 검색 유입을 기대하기 어렵습니다. 발행은 계속합니다.');
          }
          demandHint = demand.titleHint;
        }
      }
      // 🎯 개인 승산 5문형 판정 (SERP 실측 근거) — 제목 "꼴"과 본문 H2 구성을 정한다.
      //    수요 게이트가 제목 "머리"를, 이 분류기가 "꼴"을 담당한다.
      const angle = analyzeKeywordAngle(keyword);
      onLog?.(`[PROGRESS] 24% - 🎯 각도 판정: ${angle.summary}`);
      demandTitleHint = composeTitleDirective(demandHint, angle) ?? undefined;
    } catch { /* 관측 전용 — 어떤 실패도 발행 흐름에 영향을 주지 않는다 */ }

    let h1: string;
    if (payload.useKeywordAsTitle) {
      // ✅ 키워드를 제목 그대로 사용
      h1 = keyword;
      onLog?.(`[PROGRESS] 30% - 🎯 키워드를 제목으로 사용: "${h1}"`);
    } else {
      // 🤖 AI 자동 생성
      onLog?.('[PROGRESS] 25% - ✍️ AI가 제목(H1) 생성 중...');
      // v3.8.404: 쇼핑 글이면 상품 등록명을 '재료'로 넘긴다 — 그대로 제목이 되면 안 된다
      h1 = await generateH1TitleFinal(
        keyword,
        titles,
        demandTitleHint,
        // contentMode 변수는 아래에서 선언되므로 payload 에서 직접 읽는다
        String((payload as any).contentMode || '') === 'shopping'
          ? String((payload as any).resolvedProductName || '') || undefined
          : undefined,
      );
      h1 = repairTitleYear(h1);

      // 📌 키워드를 제목 맨앞에 배치
      if (payload.keywordFront) {
        // 이미 키워드로 시작하는지 확인 (대소문자 무시)
        const alreadyStarts = h1.toLowerCase().startsWith(keyword.toLowerCase());
        if (!alreadyStarts) {
          // 기존 제목에서 키워드를 제거 (대소문자 무시, 전체 단어 매칭)
          const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let h1WithoutKeyword = h1
            .replace(new RegExp(escapedKw, 'gi'), '')
            .replace(/\s{2,}/g, ' ')  // 중복 공백 제거
            .replace(/^[\s,·\-:]+/, '')  // 앞쪽 구분자 제거
            .replace(/[\s,·\-:]+$/, '')  // 뒤쪽 구분자 제거
            .trim();
          // 빈 문자열이 되면 원래 제목 사용
          if (h1WithoutKeyword.length < 5) h1WithoutKeyword = h1;
          h1 = `${keyword} ${h1WithoutKeyword}`;
        }
        // 키워드 재조립 후에도 한 번 더 연도 복구 적용
        h1 = repairTitleYear(h1);
        // 50자 초과시 자르기
        if (h1.length > 50) h1 = h1.substring(0, 47) + '...';
        onLog?.(`[PROGRESS] 30% - 📌 키워드 맨앞 배치 제목: "${h1}"`);
      } else {
        onLog?.(`[PROGRESS] 30% - ✅ 제목 완료: "${h1}"`);
      }
    };

    // 🔥 contentMode를 H2 생성 전에 추출 (내부 일관성 모드 지원)
    const contentMode = (payload as any).contentMode || 'external';

    // 3. H2 생성 — 모드 디스패처 우선, 없으면 기존 하드코딩 폴백
    const modeResult = dispatchMode(contentMode, keyword, {
      authorInfo: (payload as any).adsenseAuthorInfo,
    });

    let h2Titles: string[];
    const folderImageH2Titles = getFolderImageH2Titles(payload);
    if (folderImageH2Titles.length > 0) {
      h2Titles = folderImageH2Titles;
      modeResult.sectionPromptBlock = `${modeResult.sectionPromptBlock || ''}\n\n📁 [사용자 확정 H2 구조]\n아래 H2 제목과 순서를 글에 정확히 사용하세요. 제목을 바꾸거나 합치거나 새 H2를 추가하지 마세요.\n${h2Titles.map((title, index) => `${index + 1}. ${title}`).join('\n')}`;
      onLog?.(`[PROGRESS] 40% - 📁 내 폴더 이미지용 확정 H2 ${h2Titles.length}개 적용`);
    } else if (modeResult.handledByPlugin && modeResult.h2Titles) {
      // 플러그인에서 H2 제목 제공
      h2Titles = modeResult.h2Titles;
      // v3.8.373: 고정 템플릿 제목을 키워드 맞춤으로 재생성 (구조/순서/개수는 그대로 유지)
      //   사용자 지적: '[주제] 핵심 스펙 총정리' 처럼 키워드가 뭐든 같은 뼈대가 나온다.
      //   섹션 역할(role/contentFocus)은 보존하고 표기 문자열만 AI가 새로 짓는다.
      //   실패하거나 개수가 안 맞으면 템플릿 제목을 그대로 유지하므로 회귀 위험이 없다.
      const roles = (modeResult as any).sectionRoles as Array<{ title: string; role: string; contentFocus: string }> | undefined;
      if (Array.isArray(roles) && roles.length === h2Titles.length) {
        onLog?.(`[PROGRESS] 37% - ✍️ ${contentMode} 모드 소제목을 키워드에 맞게 재생성 중...`);
        try {
          const rewritten = await generateSectionTitlesFromRoles(keyword, roles, demandSignals);
          if (Array.isArray(rewritten) && rewritten.length === h2Titles.length) {
            const changed = rewritten.filter((t, i) => t !== h2Titles![i]).length;
            h2Titles = rewritten;
            onLog?.(`[PROGRESS] 39% - ✅ 소제목 ${changed}/${rewritten.length}개를 키워드 맞춤으로 교체`);
          }
        } catch (titleErr: any) {
          console.warn('[MODE] 섹션 제목 재생성 실패 — 템플릿 유지:', titleErr?.message || titleErr);
        }
      }
      onLog?.(`[PROGRESS] 40% - ✅ ${contentMode} 모드: ${h2Titles.length}개 섹션 구조 적용`);
    } else if (contentMode === 'adsense') {
      // 폴백: 기존 하드코딩 (플러그인 미등록 시)
      // 🛡️ 애드센스 승인 모드: ADSENSE_ULTIMATE_SECTIONS 7섹션 고정 구조
      onLog?.('[PROGRESS] 35% - 🛡️ 애드센스 승인 모드: E-E-A-T 7섹션 구조 적용 중...');
      try {
        const { ADSENSE_ULTIMATE_SECTIONS } = require('../content-modes/adsense/adsense-sections');
        h2Titles = ADSENSE_ULTIMATE_SECTIONS.map((sec: any) => {
          return sec.title.replace('[주제]', keyword).replace('[실전 경험]', keyword + ' 실전 경험');
        });
        onLog?.(`[PROGRESS] 40% - ✅ 애드센스 7섹션 구조 적용 완료: ${h2Titles.join(', ')}`);
      } catch (e) {
        console.warn('[ULTIMATE] ⚠️ 애드센스 섹션 로드 실패, 기본 7섹션 사용');
        h2Titles = [
          '작성자 소개',
          `${keyword} 완전히 이해하기`,
          `${keyword} 실전 활용 가이드`,
          '단계별 실행 가이드',
          '비교 분석 및 추천',
          '자주 묻는 질문 (FAQ)',
          '마무리 및 추가 리소스'
        ];
        onLog?.(`[PROGRESS] 40% - ✅ 애드센스 기본 7섹션 적용 완료`);
      }
    } else if (contentMode === 'internal') {
      // 📝 내부 일관성 모드: 단일 글 정보 전달 구조
      // v3.7.12: 이전엔 INTERNAL_CONSISTENCY_SECTIONS.title placeholder가 그대로 박혀
      //   "[키워드] 핵심 개요/지식/심화/요약/더 알아보기" 같은 generic H2가 나옴.
      //   → LLM 기반 generateH2TitlesFinal을 1차로 시도(키워드 검색의도 기반 구체 5개),
      //     5개 미만/실패 시 의도 기반 fallback으로 안전망. sectionPromptBlock은 LLM이 만든
      //     실제 title을 5섹션 역할(개요→지식→심화→요약→탐색)에 매핑해서 가이드 유지.
      onLog?.('[PROGRESS] 35% - 📝 내부 일관성 모드: 정보 전달 구조 적용 중...');
      const internalScope = detectKeywordScope(keyword);
      const fallbackTitles = generateIntentAwareFallbackH2Titles(keyword, 5, internalScope);
      try {
        const llmTitles = await generateH2TitlesFinal(keyword, subheadings, 5, demandSignals);
        if (Array.isArray(llmTitles) && llmTitles.length >= 5) {
          h2Titles = llmTitles.slice(0, 5);
          onLog?.(`[PROGRESS] 38% - 🧠 LLM 기반 구체 H2 5개 생성: ${h2Titles.join(' / ')}`);
        } else {
          h2Titles = [...(llmTitles || []), ...fallbackTitles.slice((llmTitles || []).length)].slice(0, 5);
          onLog?.(`[PROGRESS] 38% - ⚠️ LLM H2 ${llmTitles?.length || 0}개만 생성 → fallback 보완`);
        }
      } catch (e: any) {
        h2Titles = fallbackTitles;
        onLog?.(`[PROGRESS] 38% - ⚠️ LLM H2 생성 실패(${(e?.message || '').slice(0, 60)}) → 의도 기반 fallback 사용`);
      }
      // v3.7.29: internal 플러그인의 placeholder 섹션 가이드를 그대로 두면
      //   본문 단계에서 "자격·조건", "단계별 적용법" 같은 범용 템플릿이 다시 새어 나온다.
      //   실제 H2 제목을 기준으로 섹션 가이드를 항상 재작성한다.
      const sectionScope = internalScope;
      const sectionScopeOverride = sectionScope
        ? `\n🎯🎯🎯 **SCOPE OVERRIDE — 절대 위반 금지!**\n키워드 "${keyword}"가 "${sectionScope.qualifier}"으로 끝납니다. ${sectionScope.instruction}\n\n⚠️ 아래 섹션별 상세 지시(역할/핵심/필수 요소)에 "${sectionScope.qualifier}" 외 다른 주제(예: ${sectionScope.qualifier === '혜택' ? '자격/조건/신청방법' : sectionScope.qualifier === '신청방법' ? '혜택/조건/대상' : '혜택/신청방법'})가 언급되어도 그 부분은 무시하고, 해당 섹션을 "${sectionScope.qualifier}" 관련 내용으로 재해석해서 작성하세요. 모든 섹션 본문 + 모든 H3 + 모든 본문 단락은 오직 "${sectionScope.qualifier}"만 다룹니다.\n`
        : '';
      if (sectionScope) {
        console.log(`[SECTION-GUIDE] 🎯 한정자 "${sectionScope.qualifier}" → 본문 sectionPromptBlock에 SCOPE OVERRIDE 주입`);
      }
      // v3.8.265: 거미줄 모드 sourceGuard를 단일 일관 모드 SOURCE_MANDATE 수준으로 강화
      // 기존 문제: 권장 어조 "우선 사용하세요" → LLM이 가짜 통계 생성 가능
      // 강화: 절대 금지 어조 "출처 모르면 빼라"
      const sourceGuard = `\n📊 **외부 출처 인용 필수 (AI 환각·가짜 통계 차단 — 거미줄 cornerstone↔spokes 일관성 필수)**\n- 본문 중 최소 2회 이상 검증 가능한 한국 공공·기관 데이터를 인용하세요.\n  예: "통계청 KOSIS 자료에 따르면", "한국소비자원 2026년 조사", "보건복지부 공식 발표"\n- 인용 형식: "[기관명] [연도] [조사명]에 따르면 [구체 수치/내용]"\n- 출처를 모르는 데이터는 "공식 자료를 참고하세요"라고만 표현. 추측 통계 절대 금지.\n- **수치를 본문에 넣을 때 출처를 함께 명시하지 못하면 그 수치는 빼세요.**\n- 존재하지 않는 글 제목/URL, 가상의 시리즈 문구는 만들지 마세요.\n- **거미줄 일관성**: 같은 토픽의 다른 글(cornerstone↔spokes)이 서로 다른 수치/조건을 가지면 안 됩니다. 원문 사실에 충실하세요.\n`;
      const guides = INTERNAL_CONSISTENCY_SECTIONS.map((sec, idx) => {
        // LLM이 만든 실제 H2 제목을 가이드에 그대로 사용 (없으면 의도 기반 fallback)
        const t = h2Titles[idx] || fallbackTitles[idx] || `${keyword} 핵심 정보`;
        const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
        return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 600}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n제목 일치 규칙:\n  - H3와 본문은 반드시 "${t}"의 하위 내용만 다룹니다.\n  - H2에 없는 신청/자격/혜택/서류/중계/대진 같은 다른 분야 단어를 임의로 추가하지 마세요.\n필수 요소:\n${reqs}`;
      }).join('\n\n');
      modeResult.sectionPromptBlock = `${sectionScopeOverride}${sourceGuard}\n\n📋 [내부 일관성 모드 섹션별 상세 지시]\n${guides}`;
      onLog?.(`[PROGRESS] 40% - ✅ 내부 일관성 구조 ${h2Titles.length}개 섹션 적용 완료`);
    } else if (contentMode === 'shopping') {
      // 🛍️ 쇼핑/구매유도 모드: 7단계 구매 퍼널 구조
      onLog?.('[PROGRESS] 35% - 🛍️ 쇼핑 모드: 구매 퍼널 7섹션 구조 적용 중...');
      h2Titles = SHOPPING_CONVERSION_MODE_SECTIONS.map(sec => {
        return sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
      });
      // 섹션별 상세 지시 주입 (requiredElements/role/contentFocus/minChars)
      if (!modeResult.sectionPromptBlock) {
        const guides = SHOPPING_CONVERSION_MODE_SECTIONS.map((sec, idx) => {
          const t = sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
          const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
          return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 1000}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n필수 요소:\n${reqs}`;
        }).join('\n\n');
        modeResult.sectionPromptBlock = `\n\n📋 [쇼핑 모드 섹션별 상세 지시]\n${guides}`;
      }
      // 🛒 쿠팡 파트너스 API로 실제 상품 데이터 수집 (키가 있으면)
      try {
        const envData = loadEnvFromFile();
        const coupangAccessKey = (payload as any).coupangAccessKey || envData['coupangAccessKey'] || envData['COUPANG_ACCESS_KEY'] || '';
        const coupangSecretKey = (payload as any).coupangSecretKey || envData['coupangSecretKey'] || envData['COUPANG_SECRET_KEY'] || '';
        if (coupangAccessKey && coupangSecretKey) {
          onLog?.('[PROGRESS] 37% - 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...');
          const products = await searchCoupangProducts(keyword, coupangAccessKey, coupangSecretKey, 10);
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            // 상품 이미지를 썸네일/H2 이미지 소스로도 사용 가능
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            // 섹션 가이드에 실제 상품 데이터 추가
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 38% - ✅ 쿠팡 상품 ${products.length}개 수집 완료 (할루시네이션 방지)`);
          } else {
            onLog?.('[PROGRESS] 38% - ℹ️ 쿠팡 검색 결과 없음');
          }
        }
      } catch (coupangErr: any) {
        onLog?.(`[PROGRESS] 38% - ⚠️ 쿠팡 API 오류 (계속 진행): ${coupangErr.message?.slice(0, 80)}`);
      }
      // 🛡️ 쿠팡 실제 데이터가 없으면 본문에 가격 숫자 직접 표기 금지 (할루시네이션 방지)
      const hasRealProducts = Array.isArray((payload as any).coupangProducts) && (payload as any).coupangProducts.length > 0;
      if (!hasRealProducts) {
        modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') +
          `\n\n🛡️ **가격 할루시네이션 방지 (실제 상품 데이터 없음)**:\n` +
          `- 본문에 구체적 가격 숫자 직접 표기 절대 금지 ("12,900원", "₩50,000", "월 3만원" 등)\n` +
          `- 가격은 "판매처별 상이", "가격대별 옵션", "예산에 맞게" 같은 추상 표현만 사용\n` +
          `- 할인율, 정가, 세일가 등 임의 수치 생성 금지\n` +
          `- 이유: 검증 불가능한 가격은 발행 시점에 틀려 신뢰도 즉시 붕괴\n`;
      }
      onLog?.(`[PROGRESS] 40% - ✅ 쇼핑 구매 퍼널 ${h2Titles.length}개 섹션 적용 완료`);
    } else if (contentMode === 'paraphrasing') {
      // 🔄 페러프레이징 모드: 6단계 재구성 구조
      onLog?.('[PROGRESS] 35% - 🔄 페러프레이징 모드: 재구성 6섹션 구조 적용 중...');
      h2Titles = PARAPHRASING_PROFESSIONAL_MODE_SECTIONS.map(sec => {
        return sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
      });
      if (!modeResult.sectionPromptBlock) {
        const guides = PARAPHRASING_PROFESSIONAL_MODE_SECTIONS.map((sec, idx) => {
          const t = sec.title.replace(/\[주제\]/g, keyword).replace(/\[소주제\]/g, keyword);
          const reqs = (sec as any).requiredElements?.map((r: string) => `  - ${r}`).join('\n') || '';
          return `[섹션 ${idx + 1}: ${t}] (최소 ${(sec as any).minChars || 700}자)\n역할: ${(sec as any).role || ''}\n핵심: ${(sec as any).contentFocus || ''}\n필수 요소:\n${reqs}`;
        }).join('\n\n');
        modeResult.sectionPromptBlock = `\n\n📋 [페러프레이징 모드 섹션별 상세 지시]\n${guides}`;
      }
      onLog?.(`[PROGRESS] 40% - ✅ 페러프레이징 ${h2Titles.length}개 섹션 적용 완료`);
    } else {
      // 🤖 일반 모드: AI가 H2 소제목 생성
      onLog?.('[PROGRESS] 35% - 📊 AI가 소제목(H2) 생성 중...');
      const maxH2Count = (typeof payload.sectionCount === 'number' && Number.isFinite(payload.sectionCount) && payload.sectionCount > 0)
        ? Math.floor(payload.sectionCount)
        : undefined;
      h2Titles = await generateH2TitlesFinal(keyword, subheadings, maxH2Count, demandSignals);
      onLog?.(`[PROGRESS] 40% - ✅ 소제목 ${h2Titles.length}개 완료`);
    }

    // 🛒 쇼핑 모드 사이드 이펙트: 수동 URL 우선 → API → 할루시 가드 (3단계)
    // 🔥 API 키 없는 사용자 지원: payload.manualCoupangUrls 로 제휴 딥링크 직접 입력 가능
    //    (쿠팡 파트너스 15만원 매출 조건 충족 전에도 수익화 시작)
    if (contentMode === 'shopping') {
      // ── 1순위: 사용자 수동 입력 URL (API 키 불필요) ──
      const manualUrls: string[] = Array.isArray((payload as any).manualCoupangUrls)
        ? (payload as any).manualCoupangUrls.filter((u: any) => typeof u === 'string' && u.trim().length > 0)
        : [];
      if (manualUrls.length > 0 && !(payload as any).coupangProducts) {
        try {
          onLog?.(`[PROGRESS] 41% - 🛒 쿠팡 수동 URL 크롤링 중... (${manualUrls.length}개)`);
          const { crawlCoupangProductsFromUrls } = await import('../coupang-partners');
          const products = await crawlCoupangProductsFromUrls(manualUrls, (msg) => onLog?.(`   ${msg}`));
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 42% - ✅ 수동 입력 쿠팡 상품 ${products.length}개 준비 완료 (제휴링크 그대로 유지)`);
          } else {
            onLog?.('[PROGRESS] 42% - ⚠️ 수동 URL 크롤링 결과 없음 — 다음 경로 시도');
          }
        } catch (manualErr: any) {
          onLog?.(`[PROGRESS] 42% - ⚠️ 수동 URL 처리 오류: ${manualErr.message?.slice(0, 80)}`);
        }
      }

      // ── 2순위: API 키 있는 경우 자동 검색 ──
      try {
        const envData = loadEnvFromFile();
        const coupangAccessKey = (payload as any).coupangAccessKey || envData['coupangAccessKey'] || envData['COUPANG_ACCESS_KEY'] || '';
        const coupangSecretKey = (payload as any).coupangSecretKey || envData['coupangSecretKey'] || envData['COUPANG_SECRET_KEY'] || '';
        if (coupangAccessKey && coupangSecretKey && !(payload as any).coupangProducts) {
          onLog?.('[PROGRESS] 41% - 🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...');
          const products = await searchCoupangProducts(keyword, coupangAccessKey, coupangSecretKey, 10);
          if (products.length > 0) {
            (payload as any).coupangProducts = products;
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.productImage).filter(Boolean);
            }
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + formatProductsForPrompt(products);
            onLog?.(`[PROGRESS] 42% - ✅ 쿠팡 상품 ${products.length}개 수집 완료 (할루시네이션 방지)`);
          } else {
            onLog?.('[PROGRESS] 42% - ℹ️ 쿠팡 검색 결과 없음');
          }
        }
      } catch (coupangErr: any) {
        onLog?.(`[PROGRESS] 42% - ⚠️ 쿠팡 API 오류 (계속 진행): ${coupangErr.message?.slice(0, 80)}`);
      }

      // ── v3.8.396: 네이버 쇼핑 커넥트 / 토스쇼핑 쉐어링크 링크 처리 ──
      //   사용자가 파트너센터에서 받은 링크를 붙여넣으면 상품 정보를 뽑아
      //   프롬프트·상품카드·이미지에 함께 쓴다.
      //   ⚠️ 본문 링크는 **사용자가 준 원본 그대로** 쓴다(링크 변조 = 계약 해지 사유).
      //   실패해도 발행을 막지 않는다 — 링크와 고지문만으로도 글은 나간다.
      try {
        const rawLinksAll: string[] = Array.isArray((payload as any).affiliateLinks)
          ? (payload as any).affiliateLinks
          : String((payload as any).affiliateLinks || '')
            .split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);

        // v3.8.404 — 같은 링크를 두 번 조회하지 않는다.
        //   실측(2026-08-02): 사용자가 같은 쿠팡 링크를 '원본 URL'과 '제휴 링크' 양쪽에 넣어
        //   "제휴 링크 2개 상품 정보 조회 중" 이 떴다. 같은 상품을 두 번 여는 셈이고,
        //   쿠팡은 반복 조회를 차단하므로 **차단 위험만 두 배**가 된다.
        //   비교는 정규화해서 한다 — 끝 슬래시·http/https·쿼리 유무로 갈리면 중복을 못 잡는다.
        const seenLinks = new Set<string>();
        const rawLinks: string[] = [];
        for (const u of rawLinksAll) {
          const norm = u.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
          if (seenLinks.has(norm)) continue;
          seenLinks.add(norm);
          rawLinks.push(u);
        }
        if (rawLinks.length < rawLinksAll.length) {
          onLog?.(`[PROGRESS] 41% - ℹ️ 같은 링크 ${rawLinksAll.length - rawLinks.length}개가 중복이라 한 번만 조회합니다`);
        }

        if (rawLinks.length > 0 && !(payload as any).affiliateProducts) {
          onLog?.(`[PROGRESS] 41% - 🔗 제휴 링크 ${rawLinks.length}개 상품 정보 조회 중...`);
          const { crawlAffiliateLinks } = await import('../affiliate/crawl');
          const { formatAffiliateProductsForPrompt } = await import('../affiliate/render');
          const products = await crawlAffiliateLinks(rawLinks, { onLog, concurrency: 3 });

          if (products.length > 0) {
            (payload as any).affiliateProducts = products;
            // 제휴사는 첫 상품 기준 — 한 글에 한 제휴사 원칙
            (payload as any).affiliateProvider = products[0]!.provider;
            if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
              (payload as any).productImages = products.map(p => p.imageUrl).filter(Boolean);
            }
            modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '')
              + formatAffiliateProductsForPrompt(products);
            const priced = products.filter(p => p.priceKrw).length;
            onLog?.(`[PROGRESS] 42% - ✅ 제휴 상품 ${products.length}개 확보 (가격 확인 ${priced}개)`);
          } else {
            // v3.8.400 — 실측(2026-08-01): 쿠팡은 서버 요청·헤드리스 브라우저 모두에 403 을 준다.
            //   오픈 API 에도 "링크 → 그 상품" 조회는 없다(검색·딥링크뿐이고 딥링크는 링크만 돌려준다).
            //   그래도 **링크와 제휴사는 확실히 안다.** 상품 정보만 모를 뿐이다.
            //   이걸 남겨두지 않으면 이미지가 구매 링크로 연결되지 않고 고지문 제휴사도 못 정한다.
            //   (상품명·가격은 끝까지 지어내지 않는다. 본문 소재는 쿠팡 API 검색 결과가 담당한다.)
            const { getPolicy, AFFILIATE_PROVIDER_IDS } = await import('../affiliate/policies');
            const firstLink = rawLinks[0]!;
            const provider = AFFILIATE_PROVIDER_IDS.find((id) => getPolicy(id)!.linkHosts.test(firstLink));

            // 🛒 쿠팡 구제 경로 — 웹은 막혔지만 리다이렉트는 따라갈 수 있다.
            //   링크 → productId 를 뽑아, 위 2순위에서 이미 받아둔 쿠팡 API 검색 결과와 대조한다.
            //   맞으면 공식 상품명·가격·대표이미지를 그대로 쓴다(추측이 아니라 쿠팡이 준 값).
            //   본문 링크는 끝까지 **사용자가 준 원본** 그대로 둔다(주소 변조 = 계약 위반).
            let rescued = false;
            const apiProducts = (payload as any).coupangProducts as any[] | undefined;
            if (provider === 'coupang' && Array.isArray(apiProducts) && apiProducts.length > 0) {
              const { resolveCoupangProductId } = await import('../affiliate/crawl');
              const pid = await resolveCoupangProductId(firstLink);
              const match = pid ? apiProducts.find((p) => String(p.productId) === pid) : undefined;
              if (match) {
                const rescuedProduct = {
                  provider: 'coupang' as const,
                  originalUrl: firstLink,
                  resolvedUrl: String(match.productUrl || firstLink),
                  title: String(match.productName || ''),
                  imageUrl: String(match.productImage || ''),
                  description: [match.isRocket ? '로켓배송' : '', match.isFreeShipping ? '무료배송' : ''].filter(Boolean).join(' · '),
                  priceKrw: Number(match.productPrice) > 0 ? Number(match.productPrice) : null,
                  priceNote: '',
                };
                (payload as any).affiliateProducts = [rescuedProduct];
                (payload as any).affiliateProvider = 'coupang';
                if (!(payload as any).productImages || (payload as any).productImages.length === 0) {
                  (payload as any).productImages = [rescuedProduct.imageUrl].filter(Boolean);
                }
                modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '')
                  + formatAffiliateProductsForPrompt([rescuedProduct as any]);
                rescued = true;
                onLog?.(`[PROGRESS] 42% - ✅ 쿠팡 API 로 링크 상품 확인: "${rescuedProduct.title.slice(0, 40)}"`
                  + `${rescuedProduct.priceKrw ? ` · ${rescuedProduct.priceKrw.toLocaleString('ko-KR')}원` : ''}`);

                // 🔎 API 가 못 주는 것만 브라우저로 보강한다 — 후기·별점·상세스펙.
                //   숫자(가격)는 절대 여기서 가져오지 않는다: 5개 상품 대조에서 크롬 가격은 1/5 만 맞았다.
                //   창이 잠깐 뜬다(사용자 확인: "오히려 신뢰를 줄 수 있어").
                try {
                  const { enrichCoupangProduct, formatEnrichmentForPrompt } = await import('../affiliate/coupang-enrich');
                  // 캐시 폴더 — 같은 상품 재조회를 막아 쿠팡 차단 위험을 낮춘다
                  const cacheDir = (payload as any).userDataPath
                    || process.env['ORBIT_USER_DATA']
                    || undefined;
                  // v3.8.403: 앞에서 상품명을 알아내며 이미 수집했으면 그걸 쓴다 (창을 두 번 열지 않는다)
                  const already = (payload as any).coupangEnrichment;
                  const enriched = (already && already.productId === pid)
                    ? already
                    : await enrichCoupangProduct(pid, rescuedProduct.title, { onLog, cacheDir });
                  const block = formatEnrichmentForPrompt(enriched);
                  if (block) {
                    modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + block;
                    (payload as any).coupangEnrichment = enriched;
                  }
                } catch (enrichErr: any) {
                  // 보강 실패가 발행을 막지 않는다 — 상품 데이터만으로도 글은 나간다
                  onLog?.(`[PROGRESS] 42% - ⚠️ 후기 보강 건너뜀: ${String(enrichErr?.message || enrichErr).slice(0, 60)}`);
                }
              } else if (pid) {
                onLog?.(`[PROGRESS] 42% - ℹ️ 링크 상품(${pid})이 API 검색 결과에 없습니다 — 검색어를 상품명에 가깝게 쓰면 잡힙니다`);
              }
            }

            if (!rescued && provider) {
              (payload as any).affiliateFallbackUrl = firstLink;
              (payload as any).affiliateProvider = provider;
              onLog?.('[PROGRESS] 42% - ℹ️ 상품 정보는 못 얻었지만 링크·대가성 문구·이미지 링크는 그대로 적용합니다');
            } else if (!rescued) {
              onLog?.('[PROGRESS] 42% - ℹ️ 제휴 상품 정보를 얻지 못했습니다 — 링크만 사용합니다');
            }
          }
        }
      } catch (affErr: any) {
        onLog?.(`[PROGRESS] 42% - ⚠️ 제휴 링크 처리 스킵: ${String(affErr?.message || affErr).slice(0, 80)}`);
      }

      // ── 3순위: 실제 상품 데이터 없으면 가격 할루시 가드 강제 ──
      const hasRealProducts = (Array.isArray((payload as any).coupangProducts) && (payload as any).coupangProducts.length > 0)
        || (Array.isArray((payload as any).affiliateProducts) && (payload as any).affiliateProducts.length > 0);
      if (!hasRealProducts) {
        modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') +
          `\n\n🛡️ **가격 할루시네이션 방지 (실제 상품 데이터 없음)**:\n` +
          `- 본문에 구체적 가격 숫자 직접 표기 절대 금지 ("12,900원", "₩50,000", "월 3만원" 등)\n` +
          `- 가격은 "판매처별 상이", "가격대별 옵션", "예산에 맞게" 같은 추상 표현만 사용\n` +
          `- 할인율, 정가, 세일가 등 임의 수치 생성 금지\n` +
          `- 이유: 검증 불가능한 가격은 발행 시점에 틀려 신뢰도 즉시 붕괴\n`;
      }
    }

    // 4. 🔥 전체 본문 한 번에 생성 (API 호출 1회로 단축!)
    onLog?.('[PROGRESS] 45% - 📝 AI가 전체 본문 생성 중 (1회 호출)...');

    // 🔍 팩트체크: 글 생성 전 실시간 검색으로 팩트 수집 (할루시네이션 방지)
    // v3.8.265: 'off' 명시해도 강제로 'auto'로 폴백 (거미줄에서 팩트체크 끄면 가짜 통계 위험 큼)
    const rawFactMode: FactCheckMode = payload.factCheckMode || 'auto';
    const factCheckMode: FactCheckMode = rawFactMode === 'off' ? 'auto' : rawFactMode;

    // v3.8.333: Grounding 자동 폴백 완전 차단 (사용자 보고: "그라운딩은 폴백으로 쓰지말고 선택으로 바꿔줘 자동폴백되면 과금원인")
    //   Grounding은 편당 ₩500~1,500 과금. 사용자 명시 선택(factCheckMode='grounding') 아니면 자동 비활성화.
    //   기본값: 크롤링 4중 소스로 데이터 확보 → Grounding 불필요 → 과금 원천 차단.
    const groundingExplicitlyRequested = (rawFactMode === 'grounding');
    if (!groundingExplicitlyRequested) {
      process.env['DISABLE_GEMINI_GROUNDING'] = '1';
      if (crawledPosts.length === 0) {
        onLog?.('[PROGRESS] 45% - ⚠️ Grounding 자동 비활성화 (팩트체크 모드=grounding 명시 시만 활성). 콘텐츠는 검색 기반 지식으로 생성.');
      } else {
        onLog?.('[PROGRESS] 45% - ✅ Grounding 비활성화 (4중 크롤링 데이터 사용 → 과금 절약)');
      }
    } else {
      delete process.env['DISABLE_GEMINI_GROUNDING'];
      onLog?.('[PROGRESS] 45% - 🔍 Grounding 활성화 (사용자 명시 선택 — 편당 ₩500~1,500 추가 과금 발생)');
    }
    if (rawFactMode === 'off') {
      onLog?.('[PROGRESS] 44% - ⚠️ 거미줄 모드에서 factCheckMode=off는 위험 → 자동으로 auto로 폴백');
    }
    let factEnrichedContents = contents;
    let factEvidence: FactEvidence = {
      context: '',
      provider: 'none',
      trustLevel: 'none',
      topic: keyword,
    };
    // v3.8.265: factCheckMode는 이제 'off'가 'auto'로 폴백되므로 항상 실행
    {
      try {
        const factModeLabel = factCheckMode === 'perplexity' ? 'Perplexity'
          : factCheckMode === 'naver' ? 'Naver'
          : factCheckMode === 'grounding' ? 'Gemini Grounding'
          : '자동 (Perplexity → Gemini Grounding → Naver)';
        onLog?.(`[PROGRESS] 46% - 🔍 팩트체크 실행 중 (${factModeLabel})...`);
        const factResult = await fetchFactContext(keyword, factCheckMode);
        factEvidence = {
          context: factResult.context || '',
          provider: factResult.provider || 'none',
          trustLevel: factResult.trustLevel || 'none',
          sourceUrls: factResult.sourceUrls || [],
          topic: keyword,
        };
        if (factResult.success && factResult.context) {
          onLog?.(`[PROGRESS] 47% - ✅ 팩트체크 완료 (${factResult.provider}, ${factResult.context.length}자)`);

          // v3.8.333: Perplexity 등 팩트체크 결과를 크롤링 데이터로도 재사용 (사용자 제안: "폴백을 퍼플랙시티로")
          //   Grounding 대신 이미 호출된 Perplexity 결과를 크롤링 소스로 활용 → 추가 과금 없음.
          //   크롤링 4중 소스가 부족한 경우 특히 효과적.
          if (crawledPosts.length < 5 && factResult.context.length > 300) {
            crawledPosts.push({
              title: `${keyword} — ${factResult.provider} 실시간 검색 요약`,
              url: factResult.sourceUrls?.[0] || '',
              content: factResult.context,
              subheadings: [],
              source: `factcheck-${factResult.provider}`,
            } as any);
            onLog?.(`[PROGRESS] 47% - 💾 ${factResult.provider} 결과 크롤링 데이터로 통합 (${factResult.context.length}자) — Grounding 폴백 불필요`);
          }
        } else {
          onLog?.('[PROGRESS] 47% - ⚠️ 실시간 근거 미수집 — 검증되지 않은 수치·일정은 본문에서 생략합니다');
        }
      } catch (factErr: any) {
        onLog?.(`[PROGRESS] 47% - ⚠️ 팩트체크 오류: ${factErr.message?.slice(0, 60)}`);
      }
    }

    // v3.8.389: 공공기관 확인 근거를 수집해 맨 앞에 넣는다.
    //   실측 2026-07-30 — 실속 규칙(v3.8.385) 적용 후 두루뭉실 표현은 -52.8% 로 줄었는데
    //   기관 출처는 +3.5%(사실상 보합)였다. 프롬프트가 약해서가 아니라, 크롤링 소스가
    //   티스토리·워드프레스·뉴스·카페·RSS 뿐이어서 **자료에 기관 근거가 아예 없었기** 때문이다.
    //   규칙 6("확인 못한 숫자는 지어내지 말라")을 지키면 모델은 안 쓰는 게 맞다.
    //   그래서 압박을 늘리는 대신 근거를 찾아서 준다.
    //   generation.ts 가 crawledContents 를 12,000자에서 자르므로 반드시 앞쪽에 둔다.
    //   실패하면 빈 문자열 → 아무것도 추가되지 않는다(악화 없음, 발행도 안 막는다).
    let officialBlock = '';
    try {
      const envForOfficial = loadEnvFromFile();
      const cseKey = envForOfficial['googleCseKey'] || envForOfficial['GOOGLE_CSE_KEY']
        || envForOfficial['GOOGLE_CSE_API_KEY'] || '';
      const cseCx = envForOfficial['googleCseId'] || envForOfficial['GOOGLE_CSE_ID']
        || envForOfficial['googleCseCx'] || envForOfficial['GOOGLE_CSE_CX'] || '';
      // v3.8.403 — 쇼핑 글에는 공공기관 근거를 모으지 않는다.
      //   사용자 지적(2026-08-02): "네이버 크롤링이랑 공공기관 수집은 쇼핑모드에서 왜 하는 건데?"
      //   맞는 지적이다. 상품 글의 근거는 **상품 스펙과 구매자 후기**지 통계청·보건복지부가 아니다.
      //   "통계청 자료에 따르면 물놀이 튜브는…" 같은 문장은 어색하고 신뢰를 오히려 깎는다.
      //   CSE 호출과 13초도 아낀다.
      if (cseKey && cseCx && contentMode !== 'shopping') {
        onLog?.('[PROGRESS] 43% - 🏛️ 공공기관 확인 근거 수집 중...');
        const sources = await collectOfficialSources(keyword, cseKey, cseCx, onLog);
        officialBlock = buildOfficialSourceBlock(sources);
        if (officialBlock) {
          onLog?.(`[PROGRESS] 43% - 🏛️ 기관 근거 ${sources.length}곳 확보 → 프롬프트 주입`);
        }
      }
    } catch (officialErr: any) {
      console.warn('[OFFICIAL] 공공출처 수집 스킵:', String(officialErr?.message || officialErr).slice(0, 80));
    }

    // Always inject the hard evidence policy. A failed search must never mean unrestricted generation.
    factEnrichedContents = [
      buildFactIntegrityPrompt(keyword, factEvidence),
      ...(officialBlock ? [officialBlock] : []),
      ...(factEvidence.context ? [`[FACT EVIDENCE - ${factEvidence.provider}]\n${factEvidence.context}`] : []),
      ...contents,
    ];

    // 섹션 프롬프트 블록은 "참고 데이터"가 아닌 별도 지시로 전달
    const draftContent = (payload as any).draftContent || '';
    const skipQualityBoost = (payload as any).skipQualityBoost === true;

    // v3.7.21: 글 전체 스코프 prepend — 모든 모드(애드센스/쇼핑/페러프레이징/외부유입/내부일관성)에
    //   동일하게 적용. 키워드 한정자(혜택/신청방법/조건 등) 감지 시 sectionPromptBlock 최상단에
    //   "이 글의 모든 H3·본문·결론·CTA·FAQ는 오직 X만 다룬다"를 박는다.
    //   하드코딩 7섹션 모드(애드센스 등)도 본문 LLM 단계에서 한정자 외 내용을 막을 수 있다.
    const overallScope = detectKeywordScope(keyword);
    let scopedSectionBlock = modeResult.sectionPromptBlock || '';
    if (overallScope) {
      const scopePrepend = `\n🎯🎯🎯 **글 전체 스코프 한정 — 절대 위반 금지!**\n키워드 "${keyword}"가 "${overallScope.qualifier}"으로 끝납니다. ${overallScope.instruction}\n\n⚠️ 아래 섹션별 지시 중 "${overallScope.qualifier}" 외 주제(예: 신청방법/조건/대상자/혜택 등)가 언급되어도 그 부분은 "${overallScope.qualifier}" 관점으로 재해석해서 작성하세요. 모든 H3·본문 단락·결론·CTA·FAQ는 오직 "${overallScope.qualifier}"만 다룹니다.\n위반 시 즉시 실격 — 본문 어디에도 한정자 외 측면을 H3 제목/단락 주제로 만들면 안 됩니다.\n`;
      scopedSectionBlock = `${scopePrepend}${scopedSectionBlock}`;
      console.log(`[ORCHESTRATION] 🎯 글 전체 스코프 prepend (mode=${contentMode}, qualifier="${overallScope.qualifier}")`);
      onLog?.(`[PROGRESS] 41% - 🎯 스코프 한정 "${overallScope.qualifier}" 적용 (모드: ${contentMode})`);
    }

    // 🧬 v3.8.385: 중복 회피 — 같은 사이트의 비슷한 글 제목을 프롬프트에 넣어 각도를 벌린다.
    //   차단하지 않는다(사용자 원칙: "검수 때문에 발행이 안 되면 절대 안 된다").
    //   추가 LLM 호출 없이 워드프레스 REST 조회 1회뿐이라 비용도 늘지 않는다.
    //   실측(2026-07-28): 본문 유사도 0.35+ 가 4클러스터 11편. 지금은 작지만
    //   하루 5~10편을 같은 주제군에서 뽑으면 반드시 커진다.
    try {
      const envForDup = loadEnvFromFile();
      const dupSiteUrl = String(
        payload.blogUrl || payload.wordpressSiteUrl || payload.siteUrl || payload.url ||
        envForDup['WORDPRESS_SITE_URL'] || ''
      ).trim().replace(/\/+$/, '');
      if (dupSiteUrl) {
        const existing = await findRelatedPosts(dupSiteUrl, keyword, 8);
        const block = buildUniquenessBlock(existing.map(e => e.title));
        if (block) {
          scopedSectionBlock += block;
          onLog?.(`[PROGRESS] 42% - 🧬 중복 회피: 기존 유사 글 ${existing.length}편을 프롬프트에 반영`);
        }
      }
    } catch (dupErr: any) {
      // 조회 실패는 발행에 영향을 주지 않는다
      console.warn('[UNIQUENESS] 기존 글 조회 스킵:', dupErr?.message?.slice(0, 80));
    }

    // 🧑 v3.8.392: 작성자 경험 메모 주입 — 이 글의 유일한 차별점이다.
    //   근거(사용자 제공 영상): AI 요약이 1초에 답하는 단순 정보성 글은 클릭이 안 되고,
    //   "4월 8일 수요일 어른 2명 9세 1명", "주말 오후 2시 40분 대기" 같은 1차 경험만
    //   AI 로 대체되지 않는다. ⚠️ 도구는 경험을 **생성하지 않는다** — 만들면 허위다.
    //   경험이 없으면 대신 "겪은 척 하지 말라" 안전장치를 넣는다(허위 방지가 더 중요하다).
    try {
      const expInput = normalizeExperience((payload as any).experience);
      if (hasExperience(expInput)) {
        const expBlock = buildExperienceBlock(expInput);
        if (expBlock) {
          scopedSectionBlock += expBlock;
          onLog?.('[PROGRESS] 43% - 🧑 작성자 경험 메모를 본문 생성에 반영');
        }
      } else {
        scopedSectionBlock += NO_EXPERIENCE_GUARD;
      }
    } catch (expErr: any) {
      console.warn('[EXPERIENCE] 경험 블록 스킵:', String(expErr?.message || expErr).slice(0, 80));
    }

    // 🎯 v3.8.392: 초점 좁히기 — 키워드는 그대로 두고 본문 깊이만 좁힌다.
    //   근거(영상 7:56~9:07): "좁아질수록 상위 노출에 유리하나 검색량을 반드시 확인하라."
    //   실측 2026-07-30: 접미어형("○○ 신청방법")은 6개 중 4개가 측정됐고,
    //   앞에 붙이는 형태("아이와 함께 ○○")는 6개 전부 데이터점 0이었다(어순 문제).
    //   측정 안 되는 것은 제안하지 않는다 — 그게 "경쟁 없지만 유입도 없는" 함정을 막는다.
    try {
      const envForNarrow = loadEnvFromFile();
      const naverId = envForNarrow['naverClientId'] || envForNarrow['NAVER_CLIENT_ID'] || '';
      const naverSecret = envForNarrow['naverClientSecret'] || envForNarrow['NAVER_CLIENT_SECRET'] || '';
      if (naverId && naverSecret) {
        const narrowed = await suggestNarrowerKeywords(keyword, {
          clientId: naverId, clientSecret: naverSecret,
        });
        const focusBlock = buildNarrowFocusBlock(narrowed);
        if (focusBlock) {
          scopedSectionBlock += focusBlock;
          onLog?.(`[PROGRESS] 44% - 🎯 ${narrowed.summary}`);
        } else if (narrowed.summary) {
          onLog?.(`   [초점] ${narrowed.summary}`);
        }
      }
    } catch (narrowErr: any) {
      console.warn('[NARROWING] 초점 좁히기 스킵:', String(narrowErr?.message || narrowErr).slice(0, 80));
    }

    // 📖 v3.8.404 — 가독성 규칙 (사용자 지적: "논문 같아서 가독성이 좀 떨어진다")
    //   발행글 실측: 문단 46개, 평균 203자, **모바일에서 6줄을 넘는 문단이 42개(91%)**.
    //   2026 기준 권장은 한 문단 6줄 이내다. 6줄이 넘으면 읽기 전에 부담부터 준다.
    //   글자 크기·줄간격은 발행 단계에서 키웠고(16~18px·1.8), 문단 길이는 여기서 줄인다.
    //   ⚠️ 후처리로 문장을 쪼개면 뜻과 흐름이 깨진다 — 처음부터 짧게 쓰게 한다.
    modeResult.sectionPromptBlock = (modeResult.sectionPromptBlock || '') + `

📖 **읽기 편하게 쓰는 법 (분량은 그대로, 덩어리만 나눈다)**
- 한 문단은 **2~3문장, 120자 이내**로 끊으세요. 지금까지는 200자를 넘겨 읽기 부담스러웠습니다.
- 한 가지 생각이 끝나면 문단을 바꾸세요. 관련 있다고 이어 붙이지 마세요.
- 섹션마다 **목록(<ul><li>)을 최소 한 번** 쓰세요. 나열할 내용은 문장으로 늘어놓지 말고 목록으로.
- 숫자·조건·비교가 3개 이상이면 **표(<table>)**로 정리하세요.
- 핵심 문장은 <strong>으로 감싸 훑어보는 독자가 건질 수 있게 하세요.
- 전체 분량은 줄이지 마세요. **같은 내용을 더 잘게 나누는 것**입니다.
`;

    let allSectionsObj = await generateAllSectionsFinal(
      keyword,
      h2Titles,
      factEnrichedContents,
      onLog,
      contentMode,
      draftContent,
      scopedSectionBlock,
      skipQualityBoost,
    );

    // 🧬 v3.8.390: 자기중복 관측 — **차단하지 않는다.** 재고만 하고 발행은 그대로 진행한다.
    //   v3.8.385 에 넣은 buildUniquenessBlock(기존 글 제목을 보여줘 각도를 다르게 잡게 하는 예방책)이
    //   실제로 먹혔는지 재는 계기판이 없었다. 효과를 모르면 개선도 못 한다.
    //   기존 유사도 검증은 페러프레이징 모드(원문 대비)뿐이고 "내 사이트 기존 글 대비"는 없었다.
    //   비용: 워드프레스 REST 1회(본문 8편 동시 수신), LLM 호출 0.
    try {
      const overlapSiteUrl = String(
        (payload as any).blogUrl || (payload as any).wordpressSiteUrl || (payload as any).siteUrl
        || loadEnvFromFile()['WORDPRESS_SITE_URL'] || '',
      ).trim().replace(/\/+$/, '');
      // 워드프레스가 아니면 REST 조회가 실패하고 skipped 로 조용히 돌아온다 — 별도 분기 불필요
      if (overlapSiteUrl) {
        const bodyForOverlap = [
          allSectionsObj.introduction,
          ...allSectionsObj.sections.flatMap((s: any) =>
            (s.h3Sections || []).map((h: any) => h.content || '')),
          allSectionsObj.conclusion,
        ].join('\n');
        const { measureSelfOverlap, formatSelfOverlapLog } = await import('../self-overlap');
        const report = await measureSelfOverlap(overlapSiteUrl, keyword, bodyForOverlap);
        const line = formatSelfOverlapLog(report);
        if (line) {
          onLog?.(line);
          console.log('[SELF-OVERLAP]', line.trim());
        }
      }
    } catch (overlapErr: any) {
      // 관측 실패는 발행에 어떤 영향도 주지 않는다
      console.warn('[SELF-OVERLAP] 관측 스킵:', String(overlapErr?.message || overlapErr).slice(0, 80));
    }

    // 🔄 페러프레이징 모드: 유사도 검증 + 임계값 초과 시 자동 재시도 1회
    if (contentMode === 'paraphrasing' && draftContent) {
      try {
        const { checkParaphrasingSimilarity } = await import('../paraphrasing-validator');
        const computeSimilarity = (obj: any) => {
          const combined = [
            obj.introduction,
            ...obj.sections.flatMap((s: any) => (s.h3Sections || []).map((h: any) => h.content || '')),
            obj.conclusion,
          ].join(' ');
          return checkParaphrasingSimilarity(draftContent, combined, 0.4);
        };

        let report = computeSimilarity(allSectionsObj);
        onLog?.(`[PROGRESS] 68% - 🔄 페러프레이징 1차 검증: ${report.message}`);
        console.log(`[PARAPHRASING] 1차: ${report.message}`);

        if (!report.pass) {
          // 자동 재시도 — 더 강력한 재구성 지시 추가
          onLog?.('[PROGRESS] 69% - 🔄 유사도 초과 → 더 강한 재구성으로 재시도 중...');
          const stricterPromptBlock = scopedSectionBlock +
            `\n\n🚨 **재시도 모드**: 이전 시도가 원문과 유사도 ${(report.similarity * 100).toFixed(0)}%로 너무 비슷했습니다. 이번엔 다음 규칙을 더 강하게 지키세요:\n` +
            `- 원문의 어휘를 직접 사용하지 말고, 모든 명사·형용사·동사를 유의어로 교체\n` +
            `- 문장 구조를 완전히 새로 짜기 (나열식 → 인과식, 시간순 → 중요도순 등)\n` +
            `- 원문에 없던 새로운 데이터/관점/사례를 최소 2개 이상 추가\n` +
            `- 원문이 다루지 않은 다른 측면을 30% 이상 비중으로 다루기\n`;
          allSectionsObj = await generateAllSectionsFinal(
            keyword,
            h2Titles,
            factEnrichedContents,
            onLog,
            contentMode,
            draftContent,
            stricterPromptBlock,
            skipQualityBoost,
          );
          report = computeSimilarity(allSectionsObj);
          onLog?.(`[PROGRESS] 70% - 🔄 페러프레이징 2차 검증: ${report.message}`);
          console.log(`[PARAPHRASING] 2차: ${report.message}`);
          if (!report.pass) {
            console.warn('[PARAPHRASING] 🚨 2차 시도도 실패 — Scaled Content Abuse 리스크 그대로. 수동 검토 필수.');
            onLog?.('[PROGRESS] 70% - 🚨 페러프레이징 2회 시도 모두 임계값 초과. 수동 검토 권장.');
          }
        }
      } catch (e: any) {
        console.warn(`[PARAPHRASING] 유사도 검증 실패: ${e.message}`);
      }
    }

    // 🛡️ v3.5.80: 모드별 정확 H2 개수 강제 검증 + 부족 시 1회 재시도
    //   사용자 prompt block에 명시된 섹션 구조를 LLM이 따르지 않을 때 안전망
    //     adsense:      target=6 (정형 sections), min=5
    //     shopping:     target=7 (7단계 퍼널),    min=6
    //     paraphrasing: target=6 (6단계 재구성),  min=5
    //     internal:     target=5 (자기완결형),     min=4
    //     external:     target=5 (검색 의도 4단계 + 마무리), min=4
    const MODE_H2_TARGETS: Record<string, { target: number; min: number }> = {
      adsense:      { target: 6, min: 5 },
      shopping:     { target: 7, min: 6 },
      paraphrasing: { target: 6, min: 5 },
      internal:     { target: 5, min: 4 },
      external:     { target: 5, min: 4 },
    };
    const modeKey = String(contentMode || '').toLowerCase();
    const modeTargets = MODE_H2_TARGETS[modeKey];
    if (modeTargets) {
      const currentH2Count = (allSectionsObj.sections || []).length;
      if (currentH2Count < modeTargets.min) {
        console.warn(`[H2-ENFORCE] ⚠️ 모드 '${modeKey}' H2 ${currentH2Count}개 < min ${modeTargets.min} — 더 엄격한 프롬프트로 1회 재시도`);
        onLog?.(`[PROGRESS] 71% - 🛡️ H2 ${currentH2Count}개 부족 (모드 '${modeKey}' 최소 ${modeTargets.min}개) — 재시도 중...`);
        const stricterBlock = scopedSectionBlock +
          `\n\n🚨🚨🚨 **재시도 — H2 개수 강제 규칙**: 직전 응답이 H2 ${currentH2Count}개로 부족했습니다.\n` +
          `이번엔 반드시 H2를 정확히 ${modeTargets.target}개 만들어야 합니다.\n` +
          `JSON의 "sections" 배열 길이가 정확히 ${modeTargets.target}이어야 통과됩니다.\n` +
          `각 섹션은 prompt에 명시된 구조 가이드를 그대로 따르세요.\n`;
        try {
          const retried = await generateAllSectionsFinal(
            keyword,
            h2Titles,
            factEnrichedContents,
            onLog,
            contentMode,
            draftContent,
            stricterBlock,
            skipQualityBoost,
          );
          const retriedCount = (retried.sections || []).length;
          if (retriedCount >= modeTargets.min) {
            allSectionsObj = retried;
            onLog?.(`[PROGRESS] 72% - ✅ 재시도 성공: H2 ${retriedCount}개`);
          } else {
            onLog?.(`[PROGRESS] 72% - ⚠️ 재시도도 H2 ${retriedCount}개 — main.ts 차단망에서 최종 거부됨`);
          }
        } catch (retryErr: any) {
          console.warn(`[H2-ENFORCE] 재시도 실패: ${retryErr?.message?.slice(0, 100)}`);
          onLog?.(`[PROGRESS] 72% - ⚠️ H2 재시도 실패 (그대로 진행): ${retryErr?.message?.slice(0, 80)}`);
        }
      } else if (currentH2Count < modeTargets.target) {
        onLog?.(`[PROGRESS] 71% - ℹ️ H2 ${currentH2Count}/${modeTargets.target} (min ${modeTargets.min} 충족 — 통과)`);
      }
    }

    // v3.8.91: 본문 글자수 검증 + 자동 재시도 (사용자 보고: 블로그스팟 발행 글이 짧음)
    //   거미줄(v3.8.81)과 동일 메커니즘 — H2 개수만 맞고 각 H3 본문이 짧으면 SEO 효과 X.
    //   판별: 모든 sections + intro + conclusion 평문 합산 < 3000자면 재시도.
    {
      const stripTags = (s: any) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const sumPlain = (obj: any): number => {
        let total = stripTags(obj.introduction).length + stripTags(obj.conclusion).length;
        for (const s of (obj.sections || [])) {
          for (const h3 of (s.h3Sections || [])) total += stripTags(h3.content).length;
        }
        return total;
      };
      let plainLen = sumPlain(allSectionsObj);
      onLog?.(`[PROGRESS] 72% - 📏 본문 평문 ${plainLen.toLocaleString()}자 (목표 8,000자+, 최소 3,000자)`);
      if (plainLen < 3000) {
        onLog?.(`[PROGRESS] 73% - ⚠️ 본문 부족 (${plainLen}자) — 더 풍부하게 1회 재시도`);
        const richerBlock = scopedSectionBlock +
          `\n\n🚨 **재시도 — 본문 분량 강제 규칙**: 직전 응답의 본문 합계가 ${plainLen}자로 너무 짧았습니다.\n` +
          `반드시 다음 규칙을 지키세요:\n` +
          `- 각 H2 본문 최소 1,200자 이상\n` +
          `- 각 H3 세부 섹션 최소 500자 이상\n` +
          `- 도입부 600자 이상, 결론 400자 이상\n` +
          `- 총 본문 8,000자 이상 (HTML 태그 제외 순수 텍스트)\n` +
          `- 잘림 절대 금지 — 모든 섹션 끝까지 완성\n`;
        try {
          const retried = await generateAllSectionsFinal(
            keyword, h2Titles, factEnrichedContents, onLog, contentMode, draftContent, richerBlock, skipQualityBoost,
          );
          const retriedLen = sumPlain(retried);
          if (retriedLen > plainLen) {
            allSectionsObj = retried;
            plainLen = retriedLen;
            onLog?.(`[PROGRESS] 74% - ✅ 재시도 성공: 본문 평문 ${plainLen.toLocaleString()}자`);
          } else {
            onLog?.(`[PROGRESS] 74% - ⚠️ 재시도도 ${retriedLen}자 — 원본 유지하고 진행`);
          }
        } catch (retryErr: any) {
          console.warn(`[LEN-ENFORCE] 본문 재시도 실패: ${retryErr?.message?.slice(0, 100)}`);
          onLog?.(`[PROGRESS] 74% - ⚠️ 본문 재시도 오류 (그대로 진행): ${retryErr?.message?.slice(0, 80)}`);
        }
      }
    }

    // 🧱 v3.8.374: 실속(정보 밀도) 게이트 — 분량만 채우고 알맹이가 없는 글 차단
    //   기존 게이트는 전부 분량 지표(글자수·단락수·출처 언급수)라서 "9,000자짜리 헛소리"가 다 통과했다.
    //   여기서는 구체 팩트(금액·비율·기간·수량·날짜·기관명) 밀도를 재고, 미달이면 1회 재생성한다.
    //   실측 보정(2026-07-25, 발행글 10편): 통과 6 / 미달 4 — 사용자가 지적한 글이 정확히 미달로 잡힘.
    try {
      const collectBodyHtml = (obj: any): string => [
        String(obj?.introduction || ''),
        ...(obj?.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => String(h?.content || ''))),
        String(obj?.conclusion || ''),
      ].join('\n');

      let substanceReport = scanSubstance({ contentHtml: collectBodyHtml(allSectionsObj) });
      onLog?.(`[PROGRESS] 74% - 🧱 ${substanceReport.summary}`);
      console.log(`[SUBSTANCE] ${substanceReport.summary}`);

      // v3.8.376: 자동 재생성 기본 OFF — 측정·경고만 하고 추가 LLM 호출은 하지 않는다.
      //   실측(2026-07-26, 유료 OpenAI 엔진 연속발행): 재생성이 매 편 발동해 편당 본문급 호출 +1,
      //   심지어 점수가 되레 하락(41→29)해 결과도 버려짐 = 비용 100% 낭비.
      //   사용자 원칙: "비용은 고정되어야 한다" — 재생성은 명시적 opt-in만 허용.
      //   opt-in: payload.substanceAutoRegen === true 또는 env SUBSTANCE_AUTO_REGEN=1
      const substanceAutoRegen = (payload as any)?.substanceAutoRegen === true
        || process.env['SUBSTANCE_AUTO_REGEN'] === '1';

      if (!substanceReport.passed && !substanceAutoRegen) {
        substanceReport.worstSentences.slice(0, 3).forEach(s => console.warn(`[SUBSTANCE] 알맹이 없는 문장: ${s}`));
        onLog?.('[PROGRESS] 75% - 🧱 실속 미달 경고만 기록 (자동 재생성 OFF — 추가 비용 없음)');
      } else if (!substanceReport.passed) {
        substanceReport.worstSentences.slice(0, 3).forEach(s => console.warn(`[SUBSTANCE] 알맹이 없는 문장: ${s}`));
        onLog?.('[PROGRESS] 75% - 🧱 실속 부족 → 구체 정보를 강제하는 프롬프트로 1회 재생성 중... (opt-in)');
        const substanceBlock = scopedSectionBlock + buildSubstanceRetryBlock(substanceReport);
        try {
          const retried = await generateAllSectionsFinal(
            keyword, h2Titles, factEnrichedContents, onLog, contentMode, draftContent, substanceBlock, skipQualityBoost,
          );
          const retriedReport = scanSubstance({ contentHtml: collectBodyHtml(retried) });
          if (retriedReport.score > substanceReport.score) {
            allSectionsObj = retried;
            substanceReport = retriedReport;
            onLog?.(`[PROGRESS] 76% - ✅ 재생성으로 실속 개선: ${retriedReport.summary}`);
          } else {
            onLog?.(`[PROGRESS] 76% - ⚠️ 재생성도 점수 ${retriedReport.score} (기존 ${substanceReport.score}) — 원본 유지`);
          }
        } catch (retryErr: any) {
          console.warn(`[SUBSTANCE] 재생성 실패: ${retryErr?.message?.slice(0, 100)}`);
          onLog?.(`[PROGRESS] 76% - ⚠️ 실속 재생성 오류 (그대로 진행): ${retryErr?.message?.slice(0, 80)}`);
        }
      }
    } catch (substanceErr: any) {
      console.warn('[SUBSTANCE] 실속 게이트 오류 (발행 계속):', substanceErr?.message);
    }

    // A prompt is not enough: verify the returned JSON before any FAQ, image, or publishing work begins.
    let factIntegrityReport = inspectArticleFactIntegrity(allSectionsObj, factEvidence);
    if (factIntegrityReport.status === 'blocked') {
      onLog?.(`[PROGRESS] 74% - [FACT] 근거와 일치하지 않는 주장 ${factIntegrityReport.violations.length}건을 제거 후 재검사합니다.`);
      allSectionsObj = sanitizeArticleFactClaims(allSectionsObj, factEvidence);
      factIntegrityReport = inspectArticleFactIntegrity(allSectionsObj, factEvidence);

      if (factIntegrityReport.status === 'blocked') {
        const firstIssue = factIntegrityReport.violations[0];
        const detail = firstIssue ? `${firstIssue.location || 'article'}: ${firstIssue.detail}` : 'unknown evidence mismatch';
        // v3.8.323: 발행 차단 대신 경고만 남기고 진행.
        onLog?.(`[PROGRESS] 74% - ⚠️ [FACT] 본문 근거 부족 감지: ${detail} (경고만 남기고 발행 진행)`);
        console.warn('[FACT] 본문 근거 부족 — 경고 강등:', detail);
      }
      onLog?.('[PROGRESS] 74% - [FACT] 근거 없는 정확한 정보 제거 완료');
    } else {
      onLog?.(`[PROGRESS] 74% - [FACT] 근거 일치 검사 통과 (${factIntegrityReport.checkedClaims}개 문장 확인)`);
    }

    // v3.8.368: 제목이 통째로 키워드로 되돌아가던 버그 fix
    //   과거: 제목에서 키워드를 뺀 나머지에 근거 미확인 값이 하나라도 있으면 h1 = keyword 로 전체 교체.
    //         generateH1TitleFinal은 프롬프트에서 "2026년"을 제목 맨 앞에 넣으라고 지시하는데,
    //         그 연도가 크롤링 스니펫에 없다는 이유로 AI가 만든 제목 전체가 버려졌다.
    //         (사용자 보고: "자동생성으로 선택했는데 키워드가 그대로 제목으로 발행됨")
    //   현재: H2/H3와 동일하게 sanitizeFactUnsafeHeading으로 "근거 미확인 토큰만" 도려낸다.
    //         전부 도려내져 남는 게 없을 때만 키워드로 폴백.
    if (!payload.useKeywordAsTitle) {
      const sanitizedH1 = sanitizeFactUnsafeHeading(h1, factEvidence, keyword);
      if (sanitizedH1 && sanitizedH1 !== h1) {
        onLog?.(`[PROGRESS] 74% - [FACT] 제목의 근거 미확인 값만 정리했습니다: "${sanitizedH1}"`);
        h1 = sanitizedH1;
      }
    }

    const sections = allSectionsObj.sections;
    const introductionHTML = allSectionsObj.introduction;
    const conclusionHTML = allSectionsObj.conclusion;
    const articleTextForAux = [
      introductionHTML,
      ...sections.flatMap(s => s.h3Sections.map(h => h.content)),
      conclusionHTML,
    ].join('\n');

    // 4.5. 🔥 FAQ 생성 (별도 API 호출 — Schema.org FAQPage 포함)
    let faqs = await generateFAQFinal(keyword, h2Titles, onLog, articleTextForAux);
    const faqText = faqs.map((item) => `${item.question} ${item.answer}`).join('\n');
    if (inspectFactIntegrity(faqText, factEvidence).status === 'blocked') {
      onLog?.('[PROGRESS] 68% - [FACT] FAQ의 근거 없는 정확한 정보를 정리합니다.');
      // v3.8.368: FAQ 질문/답변 짝이 밀리던 버그 fix
      //   과거: question에도 문장 단위 삭제형(sanitizeFactUnsafeHtml)을 적용.
      //         "육아휴직 급여는 언제부터 신청하나요?" 처럼 민감어(신청)+숫자가 있는 질문은
      //         문장 전체가 삭제되어 빈 질문이 되고, 접기 UI에서 Q/A 짝이 한 칸씩 밀렸다.
      //   현재: question은 라벨이므로 sanitizeFactUnsafeHeading(토큰만 도려내기)을 쓰고,
      //         그래도 비면 해당 FAQ 항목을 통째로 버려 짝이 절대 밀리지 않게 한다.
      const beforeCount = faqs.length;
      faqs = faqs
        .map((item) => {
          const q = sanitizeFactUnsafeHeading(String(item.question || ''), factEvidence, '');
          const a = sanitizeFactUnsafeHtml(String(item.answer || ''), factEvidence);
          return { ...item, question: q, answer: a };
        })
        .filter((item) => {
          const hasQ = String(item.question || '').trim().length > 0;
          const hasA = String(item.answer || '').replace(/<[^>]*>/g, '').trim().length > 0;
          if (!hasQ || !hasA) {
            console.warn('[FACT] FAQ 항목 제거 (질문 또는 답변이 비어 짝 밀림 방지):', {
              question: String(item.question || '').slice(0, 60),
              answerLen: String(item.answer || '').length,
            });
            return false;
          }
          return true;
        });
      if (faqs.length !== beforeCount) {
        onLog?.(`[PROGRESS] 68% - [FACT] FAQ ${beforeCount - faqs.length}개 항목 제거 (내용 유실로 짝 밀림 방지) — 남은 ${faqs.length}개`);
      }
      const sanitizedFaqText = faqs.map((item) => `${item.question} ${item.answer}`).join('\n');
      if (inspectFactIntegrity(sanitizedFaqText, factEvidence).status === 'blocked') {
        // v3.8.323: 발행 차단 대신 경고만 남기고 진행.
        onLog?.('⚠️ [FACT] FAQ 근거 부족 감지 (경고만 남기고 발행 진행)');
        console.warn('[FACT] FAQ 근거 부족 — 경고 강등');
      }
    }

    // 5. CTA 생성 (manualCtas 우선, 없으면 자동 생성)
    onLog?.('[PROGRESS] 70% - 💰 CTA 버튼 생성 중...');
    let ctas: FinalCTAData[] = [];

    // 🔥 수동 CTA가 있으면 우선 사용 (애드센스 모드에서는 수동 CTA도 차단)
    if (contentMode !== 'adsense' && payload.manualCtas && Object.keys(payload.manualCtas).length > 0) {
      // 📥 문서 URL이면 빈 텍스트를 다운로드 버튼으로 자동 채움
      const manualDocMatch = (url: string) => {
        const m = url.match(/\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|txt|pages|numbers)(\?|#|$)/i);
        if (!m) return null;
        const ext = m[1]!.toLowerCase();
        const label =
          ext === 'pdf' ? 'PDF 자료' :
          /^(ppt|pps|key)/.test(ext) ? '발표자료' :
          /^doc|^odt|^rtf|^txt|pages/.test(ext) ? '문서' :
          /^xls|^ods|csv|tsv|numbers/.test(ext) ? '엑셀 자료' :
          /^hwp/.test(ext) ? '한글파일' :
          /^(zip|rar|7z)/.test(ext) ? '압축파일' :
          '자료';
        return { btn: `📥 ${label} 다운받기`, hook: `${label}를 다운받아 자세히 확인하세요!` };
      };
      for (const [position, ctaData] of Object.entries(payload.manualCtas) as Array<[string, any]>) {
        if (ctaData && ctaData.url) {
          const formatCheck = validateCtaUrlFormat(ctaData.url);
          if (!formatCheck.isValid) {
            console.warn(`[CTA] ⚠️ 수동 CTA URL 형식 오류: ${ctaData.url} (${formatCheck.reason}) — 건너뜀`);
            continue;
          }
          const urlCheck = await validateCtaUrl(ctaData.url, { timeout: 5000 });
          if (!urlCheck.isValid) {
            console.warn(`[CTA] ⚠️ 수동 CTA URL 접속 검증 실패: ${ctaData.url} (${urlCheck.reason}) — 건너뜀`);
            continue;
          }
          const docInfo = manualDocMatch(ctaData.url);
          ctas.push({
            hookingMessage: ctaData.hook || (docInfo ? docInfo.hook : '더 자세한 정보가 궁금하시다면?'),
            buttonText: ctaData.text || (docInfo ? docInfo.btn : '자세히 보기'),
            url: ctaData.url,
            position: parseInt(position) || 0
          });
          console.log(`[CTA] ✅ 수동 CTA 접속 검증 통과: ${ctaData.url}${docInfo ? ' (문서 감지 → 다운로드 버튼 자동 적용)' : ''}`);
        }
      }
    }

    // 수동 CTA가 없으면 자동 생성
    if (ctas.length === 0) {
      ctas = await generateCTAsFinal(keyword, crawledPosts, sections, contentMode);
    }

    // CTA 배치
    ctas.forEach(cta => {
      const rawPosition = cta.position ?? 0;
      // 🔥 위치 범위 클램핑 — sections 배열 범위를 벗어나면 마지막 섹션으로 
      const position = Math.min(Math.max(0, rawPosition), sections.length - 1);
      if (rawPosition !== position) {
        console.log(`[CTA] ⚠️ 위치 클램핑: ${rawPosition} → ${position} (sections 범위: 0~${sections.length - 1})`);
      }
      const section = sections[position];
      if (section && section.h3Sections.length > 0) {
        const lastIdx = section.h3Sections.length - 1;
        if (section.h3Sections[lastIdx]) {
          section.h3Sections[lastIdx].cta = cta;
        }
      }
    });

    // 🔥 CTA 배치 실패 시 폴백: 마지막 섹션의 마지막 h3에 첫 번째 CTA 강제 배치
    if (ctas.length > 0) {
      const anyCtaPlaced = sections.some(s => s.h3Sections.some((h3: any) => h3.cta));
      if (!anyCtaPlaced && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.h3Sections.length > 0) {
          lastSection.h3Sections[lastSection.h3Sections.length - 1]!.cta = ctas[0] as any;
          console.log(`[CTA] 🔧 폴백: 마지막 섹션에 CTA 강제 배치`);
        }
      }
    }

    // 6. 요약표
    let summaryTable = await generateSummaryTableFinal(articleTextForAux);
    const summaryFactText = [...(summaryTable.headers || []), ...(summaryTable.rows || []).flat()].join(' ');
    if (inspectFactIntegrity(summaryFactText, factEvidence).status === 'blocked') {
      summaryTable = {
        ...summaryTable,
        headers: (summaryTable.headers || []).map((value) => sanitizeFactUnsafeHtml(value, factEvidence)),
        rows: (summaryTable.rows || []).map((row) => row.map((value) => sanitizeFactUnsafeHtml(value, factEvidence))),
      };
      const sanitizedSummaryText = [...(summaryTable.headers || []), ...(summaryTable.rows || []).flat()].join(' ');
      if (inspectFactIntegrity(sanitizedSummaryText, factEvidence).status === 'blocked') {
        // v3.8.323: 크롤링이 항상 완벽하지 않음 → 발행 차단 대신 경고만 남기고 진행 (사용자 보고: "크롤링이 정확하지 않은 것 같아")
        onLog?.('[PROGRESS] 70% - ⚠️ [FACT] 요약표 근거 부족 감지 (경고만 남기고 발행 진행)');
        console.warn('[FACT] 요약표 근거 부족 — 경고 강등:', { sanitizedSummaryText: sanitizedSummaryText.slice(0, 200) });
      }
      onLog?.('[PROGRESS] 70% - [FACT] 요약표의 근거 없는 정확한 정보를 정리했습니다.');
    }

    // 7. 해시태그
    const hashtags = await generateHashtagsFinal(keyword, h2Titles);

    // 8. HTML 조립
    onLog?.('[PROGRESS] 75% - 🎨 백서(White Paper) 구조 조립 중...');

    // contentMode는 이미 위에서 추출됨 (H2 생성 전에 사용)
    let html = generateCSSFinal(platform, contentMode);

    // 💎 백서(White Paper) 시작 — .bgpt-content 래퍼로 CSS 변수 적용
    html += '<div class="bgpt-content">';
    html += '<div class="gradient-frame" id="premium-white-paper-container">';
    html += '<div class="white-paper">';

    // 워드프레스 테마 등에 의해 h1이 외부에서 출력되는 경우를 위해,
    // 이 스크립트가 생성하는 H1은 확실하게 백서 컨테이너 안쪽에 랜딩 페이지 타이틀처럼 배치합니다.
    html += `\n<h1 class="post-title">${h1}</h1>\n`;

    // 🛒 v3.8.375: 쿠팡 파트너스 대가성 문구 자리 — 반드시 H1 직후, 이미지·링크·태그보다 앞.
    //   쿠팡 가이드가 "태그, 링크, 이미지 다음에 작성하는 경우"를 금지하므로 최상단에 고정한다.
    //   상품이 없으면 아래에서 자리표시자만 제거된다.
    html += `<!-- COUPANG_DISCLOSURE_PLACEHOLDER -->`;

    // 🛡️ E-E-A-T 메타 박스 자리 표시 — 후처리에서 채움 (작성자/검토자/발행일/읽기시간/출처)
    html += `<!-- EEAT_META_PLACEHOLDER -->`;

    // 🔥 썸네일 자리 표시
    html += `<!-- THUMBNAIL_PLACEHOLDER -->`;

    // 워드프레스와 블로그스팟 모두 백서 템플릿의 목차 모듈을 사용
    html += `<!-- TOP_SUMMARY_CTA_PLACEHOLDER -->`;
    html += generateTOCFinal(h2Titles);

    // 🖼️ H2 섹션별 이미지 생성 
    const sectionImages: string[] = [];
    const sectionImageSources: string[] = [];

    // v3.5.96: 이미지 배치 모드 — 사용자가 비용 절감을 위해 일부 섹션만 이미지 생성
    //   'all' (또는 미설정) → 모든 H2 섹션
    //   'odd' → 홀수만 (1, 3, 5)
    //   'even' → 짝수만 (2, 4)
    //   'thumbnail-only' → 본문 이미지 0장, 썸네일만
    //   'none' → 썸네일까지 모두 스킵 (이건 skipImages=true로 처리)
    let selectedH2SectionsRaw: any = payload.h2ImageSections || payload.h2Images?.sections || [];

    // 모드가 명시되면 sections 배열을 자동 계산 (UI에서 보낸 배열을 덮어씀)
    if (h2ImageMode === 'odd') {
      selectedH2SectionsRaw = Array.from({ length: sections.length }, (_, i) => i + 1).filter(n => n % 2 === 1);
      onLog?.(`[PROGRESS] 75% - 🖼️ 이미지 배치: 홀수 섹션만 (${selectedH2SectionsRaw.join(', ')}번)`);
    } else if (h2ImageMode === 'even') {
      selectedH2SectionsRaw = Array.from({ length: sections.length }, (_, i) => i + 1).filter(n => n % 2 === 0);
      onLog?.(`[PROGRESS] 75% - 🖼️ 이미지 배치: 짝수 섹션만 (${selectedH2SectionsRaw.join(', ')}번)`);
    } else if (h2ImageMode === 'thumbnail-only' || h2ImageMode === 'thumbnail_only') {
      selectedH2SectionsRaw = [-1]; // sentinel: 본문 이미지 0장, 썸네일만 유지
      onLog?.(`[PROGRESS] 75% - 🖼️ 이미지 배치: 썸네일만 (본문 이미지 0장)`);
    } else if (h2ImageMode === 'all' || !h2ImageMode) {
      // 'all' 또는 미설정 — 기존 배열 그대로 사용 (또는 전체 fallback)
    }

    const selectedH2Sections: number[] = Array.isArray(selectedH2SectionsRaw)
      ? selectedH2SectionsRaw.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0)
      : [];
    // thumbnail-only 모드는 sentinel [-1]이라 위 filter에서 0개 통과 → effectiveSelectedH2Sections 빈 배열
    const isThumbnailOnly = h2ImageMode === 'thumbnail-only' || h2ImageMode === 'thumbnail_only';

    // 🔥 빠른 모드: 이미지 생성 스킵
    if (skipImages) {
      onLog?.('[PROGRESS] 80% - ⚡ 빠른 모드: 이미지 생성 스킵');
      for (let i = 0; i < sections.length; i++) {
        sectionImages.push('');
        sectionImageSources.push('');
      }
    } else {
      onLog?.('[PROGRESS] 75% - 🖼️ 섹션별 이미지 생성 중...');
      onLog?.(`   🎯 선택된 이미지 소스: ${imageSource}`);

      // 🔥 이미지 배치 섹션 선택 — 썸네일은 썸네일, 섹션 이미지는 섹션 이미지로 독립 생성.
      //    v3.5.55부터 adsense 모드에서도 섹션1(이젠 'understanding_topic')에 이미지 정상 삽입.
      //    v3.5.96: thumbnail-only 모드는 본문 이미지 0장 → 빈 배열로 명시 (전체 fallback 차단)
      const effectiveSelectedH2Sections = isThumbnailOnly
        ? []
        : selectedH2Sections.length > 0
          ? selectedH2Sections
          : Array.from({ length: sections.length }, (_, i) => i + 1);

      const envData = loadEnvFromFile();
      const pexelsKey = envData['pexelsApiKey'] || envData['PEXELS_API_KEY'] || '';
      const openaiKey = envData['openaiKey'] || envData['OPENAI_API_KEY'] || '';
      const stabilityKey = envData['stabilityApiKey'] || envData['STABILITY_API_KEY'] || '';

      // 🔥 API 키 상태 로그
      console.log('[ULTIMATE] API 키 상태:');
      console.log('   - Stability:', stabilityKey ? `있음 (${stabilityKey.length}자)` : '없음');
      console.log('   - OpenAI:', openaiKey ? `있음 (${openaiKey.length}자)` : '없음');
      console.log('   - Pexels:', pexelsKey ? `있음 (${pexelsKey.length}자)` : '없음');

      // 선택된 H2 섹션 수만큼 이미지 생성 (fastMode 제한 해제)
      const maxImages = sections.length;

      // 🚀 병렬 이미지 생성 — 모든 섹션의 이미지를 동시에 생성 (유료 티어: 충분한 RPM)
      const imageGenStartTime = Date.now();
      let completedCount = 0;
      const totalToGenerate = sections.filter((_, i) => {
        const h2Number = i + 1;
        return i < maxImages && effectiveSelectedH2Sections.includes(h2Number);
      }).length;

      // 이미지 섹션 설정이 실제 섹션 수와 맞지 않으면 경고
      const maxSection = effectiveSelectedH2Sections.length > 0 ? Math.max(...effectiveSelectedH2Sections) : 0;
      if (maxSection > sections.length) {
        onLog?.(`[PROGRESS] 75% - ⚠️ 이미지 섹션 설정(최대 ${maxSection})이 실제 섹션 수(${sections.length})를 초과합니다. 초과분은 무시됩니다.`);
      }
      const imageSourceKey = String(imageSource).toLowerCase();
      const dropshotSequential = imageSourceKey === 'dropshot' || imageSourceKey === 'dropshot-nanobanana-pro';
      onLog?.(`[PROGRESS] 75% - ${dropshotSequential ? '🍌 리더스 이미지 순차 생성 시작' : '🧵 이미지 공통 큐 생성 시작'} (${totalToGenerate}장)...`);

      // 각 섹션별 이미지 생성 함수
      async function generateSingleSectionImage(i: number): Promise<{ dataUrl: string; source: string }> {
        const section = sections[i];
        if (!section) return { dataUrl: '', source: '' };

        const h2Number = i + 1;
        if (!effectiveSelectedH2Sections.includes(h2Number)) return { dataUrl: '', source: '' };
        if (i >= maxImages) return { dataUrl: '', source: '' };

        // v3.6.5: 미리 생성한 이미지 우선 — 이미지 생성 탭에서 만든 이미지를 H2 #N에 매핑
        //   사용자가 "📌 본 글 H2 소제목에 자동 배치" 토글을 켰을 때 publish payload에 포함됨.
        //   API 재호출 없이 즉시 사용 → 시간/비용 절감 + 정확히 원하는 이미지 보장.
        const preGen = (payload.preGeneratedImages as any[] | undefined) || [];
        const sectionHeadingKey = normalizeFolderHeadingKey(section.h2);
        const preGenMatchByTitle = preGen.find((p: any) =>
          normalizeFolderHeadingKey(p?.h2Title) === sectionHeadingKey
          && typeof p?.dataUrl === 'string'
          && p.dataUrl.length > 0
        );
        const preGenMatch = preGenMatchByTitle || preGen.find((p: any) => Number(p?.h2Index) === h2Number && typeof p?.dataUrl === 'string' && p.dataUrl.length > 0);
        if (preGenMatch) {
          console.log(`[IMG-${i + 1}] 📌 미리 생성한 이미지 사용 (H2 #${h2Number}, 길이 ${preGenMatch.dataUrl.length}B)`);
          onLog?.(`   📌 H2 #${h2Number}: 미리 생성한 이미지 사용 (API 호출 skip)`);
          emitGeneratedImage('h2', `H2 ${h2Number}: ${section.h2}`, preGenMatch.dataUrl, { queueImageToken });
          return { dataUrl: preGenMatch.dataUrl, source: '미리 생성 (이미지 생성 탭)' };
        }

        const folderImageMissingPolicy = String((payload as any).folderImageMissingPolicy || '').toLowerCase();
        const hasFolderImageMapping = preGen.length > 0
          || getFolderImageH2Titles(payload).length > 0
          || !!String(payload.preGeneratedThumbnail?.dataUrl || payload.preGeneratedThumbnail?.url || '').trim();
        if (hasFolderImageMapping && (folderImageMissingPolicy === 'blank' || folderImageMissingPolicy === 'empty')) {
          onLog?.(`   H2 #${h2Number}: 내 폴더 이미지 미배치 -> 공란 처리`);
          return { dataUrl: '', source: '' };
        }

        let imageResult: { ok: boolean; dataUrl?: string; error?: string } = { ok: false };
        let usedSource = '';

        try {
          // 🛒 v3.8.385: 쇼핑모드 본문 이미지 전략 (글포스팅 → 이미지 탭에서 선택)
          //   product-all : 수집한 상품 사진을 소제목마다 그대로 배치 (신뢰도 최우선 · 기본값)
          //   product-i2i : 실제 상품을 reference 로 소제목 내용에 맞는 이미지를 새로 생성
          //   ⚠️ 썸네일은 두 전략 모두 실제 상품 사진을 쓴다(orchestration:2561 useProductImages).
          //      "어떤 제품인지"가 안 보이면 구매로 이어지지 않기 때문이다.
          //   v3.8.401: 기본값을 product-i2i 로 바꿨다. 쿠팡 API 는 상품당 대표 이미지 **1장**만 주므로
          //   product-all 이면 같은 사진이 소제목 수만큼 반복된다(실측). 값이 없을 때 그쪽으로 떨어지면 안 된다.
          const shoppingStrategy = String((payload as any).shoppingImageStrategy || 'product-i2i');
          const productPool = (payload.productImages as string[] | undefined) || [];
          if (contentMode === 'shopping' && productPool.length > 0) {
            if (shoppingStrategy === 'product-all') {
              // 썸네일이 0번을 쓰므로 본문은 1번부터 순환 — 같은 사진이 두 번 나오지 않게
              const picked = productPool[(i + 1) % productPool.length];
              if (picked) {
                console.log(`[IMG-${i + 1}] 🛒 상품 사진 그대로 (전략: product-all)`);
                onLog?.(`   [IMG-${i + 1}] 🛒 상품 사진 배치 (${(i + 1) % productPool.length + 1}/${productPool.length})`);
                imageResult = { ok: true, dataUrl: picked };
                usedSource = '쿠팡 상품 이미지';
              }
            } else if (shoppingStrategy === 'product-i2i') {
              // 실제 상품을 reference 로 넘겨 소제목 내용에 맞는 이미지를 생성
              const refs = productPool.slice(0, 4);
              // v3.8.401 안전장치: 소제목 엔진이 'crawled'·'custom' 이면 생성 엔진이 아니라 i2i 가 불가능하다.
              //   (예전 UI 버그로 쇼핑모드면 무조건 'crawled' 가 박혔다 — 그 상태로 저장된 설정이 남아 있을 수 있다)
              const i2iEngine = /^(crawled|custom|none|skip)/i.test(String(imageSource))
                ? 'nanobanana2'
                : imageSource;
              if (i2iEngine !== imageSource) {
                onLog?.(`   [IMG-${i + 1}] ℹ️ 소제목 엔진이 '${imageSource}' 라 i2i 를 못 합니다 — ${i2iEngine} 로 생성합니다`);
              }
              console.log(`[IMG-${i + 1}] 🎨 상품 기반 i2i (전략: product-i2i, ref ${refs.length}장, 엔진 ${i2iEngine})`);
              onLog?.(`   [IMG-${i + 1}] 🎨 상품 기반 생성 (참고 이미지 ${refs.length}장)`);
              try {
                const i2i = await dispatchH2ImageGeneration(
                  i2iEngine,
                  section.h2,
                  keyword,
                  (msg: string) => onLog?.(`   [IMG-${i + 1}] ${msg}`),
                  contentMode,
                  { referenceImageList: refs },
                );
                if (i2i.ok && i2i.dataUrl) {
                  imageResult = { ok: true, dataUrl: i2i.dataUrl };
                  usedSource = `상품 기반 생성 (${i2i.source || imageSource})`;
                } else {
                  // 생성 실패 시 실물 사진으로 되돌린다 — 빈 자리보다 낫다
                  const fallback = productPool[(i + 1) % productPool.length];
                  if (fallback) {
                    onLog?.(`   [IMG-${i + 1}] ⚠️ 생성 실패 → 상품 사진으로 대체`);
                    imageResult = { ok: true, dataUrl: fallback };
                    usedSource = '쿠팡 상품 이미지 (생성 실패 대체)';
                  }
                }
              } catch (e: any) {
                const fallback = productPool[(i + 1) % productPool.length];
                if (fallback) {
                  onLog?.(`   [IMG-${i + 1}] ⚠️ 생성 예외 → 상품 사진으로 대체: ${e?.message?.slice(0, 60)}`);
                  imageResult = { ok: true, dataUrl: fallback };
                  usedSource = '쿠팡 상품 이미지 (예외 대체)';
                }
              }
            }
          }

          // 🛒 수집 이미지 모드: 크롤러에서 수집한 이미지를 직접 사용
          if (!imageResult.ok && imageSource === 'crawled' && payload.productImages?.length > 0) {
            // idx=0은 썸네일과 중복이므로 idx+1부터 매칭 (이미지가 부족하면 순환)
            const imgIdx = (i + 1) % payload.productImages.length;
            const crawledUrl = payload.productImages[imgIdx];
            if (crawledUrl) {
              console.log(`[IMG-${i + 1}] 🛒 수집 이미지 직접 사용: ${crawledUrl.substring(0, 50)}...`);
              imageResult = { ok: true, dataUrl: crawledUrl };
              usedSource = '수집 이미지';
            }
          }

          // 🛒→AI 모드: 수집 이미지를 참고하여 AI가 새로 생성
          if (!imageResult.ok && (imageSource === 'crawled-ai-nanobananapro' || imageSource === 'crawled-ai-nanobanana2')) {
            const imgIdx = (i + 1) % (payload.productImages?.length || 1);
            const refImage = payload.productImages?.[imgIdx] || '';
            const enhancedPrompt = refImage
              ? `참고 이미지의 제품을 기반으로, ${section.h2} 주제에 맞는 고품질 블로그 이미지를 생성해주세요. 한국적 감성, 밝은 조명, 프리미엄 배경.`
              : section.h2;

            const nbApiKey = getGeminiApiKey();
            if (nbApiKey && nbApiKey.length > 10) {
              try {
                console.log(`[IMG-${i + 1}] 🛒→AI ${imageSource} 시도 (참고: ${refImage ? '있음' : '없음'})...`);
                const aiResult = await runImageGenerationQueued(
                  {
                    engine: imageSource,
                    label: `수집 참고 본문 이미지 · ${imageSource}`,
                    onLog: (msg) => onLog?.(`   [IMG-${i + 1}] ${msg}`),
                  },
                  () => makeNanoBananaProThumbnail(enhancedPrompt, keyword, {
                    apiKey: nbApiKey, aspectRatio: '16:9', isThumbnail: false
                  }),
                );
                if (aiResult.ok) {
                  imageResult = aiResult;
                  usedSource = imageSource === 'crawled-ai-nanobanana2' ? 'NanoBanana2 (수집 참고)' : 'NanoBanana Pro (수집 참고)';
                }
              } catch (e: any) { console.log(`[IMG-${i + 1}] ⚠️ 수집→AI 실패: ${e.message}`); }
            }
          }

          // 🎯 이미지 디스패치: 사용자 선택 엔진 1순위 → 실패 시 폴백
          if (!imageResult.ok) {
            try {
              console.log(`[IMG-${i + 1}] 🎯 이미지 디스패치 (소스: ${imageSource})...`);
              // 🛡️ v3.5.83: 섹션별 영어 variation hint 주입 — nanobanana 본문 이미지 중복 방지
              //   같은 keyword 기반 H2 prompt가 비슷할 때 AI가 거의 동일한 이미지를 반복 생성하던 버그 차단
              //   영어 hint는 translateToEnglish 캐시 키도 변경시켜 매 섹션마다 신규 추론 강제
              const variationHint = ` [Section ${i + 1} of ${sections.length}: MUST show a unique scene visually distinct from all other sections — different angle, location, props, and composition; never repeat previous sections]`;
              const promptForDispatch = section.h2 + variationHint;
              // v3.5.89: GPT 이미지 quality 옵션 — UI에서 사용자가 선택한 값을 그대로 전달
              const dispatchExtra: { gptImageQuality?: 'low' | 'medium' | 'high'; leonardoModel?: string; allowFreeTrialPublishing?: boolean } = {
                allowFreeTrialPublishing: true,
              };
              if (payload.gptImageQuality === 'low' || payload.gptImageQuality === 'medium' || payload.gptImageQuality === 'high') {
                dispatchExtra.gptImageQuality = payload.gptImageQuality;
              }
              const leonardoModel = payload.leonardoModel || payload.leonardoModelPreference || payload.imageSettings?.leonardoModel;
              if (typeof leonardoModel === 'string' && leonardoModel.trim()) {
                dispatchExtra.leonardoModel = leonardoModel.trim();
              }
              const dispatchResult = await dispatchH2ImageGeneration(
                imageSource,
                promptForDispatch,
                keyword,
                (msg) => onLog?.(`   [IMG-${i + 1}] ${msg}`),
                contentMode,
                dispatchExtra,
              );
              if (dispatchResult.ok) {
                imageResult = { ok: true, dataUrl: dispatchResult.dataUrl };
                usedSource = dispatchResult.source;
              }
            } catch (e: any) {
              // 🛡️ S-2 (v3.5.84): Strict 모드 throw는 발행 차단으로 propagate
              if (e?.message?.startsWith('STRICT_ENGINE_FAILED')) {
                console.error(`[IMG-${i + 1}] ❌ Strict 모드 실패 — 발행 차단: ${e.message}`);
                onLog?.(`[IMG-${i + 1}] ❌ Strict 모드 실패 — 발행 차단`);
                throw e; // outer Promise.allSettled에서 rejected 상태로 캡처 → 후속 처리에서 발행 차단
              }
              console.log(`[IMG-${i + 1}] ⚠️ 이미지 디스패치 실패: ${e.message}`);
            }
          }
        } catch (err: any) {
          // 🛡️ S-2: Strict 에러는 outer로 propagate
          if (err?.message?.startsWith('STRICT_ENGINE_FAILED')) {
            throw err;
          }
          console.log(`[IMG-${i + 1}] ⚠️ 이미지 생성 오류: ${err}`);
        }

        // 병렬 진행률 업데이트
        completedCount++;
        const progress = 76 + Math.round((completedCount / totalToGenerate) * 12);
        if (imageResult.ok && imageResult.dataUrl) {
          emitGeneratedImage('h2', `H2 ${i + 1}: ${section.h2}`, imageResult.dataUrl, { queueImageToken });
          onLog?.(`[PROGRESS] ${progress}% - ✅ 섹션 ${i + 1} 이미지 완료 (${usedSource}) [${completedCount}/${totalToGenerate}]`);
          return { dataUrl: imageResult.dataUrl, source: usedSource || 'AI 생성' };
        } else {
          onLog?.(`[PROGRESS] ${progress}% - ⚠️ 섹션 ${i + 1} 이미지 스킵 [${completedCount}/${totalToGenerate}]`);
          return { dataUrl: '', source: '' };
        }
      }

      // 🛡️ R-1 (v3.5.85): Strict 모드는 순차 처리 + 8~15초 jitter
      //   reCAPTCHA Enterprise는 같은 IP/세션의 병렬 요청을 "비정상 활동"으로 즉시 감지.
      //   → 순차 + jitter 적용 시 인간 행동 패턴에 가까워져 차단율 ↓
      //
      // v3.8.111: 디스패처 레벨 공통 큐가 모든 이미지 엔진 호출을 process-wide 1개씩 처리한다.
      //   여기서는 기존 Promise.allSettled 구조를 유지해 진행률/결과 순서를 보존하되,
      //   실제 엔진 호출은 큐 안에서 겹치지 않는다.
      const strictMode = String(process.env['STRICT_H2_IMAGE_ENGINE'] || '').toLowerCase() === 'true';
      const RECAPTCHA_ENGINES = new Set(['flow']);
      const DROPSHOT_ENGINES = new Set(['dropshot', 'dropshot-nanobanana-pro']);
      const needsSequential = DROPSHOT_ENGINES.has(imageSourceKey) || (strictMode && RECAPTCHA_ENGINES.has(imageSourceKey));
      let imageResults: PromiseSettledResult<{ dataUrl: string; source: string }>[];

      if (needsSequential) {
        // 🛡️ v3.5.86: 사용자에게 예상 소요 시간 미리 안내
        //   1장당 평균 60초 생성 + 11.5초 jitter (마지막 제외) → 5장 기준 5*60 + 4*11.5 = 346초 ≈ 6분
        //   안전망: 90초 생성 가정 시 5*90 + 4*15 = 510초 ≈ 9분
        const estMinLow = Math.round((sections.length * 60 + (sections.length - 1) * 8) / 60);
        const estMinHigh = Math.round((sections.length * 90 + (sections.length - 1) * 15) / 60);
        if (DROPSHOT_ENGINES.has(imageSourceKey)) {
          onLog?.(`🍌 리더스 나노바나나프로 — 본문 이미지도 1장씩 완전 순차 처리합니다`);
        } else {
          onLog?.(`🛡️ Strict 모드 — 순차 처리 + 8~15초 jitter (reCAPTCHA 회피)`);
        }
        onLog?.(`⏱️ 예상 이미지 처리 시간: ${estMinLow}~${estMinHigh}분 (${sections.length}장 순차)`);
        const seqResults: PromiseSettledResult<{ dataUrl: string; source: string }>[] = [];
        for (let i = 0; i < sections.length; i++) {
          try {
            const value = await generateSingleSectionImage(i);
            seqResults.push({ status: 'fulfilled' as const, value });
          } catch (reason) {
            seqResults.push({ status: 'rejected' as const, reason });
            // STRICT_ENGINE_FAILED는 즉시 propagate — 후속 섹션 시도 무의미
            if ((reason as any)?.message?.startsWith?.('STRICT_ENGINE_FAILED')) {
              // 나머지 섹션은 빈 결과로 채움
              for (let j = i + 1; j < sections.length; j++) {
                seqResults.push({ status: 'rejected' as const, reason: new Error('SKIPPED_AFTER_STRICT_FAIL') });
              }
              break;
            }
          }
          // 마지막 항목 아니면 짧은 랜덤 대기. Dropshot도 UI 자동화라 즉시 연타를 피한다.
          if (i < sections.length - 1) {
            const jitterMs = 8000 + Math.floor(Math.random() * 7000);
            console.log(`[ORCHESTRATION] ⏳ R-1 jitter ${jitterMs}ms (${i + 1}/${sections.length} 완료)`);
            await new Promise(r => setTimeout(r, jitterMs));
          }
        }
        imageResults = seqResults;
      } else {
        // 일반 모드 — promise는 동시에 등록되지만 실제 엔진 호출은 공통 큐에서 1개씩 실행
        const imagePromises = sections.map((_, i) => generateSingleSectionImage(i));
        imageResults = await Promise.allSettled(imagePromises);
      }

      // 🛡️ S-2 (v3.5.84): Strict 모드에서 1장이라도 STRICT_ENGINE_FAILED 발생 시 발행 차단
      //   (병렬/순차 무관 — 엔진 고정 정책은 동일하게 적용)
      if (strictMode) {
        const strictFailed = imageResults.find(r =>
          r.status === 'rejected' && /STRICT_ENGINE_FAILED/.test(String((r as PromiseRejectedResult).reason?.message || ''))
        );
        if (strictFailed) {
          const reason = (strictFailed as PromiseRejectedResult).reason?.message || '알 수 없음';
          const errMsg = `🛡️ 엔진 고정 모드 — 이미지 생성 실패로 발행 차단됨: ${reason.substring(0, 300)}`;
          console.error('[ORCHESTRATION] ❌', errMsg);
          onLog?.(`❌ ${errMsg}`);
          onLog?.(`💡 해결책: (1) 다른 이미지 엔진 선택 (2) 엔진 고정 모드 OFF (3) 인증/구독 확인`);
          throw new Error(errMsg);
        }
      }

      // 결과 수집 (순서 보장)
      for (let i = 0; i < sections.length; i++) {
        const result = imageResults[i];
        if (result && result.status === 'fulfilled') {
          sectionImages.push(result.value.dataUrl);
          sectionImageSources.push(result.value.source);
        } else {
          sectionImages.push('');
          sectionImageSources.push('');
        }
      }

      const imageGenElapsed = ((Date.now() - imageGenStartTime) / 1000).toFixed(1);
      const successCount = sectionImages.filter(img => img.length > 0).length;
      const failCount = totalToGenerate - successCount;
      if (failCount > 0) {
        onLog?.(`[PROGRESS] 85% - ⚠️ 이미지 ${successCount}/${totalToGenerate}장 완료, ${failCount}장 실패 (${imageGenElapsed}초)`);
      } else {
        onLog?.(`[PROGRESS] 85% - 🎉 이미지 ${successCount}/${totalToGenerate}장 완료 (${imageGenElapsed}초${needsSequential ? ' — 순차 처리' : ' — 공통 큐 처리'})`);
      }
      // 🛡️ v3.5.86: 누적 통계 한 줄 요약 (실측 기반 튜닝용)
      try {
        const { summaryLine } = require('../engine-stats');
        const summary = summaryLine();
        if (summary && summary !== '기록 없음') {
          onLog?.(`📊 누적 엔진 성공률 (오늘): ${summary}`);
        }
      } catch { /* ignore */ }
    } // 🔥 skipImages else 블록 종료

    // 🚀 Base64 이미지를 병렬로 URL 변환 (이미지 호스팅 업로드)
    const uploadStartTime = Date.now();
    const uploadPromises = sectionImages.map(async (img, idx) => {
      if (!img || !img.startsWith('data:image')) return img || '';
      try {
        const uploadedUrl = await uploadBase64ToImageHost(img, `section-${idx}-${Date.now()}`);
        if (uploadedUrl) {
          console.log(`[IMAGE] ✅ Base64 → 호스팅 업로드 성공 (섹션 ${idx + 1})`);
          return uploadedUrl;
        }
      } catch (e) { /* 무시 */ }
      // v3.8.387: 여기서 이미지를 버리는 게 "본문 이미지 0개"의 원인이었다.
      //   실측 2026-07-30 — 발행글 141/323편(43.7%)이 본문 이미지 0개, 썸네일은 전부 정상.
      //   썸네일은 wpApi.uploadMedia(자체 미디어)로 올라가는데 본문만 무료 외부 호스트
      //   5곳(imgbb/imghippo/freeimage/catbox…)에만 의존했고, 그 무료 호스트들이 한꺼번에
      //   막히면 통째로 버려졌다. 07-26 이후 10편 연속 0개가 정확히 그 모양이다.
      //   워드프레스는 인증된 자체 미디어 라이브러리가 있으니 base64를 그대로 넘긴다 —
      //   퍼블리셔가 미디어로 올려 자기 도메인 URL로 바꾼다(썸네일과 동일 경로).
      //   부수 효과: 이미지가 자기 도메인에 놓여 이미지 색인·링크 수명에도 유리하다.
      //   Blogger/티스토리는 본문 base64가 API 400을 유발하므로 기존대로 제거한다.
      if (platform === 'wordpress') {
        console.warn(`[IMAGE] ⚠️ 외부 호스팅 전부 실패 → 워드프레스 미디어 업로드로 위임 (섹션 ${idx + 1})`);
        return img;
      }
      console.warn(`[IMAGE] ⚠️ 모든 호스팅 실패 → 이미지 제거 (섹션 ${idx + 1}) — Blogger 400 방지`);
      return '';
    });
    const uploadResults = await Promise.allSettled(uploadPromises);
    const processedImageUrls: string[] = uploadResults.map(r =>
      r.status === 'fulfilled' ? r.value : ''
    );
    const uploadElapsed = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
    console.log(`[IMAGE] 🚀 이미지 업로드 완료 (${uploadElapsed}초 — 병렬 처리)`);

    // H2 섹션들 — 💰 Revenue-Max: 카드 없이 플랫 구조
    const renderedCtaUrls = new Set<string>();
    sections.forEach((section, idx) => {
      // 🔥 H2 제목에서 접두어 제거 (h2:, H2-, 소제목: 등)
      let cleanH2 = (section.h2 || '')
        .replace(/^[hH]2[:\-\s]*/gi, '')
        .replace(/^소제목[:\s]*/gi, '')
        .replace(/^\d+[.\):\s]+/g, '')
        .trim();
      // 🛡️ 빈 제목 폴백 (h2Titles 배열에서 복구)
      if (!cleanH2 && h2Titles[idx]) {
        cleanH2 = h2Titles[idx]!.replace(/^\d+[.\):\s]+/g, '').trim();
      }
      if (!cleanH2) {
        cleanH2 = `섹션 ${idx + 1}`;
      }
      const h2Number = `${idx + 1}.`;

      // 💰 H2 — 인라인 !important는 Blogger 테마 override 방지 필수 (CSS만으로는 부족)
      // 여백(Margin) 최적화: H2 직후 약간의 공백을 두어 자동광고가 붙기 좋게 설계
      html += `\n<h2 id="section-${idx}" style="font-size:26px !important;font-weight:800 !important;color:#111 !important;-webkit-text-fill-color:#111 !important;margin:60px 0 24px !important;padding:0 0 14px 16px !important;border-bottom:2px solid #111 !important;border-left:6px solid #FF6B35 !important;letter-spacing:-0.03em !important;line-height:1.4 !important;word-break:keep-all !important;">${h2Number} ${cleanH2}</h2>\n`;

      // 🖼️ 섹션 이미지 — 플랫, 그림자 없음 (썸네일과 독립적으로 1번 섹션부터 렌더)
      // v3.5.55부터 adsense 첫 섹션에도 이미지 정상 삽입 (author_intro 섹션 제거됨)
      const finalImageUrl = processedImageUrls[idx];
      if (finalImageUrl) {
        html += `
<figure class="section-image" style="width:100% !important;margin:32px 0 40px !important;padding:0 !important;">
  <div class="section-image-frame" style="width:100% !important;aspect-ratio:16/9 !important;overflow:hidden !important;border-radius:10px !important;background:#f8fafc !important;">
    <img src="${finalImageUrl}" alt="${cleanH2}" title="${cleanH2}" style="width:100% !important;height:100% !important;aspect-ratio:16/9 !important;object-fit:cover !important;border-radius:0 !important;display:block !important;margin:0 !important;" loading="lazy" />
  </div>
  <figcaption style="text-align:center;font-size:13px;color:#999;margin-top:12px;font-style:italic;">${cleanH2}</figcaption>
</figure>
`;
      }

      section.h3Sections.forEach((h3Sec, h3Idx) => {
        const cleanH3 = h3Sec.h3
          .replace(/^[hH]3[:\-\s]*/gi, '')
          .replace(/^소제목[:\s]*/gi, '')
          .replace(/^\d+[.\):\s]+/g, '')
          .trim();
        const h3Number = `${idx + 1}-${h3Idx + 1}.`;

        // 💰 H3 — 볼드, 여백 최적화
        html += `\n<h3 style="font-size:21px !important;font-weight:800 !important;color:#222 !important;-webkit-text-fill-color:#222 !important;margin:30px 0 12px !important;padding:0 !important;letter-spacing:-0.02em !important;line-height:1.5 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;display:block !important;word-break:keep-all !important;">${h3Number} ${cleanH3}</h3>\n`;

        // 💰 본문 — 줄간격 1.8, 단락간 여백 확보로 가독성 극대화
        // <p> 간 간격이 자동으로 커지도록 CSS를 인젝트했지만, 인라인 스타일도 확실히 잡아줌
        const optimizedContent = normalizeArticleBodySpacing(h3Sec.content);
        html += `<div class="content" style="margin:0 0 14px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;color:#333 !important;">\n${optimizedContent}\n</div>\n`;

        // 표 — 미니멀 뉴스 스타일 + 모바일 반응형 + AdSense 광고 주입 차단
        // 🔥 2026.04 수정:
        //   - min-width:500px 제거 → 모바일에서 강제 스크롤 방지
        //   - class="ad-safe-zone table-wrapper" 추가 → AdSense Auto-Ads가 표 내부에 광고 삽입 방지
        //   - data-ad-region="no-ad" 시그널 추가 → AdSense 크롤러에게 광고 불가 영역임을 명시
        //   - 모바일 CSS는 generateCSSFinal()의 @media 쿼리에서 처리
        if (h3Sec.tables.length > 0) {
          h3Sec.tables.forEach(table => {
            html += `<div class="ad-safe-zone table-wrapper" data-ad-region="no-ad" style="width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:28px 0;position:relative;">`;
            html += `<table class="responsive-table" style="width:100%;border-collapse:collapse;font-size:15px;">`;
            html += `<thead><tr>${table.headers.map(h => `<th class="rt-th" style="background:#f8f9fa;color:#333;font-weight:700;padding:14px 16px;text-align:left;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}</tr></thead>`;
            html += `<tbody>${table.rows.map(row => `<tr>${row.map((cell, cellIdx) => {
              const cellStr = String(cell ?? '');
              let formatted = cellStr
                .replace(/\s*([☑✓✔✅☐•◦▶▪※►➤➜✦★●○■□◆◇])\s*/g, '<br>$1 ')
                .replace(/\s+(\d+[.\)]\s)/g, '<br>$1')
                .replace(/\s+([가-힣][.\)]\s)/g, '<br>$1')
                .replace(/\s+([a-zA-Z][.\)]\s)/g, '<br>$1')
                .replace(/\s+([-–—]\s)/g, '<br>$1')
                .replace(/^<br>/, '')
                .trim();
              const label = escapeHtmlAttr(String(table.headers?.[cellIdx] || ''));
              return `<td class="rt-td" data-label="${label}" style="padding:14px 16px;border-bottom:1px solid #f0f0f0;color:#444;background:#fff;word-break:keep-all;overflow-wrap:break-word;">${formatted}</td>`;
            }).join('')}</tr>`).join('')}</tbody>`;
            html += `</table></div>\n`;
          });
        }
      });

      // 💰 CTA — 박동하는 쿠폰형 Max-Adsense 스타일
      const sectionCta = section.h3Sections.find(h3 => h3.cta)?.cta;
      if (sectionCta) {
        if (!isRenderableCta(sectionCta)) {
          console.log(`[MAX-MODE] ⚠️ CTA URL 무효 → 렌더링 생략: ${sectionCta.url}`);
        } else if (renderedCtaUrls.has(normalizeCtaUrlKey(sectionCta.url))) {
          console.log(`[MAX-MODE] ℹ️ 중복 CTA URL 생략: ${sectionCta.url}`);
        } else {
          html += renderFinalCtaBlock({
            badge: sectionCta.searchFallback ? '직접 확인' : '공식 권장',
            hook: sectionCta.hookingMessage,
            buttonText: sectionCta.buttonText,
            url: sectionCta.url,
            microcopy: sectionCta.searchFallback
              ? '검색 결과에서 공식 사이트 여부를 확인한 뒤 이용해주세요.'
              : '정확한 내용은 공식 사이트에서 확인해주세요.'
          });
          markRenderedCta(renderedCtaUrls, sectionCta.url);
        }
      }

      // 💰 섹션 간 광고 안착 공간 (넉넉한 여백)
      if (idx < sections.length - 1) {
        html += `\n<div style="margin:40px 0 !important;clear:both !important;"></div>\n`;
      }
    });

    // 🔥 FAQ 섹션 삽입 (Schema.org FAQPage 마크업 포함)
    //
    // v3.7.20: H2 소제목 중 하나가 이미 FAQ/Q&A 섹션이면 본문 중복을 막기 위해
    //   가시 FAQ 블록은 스킵. 단 Schema.org FAQPage JSON-LD는 SEO(리치 결과) 손실을
    //   피하기 위해 별도로 한 번만 삽입.
    //   기존 동작: 애드센스 모드는 H2 5번이 "자주 묻는 질문 (FAQ)"으로 하드코딩되고,
    //   외부/내부 모드도 LLM이 FAQ 성격 H2를 자주 만들어내는데 그 위에 또
    //   `buildFAQHtml` 가시 블록을 append → 같은 글에 FAQ가 두 번 노출되던 문제.
    const hasFaqH2 = Array.isArray(h2Titles) && h2Titles.some((t: string) => /faq|자주\s*묻는|q\s*&\s*a|질의\s*응답/i.test(t || ''));
    if (faqs && faqs.length > 0) {
      if (!hasFaqH2) {
        html += buildFAQHtml(faqs);
        console.log(`[MAX-MODE] ✅ FAQ ${faqs.length}개 + Schema.org FAQPage 마크업 삽입 완료`);
      } else {
        const faqSchemaJson = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': faqs.map(f => ({
            '@type': 'Question',
            'name': f.question,
            'acceptedAnswer': { '@type': 'Answer', 'text': f.answer },
          })),
        });
        html += `\n<script type="application/ld+json">${faqSchemaJson}</script>\n`;
        console.log(`[MAX-MODE] ⏭️ H2에 이미 FAQ 섹션 존재 — 가시 FAQ 블록 스킵, JSON-LD만 ${faqs.length}건 삽입 (중복 방지 + SEO 유지)`);
      }
    }

    // 🛒 쇼핑 모드 — 쿠팡 상품 카드 블록 강제 삽입 (실제 제휴링크가 최종 HTML에 들어가도록 보장)
    if (contentMode === 'shopping') {
      const coupangProducts = (payload as any).coupangProducts;
      if (Array.isArray(coupangProducts) && coupangProducts.length > 0) {
        html += renderCoupangProductBlock(coupangProducts);
        // v3.8.375: 대가성 문구를 본문 최상단(H1 직후)에 삽입 — 쿠팡 가이드 준수.
        //   기존에는 문구가 상품 블록 안에만 있어서 글 맨 끝(모든 이미지·링크 뒤)에 위치했고,
        //   글자도 13px 회색이라 "본문보다 크게 또는 눈에 띄는 색" 요건에 미달했다.
        html = html.replace('<!-- COUPANG_DISCLOSURE_PLACEHOLDER -->', renderCoupangDisclosureBanner());
        console.log(`[MAX-MODE] 🛒 쿠팡 상품 카드 ${Math.min(coupangProducts.length, 6)}개 삽입 완료 (제휴링크 활성화)`);
        console.log('[MAX-MODE] 🛒 대가성 문구를 본문 최상단에 배치 (쿠팡 파트너스 가이드 준수)');

        // v3.8.375: 본문 안 LLM 작성 링크·문구까지 최종 강제
        //   프롬프트에 제휴링크를 넘기므로 LLM이 본문에 직접 <a>를 쓸 수 있는데 rel이 없다.
        //   또 LLM이 "수수료를 받을 수 있습니다" 같은 조건부 표현을 쓰면 가이드 (3) 위반이다.
        const compliance = enforceCoupangCompliance(html);
        html = compliance.html;
        compliance.fixes.forEach(f => {
          console.log(`[MAX-MODE] 🛒 컴플라이언스 교정: ${f}`);
          onLog?.(`[PROGRESS] 92% - 🛒 쿠팡 컴플라이언스: ${f}`);
        });
      } else {
        console.log('[MAX-MODE] ⚠️ 쇼핑 모드인데 쿠팡 상품 데이터 없음 — 카드 블록 스킵');
      }
    }
    // 제휴 상품이 없으면 자리표시자만 제거
    html = html.replace('<!-- COUPANG_DISCLOSURE_PLACEHOLDER -->', '');

    // ── v3.8.396: 네이버/토스 제휴 — 상품 카드 + 정책 강제 ──
    //   쿠팡과 별개 경로다(제휴사마다 고지 문구·금지 항목이 다르다).
    //   컴플라이언스는 상품 카드가 없어도 돈다 — 사용자가 본문에 링크만 넣었을 수도 있다.
    try {
      const affProducts = (payload as any).affiliateProducts;
      if (Array.isArray(affProducts) && affProducts.length > 0) {
        const { renderAffiliateProductBlock } = await import('../affiliate/render');
        html += renderAffiliateProductBlock(affProducts);
        onLog?.(`[PROGRESS] 92% - 🛒 제휴 상품 카드 ${Math.min(affProducts.length, 6)}개 삽입`);
      }

      // v3.8.398: 본문 이미지를 전부 구매 링크로 만든다 (사용자 요구).
      //   쇼핑 글에서 이미지는 최대 클릭 유발 요소인데 그냥 그림이면 수익 누수다.
      //   첫 상품 링크로 감싼다 — 한 글에 한 제휴사·한 상품군이 원칙이다.
      //   v3.8.400: 상품 조회가 막혀도(쿠팡 403) 링크는 아니까 이미지 연결은 그대로 한다.
      const purchaseUrl = (Array.isArray(affProducts) && affProducts.length > 0)
        ? affProducts[0].originalUrl
        : (payload as any).affiliateFallbackUrl || '';

      // 📖 v3.8.404 — 문단 길이를 고르게 만든다 (CTA 카드보다 **먼저** 돌려야 카드를 안 건드린다)
      //   사용자 요구: "한 문단이 너무 길면 줄바꿈, 짧으면 두 문단 이런 식으로"
      //   실측: 발행글 문단 91%가 모바일 6줄 초과였다. 긴 건 문장 경계에서 쪼개고 짧은 건 합친다.
      try {
        const { normalizeParagraphs } = await import('./paragraph-normalizer');
        const norm = normalizeParagraphs(html);
        if (norm.split > 0 || norm.merged > 0) {
          html = norm.html;
          onLog?.(`[PROGRESS] 92% - 📖 문단 정리: 긴 문단 ${norm.split}번 나누고 짧은 문단 ${norm.merged}번 합침`);
        }
      } catch (normErr: any) {
        onLog?.(`[PROGRESS] 92% - ⚠️ 문단 정리 건너뜀: ${String(normErr?.message || normErr).slice(0, 60)}`);
      }

      // 🛒 v3.8.404 — **눈에 보이는 구매 버튼**을 심는다.
      //   실측(2026-08-02): 발행글에 이미지 링크는 8개 있었는데 구매 버튼은 0개였다.
      //   버튼이 없으면 독자는 "이미지를 눌러야 한다"는 걸 모른다.
      //   자리 셋: 핵심 요약 직후(급한 사람) · 본문 중간(마음이 기운 지점) · 글 끝(+70%)
      if (purchaseUrl && contentMode === 'shopping') {
        try {
          const { insertCtaCards } = await import('../affiliate/cta-card');
          const p0 = (Array.isArray(affProducts) && affProducts[0]) ? affProducts[0] : null;
          const enrich = (payload as any).coupangEnrichment;
          const cardResult = insertCtaCards(html, {
            name: String(p0?.title || (payload as any).resolvedProductName || keyword),
            priceKrw: (p0 && typeof p0.priceKrw === 'number') ? p0.priceKrw : null,
            imageUrl: String(p0?.imageUrl || enrich?.imageUrl || ((payload as any).productImages || [])[0] || ''),
            url: purchaseUrl,
            provider: (payload as any).affiliateProvider || null,
            ...(p0?.description ? { note: String(p0.description) } : {}),
          });
          if (cardResult.inserted > 0) {
            html = cardResult.html;
            onLog?.(`[PROGRESS] 92% - 🛒 구매 버튼 ${cardResult.inserted}개 삽입 (요약 직후·본문 중간·글 끝)`);
          }
        } catch (ctaErr: any) {
          onLog?.(`[PROGRESS] 92% - ⚠️ 구매 버튼 삽입 건너뜀: ${String(ctaErr?.message || ctaErr).slice(0, 60)}`);
        }
      }
      if (purchaseUrl) {
        const { linkImagesToProduct } = await import('../affiliate/compliance');
        const linkedResult = linkImagesToProduct(
          html, purchaseUrl, (payload as any).affiliateProvider || null,
        );
        if (linkedResult.linked > 0) {
          html = linkedResult.html;
          onLog?.(`[PROGRESS] 92% - 🖼️ 본문 이미지 ${linkedResult.linked}개를 구매 링크로 연결`);
        }
      }

      const { enforceAffiliateCompliance } = await import('../affiliate/compliance');
      const affCompliance = enforceAffiliateCompliance(html, (payload as any).affiliateProvider || null);
      if (affCompliance.provider) {
        html = affCompliance.html;
        affCompliance.fixes.forEach((f) => {
          console.log(`[MAX-MODE] 🔗 제휴 컴플라이언스: ${f}`);
          onLog?.(`[PROGRESS] 92% - 🔗 ${f}`);
        });
        // 경고는 사람이 봐야 하는 것 — 발행은 그대로 진행한다
        affCompliance.warnings.forEach((w) => {
          console.warn(`[MAX-MODE] ⚠️ 제휴 정책 주의: ${w}`);
          onLog?.(`   ⚠️ [제휴 정책] ${w}`);
        });
      }
    } catch (affRenderErr: any) {
      console.warn('[MAX-MODE] 제휴 렌더/컴플라이언스 스킵:', String(affRenderErr?.message || affRenderErr).slice(0, 80));
    }

    // v3.7.13 — 면책 중복 제거: 이전엔 여기(섹션 끝)와 line ~1701(결론 다음) 두 곳에 면책이 박혀
    //   같은 글에 디스클레임이 2번 표시됨. 결론 다음의 .disclaimer 블록만 유지하고 여기는 삭제.

    // 🔥 CTA 최소 2개 보장 (사용자 요구사항) — 애드센스 모드에서는 완전 스킵
    const currentCtaCount = renderedCtaUrls.size;
    console.log(`[MAX-MODE] CTA 현재 ${currentCtaCount}개 렌더링됨`);

    // 🔥 CTA 데이터 (상단 CTA에도 사용하기 위해 블록 밖에 선언)
    let supplementalCtas: Array<{ label: string; hookingMessage: string; buttonText: string; url: string; searchFallback?: boolean }> = [];

    if (contentMode === 'adsense') {
      // 🛡️ 애드센스 모드: 보충 CTA 완전 차단
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 보충 CTA 생성 생략 (승인 정책 준수)');
    } else if (currentCtaCount < 2) {
      const needMore = 2 - currentCtaCount;
      console.log(`[MAX-MODE] 🔥 CTA ${needMore}개 추가 필요 (최소 2개 보장)`);

      // 🔥 Step 1: Perplexity로 실제 관련 URL 심층 검색
      supplementalCtas = [];
      try {
        console.log(`[MAX-MODE] 🔍 Gemini로 CTA 관련 URL 심층 검색 중...`);
        const searchPrompt = `"${keyword}" 주제에 대해 독자가 클릭하고 싶은 관련 정보 페이지를 ${needMore}개 찾아줘.

조건:
1. 실제 존재하는 정부기관, 공식사이트, 대형 포털의 정보 페이지 URL
2. 블로그나 카페 링크 제외 — 공신력 있는 출처만
3. 한국어 사이트 우선
4. 각 URL과 함께 한줄 설명 포함

JSON 형식: [{"url":"https://실제URL","title":"페이지제목","description":"한줄설명"}]
JSON 배열만 반환해. 마크다운 없이 순수 JSON만.`;

        const searchText = await callGeminiWithGrounding(searchPrompt);

        if (searchText) {
          try {
            const cleanJson = searchText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const item of parsed) {
                if (supplementalCtas.length >= needMore) break;
                const candidateUrl = String(item?.url || '').trim();
                if (!isCtaUrlShapeSafe(candidateUrl)) {
                  console.log(`[MAX-MODE] ⚠️ 보충 CTA URL 형식/차단 필터 실패: ${candidateUrl}`);
                  continue;
                }
                if (!isContextuallySafeCtaUrl(candidateUrl, keyword, contentMode)) {
                  console.log(`[MAX-MODE] ⚠️ 보충 CTA 주제 불일치 차단: ${candidateUrl}`);
                  continue;
                }
                const validation = await validateCtaUrl(candidateUrl, { timeout: 5000 });
                if (!validation.isValid) {
                  console.log(`[MAX-MODE] ⚠️ 보충 CTA 접속 검증 실패: ${candidateUrl} (${validation.reason})`);
                  continue;
                }
                supplementalCtas.push({
                  label: supplementalCtas.length === 0 ? '필독' : '혜택',
                  hookingMessage: item.description || item.title || `${keyword} 관련 핵심 정보`,
                  buttonText: '바로 확인하기',
                  url: candidateUrl
                });
              }
              console.log(`[MAX-MODE] 🔍 Gemini URL 검증 완료: ${supplementalCtas.map(c => c.url.slice(0, 50)).join(' | ') || '유효 후보 없음'}`);
            }
          } catch (parseErr) {
            console.log(`[MAX-MODE] ⚠️ Gemini CTA URL 파싱 실패 — 폴백으로 진행`);
          }
        }

        {
          // 🔥 Step 2: Gemini URL 있으면 CTA 카피 개선
          if (supplementalCtas.length > 0) {
            try {
              const ctaCopyPrompt = `블로그 키워드: "${keyword}"
아래 URL들에 대한 CTA 카피를 작성해줘:
${supplementalCtas.map((c, i) => `${i + 1}. URL: ${c.url} / 설명: ${c.hookingMessage}`).join('\n')}

각 CTA에 대해:
- label: 짧은 라벨 (필독/혜택/추천/정보 중 택1)
- hookingMessage: 클릭을 유도하는 한줄 후킹 문장 (25자 내외, 궁금증/긴급성/혜택 강조)
- buttonText: 버튼 텍스트 (8자 내외, 행동 유도)

JSON: [{"label":"필독","hookingMessage":"...","buttonText":"..."}]
마크다운 없이 순수 JSON 배열만 반환해.`;

              const copyText = await callGeminiWithRetry(ctaCopyPrompt);
              if (copyText) {
                const cleanCopy = copyText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const copyParsed = JSON.parse(cleanCopy);
                if (Array.isArray(copyParsed)) {
                  copyParsed.forEach((cp: any, idx: number) => {
                    if (supplementalCtas[idx]) {
                      supplementalCtas[idx] = {
                        ...supplementalCtas[idx],
                        label: cp.label || supplementalCtas[idx].label,
                        hookingMessage: cp.hookingMessage || supplementalCtas[idx].hookingMessage,
                        buttonText: cp.buttonText || supplementalCtas[idx].buttonText,
                      };
                    }
                  });
                  console.log(`[MAX-MODE] 🧠 Gemini CTA 카피 개선 완료`);
                }
              }
            } catch (copyErr: any) {
              console.log(`[MAX-MODE] ⚠️ CTA 카피 개선 실패 (검색 URL은 유지): ${copyErr.message}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`[MAX-MODE] ⚠️ Gemini CTA 검색 실패: ${e.message}`);
      }

      if (supplementalCtas.length < needMore) {
        console.log(`[MAX-MODE] ℹ️ 보충 CTA ${needMore}개 중 ${supplementalCtas.length}개만 검증 통과 — 나머지는 생략`);
      }

      for (let ci = 0; ci < needMore && ci < supplementalCtas.length; ci++) {
        const cta = supplementalCtas[ci]!;
        if (!isRenderableCta(cta)) continue;
        if (renderedCtaUrls.has(normalizeCtaUrlKey(cta.url))) continue;
        html += renderFinalCtaBlock({
          badge: cta.searchFallback ? '직접 확인' : '추천 링크',
          hook: cta.hookingMessage,
          buttonText: cta.buttonText,
          url: cta.url
        });
        markRenderedCta(renderedCtaUrls, cta.url);
      }
      console.log(`[MAX-MODE] ✅ CTA ${Math.min(needMore, supplementalCtas.length)}개 보충 완료`);
    }

    // 🔥 실행 플랜 섹션 제거됨 (사용자 요청)

    // 🧹 Summary Table 셀 sanitization
    //   AI가 상품 카드 HTML(<div>, <img>, <button>)을 셀에 넣을 수 있음 → 모바일에서 표 폭 깨짐
    //   모든 HTML 태그·엔티티 제거, 공백 정리, 최대 120자 컷
    const sanitizeSummaryCell = (raw: unknown): string => {
      const s = String(raw ?? '');
      return s
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')           // 모든 HTML 태그 제거
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')                // 연속 공백 단일화
        .trim()
        .slice(0, 120);                      // 너무 긴 셀 컷
    };
    const cleanedRows = (summaryTable.rows || [])
      .map(row => row.map(sanitizeSummaryCell))
      // 전체 셀이 빈 줄 제거
      .filter(row => row.some(c => c.length > 0));
    const cleanedHeaders = (summaryTable.headers || []).map(sanitizeSummaryCell);
    const escapeSummaryAttr = (raw: unknown): string => String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 💰 요약표를 상단(TOP_SUMMARY_CTA_PLACEHOLDER)에 배치
    const topSummaryHtml = cleanedRows.length === 0 ? '' : `
<div class="summary-container" style="margin:0 0 30px;background:linear-gradient(135deg,var(--rv-gradient-start,#f8fafc) 0%,var(--rv-gradient-end,#eef2f7) 100%);border:2px solid var(--rv-heading-2-border,#cbd5e1);border-radius:16px;display:block;visibility:visible;box-sizing:border-box;max-width:100%;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <span style="font-size:24px;">⚡</span>
    <h3 style="margin:0;font-size:20px;font-weight:800;color:var(--rv-heading-1,#334155);-webkit-text-fill-color:var(--rv-heading-1,#334155);">성급한 분들을 위한 핵심 요약</h3>
  </div>
  <div class="ad-safe-zone table-wrapper" data-ad-region="no-ad" style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;max-width:100%;position:relative;">
    <table class="responsive-table summary-table" style="display:table;visibility:visible;width:100%;border-collapse:collapse;font-size:15px;">
      <thead><tr>${cleanedHeaders.map(h => `<th class="rt-th" style="visibility:visible;background:var(--rv-primary-light,#f1f5f9);color:var(--rv-heading-1,#334155);-webkit-text-fill-color:var(--rv-heading-1,#334155);font-weight:700;padding:14px 16px;text-align:left;border-bottom:2px solid var(--rv-heading-2-border,#cbd5e1);font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}</tr></thead>
      <tbody>${cleanedRows.map(row => `<tr>${row.map((cell, cellIdx) => `<td class="rt-td" data-label="${escapeSummaryAttr(cleanedHeaders[cellIdx] || '')}" style="visibility:visible;padding:14px 16px;border-bottom:1px solid var(--rv-toc-hover-border,#e2e8f0);color:#334155;-webkit-text-fill-color:#334155;background:rgba(255,255,255,0.72);font-size:14px;line-height:1.5;word-break:keep-all;overflow-wrap:break-word;">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>
</div>
`;

    // 🔥 상단 CTA (첨 번째 CTA를 상단에 배치 — AI 생성 CTA 또는 보충 CTA)
    let topCtaHtml = '';
    if (contentMode === 'adsense') {
      // 🛡️ 애드센스 모드: 상단 CTA 완전 차단
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 상단 CTA 생성 생략 (승인 정책 준수)');
    } else {
      const topCandidates: RenderableCtaCandidate[] = [
        ...ctas.map(c => toRenderableCtaCandidate(c, `${keyword} 핵심 정보 바로가기`, '자세히 보기', '핵심')),
        ...supplementalCtas
      ];
      const topCta = pickRenderableCta(topCandidates, renderedCtaUrls);

      if (topCta) {
        topCtaHtml = renderFinalCtaBlock({
          badge: topCta.searchFallback ? '직접 확인' : '핵심 바로가기',
          hook: topCta.hookingMessage,
          buttonText: topCta.buttonText,
          url: topCta.url,
          marginTop: 20
        });
        markRenderedCta(renderedCtaUrls, topCta.url);
      } else {
        console.log('[MAX-MODE] ℹ️ 본문 CTA와 겹치지 않는 상단 CTA 없음 — 상단 CTA 생략');
      }
    } // end of non-adsense CTA block

    const formattedIntro = introductionHTML ? `
<div class="content intro-section" style="margin:24px 0 32px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;line-height:1.6 !important;color:#333 !important;">
${introductionHTML}
</div>
` : '';

    // 🔥 TOP_SUMMARY_CTA_PLACEHOLDER에 CTA 버튼 먼저 → 서론 → 핵심요약 삽입
    // 사용자 구조: 접속 즉시 CTA 버튼 → 서론 → 요약 정보 → 목차 → 상세 콘텐츠 → 결론 → 하단 CTA
    html = html.replace('<!-- TOP_SUMMARY_CTA_PLACEHOLDER -->', topCtaHtml + formattedIntro + topSummaryHtml);

    const formattedConclusion = conclusionHTML ? `
<div class="content conclusion-section" style="margin:40px 0 24px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;box-shadow:none !important;font-size:16px !important;line-height:1.6 !important;color:#333 !important;">
${conclusionHTML}
</div>
` : '';
    html += formattedConclusion;

    // 💰 면책 조항 — 템플릿의 .disclaimer 부착
    html += `
<div class="disclaimer">
  ※ 본 글은 정보 제공 목적으로 작성되었으며, 전문적인 조언을 대체하지 않습니다. 일부 링크는 제휴 링크가 포함되어 있습니다.<br />
  ※ 실제 서비스 환경이나 시기에 따라 세부 내용이 일부 변경될 수 있습니다.
</div>
`;

    // 💰 공유 버튼 — v3.8.368: onclick 제거하고 순수 href + 발행 후 URL 치환 방식으로 전환
    //   v3.8.361 회귀: href를 파라미터 없는 base URL로 두고 onclick으로 주입하게 바꿨는데,
    //     Blogger가 인라인 이벤트 핸들러(onclick)를 제거해버려 파라미터 없는 href만 남았다.
    //     → 클릭 시 story.kakao.com/share 로만 이동하는 빈 공유창. (사용자 보고)
    //   현재: href에 플레이스홀더 토큰을 넣고, 발행 직후 실제 글 URL로 치환한다(blogger-publisher.js).
    //     치환이 불가능한 경로에서는 블로그 홈 URL이 기본값으로 들어가 최소한 링크가 살아있게 한다.
    const shareTitle = encodeURIComponent(h1);
    // 기본값 = 블로그 홈 URL(인코딩). 발행 직후 publisher가 실제 글 URL로 치환한다.
    // 치환에 실패하더라도 홈 URL이 남아 링크가 깨지지 않는다.
    const shareHomeUrl = String(
      payload.blogUrl || payload.wordpressSiteUrl || payload.siteUrl || ''
    ).trim().replace(/\/+$/, '');
    const shareUrlValue = encodeURIComponent(shareHomeUrl || 'https://www.google.com');
    html += `
<div style="margin:40px 0 20px !important;padding:28px 24px !important;background:linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%) !important;border:1px solid #e0e8f5 !important;border-radius:16px !important;text-align:center !important;display:block !important;visibility:visible !important;">
  <div style="font-size:15px !important;font-weight:700 !important;color:#333 !important;-webkit-text-fill-color:#333 !important;margin-bottom:6px !important;">📢 이 글이 도움이 되셨다면 공유해보세요</div>
  <p style="font-size:13px !important;color:#888 !important;margin:0 0 16px !important;">도움이 필요한 분들에게 알려주세요</p>
  <div style="display:flex !important;flex-wrap:wrap !important;justify-content:center !important;gap:10px !important;">
    <a data-orbit-share="1" href="https://story.kakao.com/share?url=${shareUrlValue}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#FEE500 !important;color:#3C1E1E !important;-webkit-text-fill-color:#3C1E1E !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(254,229,0,0.3) !important;">💛 카카오</a>
    <a data-orbit-share="1" href="https://share.naver.com/web/shareView?url=${shareUrlValue}&title=${shareTitle}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#03C75A !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(3,199,90,0.3) !important;">🟢 네이버</a>
    <a data-orbit-share="1" href="https://twitter.com/intent/tweet?url=${shareUrlValue}&text=${shareTitle}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#000 !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(0,0,0,0.2) !important;">✖ X</a>
    <a data-orbit-share="1" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrlValue}" target="_blank" rel="nofollow noopener noreferrer" style="display:inline-flex !important;align-items:center !important;gap:6px !important;padding:10px 20px !important;background:#1877F2 !important;color:#fff !important;-webkit-text-fill-color:#fff !important;border:none !important;border-radius:10px !important;font-size:14px !important;font-weight:700 !important;text-decoration:none !important;box-shadow:0 2px 8px rgba(24,119,242,0.3) !important;">🔵 Facebook</a>
  </div>
</div>
`;

    // 💰 하단 최종 CTA 버튼 (마지막 클릭 유도) — 에드센스 모드에서는 생략
    if (contentMode !== 'adsense') {
      const finalCandidates: RenderableCtaCandidate[] = [
        ...ctas.map(c => toRenderableCtaCandidate(c, `${keyword} 핵심 정보 바로가기`, '자세히 보기')),
        ...supplementalCtas
      ];
      const finalCta = pickRenderableCta(finalCandidates, renderedCtaUrls);
      if (finalCta) {
        html += renderFinalCtaBlock({
          badge: finalCta.searchFallback ? '직접 확인' : '마무리 추천',
          hook: finalCta.hookingMessage,
          buttonText: finalCta.buttonText,
          url: finalCta.url
        });
        markRenderedCta(renderedCtaUrls, finalCta.url);
      } else {
        console.log('[MAX-MODE] ℹ️ 본문/상단 CTA와 겹치지 않는 하단 CTA 없음 — 하단 CTA 생략');
      }
    }

    // 💎 백서 컨테이너 닫기 (bgpt-content + gradient-frame + white-paper)
    html += '</div></div></div>';

    // 🔗 내부 링크 자동 삽입 (H2 섹션 사이드) — 애드센스 모드에서는 생략
    if (contentMode === 'adsense') {
      console.log('[MAX-MODE] 🛡️ 애드센스 모드 — 내부 링크 삽입 생략 (승인 정책 준수)');
    }
    try {
      const URLData = loadEnvFromFile();
      // ⚠️ env 키 이름 함정: .env 에 실제로 저장되는 키는 WORDPRESS_SITE_URL 이다. WP_URL 은 존재하지 않는다.
      //    v3.8.382 까지 여기서 WP_URL 을 읽어 blogUrl 이 항상 '' 이 되었고,
      //    그 결과 내부 링크 삽입이 예외 없이 조용히 스킵됐다(발행 328편 중 인바운드 0인 글 280편 = 85.6%).
      //    payload 가 이번 발행 대상 플랫폼의 URL을 들고 있으므로 payload 를 우선한다(2375줄과 같은 체인).
      const blogUrl = contentMode !== 'adsense'
        ? String(
            payload.blogUrl || payload.wordpressSiteUrl || payload.siteUrl || payload.url ||
            URLData['WORDPRESS_SITE_URL'] || URLData['BLOGGER_URL'] || URLData['TISTORY_URL'] || ''
          ).trim().replace(/\/+$/, '')
        : '';

      if (blogUrl) {
        onLog?.('[PROGRESS] 88% - 🔗 내부 링크 검색 및 삽입 중...');

        // v3.8.402 — 쇼핑 글은 **상품명**으로 형제 글을 찾는다.
        //   사용자 요구: "비슷한 제품들끼리 묶어서 거미줄치기도 가능하게 해야 되잖아"
        //   쇼핑 글 제목은 상품명이라 일반 키워드로는 서로 안 걸린다.
        //   예: 키워드가 "여름"이면 "수영장 튜브" 글과 "물놀이 매트" 글이 이어지지 않는다.
        //   상품명·카테고리로 찾으면 같은 제품군끼리 묶인다.
        const affTitle = String((payload as any).affiliateProducts?.[0]?.title || '').trim();
        const apiTitle = String((payload as any).coupangProducts?.[0]?.productName || '').trim();
        const apiCategory = String((payload as any).coupangProducts?.[0]?.categoryName || '').trim();
        const searchTerms = contentMode === 'shopping'
          ? [affTitle, apiTitle, apiCategory, keyword].filter(Boolean)
          : [keyword];

        let relatedLinks: any[] = [];
        for (const term of searchTerms) {
          relatedLinks = await findRelatedPosts(blogUrl, term, 5);
          if (relatedLinks.length > 0) {
            if (term !== keyword) {
              onLog?.(`[PROGRESS] 88% - 🕸️ "${term.slice(0, 25)}" 기준으로 관련 상품 글 ${relatedLinks.length}개를 찾았습니다`);
            }
            break;
          }
        }

        if (relatedLinks.length > 0) {
          // H2 섹션 1번째 이후부터 삽입 (최대 2개 섹션)
          html = insertInternalLinks(html, relatedLinks, 1);
          console.log(`[MAX-MODE] ✅ 내부 링크 ${relatedLinks.length}개 삽입 완료 (대상: ${blogUrl})`);
        } else if (contentMode === 'internal' || contentMode === 'shopping') {
          // 🛡️ 폴백 — 관련도 70+ 글이 0개면 같은 블로그 최근 글 3개라도 삽입
          //    완전히 비워두면 "추가 탐색" 섹션이 무용지물이 되므로 신규 블로그 케이스 보강
          //    v3.8.402: 쇼핑모드도 포함. 상품 글이 서로 안 이어지면 한 편 보고 나가버린다.
          //    (첫 상품 글은 형제가 없으니 최근 글이라도 이어줘야 다음 글로 넘어간다)
          console.log(`[MAX-MODE] 🔄 ${contentMode} 모드 폴백: 관련도 70+ 글 0개 → 최근 글로 대체 시도`);
          try {
            const fallbackLinks = await findRelatedPosts(blogUrl, '', 3);
            if (fallbackLinks.length > 0) {
              html = insertInternalLinks(html, fallbackLinks, 1);
              console.log(`[MAX-MODE] ✅ 폴백 링크 ${fallbackLinks.length}개 삽입 (최근 글)`);
            } else {
              console.log(`[MAX-MODE] ℹ️ 신규 블로그 — 내부 링크 후보 0개. 추가 탐색 섹션 그대로 유지.`);
            }
          } catch { /* 무시 */ }
        } else {
          console.log(`[MAX-MODE] ℹ️ 관련 내부 링크를 찾지 못했습니다.`);
        }
      } else {
        console.log(`[MAX-MODE] ℹ️ 블로그 URL이 설정되지 않아 내부 링크를 생략합니다.`);
      }
    } catch (linkErr: any) {
      console.log(`[MAX-MODE] ⚠️ 내부 링크 삽입 실패 (계속 진행): ${linkErr.message}`);
    }

    // 🖼️ 썸네일 생성 - 수집 이미지 우선, 그 다음 나노 바나나 프로 또는 SVG
    let thumbnailUrl = '';

    // v3.8.359: h2ImageMode와 썸네일 소스를 완전 분리
    //   과거: h2ImageMode='none'이면 썸네일도 자동 'none' → 사용자가 "본문 이미지 없이 썸네일만" 조합 불가
    //         (단일/일관 모드에서 사용자가 이렇게 설정했을 때 블로그스팟 대표 이미지가 사라지던 원인)
    //   현재: 사용자가 명시한 thumbnailSource가 유효하면 그대로 사용. 명시 없을 때만 h2ImageMode 따라가기
    const explicitThumb = String(payload.thumbnailSource || payload.thumbnailType || payload.thumbnailMode || '').trim().toLowerCase();
    const thumbnailSource = explicitThumb && explicitThumb !== 'none' && explicitThumb !== 'skip'
      ? explicitThumb
      : (h2ImageMode === 'none' ? 'none' : (explicitThumb || 'nanobanana2'));
    const thumbnailDisabled = thumbnailSource === 'none' || thumbnailSource === 'skip';
    onLog?.(`[PROGRESS] 90% - 🖼️ 썸네일 정책: source=${thumbnailSource}, h2ImageMode=${h2ImageMode}, contentMode=${contentMode} (분리 판정)`);
    const preGeneratedThumbnail = String(payload.preGeneratedThumbnail?.dataUrl || payload.preGeneratedThumbnail?.url || '').trim();

    if (h2ImageMode !== 'none' && preGeneratedThumbnail) {
      thumbnailUrl = preGeneratedThumbnail.startsWith('data:')
        ? (await uploadBase64ToImageHost(preGeneratedThumbnail, 'folder-thumbnail') || '')
        : preGeneratedThumbnail;
      if (thumbnailUrl) {
        onLog?.('[PROGRESS] 90% - 📁 내 폴더 썸네일 사용 (새 이미지 생성 생략)');
        emitGeneratedImage('thumbnail', `썸네일: ${h1}`, preGeneratedThumbnail, { queueImageToken });
      } else {
        onLog?.('[PROGRESS] 90% - ⚠️ 내 폴더 썸네일 업로드 실패 — 선택 엔진으로 생성을 계속합니다');
      }
    }

    // 🛡️ 사용자가 특정 AI 엔진을 명시 선택했는지 — auto/default가 아니고 'crawled'·'custom' 류도 아닌 경우
    //    명시 선택했으면 사용자 의도를 존중해 productImages를 무시하고 해당 엔진으로 직행
    //    (이전: productImages가 있으면 사용자 엔진 선택과 무관하게 무조건 수집 이미지 사용 — 회귀 수정)
    const srcLower = String(thumbnailSource || '').toLowerCase();
    const isCrawledRequested = srcLower === 'crawled'
      || srcLower.startsWith('crawled-')
      || srcLower === 'custom';
    const userPickedAiEngine = !!srcLower
      && srcLower !== 'auto'
      && srcLower !== 'default'
      && !isCrawledRequested
      && !thumbnailDisabled;
    const isShoppingMode = contentMode === 'shopping';

    // 🛒 productImages 우선 조건:
    //   1) 사용자가 'crawled'·'custom' 등 수집 이미지 사용을 명시 요청
    //   2) 또는 shopping 모드 (의도된 동작)
    //   3) 또는 사용자가 AI 엔진을 명시 선택하지 않은 자동 모드
    const useProductImages = !thumbnailDisabled
      && (payload.productImages as any)?.length > 0
      && (isCrawledRequested || isShoppingMode || !userPickedAiEngine);

    if (!thumbnailUrl && useProductImages) {
      thumbnailUrl = (payload.productImages as any)[0];
      onLog?.(`[PROGRESS] 90% - 🛒 수집된 상품 이미지로 썸네일 설정 (${(payload.productImages as any).length}장 중 1번째)`);
      console.log(`[THUMBNAIL] ✅ 수집 이미지 썸네일: ${thumbnailUrl.substring(0, 60)}...`);
      emitGeneratedImage('thumbnail', `썸네일: ${h1}`, thumbnailUrl, { queueImageToken });
    } else if (!thumbnailUrl && userPickedAiEngine && (payload.productImages as any)?.length > 0) {
      console.log(`[THUMBNAIL] 🛡️ 사용자 명시 엔진(${thumbnailSource}) 선택 — 수집 이미지 ${(payload.productImages as any).length}장 무시하고 AI 생성 진행`);
      onLog?.(`[PROGRESS] 90% - 🛡️ 사용자가 ${thumbnailSource} 엔진을 선택해 수집 이미지를 무시합니다`);
    }

    // 🎯 썸네일 디스패치: 사용자 선택 엔진 → 실패 시 폴백 → 최종 SVG
    if (!thumbnailUrl && !thumbnailDisabled) {
      onLog?.(`[PROGRESS] 90% - 🖼️ 썸네일 생성 중 (요청: ${thumbnailSource})...`);
      try {
        const thumbExtra: { gptImageQuality?: 'low' | 'medium' | 'high'; referenceImageList?: string[]; leonardoModel?: string; allowFreeTrialPublishing?: boolean; thumbnailNoText?: boolean } = {
          allowFreeTrialPublishing: true,
          // v3.8.336: 사용자가 "썸네일에 텍스트 미포함"을 선택하면 제목 오버레이를 끈다
          thumbnailNoText: payload.thumbnailNoText === true,
        };
        if (payload.gptImageQuality === 'low' || payload.gptImageQuality === 'medium' || payload.gptImageQuality === 'high') {
          thumbExtra.gptImageQuality = payload.gptImageQuality;
        }
        const thumbLeonardoModel = payload.leonardoModel || payload.leonardoModelPreference || payload.imageSettings?.leonardoModel;
        if (typeof thumbLeonardoModel === 'string' && thumbLeonardoModel.trim()) {
          thumbExtra.leonardoModel = thumbLeonardoModel.trim();
        }
        // v3.6.0: dropshot 엔진 + 쇼핑 모드 + productImages가 있으면 → i2i 자동 활성화
        //   사용자 의도: "쇼핑커넥트도 사용가능" — 수집된 상품 이미지를 reference로 새 이미지 생성
        const isDropshot = /^dropshot/i.test(String(thumbnailSource));
        const productImgList = (payload.productImages as any) as string[] | undefined;
        if (isDropshot && productImgList && productImgList.length > 0) {
          thumbExtra.referenceImageList = productImgList.slice(0, 4);
          onLog?.(`   🍌 i2i 모드: 쇼핑 상품 이미지 ${thumbExtra.referenceImageList.length}장을 reference로 사용`);
        }
        const thumbResult = await dispatchThumbnailGeneration(
          thumbnailSource,
          h1,
          keyword,
          (msg) => onLog?.(`   ${msg}`),
          thumbExtra,
        );
        if (thumbResult.ok) {
          emitGeneratedImage('thumbnail', `썸네일: ${h1}`, thumbResult.dataUrl, { queueImageToken });
          // 🔀 다운그레이드 감지 — 사용자가 요청한 엔진과 실제 사용 엔진이 다르면 경고
          const reqKey = String(thumbnailSource).toLowerCase().replace(/[^a-z]/g, '');
          const actKey = String(thumbResult.source || '').toLowerCase().replace(/[^a-z]/g, '');
          if (reqKey && reqKey !== 'auto' && !actKey.includes(reqKey) && !reqKey.includes(actKey)) {
            console.warn(`[THUMBNAIL] 🔀 엔진 다운그레이드: 요청=${thumbnailSource} 실제=${thumbResult.source}`);
            onLog?.(`   ⚠️ 요청 엔진(${thumbnailSource})과 실제 사용 엔진(${thumbResult.source})이 다릅니다.`);
          }
          onLog?.(`   📊 썸네일 최종 엔진: ${thumbResult.source}`);
          // Base64 이미지를 호스팅에 업로드
          if (thumbResult.dataUrl.startsWith('data:')) {
            const uploadedUrl = await uploadBase64ToImageHost(thumbResult.dataUrl, 'thumbnail');
            if (uploadedUrl) {
              thumbnailUrl = uploadedUrl;
              onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료 (업로드됨)`);
            } else {
              // 모든 호스팅 실패 — 썸네일 없이 진행 (base64는 Blogger 400 유발)
              thumbnailUrl = '';
              onLog?.(`   ⚠️ ${thumbResult.source} 썸네일 호스팅 실패 — 썸네일 없이 진행`);
            }
          } else {
            thumbnailUrl = thumbResult.dataUrl;
            onLog?.(`   ✅ ${thumbResult.source} 썸네일 완료`);
          }
        } else {
          onLog?.(`   ⚠️ 모든 썸네일 엔진 실패: ${thumbResult.error}`);
        }
      } catch (e: any) {
        console.error('[THUMBNAIL] 디스패치 실패:', e);
        onLog?.(`   ⚠️ 썸네일 생성 실패: ${e.message || e}`);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    // 💰 썸네일 — 풀블리드 (패딩/그림자 없음)
    if (thumbnailUrl) {
      const thumbnailHtml = `
<div class="bgpt-thumbnail-box" style="width:100% !important;aspect-ratio:16/9 !important;margin:0;padding:0;overflow:hidden !important;border-radius:10px !important;background:#f8fafc !important;">
  <img src="${thumbnailUrl}" alt="${h1}" style="width:100% !important;height:100% !important;aspect-ratio:16/9 !important;object-fit:cover !important;display:block !important;margin:0 !important;" loading="lazy" />
</div>`;
      html = html.replace('<!-- THUMBNAIL_PLACEHOLDER -->', thumbnailHtml);
    } else {
      html = html.replace('<!-- THUMBNAIL_PLACEHOLDER -->', '');
    }

    onLog?.(`[PROGRESS] 93% - ✅ 콘텐츠 생성 완료! (${duration}초)`);
    onLog?.(`   - 글자수: ${html.length}자`);
    onLog?.(`   - 썸네일: ${thumbnailUrl ? '생성됨' : '없음'}`);

    // 품질 검증 게이트 — 발행을 막지 않고 경고만 로그한다
    try {
      const qualityReport = validateArticleQuality({
        h1Title: h1,
        introduction: introductionHTML || '',
        conclusion: conclusionHTML || '',
        sections: sections.map(s => ({
          h2: s.h2,
          h3Sections: s.h3Sections.map((h: any) => ({ h3: h.h3, content: h.content })),
        })),
        faqs: faqs ?? [],
      });

      const qualityStatus = qualityReport.passed ? '✅ PASS' : '⚠️ WARN';
      onLog?.(`[QUALITY] ${qualityStatus} 품질 점수: ${qualityReport.score}/100`);
      if (qualityReport.issues.length > 0) {
        onLog?.(`[QUALITY] 발견된 문제 (${qualityReport.issues.length}건):`);
        qualityReport.issues.forEach(issue => onLog?.(`   - ${issue}`));
      }
      if (!qualityReport.passed && qualityReport.suggestions.length > 0) {
        onLog?.('[QUALITY] 개선 제안:');
        qualityReport.suggestions.slice(0, 3).forEach(s => onLog?.(`   → ${s}`));
      }
    } catch (qualityErr: any) {
      onLog?.(`[QUALITY] ⚠️ 품질 검증 오류 (발행 계속 진행): ${qualityErr.message}`);
    }

    // 🛡️ E-E-A-T 메타 박스 삽입 + 본문 cite 자동 변환
    //    AdSense·구글 검색 신뢰 신호 가산 (작성자/검토자/발행일/읽기시간/출처 카운트)
    try {
      const authorInfo = (payload as any).adsenseAuthorInfo || {};
      const eeat = buildEeatMeta({
        contentHtml: html,
        title: h1,
        authorName: authorInfo.name || (payload as any).authorNickname || undefined,
        authorTitle: authorInfo.title || undefined,
        publishedAt: new Date(),
        reviewerName: authorInfo.name || undefined,
        reviewerTitle: authorInfo.title || undefined,
      });
      // placeholder 치환
      html = eeat.contentHtml.replace('<!-- EEAT_META_PLACEHOLDER -->', eeat.metaBox);
      // CSS 주입 — 이미 generateCSSFinal에 없으므로 inline <style>로 head 안에 추가
      if (!html.includes('eeat-meta-box {')) {
        html = `<style>${EEAT_META_CSS}</style>\n${html}`;
      }
      onLog?.(`[PROGRESS] 98% - 🛡️ E-E-A-T 메타 보강 완료 (${eeat.stats.readingTimeMinutes}분 / 출처 ${eeat.stats.citationCount}개)`);
    } catch (eeatErr: any) {
      console.warn('[EEAT-META] ⚠️ 메타 보강 실패(원본 유지):', eeatErr?.message);
      // placeholder만 제거
      html = html.replace('<!-- EEAT_META_PLACEHOLDER -->', '');
    }

    // 🛡️ Schema.org JSON-LD 풀팩 자동 삽입 (Article + Person + Organization + WebSite + BreadcrumbList)
    //    구글 검색·AdSense가 신뢰도 평가에 직접 사용. 글 한 편당 1개 <script>로 통합 그래프 출력.
    try {
      const authorInfo = (payload as any).adsenseAuthorInfo || {};
      const env = loadEnvFromFile();
      // ⚠️ 위 2421줄과 동일한 env 키 함정. WP_URL 은 .env 에 없다 — WORDPRESS_SITE_URL 이 실제 키다.
      const baseSiteUrl = String(
        (payload as any).url || payload.blogUrl || payload.wordpressSiteUrl || payload.siteUrl ||
        env['WORDPRESS_SITE_URL'] || env['BLOGGER_URL'] || env['TISTORY_URL'] || ''
      ).trim().replace(/\/+$/, '');
      const schema = buildSchemaJsonLd({
        title: h1,
        description: (introductionHTML || '').replace(/<[^>]+>/g, ' ').slice(0, 250) || undefined,
        canonicalUrl: undefined,
        imageUrl: thumbnailUrl || undefined,
        publishedAt: new Date(),
        keywords: [keyword, ...(payload?.keywords?.map((k: any) => k.keyword || k).filter(Boolean) || [])].slice(0, 8),
        wordCount: html.replace(/<[^>]+>/g, '').length,
        authorName: authorInfo.name || (payload as any).authorNickname || undefined,
        authorTitle: authorInfo.title || undefined,
        authorSameAs: (payload as any).authorSameAs || undefined,
        siteName: (payload as any).siteName || undefined,
        siteUrl: baseSiteUrl || undefined,
      });
      // <article> 시작 직전에 삽입
      html = html.includes('<article')
        ? html.replace(/(<article[^>]*>)/, `${schema.scriptTag}\n$1`)
        : `${schema.scriptTag}\n${html}`;
      onLog?.(`[PROGRESS] 98% - 🛡️ Schema.org JSON-LD 삽입 (${schema.nodeCount}개 엔티티)`);
    } catch (schemaErr: any) {
      console.warn('[SCHEMA-JSONLD] ⚠️ 스키마 생성 실패(원본 유지):', schemaErr?.message);
    }

    // 🛡️ AdSense 정책 사전 스캔 — adsense 모드 강제, 그 외 모드는 옵트인
    if (contentMode === 'adsense' || payload?.adsensePolicyScan === true) {
      try {
        const policy = scanAdsensePolicy(html);
        onLog?.(`[POLICY] ${policy.summary}`);
        if (!policy.safe) {
          // block 위반 — 발행 차단 또는 경고 (adsenseGateMode와 통합)
          const gateMode = payload?.adsenseGateMode || 'warn';
          const violationDetail = policy.violations
            .filter(v => v.severity === 'block')
            .map(v => `[${v.pattern}] ${v.matched} → ${v.fix}`)
            .join('\n');
          if (gateMode === 'block') {
            onLog?.(`[POLICY] ❌ 정책 위반 발견 → 발행 차단:\n${violationDetail}`);
            throw new Error(`AdSense 정책 즉시 차단 위반:\n${violationDetail}`);
          } else {
            onLog?.(`[POLICY] ⚠️ 정책 위반 발견(warn 모드 — 발행 계속):\n${violationDetail}`);
          }
        }
        // warn 위반 로그
        const warnList = policy.violations.filter(v => v.severity === 'warn');
        if (warnList.length > 0) {
          warnList.slice(0, 5).forEach(v => onLog?.(`[POLICY]   ⚠️ ${v.category}/${v.pattern}: ${v.matched}`));
        }
      } catch (policyErr: any) {
        if (policyErr?.message?.includes('AdSense 정책')) throw policyErr;
        console.warn('[POLICY-SCAN] ⚠️ 정책 스캔 오류(무시):', policyErr?.message);
      }
    }

    // 🛡️ v3.5.83: AdSense 저가치 콘텐츠 사후 검증 게이트 (경고만 로그)
    //   prompt가 강제하는 글자수·외부출처·단락수가 실제로 충족됐는지 사후 측정.
    //   사용자 결정: block 없이 경고 로그만 남김. 사용자가 보고 판단.
    //   v3.5.84: length 경고 + 70% 미만이면 LLM 1회 자동 보강 (기본 ON, 옵트아웃: adsenseAutoEnrich===false)
    let finalQualityReport: any = null;
    if (contentMode === 'adsense' || payload?.adsenseQualityGate === true) {
      try {
        let quality = scanContentQuality(html);
        onLog?.(`[QUALITY-GATE] ${quality.summary}`);
        if (!quality.ok) {
          quality.warnings.forEach(w => {
            onLog?.(`[QUALITY-GATE]   ⚠️ ${w.metric}: ${w.message}`);
          });
        }

        // 🔁 자동 보강 루프 — length 경고 + 임계값 70% 미만일 때만 1회 LLM 호출
        const autoEnrichEnabled = contentMode === 'adsense'
          ? (payload?.adsenseAutoEnrich !== false)
          : (payload?.adsenseAutoEnrich === true);
        const lengthWarning = quality.warnings.find(w => w.metric === 'length');
        const needsEnrich = autoEnrichEnabled
          && lengthWarning
          && Number(lengthWarning.actual) < Number(lengthWarning.threshold) * 0.7;

        if (needsEnrich) {
          onLog?.(`[QUALITY-GATE] 🔁 본문 정보량 부족(${lengthWarning!.actual}/${lengthWarning!.threshold}) — LLM 자동 보강 1회 시도...`);
          try {
            const enrichPrompt = `당신은 한국어 SEO 전문가입니다. 아래 블로그 글의 정보 밀도가 부족합니다.
독자에게 실질적 가치를 더 제공하는 추가 보충 섹션 1개를 작성해주세요.

키워드: ${keyword}
기존 글 요약: ${(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800))}

요구사항:
- 새 H2 제목으로 시작 (예: "📝 추가로 알아둘 점", "💡 실전 활용 팁", "📊 통계로 본 ${keyword}")
- 본문 단락 4-6개, 각 2-3문장
- 한국 공공기관(통계청·한국소비자원·한국은행 등) 데이터 1회 이상 인용 (가짜 수치 금지, 모르면 "공식 자료를 참고하세요"로)
- 한국 독자에게 즉시 도움 되는 구체 정보
- HTML 형식: <h2>...</h2><p>...</p><p>...</p> 만 사용. 다른 태그·이모지·CSS 금지
- 분량: HTML 1500~2500자

오직 HTML 결과만 출력 (설명·마크다운 금지).`;

            const enrichedRaw = await callGeminiWithRetry(enrichPrompt, 1);
            // 응답에서 HTML만 추출 (백틱 코드블럭 제거)
            const enrichedHtml = enrichedRaw
              .replace(/^```(?:html)?\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();
            // 안전 검사: <h2>로 시작하고 충분히 길면 채택
            if (enrichedHtml.length > 800 && /<h2[\s>]/i.test(enrichedHtml)) {
              // 결론(맨 마지막 H2 또는 글 끝)이 있다면 그 직전에, 없으면 그냥 끝에 삽입
              const conclusionMatch = html.match(/<h2[^>]*>(?:[^<]*)?(?:맺음말|결론|마무리|총정리|핵심\s*정리)[^<]*<\/h2>/i);
              if (conclusionMatch && conclusionMatch.index !== undefined) {
                html = html.slice(0, conclusionMatch.index) + '\n' + enrichedHtml + '\n' + html.slice(conclusionMatch.index);
              } else {
                html = html + '\n' + enrichedHtml + '\n';
              }
              onLog?.(`[QUALITY-GATE] ✅ 자동 보강 완료 (+${enrichedHtml.length} chars)`);
              // 재측정
              quality = scanContentQuality(html);
              onLog?.(`[QUALITY-GATE] 🔁 보강 후 재측정: ${quality.summary}`);
            } else {
              onLog?.(`[QUALITY-GATE] ⚠️ 자동 보강 결과가 부적합(${enrichedHtml.length} chars, h2 ${/<h2/i.test(enrichedHtml) ? 'O' : 'X'}) — 원본 유지`);
            }
          } catch (enrichErr: any) {
            onLog?.(`[QUALITY-GATE] ⚠️ 자동 보강 실패(원본 유지): ${enrichErr?.message?.slice(0, 100) || '알 수 없는 오류'}`);
          }
        }
        // 최종 quality report를 result에 노출 (UI 모달용)
        finalQualityReport = quality;
      } catch (qErr: any) {
        console.warn('[QUALITY-GATE] ⚠️ 품질 검사 오류(무시):', qErr?.message);
      }
    }

    // 🛡️ 모드별 후처리 (adsense: CTA 잔재 제거 + AI 감지 완화)
    let postProcessReport: any = null;
    if (modeResult.postProcessPlugin?.postProcess) {
      try {
        const ppResult = modeResult.postProcessPlugin.postProcess(html);
        html = ppResult.html;
        postProcessReport = ppResult.report;
        onLog?.(`[PROGRESS] 99% - ✅ ${contentMode} 모드 후처리 완료`);
      } catch (ppErr: any) {
        console.warn(`[POST-PROCESS] ⚠️ 후처리 실패 (원본 유지): ${ppErr.message}`);
      }
    }

    if (contentMode === 'adsense' && payload?.adsenseHardeningScan !== false) {
      try {
        const hardening = scanAdsenseHardening(html);
        onLog?.(`[ADSENSE-HARDENING] ${hardening.summary}`);
        if (!hardening.ok) {
          hardening.warnings.slice(0, 8).forEach(w => {
            onLog?.(`[ADSENSE-HARDENING]   ⚠️ ${w.metric}: ${w.message}`);
          });
          const gateMode = payload?.adsenseGateMode || 'warn';
          const hardWarnings = hardening.warnings.filter(w => w.severity === 'hard');
          if (gateMode === 'block' && hardWarnings.length > 0) {
            throw new Error(`AdSense hardening block: ${hardWarnings.map(w => w.metric).join(', ')}`);
          }
        }
        finalQualityReport = {
          ...(finalQualityReport || {}),
          adsenseHardening: hardening,
        };
      } catch (hardeningErr: any) {
        if (hardeningErr?.message?.startsWith('AdSense hardening block:')) throw hardeningErr;
        console.warn('[ADSENSE-HARDENING] scan skipped:', hardeningErr?.message);
      }
    }

    // 🚦 AdSense 점수 게이트 — 임계값 미만이면 발행 차단 또는 경고
    //    v3.5.83: adsense 모드에서 기본 ON (옵트아웃: payload.adsenseScoreGate === false 명시 시 비활성)
    //    burstinessScore + endingDiversity + sentenceLengthStdDev + AI 패턴 카운트로 100점 환산.
    const scoreGateEnabled = contentMode === 'adsense'
      ? (payload?.adsenseScoreGate !== false)
      : (payload?.adsenseScoreGate === true);
    if (contentMode === 'adsense' && postProcessReport && scoreGateEnabled) {
      const minScore = Number(payload?.adsenseMinScore || 70);
      // 4개 지표를 0-100 점수로 환산 (각 25점 만점)
      const burst = Math.min(25, Math.max(0, Math.round((postProcessReport.burstinessScore || 0) / 1.0 * 25)));
      const ending = Math.min(25, Math.max(0, Math.round((postProcessReport.endingDiversity || 0) / 6 * 25)));
      const stdDev = Math.min(25, Math.max(0, Math.round((postProcessReport.sentenceLengthStdDev || 0) / 18 * 25)));
      const aiPenalty = Math.max(0, 25 - (postProcessReport.aiPatternCount || 0) * 3);
      const computedScore = burst + ending + stdDev + aiPenalty;
      onLog?.(`[QUALITY] 🚦 AdSense 점수: ${computedScore}/100 (burstiness ${burst}, 종결어미 ${ending}, 표준편차 ${stdDev}, AI패턴 ${aiPenalty}, 임계값 ${minScore})`);
      if (computedScore < minScore) {
        const gateMode = payload?.adsenseGateMode || 'warn';
        const msg = `🚦 AdSense 점수 미달 — 점수 ${computedScore}/100 (임계값 ${minScore}). 양산 패턴/AI 감지 위험.`;
        if (gateMode === 'block') {
          onLog?.(`[QUALITY] ❌ ${msg} (block 모드 — 발행 차단)`);
          throw new Error(msg + ' 글을 다듬거나 임계값을 낮추세요.');
        } else {
          onLog?.(`[QUALITY] ⚠️ ${msg} (warn 모드 — 발행 계속)`);
        }
      }
    }

    // 🚀 v3.5.77: 본문 후처리 — SEO 메타·alt·lazy·SVG·itemprop·textLength 일괄 보강
    try {
      html = applyFinalSeoEnhancements(html, {
        title: h1,
        keyword,
        thumbnailUrl,
        description: (allSectionsObj?.introduction || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155),
      });
    } catch (e: any) {
      console.warn('[orchestration] applyFinalSeoEnhancements 실패 (skip):', e?.message);
    }

    // 🛡️ v3.7.20: 본문 전역 HTML entity 정화 — LLM이 본문/CTA 어디든 `&#8594;`(→) 같은
    //   numeric entity를 직접 박는 경우 + 다운스트림(KSES 등)에서 `&` → `&amp;` 재이스케이프되어
    //   `&amp;#8594;` 형태로 굳어 브라우저에 raw 텍스트로 노출되는 경우까지 일괄 차단.
    //   <style>/<script> 블록은 CSS/JS 내부 의미 보존을 위해 건드리지 않는다.
    try {
      const decodeEntities = (segment: string): string =>
        segment
          .replace(/&amp;#(\d+);/g, (_, n) => {
            const code = parseInt(n, 10);
            if (code > 0 && code < 0x110000) {
              try { return String.fromCodePoint(code); } catch { return ''; }
            }
            return '';
          })
          .replace(/&amp;#[xX]([0-9a-fA-F]+);/g, (_, h) => {
            const code = parseInt(h, 16);
            if (code > 0 && code < 0x110000) {
              try { return String.fromCodePoint(code); } catch { return ''; }
            }
            return '';
          })
          .replace(/&#(\d+);/g, (_, n) => {
            const code = parseInt(n, 10);
            if (code > 0 && code < 0x110000) {
              try { return String.fromCodePoint(code); } catch { return ''; }
            }
            return '';
          })
          .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => {
            const code = parseInt(h, 16);
            if (code > 0 && code < 0x110000) {
              try { return String.fromCodePoint(code); } catch { return ''; }
            }
            return '';
          });
      const parts = html.split(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>)/gi);
      html = parts.map((part, i) => (i % 2 === 0 ? decodeEntities(part) : part)).join('');
    } catch (e: any) {
      console.warn('[orchestration] entity 정화 실패 (skip):', e?.message);
    }

    return {
      html,
      title: h1,
      labels: hashtags.split(',').map(t => t.trim()).slice(0, 15),
      thumbnail: thumbnailUrl,
      qualityReport: finalQualityReport, // v3.5.84: UI 모달 노출용 품질 리포트
    };

  } catch (error: any) {
    const msg = error?.message || String(error);
    const isEngineError = /API 키가 설정되지|엔진 호출 실패|다른 엔진을 선택/i.test(msg);
    if (isEngineError) {
      // 엔진 선택 관련 에러 — 전체 메시지를 사용자에게 전달
      msg.split('\n').forEach((line: string) => {
        if (line.trim()) onLog?.(`[PROGRESS] 0% - ${line.trim()}`);
      });
    } else {
      const isApiError = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|timeout|ECONNREFUSED|ENOTFOUND/i.test(msg);
      if (isApiError) {
        onLog?.(`[PROGRESS] 0% - ❌ AI API 연결 실패: ${msg.substring(0, 150)}`);
        onLog?.('💡 해결 방법: 잠시 후 다시 시도하거나, 다른 AI 엔진을 선택해주세요.');
      } else {
        onLog?.(`[PROGRESS] 0% - ❌ 콘텐츠 생성 오류: ${msg.substring(0, 150)}`);
      }
    }
    throw error;
  } finally {
    // 🎯 AI 엔진 env 원복 (다음 요청에 영향 방지)
    process.env['PRIMARY_TEXT_MODEL'] = previousTextModel;
    try { releaseLock(); } catch { /* no-op 보호 */ }
  }
}


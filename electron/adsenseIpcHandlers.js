"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdsenseIpcHandlers = registerAdsenseIpcHandlers;
// electron/adsenseIpcHandlers.ts
// 🏆 애드센스 도구 IPC 핸들러 — main.ts에서 import하여 등록
const electron_1 = require("electron");
const cheerio = __importStar(require("cheerio"));
// ── 블로그 크롤링 & 분석 헬퍼 ──
async function crawlBlogForAnalysis(blogUrl) {
    const startTime = Date.now();
    const data = {
        postCount: 0, avgPostLength: 0, categoryCount: 0, recentPostCount: 0,
        hasOriginalContent: true,
        hasPrivacyPage: false, hasDisclaimerPage: false, hasAboutPage: false, hasContactPage: false,
        hasTitleTag: false, hasMetaDescription: false, h1Count: 0, imgAltRate: 0,
        hasSitemap: false, hasRobotsTxt: false,
        isResponsive: false, hasNavigation: false, hasLogo: false,
        noAdultContent: true, noExistingAds: true, noAffiliateLinks: true,
        isHttps: blogUrl.startsWith('https'),
        no404Pages: true, loadTimeMs: 0,
    };
    try {
        // 메인 페이지 크롤링
        const res = await fetch(blogUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(15000),
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        // 기본 SEO
        data.hasTitleTag = $('title').length > 0 && $('title').text().trim().length > 0;
        data.hasMetaDescription = $('meta[name="description"]').length > 0;
        data.h1Count = $('h1').length;
        data.isResponsive = $('meta[name="viewport"]').length > 0;
        data.hasNavigation = $('nav').length > 0 || $('[role="navigation"]').length > 0;
        data.hasLogo = $('img[alt*="logo" i]').length > 0 || $('img.logo, .logo img, #logo img').length > 0;
        // 이미지 alt 비율
        const allImgs = $('img');
        const imgsWithAlt = $('img[alt]').filter((_i, el) => $(el).attr('alt').trim().length > 0);
        data.imgAltRate = allImgs.length > 0 ? Math.round((imgsWithAlt.length / allImgs.length) * 100) : 100;
        // 광고/어필리에이트 감지
        data.noExistingAds = !html.includes('pagead2.googlesyndication.com') && !html.includes('adsbygoogle');
        data.noAffiliateLinks = !html.includes('amzn.to') && !html.includes('coupang.com/np/search');
        // 페이지 링크 분석 (필수 페이지, 게시글 수)
        const links = $('a[href]');
        const hrefs = [];
        links.each((_i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().toLowerCase();
            hrefs.push(href);
            if (text.includes('privacy') || text.includes('개인정보'))
                data.hasPrivacyPage = true;
            if (text.includes('disclaimer') || text.includes('면책'))
                data.hasDisclaimerPage = true;
            if (text.includes('about') || text.includes('소개'))
                data.hasAboutPage = true;
            if (text.includes('contact') || text.includes('연락'))
                data.hasContactPage = true;
        });
        // Blogger-specific 포스트 카운트 (feed API 시도)
        if (blogUrl.includes('blogspot.com') || blogUrl.includes('blogger.com')) {
            try {
                const feedUrl = `${blogUrl.replace(/\/$/, '')}/feeds/posts/summary?alt=json&max-results=0`;
                const feedRes = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
                const feedJson = await feedRes.json();
                data.postCount = parseInt(feedJson?.feed?.openSearch$totalResults?.$t || '0', 10);
            }
            catch { /* feed 실패시 DOM 기반 추정 */ }
        }
        // DOM 기반 포스트 추정 (feed 실패 시)
        if (data.postCount === 0) {
            data.postCount = Math.max($('article').length, $('.post').length, $('h2.post-title, h3.post-title').length, 3 // 최소 추정
            );
        }
        // 카테고리 추정
        const labels = new Set();
        $('a[href*="label"], a[href*="category"]').each((_i, el) => {
            labels.add($(el).text().trim());
        });
        data.categoryCount = Math.max(labels.size, 1);
        // 최근 게시물 추정
        data.recentPostCount = Math.min(data.postCount, 5);
        // 평균 글 길이 추정 (메인 콘텐츠)
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        data.avgPostLength = data.postCount > 0 ? Math.floor(bodyText.length / data.postCount) : bodyText.length;
        // robots.txt & sitemap 체크
        try {
            const robotsRes = await fetch(`${blogUrl.replace(/\/$/, '')}/robots.txt`, { signal: AbortSignal.timeout(5000) });
            data.hasRobotsTxt = robotsRes.ok;
        }
        catch {
            data.hasRobotsTxt = false;
        }
        try {
            const sitemapRes = await fetch(`${blogUrl.replace(/\/$/, '')}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
            data.hasSitemap = sitemapRes.ok;
        }
        catch {
            data.hasSitemap = false;
        }
        data.loadTimeMs = Date.now() - startTime;
    }
    catch (error) {
        console.error('[ADSENSE-IPC] 블로그 크롤링 실패:', error);
        data.loadTimeMs = Date.now() - startTime;
    }
    return data;
}
// ── IPC 핸들러 등록 ──
function registerAdsenseIpcHandlers() {
    console.log('[ADSENSE-IPC] 🏆 애드센스 도구 IPC 핸들러 등록 시작...');
    // 1. 블로그 진단 (22개 항목 체크)
    electron_1.ipcMain.handle('adsense:check-blog', async (_evt, blogUrl) => {
        try {
            console.log('[ADSENSE-IPC] 블로그 진단 시작:', blogUrl);
            const data = await crawlBlogForAnalysis(blogUrl);
            const { runApprovalCheck } = require('../dist/core/content-modes/adsense/approval-checker');
            const result = runApprovalCheck(data);
            console.log(`[ADSENSE-IPC] ✅ 진단 완료: ${result.totalScore}점`);
            return { ok: true, result };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 블로그 진단 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 2. 필수 페이지 생성
    electron_1.ipcMain.handle('adsense:generate-essential-pages', async (_evt, config) => {
        try {
            console.log('[ADSENSE-IPC] 필수 페이지 생성:', config);
            const { generateAllEssentialPages } = require('../dist/core/content-modes/adsense/essential-pages');
            const pages = generateAllEssentialPages(config);
            console.log(`[ADSENSE-IPC] ✅ ${pages.length}개 필수 페이지 생성 완료`);
            return { ok: true, pages };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 필수 페이지 생성 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 3. 필수 페이지 Blogger 발행
    electron_1.ipcMain.handle('adsense:publish-essential-pages', async (_evt, config) => {
        try {
            console.log('[ADSENSE-IPC] 필수 페이지 발행 시작:', config.pages.length, '페이지');
            const results = [];
            for (const page of config.pages) {
                try {
                    const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${config.blogId}/pages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${config.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            kind: 'blogger#page',
                            title: page.title,
                            content: page.content,
                        }),
                    });
                    if (res.ok) {
                        const json = await res.json();
                        results.push({ title: page.title, ok: true, url: json.url });
                        console.log(`[ADSENSE-IPC] ✅ 발행 성공: ${page.title}`);
                    }
                    else {
                        const errText = await res.text();
                        results.push({ title: page.title, ok: false, error: `HTTP ${res.status}: ${errText}` });
                        console.error(`[ADSENSE-IPC] ❌ 발행 실패: ${page.title}`, errText);
                    }
                }
                catch (e) {
                    results.push({ title: page.title, ok: false, error: e.message });
                }
            }
            return { ok: true, results };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 필수 페이지 발행 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 4. 콘텐츠 다양성 분석
    electron_1.ipcMain.handle('adsense:get-content-diversity', async (_evt, postTitles) => {
        try {
            console.log('[ADSENSE-IPC] 콘텐츠 다양성 분석:', postTitles.length, '개 제목');
            const { analyzeContentDiversity } = require('../dist/core/content-modes/adsense/content-planner');
            const result = analyzeContentDiversity(postTitles);
            console.log(`[ADSENSE-IPC] ✅ 다양성 분석 완료: ${result.diversityScore}점`);
            return { ok: true, result };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 콘텐츠 다양성 분석 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 5. 거절 사유 분석
    // 유효한 RejectionReason 타입 목록 (임의 문자열 fallback 방지)
    const VALID_REASONS = new Set([
        'low_value_content', 'copied_content', 'site_navigation', 'policy_violation',
        'missing_pages', 'insufficient_content', 'traffic_manipulation', 'existing_ads',
        'not_responsive', 'unclear_author', 'under_review', 'other',
    ]);
    electron_1.ipcMain.handle('adsense:analyze-rejection', async (_evt, reasons) => {
        try {
            console.log('[ADSENSE-IPC] 거절 사유 분석:', reasons);
            const { analyzeRejection, createRecoveryPlan } = require('../dist/core/content-modes/adsense/rejection-analyzer');
            // 유효하지 않은 reason은 'other'로 fallback
            const safeReasons = reasons.map(r => VALID_REASONS.has(r) ? r : 'other');
            // 단일 사유인 경우 analyzeRejection, 복수인 경우 createRecoveryPlan
            if (safeReasons.length === 1) {
                const analysis = analyzeRejection(safeReasons[0]);
                console.log(`[ADSENSE-IPC] ✅ 거절 분석 완료: ${analysis.reasonLabel}`);
                return { ok: true, plan: analysis };
            }
            const plan = createRecoveryPlan(safeReasons);
            console.log(`[ADSENSE-IPC] ✅ 복구 계획 생성 완료: ${plan.estimatedTotalDays}일`);
            return { ok: true, plan };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 거절 사유 분석 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 6. 기술 SEO 가이드
    electron_1.ipcMain.handle('adsense:get-tech-seo', async () => {
        try {
            const { generateBloggerTechSEOGuides, getTechSEOChecklist } = require('../dist/core/content-modes/adsense/technical-seo');
            const guides = generateBloggerTechSEOGuides();
            const checklist = getTechSEOChecklist();
            console.log(`[ADSENSE-IPC] ✅ 기술 SEO 가이드: ${guides.length}개, 체크리스트: ${checklist.length}개`);
            return { ok: true, guides, checklist };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ 기술 SEO 가이드 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    // 7. AI 탐지 검사
    electron_1.ipcMain.handle('adsense:check-ai-detection', async (_evt, html) => {
        try {
            console.log('[ADSENSE-IPC] AI 탐지 검사 시작:', html.length, '자');
            const { postProcessForApproval } = require('../dist/core/content-modes/adsense/adsense-post-processor');
            const result = postProcessForApproval(html);
            console.log(`[ADSENSE-IPC] ✅ AI 검사 완료: burstiness=${result.report?.burstinessScore ?? 'N/A'}`);
            return { ok: true, result };
        }
        catch (error) {
            console.error('[ADSENSE-IPC] ❌ AI 탐지 검사 실패:', error);
            return { ok: false, error: error.message };
        }
    });
    console.log('[ADSENSE-IPC] ✅ 애드센스 도구 IPC 핸들러 7개 등록 완료');
}

"use strict";
// electron/oneclick/automation/blogspot/steps/createBlog.ts
// Step 1: 블로그 생성 (제목, 주소 입력 + blogId 추출)
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlog = createBlog;
const browser_1 = require("../../../utils/browser");
const selectors_1 = require("../../../config/selectors");
function extractBlogIdFromUrl(url) {
    const patterns = [
        /blogger\.com\/blog\/(?:posts|pages|settings|stats|comments|layout|theme|themes|earnings)?\/?(\d+)/i,
        /[?&](?:blogID|blogId|blog_id)=(\d+)/i,
    ];
    for (const pattern of patterns) {
        const match = String(url || '').match(pattern);
        if (match?.[1])
            return match[1];
    }
    return '';
}
async function findExistingBlogOnPage(page) {
    try {
        return await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            for (const link of links) {
                const href = link.href || '';
                const match = href.match(/blogger\.com\/blog\/(?:posts|pages|settings|stats|comments|layout|theme|themes|earnings)?\/?(\d+)/i)
                    || href.match(/[?&](?:blogID|blogId|blog_id)=(\d+)/i);
                if (match?.[1]) {
                    return {
                        blogId: match[1],
                        href,
                        text: (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
                    };
                }
            }
            return null;
        });
    }
    catch {
        return null;
    }
}
function summarizeInspection(inspection) {
    const parts = [
        `Blog ID ${inspection.blogId}`,
        inspection.blogTitle ? `제목 "${inspection.blogTitle}"` : '',
        inspection.publicUrl ? `공개주소 ${inspection.publicUrl}` : '',
        inspection.settingsReachable ? '설정 페이지 접근 성공' : '설정 페이지 접근 확인 필요',
        ...inspection.evidence,
    ].filter(Boolean);
    return parts.join(' · ');
}
async function inspectExistingBlog(state, page, blogId) {
    const inspection = {
        blogId,
        currentUrl: page.url(),
        pageTitle: '',
        blogTitle: '',
        publicUrl: '',
        settingsReachable: false,
        evidence: [],
    };
    state.message = `기존 블로그 확인 중... Blog ID ${blogId}의 설정 페이지와 핵심 항목을 검사합니다.`;
    try {
        await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        try {
            await page.waitForLoadState?.('networkidle', { timeout: 8000 });
        }
        catch { /* Blogger는 계속 통신할 수 있어 timeout 허용 */ }
        await (0, browser_1.sleep)(2500);
        const scan = await page.evaluate(() => {
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
            const titleInput = document.querySelector('input[aria-label*="제목"], input[aria-label*="Title"], input[placeholder*="제목"]');
            const publicLink = Array.from(document.querySelectorAll('a[href*=".blogspot.com"]'))
                .map((a) => a.href)
                .find(Boolean) || '';
            const labels = [
                /HTTPS/i.test(text) ? 'HTTPS 항목 확인' : '',
                /검색 엔진|Search engine|Visible to search engines/i.test(text) ? '검색엔진 노출 항목 확인' : '',
                /메타태그|Meta tags/i.test(text) ? '메타태그 항목 확인' : '',
                /댓글|Comments/i.test(text) ? '댓글 설정 항목 확인' : '',
                /시간대|Time zone/i.test(text) ? '시간대 항목 확인' : '',
                /수익 창출|Earnings|ads\.txt/i.test(text) ? 'ads.txt/수익 항목 확인' : '',
            ].filter(Boolean);
            return {
                pageTitle: document.title || '',
                blogTitle: (titleInput?.value || '').trim(),
                publicUrl: publicLink,
                hasSettings: /설정|Settings|HTTPS|검색 엔진|Search engine|메타태그|Meta tags|댓글|Comments|시간대|Time zone/i.test(text),
                labels,
            };
        });
        inspection.currentUrl = page.url();
        inspection.pageTitle = scan.pageTitle || '';
        inspection.blogTitle = scan.blogTitle || '';
        inspection.publicUrl = scan.publicUrl || '';
        inspection.settingsReachable = Boolean(scan.hasSettings);
        inspection.evidence = scan.labels || [];
        if (inspection.settingsReachable && !inspection.evidence.includes('설정 화면 로드 확인')) {
            inspection.evidence.unshift('설정 화면 로드 확인');
        }
    }
    catch (e) {
        inspection.evidence.push(`설정 페이지 검사 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
    return inspection;
}
/**
 * Blogger 대시보드에서 블로그를 생성하고 blogId를 반환한다.
 * 이미 블로그가 존재하면 URL에서 blogId를 추출한다.
 */
async function createBlog(state, page, config) {
    state.currentStep = 1;
    state.stepStatus = 'running';
    state.message = '블로그 만들기 시작...';
    let blogId = '';
    try {
        // 현재 URL에서 이미 블로그가 있는지 확인
        await (0, browser_1.sleep)(2000);
        const currentUrl = page.url();
        blogId = extractBlogIdFromUrl(currentUrl);
        if (!blogId) {
            const found = await findExistingBlogOnPage(page);
            if (found?.blogId)
                blogId = found.blogId;
        }
        const useExisting = config.setupPurpose === 'existing' || config.useExistingBlog === true || !!config.existingBlogId;
        const forceCreateNew = config.setupPurpose === 'create-new' || config.forceCreateNew === true;
        if (forceCreateNew && blogId) {
            state.message = `기존 블로그도 감지됨 (blogId: ${blogId}) — 하지만 사용자가 "새 블로그 추가 개설"을 선택했으므로 신규 생성을 계속합니다.`;
            await (0, browser_1.sleep)(1200);
        }
        if (useExisting && !blogId && config.existingBlogId) {
            blogId = String(config.existingBlogId).trim();
        }
        if (useExisting && !blogId) {
            state.message = '기존 블로그 감지 중... Blogger 대시보드의 블로그 목록을 충분히 확인합니다.';
            await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            try {
                await page.waitForLoadState?.('networkidle', { timeout: 8000 });
            }
            catch { /* 허용 */ }
            await (0, browser_1.sleep)(3500);
            const found = await findExistingBlogOnPage(page);
            if (found?.blogId)
                blogId = found.blogId;
        }
        if (useExisting && blogId) {
            const inspection = await inspectExistingBlog(state, page, blogId);
            state.message = `기존 블로그 확인 완료 — ${summarizeInspection(inspection)}. 기존 블로그 점검 모드이므로 새 블로그 생성은 건너뛰고 다음 단계로 넘어갑니다.`;
            state.stepStatus = 'done';
            await (0, browser_1.sleep)(1800);
            return blogId;
        }
        if (useExisting && !blogId) {
            state.stepStatus = 'error';
            state.message = '기존 블로그를 찾지 못했습니다. Blogger에서 블로그를 먼저 선택하거나, Blog ID를 직접 입력한 뒤 다시 시도해 주세요.';
            state.error = state.message;
            return '';
        }
        if (blogId && !forceCreateNew) {
            const inspection = await inspectExistingBlog(state, page, blogId);
            state.message = `기존 블로그 자동 감지 — ${summarizeInspection(inspection)}. 새 블로그 추가 개설 목적이 아니므로 생성은 건너뛰고 다음 단계로 넘어갑니다.`;
            state.stepStatus = 'done';
            await (0, browser_1.sleep)(1800);
            return blogId;
        }
        // 🛡️ 사전 형식 검증 — Blogger의 거절 메시지 UI를 감지하기 어려우므로 앱에서 미리 차단
        //    1) blogAddress: 영문 소문자/숫자/하이픈만 허용, 4~63자
        //    2) blogTitle: 1~200자
        if (config.blogAddress) {
            const addr = String(config.blogAddress).trim().toLowerCase();
            const addrOk = /^[a-z0-9][a-z0-9-]{2,61}[a-z0-9]$/.test(addr);
            if (!addrOk) {
                state.stepStatus = 'error';
                state.message = `블로그 주소 형식 오류: "${addr}" — 영문 소문자·숫자·하이픈만 가능하며 4~63자, 시작/끝은 영숫자여야 합니다.`;
                state.error = state.message;
                console.error('[ONECLICK-BLOGSPOT] ❌ 블로그 주소 형식 오류:', addr);
                return '';
            }
            config.blogAddress = addr;
        }
        if (config.blogTitle) {
            const title = String(config.blogTitle).trim();
            if (title.length < 1 || title.length > 200) {
                state.stepStatus = 'error';
                state.message = `블로그 제목 길이 오류: ${title.length}자 — 1~200자여야 합니다.`;
                state.error = state.message;
                return '';
            }
            config.blogTitle = title;
        }
        if (forceCreateNew) {
            state.message = '새 블로그 추가 개설 모드 — Blogger 홈으로 이동해 "새 블로그 만들기" 버튼을 찾습니다.';
            try {
                await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
                try {
                    await page.waitForLoadState?.('networkidle', { timeout: 8000 });
                }
                catch { /* 허용 */ }
                await (0, browser_1.sleep)(2500);
            }
            catch {
                // 홈 이동이 실패해도 현재 화면에서 버튼 탐색을 계속 시도한다.
            }
        }
        if (config.blogTitle && config.blogAddress) {
            // 새 블로그 만들기 (대시보드에서)
            state.message = '새 블로그 만들기 클릭 중...';
            try {
                const createBlogLink = await page.locator(selectors_1.BLOGGER_SELECTORS.newBlogText).first();
                const createBlogBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.createBlogText).first();
                const newBlogLink = await page.locator(selectors_1.BLOGGER_SELECTORS.newBlogLink).first();
                let clicked = false;
                for (const el of [createBlogLink, createBlogBtn, newBlogLink]) {
                    try {
                        if (await el.isVisible({ timeout: 3000 })) {
                            await el.click();
                            clicked = true;
                            break;
                        }
                    }
                    catch { /* 다음 셀렉터 시도 */ }
                }
                if (clicked) {
                    await (0, browser_1.sleep)(2000);
                    // 블로그 제목 입력
                    state.message = `블로그 제목 입력: "${config.blogTitle}"`;
                    try {
                        const titleInput = await page.locator(selectors_1.BLOGGER_SELECTORS.titleInput).first();
                        if (await titleInput.isVisible({ timeout: 5000 })) {
                            await titleInput.fill(config.blogTitle);
                            await (0, browser_1.sleep)(1000);
                        }
                    }
                    catch {
                        const fallbackInput = await page.locator(selectors_1.BLOGGER_SELECTORS.titleInputFallback).first();
                        if (await fallbackInput.isVisible({ timeout: 3000 })) {
                            await fallbackInput.fill(config.blogTitle);
                            await (0, browser_1.sleep)(1000);
                        }
                    }
                    // "다음" 버튼 클릭
                    try {
                        const nextBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.nextBtn).first();
                        if (await nextBtn.isVisible({ timeout: 3000 })) {
                            await nextBtn.click();
                            await (0, browser_1.sleep)(2000);
                        }
                    }
                    catch { /* 다음 버튼 없으면 계속 */ }
                    // 블로그 주소 입력
                    state.message = `블로그 주소 입력: "${config.blogAddress}"`;
                    try {
                        const addressInput = await page.locator(selectors_1.BLOGGER_SELECTORS.addressInput).first();
                        if (await addressInput.isVisible({ timeout: 5000 })) {
                            await addressInput.fill(config.blogAddress);
                            await (0, browser_1.sleep)(1500);
                        }
                    }
                    catch {
                        const inputs = await page.locator('input[type="text"]').all();
                        if (inputs.length > 0) {
                            const lastInput = inputs[inputs.length - 1];
                            await lastInput.fill(config.blogAddress);
                            await (0, browser_1.sleep)(1500);
                        }
                    }
                    // "저장" 또는 "만들기" 버튼 클릭
                    try {
                        const saveBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.saveOrCreateBtn).first();
                        if (await saveBtn.isVisible({ timeout: 5000 })) {
                            await saveBtn.click();
                            await (0, browser_1.sleep)(3000);
                            state.message = '✅ 블로그 생성 완료!';
                        }
                    }
                    catch {
                        state.message = '블로그 생성 버튼을 찾지 못했습니다 — blogger.com 에서 "새 블로그 만들기"를 직접 눌러주세요';
                    }
                }
                else if (forceCreateNew) {
                    state.stepStatus = 'error';
                    state.message = '새 블로그 추가 개설 모드이지만 "새 블로그 만들기" 버튼을 찾지 못했습니다. Blogger 화면에서 새 블로그 만들기 버튼을 직접 열어주세요.';
                    state.error = state.message;
                    return '';
                }
                else {
                    state.message = '기존 블로그 감지됨 — 건너뜁니다';
                }
            }
            catch (e) {
                console.error('[ONECLICK-BLOGSPOT] 블로그 생성 오류:', e);
                state.message = '블로그가 이미 존재하거나 생성 UI를 찾지 못함';
            }
        }
        else {
            state.message = '블로그 제목/주소 미입력 — 건너뜁니다';
        }
        // blogId 재확인
        await (0, browser_1.sleep)(2000);
        const newUrl = page.url();
        blogId = extractBlogIdFromUrl(newUrl) || blogId;
        if (!blogId) {
            const found = await findExistingBlogOnPage(page);
            if (found?.blogId)
                blogId = found.blogId;
        }
        if (forceCreateNew && blogId) {
            state.message = `새 블로그 생성 확인 — 제목 "${config.blogTitle}", 주소 ${config.blogAddress}.blogspot.com, Blog ID ${blogId}. 다음 단계로 넘어갑니다.`;
        }
    }
    catch (e) {
        console.error('[ONECLICK-BLOGSPOT] Step 1 오류:', e);
        state.message = '블로그 만들기 실패 — 주소 중복일 수 있습니다. blogger.com 에서 "새 블로그 만들기"를 열어 다른 주소로 재시도하세요';
    }
    if (!blogId) {
        state.stepStatus = 'error';
        state.error = state.message || 'Blog ID를 확인하지 못했습니다. Blogger에서 블로그 선택 상태를 확인해 주세요.';
        return '';
    }
    state.stepStatus = 'done';
    await (0, browser_1.sleep)(1000);
    return blogId;
}

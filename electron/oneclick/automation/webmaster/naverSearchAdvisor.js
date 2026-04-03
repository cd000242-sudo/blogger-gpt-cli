"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automateNaverSearchAdvisor = automateNaverSearchAdvisor;
const bloggerThemeUtils_1 = require("../../utils/bloggerThemeUtils");
async function automateNaverSearchAdvisor(state, page, blogUrl) {
    const results = {};
    // 1) 서치어드바이저 열기
    state.message = '네이버 서치어드바이저 로딩 중...';
    await page.goto('https://searchadvisor.naver.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // 2) 로그인 확인
    const loginBtn = await page.$('a:has-text("로그인")') || await page.$('.login_area a');
    if (loginBtn) {
        // 로그인 페이지로 이동
        await loginBtn.click();
        await page.waitForTimeout(2000);
        state.stepStatus = 'waiting-login';
        state.message = '🔐 네이버 계정으로 로그인해주세요...';
        // 로그인 완료 대기
        await page.waitForURL((url) => {
            const u = typeof url === 'string' ? url : url.toString();
            return u.includes('searchadvisor.naver.com') && !u.includes('nid.naver.com');
        }, { timeout: 300000 });
        state.stepStatus = 'running';
        state.message = '로그인 완료! 사이트 등록 중...';
        await page.waitForTimeout(3000);
    }
    if (state.cancelled)
        return;
    // 3) 사이트 추가
    state.message = '사이트 추가 중...';
    try {
        // 웹마스터도구 > 사이트 관리 페이지
        await page.goto('https://searchadvisor.naver.com/console/board', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        // "사이트 추가" 입력 필드 찾기
        const siteInput = await page.$('input[placeholder*="사이트"]') || await page.$('input[type="url"]') || await page.$('.site_input input');
        if (siteInput) {
            await siteInput.fill(blogUrl);
            await page.waitForTimeout(500);
            // 추가 버튼
            const addBtn = await page.$('button:has-text("추가")') || await page.$('.btn_add') || await page.$('button[type="submit"]');
            if (addBtn) {
                await addBtn.click();
                await page.waitForTimeout(4000);
            }
            results['사이트 등록'] = true;
        }
        else {
            // 이미 등록되어있을 수 있음
            const pageText = await page.textContent('body');
            if (pageText && pageText.includes(blogUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))) {
                results['사이트 등록'] = true;
                state.message = '이미 등록된 사이트입니다';
            }
            else {
                results['사이트 등록'] = false;
            }
        }
    }
    catch {
        results['사이트 등록'] = false;
    }
    if (state.cancelled)
        return;
    // 3-B) 소유 확인: HTML 태그 방식 → Blogger 테마 <head>에 메타태그 삽입
    state.message = '소유 확인 (HTML 태그) 진행 중...';
    try {
        // 소유 확인 페이지에서 HTML 태그 탭 클릭
        const htmlTagTab = await page.$('a:has-text("HTML 태그"), button:has-text("HTML 태그"), li:has-text("HTML 태그")');
        if (htmlTagTab) {
            await htmlTagTab.click();
            await page.waitForTimeout(2000);
        }
        // 메타태그 추출 (예: <meta name="naver-site-verification" content="xxxxx" />)
        const naverMetaTag = await page.evaluate(() => {
            // 메타태그가 코드 블록이나 text 영역에 표시됨
            const codeBlock = document.querySelector('code, pre, .code_area, textarea');
            if (codeBlock) {
                const text = codeBlock.textContent?.trim() || '';
                if (text.includes('naver-site-verification'))
                    return text;
            }
            // input에서 추출
            const inputs = document.querySelectorAll('input[readonly], input[type="text"]');
            for (const input of inputs) {
                const val = input.value;
                if (val && val.includes('naver-site-verification'))
                    return val;
            }
            // 페이지 텍스트에서 정규식으로 추출
            const bodyText = document.body.innerText;
            const match = bodyText.match(/<meta[^>]*naver-site-verification[^>]*\/?>/);
            return match ? match[0] : '';
        });
        if (naverMetaTag && blogUrl.includes('blogspot.com')) {
            state.message = `네이버 메타태그 추출 완료 → Blogger 테마에 삽입 중...`;
            // Blogger 테마에 메타태그 삽입 (별도 탭에서 수행)
            const blogId = blogUrl.match(/\/\/([^\.]+)\.blogspot/)?.[1] || '';
            // Blogger 테마 편집을 위해 새 탭 열기
            const context = page.context();
            const bloggerPage = await context.newPage();
            try {
                const inserted = await (0, bloggerThemeUtils_1.insertMetaTagToBloggerTheme)(bloggerPage, naverMetaTag, '', // blogId는 테마 편집에서 자동 탐색
                '네이버');
                results['네이버 메타태그 삽입'] = inserted;
                if (inserted) {
                    state.message = '✅ 네이버 메타태그 Blogger 테마에 삽입 완료!';
                }
            }
            finally {
                await bloggerPage.close();
            }
            // 돌아와서 소유 확인 버튼 클릭
            await page.waitForTimeout(2000);
            const verifyBtn = await page.$('button:has-text("소유확인"), button:has-text("확인")');
            if (verifyBtn) {
                await verifyBtn.click();
                await page.waitForTimeout(5000);
                results['소유 확인'] = true;
            }
        }
        else if (naverMetaTag) {
            state.message = '네이버 메타태그 추출 완료 (수동 삽입 필요 — 블로그스팟이 아닌 경우)';
            results['네이버 메타태그 삽입'] = false;
        }
        else {
            state.message = '메타태그를 찾지 못함 — 이미 인증되었거나 수동 확인 필요';
        }
    }
    catch (e) {
        console.error('[ONECLICK] 네이버 소유확인 오류:', e);
        results['소유 확인'] = false;
    }
    if (state.cancelled)
        return;
    // 4) 사이트맵 제출
    state.message = '사이트맵 제출 중...';
    try {
        // 사이트맵 관리 페이지
        const siteId = blogUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        await page.goto(`https://searchadvisor.naver.com/console/sitemap?site=${encodeURIComponent(blogUrl)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        const sitemapInput = await page.$('input[placeholder*="사이트맵"]') || await page.$('input[type="text"]');
        if (sitemapInput) {
            const sitemapUrl = blogUrl.endsWith('/') ? blogUrl + 'sitemap.xml' : blogUrl + '/sitemap.xml';
            await sitemapInput.fill(sitemapUrl);
            await page.waitForTimeout(500);
            const submitBtn = await page.$('button:has-text("확인")') || await page.$('button:has-text("제출")');
            if (submitBtn) {
                await submitBtn.click();
                await page.waitForTimeout(3000);
            }
            results['사이트맵 제출'] = true;
        }
        else {
            results['사이트맵 제출'] = false;
        }
    }
    catch {
        results['사이트맵 제출'] = false;
    }
    if (state.cancelled)
        return;
    // 5) RSS 등록
    state.message = 'RSS 피드 등록 중...';
    try {
        await page.goto(`https://searchadvisor.naver.com/console/rss?site=${encodeURIComponent(blogUrl)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        const rssInput = await page.$('input[placeholder*="RSS"]') || await page.$('input[type="text"]');
        if (rssInput) {
            // RSS URL 자동 추론
            let rssUrl = blogUrl.endsWith('/') ? blogUrl : blogUrl + '/';
            if (blogUrl.includes('tistory.com')) {
                rssUrl += 'rss';
            }
            else if (blogUrl.includes('blogspot.com')) {
                rssUrl += 'feeds/posts/default?alt=rss';
            }
            else {
                rssUrl += 'feed';
            }
            await rssInput.fill(rssUrl);
            await page.waitForTimeout(500);
            const submitBtn = await page.$('button:has-text("확인")') || await page.$('button:has-text("제출")');
            if (submitBtn) {
                await submitBtn.click();
                await page.waitForTimeout(3000);
            }
            results['RSS 등록'] = true;
        }
        else {
            results['RSS 등록'] = false;
        }
    }
    catch {
        results['RSS 등록'] = false;
    }
    if (state.cancelled)
        return;
    // 6) 수집 요청
    state.message = '웹 페이지 수집 요청 중...';
    try {
        await page.goto(`https://searchadvisor.naver.com/console/request?site=${encodeURIComponent(blogUrl)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        const reqInput = await page.$('input[placeholder*="URL"]') || await page.$('input[type="text"]');
        if (reqInput) {
            await reqInput.fill(blogUrl);
            await page.waitForTimeout(500);
            const reqBtn = await page.$('button:has-text("수집 요청")') || await page.$('button:has-text("확인")');
            if (reqBtn) {
                await reqBtn.click();
                await page.waitForTimeout(3000);
            }
            results['수집 요청'] = true;
        }
        else {
            results['수집 요청'] = false;
        }
    }
    catch {
        results['수집 요청'] = false;
    }
    state.results = results;
}

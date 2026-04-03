// @ts-nocheck
import type { WebmasterState } from '../../types';
import { insertMetaTagToBloggerTheme } from '../../utils/bloggerThemeUtils';

export async function automateBingWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

    // 1) Bing 웹마스터도구 열기
    state.message = 'Bing 웹마스터도구 로딩 중...';
    await page.goto('https://www.bing.com/webmasters', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2) 로그인 확인 (Microsoft 계정)
    const currentUrl = page.url();
    if (currentUrl.includes('login.microsoftonline.com') || currentUrl.includes('login.live.com') || currentUrl.includes('login.microsoft.com')) {
      state.stepStatus = 'waiting-login';
      state.message = '🔐 Microsoft 계정으로 로그인해주세요...';

      await page.waitForURL((url: any) => {
        const u = typeof url === 'string' ? url : url.toString();
        return u.includes('bing.com/webmasters') && !u.includes('login.');
      }, { timeout: 300000 });

      state.stepStatus = 'running';
      state.message = '로그인 완료! 사이트 등록 중...';
      await page.waitForTimeout(3000);
    }

    // 페이지에 Sign In 버튼이 있는 경우 (verified: class 'signInButton')
    const signInBtn = await page.$('button.signInButton') || await page.$('button:has-text("Sign In")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(2000);

      state.stepStatus = 'waiting-login';
      state.message = '🔐 Microsoft 계정으로 로그인해주세요...';

      await page.waitForURL((url: any) => {
        const u = typeof url === 'string' ? url : url.toString();
        return u.includes('bing.com/webmasters') && !u.includes('login.') && !u.includes('/about');
      }, { timeout: 300000 });

      state.stepStatus = 'running';
      state.message = '로그인 완료!';
      await page.waitForTimeout(3000);
    }

    if (state.cancelled) return;

    // 3) 사이트 추가
    state.message = '사이트 추가 중...';
    try {
      // "사이트 추가" 영역 — URL 입력 필드
      const addSiteInput = await page.$('input[placeholder*="URL"]') || await page.$('input[type="url"]') || await page.$('input[type="text"]');
      if (addSiteInput) {
        await addSiteInput.fill(blogUrl);
        await page.waitForTimeout(500);

        const addBtn = await page.$('button:has-text("Add")') || await page.$('button:has-text("추가")') || await page.$('input[type="submit"]');
        if (addBtn) {
          await addBtn.click();
          await page.waitForTimeout(5000);
        }
        results['사이트 등록'] = true;
      } else {
        // 이미 등록된 사이트 목록에서 확인
        const pageText = await page.textContent('body');
        if (pageText && pageText.includes(blogUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))) {
          results['사이트 등록'] = true;
          state.message = '이미 등록된 사이트입니다';
        } else {
          results['사이트 등록'] = false;
        }
      }
    } catch {
      results['사이트 등록'] = false;
    }

    if (state.cancelled) return;

    // 3-B) 인증: 메타태그 방식 → Blogger 테마 <head>에 자동 삽입
    state.message = 'Bing 인증 메타태그 처리 중...';
    try {
      // Bing은 사이트 추가 후 인증 방법 선택 화면에서 메타태그를 제공
      const bingMetaTag = await page.evaluate(() => {
        // 메타태그가 코드 블록에 표시됨
        const codeBlock = document.querySelector('code, pre, textarea');
        if (codeBlock) {
          const text = (codeBlock as HTMLElement).textContent?.trim() || '';
          if (text.includes('msvalidate.01')) return text;
        }
        // input에서 추출
        const inputs = document.querySelectorAll('input[readonly], input[type="text"]');
        for (const input of inputs) {
          const val = (input as HTMLInputElement).value;
          if (val && val.includes('msvalidate.01')) return val;
        }
        // 텍스트에서 정규식 추출
        const bodyText = document.body.innerText;
        const match = bodyText.match(/<meta[^>]*msvalidate\.01[^>]*\/?>/);
        return match ? match[0] : '';
      });

      if (bingMetaTag && blogUrl.includes('blogspot.com')) {
        state.message = 'Bing 메타태그 추출 완료 → Blogger 테마에 삽입 중...';

        // Blogger 테마에 메타태그 삽입 (별도 탭)
        const context = page.context();
        const bloggerPage = await context.newPage();
        try {
          const inserted = await insertMetaTagToBloggerTheme(
            bloggerPage,
            bingMetaTag,
            '', // blogId 자동 탐색
            'Bing'
          );
          results['Bing 메타태그 삽입'] = inserted;
          if (inserted) {
            state.message = '✅ Bing 메타태그 Blogger 테마에 삽입 완료!';
          }
        } finally {
          await bloggerPage.close();
        }

        // 돌아와서 인증 확인 버튼 클릭
        await page.waitForTimeout(2000);
        const verifyBtn = await page.$('button:has-text("Verify")') || await page.$('button:has-text("확인")');
        if (verifyBtn) {
          await verifyBtn.click();
          await page.waitForTimeout(5000);
          results['Bing 인증'] = true;
        }
      } else if (bingMetaTag) {
        state.message = 'Bing 메타태그 추출 완료 (수동 삽입 필요)';
        results['Bing 메타태그 삽입'] = false;
      } else {
        state.message = 'Bing 인증 이미 완료 또는 메타태그 미감지';
      }
    } catch (e) {
      console.error('[ONECLICK] Bing 메타태그 삽입 오류:', e);
      results['Bing 인증'] = false;
    }

    if (state.cancelled) return;

    // 4) 사이트맵 제출 (sitemap.xml + RSS 피드)
    state.message = '사이트맵 제출 중...';
    const bingSitemaps = ['sitemap.xml'];
    if (blogUrl.includes('blogspot.com')) {
      bingSitemaps.push('feeds/posts/default');
    }

    for (const sitemapName of bingSitemaps) {
      try {
        await page.goto('https://www.bing.com/webmasters/sitemaps', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);

        const sitemapInput = await page.$('input[placeholder*="sitemap"]') || await page.$('input[type="text"]');
        if (sitemapInput) {
          const sitemapUrl = blogUrl.endsWith('/') ? blogUrl + sitemapName : blogUrl + '/' + sitemapName;
          await sitemapInput.fill(sitemapUrl);
          await page.waitForTimeout(500);

          const submitBtn = await page.$('button:has-text("Submit")') || await page.$('button:has-text("제출")');
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
          }
          results[`사이트맵 제출 (${sitemapName})`] = true;
          state.message = `사이트맵 제출 완료: ${sitemapName}`;
        } else {
          results[`사이트맵 제출 (${sitemapName})`] = false;
        }
      } catch {
        results[`사이트맵 제출 (${sitemapName})`] = false;
      }
    }

    if (state.cancelled) return;

    // 5) URL 제출
    state.message = 'URL 제출 중...';
    try {
      await page.goto('https://www.bing.com/webmasters/submiturl', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const urlInput = await page.$('textarea') || await page.$('input[type="text"]');
      if (urlInput) {
        await urlInput.fill(blogUrl);
        await page.waitForTimeout(500);

        const submitBtn = await page.$('button:has-text("Submit")') || await page.$('button:has-text("제출")');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
        }
        results['URL 제출'] = true;
      } else {
        results['URL 제출'] = false;
      }
    } catch {
      results['URL 제출'] = false;
    }

    state.results = results;
  }

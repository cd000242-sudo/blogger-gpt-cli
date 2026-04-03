import type { WebmasterState } from '../../types';

export async function automateZumWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

    // 1) ZUM 웹마스터도구 열기
    state.message = 'ZUM 웹마스터도구 로딩 중...';
    await page.goto('https://webmaster.zum.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2) 로그인 확인
    const loginBtnZum = await page.$('a:has-text("로그인")') || await page.$('.login') || await page.$('a:has-text("Sign")');
    if (loginBtnZum) {
      await loginBtnZum.click();
      await page.waitForTimeout(2000);

      state.stepStatus = 'waiting-login';
      state.message = '🔐 ZUM 계정으로 로그인해주세요...';

      await page.waitForURL((url: any) => {
        const u = typeof url === 'string' ? url : url.toString();
        return u.includes('webmaster.zum.com') && !u.includes('login') && !u.includes('auth');
      }, { timeout: 300000 });

      state.stepStatus = 'running';
      state.message = '로그인 완료!';
      await page.waitForTimeout(3000);
    }

    if (state.cancelled) return;

    // 3) 사이트 등록
    state.message = '사이트 등록 중...';
    try {
      const siteInput = await page.$('input[placeholder*="URL"]') || await page.$('input[type="url"]') || await page.$('input[type="text"]');
      if (siteInput) {
        await siteInput.fill(blogUrl);
        await page.waitForTimeout(500);

        const addBtn = await page.$('button:has-text("등록")') || await page.$('button:has-text("추가")') || await page.$('button[type="submit"]');
        if (addBtn) {
          await addBtn.click();
          await page.waitForTimeout(5000);
        }
        results['사이트 등록'] = true;
      } else {
        results['사이트 등록'] = false;
      }
    } catch {
      results['사이트 등록'] = false;
    }

    if (state.cancelled) return;

    // 4) RSS 등록
    state.message = 'RSS 피드 등록 중...';
    try {
      // RSS 메뉴 탐색
      const rssLink = await page.$('a:has-text("RSS")') || await page.$('a[href*="rss"]');
      if (rssLink) {
        await rssLink.click();
        await page.waitForTimeout(3000);
      }

      const rssInput = await page.$('input[type="text"]') || await page.$('input[placeholder*="RSS"]');
      if (rssInput) {
        let rssUrl = blogUrl.endsWith('/') ? blogUrl : blogUrl + '/';
        if (blogUrl.includes('tistory.com')) {
          rssUrl += 'rss';
        } else if (blogUrl.includes('blogspot.com')) {
          rssUrl += 'feeds/posts/default?alt=rss';
        } else {
          rssUrl += 'feed';
        }

        await rssInput.fill(rssUrl);
        await page.waitForTimeout(500);

        const submitBtn = await page.$('button:has-text("등록")') || await page.$('button:has-text("확인")') || await page.$('button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
        }
        results['RSS 등록'] = true;
      } else {
        results['RSS 등록'] = false;
      }
    } catch {
      results['RSS 등록'] = false;
    }

    if (state.cancelled) return;

    // 5) 수집 요청
    state.message = '수집 요청 중...';
    try {
      const reqLink = await page.$('a:has-text("수집")') || await page.$('a[href*="request"]') || await page.$('a[href*="crawl"]');
      if (reqLink) {
        await reqLink.click();
        await page.waitForTimeout(3000);
      }

      const reqInput = await page.$('input[type="text"]');
      if (reqInput) {
        await reqInput.fill(blogUrl);
        await page.waitForTimeout(500);

        const reqBtn = await page.$('button:has-text("요청")') || await page.$('button:has-text("확인")') || await page.$('button[type="submit"]');
        if (reqBtn) {
          await reqBtn.click();
          await page.waitForTimeout(3000);
        }
        results['수집 요청'] = true;
      } else {
        results['수집 요청'] = false;
      }
    } catch {
      results['수집 요청'] = false;
    }

    state.results = results;
  }

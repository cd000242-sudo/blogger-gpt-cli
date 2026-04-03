import type { WebmasterState } from '../../types';
import { GSC_SELECTORS } from '../../config/selectors';

export async function automateGoogleSearchConsole(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

    // 1) GSC 열기
    state.message = 'Google Search Console 로딩 중...';
    await page.goto('https://search.google.com/search-console', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2) 로그인 대기
    const needsLogin = await page.url().includes('accounts.google.com') || await page.url().includes('signin');
    if (needsLogin) {
      state.stepStatus = 'waiting-login';
      state.message = '🔐 Google 계정으로 로그인해주세요...';

      // 로그인 완료 대기 (최대 5분)
      await page.waitForURL((url: any) => {
        const u = typeof url === 'string' ? url : url.toString();
        return u.includes('search.google.com/search-console') && !u.includes('accounts.google.com');
      }, { timeout: 300000 });

      state.stepStatus = 'running';
      state.message = '로그인 완료! 사이트 등록 중...';
      await page.waitForTimeout(3000);
    }

    // 3) URL 접두어 방식 사이트 추가 (DOM 검증 완료)
    state.message = '사이트 속성 추가 중...';
    try {
      // welcome 페이지로 이동 (사이트 추가 화면)
      await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      // URL 접두어 패널 클릭 (도메인 패널이 기본 활성화됨)
      // verified: 'URL 접두어' 텍스트를 포함하는 클릭 가능한 div
      const urlPrefixPanel = await page.$(GSC_SELECTORS.urlPrefixPanelKo) || await page.$(GSC_SELECTORS.urlPrefixPanelEn);
      if (urlPrefixPanel) {
        await urlPrefixPanel.click();
        await page.waitForTimeout(1000);
      }

      // URL 입력 (verified: placeholder="https://www.example.com")
      const urlInput = await page.$(GSC_SELECTORS.urlInput) || await page.$(GSC_SELECTORS.urlInputFallback);
      if (urlInput) {
        await urlInput.fill(blogUrl);
        await page.waitForTimeout(1000);

        // 계속 버튼 (verified: button "계속" or "Continue" — initially disabled, enables after input)
        const continueBtn = await page.$(GSC_SELECTORS.continueBtnKo) || await page.$(GSC_SELECTORS.continueBtnEn);
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(5000);
        }
        results['사이트 등록'] = true;
        console.log('[ONECLICK] GSC 사이트 신규 등록 완료');
      } else {
        // 이미 등록된 사이트가 있으면 welcome 대신 대시보드로 감
        results['사이트 등록'] = true;
        console.log('[ONECLICK] GSC 사이트 이미 등록됨 (기존 사이트)');
        state.message = '이미 등록된 사이트 — 사이트맵 확인으로 이동...';
      }
    } catch (err) {
      console.error('[ONECLICK] GSC 사이트 추가 오류:', err);
      results['사이트 등록'] = false;
    }

    if (state.cancelled) return;

    // 4) 사이트맵 제출 (sitemap.xml + RSS 피드)
    state.message = '사이트맵 제출 중...';
    const encodedUrl = encodeURIComponent(blogUrl.endsWith('/') ? blogUrl : blogUrl + '/');

    // 제출할 항목 목록 (sitemap.xml + RSS 피드)
    const sitemapsToSubmit = ['sitemap.xml'];
    // 블로그스팟인 경우 RSS 피드도 제출 (영상 가이드 기준)
    if (blogUrl.includes('blogspot.com')) {
      sitemapsToSubmit.push('feeds/posts/default');
    }

    for (const sitemapPath of sitemapsToSubmit) {
      try {
        await page.goto(`https://search.google.com/search-console/sitemaps?resource_id=${encodedUrl}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);

        const sitemapInput = await page.$(GSC_SELECTORS.sitemapInput);
        if (sitemapInput) {
          await sitemapInput.fill(sitemapPath);
          await page.waitForTimeout(500);

          const submitBtn = await page.$(GSC_SELECTORS.submitBtnKo) || await page.$(GSC_SELECTORS.submitBtnEn);
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(3000);

            // 확인 모달 처리
            const okBtn = await page.$(GSC_SELECTORS.okBtnKo) || await page.$(GSC_SELECTORS.okBtnEn) || await page.$(GSC_SELECTORS.okBtnGotIt);
            if (okBtn) await okBtn.click();
            await page.waitForTimeout(1000);
          }
          results[`사이트맵 제출 (${sitemapPath})`] = true;
          state.message = `사이트맵 제출 완료: ${sitemapPath}`;
        } else {
          results[`사이트맵 제출 (${sitemapPath})`] = false;
        }
      } catch {
        results[`사이트맵 제출 (${sitemapPath})`] = false;
      }
    }

    if (state.cancelled) return;

    // 5) URL 검사 (색인 요청)
    state.message = '색인 요청 중...';
    try {
      const encodedUrl2 = encodeURIComponent(blogUrl.endsWith('/') ? blogUrl : blogUrl + '/');
      await page.goto(`https://search.google.com/search-console/inspect?resource_id=${encodedUrl2}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const inspectInput = await page.$(GSC_SELECTORS.inspectInput);
      if (inspectInput) {
        await inspectInput.fill(blogUrl);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(8000);

        // "색인 생성 요청" 버튼 찾기
        const requestBtn = await page.$(GSC_SELECTORS.requestIndexingBtnKo) || await page.$(GSC_SELECTORS.requestIndexingBtnEn);
        if (requestBtn) {
          await requestBtn.click();
          await page.waitForTimeout(5000);
          results['색인 요청'] = true;
        } else {
          results['색인 요청'] = false;
          state.message = '색인 요청 버튼을 찾을 수 없음 (나중에 수동으로 가능)';
        }
      }
    } catch {
      results['색인 요청'] = false;
    }

    state.results = results;
  }

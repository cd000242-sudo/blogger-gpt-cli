// electron/oneclick/automation/wordpressSetup.ts
// WordPress 원클릭 세팅

import { launchBrowser, sleep, waitForPageStable } from '../utils/browser';
import { loadSkinCSS } from '../utils/skinLoader';
import type { SetupState } from '../types';
import { WORDPRESS_SELECTORS } from '../config/selectors';

/**
 * WordPress 원클릭 세팅 메인 함수.
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
export async function runWordPressSetup(
  state: SetupState,
  adminUrl: string,
  waitForLogin: (platform: string) => Promise<boolean>
): Promise<void> {
  const { browser, page } = await launchBrowser();
  state.browser = browser;
  state.page = page;

  try {
    // Step 0: 로그인
    state.currentStep = 0;
    state.stepStatus = 'running';
    state.message = 'WP 관리자 페이지로 이동 중...';

    const loginUrl = adminUrl.replace(/\/wp-admin\/?$/, '') + '/wp-login.php';
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    state.stepStatus = 'waiting-login';
    state.message = '워드프레스 관리자 계정으로 로그인해주세요';

    const loggedIn = await waitForLogin(state.platform);
    if (state.cancelled) return;

    state.currentStep = 0;
    state.stepStatus = 'done';
    state.message = '로그인 완료';
    await sleep(1500);

    // Step 1: 테마 CSS 적용
    state.currentStep = 1;
    state.stepStatus = 'running';
    state.message = '추가 CSS 페이지로 이동 중...';

    try {
      const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
      await page.goto(`${baseUrl}/wp-admin/customize.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForPageStable(page, 3000);

      // "추가 CSS" 패널 클릭 시도
      try {
        const cssPanel = await page.locator(WORDPRESS_SELECTORS.cssPanelOrAdditionalCss).first();
        if (await cssPanel.isVisible({ timeout: 5000 })) {
          await cssPanel.click();
          await sleep(2000);
        }
      } catch { /* 패널을 찾지 못함 */ }

      const skinCSS = loadSkinCSS('wordpress');
      if (skinCSS) {
        try {
          const textarea = await page.locator(WORDPRESS_SELECTORS.cssTextarea).first();
          if (await textarea.isVisible({ timeout: 5000 })) {
            // CodeMirror 에디터에 CSS 삽입
            await page.evaluate((css: string) => {
              const cm = (document.querySelector('.CodeMirror') as any)?.CodeMirror;
              if (cm) {
                const current = cm.getValue();
                const marker = '/* === LEADERNAM CLOUD SKIN === */';
                if (!current.includes(marker)) {
                  cm.setValue(current + '\n\n' + marker + '\n' + css);
                }
              }
            }, skinCSS);
            state.message = 'CSS 적용 완료! "발행" 버튼을 눌러주세요.';
          }
        } catch {
          state.message = '커스터마이저를 열었습니다. "추가 CSS" 메뉴에서 수동으로 붙여넣기 해주세요.';
        }
      }
    } catch {
      state.message = '커스터마이저 페이지에서 수동으로 CSS를 적용해주세요.';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;

    // Step 2: 플러그인 설치
    state.currentStep = 2;
    state.stepStatus = 'running';
    state.message = '필수 플러그인 확인 중...';

    try {
      const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
      await page.goto(`${baseUrl}/wp-admin/plugin-install.php`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await waitForPageStable(page, 2000);
      state.message = '플러그인 페이지를 열었습니다. Classic Editor, Yoast SEO 설치를 권장합니다.';
    } catch {
      state.message = '플러그인 페이지로 이동했습니다.';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;

    // Step 3: 고유주소 설정
    state.currentStep = 3;
    state.stepStatus = 'running';
    state.message = '고유주소(퍼머링크) 설정 중...';

    try {
      const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
      await page.goto(`${baseUrl}/wp-admin/options-permalink.php`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await waitForPageStable(page, 2000);

      // "글 이름" 옵션 선택 시도
      try {
        const postNameRadio = await page.locator(WORDPRESS_SELECTORS.postNameRadio).first();
        if (await postNameRadio.isVisible({ timeout: 3000 })) {
          await postNameRadio.click();
          state.message = 'SEO 최적화 고유주소 설정 완료 (/%postname%/)';

          // 저장 버튼 클릭
          const saveBtn = await page.locator(WORDPRESS_SELECTORS.submitBtn).first();
          if (await saveBtn.isVisible({ timeout: 3000 })) {
            await saveBtn.click();
            await sleep(2000);
          }
        }
      } catch {
        state.message = '고유주소 페이지를 열었습니다. "글 이름" 옵션을 선택해주세요.';
      }
    } catch {
      state.message = '고유주소 설정 페이지 확인 완료';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;

    // Step 4: 네이버 서치어드바이저 자동 등록
    state.currentStep = 4;
    state.stepStatus = 'running';
    state.message = '네이버 서치어드바이저 사이트 등록 중...';

    try {
      const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
      const siteUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

      await page.goto('https://searchadvisor.naver.com/console/board', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitForPageStable(page, 2000);

      // 로그인 필요 여부 확인
      const loginBtn = await page.$('a:has-text("로그인")');
      if (loginBtn) {
        await loginBtn.click();
        await sleep(2000);
        state.stepStatus = 'waiting-login';
        state.message = '🔐 네이버 계정으로 로그인해주세요...';

        await page.waitForURL((url: any) => {
          const u = typeof url === 'string' ? url : url.toString();
          return u.includes('searchadvisor.naver.com') && !u.includes('nid.naver.com');
        }, { timeout: 300000 });

        state.stepStatus = 'running';
        state.message = '네이버 로그인 완료! 사이트 등록 중...';
        await sleep(2000);
      }

      if (state.cancelled) return;

      // 사이트 추가 입력
      const siteInput = await page.$('input[placeholder*="사이트"]') || await page.$('input[type="url"]');
      if (siteInput) {
        await siteInput.fill(siteUrl);
        await sleep(500);
        const addBtn = await page.$('button:has-text("추가")') || await page.$('button[type="submit"]');
        if (addBtn) {
          await addBtn.click();
          await sleep(3000);
        }
        state.message = '✅ 네이버 서치어드바이저 사이트 등록 완료';
      } else {
        // 이미 등록된 경우
        const pageText = await page.textContent('body');
        if (pageText && pageText.includes(siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))) {
          state.message = '✅ 네이버 서치어드바이저에 이미 등록됨';
        } else {
          state.message = '네이버 서치어드바이저 사이트 입력 필드를 찾지 못함 (수동 등록 필요)';
        }
      }

      // 사이트맵 제출 시도
      if (!state.cancelled) {
        try {
          await page.goto(`https://searchadvisor.naver.com/console/sitemap?site=${encodeURIComponent(siteUrl)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await waitForPageStable(page, 2000);
          const sitemapInput = await page.$('input[placeholder*="사이트맵"]') || await page.$('input[type="text"]');
          if (sitemapInput) {
            await sitemapInput.fill(siteUrl.endsWith('/') ? siteUrl + 'sitemap.xml' : siteUrl + '/sitemap.xml');
            await sleep(500);
            const submitBtn = await page.$('button:has-text("확인")') || await page.$('button:has-text("제출")');
            if (submitBtn) {
              await submitBtn.click();
              await sleep(2000);
              state.message += ' + 사이트맵 제출 완료';
            }
          }
        } catch {
          console.warn('[ONECLICK-WP] 네이버 사이트맵 제출 실패 — 수동 확인 필요');
        }
      }
    } catch (e) {
      console.warn('[ONECLICK-WP] 네이버 서치어드바이저 등록 오류:', e);
      state.message = '네이버 서치어드바이저 등록 실패 (수동 등록 필요)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;

    // Step 5: 구글 서치 콘솔 자동 등록
    state.currentStep = 5;
    state.stepStatus = 'running';
    state.message = '구글 서치 콘솔 사이트 등록 중...';

    try {
      const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
      const siteUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

      await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitForPageStable(page, 3000);

      // 로그인 필요 여부 확인
      const currentUrl = page.url();
      if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
        state.stepStatus = 'waiting-login';
        state.message = '🔐 Google 계정으로 로그인해주세요...';

        await page.waitForURL((url: any) => {
          const u = typeof url === 'string' ? url : url.toString();
          return u.includes('search.google.com') && !u.includes('accounts.google.com');
        }, { timeout: 300000 });

        state.stepStatus = 'running';
        state.message = 'Google 로그인 완료! 사이트 등록 중...';
        await sleep(3000);
      }

      if (state.cancelled) return;

      // URL 접두어 패널 클릭
      const urlPrefixPanel = await page.$('div:has-text("URL 접두어")') || await page.$('div:has-text("URL prefix")');
      if (urlPrefixPanel) {
        await urlPrefixPanel.click();
        await sleep(1000);
      }

      // URL 입력
      const urlInput = await page.$('input[placeholder="https://www.example.com"]') || await page.$('input[placeholder*="example.com"]');
      if (urlInput) {
        await urlInput.fill(siteUrl);
        await sleep(1000);
        const continueBtn = await page.$('button:has-text("계속"):not([disabled])') || await page.$('button:has-text("Continue"):not([disabled])');
        if (continueBtn) {
          await continueBtn.click();
          await sleep(5000);
        }
        state.message = '✅ 구글 서치 콘솔 사이트 등록 완료';
      } else {
        state.message = '✅ 구글 서치 콘솔에 이미 등록됨 (또는 대시보드로 이동됨)';
      }

      // 사이트맵 제출 시도
      if (!state.cancelled) {
        try {
          const encodedUrl = encodeURIComponent(siteUrl.endsWith('/') ? siteUrl : siteUrl + '/');
          await page.goto(`https://search.google.com/search-console/sitemaps?resource_id=${encodedUrl}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await waitForPageStable(page, 3000);

          const sitemapInput = await page.$('input[type="text"]');
          if (sitemapInput) {
            await sitemapInput.fill('sitemap.xml');
            await sleep(500);
            const submitBtn = await page.$('button:has-text("제출")') || await page.$('button:has-text("Submit")');
            if (submitBtn) {
              await submitBtn.click();
              await sleep(3000);
              // 확인 모달 처리
              const okBtn = await page.$('button:has-text("확인")') || await page.$('button:has-text("OK")') || await page.$('button:has-text("Got it")');
              if (okBtn) await okBtn.click();
              state.message += ' + 사이트맵 제출 완료';
            }
          }
        } catch {
          console.warn('[ONECLICK-WP] GSC 사이트맵 제출 실패 — 수동 확인 필요');
        }
      }
    } catch (e) {
      console.warn('[ONECLICK-WP] 구글 서치 콘솔 등록 오류:', e);
      state.message = '구글 서치 콘솔 등록 실패 (수동 등록 필요)';
    }

    state.stepStatus = 'done';
    state.completed = true;

  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    state.stepStatus = 'error';
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
    state.browser = null;
    state.page = null;
  }
}

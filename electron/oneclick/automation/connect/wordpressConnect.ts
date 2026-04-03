// @ts-nocheck
import type { ConnectState } from '../../types';

export async function automateWordPressConnect(state: ConnectState, page: any, siteUrl: string): Promise<void> {
  const results: Record<string, string> = {};

  // 1) WP 로그인 페이지
  state.message = 'WordPress 로그인 페이지로 이동 중...';
  const baseUrl = siteUrl.replace(/\/wp-admin\/?$/, '').replace(/\/$/, '');
  await page.goto(`${baseUrl}/wp-login.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 2) 로그인 대기
  const needsLogin = !(await page.url()).includes('wp-admin');
  if (needsLogin) {
    state.stepStatus = 'waiting-login';
    state.message = '🔐 워드프레스 관리자 계정으로 로그인해주세요...';

    await page.waitForURL((url: any) => {
      const u = typeof url === 'string' ? url : url.toString();
      return u.includes('wp-admin') && !u.includes('wp-login');
    }, { timeout: 300000 });

    state.stepStatus = 'running';
    state.message = '로그인 완료! Application Password 생성 중...';
    await page.waitForTimeout(2000);
  }

  if (state.cancelled) return;

  // 3) 사이트 URL 저장
  results['wordpressSiteUrl'] = baseUrl;

  // 4) 사용자명 추출
  state.message = '사용자명 추출 중...';
  try {
    // WP Admin Bar에서 사용자명 추출
    const username = await page.evaluate(() => {
      // 방법1: admin bar
      const adminBar = document.querySelector('#wp-admin-bar-my-account .display-name');
      if (adminBar) return (adminBar as HTMLElement).textContent?.trim() || '';
      // 방법2: body class에서 추출
      const bodyClass = document.body.className;
      const match = bodyClass.match(/user-(\S+)/);
      if (match) return match[1];
      // 방법3: 프로필 페이지에서 추출 (fallback)
      return '';
    });
    if (username) {
      results['wordpressUsername'] = username;
    }
  } catch { /* ignore */ }

  if (state.cancelled) return;

  // 5) 프로필 페이지로 이동
  state.message = '프로필 페이지로 이동 중...';
  await page.goto(`${baseUrl}/wp-admin/profile.php`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // username이 아직 없으면 프로필 페이지에서 추출
  if (!results['wordpressUsername']) {
    try {
      const profileUsername = await page.evaluate(() => {
        const el = document.querySelector('#user_login') as HTMLInputElement;
        return el?.value || '';
      });
      if (profileUsername) results['wordpressUsername'] = profileUsername;
    } catch { /* ignore */ }
  }

  if (state.cancelled) return;

  // 6) Application Password 생성
  state.message = 'Application Password 생성 중...';
  try {
    // Application Password 섹션으로 스크롤
    await page.evaluate(() => {
      const section = document.querySelector('#application-passwords-section') || document.querySelector('.application-passwords');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(1000);

    // 앱 이름 입력
    const nameInput = await page.$('#new_application_password_name');
    if (!nameInput) {
      throw new Error('Application Password 입력 필드를 찾을 수 없습니다. WordPress 5.6+ 이상이 필요합니다.');
    }

    await nameInput.fill('리더남 블로거 GPT');
    await page.waitForTimeout(500);

    // "Add New Application Password" 버튼 클릭
    const addBtn = await page.$('#do_new_application_password');
    if (!addBtn) {
      throw new Error('Application Password 추가 버튼을 찾을 수 없습니다.');
    }

    await addBtn.click();
    await page.waitForTimeout(3000);

    // 생성된 비밀번호 추출
    const password = await page.evaluate(() => {
      // WordPress는 생성 후 .new-application-password 또는 code 요소에 표시
      const pwEl = document.querySelector('.new-application-password code') ||
                   document.querySelector('#new-application-password-value') ||
                   document.querySelector('.notice.notice-success code') ||
                   document.querySelector('.application-password-display input');
      if (pwEl) {
        const val = (pwEl as HTMLInputElement).value || (pwEl as HTMLElement).textContent;
        return val?.trim() || '';
      }
      return '';
    });

    if (password) {
      results['wordpressPassword'] = password;
      state.message = `✅ Application Password 생성 완료! (${password.substring(0, 8)}...)`;
    } else {
      // 다시 시도 — 일부 WP 테마에서는 다른 위치에 표시
      await page.waitForTimeout(2000);
      const password2 = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[readonly], input.code');
        for (const input of inputs) {
          const val = (input as HTMLInputElement).value;
          if (val && val.length > 16) return val.trim();
        }
        const codes = document.querySelectorAll('code');
        for (const code of codes) {
          const text = code.textContent?.trim();
          if (text && text.length > 16) return text;
        }
        return '';
      });

      if (password2) {
        results['wordpressPassword'] = password2;
        state.message = `✅ Application Password 생성 완료!`;
      } else {
        state.message = '⚠️ 비밀번호가 생성되었지만 자동 추출에 실패했습니다. 화면에 표시된 코드를 직접 복사해주세요.';
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    state.message = `⚠️ Application Password 생성 실패: ${errMsg}`;
    state.error = errMsg;
  }

  state.results = results;
}

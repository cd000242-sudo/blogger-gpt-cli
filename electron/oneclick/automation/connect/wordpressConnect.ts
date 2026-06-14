import type { ConnectState } from '../../types';
import { WORDPRESS_SELECTORS } from '../../config/selectors';

const WORDPRESS_MANUAL_TIMEOUT_MS = 15 * 60 * 1000;
const WORDPRESS_POLL_MS = 2000;

function blockForManualAction(
  state: ConnectState,
  currentStep: number,
  message: string,
  results: Record<string, string>,
): void {
  state.currentStep = currentStep;
  state.stepStatus = 'waiting-login';
  state.results = results;
  state.error = null;
  state.message = message;
}

function normalizeWordPressSiteUrl(siteUrl: string): string {
  return String(siteUrl || '')
    .trim()
    .replace(/\/wp-admin\/?$/, '')
    .replace(/\/wp-login\.php.*$/, '')
    .replace(/\/$/, '');
}

async function waitForReadablePage(page: any, timeout = 30000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeout) {
    const ready = await page.evaluate(() => {
      const text = (document.body?.innerText || '').trim();
      return document.readyState !== 'loading' && text.length > 20;
    }).catch(() => false);
    if (ready) return true;
    await page.waitForTimeout(1000).catch(() => {});
  }
  return false;
}

async function waitForWordPressAdmin(state: ConnectState, page: any, baseUrl: string): Promise<boolean> {
  const startedAt = Date.now();
  let recoveredBlankPage = false;
  while (!state.cancelled && Date.now() - startedAt <= WORDPRESS_MANUAL_TIMEOUT_MS) {
    const url = String(page.url() || '');
    if (url.includes('/wp-admin') && !url.includes('wp-login')) {
      state.stepStatus = 'running';
      return true;
    }

    const readable = await waitForReadablePage(page, 3000);
    if (!readable && !recoveredBlankPage) {
      recoveredBlankPage = true;
      await page.goto(`${baseUrl}/wp-login.php`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }

    state.stepStatus = 'waiting-login';
    state.message = 'WordPress 관리자 로그인 화면에서 로그인, 2단계 인증, CAPTCHA를 완료해주세요. 완료되면 앱이 자동으로 다음 단계로 넘어갑니다.';
    await page.waitForTimeout(WORDPRESS_POLL_MS).catch(() => {});
  }
  return false;
}

async function extractWordPressUsername(page: any): Promise<string> {
  return await page.evaluate(() => {
    const adminBar = document.querySelector('#wp-admin-bar-my-account .display-name');
    if (adminBar) return (adminBar as HTMLElement).textContent?.trim() || '';

    const userLogin = document.querySelector('#user_login') as HTMLInputElement | null;
    if (userLogin?.value) return userLogin.value.trim();

    const bodyClass = document.body?.className || '';
    const match = bodyClass.match(/user-(\S+)/);
    if (match) return match[1];
    return '';
  }).catch(() => '');
}

async function waitForProfileReady(state: ConnectState, page: any, baseUrl: string): Promise<boolean> {
  const startedAt = Date.now();
  while (!state.cancelled && Date.now() - startedAt <= WORDPRESS_MANUAL_TIMEOUT_MS) {
    await page.goto(`${baseUrl}/wp-admin/profile.php`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await waitForReadablePage(page, 15000);

    const ready = await page.evaluate(() => {
      return Boolean(
        document.querySelector('#profile-page') ||
        document.querySelector('#user_login') ||
        document.querySelector('#application-passwords-section') ||
        document.querySelector('.application-passwords')
      );
    }).catch(() => false);
    if (ready) return true;

    state.stepStatus = 'waiting-login';
    state.message = 'WordPress 프로필 화면을 여는 중입니다. 권한 확인이나 보안 플러그인 확인 화면이 나오면 직접 완료해주세요.';
    await page.waitForTimeout(WORDPRESS_POLL_MS).catch(() => {});
  }
  return false;
}

async function waitForApplicationPasswordSection(state: ConnectState, page: any, results: Record<string, string>): Promise<boolean> {
  const startedAt = Date.now();
  while (!state.cancelled && Date.now() - startedAt <= WORDPRESS_MANUAL_TIMEOUT_MS) {
    const found = await page.evaluate(() => {
      const section = document.querySelector('#application-passwords-section') || document.querySelector('.application-passwords');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    }).catch(() => false);
    if (found) return true;

    state.stepStatus = 'waiting-login';
    state.results = results;
    state.message = 'Application Passwords 영역을 찾는 중입니다. WordPress 5.6 이상, HTTPS, 관리자 권한, 보안 플러그인 차단 여부를 확인해주세요.';
    await page.waitForTimeout(WORDPRESS_POLL_MS).catch(() => {});
  }
  return false;
}

async function extractGeneratedApplicationPassword(page: any): Promise<string> {
  return await page.evaluate(() => {
    const pwEl = document.querySelector('.new-application-password code') ||
      document.querySelector('#new-application-password-value') ||
      document.querySelector('.notice.notice-success code') ||
      document.querySelector('.application-password-display input');
    if (pwEl) {
      const val = (pwEl as HTMLInputElement).value || (pwEl as HTMLElement).textContent;
      return val?.trim() || '';
    }

    const inputs = Array.from(document.querySelectorAll('input[readonly], input.code')) as HTMLInputElement[];
    for (const input of inputs) {
      const val = input.value;
      if (val && val.length > 16) return val.trim();
    }
    const codes = Array.from(document.querySelectorAll('code'));
    for (const code of codes) {
      const text = code.textContent?.trim();
      if (text && text.length > 16) return text;
    }
    return '';
  }).catch(() => '');
}

async function waitForGeneratedApplicationPassword(state: ConnectState, page: any, results: Record<string, string>): Promise<string> {
  const startedAt = Date.now();
  while (!state.cancelled && Date.now() - startedAt <= 2 * 60 * 1000) {
    const password = await extractGeneratedApplicationPassword(page);
    if (password) return password;
    state.stepStatus = 'waiting-login';
    state.results = results;
    state.message = 'Application Password 생성 결과를 기다리는 중입니다. 생성된 비밀번호가 화면에 보이면 앱이 자동으로 복사합니다.';
    await page.waitForTimeout(WORDPRESS_POLL_MS).catch(() => {});
  }
  return '';
}

export async function automateWordPressConnect(state: ConnectState, page: any, siteUrl: string): Promise<void> {
  const results: Record<string, string> = {};
  state.totalSteps = 7;

  // 1) WP 로그인 페이지
  state.currentStep = 1;
  state.message = 'WordPress 로그인 페이지로 이동 중...';
  const baseUrl = normalizeWordPressSiteUrl(siteUrl);
  await page.goto(`${baseUrl}/wp-login.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForReadablePage(page, 30000);

  // 2) 로그인 대기
  const needsLogin = !(await page.url()).includes('wp-admin');
  if (needsLogin) {
    state.stepStatus = 'waiting-login';
    state.message = '🔐 워드프레스 관리자 계정으로 로그인해주세요...';

    const loggedIn = await waitForWordPressAdmin(state, page, baseUrl);
    if (!loggedIn) {
      blockForManualAction(
        state,
        1,
        'WordPress 관리자 로그인을 확인하지 못했습니다. 열린 브라우저에서 로그인/2단계 인증/CAPTCHA를 완료한 뒤 다시 시도해주세요.',
        results,
      );
      return;
    }

    state.stepStatus = 'running';
    state.message = '로그인 완료! Application Password 생성 중...';
    await page.waitForTimeout(2000);
  }

  if (state.cancelled) return;

  // 3) 사이트 URL 저장
  state.currentStep = 2;
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
  state.currentStep = 3;
  state.message = '프로필 페이지로 이동 중...';
  const profileReady = await waitForProfileReady(state, page, baseUrl);
  if (!profileReady) {
    blockForManualAction(
      state,
      3,
      'WordPress 프로필 화면을 확인하지 못했습니다. 관리자 권한/보안 플러그인 확인을 완료한 뒤 다시 시도해주세요.',
      results,
    );
    return;
  }

  // username이 아직 없으면 프로필 페이지에서 추출
  if (!results['wordpressUsername']) {
    const profileUsername = await extractWordPressUsername(page);
    if (profileUsername) results['wordpressUsername'] = profileUsername;
  }

  if (!results['wordpressUsername']) {
    blockForManualAction(
      state,
      3,
      'WordPress 사용자명을 자동으로 확인하지 못했습니다. 프로필 화면의 사용자명 값을 앱 입력칸에 직접 저장해주세요.',
      results,
    );
    return;
  }

  if (state.cancelled) return;

  // 6) Application Password 생성
  state.currentStep = 4;
  state.message = 'Application Password 생성 중...';
  try {
    // Application Password 섹션으로 스크롤
    const hasAppPasswordSection = await waitForApplicationPasswordSection(state, page, results);
    if (!hasAppPasswordSection) {
      blockForManualAction(
        state,
        4,
        'Application Passwords 영역을 찾지 못했습니다. WordPress 5.6 이상, HTTPS, 관리자 권한, 보안 플러그인 차단 여부를 확인해주세요.',
        results,
      );
      return;
    }

    // 앱 이름 입력
    const nameInput = await page.$(WORDPRESS_SELECTORS.newAppPasswordNameInput);
    if (!nameInput) {
      blockForManualAction(
        state,
        4,
        'Application Password 이름 입력칸을 찾지 못했습니다. 프로필 화면 하단에서 Application Passwords 영역이 열려 있는지 확인해주세요.',
        results,
      );
      return;
    }
    if (!nameInput) {
      throw new Error('Application Password 입력 필드를 찾을 수 없습니다. WordPress 5.6+ 이상이 필요합니다.');
    }

    await nameInput.fill('리더남 블로거 GPT');
    await page.waitForTimeout(500);

    // "Add New Application Password" 버튼 클릭
    const addBtn = await page.$(WORDPRESS_SELECTORS.addNewAppPasswordBtn);
    if (!addBtn) {
      blockForManualAction(
        state,
        4,
        'Application Password 추가 버튼을 찾지 못했습니다. 버튼이 보이면 직접 누르거나, 보안 플러그인/권한 설정을 확인해주세요.',
        results,
      );
      return;
    }
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
        const inputs = Array.from(document.querySelectorAll('input[readonly], input.code'));
        for (const input of inputs) {
          const val = (input as HTMLInputElement).value;
          if (val && val.length > 16) return val.trim();
        }
        const codes = Array.from(document.querySelectorAll('code'));
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

    if (!results['wordpressPassword']) {
      const watchedPassword = await waitForGeneratedApplicationPassword(state, page, results);
      if (watchedPassword) {
        results['wordpressPassword'] = watchedPassword;
        state.message = 'Application Password 생성 완료!';
      } else {
        blockForManualAction(
          state,
          4,
          'Application Password가 생성됐지만 자동 추출하지 못했습니다. 화면에 보이는 비밀번호를 앱 입력칸에 직접 붙여넣고 저장해주세요.',
          results,
        );
        return;
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    state.message = `⚠️ Application Password 생성 실패: ${errMsg}`;
    state.error = errMsg;
  }

  state.currentStep = 6;
  state.results = results;
}

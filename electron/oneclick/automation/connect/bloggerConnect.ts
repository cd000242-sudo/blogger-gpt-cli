import type { ConnectState } from '../../types';
import { GCP_SELECTORS } from '../../config/selectors';

const GOOGLE_AUTH_AUDIENCE_URL = 'https://console.cloud.google.com/auth/audience';
const MANUAL_ACTION_TIMEOUT_MS = 15 * 60 * 1000;
const PAGE_READY_POLL_MS = 2000;

function blockForManualAction(
  state: ConnectState,
  currentStep: number,
  message: string,
  results: Record<string, string>,
): void {
  state.currentStep = currentStep;
  state.stepStatus = 'waiting-login';
  state.results = results;
  state.error = message;
  state.message = message;
}

function isGoogleLoginUrl(url: string): boolean {
  return /accounts\.google\.com|signin/i.test(url || '');
}

async function waitForGoogleConsoleReady(state: ConnectState, page: any): Promise<boolean> {
  const startedAt = Date.now();

  while (!state.cancelled && Date.now() - startedAt <= MANUAL_ACTION_TIMEOUT_MS) {
    let url = '';
    try {
      url = page.url();
    } catch {
      url = '';
    }

    if (isGoogleLoginUrl(url)) {
      state.stepStatus = 'waiting-login';
      state.message = '🔐 Google 계정 로그인/2단계 인증/CAPTCHA를 완료해주세요. 완료 전에는 다음 단계로 넘어가지 않습니다.';
    } else if (/console\.cloud\.google\.com/i.test(url)) {
      const ready = await page.evaluate(() => {
        const text = (document.body?.innerText || '').trim();
        return document.readyState !== 'loading' && text.length > 0;
      }).catch(() => false);

      if (ready) {
        state.stepStatus = 'running';
        return true;
      }

      state.stepStatus = 'waiting-login';
      state.message = 'Google Cloud Console 화면이 아직 완전히 뜨지 않았습니다. 화면 로딩이 끝날 때까지 기다립니다.';
    } else {
      state.stepStatus = 'waiting-login';
      state.message = 'Google Cloud Console 창이 아직 준비되지 않았습니다. 열린 브라우저 창을 확인해주세요.';
    }

    await page.waitForTimeout(PAGE_READY_POLL_MS);
  }

  return false;
}

async function clickFirstVisible(page: any, selectors: string[], timeout = 2500): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout })) {
        await locator.click();
        return true;
      }
    } catch { /* try next selector */ }
  }
  return false;
}

async function getCurrentGoogleAccountEmail(page: any): Promise<string> {
  try {
    const emails = await page.evaluate(() => {
      const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
      const values = [
        document.body?.innerText || '',
        ...Array.from(document.querySelectorAll('[aria-label], [title], [data-email]')).map((el) => [
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || '',
          el.getAttribute('data-email') || '',
          el.textContent || '',
        ].join(' ')),
      ];
      return values
        .flatMap((value) => value.match(emailPattern) || [])
        .map((email) => email.toLowerCase())
        .filter((email, index, arr) => arr.indexOf(email) === index)
        .filter((email) => !email.includes('gserviceaccount.com') && !email.includes('example.com'));
    });
    return emails?.[0] || '';
  } catch {
    return '';
  }
}

async function addOAuthTestUserIfPossible(state: ConnectState, page: any, email: string): Promise<boolean> {
  if (!email) {
    state.message = 'OAuth 테스트 사용자 이메일을 자동 확인하지 못했습니다. [테스트 사용자] 화면에서 로그인한 Gmail을 직접 추가해주세요.';
    return false;
  }

  try {
    state.message = `OAuth 테스트 사용자 등록 확인 중: ${email}`;
    await page.goto(GOOGLE_AUTH_AUDIENCE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);

    const alreadyAdded = await page.evaluate((targetEmail: string) => {
      return (document.body?.innerText || '').toLowerCase().includes(targetEmail.toLowerCase());
    }, email);
    if (alreadyAdded) {
      state.message = `✅ OAuth 테스트 사용자에 ${email} 계정이 이미 등록되어 있습니다.`;
      return true;
    }

    const opened = await clickFirstVisible(page, [
      'button:has-text("사용자 추가")',
      'button:has-text("테스트 사용자 추가")',
      'button:has-text("Add users")',
      'button:has-text("ADD USERS")',
      'button:has-text("Add user")',
      'button:has-text("Add")',
    ], 4000);

    if (!opened) {
      state.message = `OAuth 테스트 사용자 추가 버튼을 찾지 못했습니다. Google Cloud의 Audience/Test users 화면에서 ${email} 계정을 직접 추가해주세요.`;
      return false;
    }

    await page.waitForTimeout(1500);
    const input = page.locator([
      'textarea',
      'input[type="email"]',
      'input[aria-label*="email"]',
      'input[aria-label*="Email"]',
      'input[aria-label*="이메일"]',
      'input[type="text"]',
      '[contenteditable="true"]',
    ].join(', ')).last();
    await input.fill(email).catch(async () => {
      await input.click();
      await page.keyboard.type(email);
    });
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(700);

    const saved = await clickFirstVisible(page, [
      'button:has-text("저장")',
      'button:has-text("Save")',
      'button:has-text("SAVE")',
      'button:has-text("추가")',
      'button:has-text("Add")',
    ], 4000);

    if (!saved) {
      state.message = `OAuth 테스트 사용자 이메일은 입력했습니다. Google Cloud 화면에서 저장 버튼을 눌러 ${email} 계정을 등록해주세요.`;
      return false;
    }

    await page.waitForTimeout(2500);
    state.message = `✅ OAuth 테스트 사용자 등록을 확인했습니다: ${email}`;
    return true;
  } catch {
    state.message = `OAuth 테스트 사용자 자동 등록을 완료하지 못했습니다. Google Cloud의 Audience/Test users 화면에서 ${email} 계정을 직접 추가해주세요.`;
    return false;
  }
}

export async function automateBloggerConnect(state: ConnectState, page: any): Promise<void> {
  const results: Record<string, string> = {};
  state.totalSteps = 9;

  // 1) GCP Console 이동
  state.currentStep = 0;
  state.message = 'Google Cloud Console로 이동 중...';
  await page.goto('https://console.cloud.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const consoleReady = await waitForGoogleConsoleReady(state, page);
  if (!consoleReady) {
    blockForManualAction(
      state,
      0,
      '⚠️ Google Cloud Console 창 준비를 확인하지 못했습니다. 열린 브라우저에서 로그인/로딩을 완료한 뒤 원클릭을 다시 시작해주세요.',
      results,
    );
    return;
  }

  // 2) 로그인 확인
  const needsLogin = (await page.url()).includes('accounts.google.com') || (await page.url()).includes('signin');
  if (needsLogin) {
    state.stepStatus = 'waiting-login';
    state.message = '🔐 Google 계정으로 로그인해주세요...';

    await page.waitForURL((url: any) => {
      const u = typeof url === 'string' ? url : url.toString();
      return u.includes('console.cloud.google.com') && !u.includes('accounts.google.com');
    }, { timeout: 300000 });

    state.stepStatus = 'running';
    state.message = '로그인 완료! GCP 프로젝트 설정 중...';
    await page.waitForTimeout(3000);
  }

  if (state.cancelled) return;

  // 3) 프로젝트 생성 (blogger-gpt 이름으로)
  state.currentStep = 1;
  state.message = '프로젝트 확인 중...';
  try {
    // 프로젝트 셀렉터에서 현재 프로젝트 이름 확인
    await page.waitForTimeout(2000);

    // 새 프로젝트 생성 페이지로 이동
    await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // 프로젝트 이름 입력
    const projectNameInput = await page.$(GCP_SELECTORS.projectNameInput);
    if (projectNameInput) {
      await projectNameInput.fill('blogger-gpt-app');
      await page.waitForTimeout(1000);

      // 만들기 버튼
      const createBtn = await page.$(GCP_SELECTORS.createBtnKo) || await page.$(GCP_SELECTORS.createBtnEn) || await page.$(GCP_SELECTORS.createBtnEn2);
      if (createBtn) {
        await createBtn.click();
        state.message = '프로젝트 생성 중... (30초 소요)';
        await page.waitForTimeout(15000);
      }
    } else {
      state.message = '프로젝트 이름 필드를 찾지 못했습니다. 기존 프로젝트를 사용합니다.';
      await page.waitForTimeout(2000);
    }
  } catch {
    state.message = '기존 프로젝트를 사용합니다.';
    await page.waitForTimeout(1000);
  }

  if (state.cancelled) return;

  // 4) Blogger API 활성화
  state.currentStep = 2;
  state.message = 'Blogger API 활성화 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/library/blogger.googleapis.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "사용" 또는 "ENABLE" 버튼
    const enableBtn = await page.$(GCP_SELECTORS.enableBtnKo) || await page.$(GCP_SELECTORS.enableBtnEn) || await page.$(GCP_SELECTORS.enableBtnEn2);
    if (enableBtn) {
      const isDisabled = await enableBtn.getAttribute('disabled');
      if (!isDisabled) {
        await enableBtn.click();
        state.message = 'Blogger API 활성화 완료!';
        await page.waitForTimeout(5000);
      } else {
        state.message = 'Blogger API가 이미 활성화되어 있습니다.';
      }
    } else {
      // 이미 활성화된 경우 "관리" 또는 "MANAGE" 버튼이 표시됨
      const manageBtn = await page.$(GCP_SELECTORS.manageBtnKo) || await page.$(GCP_SELECTORS.manageBtnEn) || await page.$(GCP_SELECTORS.manageBtnEn2);
      if (manageBtn) {
        state.message = 'Blogger API가 이미 활성화되어 있습니다.';
      } else {
        state.message = '⚠️ Blogger API 활성화 버튼이 비활성(회색) 상태일 수 있습니다 — GCP 결제 계정이 프로젝트에 연결돼 있는지 확인하세요. console.cloud.google.com/billing 에서 결제 계정을 연결한 뒤 다시 시도해 주세요.';
      }
    }
  } catch (e) {
    state.message = 'Blogger API 페이지 로딩 실패 — console.cloud.google.com/apis/library/blogger.googleapis.com 을 직접 열어 [사용] 버튼을 눌러주세요.';
  }

  if (state.cancelled) return;

  // 5) OAuth 동의 화면 구성
  state.currentStep = 3;
  state.message = 'OAuth 동의 화면 구성 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/credentials/consent', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "외부" (External) 선택 후 만들기
    const externalRadio = await page.$(GCP_SELECTORS.externalRadio);
    if (externalRadio) {
      await externalRadio.click();
      await page.waitForTimeout(1000);

      const createBtn = await page.$(GCP_SELECTORS.createBtnKo) || await page.$(GCP_SELECTORS.createBtnEn) || await page.$(GCP_SELECTORS.createBtnEn2);
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(5000);

        // 앱 이름 입력
        const appNameInput = await page.$(GCP_SELECTORS.appNameInput);
        if (appNameInput) {
          await appNameInput.fill('Blogger GPT');
          await page.waitForTimeout(500);
        }

        // 사용자 지원 이메일 — 이미 채워져 있을 수 있음
        // 저장 버튼
        const saveBtn = await page.$(GCP_SELECTORS.saveAndContinueBtnKo) || await page.$(GCP_SELECTORS.saveAndContinueBtnEn) || await page.$(GCP_SELECTORS.saveAndContinueBtnEn2);
        if (saveBtn) {
          await saveBtn.click();
          await page.waitForTimeout(3000);
          // 범위 단계 — 건너뛰기
          const skipBtn = await page.$(GCP_SELECTORS.saveAndContinueBtnKo) || await page.$(GCP_SELECTORS.saveAndContinueBtnEn);
          if (skipBtn) {
            await skipBtn.click();
            await page.waitForTimeout(2000);
          }
          // 테스트 사용자 단계 — 초보자 차단 방지를 위해 현재 로그인 계정을 추가 시도
          const skipBtn2 = await page.$(GCP_SELECTORS.saveAndContinueBtnKo) || await page.$(GCP_SELECTORS.saveAndContinueBtnEn);
          if (skipBtn2) {
            const email = await getCurrentGoogleAccountEmail(page);
            const added = await addOAuthTestUserIfPossible(state, page, email);
            if (!added) {
              blockForManualAction(
                state,
                4,
                '⚠️ OAuth 테스트 사용자 등록이 확인되지 않았습니다. Google Cloud의 Audience/Test users 화면에서 로그인한 Gmail을 추가하고 저장한 뒤 다시 진행해주세요.',
                results,
              );
              return;
            }
            await skipBtn2.click().catch(() => {});
            await page.waitForTimeout(2000);
          }
        }
      }
    } else {
      state.message = 'OAuth 동의 화면이 이미 구성되어 있습니다.';
    }
  } catch {
    state.message = 'OAuth 동의 화면 구성을 건너뜁니다 (이미 설정된 경우 정상).';
  }

  if (state.cancelled) return;

  // 6) OAuth 테스트 사용자 보강
  state.currentStep = 4;
  try {
    const email = await getCurrentGoogleAccountEmail(page);
    const added = await addOAuthTestUserIfPossible(state, page, email);
    if (!added) {
      blockForManualAction(
        state,
        4,
        '⚠️ OAuth 테스트 사용자 등록을 확인하지 못했습니다. Audience/Test users에 현재 Gmail을 추가하고 저장한 뒤 다시 진행해주세요.',
        results,
      );
      return;
    }
  } catch {
    blockForManualAction(
      state,
      4,
      '⚠️ OAuth 테스트 사용자 자동 확인에 실패했습니다. Audience/Test users 화면에서 로그인 Gmail을 직접 추가하고 저장한 뒤 다시 진행해주세요.',
      results,
    );
    return;
  }

  if (state.cancelled) return;

  // 7) OAuth 클라이언트 ID 생성
  state.currentStep = 5;
  state.message = 'OAuth 클라이언트 ID 생성 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/credentials', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
    const createCredBtn = await page.$(GCP_SELECTORS.createCredsBtnKo) || await page.$(GCP_SELECTORS.createCredsBtnEn) || await page.$(GCP_SELECTORS.createCredsBtnEn2);
    if (createCredBtn) {
      await createCredBtn.click();
      await page.waitForTimeout(1500);

      // 드롭다운 메뉴에서 "OAuth 클라이언트 ID" 선택
      const oauthOption = await page.$(GCP_SELECTORS.oauthOptionKo) || await page.$(GCP_SELECTORS.oauthOptionEn) || await page.$(GCP_SELECTORS.oauthOptionData);
      if (oauthOption) {
        await oauthOption.click();
        await page.waitForTimeout(3000);

        // 애플리케이션 유형 = "데스크톱 앱" 또는 "웹 애플리케이션"
        const appTypeSelect = await page.$(GCP_SELECTORS.appTypeSelect);
        if (appTypeSelect) {
          await appTypeSelect.click();
          await page.waitForTimeout(1000);

          const desktopOption = await page.$(GCP_SELECTORS.desktopOptionKo) || await page.$(GCP_SELECTORS.desktopOptionEn) || await page.$(GCP_SELECTORS.desktopOptionEn2);
          if (desktopOption) {
            await desktopOption.click();
            await page.waitForTimeout(1000);
          }
        }

        // 이름 입력
        const nameInput = await page.$(GCP_SELECTORS.oauthClientNameInput);
        if (nameInput) {
          await nameInput.fill('Blogger GPT Desktop');
          await page.waitForTimeout(500);
        }

        // 만들기 버튼
        const createOAuthBtn = await page.$(GCP_SELECTORS.createBtnKo) || await page.$(GCP_SELECTORS.createBtnEn) || await page.$(GCP_SELECTORS.createBtnEn2);
        if (createOAuthBtn) {
          await createOAuthBtn.click();
          await page.waitForTimeout(5000);

          // 생성된 Client ID / Secret 추출 (팝업 대화상자)
          const clientId = await page.evaluate(() => {
            // 팝업에서 Client ID 찾기
            const labels = Array.from(document.querySelectorAll('label, .cfc-credential-label, span'));
            for (const label of labels) {
              const text = label.textContent?.trim();
              if (text?.includes('클라이언트 ID') || text?.includes('Client ID')) {
                const nextInput = label.closest('.cfc-credential-pair')?.querySelector('input, .cfc-credential-value, span');
                if (nextInput) {
                  return (nextInput as HTMLInputElement).value || (nextInput as HTMLElement).textContent?.trim() || '';
                }
              }
            }
            // 대화상자 내 input에서 직접 추출
            const inputs = Array.from(document.querySelectorAll('input[readonly]'));
            for (const input of inputs) {
              const val = (input as HTMLInputElement).value;
              if (val && val.includes('.apps.googleusercontent.com')) return val;
            }
            return '';
          });

          const clientSecret = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label, .cfc-credential-label, span'));
            for (const label of labels) {
              const text = label.textContent?.trim();
              if (text?.includes('클라이언트 보안 비밀번호') || text?.includes('Client secret')) {
                const nextInput = label.closest('.cfc-credential-pair')?.querySelector('input, .cfc-credential-value, span');
                if (nextInput) {
                  return (nextInput as HTMLInputElement).value || (nextInput as HTMLElement).textContent?.trim() || '';
                }
              }
            }
            // input에서 직접 추출 (Client ID가 아닌 것)
            const inputs = Array.from(document.querySelectorAll('input[readonly]'));
            for (const input of inputs) {
              const val = (input as HTMLInputElement).value;
              if (val && !val.includes('.apps.googleusercontent.com') && val.length > 10) return val;
            }
            return '';
          });

          if (clientId) results['googleClientId'] = clientId;
          if (clientSecret) results['googleClientSecret'] = clientSecret;

          // 추출 실패 시 강화된 폴백: 페이지 전체 텍스트에서 패턴 매칭
          if (!clientId || !clientSecret) {
            await page.waitForTimeout(2000);
            const fallback = await page.evaluate(() => {
              const text = document.body.innerText || '';
              // Client ID 패턴: 숫자-문자.apps.googleusercontent.com
              const idMatch = text.match(/[\d-]+\.apps\.googleusercontent\.com/);
              // Client Secret 패턴: GOCSPX-로 시작 (또는 24자 이상 random)
              const secretMatch = text.match(/GOCSPX-[A-Za-z0-9_-]+/);
              return {
                id: idMatch ? idMatch[0] : '',
                secret: secretMatch ? secretMatch[0] : '',
              };
            });
            if (!clientId && fallback.id) results['googleClientId'] = fallback.id;
            if (!clientSecret && fallback.secret) results['googleClientSecret'] = fallback.secret;
          }

          if (results['googleClientId'] && results['googleClientSecret']) {
            state.message = '✅ OAuth 클라이언트 ID/Secret 생성 완료!';
          } else {
            state.message = '⚠️ 자격증명이 생성되었지만 자동 추출 실패. 블로그 플랫폼 필드에 Client ID/Secret을 붙여넣고 [저장 후 인증]을 눌러주세요.';
          }
        }
      }
    } else {
      state.message = '사용자 인증 정보 만들기 버튼을 찾지 못했습니다. 블로그 플랫폼 필드에서 콘솔을 열어 Client ID/Secret을 저장해주세요.';
    }
  } catch (e) {
    state.message = 'OAuth 클라이언트 ID 자동 생성 중 오류. 블로그 플랫폼 필드에 Client ID/Secret을 붙여넣고 [저장 후 인증]을 눌러주세요.';
  }

  if (state.cancelled) return;

  state.currentStep = 6;
  state.message = results['googleClientId'] && results['googleClientSecret']
    ? 'Client ID/Secret을 앱에 저장할 준비가 완료되었습니다.'
    : 'Client ID/Secret 자동 추출이 막혔습니다. 블로그 플랫폼 필드에 값을 붙여넣어 주세요.';
  await page.waitForTimeout(1000);

  if (!results['googleClientId'] || !results['googleClientSecret']) {
    blockForManualAction(
      state,
      6,
      '⚠️ Client ID/Secret 자동 추출이 확인되지 않았습니다. 블로그 플랫폼 필드에 Client ID/Secret을 직접 붙여넣고 저장 후 인증을 진행해주세요.',
      results,
    );
    return;
  }

  // 8) Blog ID 추출 (Blogger.com에서)
  state.currentStep = 7;
  state.message = 'Blogger에서 Blog ID 추출 중...';
  try {
    await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // URL에서 Blog ID 추출
    const blogUrl = page.url();
    const blogIdMatch = blogUrl.match(/blogger\.com\/blog\/posts\/(\d+)/);
    if (blogIdMatch) {
      results['blogId'] = blogIdMatch[1];
      state.message = `✅ Blog ID 추출 완료: ${blogIdMatch[1]}`;
    } else {
      // 대시보드에서 blog ID 추출 시도
      await page.waitForTimeout(2000);
      const blogId2 = await page.evaluate(() => {
        // 대시보드 링크에서 추출
        const links = Array.from(document.querySelectorAll('a[href*="/blog/"]'));
        for (const link of links) {
          const href = (link as HTMLAnchorElement).href;
          const match = href.match(/\/blog\/(?:posts|pages|stats|settings)\/(\d+)/);
          if (match) return match[1];
        }
        return '';
      });

      if (blogId2) {
        results['blogId'] = blogId2;
        state.message = `✅ Blog ID 추출 완료: ${blogId2}`;
      } else {
        state.message = '⚠️ Blog ID를 자동 추출하지 못했습니다. Blogger 대시보드에서 확인해주세요.';
      }
    }
  } catch {
    state.message = 'Blog ID 추출 실패. Blogger 대시보드에서 확인해주세요.';
  }

  if (!results['blogId']) {
    blockForManualAction(
      state,
      7,
      '⚠️ Blog ID 자동 추출이 확인되지 않았습니다. 블로그 플랫폼 필드에 Blogger Blog ID를 직접 입력하고 저장해주세요.',
      results,
    );
    return;
  }

  state.currentStep = 8;
  state.results = results;
}

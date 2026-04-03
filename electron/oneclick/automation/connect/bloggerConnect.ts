// @ts-nocheck
import type { ConnectState } from '../../types';

export async function automateBloggerConnect(state: ConnectState, page: any): Promise<void> {
  const results: Record<string, string> = {};

  // 1) GCP Console 이동
  state.message = 'Google Cloud Console로 이동 중...';
  await page.goto('https://console.cloud.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

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
  state.message = '프로젝트 확인 중...';
  try {
    // 프로젝트 셀렉터에서 현재 프로젝트 이름 확인
    await page.waitForTimeout(2000);

    // 새 프로젝트 생성 페이지로 이동
    await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // 프로젝트 이름 입력
    const projectNameInput = await page.$('input[formcontrolname="projectName"], input[name="projectName"], #p6ntest-name-input, input[aria-label*="Project name"]');
    if (projectNameInput) {
      await projectNameInput.fill('blogger-gpt-app');
      await page.waitForTimeout(1000);

      // 만들기 버튼
      const createBtn = await page.$('button:has-text("만들기")') || await page.$('button:has-text("CREATE")') || await page.$('button:has-text("Create")');
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
  state.message = 'Blogger API 활성화 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/library/blogger.googleapis.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "사용" 또는 "ENABLE" 버튼
    const enableBtn = await page.$('button:has-text("사용")') || await page.$('button:has-text("ENABLE")') || await page.$('button:has-text("Enable")');
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
      const manageBtn = await page.$('button:has-text("관리")') || await page.$('button:has-text("MANAGE")') || await page.$('button:has-text("Manage")');
      if (manageBtn) {
        state.message = 'Blogger API가 이미 활성화되어 있습니다.';
      } else {
        state.message = 'Blogger API 활성화 버튼을 찾지 못했습니다. 수동으로 활성화해주세요.';
      }
    }
  } catch (e) {
    state.message = 'Blogger API 활성화 페이지 이동 실패. 수동으로 활성화해주세요.';
  }

  if (state.cancelled) return;

  // 5) OAuth 동의 화면 구성
  state.message = 'OAuth 동의 화면 구성 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/credentials/consent', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "외부" (External) 선택 후 만들기
    const externalRadio = await page.$('input[value="EXTERNAL"], label:has-text("외부"), label:has-text("External")');
    if (externalRadio) {
      await externalRadio.click();
      await page.waitForTimeout(1000);

      const createBtn = await page.$('button:has-text("만들기")') || await page.$('button:has-text("CREATE")') || await page.$('button:has-text("Create")');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(5000);

        // 앱 이름 입력
        const appNameInput = await page.$('input[formcontrolname="displayName"], input[aria-label*="App name"], input[aria-label*="앱 이름"]');
        if (appNameInput) {
          await appNameInput.fill('Blogger GPT');
          await page.waitForTimeout(500);
        }

        // 사용자 지원 이메일 — 이미 채워져 있을 수 있음
        // 저장 버튼
        const saveBtn = await page.$('button:has-text("저장 후 계속")') || await page.$('button:has-text("SAVE AND CONTINUE")') || await page.$('button:has-text("Save and continue")');
        if (saveBtn) {
          await saveBtn.click();
          await page.waitForTimeout(3000);
          // 범위 단계 — 건너뛰기
          const skipBtn = await page.$('button:has-text("저장 후 계속")') || await page.$('button:has-text("SAVE AND CONTINUE")');
          if (skipBtn) {
            await skipBtn.click();
            await page.waitForTimeout(2000);
          }
          // 테스트 사용자 단계 — 건너뛰기
          const skipBtn2 = await page.$('button:has-text("저장 후 계속")') || await page.$('button:has-text("SAVE AND CONTINUE")');
          if (skipBtn2) {
            await skipBtn2.click();
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

  // 6) OAuth 클라이언트 ID 생성
  state.message = 'OAuth 클라이언트 ID 생성 중...';
  try {
    await page.goto('https://console.cloud.google.com/apis/credentials', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
    const createCredBtn = await page.$('button:has-text("사용자 인증 정보 만들기")') || await page.$('button:has-text("CREATE CREDENTIALS")') || await page.$('button:has-text("Create credentials")');
    if (createCredBtn) {
      await createCredBtn.click();
      await page.waitForTimeout(1500);

      // 드롭다운 메뉴에서 "OAuth 클라이언트 ID" 선택
      const oauthOption = await page.$('a:has-text("OAuth 클라이언트 ID")') || await page.$('a:has-text("OAuth client ID")') || await page.$('[data-value="oauth-client-id"]');
      if (oauthOption) {
        await oauthOption.click();
        await page.waitForTimeout(3000);

        // 애플리케이션 유형 = "데스크톱 앱" 또는 "웹 애플리케이션"
        const appTypeSelect = await page.$('select, [role="listbox"], mat-select');
        if (appTypeSelect) {
          await appTypeSelect.click();
          await page.waitForTimeout(1000);

          const desktopOption = await page.$('mat-option:has-text("데스크톱 앱")') || await page.$('mat-option:has-text("Desktop app")') || await page.$('option:has-text("Desktop")');
          if (desktopOption) {
            await desktopOption.click();
            await page.waitForTimeout(1000);
          }
        }

        // 이름 입력
        const nameInput = await page.$('input[formcontrolname="displayName"], input[aria-label*="Name"], input[aria-label*="이름"]');
        if (nameInput) {
          await nameInput.fill('Blogger GPT Desktop');
          await page.waitForTimeout(500);
        }

        // 만들기 버튼
        const createOAuthBtn = await page.$('button:has-text("만들기")') || await page.$('button:has-text("CREATE")') || await page.$('button:has-text("Create")');
        if (createOAuthBtn) {
          await createOAuthBtn.click();
          await page.waitForTimeout(5000);

          // 생성된 Client ID / Secret 추출 (팝업 대화상자)
          const clientId = await page.evaluate(() => {
            // 팝업에서 Client ID 찾기
            const labels = document.querySelectorAll('label, .cfc-credential-label, span');
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
            const inputs = document.querySelectorAll('input[readonly]');
            for (const input of inputs) {
              const val = (input as HTMLInputElement).value;
              if (val && val.includes('.apps.googleusercontent.com')) return val;
            }
            return '';
          });

          const clientSecret = await page.evaluate(() => {
            const labels = document.querySelectorAll('label, .cfc-credential-label, span');
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
            const inputs = document.querySelectorAll('input[readonly]');
            for (const input of inputs) {
              const val = (input as HTMLInputElement).value;
              if (val && !val.includes('.apps.googleusercontent.com') && val.length > 10) return val;
            }
            return '';
          });

          if (clientId) results['googleClientId'] = clientId;
          if (clientSecret) results['googleClientSecret'] = clientSecret;

          if (clientId && clientSecret) {
            state.message = '✅ OAuth 클라이언트 ID/Secret 생성 완료!';
          } else {
            state.message = '⚠️ 자격증명이 생성되었지만 자동 추출 실패. 화면에서 직접 복사해주세요.';
          }
        }
      }
    } else {
      state.message = '사용자 인증 정보 만들기 버튼을 찾지 못했습니다.';
    }
  } catch (e) {
    state.message = 'OAuth 클라이언트 ID 생성 중 오류. 수동으로 설정해주세요.';
  }

  if (state.cancelled) return;

  // 7) Blog ID 추출 (Blogger.com에서)
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
        const links = document.querySelectorAll('a[href*="/blog/"]');
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

  state.results = results;
}

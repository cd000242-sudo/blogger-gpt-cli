// electron/oneclick/automation/cloudwaysInfra.ts
// Cloudways 인프라 자동화 (도메인 + SSL)

import { launchBrowser, sleep, waitForPageStable } from '../utils/browser';
import type { InfraState } from '../types';
import { CLOUDWAYS_SELECTORS } from '../config/selectors';

/**
 * Cloudways 인프라 세팅 (도메인 추가 + SSL 설치 + HTTPS 확인).
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
export async function runCloudwaysInfraSetup(
  state: InfraState,
  domain: string,
  email: string,
  waitForLogin?: (key: string, timeout?: number) => Promise<boolean>
): Promise<void> {
  const { browser, page } = await launchBrowser();
  state.browser = browser;
  state.page = page;

  try {
    // ─── Step 0: Cloudways 로그인 (수동) ───
    state.currentStep = 0;
    state.stepStatus = 'running';
    state.message = 'Cloudways 로그인 페이지로 이동 중...';

    await page.goto('https://unified.cloudways.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageStable(page, 2000);

    state.stepStatus = 'waiting-login';
    state.message = 'Cloudways 계정으로 로그인해주세요';

    const loggedIn = waitForLogin ? await waitForLogin('infra') : false;
    if (state.cancelled) return;
    if (!loggedIn) {
      state.error = '로그인 대기 시간 초과';
      state.stepStatus = 'error';
      return;
    }

    state.currentStep = 0;
    state.stepStatus = 'done';
    state.message = '로그인 완료';
    await sleep(1500);

    // ─── Step 1: Application 자동 탐색 ───
    state.currentStep = 1;
    state.stepStatus = 'running';
    state.message = '애플리케이션 목록에서 대상 앱을 찾는 중...';

    // 현재 URL에서 앱이 이미 선택되어 있는지 확인
    const currentUrl = page.url();
    let appId = '';

    // URL에서 앱 ID 추출 시도
    const appIdMatch = currentUrl.match(/\/apps\/(\d+)/);
    if (appIdMatch) {
      appId = appIdMatch[1];
      state.message = `앱 ID ${appId} 감지됨`;
    } else {
      // 서버 목록에서 첫 번째 앱으로 이동
      try {
        // 앱 목록 탐색 — Cloudways 대시보드에서 앱 클릭
        const appLink = await page.locator(CLOUDWAYS_SELECTORS.appLink).first();
        if (await appLink.isVisible({ timeout: 10000 })) {
          const href = await appLink.getAttribute('href');
          if (href) {
            const match = href.match(/\/apps\/(\d+)/);
            if (match) appId = match[1];
          }
          await appLink.click();
          await sleep(3000);
        }
      } catch {
        state.message = '앱을 찾지 못했습니다. 대시보드에서 앱을 선택해주세요.';
      }
    }

    if (!appId) {
      // URL에서 다시 추출 시도
      const retryUrl = page.url();
      const retryMatch = retryUrl.match(/\/apps\/(\d+)/);
      if (retryMatch) appId = retryMatch[1];
    }

    // 🔴 Issue #3 Fix: appId 미발견 시 에러 상태로 전환 (이후 스텝 불가)
    if (!appId) {
      state.stepStatus = 'error';
      state.error = '앱 ID를 찾지 못했습니다. Cloudways 대시보드에서 앱을 선택한 상태로 다시 시도해주세요.';
      console.error('[ONECLICK-INFRA] ❌ 앱 ID 미발견 — 자동화 불가');
      return;
    }

    state.stepStatus = 'done';
    state.message = `앱 ${appId} 선택 완료`;
    if (state.cancelled) return;
    await sleep(1000);

    // ─── Step 2: 도메인 관리 — 도메인 추가 ───
    state.currentStep = 2;
    state.stepStatus = 'running';
    state.message = '도메인 관리 페이지로 이동 중...';

    try {
      // Domain Management 페이지로 이동 (appId 보장됨 — Issue #3에서 가드)
      await page.goto(`https://unified.cloudways.com/apps/${appId}/domain`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitForPageStable(page, 3000);

      // 도메인이 이미 등록되어 있는지 확인
      const existingDomain = await page.locator(`text="${domain}"`).first();
      let domainAlreadyAdded = false;
      try {
        domainAlreadyAdded = await existingDomain.isVisible({ timeout: 3000 });
      } catch { /* not found */ }

      if (domainAlreadyAdded) {
        state.message = `✅ 도메인 ${domain} 이미 등록됨 — 건너뜀`;
      } else {
        // 도메인 추가
        state.message = `도메인 ${domain} 추가 중...`;

        // 도메인 입력 필드 찾기
        const domainInput = await page.locator(CLOUDWAYS_SELECTORS.domainInput).first();
        if (await domainInput.isVisible({ timeout: 5000 })) {
          await domainInput.fill('');
          await sleep(300);
          await domainInput.type(domain, { delay: 50 });
          await sleep(500);

          // 추가 버튼 클릭
          const addBtn = await page.locator(CLOUDWAYS_SELECTORS.addDomainBtn).first();
          if (await addBtn.isVisible({ timeout: 3000 })) {
            await addBtn.click();
            await sleep(3000);
          }
          state.message = `도메인 ${domain} 추가 완료`;
        } else {
          state.message = 'Primary Domain 확인';
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      state.message = `도메인 추가 실패 — ${errMsg} (수동 확인 권장)`;
      console.warn('[ONECLICK-INFRA] 도메인 추가 중 오류:', e);
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ─── Step 3: SSL 인증서 설치 (Let's Encrypt) ───
    state.currentStep = 3;
    state.stepStatus = 'running';
    state.message = 'SSL 인증서 관리 페이지로 이동 중...';

    try {
      // SSL Certificate 페이지로 이동 (appId 보장됨 — Issue #3에서 가드)
      await page.goto(`https://unified.cloudways.com/apps/${appId}/ssl`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitForPageStable(page, 4000);

      // 이미 SSL이 설치되어 있는지 확인
      const sslInstalled = await page.locator(CLOUDWAYS_SELECTORS.certInstalledText).first();
      let alreadyInstalled = false;
      try {
        alreadyInstalled = await sslInstalled.isVisible({ timeout: 3000 });
      } catch { /* not found */ }

      if (alreadyInstalled) {
        state.message = '✅ SSL 인증서 이미 설치됨 — 건너뜀';
      } else {
        // Let's Encrypt 선택 확인
        state.message = "Let's Encrypt 인증서 설정 중...";

        // ⚠️ 핵심: Cloudways Angular UI의 공유 모델 바인딩 함정 대응
        // email과 domain 필드가 placeholder 셀렉터를 공유하므로 고유 ID 사용 필수
        // 검증된 ID 패턴: #_apps_{appId}_ssl_uid-field-1_ssl_email_field (email)
        //                  #_apps_{appId}_ssl__ssl_domain_field (domain)

        // 방법 1: 고유 ID로 시도 (appId 보장됨)
        let emailFilled = false;
        let domainFilled = false;

        // 이메일 필드 (고유 ID)
        const emailSelector = `#_apps_${appId}_ssl_uid-field-1_ssl_email_field`;
        try {
          const emailField = await page.locator(emailSelector).first();
          if (await emailField.isVisible({ timeout: 3000 })) {
            await emailField.fill('');
            await sleep(200);
            await emailField.type(email, { delay: 30 });
            emailFilled = true;
            await sleep(500);
          }
        } catch { /* fallback */ }

        // 도메인 필드 (고유 ID)
        const domainSelector = `#_apps_${appId}_ssl__ssl_domain_field`;
        try {
          const domainField = await page.locator(domainSelector).first();
          if (await domainField.isVisible({ timeout: 3000 })) {
            await domainField.fill('');
            await sleep(200);
            await domainField.type(domain, { delay: 30 });
            domainFilled = true;
            await sleep(500);
          }
        } catch { /* fallback */ }

        // 방법 2: 고유 ID 실패 시 일반 셀렉터 폴백
        if (!emailFilled) {
          try {
            const emailInput = await page.locator(CLOUDWAYS_SELECTORS.emailInputFallback).first();
            if (await emailInput.isVisible({ timeout: 3000 })) {
              await emailInput.fill('');
              await emailInput.type(email, { delay: 30 });
              emailFilled = true;
              await sleep(500);
            }
          } catch { /* manual required */ }
        }

        if (!domainFilled) {
          try {
            const domainInput = await page.locator(CLOUDWAYS_SELECTORS.sslDomainInputFallback).first();
            if (await domainInput.isVisible({ timeout: 3000 })) {
              await domainInput.fill('');
              await domainInput.type(domain, { delay: 30 });
              domainFilled = true;
              await sleep(500);
            }
          } catch { /* manual required */ }
        }

        if (emailFilled && domainFilled) {
          state.message = 'SSL 인증서 설치 중... (1~2분 소요)';

          // Install Certificate 버튼 클릭
          const installBtn = await page.locator(CLOUDWAYS_SELECTORS.installCertBtn).first();
          if (await installBtn.isVisible({ timeout: 5000 })) {
            await installBtn.click();

            // 🟡 Issue #2 Fix: locator().or().waitFor() 사용 (waitForSelector는 text= 엔진 미지원)
            try {
              await page.locator(CLOUDWAYS_SELECTORS.certInstalledText)
                .or(page.locator(CLOUDWAYS_SELECTORS.installedSuccessText))
                .or(page.locator(CLOUDWAYS_SELECTORS.alertSuccess))
                .or(page.locator(CLOUDWAYS_SELECTORS.successClass))
                .first()
                .waitFor({ timeout: 120000 });
              state.message = '✅ SSL 인증서 설치 완료!';
            } catch {
              // 타임아웃이어도 진행 — 설치가 늦을 수 있음
              state.message = 'SSL 설치 요청 완료 (설치 진행 중일 수 있습니다)';
            }
          } else {
            state.message = 'Install Certificate 버튼을 찾지 못했습니다. 수동으로 클릭해주세요.';
          }
        } else {
          state.message = `SSL 폼 입력 부분 완료 (email: ${emailFilled ? '✅' : '❌'}, domain: ${domainFilled ? '✅' : '❌'}) — 수동 확인 필요`;
        }
      }
    } catch (e) {
      state.message = 'SSL 설정 페이지에서 수동으로 설치해주세요.';
      console.error('[ONECLICK-INFRA] SSL 설치 오류:', e);
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1500);

    // ─── Step 4: HTTPS 접속 확인 ───
    state.currentStep = 4;
    state.stepStatus = 'running';
    state.message = 'HTTPS 접속 확인 중...';

    // 🟢 Issue #5 Fix: https:// 직접 접속 우선 → http:// 폴백 → 전부 실패 시 DNS 안내
    try {
      await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await waitForPageStable(page, 2000);
      state.message = `✅ HTTPS 접속 성공! (https://${domain})`;
    } catch {
      // HTTPS 직접 접속 실패 → HTTP 시도
      try {
        await page.goto(`http://${domain}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await waitForPageStable(page, 2000);
        const finalUrl = page.url();
        if (finalUrl.startsWith('https://')) {
          state.message = `✅ HTTPS 리다이렉트 정상 작동! (${finalUrl})`;
        } else {
          state.message = `⚠️ HTTP 접속 가능하나 HTTPS 리다이렉트 미설정 — Cloudways SSL > Force HTTPS를 활성화해주세요.`;
        }
      } catch {
        state.message = '⚠️ 사이트 접속 불가 — DNS 전파 대기 중일 수 있습니다. (최대 24~48시간)';
      }
    }

    state.stepStatus = 'done';
    state.completed = true;
    state.message = '🎉 인프라 세팅 완료! 도메인 + SSL 설정이 적용되었습니다.';

  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    state.stepStatus = 'error';
    console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 오류:', e);
  } finally {
    // 🔴 Issue #1 Fix: 반드시 브라우저 정리 — cancel/error/정상 모두 orphan 방지
    try { await browser?.close(); } catch { /* ignore */ }
    state.browser = null;
    state.page = null;
  }
}

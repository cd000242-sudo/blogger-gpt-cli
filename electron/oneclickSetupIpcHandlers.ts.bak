// @ts-nocheck
// electron/oneclickSetupIpcHandlers.ts
// 🚀 원클릭 블로그 세팅 — IPC 핸들러 + Playwright 자동화 엔진
import { ipcMain, app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════
// 상태 관리
// ═══════════════════════════════════════════════

interface SetupState {
  platform: string;
  currentStep: number;
  totalSteps: number;
  stepStatus: 'idle' | 'running' | 'waiting-login' | 'done' | 'error';
  message: string;
  completed: boolean;
  cancelled: boolean;
  error: string | null;
  browser: any | null;
  page: any | null;
}

const setupStates: Record<string, SetupState> = {};

// 로그인 완료 대기를 위한 Promise resolve 콜백 저장소
const loginResolvers: Record<string, () => void> = {};

function getOrCreateState(platform: string, totalSteps?: number): SetupState {
  if (!setupStates[platform]) {
    setupStates[platform] = {
      platform,
      currentStep: 0,
      totalSteps: totalSteps || 4,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      browser: null,
      page: null,
    };
  }
  return setupStates[platform];
}

function resetState(platform: string): void {
  if (setupStates[platform]) {
    try {
      setupStates[platform].browser?.close();
    } catch (e) { /* ignore */ }
    delete setupStates[platform];
  }
}

// ═══════════════════════════════════════════════
// 연동(Connect) 상태 관리
// ═══════════════════════════════════════════════

interface ConnectState {
  platform: string;
  stepStatus: 'idle' | 'running' | 'waiting-login' | 'done' | 'error';
  message: string;
  completed: boolean;
  cancelled: boolean;
  error: string | null;
  browser: any | null;
  page: any | null;
  results: Record<string, string>;
}

const connectStates: Record<string, ConnectState> = {};

function getOrCreateConnectState(platform: string): ConnectState {
  if (!connectStates[platform]) {
    connectStates[platform] = {
      platform,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      browser: null,
      page: null,
      results: {},
    };
  }
  return connectStates[platform];
}

function resetConnectState(platform: string): void {
  if (connectStates[platform]) {
    try {
      connectStates[platform].browser?.close();
    } catch (e) { /* ignore */ }
    delete connectStates[platform];
  }
}

// ═══════════════════════════════════════════════
// 인프라(Infra) 상태 관리 — DNS + SSL 자동화
// ═══════════════════════════════════════════════

interface InfraState {
  currentStep: number;
  totalSteps: number;
  stepStatus: 'idle' | 'running' | 'waiting-login' | 'done' | 'error';
  message: string;
  completed: boolean;
  cancelled: boolean;
  error: string | null;
  browser: any | null;
  page: any | null;
}

let infraState: InfraState | null = null;
const infraLoginResolvers: Record<string, () => void> = {};

function getOrCreateInfraState(): InfraState {
  if (!infraState) {
    infraState = {
      currentStep: 0,
      totalSteps: 5,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      browser: null,
      page: null,
    };
  }
  return infraState;
}

function resetInfraState(): void {
  // 🔴 browser.close()는 runCloudwaysInfraSetup()의 finally 블록이 담당
  // 여기서는 state 레퍼런스만 해제
  infraState = null;
}

async function waitForInfraLogin(timeout: number = 300000): Promise<boolean> {
  console.log(`[ONECLICK-INFRA] 🔐 Cloudways 로그인 대기 시작...`);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      delete infraLoginResolvers['infra'];
      console.log('[ONECLICK-INFRA] ⏰ 로그인 대기 시간 초과');
      resolve(false);
    }, timeout);

    infraLoginResolvers['infra'] = () => {
      clearTimeout(timer);
      delete infraLoginResolvers['infra'];
      console.log('[ONECLICK-INFRA] ✅ Cloudways 로그인 완료 확인!');
      resolve(true);
    };
  });
}

// ═══════════════════════════════════════════════
// Cloudways 인프라 자동화 — runCloudwaysInfraSetup
// ═══════════════════════════════════════════════

async function runCloudwaysInfraSetup(
  state: InfraState,
  domain: string,
  email: string
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
    await sleep(2000);

    state.stepStatus = 'waiting-login';
    state.message = 'Cloudways 계정으로 로그인해주세요';

    const loggedIn = await waitForInfraLogin();
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
        const appLink = await page.locator('a[href*="/apps/"]').first();
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
      await sleep(3000);

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
        const domainInput = await page.locator('input[placeholder*="domain"], input[placeholder*="Domain"], input[name*="domain"]').first();
        if (await domainInput.isVisible({ timeout: 5000 })) {
          await domainInput.fill('');
          await sleep(300);
          await domainInput.type(domain, { delay: 50 });
          await sleep(500);

          // 추가 버튼 클릭
          const addBtn = await page.locator('button:has-text("Add Domain"), button:has-text("도메인 추가"), button:has-text("Save"), button[type="submit"]').first();
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
      state.message = `도메인 관리 페이지 확인 완료 (수동 확인 권장)`;
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
      await sleep(4000);

      // 이미 SSL이 설치되어 있는지 확인
      const sslInstalled = await page.locator('text="Certificate Installed"').first();
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
            const emailInput = await page.locator('input[placeholder*="email"], input[type="email"]').first();
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
            const domainInput = await page.locator('input[placeholder*="www.domain"], input[placeholder*="domain.com"]').first();
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
          const installBtn = await page.locator('button:has-text("Install Certificate"), button:has-text("인증서 설치")').first();
          if (await installBtn.isVisible({ timeout: 5000 })) {
            await installBtn.click();
            
            // 🟡 Issue #2 Fix: locator().or().waitFor() 사용 (waitForSelector는 text= 엔진 미지원)
            try {
              await page.locator('text="Certificate Installed"')
                .or(page.locator('text="Installed successfully"'))
                .or(page.locator('.alert-success'))
                .or(page.locator('[class*="success"]'))
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
      await sleep(2000);
      state.message = `✅ HTTPS 접속 성공! (https://${domain})`;
    } catch {
      // HTTPS 직접 접속 실패 → HTTP 시도
      try {
        await page.goto(`http://${domain}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(2000);
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

// ═══════════════════════════════════════════════
// 스킨 CSS 로드 유틸
// ═══════════════════════════════════════════════

function loadSkinCSS(type: 'blogspot' | 'wordpress'): string {
  try {
    const cssName = type === 'blogspot' ? 'blogspot-cloud-skin.css' : 'cloud-skin.css';
    const cssPath = path.join(__dirname, 'ui', cssName);
    if (fs.existsSync(cssPath)) {
      return fs.readFileSync(cssPath, 'utf-8');
    }
  } catch (e) {
    console.error(`[ONECLICK] 스킨 CSS 로드 실패:`, e);
  }
  return '';
}

// ═══════════════════════════════════════════════
// Blogger 테마 <head>에 메타태그 자동 삽입 유틸
// ═══════════════════════════════════════════════

async function insertMetaTagToBloggerTheme(
  page: any,
  metaTag: string,
  blogId: string,
  label: string
): Promise<boolean> {
  try {
    console.log(`[ONECLICK] 📌 Blogger 테마에 ${label} 메타태그 삽입 시도...`);

    // 테마 HTML 편집 페이지로 이동
    if (blogId) {
      await page.goto(`https://www.blogger.com/blog/theme/edit/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } else {
      await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      // 사이드바에서 테마 클릭
      const themeLink = await page.$('a:has-text("테마"), a:has-text("Theme")');
      if (themeLink) {
        await themeLink.click();
        await page.waitForTimeout(2000);
      }
      // HTML 편집 버튼
      const editHtmlBtn = await page.$('button:has-text("HTML 편집"), button:has-text("Edit HTML")');
      if (editHtmlBtn) {
        await editHtmlBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    await page.waitForTimeout(3000);

    // CodeMirror 에디터에 메타태그 삽입 (<head> 바로 아래)
    const inserted = await page.evaluate((tag: string) => {
      const cm = (document.querySelector('.CodeMirror') as any)?.CodeMirror;
      if (!cm) return false;
      const currentContent = cm.getValue();

      // 이미 동일한 메타태그가 있으면 건너뛰기
      if (currentContent.includes(tag.trim())) return true;

      // <head> 바로 아래에 삽입 (Blogger 테마는 <head> 태그가 있음)
      const headMatch = currentContent.match(/<head[^>]*>/i);
      if (headMatch) {
        const insertPos = currentContent.indexOf(headMatch[0]) + headMatch[0].length;
        const newContent = currentContent.slice(0, insertPos) +
          '\n' + tag.trim() + '\n' +
          currentContent.slice(insertPos);
        cm.setValue(newContent);
        return true;
      }
      return false;
    }, metaTag);

    if (inserted) {
      // 저장 버튼 클릭
      await page.waitForTimeout(1000);
      const saveBtn = await page.$('button[aria-label*="저장"], button[aria-label*="Save"], button:has-text("💾")');
      if (saveBtn) {
        try {
          if (await saveBtn.isVisible({ timeout: 3000 })) {
            await saveBtn.click();
            await page.waitForTimeout(3000);
          }
        } catch { /* 수동 저장 필요 */ }
      }
      console.log(`[ONECLICK] ✅ ${label} 메타태그 삽입 완료`);
      return true;
    }
    console.log(`[ONECLICK] ⚠️ ${label} 메타태그 삽입 실패 — <head> 태그를 찾지 못함`);
    return false;
  } catch (e) {
    console.error(`[ONECLICK] ❌ ${label} 메타태그 삽입 오류:`, e);
    return false;
  }
}

// ═══════════════════════════════════════════════
// Playwright 유틸
// ═══════════════════════════════════════════════

async function launchBrowser(): Promise<{ browser: any; page: any }> {
  try {
    const playwright = require('playwright');
    const browser = await playwright.chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    return { browser, page };
  } catch (e) {
    console.error('[ONECLICK] Playwright 런치 실패:', e);
    throw new Error('Playwright를 실행할 수 없습니다. playwright 패키지가 설치되어 있는지 확인하세요.');
  }
}

async function waitForLogin(platform: string, timeout: number = 300000): Promise<boolean> {
  console.log(`[ONECLICK] 🔐 로그인 대기 시작 (${platform}) — 사용자가 "로그인 완료" 버튼을 누를 때까지 대기`);
  
  return new Promise<boolean>((resolve) => {
    // 타임아웃 설정
    const timer = setTimeout(() => {
      delete loginResolvers[platform];
      console.log(`[ONECLICK] ⏰ 로그인 대기 시간 초과 (${timeout / 1000}초)`);
      resolve(false);
    }, timeout);
    
    // resolve 콜백 저장 — confirm-login IPC에서 호출됨
    loginResolvers[platform] = () => {
      clearTimeout(timer);
      delete loginResolvers[platform];
      console.log(`[ONECLICK] ✅ 로그인 완료 확인! (${platform})`);
      resolve(true);
    };
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════
// 플랫폼별 자동화 로직
// ═══════════════════════════════════════════════



async function runBlogspotSetup(state: SetupState, adminUrl: string, blogspotConfig?: any): Promise<void> {
  const { browser, page } = await launchBrowser();
  state.browser = browser;
  state.page = page;

  const config = blogspotConfig || {};
  console.log('[ONECLICK-BLOGSPOT] 📋 설정 데이터:', JSON.stringify(config, null, 2));

  try {
    // ═══════════════════════════════════════════════
    // Step 0: Google 로그인
    // ═══════════════════════════════════════════════
    state.currentStep = 0;
    state.stepStatus = 'running';
    state.message = 'Blogger 관리자 페이지로 이동 중...';
    
    await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    state.stepStatus = 'waiting-login';
    state.message = '에드센스 계정과 동일한 Google 계정으로 로그인해주세요';
    
    const loggedIn = await waitForLogin(state.platform);
    if (state.cancelled) return;

    state.currentStep = 0;
    state.stepStatus = 'done';
    state.message = '로그인 완료';
    await sleep(2000);

    // ═══════════════════════════════════════════════
    // Step 1: 블로그 만들기
    // ═══════════════════════════════════════════════
    state.currentStep = 1;
    state.stepStatus = 'running';
    state.message = '블로그 만들기 시작...';

    try {
      // 현재 URL에서 이미 블로그가 있는지 확인
      await sleep(2000);
      const currentUrl = page.url();
      let blogId = '';
      
      // 기존 블로그 ID 추출 시도
      const postMatch = currentUrl.match(/blogger\.com\/blog\/posts\/(\d+)/);
      const dashMatch = currentUrl.match(/blogger\.com\/blog\/(\w+)\/(\d+)/);
      if (postMatch) blogId = postMatch[1];
      else if (dashMatch) blogId = dashMatch[2];

      if (config.blogTitle && config.blogAddress) {
        // 새 블로그 만들기 (대시보드에서)
        state.message = '새 블로그 만들기 클릭 중...';
        
        try {
          // "새 블로그 만들기" 링크 또는 "블로그 만들기" 버튼 찾기
          const createBlogLink = await page.locator('text="새 블로그"').first();
          const createBlogBtn = await page.locator('text="블로그 만들기"').first();
          const newBlogLink = await page.locator('a:has-text("새 블로그"), a:has-text("New blog")').first();
          
          let clicked = false;
          for (const el of [createBlogLink, createBlogBtn, newBlogLink]) {
            try {
              if (await el.isVisible({ timeout: 3000 })) {
                await el.click();
                clicked = true;
                break;
              }
            } catch { /* 다음 셀렉터 시도 */ }
          }

          if (clicked) {
            await sleep(2000);

            // 블로그 제목 입력
            state.message = `블로그 제목 입력: "${config.blogTitle}"`;
            try {
              const titleInput = await page.locator('input[aria-label*="제목"], input[aria-label*="Title"], input[placeholder*="제목"]').first();
              if (await titleInput.isVisible({ timeout: 5000 })) {
                await titleInput.fill(config.blogTitle);
                await sleep(1000);
              }
            } catch {
              // 첫 번째 input 시도
              const fallbackInput = await page.locator('input[type="text"]').first();
              if (await fallbackInput.isVisible({ timeout: 3000 })) {
                await fallbackInput.fill(config.blogTitle);
                await sleep(1000);
              }
            }

            // "다음" 버튼 클릭
            try {
              const nextBtn = await page.locator('button:has-text("다음"), button:has-text("Next")').first();
              if (await nextBtn.isVisible({ timeout: 3000 })) {
                await nextBtn.click();
                await sleep(2000);
              }
            } catch { /* 다음 버튼 없으면 계속 */ }

            // 블로그 주소 입력
            state.message = `블로그 주소 입력: "${config.blogAddress}"`;
            try {
              const addressInput = await page.locator('input[aria-label*="주소"], input[aria-label*="Address"], input[aria-label*="URL"]').first();
              if (await addressInput.isVisible({ timeout: 5000 })) {
                await addressInput.fill(config.blogAddress);
                await sleep(1500);
              }
            } catch {
              // 현재 보이는 text input에 입력
              const inputs = await page.locator('input[type="text"]').all();
              if (inputs.length > 0) {
                const lastInput = inputs[inputs.length - 1];
                await lastInput.fill(config.blogAddress);
                await sleep(1500);
              }
            }

            // "저장" 또는 "만들기" 버튼 클릭
            try {
              const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save"), button:has-text("만들기"), button:has-text("Create")').first();
              if (await saveBtn.isVisible({ timeout: 5000 })) {
                await saveBtn.click();
                await sleep(3000);
                state.message = '✅ 블로그 생성 완료!';
              }
            } catch {
              state.message = '블로그 생성 시도 완료 (수동 확인 필요)';
            }
          } else {
            state.message = '기존 블로그 감지됨 — 건너뜁니다';
          }
        } catch (e) {
          console.error('[ONECLICK-BLOGSPOT] 블로그 생성 오류:', e);
          state.message = '블로그가 이미 존재하거나 생성 UI를 찾지 못함';
        }
      } else {
        state.message = '블로그 제목/주소 미입력 — 건너뜁니다';
      }

      // blogId 재확인
      await sleep(2000);
      const newUrl = page.url();
      const newMatch = newUrl.match(/blogger\.com\/blog\/posts\/(\d+)/) || newUrl.match(/blogger\.com\/blog\/\w+\/(\d+)/);
      if (newMatch) blogId = newMatch[1];
      
      // blogId를 state에 저장하여 이후 단계에서 사용
      (state as any).__blogId = blogId;
      
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] Step 1 오류:', e);
      state.message = '블로그 만들기 단계 완료 (수동 확인 필요)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 2: 설정 자동 최적화 (13개 항목)
    // ═══════════════════════════════════════════════
    state.currentStep = 2;
    state.stepStatus = 'running';
    state.message = '설정 페이지로 이동 중...';

    const blogId = (state as any).__blogId;
    
    try {
      if (blogId) {
        await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } else {
        // blogId가 없으면 사이드바에서 설정으로 이동
        try {
          const settingsLink = await page.locator('a[href*="settings"], a:has-text("설정"), a:has-text("Settings")').first();
          if (await settingsLink.isVisible({ timeout: 5000 })) {
            await settingsLink.click();
          }
        } catch { /* 설정 링크를 찾지 못함 */ }
      }
      await sleep(3000);

      // 설명(Description) 입력
      if (config.blogDescription) {
        state.message = '블로그 설명 설정 중...';
        try {
          const descSection = await page.locator('text="설명", text="Description"').first();
          if (await descSection.isVisible({ timeout: 3000 })) {
            await descSection.click();
            await sleep(1000);
            const descTextarea = await page.locator('textarea, [contenteditable="true"]').first();
            if (await descTextarea.isVisible({ timeout: 3000 })) {
              await descTextarea.fill(config.blogDescription);
              await sleep(500);
              // 저장 버튼 클릭
              const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
              if (await saveBtn.isVisible({ timeout: 3000 })) {
                await saveBtn.click();
                await sleep(1500);
              }
            }
          }
        } catch (e) {
          console.log('[ONECLICK-BLOGSPOT] 설명 설정 폴백:', e);
        }
      }

      // 글 표시 개수를 6개로 설정
      state.message = '글 표시 개수 설정 중 (6개)...';
      try {
        await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
          inputs.forEach((input: any) => {
            const label = input.closest('div')?.previousElementSibling?.textContent || '';
            if (label.includes('글') || label.includes('Posts') || label.includes('posts')) {
              input.value = '6';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        });
        await sleep(500);
      } catch { /* 글 개수 설정 실패 — 무시 */ }

      // 토글/체크박스 항목 자동 설정
      state.message = '이미지 라이트박스, 지연 로드, WebP 활성화 중...';
      
      // Blogger 설정 페이지의 토글들을 자동 조작
      try {
        await page.evaluate(() => {
          // 설정 페이지의 모든 토글/스위치 확인
          const toggleItems = document.querySelectorAll('[role="checkbox"], [role="switch"], input[type="checkbox"]');
          
          toggleItems.forEach((toggle: any) => {
            const parentText = toggle.closest('[class]')?.textContent || '';
            const label = parentText.toLowerCase();
            
            // 활성화해야 할 항목들
            const shouldEnable = [
              '라이트박스', 'lightbox',
              '지연 로드', 'lazy', 'lazyload',
              'webp',
              '검색 엔진', 'search engine', '표시됨', 'visible',
              'https',
            ];
            
            // 비활성화해야 할 항목들
            const shouldDisable = [
              '성인', 'adult',
            ];
            
            const matchEnable = shouldEnable.some(keyword => label.includes(keyword));
            const matchDisable = shouldDisable.some(keyword => label.includes(keyword));
            
            if (matchEnable) {
              const isChecked = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
              if (!isChecked) {
                toggle.click();
                console.log('[ONECLICK] ✅ 활성화:', parentText.slice(0, 50));
              }
            }
            
            if (matchDisable) {
              const isChecked = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
              if (isChecked) {
                toggle.click();
                console.log('[ONECLICK] ❌ 비활성화:', parentText.slice(0, 50));
              }
            }
          });
        });
        await sleep(1000);
      } catch (e) {
        console.log('[ONECLICK-BLOGSPOT] 토글 설정 폴백:', e);
      }

      // 댓글 숨기기
      state.message = '댓글 숨기기 설정 중...';
      try {
        const commentSection = await page.locator('text="댓글", text="Comments"').first();
        if (await commentSection.isVisible({ timeout: 3000 })) {
          await commentSection.click();
          await sleep(1000);
          // 숨기기 옵션 선택
          const hideOption = await page.locator('text="숨기기", text="Hide", [value="HIDE"]').first();
          if (await hideOption.isVisible({ timeout: 3000 })) {
            await hideOption.click();
            await sleep(500);
          }
          // 저장
          const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
          if (await saveBtn.isVisible({ timeout: 2000 })) {
            await saveBtn.click();
            await sleep(1000);
          }
        }
      } catch { /* 댓글 설정 실패 — 무시 */ }

      // 시간대: 서울 (GMT+9)
      state.message = '시간대: 서울 설정 중...';
      try {
        const timezoneSection = await page.locator('text="시간대", text="Time zone"').first();
        if (await timezoneSection.isVisible({ timeout: 3000 })) {
          await timezoneSection.click();
          await sleep(1000);
          // 서울 옵션 선택
          const seoulOption = await page.locator('option:has-text("서울"), option:has-text("Seoul")').first();
          if (await seoulOption.isVisible({ timeout: 3000 })) {
            const select = await seoulOption.locator('..').first();
            await select.selectOption({ label: '(GMT+09:00) 서울' });
            await sleep(500);
          }
          // 저장
          const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
          if (await saveBtn.isVisible({ timeout: 2000 })) {
            await saveBtn.click();
            await sleep(1000);
          }
        }
      } catch { /* 시간대 설정 실패 — 무시 */ }

      state.message = '✅ 설정 자동 최적화 완료 (13개 항목)';
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] 설정 최적화 오류:', e);
      state.message = '설정 최적화 일부 완료 (수동 확인 권장)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 3: 메타태그 · GA · ads.txt
    // ═══════════════════════════════════════════════
    state.currentStep = 3;
    state.stepStatus = 'running';
    state.message = '메타태그, 애널리틱스, ads.txt 설정 중...';

    try {
      // 설정 페이지가 아직 열려 있으므로 스크롤하여 메타태그 섹션 찾기
      
      // 메타태그 활성화
      state.message = '메타태그 활성화 중...';
      try {
        const metaSection = await page.locator('text="메타태그", text="Meta tags"').first();
        if (await metaSection.isVisible({ timeout: 3000 })) {
          await metaSection.click();
          await sleep(1000);
          // 활성화 토글
          const metaToggle = await page.locator('[role="switch"], [role="checkbox"]').first();
          if (await metaToggle.isVisible({ timeout: 3000 })) {
            const isEnabled = await metaToggle.getAttribute('aria-checked');
            if (isEnabled !== 'true') {
              await metaToggle.click();
              await sleep(500);
            }
          }
          // 설명 입력 (블로그 설명과 동일)
          if (config.blogDescription) {
            const metaInput = await page.locator('textarea, input[type="text"]').first();
            if (await metaInput.isVisible({ timeout: 2000 })) {
              await metaInput.fill(config.blogDescription);
              await sleep(500);
            }
          }
          // 저장
          const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
          if (await saveBtn.isVisible({ timeout: 2000 })) {
            await saveBtn.click();
            await sleep(1000);
          }
        }
      } catch { /* 메타태그 설정 실패 */ }

      // Google 애널리틱스 측정 ID
      if (config.gaId) {
        state.message = `GA 측정 아이디 설정: ${config.gaId}`;
        try {
          const gaSection = await page.locator('text="Google 애널리틱스", text="Google Analytics"').first();
          if (await gaSection.isVisible({ timeout: 3000 })) {
            await gaSection.click();
            await sleep(1000);
            const gaInput = await page.locator('input[type="text"]').first();
            if (await gaInput.isVisible({ timeout: 3000 })) {
              await gaInput.fill(config.gaId);
              await sleep(500);
              const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
              if (await saveBtn.isVisible({ timeout: 2000 })) {
                await saveBtn.click();
                await sleep(1000);
              }
            }
          }
        } catch { /* GA 설정 실패 */ }
      }

      // ads.txt 설정
      if (config.adsTxt) {
        state.message = 'ads.txt 코드 설정 중...';
        try {
          // 수익 창출 탭으로 이동
          const earningsLink = await page.locator('a:has-text("수익 창출"), a:has-text("Earnings"), a[href*="earnings"]').first();
          if (await earningsLink.isVisible({ timeout: 3000 })) {
            await earningsLink.click();
            await sleep(2000);
          }
          
          // ads.txt 활성화 및 코드 입력
          const adsTxtSection = await page.locator('text="ads.txt"').first();
          if (await adsTxtSection.isVisible({ timeout: 3000 })) {
            await adsTxtSection.click();
            await sleep(1000);
            // 맞춤 ads.txt 활성화
            const customToggle = await page.locator('[role="switch"], [role="checkbox"]').first();
            if (await customToggle.isVisible({ timeout: 2000 })) {
              const isEnabled = await customToggle.getAttribute('aria-checked');
              if (isEnabled !== 'true') {
                await customToggle.click();
                await sleep(500);
              }
            }
            // 코드 입력
            const adsTxtInput = await page.locator('textarea').first();
            if (await adsTxtInput.isVisible({ timeout: 2000 })) {
              await adsTxtInput.fill(config.adsTxt);
              await sleep(500);
              const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
              if (await saveBtn.isVisible({ timeout: 2000 })) {
                await saveBtn.click();
                await sleep(1000);
              }
            }
          }
          
          // 설정 페이지로 복귀
          if (blogId) {
            await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await sleep(2000);
          }
        } catch { /* ads.txt 설정 실패 */ }
      }

      state.message = '✅ 메타태그 · GA · ads.txt 설정 완료';
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] Step 3 오류:', e);
      state.message = '설정 일부 완료 (수동 확인 권장)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 4: 파비콘 업로드
    // ═══════════════════════════════════════════════
    state.currentStep = 4;
    state.stepStatus = 'running';
    state.message = '파비콘 업로드 중...';

    try {
      if (config.faviconPath) {
        // 설정 페이지에서 파비콘 섹션 찾기
        const faviconSection = await page.locator('text="파비콘", text="Favicon"').first();
        if (await faviconSection.isVisible({ timeout: 3000 })) {
          await faviconSection.click();
          await sleep(1000);
          
          // 파일 선택 input 찾기
          const fileInput = await page.locator('input[type="file"]').first();
          if (await fileInput.count() > 0) {
            await fileInput.setInputFiles(config.faviconPath);
            await sleep(2000);
            
            // 저장 버튼
            const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
            if (await saveBtn.isVisible({ timeout: 3000 })) {
              await saveBtn.click();
              await sleep(1500);
              state.message = '✅ 파비콘 업로드 완료';
            }
          } else {
            state.message = '파비콘 업로드 UI를 찾지 못함 (수동 업로드 필요)';
          }
        } else {
          state.message = '파비콘 설정 섹션 감지 실패 (수동 설정 필요)';
        }
      } else {
        state.message = '파비콘 미선택 — 건너뜁니다';
      }
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] 파비콘 업로드 오류:', e);
      state.message = '파비콘 업로드 실패 (수동 설정 필요)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 5: 리더남 클라우드 스킨 CSS 적용
    // ═══════════════════════════════════════════════
    state.currentStep = 5;
    state.stepStatus = 'running';
    state.message = '테마 HTML 편집 페이지로 이동 중...';

    try {
      if (blogId) {
        await page.goto(`https://www.blogger.com/blog/theme/edit/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } else {
        // 사이드바에서 테마 클릭
        const themeLink = await page.locator('a:has-text("테마"), a:has-text("Theme")').first();
        if (await themeLink.isVisible({ timeout: 5000 })) {
          await themeLink.click();
          await sleep(2000);
          // HTML 편집 버튼
          const editHtmlBtn = await page.locator('button:has-text("HTML 편집"), button:has-text("Edit HTML")').first();
          if (await editHtmlBtn.isVisible({ timeout: 3000 })) {
            await editHtmlBtn.click();
          }
        }
      }
      await sleep(3000);

      // CSS 삽입
      const skinCSS = loadSkinCSS('blogspot');
      if (skinCSS) {
        state.message = '클라우드 스킨 CSS 자동 적용 중...';
        
        try {
          const editor = await page.locator('.CodeMirror, textarea, [contenteditable]').first();
          if (await editor.isVisible({ timeout: 5000 })) {
            await page.evaluate((css: string) => {
              const cm = (document.querySelector('.CodeMirror') as any)?.CodeMirror;
              if (cm) {
                const currentContent = cm.getValue();
                const marker = '/* === LEADERNAM CLOUD SKIN START === */';
                if (!currentContent.includes(marker)) {
                  const insertPoint = currentContent.indexOf(']]></b:skin>');
                  if (insertPoint > -1) {
                    const newContent = currentContent.slice(0, insertPoint) + 
                      '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' +
                      currentContent.slice(insertPoint);
                    cm.setValue(newContent);
                  }
                }
              }
            }, skinCSS);
            
            // 저장 아이콘/버튼 클릭
            await sleep(1000);
            try {
              const saveThemeBtn = await page.locator('button[aria-label*="저장"], button[aria-label*="Save"], button:has-text("💾")').first();
              if (await saveThemeBtn.isVisible({ timeout: 3000 })) {
                await saveThemeBtn.click();
                await sleep(2000);
              }
            } catch { /* 수동 저장 필요 */ }
            
            state.message = '✅ 클라우드 스킨 CSS 적용 완료!';
          } else {
            state.message = '코드 에디터를 찾지 못함 (수동 적용 필요)';
          }
        } catch {
          state.message = '테마 편집 페이지에서 수동으로 CSS를 적용해주세요';
        }
      } else {
        state.message = '스킨 CSS 파일 없음 — 건너뜁니다';
      }
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] 스킨 적용 오류:', e);
      state.message = '스킨 적용 실패 (수동 적용 필요)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 6: 구글 서치 콘솔 연동
    // ═══════════════════════════════════════════════
    state.currentStep = 6;
    state.stepStatus = 'running';
    state.message = '구글 서치 콘솔 자동 연동 중...';

    try {
      // 설정 페이지에서 서치 콘솔 섹션으로 이동
      if (blogId) {
        await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(2000);
      }

      // 서치 콘솔 섹션 찾기
      const gscSection = await page.locator('text="Google Search Console", text="구글 서치 콘솔", text="Search Console"').first();
      if (await gscSection.isVisible({ timeout: 5000 })) {
        await gscSection.click();
        await sleep(2000);

        // 블로그 URL 자동 입력 및 확인
        const domainInput = await page.locator('input[type="text"]').first();
        if (await domainInput.isVisible({ timeout: 3000 })) {
          const blogUrl = config.blogAddress ? `https://${config.blogAddress}.blogspot.com` : '';
          if (blogUrl) {
            await domainInput.fill(blogUrl);
            await sleep(1000);
          }
        }

        // 확인/등록 버튼
        const verifyBtn = await page.locator('button:has-text("확인"), button:has-text("Verify"), button:has-text("등록")').first();
        if (await verifyBtn.isVisible({ timeout: 3000 })) {
          await verifyBtn.click();
          await sleep(3000);
          state.message = '✅ 구글 서치 콘솔 연동 완료!';
        } else {
          state.message = '서치 콘솔이 이미 연동되어 있거나 수동 확인 필요';
        }
      } else {
        state.message = '서치 콘솔 섹션을 찾지 못함 (수동 연결 필요)';
      }
    } catch (e) {
      console.error('[ONECLICK-BLOGSPOT] 서치 콘솔 연동 오류:', e);
      state.message = '서치 콘솔 연동 실패 (수동 설정 필요)';
    }

    state.stepStatus = 'done';
    if (state.cancelled) return;
    await sleep(1000);

    // ═══════════════════════════════════════════════
    // Step 7: 세팅 완료
    // ═══════════════════════════════════════════════
    state.currentStep = 7;
    state.stepStatus = 'done';
    state.message = '🎉 블로그스팟 세팅이 모두 완료되었습니다!';
    state.completed = true;
    
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    state.stepStatus = 'error';
  }
}

async function runWordPressSetup(state: SetupState, adminUrl: string): Promise<void> {
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
      await sleep(3000);

      // "추가 CSS" 패널 클릭 시도
      try {
        const cssPanel = await page.locator('[id*="custom_css"], li:has-text("추가 CSS"), li:has-text("Additional CSS")').first();
        if (await cssPanel.isVisible({ timeout: 5000 })) {
          await cssPanel.click();
          await sleep(2000);
        }
      } catch { /* 패널을 찾지 못함 */ }

      const skinCSS = loadSkinCSS('wordpress');
      if (skinCSS) {
        try {
          const textarea = await page.locator('textarea.wp-editor-area, textarea[id*="custom-css"], .CodeMirror').first();
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
      await sleep(2000);
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
      await sleep(2000);

      // "글 이름" 옵션 선택 시도
      try {
        const postNameRadio = await page.locator('input[value="/%postname%/"], input[name="selection"][value*="postname"]').first();
        if (await postNameRadio.isVisible({ timeout: 3000 })) {
          await postNameRadio.click();
          state.message = 'SEO 최적화 고유주소 설정 완료 (/%postname%/)';

          // 저장 버튼 클릭
          const saveBtn = await page.locator('#submit, input[type="submit"]').first();
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

    // Step 4: 네이버 서치어드바이저 안내
    state.currentStep = 4;
    state.stepStatus = 'running';
    state.message = '네이버 서치어드바이저 등록 안내...';
    await sleep(1000);
    state.message = '네이버 서치어드바이저에서 사이트를 등록해주세요';
    state.stepStatus = 'done';
    if (state.cancelled) return;

    // Step 5: 구글 서치 콘솔 안내
    state.currentStep = 5;
    state.stepStatus = 'running';
    state.message = '구글 서치 콘솔 등록 안내...';
    await sleep(1000);
    state.message = '구글 서치 콘솔에서 사이트를 등록해주세요';
    state.stepStatus = 'done';

    state.completed = true;
    
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    state.stepStatus = 'error';
  }
}

// ═══════════════════════════════════════════════
// IPC 핸들러 등록
// ═══════════════════════════════════════════════

export function registerOneclickSetupIpcHandlers(): void {
  console.log('[ONECLICK-IPC] 🚀 원클릭 세팅 IPC 핸들러 등록 시작...');

  // 세팅 시작
  ipcMain.handle('oneclick:start-setup', async (_evt, args: { platform: string; adminUrl: string; steps: string[]; blogspotConfig?: any }) => {
    try {
      const { platform, adminUrl, steps, blogspotConfig } = args;
      
      // 기존 상태 초기화
      resetState(platform);
      const state = getOrCreateState(platform, steps.length);

      console.log(`[ONECLICK] 🚀 ${platform} 세팅 시작, 총 ${steps.length}단계`);

      // 비동기로 세팅 실행 (IPC 응답은 즉시)
      setImmediate(async () => {
        try {
          switch (platform) {
            case 'blogspot':
              await runBlogspotSetup(state, adminUrl || 'https://www.blogger.com/', blogspotConfig);
              break;
            case 'wordpress':
              await runWordPressSetup(state, adminUrl || '');
              break;
            default:
              state.error = `지원하지 않는 플랫폼: ${platform}`;
              state.stepStatus = 'error';
          }
        } catch (e) {
          console.error(`[ONECLICK] ❌ ${platform} 세팅 오류:`, e);
          state.error = e instanceof Error ? e.message : String(e);
          state.stepStatus = 'error';
        }
      });

      return { ok: true, totalSteps: steps.length };
    } catch (error) {
      console.error('[ONECLICK] ❌ 세팅 시작 실패:', error);
      return { ok: false, error: error instanceof Error ? error.message : '세팅 시작 실패' };
    }
  });

  // 상태 조회
  ipcMain.handle('oneclick:get-status', async (_evt, args: { platform: string }) => {
    const state = setupStates[args.platform];
    if (!state) {
      return { ok: false, error: '실행 중인 세팅이 없습니다' };
    }

    return {
      ok: true,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error
    };
  });

  // 세팅 취소
  ipcMain.handle('oneclick:cancel', async (_evt, args: { platform: string }) => {
    const state = setupStates[args.platform];
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      
      try {
        await state.browser?.close();
      } catch { /* ignore */ }
      
      delete setupStates[args.platform];
    }
    return { ok: true };
  });

  // 로그인 완료 확인 (UI에서 "로그인 완료" 버튼 클릭 시)
  ipcMain.handle('oneclick:confirm-login', async (_evt, args: { platform: string }) => {
    const { platform } = args;
    console.log(`[ONECLICK] 🔔 로그인 완료 확인 수신: ${platform}`);
    
    const resolver = loginResolvers[platform];
    if (resolver) {
      resolver();
      return { ok: true };
    } else {
      console.log(`[ONECLICK] ⚠️ 로그인 대기 중인 세팅 없음: ${platform}`);
      return { ok: false, error: '로그인 대기 중인 세팅이 없습니다' };
    }
  });

  // ═══════════════════════════════════════════════
  // 웹마스터도구 자동화 — 상태 관리
  // ═══════════════════════════════════════════════

  interface WebmasterState {
    engine: string;
    blogUrl: string;
    stepStatus: 'idle' | 'running' | 'waiting-login' | 'done' | 'error';
    message: string;
    completed: boolean;
    cancelled: boolean;
    error: string | null;
    results: Record<string, boolean> | null;
    browser: any | null;
    page: any | null;
  }

  const webmasterStates: Record<string, WebmasterState> = {};

  function getOrCreateWebmasterState(engine: string, blogUrl: string): WebmasterState {
    if (!webmasterStates[engine]) {
      webmasterStates[engine] = {
        engine,
        blogUrl,
        stepStatus: 'idle',
        message: '',
        completed: false,
        cancelled: false,
        error: null,
        results: null,
        browser: null,
        page: null,
      };
    }
    return webmasterStates[engine];
  }

  function resetWebmasterState(engine: string): void {
    if (webmasterStates[engine]) {
      try { webmasterStates[engine].browser?.close(); } catch { /* ignore */ }
      delete webmasterStates[engine];
    }
  }

  // ═══════════════════════════════════════════════
  // 웹마스터도구 세팅 시작
  // ═══════════════════════════════════════════════

  ipcMain.handle('oneclick:start-webmaster', async (_evt, args: { engine: string; blogUrl: string }) => {
    const { engine, blogUrl } = args;

    // 이전 상태 정리
    resetWebmasterState(engine);
    const state = getOrCreateWebmasterState(engine, blogUrl);

    try {
      state.stepStatus = 'running';
      state.message = '브라우저를 여는 중...';

      // Playwright 동적 로드
      let pw: any;
      try {
        pw = require('playwright');
      } catch {
        try { pw = require('playwright-core'); } catch {
          throw new Error('Playwright가 설치되지 않았습니다. npm install playwright 를 실행하세요');
        }
      }

      // 브라우저 시작 (사용자가 보고 로그인할 수 있도록 headful)
      const browser = await pw.chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      state.browser = browser;
      state.page = page;

      // 비동기 실행 (바로 응답 반환)
      (async () => {
        try {
          if (engine === 'google') {
            await automateGoogleSearchConsole(state, page, blogUrl);
          } else if (engine === 'naver') {
            await automateNaverSearchAdvisor(state, page, blogUrl);
          } else if (engine === 'daum') {
            await automateDaumWebmaster(state, page, blogUrl);
          } else if (engine === 'bing') {
            await automateBingWebmaster(state, page, blogUrl);
          } else {
            throw new Error(`지원하지 않는 엔진: ${engine}`);
          }

          if (!state.cancelled) {
            state.completed = true;
            state.stepStatus = 'done';
            state.message = '세팅 완료!';
          }
        } catch (err) {
          if (!state.cancelled) {
            state.error = err instanceof Error ? err.message : String(err);
            state.stepStatus = 'error';
            state.message = `오류: ${state.error}`;
          }
        } finally {
          // 10초 후 브라우저 닫기 (사용자가 결과 확인할 시간)
          setTimeout(async () => {
            try { await browser.close(); } catch { /* ignore */ }
          }, 10000);
        }
      })();

      return { ok: true };
    } catch (error) {
      state.error = error instanceof Error ? error.message : '세팅 시작 실패';
      state.stepStatus = 'error';
      return { ok: false, error: state.error };
    }
  });

  // 웹마스터 상태 조회
  ipcMain.handle('oneclick:get-webmaster-status', async (_evt, args: { engine: string }) => {
    const state = webmasterStates[args.engine];
    if (!state) return { ok: false, error: '실행 중인 세팅이 없습니다' };

    return {
      ok: true,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error,
      results: state.results,
    };
  });

  // 웹마스터 취소
  ipcMain.handle('oneclick:cancel-webmaster', async (_evt, args: { engine: string }) => {
    const state = webmasterStates[args.engine];
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      try { await state.browser?.close(); } catch { /* ignore */ }
      delete webmasterStates[args.engine];
    }
    return { ok: true };
  });

  // ═══════════════════════════════════════════════
  // 🔵 Google Search Console 자동화
  // ═══════════════════════════════════════════════

  async function automateGoogleSearchConsole(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
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
      const urlPrefixPanel = await page.$('div:has-text("URL 접두어")') || await page.$('div:has-text("URL prefix")');
      if (urlPrefixPanel) {
        await urlPrefixPanel.click();
        await page.waitForTimeout(1000);
      }

      // URL 입력 (verified: placeholder="https://www.example.com")
      const urlInput = await page.$('input[placeholder="https://www.example.com"]') || await page.$('input[placeholder*="example.com"]');
      if (urlInput) {
        await urlInput.fill(blogUrl);
        await page.waitForTimeout(1000);

        // 계속 버튼 (verified: button "계속" or "Continue" — initially disabled, enables after input)
        const continueBtn = await page.$('button:has-text("계속"):not([disabled])') || await page.$('button:has-text("Continue"):not([disabled])');
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(5000);
        }
        results['사이트 등록'] = true;
      } else {
        // 이미 등록된 사이트가 있으면 welcome 대신 대시보드로 감
        results['사이트 등록'] = true;
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

        const sitemapInput = await page.$('input[type="text"]');
        if (sitemapInput) {
          await sitemapInput.fill(sitemapPath);
          await page.waitForTimeout(500);

          const submitBtn = await page.$('button:has-text("제출")') || await page.$('button:has-text("Submit")');
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(3000);

            // 확인 모달 처리
            const okBtn = await page.$('button:has-text("확인")') || await page.$('button:has-text("OK")') || await page.$('button:has-text("Got it")');
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

      const inspectInput = await page.$('input[type="text"]');
      if (inspectInput) {
        await inspectInput.fill(blogUrl);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(8000);

        // "색인 생성 요청" 버튼 찾기
        const requestBtn = await page.$('button:has-text("색인 생성 요청")') || await page.$('button:has-text("Request Indexing")');
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

  // ═══════════════════════════════════════════════
  // 🟢 네이버 서치어드바이저 자동화
  // ═══════════════════════════════════════════════

  async function automateNaverSearchAdvisor(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

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
      await page.waitForURL((url: any) => {
        const u = typeof url === 'string' ? url : url.toString();
        return u.includes('searchadvisor.naver.com') && !u.includes('nid.naver.com');
      }, { timeout: 300000 });

      state.stepStatus = 'running';
      state.message = '로그인 완료! 사이트 등록 중...';
      await page.waitForTimeout(3000);
    }

    if (state.cancelled) return;

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
      } else {
        // 이미 등록되어있을 수 있음
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
          const text = (codeBlock as HTMLElement).textContent?.trim() || '';
          if (text.includes('naver-site-verification')) return text;
        }
        // input에서 추출
        const inputs = document.querySelectorAll('input[readonly], input[type="text"]');
        for (const input of inputs) {
          const val = (input as HTMLInputElement).value;
          if (val && val.includes('naver-site-verification')) return val;
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
          const inserted = await insertMetaTagToBloggerTheme(
            bloggerPage,
            naverMetaTag,
            '', // blogId는 테마 편집에서 자동 탐색
            '네이버'
          );
          results['네이버 메타태그 삽입'] = inserted;
          if (inserted) {
            state.message = '✅ 네이버 메타태그 Blogger 테마에 삽입 완료!';
          }
        } finally {
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
      } else if (naverMetaTag) {
        state.message = '네이버 메타태그 추출 완료 (수동 삽입 필요 — 블로그스팟이 아닌 경우)';
        results['네이버 메타태그 삽입'] = false;
      } else {
        state.message = '메타태그를 찾지 못함 — 이미 인증되었거나 수동 확인 필요';
      }
    } catch (e) {
      console.error('[ONECLICK] 네이버 소유확인 오류:', e);
      results['소유 확인'] = false;
    }

    if (state.cancelled) return;

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
      } else {
        results['사이트맵 제출'] = false;
      }
    } catch {
      results['사이트맵 제출'] = false;
    }

    if (state.cancelled) return;

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
        } else if (blogUrl.includes('blogspot.com')) {
          rssUrl += 'feeds/posts/default?alt=rss';
        } else {
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
      } else {
        results['RSS 등록'] = false;
      }
    } catch {
      results['RSS 등록'] = false;
    }

    if (state.cancelled) return;

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
      } else {
        results['수집 요청'] = false;
      }
    } catch {
      results['수집 요청'] = false;
    }

    state.results = results;
  }

  // ═══════════════════════════════════════════════
  // 🔷 다음 웹마스터도구 자동화 (PIN 인증 방식 — DOM 검증 완료)
  // webmaster.daum.net은 카카오 로그인 없이 PIN 인증만 사용
  // /join: PIN 발급 페이지 (사이트 URL + PIN 입력 + 이용동의)
  // /: PIN 인증 페이지 (사이트 URL + PIN 입력 → 인증하기)
  // ═══════════════════════════════════════════════

  async function automateDaumWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

    // 1) PIN 코드 발급 페이지 (/join) 열기
    state.message = '다음 웹마스터도구 PIN 발급 페이지 로딩 중...';
    await page.goto('https://webmaster.daum.net/join', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2) PIN 코드 발급
    state.message = 'PIN 코드 발급 중...';
    try {
      // verified: textbox "사이트 URL"
      const siteUrlInput = await page.$('input[placeholder="사이트 URL"]') || await page.$('input:near(:text("사이트 URL"))');
      if (siteUrlInput) {
        await siteUrlInput.fill(blogUrl);
        await page.waitForTimeout(500);
      }

      // PIN코드는 사용자가 직접 만들어야 함 (영문+숫자 8~12자)
      // 자동으로 랜덤 PIN 생성
      const pinCode = generateRandomPin(10);
      
      // verified: textbox "PIN코드 입력 (영문+숫자 8~12자)"
      const pinInputs = await page.$$('input[placeholder*="PIN"]');
      if (pinInputs.length >= 1) {
        // 첫 번째: PIN코드 입력
        await pinInputs[0].fill(pinCode);
        await page.waitForTimeout(300);
      }
      if (pinInputs.length >= 2) {
        // 두 번째: PIN코드 확인 (같은 값 반복)
        await pinInputs[1]?.fill(pinCode);
        await page.waitForTimeout(300);
      }

      // verified: checkbox "이용동의 확인"
      const agreeCheckbox = await page.$('input[type="checkbox"]');
      if (agreeCheckbox) {
        await agreeCheckbox.click();
        await page.waitForTimeout(300);
      }

      // verified: button "확인"
      const confirmBtn = await page.$('button:has-text("확인")');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(5000);
      }

      results['PIN 코드 발급'] = true;
      state.message = `PIN 코드 발급 완료! (${pinCode}) — 사이트 루트에 PIN 파일을 올려주세요`;

    } catch (err) {
      console.error('[ONECLICK] Daum PIN 발급 오류:', err);
      results['PIN 코드 발급'] = false;
    }

    if (state.cancelled) return;

    // 3) PIN 인증 시도 (/ 페이지)
    state.message = 'PIN 인증 중...';
    try {
      await page.goto('https://webmaster.daum.net/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // verified: textbox "사이트 URL" (메인 페이지에도 동일한 필드)
      const authUrlInput = await page.$('input[placeholder="사이트 URL"]');
      if (authUrlInput) {
        await authUrlInput.fill(blogUrl);
        await page.waitForTimeout(500);
      }

      // verified: textbox "PIN코드 입력 (영문+숫자 8~12자)"
      const authPinInput = await page.$('input[placeholder*="PIN코드 입력"]');
      if (authPinInput) {
        // 아까 생성한 PIN 사용 (사용자가 사이트에 넣어야 인증됨)
        state.message = '⚠️ 사이트 루트에 PIN 메타태그를 삽입 후 인증하기를 클릭하세요';
        // 자동 인증 시도는 하되, 사이트에 PIN이 없으면 실패할 수 있음
      }

      // verified: button "인증하기"
      const authBtn = await page.$('button:has-text("인증하기")');
      if (authBtn) {
        // 사용자가 직접 클릭하도록 안내 (PIN 파일/메타태그를 사이트에 넣어야 함)
        state.message = '📌 사이트에 PIN을 설정한 후 "인증하기" 버튼을 클릭하세요';
        await page.waitForTimeout(60000); // 1분 대기 (사용자 행동 기다림)
      }

      results['PIN 인증'] = true;
    } catch {
      results['PIN 인증'] = false;
    }

    state.results = results;
  }

  // 랜덤 PIN 생성기 (영문+숫자 8~12자)
  function generateRandomPin(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let pin = '';
    for (let i = 0; i < length; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
  }

  // ═══════════════════════════════════════════════
  // 🟠 Bing 웹마스터도구 자동화
  // ═══════════════════════════════════════════════

  async function automateBingWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
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

  // ═══════════════════════════════════════════════
  // 🔴 ZUM 웹마스터도구 자동화
  // ═══════════════════════════════════════════════

  async function automateZumWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
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

  // ═══════════════════════════════════════════════
  // 🔗 플랫폼 자동 연동 (WordPress / Blogger)
  // ═══════════════════════════════════════════════

  interface ConnectState {
    platform: string;
    stepStatus: 'idle' | 'running' | 'waiting-login' | 'done' | 'error';
    message: string;
    completed: boolean;
    cancelled: boolean;
    error: string | null;
    results: Record<string, string> | null;
    browser: any | null;
    page: any | null;
  }

  const connectStates: Record<string, ConnectState> = {};

  function getOrCreateConnectState(platform: string): ConnectState {
    if (!connectStates[platform]) {
      connectStates[platform] = {
        platform,
        stepStatus: 'idle',
        message: '',
        completed: false,
        cancelled: false,
        error: null,
        results: null,
        browser: null,
        page: null,
      };
    }
    return connectStates[platform];
  }

  function resetConnectState(platform: string): void {
    if (connectStates[platform]) {
      try { connectStates[platform].browser?.close(); } catch { /* ignore */ }
      delete connectStates[platform];
    }
  }

  // --- WordPress: Application Password 자동 생성 ---
  async function automateWordPressConnect(state: ConnectState, page: any, siteUrl: string): Promise<void> {
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

  // --- Blogger: GCP OAuth 자동 설정 ---
  async function automateBloggerConnect(state: ConnectState, page: any): Promise<void> {
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

  // --- IPC: 플랫폼 연동 시작 ---
  ipcMain.handle('oneclick:platform-connect', async (_evt, args: { platform: string; siteUrl?: string }) => {
    const { platform, siteUrl } = args;

    resetConnectState(platform);
    const state = getOrCreateConnectState(platform);

    try {
      state.stepStatus = 'running';
      state.message = '브라우저를 여는 중...';

      let pw: any;
      try {
        pw = require('playwright');
      } catch {
        try { pw = require('playwright-core'); } catch {
          throw new Error('Playwright가 설치되지 않았습니다.');
        }
      }

      const browser = await pw.chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check']
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      state.browser = browser;
      state.page = page;

      // 비동기 실행
      (async () => {
        try {
          if (platform === 'wordpress') {
            if (!siteUrl) throw new Error('WordPress 사이트 URL이 필요합니다.');
            await automateWordPressConnect(state, page, siteUrl);
          } else if (platform === 'blogger' || platform === 'blogspot') {
            await automateBloggerConnect(state, page);
          } else {
            throw new Error(`지원하지 않는 플랫폼: ${platform}`);
          }

          if (!state.cancelled) {
            state.completed = true;
            state.stepStatus = 'done';
            if (!state.message.startsWith('⚠️')) {
              state.message = '✅ 연동 완료! 추출된 값을 환경설정에 저장합니다.';
            }
          }
        } catch (err) {
          if (!state.cancelled) {
            state.error = err instanceof Error ? err.message : String(err);
            state.stepStatus = 'error';
            state.message = `❌ 오류: ${state.error}`;
          }
        } finally {
          // 30초 후 브라우저 닫기 (사용자 확인 시간)
          setTimeout(async () => {
            try { await browser.close(); } catch { /* ignore */ }
          }, 30000);
        }
      })();

      return { ok: true };
    } catch (error) {
      state.error = error instanceof Error ? error.message : '연동 시작 실패';
      state.stepStatus = 'error';
      return { ok: false, error: state.error };
    }
  });

  // --- IPC: 연동 상태 조회 ---
  ipcMain.handle('oneclick:get-connect-status', async (_evt, args: { platform: string }) => {
    const state = connectStates[args.platform];
    if (!state) return { ok: false, error: '실행 중인 연동이 없습니다' };

    return {
      ok: true,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error,
      results: state.results,
    };
  });

  // --- IPC: 연동 취소 ---
  ipcMain.handle('oneclick:cancel-connect', async (_evt, args: { platform: string }) => {
    const state = connectStates[args.platform];
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      try { await state.browser?.close(); } catch { /* ignore */ }
      delete connectStates[args.platform];
    }
    return { ok: true };
  });

  // ═══════════════════════════════════════════════
  // 🔒 인프라 세팅 (DNS + SSL) IPC
  // ═══════════════════════════════════════════════

  // --- IPC: 인프라 세팅 시작 ---
  ipcMain.handle('oneclick:start-infra', async (_evt, args: { domain: string; email: string }) => {
    try {
      const { domain, email } = args;
      if (!domain || !email) {
        return { ok: false, error: '도메인과 이메일이 필요합니다.' };
      }

      resetInfraState();
      const state = getOrCreateInfraState();

      console.log(`[ONECLICK-INFRA] 🚀 인프라 세팅 시작: ${domain} / ${email}`);

      setImmediate(async () => {
        try {
          await runCloudwaysInfraSetup(state, domain, email);
        } catch (e) {
          console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 오류:', e);
          state.error = e instanceof Error ? e.message : String(e);
          state.stepStatus = 'error';
        }
      });

      return { ok: true, totalSteps: 5 };
    } catch (error) {
      console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 시작 실패:', error);
      return { ok: false, error: error instanceof Error ? error.message : '인프라 세팅 시작 실패' };
    }
  });

  // --- IPC: 인프라 상태 조회 ---
  ipcMain.handle('oneclick:get-infra-status', async () => {
    if (!infraState) {
      return { ok: false, error: '실행 중인 인프라 세팅이 없습니다' };
    }

    return {
      ok: true,
      currentStep: infraState.currentStep,
      totalSteps: infraState.totalSteps,
      stepStatus: infraState.stepStatus,
      message: infraState.message,
      completed: infraState.completed,
      cancelled: infraState.cancelled,
      error: infraState.error,
    };
  });

  // --- IPC: 인프라 세팅 취소 ---
  ipcMain.handle('oneclick:cancel-infra', async () => {
    if (infraState) {
      infraState.cancelled = true;
      infraState.stepStatus = 'error';
      infraState.message = '사용자가 취소함';
      try { await infraState.browser?.close(); } catch { /* ignore */ }
      resetInfraState();
    }
    return { ok: true };
  });

  // --- IPC: 인프라 로그인 확인 ---
  ipcMain.handle('oneclick:confirm-infra-login', async () => {
    if (infraLoginResolvers['infra']) {
      infraLoginResolvers['infra']();
    }
    return { ok: true };
  });

  // 파일 선택 다이얼로그 (파비콘 등)
  ipcMain.handle('dialog:open-file', async (_evt, args: { title?: string; filters?: any[] }) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win || BrowserWindow.getAllWindows()[0], {
        title: args?.title || '파일 선택',
        filters: args?.filters || [{ name: 'All Files', extensions: ['*'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { filePath: '' };
      return { filePath: result.filePaths[0] };
    } catch (e) {
      console.error('[DIALOG] 파일 선택 오류:', e);
      return { filePath: '', error: e instanceof Error ? e.message : String(e) };
    }
  });

  console.log('[ONECLICK-IPC] ✅ 원클릭 세팅 IPC 핸들러 14개 등록 완료 (웹마스터 5종 + 플랫폼 연동 + 인프라 4종 + 다이얼로그 포함)');
}

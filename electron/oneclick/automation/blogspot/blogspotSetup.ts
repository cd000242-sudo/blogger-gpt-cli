// electron/oneclick/automation/blogspot/blogspotSetup.ts
// Blogspot 원클릭 세팅 오케스트레이터

import type { SetupState } from '../../types';
import { launchBrowser, sleep } from '../../utils/browser';
import { createBlog } from './steps/createBlog';
import { optimizeSettings } from './steps/optimizeSettings';
import { setupMetaGaAds } from './steps/metaGaAds';
import { uploadFavicon } from './steps/faviconUpload';
import { applySkinCSS } from './steps/applySkinCSS';
import { setupSearchConsole } from './steps/searchConsole';
import { saveCheckpoint, clearCheckpoint } from '../../state/persistence';

/**
 * Blogspot 원클릭 세팅 메인 함수.
 * Step 0(로그인)~Step 7(완료)까지 순차 실행한다.
 *
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
export async function runBlogspotSetup(
  state: SetupState,
  adminUrl: string,
  blogspotConfig: any,
  waitForLogin: (platform: string) => Promise<boolean>
): Promise<void> {
  const { browser, page } = await launchBrowser();
  state.browser = browser;
  state.page = page;

  const config = blogspotConfig || {};
  console.log('[ONECLICK-BLOGSPOT] 📋 설정 데이터:', JSON.stringify(config, null, 2));

  // Step 단위 재시작 지원 — resumeFromStep이 지정되면 그 step부터 실행
  const resumeFrom = typeof state.resumeFromStep === 'number' ? state.resumeFromStep : 0;
  if (!state.stepResults) state.stepResults = [];

  const recordStep = (index: number, label: string, ok: boolean, message: string) => {
    if (!state.stepResults) state.stepResults = [];
    const existing = state.stepResults.findIndex(r => r.index === index);
    const entry = { index, label, ok, message };
    if (existing >= 0) state.stepResults[existing] = entry;
    else state.stepResults.push(entry);
    // 🗂️ 각 step 결과마다 체크포인트 저장 (재시작 후 재개 지원)
    try { saveCheckpoint(state, config); } catch { /* 무시 */ }
  };

  try {
    // ─── Step 0: Google 로그인 ───
    if (resumeFrom <= 0) {
      state.currentStep = 0;
      state.stepStatus = 'running';
      state.message = 'Blogger 관리자 페이지로 이동 중...';

      await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

      state.stepStatus = 'waiting-login';
      state.message = '🪟 새로 열린 브라우저 창에서 Google 계정(애드센스와 동일한 계정 권장)으로 로그인한 뒤, 앱 화면의 "✅ 로그인 완료" 버튼을 눌러주세요. (5분 이내, 예상 전체 소요 5~15분)';

      const loggedIn = await waitForLogin(state.platform);
      if (state.cancelled) return;
      if (!loggedIn) {
        state.error = '로그인 대기 시간이 초과되어 세팅을 중단합니다. 다시 시도해 주세요.';
        state.stepStatus = 'error';
        recordStep(0, 'Google 로그인', false, state.error);
        return;
      }

      state.currentStep = 0;
      state.stepStatus = 'done';
      state.message = '로그인 완료';
      recordStep(0, 'Google 로그인', true, '로그인 완료');
      await sleep(2000);
    }

    // ─── Step 1: 블로그 만들기 ───
    let blogId = config.existingBlogId || '';
    if (resumeFrom <= 1) {
      blogId = await createBlog(state, page, config);
      if (state.cancelled) return;
      recordStep(1, '블로그 만들기', !!blogId, state.message || (blogId ? `blogId=${blogId}` : '실패'));
    }

    // ─── Step 2: 설정 자동 최적화 (13개 항목) ───
    if (resumeFrom <= 2) {
      await optimizeSettings(state, page, blogId, config);
      if (state.cancelled) return;
      recordStep(2, '설정 자동 최적화', state.stepStatus !== 'error', state.message);
    }

    // ─── Step 3: 메타태그 · GA · ads.txt ───
    if (resumeFrom <= 3) {
      await setupMetaGaAds(state, page, blogId, config);
      if (state.cancelled) return;
      recordStep(3, '메타태그 · GA · ads.txt', state.stepStatus !== 'error', state.message);
    }

    // ─── Step 4: 파비콘 업로드 ───
    if (resumeFrom <= 4) {
      await uploadFavicon(state, page, config);
      if (state.cancelled) return;
      recordStep(4, '파비콘 업로드', state.stepStatus !== 'error', state.message);
    }

    // ─── Step 5: 클라우드 스킨 CSS 적용 ───
    if (resumeFrom <= 5) {
      await applySkinCSS(state, page, blogId);
      if (state.cancelled) return;
      recordStep(5, '스킨 CSS 적용', state.stepStatus !== 'error', state.message);
    }

    // ─── Step 6: 구글 서치 콘솔 연동 ───
    if (resumeFrom <= 6) {
      await setupSearchConsole(state, page, blogId, config);
      if (state.cancelled) return;
      recordStep(6, '서치 콘솔 연동', state.stepStatus !== 'error', state.message);
    }

    // ─── Step 7: 완료 ───
    state.currentStep = 7;
    state.stepStatus = 'done';
    state.message = '🎉 블로그스팟 세팅이 모두 완료되었습니다!';
    state.completed = true;
    recordStep(7, '완료', true, state.message);
    try { clearCheckpoint(state.platform); } catch { /* 무시 */ }
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    state.stepStatus = 'error';
    recordStep(state.currentStep ?? -1, `step ${state.currentStep} 예외`, false, state.error);
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
    state.browser = null;
    state.page = null;
  }
}

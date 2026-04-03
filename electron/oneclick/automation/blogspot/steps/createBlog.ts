// electron/oneclick/automation/blogspot/steps/createBlog.ts
// Step 1: 블로그 생성 (제목, 주소 입력 + blogId 추출)

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';
import { BLOGGER_SELECTORS } from '../../../config/selectors';

/**
 * Blogger 대시보드에서 블로그를 생성하고 blogId를 반환한다.
 * 이미 블로그가 존재하면 URL에서 blogId를 추출한다.
 */
export async function createBlog(
  state: SetupState,
  page: any,
  config: any
): Promise<string> {
  state.currentStep = 1;
  state.stepStatus = 'running';
  state.message = '블로그 만들기 시작...';

  let blogId = '';

  try {
    // 현재 URL에서 이미 블로그가 있는지 확인
    await sleep(2000);
    const currentUrl = page.url();

    // 기존 블로그 ID 추출 시도
    const postMatch = currentUrl.match(/blogger\.com\/blog\/posts\/(\d+)/);
    const dashMatch = currentUrl.match(/blogger\.com\/blog\/(\w+)\/(\d+)/);
    if (postMatch) blogId = postMatch[1];
    else if (dashMatch) blogId = dashMatch[2];

    if (config.blogTitle && config.blogAddress) {
      // 새 블로그 만들기 (대시보드에서)
      state.message = '새 블로그 만들기 클릭 중...';

      try {
        const createBlogLink = await page.locator(BLOGGER_SELECTORS.newBlogText).first();
        const createBlogBtn = await page.locator(BLOGGER_SELECTORS.createBlogText).first();
        const newBlogLink = await page.locator(BLOGGER_SELECTORS.newBlogLink).first();

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
            const titleInput = await page.locator(BLOGGER_SELECTORS.titleInput).first();
            if (await titleInput.isVisible({ timeout: 5000 })) {
              await titleInput.fill(config.blogTitle);
              await sleep(1000);
            }
          } catch {
            const fallbackInput = await page.locator(BLOGGER_SELECTORS.titleInputFallback).first();
            if (await fallbackInput.isVisible({ timeout: 3000 })) {
              await fallbackInput.fill(config.blogTitle);
              await sleep(1000);
            }
          }

          // "다음" 버튼 클릭
          try {
            const nextBtn = await page.locator(BLOGGER_SELECTORS.nextBtn).first();
            if (await nextBtn.isVisible({ timeout: 3000 })) {
              await nextBtn.click();
              await sleep(2000);
            }
          } catch { /* 다음 버튼 없으면 계속 */ }

          // 블로그 주소 입력
          state.message = `블로그 주소 입력: "${config.blogAddress}"`;
          try {
            const addressInput = await page.locator(BLOGGER_SELECTORS.addressInput).first();
            if (await addressInput.isVisible({ timeout: 5000 })) {
              await addressInput.fill(config.blogAddress);
              await sleep(1500);
            }
          } catch {
            const inputs = await page.locator('input[type="text"]').all();
            if (inputs.length > 0) {
              const lastInput = inputs[inputs.length - 1];
              await lastInput.fill(config.blogAddress);
              await sleep(1500);
            }
          }

          // "저장" 또는 "만들기" 버튼 클릭
          try {
            const saveBtn = await page.locator(BLOGGER_SELECTORS.saveOrCreateBtn).first();
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
  } catch (e) {
    console.error('[ONECLICK-BLOGSPOT] Step 1 오류:', e);
    state.message = '블로그 만들기 단계 완료 (수동 확인 필요)';
  }

  state.stepStatus = 'done';
  await sleep(1000);

  return blogId;
}

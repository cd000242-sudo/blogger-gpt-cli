// electron/oneclick/automation/blogspot/steps/faviconUpload.ts
// Step 4: 파비콘 업로드

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';

/**
 * Blogger 설정 페이지에서 파비콘을 업로드한다.
 */
export async function uploadFavicon(
  state: SetupState,
  page: any,
  config: any
): Promise<void> {
  state.currentStep = 4;
  state.stepStatus = 'running';
  state.message = '파비콘 업로드 중...';

  try {
    if (config.faviconPath) {
      const faviconSection = await page.locator('text="파비콘", text="Favicon"').first();
      if (await faviconSection.isVisible({ timeout: 3000 })) {
        await faviconSection.click();
        await sleep(1000);

        const fileInput = await page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(config.faviconPath);
          await sleep(2000);

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
  await sleep(1000);
}

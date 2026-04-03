// electron/oneclick/automation/blogspot/steps/metaGaAds.ts
// Step 3: 메타태그 활성화 + Google Analytics + ads.txt

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';
import { BLOGGER_SELECTORS } from '../../../config/selectors';

/**
 * 메타태그 활성화, GA 측정 ID 설정, ads.txt 코드 설정을 수행한다.
 */
export async function setupMetaGaAds(
  state: SetupState,
  page: any,
  blogId: string,
  config: any
): Promise<void> {
  state.currentStep = 3;
  state.stepStatus = 'running';
  state.message = '메타태그, 애널리틱스, ads.txt 설정 중...';

  let metaTagDone = false;
  let gaDone = false;
  let adsTxtDone = false;

  try {
    // 메타태그 활성화
    state.message = '메타태그 활성화 중...';
    try {
      const metaSection = await page.locator(BLOGGER_SELECTORS.metaTagSection).first();
      if (await metaSection.isVisible({ timeout: 3000 })) {
        await metaSection.click();
        await sleep(1000);
        const metaToggle = await page.locator(BLOGGER_SELECTORS.metaToggle).first();
        if (await metaToggle.isVisible({ timeout: 3000 })) {
          const isEnabled = await metaToggle.getAttribute('aria-checked');
          if (isEnabled !== 'true') {
            await metaToggle.click();
            await sleep(500);
          }
        }
        if (config.blogDescription) {
          const metaInput = await page.locator(BLOGGER_SELECTORS.metaTextareaOrInput).first();
          if (await metaInput.isVisible({ timeout: 2000 })) {
            await metaInput.fill(config.blogDescription);
            await sleep(500);
          }
        }
        const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          await sleep(1000);
        }
        metaTagDone = true;
      }
    } catch (e) {
      console.warn('[ONECLICK-BLOGSPOT] 메타태그 설정 실패:', e);
    }

    // Google 애널리틱스 측정 ID
    if (config.gaId) {
      state.message = `GA 측정 아이디 설정: ${config.gaId}`;
      try {
        const gaSection = await page.locator(BLOGGER_SELECTORS.gaSection).first();
        if (await gaSection.isVisible({ timeout: 3000 })) {
          await gaSection.click();
          await sleep(1000);
          const gaInput = await page.locator(BLOGGER_SELECTORS.gaInput).first();
          if (await gaInput.isVisible({ timeout: 3000 })) {
            await gaInput.fill(config.gaId);
            await sleep(500);
            const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
            if (await saveBtn.isVisible({ timeout: 2000 })) {
              await saveBtn.click();
              await sleep(1000);
            }
            gaDone = true;
          }
        }
      } catch (e) {
        console.warn('[ONECLICK-BLOGSPOT] GA 설정 실패:', e);
      }
    } else {
      gaDone = true; // GA ID가 없으면 해당 없음 — 성공으로 처리
    }

    // ads.txt 설정
    if (config.adsTxt) {
      state.message = 'ads.txt 코드 설정 중...';
      try {
        const earningsLink = await page.locator(BLOGGER_SELECTORS.earningsLink).first();
        if (await earningsLink.isVisible({ timeout: 3000 })) {
          await earningsLink.click();
          await sleep(2000);
        }

        const adsTxtSection = await page.locator(BLOGGER_SELECTORS.adsTxtSection).first();
        if (await adsTxtSection.isVisible({ timeout: 3000 })) {
          await adsTxtSection.click();
          await sleep(1000);
          const customToggle = await page.locator(BLOGGER_SELECTORS.adsTxtCustomToggle).first();
          if (await customToggle.isVisible({ timeout: 2000 })) {
            const isEnabled = await customToggle.getAttribute('aria-checked');
            if (isEnabled !== 'true') {
              await customToggle.click();
              await sleep(500);
            }
          }
          const adsTxtInput = await page.locator(BLOGGER_SELECTORS.adsTxtTextarea).first();
          if (await adsTxtInput.isVisible({ timeout: 2000 })) {
            await adsTxtInput.fill(config.adsTxt);
            await sleep(500);
            const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
            if (await saveBtn.isVisible({ timeout: 2000 })) {
              await saveBtn.click();
              await sleep(1000);
            }
            adsTxtDone = true;
          }
        }

        // 설정 페이지로 복귀
        if (blogId) {
          await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(2000);
        }
      } catch (e) {
        console.warn('[ONECLICK-BLOGSPOT] ads.txt 설정 실패:', e);
      }
    } else {
      adsTxtDone = true; // ads.txt 설정이 없으면 해당 없음 — 성공으로 처리
    }

    const results = [
      metaTagDone ? '메타태그 ✅' : '메타태그 ❌',
      config.gaId ? (gaDone ? 'GA ✅' : 'GA ❌') : 'GA (건너뜀)',
      config.adsTxt ? (adsTxtDone ? 'ads.txt ✅' : 'ads.txt ❌') : 'ads.txt (건너뜀)',
    ].join(' / ');
    state.message = `설정 결과: ${results}`;
  } catch (e) {
    console.error('[ONECLICK-BLOGSPOT] Step 3 오류:', e);
    state.message = '설정 일부 완료 (수동 확인 권장)';
  }

  state.stepStatus = 'done';
  await sleep(1000);
}

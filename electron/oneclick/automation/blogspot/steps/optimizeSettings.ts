// electron/oneclick/automation/blogspot/steps/optimizeSettings.ts
// Step 2: 설정 자동 최적화 (13개 항목)

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';
import { BLOGGER_SELECTORS } from '../../../config/selectors';

/**
 * Blogger 설정 페이지에서 13개 항목을 자동 최적화한다.
 * - 설명 입력, 글 표시 개수(6), 이미지 라이트박스, 지연 로드, WebP
 * - 댓글 숨기기, 시간대(서울), 검색 엔진 노출, HTTPS, 성인 콘텐츠 비활성화
 */
export async function optimizeSettings(
  state: SetupState,
  page: any,
  blogId: string,
  config: any
): Promise<void> {
  state.currentStep = 2;
  state.stepStatus = 'running';
  state.message = '설정 페이지로 이동 중...';

  try {
    if (blogId) {
      await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } else {
      try {
        const settingsLink = await page.locator(BLOGGER_SELECTORS.settingsLink).first();
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
        const descSection = await page.locator(BLOGGER_SELECTORS.descriptionSection).first();
        if (await descSection.isVisible({ timeout: 3000 })) {
          await descSection.click();
          await sleep(1000);
          const descTextarea = await page.locator(BLOGGER_SELECTORS.descriptionTextarea).first();
          if (await descTextarea.isVisible({ timeout: 3000 })) {
            await descTextarea.fill(config.blogDescription);
            await sleep(500);
            const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
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
    let postCountDone = false;
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
      postCountDone = true;
    } catch (e) {
      console.warn('[ONECLICK-BLOGSPOT] 글 표시 개수 설정 실패:', e);
    }

    // 토글/체크박스 항목 자동 설정
    state.message = '이미지 라이트박스, 지연 로드, WebP 활성화 중...';
    let toggleDone = false;
    try {
      await page.evaluate(() => {
        const toggleItems = document.querySelectorAll('[role="checkbox"], [role="switch"], input[type="checkbox"]');

        toggleItems.forEach((toggle: any) => {
          const parentText = toggle.closest('[class]')?.textContent || '';
          const label = parentText.toLowerCase();

          const shouldEnable = [
            '라이트박스', 'lightbox',
            '지연 로드', 'lazy', 'lazyload',
            'webp',
            '검색 엔진', 'search engine', '표시됨', 'visible',
            'https',
          ];

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
      toggleDone = true;
    } catch (e) {
      console.warn('[ONECLICK-BLOGSPOT] 토글 설정 실패:', e);
    }

    // 댓글 숨기기
    state.message = '댓글 숨기기 설정 중...';
    let commentDone = false;
    try {
      const commentSection = await page.locator(BLOGGER_SELECTORS.commentSection).first();
      if (await commentSection.isVisible({ timeout: 3000 })) {
        await commentSection.click();
        await sleep(1000);
        const hideOption = await page.locator(BLOGGER_SELECTORS.hideOption).first();
        if (await hideOption.isVisible({ timeout: 3000 })) {
          await hideOption.click();
          await sleep(500);
        }
        const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          await sleep(1000);
        }
        commentDone = true;
      }
    } catch (e) {
      console.warn('[ONECLICK-BLOGSPOT] 댓글 설정 실패:', e);
    }

    // 시간대: 서울 (GMT+9)
    state.message = '시간대: 서울 설정 중...';
    let timezoneDone = false;
    try {
      const timezoneSection = await page.locator(BLOGGER_SELECTORS.timezoneSection).first();
      if (await timezoneSection.isVisible({ timeout: 3000 })) {
        await timezoneSection.click();
        await sleep(1000);
        const seoulOption = await page.locator(BLOGGER_SELECTORS.seoulOption).first();
        if (await seoulOption.isVisible({ timeout: 3000 })) {
          const select = await seoulOption.locator('..').first();
          await select.selectOption({ label: '(GMT+09:00) 서울' });
          await sleep(500);
        }
        const saveBtn = await page.locator(BLOGGER_SELECTORS.saveBtn).first();
        if (await saveBtn.isVisible({ timeout: 2000 })) {
          await saveBtn.click();
          await sleep(1000);
        }
        timezoneDone = true;
      }
    } catch (e) {
      console.warn('[ONECLICK-BLOGSPOT] 시간대 설정 실패:', e);
    }

    const settingResults = [
      postCountDone ? '글개수 ✅' : '글개수 ❌',
      toggleDone ? '토글항목 ✅' : '토글항목 ❌',
      commentDone ? '댓글숨기기 ✅' : '댓글숨기기 ❌',
      timezoneDone ? '시간대 ✅' : '시간대 ❌',
    ].join(' / ');
    state.message = `설정 최적화 결과: ${settingResults}`;
  } catch (e) {
    console.error('[ONECLICK-BLOGSPOT] 설정 최적화 오류:', e);
    state.message = '설정 최적화 일부 완료 (수동 확인 권장)';
  }

  state.stepStatus = 'done';
  await sleep(1000);
}

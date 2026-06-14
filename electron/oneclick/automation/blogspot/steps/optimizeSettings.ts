// electron/oneclick/automation/blogspot/steps/optimizeSettings.ts
// Step 2: 설정 자동 최적화 (13개 항목)

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';
import { BLOGGER_SELECTORS } from '../../../config/selectors';
import { ensureBloggerTarget } from '../bloggerSmartNavigator';

type SettingsReadyResult = {
  ok: boolean;
  evidence: string[];
  url: string;
  title: string;
};

async function scanSettingsPage(page: any): Promise<SettingsReadyResult> {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const url = location.href;
    const evidence = [
      /HTTPS/i.test(text) ? 'HTTPS 항목' : '',
      /검색 엔진|Search engine|Visible to search engines/i.test(text) ? '검색엔진 노출 항목' : '',
      /댓글|Comments/i.test(text) ? '댓글 설정 항목' : '',
      /시간대|Time zone/i.test(text) ? '시간대 항목' : '',
      /설명|Description/i.test(text) ? '설명 항목' : '',
      /성인 콘텐츠|Adult content/i.test(text) ? '성인 콘텐츠 항목' : '',
      /이미지|Images|Lightbox|WebP|Lazy/i.test(text) ? '이미지 설정 항목' : '',
    ].filter(Boolean);
    const hasSettingsUrl = /blogger\.com\/blog\/settings\/\d+/i.test(url);
    return {
      ok: hasSettingsUrl && evidence.length >= 2,
      evidence,
      url,
      title: document.title || '',
    };
  });
}

async function openAndVerifySettingsPage(state: SetupState, page: any, blogId: string): Promise<SettingsReadyResult> {
  let last: SettingsReadyResult = { ok: false, evidence: [], url: page.url(), title: '' };
  for (let attempt = 1; attempt <= 3; attempt++) {
    state.message = attempt === 1
      ? '설정 페이지로 이동 중...'
      : `설정 페이지 로드 확인 재시도 중 (${attempt}/3)...`;

    if (blogId) {
      const target = await ensureBloggerTarget(state, page, 'settings', blogId, {
        timeoutMs: 35000,
        reason: 'Blogger 설정 화면을 준비합니다',
      });
      page = target.page;
      if (!target.ok) {
        last = {
          ok: false,
          evidence: target.scan.evidence,
          url: target.scan.url,
          title: target.scan.title,
        };
        continue;
      }
    } else {
      const settingsLink = await page.locator(BLOGGER_SELECTORS.settingsLink).first();
      if (await settingsLink.isVisible({ timeout: 5000 })) {
        await settingsLink.click();
      }
    }

    try { await page.waitForLoadState?.('networkidle', { timeout: 8000 }); } catch { /* Blogger는 계속 통신할 수 있어 허용 */ }
    await sleep(3000 + attempt * 800);

    try {
      last = await scanSettingsPage(page);
      if (last.ok) return last;
    } catch (e) {
      last = { ok: false, evidence: [], url: page.url(), title: e instanceof Error ? e.message : String(e) };
    }
  }
  return last;
}

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
    const ready = await openAndVerifySettingsPage(state, page, blogId);
    if (!ready.ok) {
      state.stepStatus = 'error';
      state.message = `설정 페이지가 완전히 로드되지 않았습니다. 현재 URL: ${ready.url || page.url()} / 확인 근거: ${ready.evidence.join(', ') || '없음'}. Chrome 창을 닫지 말고 Blogger 설정 화면이 보이는지 확인한 뒤 다시 시도해주세요.`;
      state.error = state.message;
      return;
    }

    const settingsPageEvidence = `설정 화면 근거: ${ready.evidence.join(', ')} 확인`;

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
    let toggleEvidence = '토글 항목 확인 필요';
    try {
      const toggleSummary = await page.evaluate(() => {
        const toggleItems = document.querySelectorAll('[role="checkbox"], [role="switch"], input[type="checkbox"]');
        const summary = {
          alreadyOn: 0,
          turnedOn: 0,
          alreadyOff: 0,
          turnedOff: 0,
          labels: [] as string[],
        };

        toggleItems.forEach((toggle: any) => {
          const parentText = toggle.closest('[class]')?.textContent || '';
          const label = parentText.toLowerCase();
          const labelName = parentText.replace(/\s+/g, ' ').trim().slice(0, 34);

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
              summary.turnedOn++;
              console.log('[ONECLICK] ✅ 활성화:', parentText.slice(0, 50));
            } else {
              summary.alreadyOn++;
            }
            if (labelName) summary.labels.push(labelName);
          }

          if (matchDisable) {
            const isChecked = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
            if (isChecked) {
              toggle.click();
              summary.turnedOff++;
              console.log('[ONECLICK] ❌ 비활성화:', parentText.slice(0, 50));
            } else {
              summary.alreadyOff++;
            }
            if (labelName) summary.labels.push(labelName);
          }
        });
        summary.labels = Array.from(new Set(summary.labels)).slice(0, 5);
        return summary;
      });
      await sleep(1000);
      toggleDone = true;
      toggleEvidence = `토글 확인: 이미 ON ${toggleSummary.alreadyOn}개 / 새로 ON ${toggleSummary.turnedOn}개 / 이미 OFF ${toggleSummary.alreadyOff}개 / 새로 OFF ${toggleSummary.turnedOff}개${toggleSummary.labels.length ? ` (${toggleSummary.labels.join(', ')})` : ''}`;
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
      settingsPageEvidence,
      postCountDone ? '글개수 ✅' : '글개수 ❌',
      toggleDone ? toggleEvidence : '토글항목 ❌',
      commentDone ? '댓글숨기기 ✅' : '댓글숨기기 ❌',
      timezoneDone ? '시간대 ✅' : '시간대 ❌',
    ].join(' / ');
    state.message = `설정 최적화 확인 완료 — ${settingResults}. 이미 세팅된 항목은 유지하고 필요한 항목만 보정했습니다.`;
  } catch (e) {
    console.error('[ONECLICK-BLOGSPOT] 설정 최적화 오류:', e);
    state.stepStatus = 'error';
    state.message = `설정 최적화 실패 — ${e instanceof Error ? e.message : String(e)}`;
    state.error = state.message;
    return;
  }

  state.stepStatus = 'done';
  await sleep(1000);
}

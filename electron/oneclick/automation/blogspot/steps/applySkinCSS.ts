// electron/oneclick/automation/blogspot/steps/applySkinCSS.ts
// Step 5: 리더남 클라우드 스킨 CSS 적용

import type { SetupState } from '../../../types';
import { sleep } from '../../../utils/browser';
import { loadSkinCSS } from '../../../utils/skinLoader';
import { BLOGGER_SELECTORS } from '../../../config/selectors';
import { ensureBloggerTarget } from '../bloggerSmartNavigator';

type ThemeEditorReady = {
  ok: boolean;
  url: string;
  title: string;
  hasEditor: boolean;
  hasSkinClose: boolean;
  evidence: string[];
};

async function scanThemeEditor(page: any): Promise<ThemeEditorReady> {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const codeText = [
      (document.querySelector('.CodeMirror') as any)?.CodeMirror?.getValue?.() || '',
      (document.querySelector('.ace_editor') as any)?.env?.editor?.getValue?.() || '',
      (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value || '',
      (document.querySelector('[contenteditable="true"], [role="textbox"]') as HTMLElement | null)?.textContent || '',
    ].join('\n');
    const hasEditor = Boolean(document.querySelector('.CodeMirror, textarea, [contenteditable], [role="textbox"], .ace_editor'));
    const hasSkinClose = codeText.includes(']]></b:skin>');
    const evidence = [
      hasEditor ? 'HTML 편집기 감지' : '',
      hasSkinClose ? 'b:skin 삽입 위치 확인' : '',
      /HTML 편집|Edit HTML|테마|Theme/i.test(text) ? '테마 편집 화면 문구 확인' : '',
    ].filter(Boolean);
    return {
      ok: /blogger\.com\/blog\/themes\/edit\/\d+/i.test(location.href) && hasEditor && hasSkinClose,
      url: location.href,
      title: document.title || '',
      hasEditor,
      hasSkinClose,
      evidence,
    };
  });
}

async function openAndVerifyThemeEditor(state: SetupState, page: any, blogId: string): Promise<ThemeEditorReady> {
  let last: ThemeEditorReady = { ok: false, url: page.url(), title: '', hasEditor: false, hasSkinClose: false, evidence: [] };
  for (let attempt = 1; attempt <= 3; attempt++) {
    state.message = attempt === 1
      ? '테마 HTML 편집 페이지로 이동 중...'
      : `테마 HTML 편집기 로드 확인 재시도 중 (${attempt}/3)...`;
    if (blogId) {
      const target = await ensureBloggerTarget(state, page, 'theme-editor', blogId, {
        timeoutMs: 45000,
        reason: 'Blogger 테마 HTML 편집 화면을 준비합니다',
      });
      page = target.page;
      if (!target.ok) {
        last = {
          ok: false,
          url: target.scan.url,
          title: target.scan.title,
          hasEditor: false,
          hasSkinClose: false,
          evidence: target.scan.evidence,
        };
        continue;
      }
    } else {
      const themeLink = await page.locator(BLOGGER_SELECTORS.themeLink).first();
      if (await themeLink.isVisible({ timeout: 5000 })) {
        await themeLink.click();
        await sleep(3000);
        const moreBtn = await page.locator(BLOGGER_SELECTORS.themeMoreActions).first();
        if (await moreBtn.isVisible({ timeout: 3000 })) {
          await moreBtn.click();
          await sleep(1000);
        }
        const editHtmlBtn = await page.locator(BLOGGER_SELECTORS.editHtmlBtn).first();
        if (await editHtmlBtn.isVisible({ timeout: 3000 })) {
          await editHtmlBtn.click();
        }
      }
    }

    try { await page.waitForLoadState?.('networkidle', { timeout: 8000 }); } catch { /* Blogger는 계속 통신할 수 있어 허용 */ }
    await sleep(3500 + attempt * 1000);

    try {
      last = await scanThemeEditor(page);
      if (last.ok) return last;
    } catch (e) {
      last = { ok: false, url: page.url(), title: e instanceof Error ? e.message : String(e), hasEditor: false, hasSkinClose: false, evidence: [] };
    }
  }
  return last;
}

/**
 * Blogger 테마 HTML 에디터에서 <b:skin> 섹션에 클라우드 스킨 CSS를 삽입한다.
 */
export async function applySkinCSS(
  state: SetupState,
  page: any,
  blogId: string
): Promise<void> {
  state.currentStep = 3;
  state.stepStatus = 'running';
  state.message = '테마 HTML 편집 페이지로 이동 중...';

  try {
    const ready = await openAndVerifyThemeEditor(state, page, blogId);
    if (!ready.ok) {
      state.stepStatus = 'error';
      state.message = `테마 HTML 편집기가 완전히 로드되지 않았습니다. 현재 URL: ${ready.url || page.url()} / 확인 근거: ${ready.evidence.join(', ') || '없음'}. Chrome 창에서 HTML 편집 화면이 보이는지 확인한 뒤 다시 시도해주세요.`;
      state.error = state.message;
      return;
    }

    const skinCSS = loadSkinCSS('blogspot');
    if (skinCSS) {
      state.message = '클라우드 스킨 CSS 자동 적용 중...';

      try {
        const editor = await page.locator(BLOGGER_SELECTORS.codeEditor).first();
        if (await editor.isVisible({ timeout: 5000 })) {
          const inserted = await page.evaluate((css: string) => {
            // 2026-04: CodeMirror → 대안 에디터도 지원
            const marker = '/* === LEADERNAM CLOUD SKIN START === */';

            // 방법 1: CodeMirror (기존)
            const cm = (document.querySelector('.CodeMirror') as any)?.CodeMirror;
            if (cm) {
              const content = cm.getValue();
              if (content.includes(marker)) return { ok: true, changed: false, method: 'CodeMirror', reason: 'already-applied' };
              const insertPoint = content.indexOf(']]></b:skin>');
              if (insertPoint > -1) {
                cm.setValue(content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint));
                return { ok: true, changed: true, method: 'CodeMirror' };
              }
              return { ok: false, changed: false, method: 'CodeMirror', reason: 'skin-close-not-found' };
            }

            // 방법 2: Ace Editor
            const ace = (document.querySelector('.ace_editor') as any)?.env?.editor;
            if (ace) {
              const content = ace.getValue();
              if (content.includes(marker)) return { ok: true, changed: false, method: 'Ace', reason: 'already-applied' };
              const insertPoint = content.indexOf(']]></b:skin>');
              if (insertPoint > -1) {
                ace.setValue(content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint));
                return { ok: true, changed: true, method: 'Ace' };
              }
              return { ok: false, changed: false, method: 'Ace', reason: 'skin-close-not-found' };
            }

            // 방법 3: textarea 직접
            const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
            if (textarea) {
              const content = textarea.value;
              if (content.includes(marker)) return { ok: true, changed: false, method: 'textarea', reason: 'already-applied' };
              const insertPoint = content.indexOf(']]></b:skin>');
              if (insertPoint > -1) {
                textarea.value = content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                return { ok: true, changed: true, method: 'textarea' };
              }
              return { ok: false, changed: false, method: 'textarea', reason: 'skin-close-not-found' };
            }

            // 방법 4: contenteditable
            const editable = document.querySelector('[contenteditable="true"], [role="textbox"]') as HTMLElement;
            if (editable) {
              const content = editable.textContent || '';
              if (content.includes(marker)) return { ok: true, changed: false, method: 'contenteditable', reason: 'already-applied' };
              const insertPoint = content.indexOf(']]></b:skin>');
              if (insertPoint > -1) {
                editable.textContent = content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint);
                editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: css }));
                return { ok: true, changed: true, method: 'contenteditable' };
              }
              return { ok: false, changed: false, method: 'contenteditable', reason: 'skin-close-not-found' };
            }

            return { ok: false, changed: false, method: 'none', reason: 'editor-not-found' };
          }, skinCSS);

          if (!inserted?.ok) {
            state.stepStatus = 'error';
            state.message = `스킨 CSS 삽입 위치를 찾지 못했습니다. HTML 편집기가 보이는지 확인해주세요. 사유: ${inserted?.reason || 'unknown'}`;
            state.error = state.message;
            return;
          }

          await sleep(1000);
          try {
            const saveThemeBtn = await page.locator(BLOGGER_SELECTORS.saveThemeBtn).first();
            if (await saveThemeBtn.isVisible({ timeout: 3000 })) {
              await saveThemeBtn.click();
              await sleep(2000);
            }
          } catch { /* 수동 저장 필요 */ }

          const verify = await page.evaluate(() => {
            const marker = '/* === LEADERNAM CLOUD SKIN START === */';
            const values = [
              (document.querySelector('.CodeMirror') as any)?.CodeMirror?.getValue?.() || '',
              (document.querySelector('.ace_editor') as any)?.env?.editor?.getValue?.() || '',
              (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value || '',
              (document.querySelector('[contenteditable="true"], [role="textbox"]') as HTMLElement | null)?.textContent || '',
            ];
            return values.some((value) => value.includes(marker));
          }).catch(() => false);

          if (!verify) {
            state.stepStatus = 'error';
            state.message = '스킨 CSS 적용 후 검증에 실패했습니다. Chrome 창의 HTML 편집 화면에서 저장 여부를 확인해주세요.';
            state.error = state.message;
            return;
          }

          state.message = `✅ 클라우드 스킨 CSS 적용 완료 (${inserted.method}${inserted.changed ? ', 새로 삽입' : ', 이미 적용됨'})`;
        } else {
          state.stepStatus = 'error';
          state.message = '코드 에디터를 찾지 못했습니다. 테마 HTML 편집 화면이 완전히 열렸는지 확인해주세요.';
          state.error = state.message;
          return;
        }
      } catch (e) {
        state.stepStatus = 'error';
        state.message = `테마 편집 페이지에서 CSS 적용 실패 — ${e instanceof Error ? e.message : String(e)}`;
        state.error = state.message;
        return;
      }
    } else {
      state.stepStatus = 'error';
      state.message = '스킨 CSS 파일을 찾지 못했습니다. 앱 파일이 정상 설치되어 있는지 확인해주세요.';
      state.error = state.message;
      return;
    }
  } catch (e) {
    console.error('[ONECLICK-BLOGSPOT] 스킨 적용 오류:', e);
    state.stepStatus = 'error';
    state.message = `스킨 적용 실패 — ${e instanceof Error ? e.message : String(e)}`;
    state.error = state.message;
    return;
  }

  state.stepStatus = 'done';
  await sleep(1000);
}

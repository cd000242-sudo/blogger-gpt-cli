/**
 * 반자동 발행 경로 버그 3건 (v3.8.394)
 *
 * 배경: v3.8.357~392 동안 반자동 발행 버튼이 숨겨져 있었고(v3.8.393 에서 복구),
 *   버튼을 되살리자 5일간 아무도 밟지 않던 깨진 경로가 그대로 드러났다.
 *   ⚠️ 즉 아래 버그들은 v3.8.393 이 만든 게 아니라 **드러낸** 것이다.
 *
 * 실측 로그 (2026-07-31 사용자 콘솔):
 *   [ButtonStateManager] 버튼을 찾을 수 없습니다: runBtn
 *   [ButtonStateManager] 버튼을 찾을 수 없습니다: generateBtn
 *   [NEW-PREVIEW] Payload: Promise               ← ①
 *   ❌ [ERROR] Error: An object could not be cloned.
 *   preview.js:144 Uncaught (in promise) ReferenceError: appState is not defined   ← ②
 *
 * ① createPreviewPayload 는 async 인데 await 가 빠져 Promise 가 IPC 로 넘어갔다.
 *    structured clone 은 Promise 를 직렬화하지 못한다 → "An object could not be cloned."
 * ② appState 를 try 블록 안에서 const 로 선언해 finally 에서 스코프 밖이었다.
 *    const 는 블록 스코프다. 조기 return 해도 finally 는 실행되므로 null 가드도 필요하다.
 * ③ generateBtn / runBtn 은 index.html 에 없는 id 였다 → 생성 중 로딩 표시가 전혀 안 걸렸다.
 *    "UI 가 안 움직이다가 갑자기 완료됐다"는 체감의 원인과 같은 계열이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const preview = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'preview.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'ui.js'), 'utf8');
const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');

describe('① payload 가 Promise 로 넘어가지 않는다', () => {
  it('createPreviewPayload 는 async 다 (await 가 필요한 근거)', () => {
    expect(posting).toMatch(/export async function createPreviewPayload/);
  });

  it('preview.js 가 await 로 받는다', () => {
    expect(preview).toContain('await createPreviewPayload()');
  });

  it('await 없이 호출하는 곳이 없다', () => {
    // "= createPreviewPayload(" 앞에 await 가 없는 패턴을 잡는다
    expect(preview).not.toMatch(/=\s*createPreviewPayload\s*\(/);
  });

  it('Promise 를 그대로 로그로 찍지 않는다 — 문제를 가리던 로그였다', () => {
    expect(preview).not.toContain("console.log('[NEW-PREVIEW] Payload:', payload)");
  });
});

describe('② appState 스코프 — finally 에서도 접근 가능', () => {
  it('try 밖에서 선언한다', () => {
    const fnStart = preview.indexOf('export async function generatePreview');
    const tryStart = preview.indexOf('try {', fnStart);
    const decl = preview.indexOf('let appState = null', fnStart);
    expect(decl).toBeGreaterThan(fnStart);
    expect(decl).toBeLessThan(tryStart);   // try 보다 앞에 있어야 한다
  });

  it('try 안에서 const 로 다시 선언하지 않는다 — 재선언하면 다시 가려진다', () => {
    const fnStart = preview.indexOf('export async function generatePreview');
    const fnEnd = preview.indexOf('export async function startSemiAutoPublish');
    const body = preview.slice(fnStart, fnEnd);
    expect(body).not.toContain('const appState = getAppState()');
    expect(body).toContain('appState = getAppState()');
  });

  it('finally 에 null 가드가 있다 — 라이선스 미등록 조기 return 시 null 이다', () => {
    expect(preview).toContain('if (appState) appState.isCanceled = false');
  });
});

describe('③ 로딩 표시가 실제 존재하는 버튼에 걸린다', () => {
  it('없는 id(generateBtn) 를 더는 쓰지 않는다', () => {
    expect(preview).not.toMatch(/ButtonStateManager\.(setLoading|restore)\('generateBtn'/);
  });

  it('없는 id(runBtn) 를 더는 쓰지 않는다', () => {
    expect(ui).not.toMatch(/ButtonStateManager\.(setLoading|restore)\('runBtn'/);
  });

  it('반자동 진입 버튼에 로딩을 건다', () => {
    expect(preview).toContain("ButtonStateManager.setLoading('editGeneratedBtn'");
    expect(preview).toContain("ButtonStateManager.restore('editGeneratedBtn')");
  });

  it('setRunning 이 실재하는 버튼들만 대상으로 한다', () => {
    expect(ui).toContain("RUNNING_BUTTON_IDS = ['publishBtn', 'editGeneratedBtn']");
  });

  it('화면에 없는 버튼은 조용히 건너뛴다 — 경고 로그를 만들지 않는다', () => {
    const i = ui.indexOf('export function setRunning');
    expect(ui.slice(i, i + 500)).toContain('if (!document.getElementById(id)) return');
  });

  it('대상 버튼들이 index.html 에 실제로 있다', () => {
    ['publishBtn', 'editGeneratedBtn'].forEach(id => expect(html).toContain(`id="${id}"`));
  });

  it('generateBtn / runBtn 은 index.html 에 없다 (이 테스트의 전제)', () => {
    expect(html).not.toContain('id="generateBtn"');
    expect(html).not.toContain('id="runBtn"');
  });
});

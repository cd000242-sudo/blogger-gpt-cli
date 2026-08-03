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
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const preview = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'preview.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'ui.js'), 'utf8');
const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

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
    expect(braceBlock(ui, 'export function setRunning')).toContain('if (!document.getElementById(id)) return');
  });

  it('대상 버튼들이 index.html 에 실제로 있다', () => {
    ['publishBtn', 'editGeneratedBtn'].forEach(id => expect(html).toContain(`id="${id}"`));
  });

  it('generateBtn / runBtn 은 index.html 에 없다 (이 테스트의 전제)', () => {
    expect(html).not.toContain('id="generateBtn"');
    expect(html).not.toContain('id="runBtn"');
  });
});

/**
 * ④ 진행률 모달이 아예 뜬 적이 없다 (v3.8.425)
 *
 * 사용자: "반자동 발행은 클릭하면 모달이 없네요? 프로그래스도없구요"
 *
 * generatePreview()는 버튼 텍스트만 "⏳ 생성 중..."으로 바꿀 뿐, 실제 진행률 모달
 * (premiumProgressBar, showProgressModal/hideProgressModal)을 한 번도 부르지 않았다.
 * 같은 'run-post' IPC를 쓰는 일반 발행(posting.js runPosting)은 showProgressModal()로
 * 이 모달을 띄우는데 반자동 경로만 빠져 있었다 — semi-auto.js의 cancelSemiAutoGeneration()이
 * window.hideProgressModal()을 부르는 것과 대조된다(그쪽은 애초에 show가 없어 hide할
 * 대상도 없었다 — 이 파일은 다른, 실제로 버튼에 연결된 반자동 경로다).
 */
describe('④ 반자동 발행이 실제 진행률 모달(premiumProgressBar)을 띄운다', () => {
  it('⭐ 생성 시작 시 showProgressModal을 부른다', () => {
    const fnStart = preview.indexOf('export async function generatePreview');
    const fnEnd = preview.indexOf('export async function startSemiAutoPublish');
    const body = preview.slice(fnStart, fnEnd);
    expect(body).toContain('window.showProgressModal?.(');
  });

  it('⭐ 성공·실패·취소 어떤 경로든 finally에서 hideProgressModal을 부른다', () => {
    const fnStart = preview.indexOf('export async function generatePreview');
    const fnEnd = preview.indexOf('export async function startSemiAutoPublish');
    const body = preview.slice(fnStart, fnEnd);
    const finallyIdx = body.indexOf('} finally {');
    expect(finallyIdx).toBeGreaterThan(-1);
    expect(body.slice(finallyIdx)).toContain('window.hideProgressModal?.()');
  });

  it('showProgressModal/hideProgressModal이 실제로 정의돼 있고 window에 전역 노출된다', () => {
    expect(ui).toContain('export function showProgressModal(mode)');
    expect(ui).toContain('export function hideProgressModal()');
    expect(ui).toMatch(/window\.showProgressModal\s*=\s*showProgressModal/);
    expect(ui).toMatch(/window\.hideProgressModal\s*=\s*hideProgressModal/);
  });

  it('그 모달이 실제로 index.html에 존재한다 (premiumProgressBar)', () => {
    expect(html).toContain('id="premiumProgressBar"');
  });

  it('반자동 발행 버튼(🎨 반자동 발행)은 실제로 startSemiAutoPublish를 호출한다', () => {
    expect(html).toContain('onclick="window.startSemiAutoPublish && window.startSemiAutoPublish()"');
    expect(html).toContain('반자동 발행');
  });

  /**
   * 사용자: "반자동 발행이 완료되면 편집기가 바로떠야됩니다 이미지를 넣을수있게말이에요"
   * 이 요구사항 자체는 v3.8.357부터 이미 구현돼 있었다(startSemiAutoPublish 끝의
   * openVisualEditor 호출) — 새로 만들 필요는 없었지만, 실제로 배선돼 있는지 잠가둔다.
   */
  it('생성 완료 후 openVisualEditor(appstate)로 편집기를 자동으로 연다 — 이미지 삽입용', () => {
    const fnStart = preview.indexOf('export async function startSemiAutoPublish');
    expect(fnStart).toBeGreaterThan(-1);
    const body = preview.slice(fnStart);
    expect(body).toContain("window.openVisualEditor?.({ kind: 'appstate' })");
  });
});

/**
 * ⑤ 반자동 발행이 "이미지 없이 글만"이 아니라 이미지 8장을 그대로 유료 생성했다 (v3.8.425)
 *
 * 사용자: "반자동 발행이라고 로그에 인지했는데 왜 이미지까지 생성하는건데 이미지 비용이
 *   얼만데 당장 수정해"
 *
 * 실측 로그: "🎨 반자동 발행 시작 — 이미지 없이 글만 먼저 생성합니다..."라고 찍힌 바로
 *   뒤에 "🖼️ 섹션별 이미지 생성 중...", "🧵 이미지 공통 큐 생성 시작 (8장)..."이 그대로
 *   이어졌다 — GPT Image 2로 8장을 실제로 생성했다(유료 API).
 *
 * 원인 — orchestration.ts 486행에 이미 `skipImages = payload.skipImages === true ||
 *   h2ImageMode === 'none'`라는, 이미지 생성 전체(섹션 이미지 + 썸네일)를 건너뛰는
 *   플래그가 있었다. 그런데 createPayload()(반자동이 쓰는 previewOnly:true 페이로드를
 *   포함해 모든 발행 경로가 공유하는 단일 조립 함수)는 이 필드를 단 한 번도 채운
 *   적이 없다 — previewOnly와 skipImages가 아예 연결돼 있지 않았다.
 */
describe('⑤ 반자동(previewOnly) 요청은 이미지 생성 자체를 건너뛴다 — 유료 API 호출 방지', () => {
  it('⭐ createPayload가 previewOnly일 때 skipImages도 함께 켠다', () => {
    const block = blockBetween(posting, 'publishType: previewOnly ?', 'scheduleDate: publishTypeValue');
    expect(block).toContain('skipImages: previewOnly');
  });

  it('⭐ orchestration.ts는 skipImages===true면 섹션 이미지·썸네일 생성을 전부 건너뛴다', () => {
    expect(orch).toContain("const skipImages = payload.skipImages === true || h2ImageMode === 'none';");
    const block = braceBlock(orch, 'if (skipImages) {');
    expect(block).toContain('빠른 모드: 이미지 생성 스킵');
  });

  it('썸네일도 skipImages를 확인한다 — "글만" 요청에서 썸네일까지 새는 걸 막는다', () => {
    expect(orch).toMatch(/!skipImages\s*&&\s*preGeneratedThumbnail/);
    expect(orch).toMatch(/!thumbnailUrl\s*&&\s*!skipImages/);
  });

  it('createPreviewPayload가 실제로 previewOnly:true로 createPayload를 부른다 (반자동의 유일한 진입점)', () => {
    // 다른 곳(대기열/글포스팅 등)은 previewOnly: false를 명시적으로 넘긴다 —
    // 그 경로들은 skipImages: false가 되어 기존처럼 이미지가 정상 생성된다.
    const fnBody = braceBlock(posting, 'export async function createPreviewPayload()');
    expect(fnBody).toContain("createPayload({ previewOnly: true, platformOverride: 'preview' })");
  });
});

describe('⑥ 반자동 진행률 모달은 완전자동과 다른 색(초록)으로 뜬다 (v3.8.426)', () => {
  it('⭐ preview.js가 semi-auto 테마로 모달을 띄운다', () => {
    expect(preview).toContain("window.showProgressModal?.('semi-auto');");
  });

  it('⭐ 일반(완전자동) 발행 경로는 인자 없이 그대로 호출한다 — 테마 변경 전과 동일', () => {
    // posting.js의 두 호출 지점 모두 인자 없이 showProgressModal()을 부른다.
    // 이 값을 바꾸면 완전자동 모달까지 초록으로 바뀌어버린다 — 반자동만 달라야 한다.
    const calls = posting.match(/showProgressModal\([^)]*\)/g) || [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toBe('showProgressModal()');
    }
  });

  it('⭐ ui.js가 semi-auto/auto 두 테마를 정의하고 mode에 따라 카드·아이콘·그라디언트를 바꾼다', () => {
    const themesBlock = braceBlock(ui, 'const PROGRESS_MODAL_THEMES = {');
    expect(themesBlock).toContain("'semi-auto'");
    expect(themesBlock).toContain('#22c55e');   // 반자동 = 초록
    expect(themesBlock).toContain('#667eea');   // 완전자동 = 기존 보라 유지

    const applyBlock = braceBlock(ui, 'function applyProgressModalTheme(mode) {');
    expect(applyBlock).toContain("getElementById('progressModalCard')");
    expect(applyBlock).toContain("getElementById('progressModalIcon')");
    expect(applyBlock).toContain("getElementById('progressModalSubtitle')");
  });

  it('⭐ showProgressModal이 열릴 때마다 테마를 새로 적용한다 — 이전 호출의 색이 남지 않는다', () => {
    const fnBody = braceBlock(ui, 'export function showProgressModal(mode) {');
    expect(fnBody).toContain('applyProgressModalTheme(mode);');
  });

  it('index.html에 테마 적용 대상 id(카드/아이콘/부제/그라디언트 stop)가 실존한다', () => {
    expect(html).toContain('id="progressModalCard"');
    expect(html).toContain('id="progressModalIcon"');
    expect(html).toContain('id="progressModalSubtitle"');
    expect(html).toContain('id="progressGradientStop1"');
    expect(html).toContain('id="progressGradientStop2"');
    expect(html).toContain('id="progressGradientStop3"');
  });

  it('progressManager는 width만 갱신할 뿐, 배경색을 다시 보라색으로 덮어쓰지 않는다', () => {
    // core.js의 updateProgress/updateProgressCircle이 progressFill.style.background나
    // circle의 stroke를 직접 건드리면 showProgressModal이 세팅한 초록 테마가
    // 진행률이 올라갈 때마다 도로 보라색으로 리셋된다 — 그러면 안 된다.
    const core = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'core.js'), 'utf8');
    const updateProgressBlock = braceBlock(core, 'updateProgress(stepPercentage, targetPercentage = null, statusText = null) {');
    expect(updateProgressBlock).not.toMatch(/fillEl\.style\.background\s*=/);
    const circleBlock = braceBlock(core, 'updateProgressCircle(percentage) {');
    expect(circleBlock).not.toMatch(/\.style\.stroke\s*=/);
  });
});

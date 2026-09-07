/**
 * v3.8.691 — 편집기 ①[이 영역 이미지]는 커서 자리에 · ⑥[표] 버튼이 안 먹던 이유
 *
 * 사장님:
 *   "[이 영역 이미지]는 마우스커서 위치에 정확하게 이미지가 생성이 되어야 돼"
 *   "표 버튼 클릭해도 아무반응이없는데..??"
 *
 * ## ① 커서를 아예 안 봤다
 * `anchor.insertAdjacentElement('afterend', node)` 로 **소제목(H2) 바로 뒤**에 꽂았다.
 * 커서는 프롬프트를 지을 소제목을 고르는 데만 쓰고, 넣는 자리는 버렸다.
 *
 * ## ⑥ 표가 아니라 prompt() 가 문제였다
 * **Electron 은 `window.prompt()` 를 지원하지 않는다**(alert·confirm 은 된다).
 * 창이 안 뜨고 예외가 바깥 try/catch 에 잡혀 상태줄에만 한 줄 남았다 —
 * 사장님 눈에는 "아무 반응 없음"이다. 서식 바의 🔗 링크도 같은 이유로 죽어 있었다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const editor = read('electron/ui/modules/editor.js');

/** 함수 하나의 본문만 떼어 본다 — 파일 전체를 훑으면 엉뚱한 곳의 문자열에 걸린다 */
function bodyOf(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + 1);
  expect(a).toBeGreaterThan(-1);
  expect(b).toBeGreaterThan(a);
  return src.slice(a, b);
}

describe('① [이 영역 이미지] 는 커서 자리에 넣는다', () => {
  const fn = bodyOf(editor, 'async function generateEditorImage(kind)', "modalRefs.thumbBtn?.addEventListener");

  test('⭐ 커서 삽입 헬퍼를 쓴다 (광고·CTA 와 같은 것)', () => {
    expect(fn).toContain('insertHtmlAtCaret(doc,');
  });

  test('⭐ 소제목 뒤에 꽂는 것은 커서를 못 찾았을 때뿐이다', () => {
    expect(fn).toContain("if (!placedAtCaret && anchor) anchor.insertAdjacentElement('afterend', node)");
    // 무조건 소제목 뒤에 넣던 옛 코드가 남아 있으면 안 된다
    expect(fn).not.toMatch(/if \(kind === 'section' && anchor\) \{\s*anchor\.insertAdjacentElement/);
  });

  test('⭐ 커서를 잃지 않게 mousedown 가드에 버튼이 들어 있다', () => {
    // 이 가드가 없으면 버튼을 누르는 순간 본문 선택이 풀려 늘 글 끝으로 간다
    expect(editor).toContain('#veSectionImgBtn');
    const guard = bodyOf(editor, "toolbar.addEventListener('mousedown'", '});');
    expect(guard).toContain('#veSectionImgBtn');
  });

  test('어디에 들어갔는지 사장님께 말해 준다 — 조용히 넘기지 않는다', () => {
    expect(fn).toContain('커서 위치에 넣었습니다');
    expect(fn).toContain('커서 위치를 찾지 못했습니다');
  });
});

describe('⑥ 표·링크 버튼이 Electron 에서 실제로 뜬다', () => {
  test('⭐ 편집기에 window.prompt 호출이 남아 있지 않다 (Electron 미지원)', () => {
    // 주석은 세지 않는다 — 왜 안 쓰는지 적어 둔 설명까지 걸리면 테스트가 거짓말을 한다
    const code = editor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/window\.prompt\s*\(/);
  });

  test('⭐ 표 버튼이 자체 대화상자를 쓴다', () => {
    const table = bodyOf(editor, "case 'table': {", "default: return;");
    expect(table).toContain('askOneLine({');
    expect(table).toContain('표 넣기');
  });

  test('⭐ 링크 버튼도 같은 대화상자를 쓴다', () => {
    const link = bodyOf(editor, "case 'link': {", "case 'unlink': {");
    expect(link).toContain('askOneLine({');
  });

  test('⭐ 표는 넣을 자리를 대화상자보다 먼저 잡는다 — 열면 선택이 풀린다', () => {
    const table = bodyOf(editor, "case 'table': {", "default: return;");
    expect(table.indexOf('const block =')).toBeLessThan(table.indexOf('askOneLine({'));
  });

  test('⭐ 링크는 범위를 먼저 붙잡았다가 되살린다 — 안 그러면 엉뚱한 곳에 걸린다', () => {
    const link = bodyOf(editor, "case 'link': {", "case 'unlink': {");
    expect(link.indexOf('cloneRange()')).toBeLessThan(link.indexOf('askOneLine({'));
    expect(link).toContain('s.addRange(keep)');
  });

  test('다른 곳에도 prompt() 지뢰가 남아 있는지 세어 둔다 (편집기 밖은 이번 범위가 아니다)', () => {
    /**
     * 이번에 고친 건 편집기뿐이다. 관리자 PIN·이미지 폴더 등 UI 곳곳에 같은 호출이 남아 있고
     * 모두 같은 이유로 죽어 있을 것이다. 숫자가 **늘어나면** 알아채려고 못 박아 둔다.
     */
    const files = ['electron/ui/script.js', 'electron/ui/admin-patch.js',
      'electron/ui/modules/adsense-tools.js', 'electron/ui/modules/adsense-fixer.js'];
    const count = files.reduce((n, f) => {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      return n + (code.match(/(?:window\.)?\bprompt\s*\(/g) || []).length;
    }, 0);
    // 2026-09-07 실측 15곳 (script 6 · admin-patch 1 · adsense-tools 7 · adsense-fixer 1)
    expect(count).toBeLessThanOrEqual(15);
  });

  test('취소와 빈 입력을 구분한다 — 취소는 null 이다', () => {
    const ask = bodyOf(editor, 'function askOneLine(', 'function askCtaDetails(');
    expect(ask).toContain('close(null)');
    expect(ask).toContain("e.key === 'Escape'");
    expect(ask).toContain("e.key === 'Enter'");
  });
});

describe('②③④ 이미지 다시 생성 · 이미지별 다시 생성 · 엔진 선택', () => {
  const images = read('electron/ui/modules/editor-images.js');
  const main = read('electron/main.ts');

  test('② [이미지 다시 생성] 은 글의 모든 이미지를 바꾼다', () => {
    // findPostImages 는 본문의 <img> 를 전부 찾고, main 은 그걸 하나씩 돈다
    const regen = read('src/core/final/post-regenerate.ts');
    expect(regen).toContain('export function findPostImages');
    expect(main).toContain('const images = regen.findPostImages(previousHtml)');
    expect(main).toContain('for (const image of images)');
    // 버튼 설명이 "모두" 라고 말해야 한다 — 한 장만 바뀌는 줄 알면 헷갈린다
    expect(editor).toContain('이미지를 모두 다시 만듭니다');
  });

  test('⭐③ 이미지 도구막대에 [다시 생성] 이 있다', () => {
    expect(images).toContain('id="veImgRegenBtn"');
    expect(images).toContain('🎨 다시 생성');
  });

  test('⭐③ 눌리면 editor.js 로 넘긴다 — 이미지 모듈이 생성까지 알지 않는다', () => {
    expect(images).toContain('state.onRegenerateImage?.(img)');
    expect(editor).toContain('onRegenerateImage: (img) => regenerateOneImage(img)');
  });

  test('⭐③ 되돌리기 스택을 실제로 쌓는다 — 안 쌓으면 "복구 가능"이 거짓말이다', () => {
    const handler = images.slice(images.indexOf("#veImgRegenBtn').addEventListener"));
    expect(handler.slice(0, 320)).toContain('pushImageOp()');
    expect(editor).toContain('↩️ 되돌리기로 복구 가능');
  });

  test('⭐③ 블록을 갈아끼우지 않고 src 만 바꾼다 — 클래스·스타일이 사라지면 모양이 바뀐다', () => {
    const fn = editor.slice(editor.indexOf('async function regenerateOneImage'));
    expect(fn.slice(0, 2200)).toContain("img.setAttribute('src', src)");
  });

  test('⭐④ 편집기에 글·이미지 엔진 칸이 있다', () => {
    expect(editor).toContain('id="veTextEngine"');
    expect(editor).toContain('id="veImageEngine"');
  });

  test('⭐④ 선택지는 본 화면에서 복제한다 — 목록을 두 벌로 적지 않는다', () => {
    expect(editor).toContain("cloneEngineOptions(refs?.textEngine, 'generationEngine')");
    expect(editor).toContain("cloneEngineOptions(refs?.imageEngine, 'h2ImageSource')");
    expect(editor).toContain('refreshEditorEngineOptions(refs)');
  });

  test('⭐④ 고른 엔진이 payload 에 실린다 (안 실으면 조용히 무효다)', () => {
    const payload = editor.slice(editor.indexOf('editorPayload = async () => {'));
    expect(payload.slice(0, 900)).toContain('h2ImageSource: imageEngine');
    expect(payload.slice(0, 900)).toContain('generationEngine: textEngine');
  });

  test('⭐④ 비어 있으면 아무것도 덮지 않는다 — 유령 기본값을 싣지 않는다', () => {
    const payload = editor.slice(editor.indexOf('editorPayload = async () => {'));
    expect(payload.slice(0, 900)).toContain('...(imageEngine ? {');
    expect(payload.slice(0, 900)).toContain('...(textEngine ? {');
  });

  test('④ 원본 셀렉트를 못 찾으면 칸을 숨긴다 — 빈 칸을 보여주지 않는다', () => {
    const fn = editor.slice(editor.indexOf('function refreshEditorEngineOptions'));
    expect(fn.slice(0, 700)).toContain("wrap.style.display = (okText || okImage) ? 'inline-flex' : 'none'");
  });

  test('④ 본 화면에 그 두 셀렉트가 실제로 있다 (없는 id 를 베끼면 조용히 빈다)', () => {
    const html = read('electron/ui/index.html');
    expect(html).toContain('id="h2ImageSource"');
    expect(html).toContain('id="generationEngine"');
  });
});

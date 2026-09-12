/**
 * 편집기 — 표 만들기·되돌리기·직접 수정 요청 (v3.8.725)
 *
 * 사장님 요청 네 가지:
 *   ① "필드 하나에 5x2 이런 식으로 하면 표만 생기거든. 이러지 말고 그 필드 아래에
 *      표에 어떤 내용을 넣을 건지 표 색상이나 수정도 가능하게 해줘"
 *   ② "표를 넣었는데 삭제하고 싶다면 … 삭제도 가능하게 해줘"
 *   ③ "되돌리기해도 되돌려지게끔 해주고"
 *   ④ "비평 개선이 … 너무 조잡해. 차라리 수정사항을 직접 작성해서 요청하면
 *      그대로 다시 수정해주도록 가능하니?"
 *
 * ## 왜 되돌리기가 안 됐나
 * 브라우저의 Ctrl+Z 는 **사람이 친 글자**만 기억한다. 표 넣기처럼 코드가 DOM 을 바꾼 것은
 * 그 기록에 안 남는다. 그래서 도구를 쓰기 직전에 본문을 찍어 두는 방식으로 바꿨다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const editor = read('electron/ui/modules/editor.js');

/** 편집기에서 순수 함수만 꺼내 온다 (브라우저 전용 코드를 건드리지 않기 위해) */
function loadTableFns() {
  const pick = (startMarker: string, endMarker: string) => {
    const start = editor.indexOf(startMarker);
    const end = editor.indexOf(endMarker, start);
    return editor.slice(start, end).replace(/^export /gm, '');
  };
  const body = [
    pick('export const TABLE_THEMES', 'export function parseTableContent'),
    pick('export function parseTableContent', 'function escapeCell'),
    pick('function escapeCell', '/**\n * 📊 v3.8.687'),
    pick('export function buildTableHtml', 'export function applyTableTheme'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(`${body}\nreturn { TABLE_THEMES, parseTableContent, buildTableHtml };`)();
}

const { TABLE_THEMES, parseTableContent, buildTableHtml } = loadTableFns();

describe('① 표에 내용을 넣을 수 있다', () => {
  it('⭐⭐ 쉼표로 적은 내용을 격자로 읽는다', () => {
    const grid = parseTableContent('구분, 3개월, 6개월\n지원금, 30만원, 60만원');
    expect(grid).toEqual([['구분', '3개월', '6개월'], ['지원금', '30만원', '60만원']]);
  });

  it('⭐⭐ 엑셀에서 복사한 탭 구분도 읽는다', () => {
    expect(parseTableContent('구분\t금액\n지원금\t30만원')).toEqual([['구분', '금액'], ['지원금', '30만원']]);
  });

  it('⭐⭐ 읽은 내용이 실제 표 칸에 들어간다', () => {
    const grid = parseTableContent('구분, 금액\n지원금, 30만원');
    const html = buildTableHtml(2, 2, { grid });
    expect(html).toContain('<th');
    expect(html).toContain('구분');
    expect(html).toContain('금액');
    expect(html).toContain('지원금');
    expect(html).toContain('30만원');
    expect(html).not.toContain('>항목<');   // 내용을 줬으면 기본 글자가 남으면 안 된다
  });

  it('⭐⭐ 내용을 안 주면 예전처럼 빈 표가 나온다', () => {
    const html = buildTableHtml(3, 3);
    expect(html).toContain('>항목<');
    expect(html).toContain('>내용<');
  });

  it('⭐ 칸 내용의 태그는 글자로 처리한다 (본문에 코드가 섞여 들어가면 안 된다)', () => {
    const html = buildTableHtml(1, 1, { grid: [['<script>alert(1)</script>']] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('② 표 색을 고를 수 있다', () => {
  it('⭐⭐ 색 이름이 다섯 가지 있다', () => {
    expect(Object.keys(TABLE_THEMES).length).toBeGreaterThanOrEqual(5);
    for (const key of ['gray', 'blue', 'green', 'amber', 'slate']) {
      expect(TABLE_THEMES[key].label).toBeTruthy();
    }
  });

  it('⭐⭐ 고른 색이 실제 표에 박힌다', () => {
    const html = buildTableHtml(2, 2, { themeKey: 'blue' });
    expect(html).toContain(TABLE_THEMES.blue.headBg);
    expect(html).toContain('data-ve-table-theme="blue"');
  });

  it('⭐ 나중에 색만 바꿀 수 있게 표식을 남긴다', () => {
    expect(editor).toContain('export function applyTableTheme');
    expect(editor).toContain("table.setAttribute('data-ve-table-theme'");
  });
});

describe('③ 도구로 한 일도 되돌아간다', () => {
  it('⭐⭐ 되돌리기 버튼과 Ctrl+Z 가 있다', () => {
    expect(editor).toContain('id="veUndoBtn"');
    expect(editor).toMatch(/e\.key\.toLowerCase\(\) === 'z' && undoStack\.length > 0/);
  });

  it('⭐⭐ 본문을 바꾸는 도구들이 스냅샷을 남긴다', () => {
    for (const label of ['표 넣기', '표 삭제', '표 색 바꾸기', '썸네일 넣기', '요청대로 고치기']) {
      expect(editor).toContain(`pushUndo('${label}')`);
    }
  });

  it('⭐⭐ 되돌리면 썸네일 보호를 다시 건다 (innerHTML 교체로 표시가 날아간다)', () => {
    const fn = editor.slice(editor.indexOf('function undoOnce'), editor.indexOf('function clearUndo'));
    expect(fn).toContain('protectSeparators(doc)');
  });

  it('⭐ 「처음으로」를 누르면 되돌리기 기록도 비운다 (옛 기록으로 되돌아가면 혼란스럽다)', () => {
    const fn = editor.slice(editor.indexOf('modalRefs.revertBtn.addEventListener'), editor.indexOf('modalRefs.sourceBtn'));
    expect(fn).toContain('clearUndo()');
  });

  it('⭐ 20단계까지만 기억한다 (무한히 쌓으면 메모리를 먹는다)', () => {
    expect(editor).toContain('UNDO_LIMIT = 20');
    expect(editor).toMatch(/undoStack\.length > UNDO_LIMIT\) undoStack\.shift\(\)/);
  });
});

describe('④ 표를 지울 수 있다', () => {
  it('⭐⭐ 표 안에 커서가 있으면 고치기 창이 열리고 지우기가 있다', () => {
    expect(editor).toContain("anchorEl?.closest?.('table')");
    expect(editor).toContain('id="veTblDelete"');
    expect(editor).toMatch(/action === 'delete'/);
  });
});

describe('⑤ 직접 수정 요청', () => {
  it('⭐⭐ 버튼과 여러 줄 입력창이 있다', () => {
    expect(editor).toContain('id="veAskFixBtn"');
    expect(editor).toContain('function askMultiLine');
  });

  it('⭐⭐ 비평을 거치지 않고 적은 내용을 그대로 넘긴다', () => {
    const fn = editor.slice(editor.indexOf('modalRefs.askFixBtn?.addEventListener'), editor.indexOf('modalRefs.revertBtn.addEventListener'));
    expect(fn).toContain("'improve-editor-html'");
    expect(fn).not.toContain('critique-editor-html');   // 찾는 단계를 건너뛰는 것이 이 기능의 핵심이다
    expect(fn).toContain('detail: request');
    expect(fn).toContain('작성자가 직접 요청한 수정');
  });

  it('⭐⭐ 고친 뒤 되돌릴 수 있다 (마음에 안 들 수 있다)', () => {
    const fn = editor.slice(editor.indexOf('modalRefs.askFixBtn?.addEventListener'), editor.indexOf('modalRefs.revertBtn.addEventListener'));
    expect(fn).toContain("pushUndo('요청대로 고치기')");
    expect(fn).toContain('되돌리기');
  });
});

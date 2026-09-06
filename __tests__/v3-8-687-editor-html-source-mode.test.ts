/**
 * v3.8.687 — 편집기 HTML 코드 모드 + 표 넣기
 *
 * 사장님: "혹시 HTML코드로는 못보니?? HTML코드를 수정해야하는경우 아무것도못하자나 표도 못넣고.."
 *
 * ## 이 테스트가 지키는 것
 * 저장은 **프레임(iframe)만** 읽는다(serializeEditor). 코드 칸을 붙여 놓고 저장 전에 프레임에 안 실으면
 * 코드로 고친 것이 조용히 버려진다 — 이 저장소가 여러 번 겪은 "화면만 있고 배선 없음" 사고다.
 * 그래서 마크업이 아니라 **코드 → 프레임 → 저장** 흐름과 잠금·복원을 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const editor = read('electron/ui/modules/editor.js');

describe('① 마크업과 refs 가 맞물린다 (없는 id 는 조용히 무동작)', () => {
  it('토글 버튼과 코드 칸이 있고 refs 에 잡힌다', () => {
    expect(editor).toContain('id="veSourceBtn"');
    expect(editor).toContain('id="veSourceArea"');
    expect(editor).toContain("sourceBtn: overlay.querySelector('#veSourceBtn')");
    expect(editor).toContain("sourceArea: overlay.querySelector('#veSourceArea')");
    expect(editor).toContain("modalRefs.sourceBtn.addEventListener('click'");
  });

  it('코드 칸은 미리보기와 같은 자리(#veBody)에 있다', () => {
    const body = blockBetween(editor, '<div id="veBody"', '</div>');
    expect(body).toContain('id="veFrame"');
    expect(body).toContain('id="veSourceArea"');
  });
});

describe('② 코드 → 프레임 → 저장', () => {
  it('⭐ 저장은 코드 모드를 먼저 끝내 프레임에 싣는다 (안 하면 고친 코드가 버려진다)', () => {
    const save = braceBlock(editor, 'async function saveCurrentSession(saveAs)');
    const sync = save.indexOf('if (session.sourceMode) setSourceMode(false)');
    const serialize = save.indexOf('const html = serializeEditor()');
    expect(sync).toBeGreaterThan(-1);
    expect(serialize).toBeGreaterThan(sync);
  });

  it('⭐ 프레임에 실을 때 baseline 을 되돌린다 (안 그러면 닫을 때 "저장 안 한 편집" 경고가 안 뜬다)', () => {
    const apply = braceBlock(editor, 'function applySourceToFrame()');
    expect(apply).toContain('const keep = session.baseline');
    expect(apply).toContain('loadIntoFrame(src)');
    expect(apply).toContain('session.baseline = keep');
    // 안 바뀐 코드는 다시 싣지 않는다 (커서·스크롤 보존)
    expect(apply).toContain('if (src === session.sourceLoaded) return false');
  });

  it('닫기 경고가 코드 칸의 변경도 본다', () => {
    const dirty = braceBlock(editor, 'function isDirty()');
    expect(dirty).toContain('session.sourceMode && modalRefs.sourceArea.value !== session.sourceLoaded');
  });

  it('HTML 복사도 코드 모드의 수정을 포함한다', () => {
    const copy = blockBetween(editor, "modalRefs.copyHtmlBtn.addEventListener('click'", 'serializeEditor()');
    expect(copy).toContain('applySourceToFrame()');
  });

  it('코드 보기에 편집기 흔적이 없고, 광고 자리표시자는 그대로다', () => {
    const clean = braceBlock(editor, 'function cleanedBodyHtml()');
    expect(clean).toContain("removeAttribute('contenteditable')");
    expect(clean).toContain('[data-bgpt-editor], [data-bgpt-editor-ui]');
    expect(clean).not.toContain('expandAdSlots');
  });
});

describe('③ 코드 모드에서는 프레임 전용 도구를 잠근다', () => {
  it('서식 바·이미지·광고·버튼·되돌리기·비평·재생성이 ve-visual-only 다', () => {
    for (const id of ['veInsertImageBtn', 'veAdUnitSelect', 'veInsertAdBtn', 'veInsertCtaBtn', 'veUndoImageOpBtn', 'veDraftWrap', 'veRegenWrap', 'veFormatBar']) {
      const tag = editor.slice(editor.indexOf(`id="${id}"`), editor.indexOf(`id="${id}"`) + 60);
      expect(tag).toContain('class="ve-visual-only"');
    }
    expect(editor).toContain('#visualEditorOverlay.ve-source .ve-visual-only { opacity:.35; pointer-events:none; }');
  });

  it('저장·닫기·제목·발행할 곳은 잠그지 않는다', () => {
    for (const id of ['veSaveBtn', 'veCancelBtn', 'veTitleInput', 'veTargetPlatformWrap', 'veSourceBtn', 'veCopyHtmlBtn']) {
      const tag = editor.slice(editor.indexOf(`id="${id}"`), editor.indexOf(`id="${id}"`) + 60);
      expect(tag).not.toContain('ve-visual-only');
    }
  });

  it('닫으면 미리보기 모드로 되돌린다', () => {
    const hide = braceBlock(editor, 'function hideModal()');
    expect(hide).toContain("classList.remove('ve-source')");
    expect(hide).toContain("sourceArea.style.display = 'none'");
    expect(hide).toContain("frame.style.display = 'block'");
  });
});

describe('④ 표 넣기', () => {
  it('서식 바에 표 버튼이 있고 applyFormat 이 받는다', () => {
    expect(editor).toContain('data-vefmt="table"');
    const fmt = braceBlock(editor, 'function applyFormat(doc, kind)');
    expect(fmt).toContain("case 'table':");
    expect(fmt).toContain('buildTableHtml(rows, cols)');
    // 구분선과 같은 자리 규칙: 커서 문단 아래
    expect(blockBetween(fmt, "case 'table':", '표를 넣었습니다')).toContain("insertAdjacentElement('afterend', table)");
  });

  it('표는 인라인 스타일 · 첫 줄 머리글 · 행열 상한', () => {
    const build = braceBlock(editor, 'export function buildTableHtml(rows, cols)');
    expect(build).toContain('border-collapse:collapse');
    expect(build).toContain('<thead>');
    expect(build).toContain('border:1px solid');
    const fmt = braceBlock(editor, 'function applyFormat(doc, kind)');
    expect(fmt).toContain('Math.min(20, Math.max(1, Number(m[1])))');
    expect(fmt).toContain('Math.min(10, Math.max(1, Number(m[2])))');
  });

  it('안내줄이 알려준다 (도구가 있어도 모르면 못 쓴다)', () => {
    expect(editor).toContain('HTML 편집</b> → 코드로 직접 고치기');
  });
});

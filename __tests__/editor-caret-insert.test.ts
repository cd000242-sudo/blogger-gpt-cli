/**
 * v3.8.482 — 미리보기 편집기에서 이미지가 **커서 위치가 아니라 글 끝에** 붙던 문제.
 *
 * 사용자 보고: "이미지 여전히 맨아래에 삽입되는데?? 커서위치가아니고?"
 *
 * v3.8.440 이 mousedown+preventDefault 로 선택 유실을 막았는데, 그 가드가
 * **서식 바(#veFormatBar)에만** 걸려 있었다. 이미지 삽입 버튼은 위쪽 툴바
 * (#veToolbar)라 가드 밖이었다 — 버튼이 iframe 밖에 있으므로 누르는 순간
 * 안쪽 선택이 풀리고, 기억해 둔 위치(lastCaretBlock)마저 없으면 글 끝으로 갔다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { braceBlock } from './helpers/source-block';

const editor = readFileSync(join(__dirname, '..', 'electron/ui/modules/editor.js'), 'utf8');
const editorImages = readFileSync(join(__dirname, '..', 'electron/ui/modules/editor-images.js'), 'utf8');

describe('편집기 커서 위치 삽입', () => {
  /** modalRefs 에도 #veToolbar 조회가 있으므로 가드 코드 자체를 표식으로 삼는다 */
  const toolbarGuard = () => braceBlock(editor, "const toolbar = modalRefs.overlay.querySelector('#veToolbar')");

  it('상단 툴바의 이미지 삽입 버튼도 선택 유실을 막는다 (사고 재현 잠금)', () => {
    const guard = toolbarGuard();
    expect(guard).toContain('mousedown');
    expect(guard).toContain('veInsertImageBtn');
    expect(guard).toContain('preventDefault');
  });

  it('서식 바 가드는 그대로 있다 (v3.8.440 후퇴 없음)', () => {
    const fmt = braceBlock(editor, "const formatBar = modalRefs.overlay.querySelector('#veFormatBar')");
    expect(fmt).toContain('mousedown');
    expect(fmt).toContain('preventDefault');
  });

  it('제목 입력·저장·닫기까지 막지 않는다 — 삽입 버튼에만 건다', () => {
    const guard = toolbarGuard();
    // 툴바 전체에 무조건 preventDefault 를 걸면 제목 입력에 포커스가 안 간다
    expect(guard).not.toMatch(/mousedown['"],\s*\(e\)\s*=>\s*\{?\s*e\.preventDefault\(\)/);
    // 셀렉터 문자열을 통째로 박제하지 않는다 — 삽입 버튼이 늘어날 수 있다
    // (v3.8.482 에서 광고 버튼이 붙으면서 이 단언이 한 번 깨졌다)
    expect(guard).toMatch(/closest\?\.\('#veInsertImageBtn[^']*'\)/);
  });

  it('커서를 못 찾으면 조용히 끝에 붙이지 않고 사용자에게 알린다', () => {
    expect(editorImages).toContain('커서 위치를 찾지 못했습니다');
    expect(editorImages).toContain('커서 위치에 삽입했습니다');
  });

  it('기억해 둔 커서 위치 경로는 유지된다 (선택이 풀렸을 때의 2차 방어)', () => {
    expect(editorImages).toContain('state.lastCaretBlock?.isConnected');
    expect(editorImages).toContain("doc.addEventListener('mouseup', rememberCaret)");
  });
});

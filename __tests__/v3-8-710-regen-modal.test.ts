const fs = require('fs');
const path = require('path');

import { braceBlock } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.710 — 재생성 모달.
 *
 * 사장님: "글 다시생성하기버튼누르면 재생성 모달이뜨면좋겠는데"
 *
 * 그동안 [🔄 글 다시 생성]은 브라우저 confirm() 한 줄이었다. 이제 발행글 목록과
 * 비주얼 편집기 **두 곳이 같은 모달**(regen-modal.js)을 띄우고, 모드(본문/이미지)와
 * 엔진을 모달에서 고른다. 엔진 선택은 payload 로 실려야 실제로 반영된다 —
 * 유령 기본값·미배선 재발 방지로 배선을 줄 단위로 잰다.
 */
describe('v3.8.710 재생성 모달', () => {
  const modal = read('electron/ui/modules/regen-modal.js');
  const editor = read('electron/ui/modules/editor.js');
  const posts = read('electron/ui/modules/published-posts.js');

  test('모달 모듈이 있고 필요한 요소 id 를 전부 그린다', () => {
    expect(modal).toContain('export function openRegenModal');
    expect(modal).toContain('export function engineOverrides');
    for (const id of ['regenModalOverlay', 'regenModalStart', 'regenModalCancel', 'regenModalTextEngine', 'regenModalImageEngine']) {
      expect(modal).toContain(id);
    }
    expect(modal).toContain('name="regenModalMode"');
    // 엔진 목록은 본 화면 셀렉트를 복제한다 — 목록을 두 벌로 적으면 갈라진다
    expect(modal).toContain("cloneOptionsFrom('generationEngine'");
    expect(modal).toContain("cloneOptionsFrom('h2ImageSource'");
  });

  test('엔진 선택이 payload 필드로 번역된다 — 안 고르면 아무것도 덮지 않는다', () => {
    const block = braceBlock(modal, 'export function engineOverrides');
    expect(block).toContain('generationEngine');
    expect(block).toContain('provider');
    expect(block).toContain('h2ImageSource');
    expect(block).toContain('imageSource');
  });

  test('편집기: confirm() 대신 모달을 띄우고, 고른 엔진을 payload 로 보낸다', () => {
    expect(editor).toContain("from './regen-modal.js'");
    const fn = braceBlock(editor, 'async function runEditorRegenerate');
    expect(fn).toContain('openRegenModal(');
    // 실제 호출만 잡는다 — 주석의 "confirm() 대신" 문구는 해당 없음
    expect(fn).not.toMatch(/confirm\(\s*[`'"]/);
    expect(fn).toContain('engineOverrides(choice)');
    // 편집기 툴바에서 이미 고른 엔진이 모달 초기값이 된다
    expect(fn).toContain('modalRefs.textEngine?.value');
    // 취소하면 아무 일도 없다
    expect(fn).toContain('if (!choice) return');
  });

  test('발행글 목록: confirm() 대신 모달을 띄우고, 고른 엔진이 본 화면 payload 를 덮는다', () => {
    expect(posts).toContain("from './regen-modal.js'");
    const fn = braceBlock(posts, 'async function regeneratePostAt');
    expect(fn).toContain('openRegenModal(');
    // 실제 호출만 잡는다 — 주석의 "confirm() 대신" 문구는 해당 없음
    expect(fn).not.toMatch(/confirm\(\s*[`'"]/);
    expect(fn).toContain('engineOverrides(choice)');
    expect(fn).toContain('if (!choice) return');
  });

  test('모달이 고른 모드를 실제로 쓴다 — 모달에서 본문↔이미지를 바꿀 수 있어야 한다', () => {
    expect(braceBlock(editor, 'async function runEditorRegenerate')).toContain('mode = choice.mode');
    expect(braceBlock(posts, 'async function regeneratePostAt')).toContain('mode = choice.mode');
  });

  /*
   * v3.8.711 — 진행 카드(프로세스).
   * 사장님: "다른작업도 가능하게 모달이 프로세서로 깔끔하게 뜨게해주세요"
   * 재생성이 도는 동안 화면을 붙들지 않고, 오른쪽 아래 카드가 [PROGRESS] 로그로 진행률을 보여준다.
   */
  describe('v3.8.711 진행 카드 — 다른 작업을 막지 않는다', () => {
    test('진행 카드가 있고, 메인의 [PROGRESS] 로그를 구독해 진행률을 그린다', () => {
      expect(modal).toContain('export function startRegenTask');
      expect(modal).toContain('regenTaskStack');
      expect(modal).toContain('onLog');
      expect(modal).toContain('[PROGRESS]');
    });

    test('동시에 하나만 돈다 — 두 번째 시작은 null 로 거절된다', () => {
      // braceBlock 은 구조분해 파라미터 { title, mode } 를 블록으로 잡아 못 쓴다 — 전체 소스로 본다
      expect(modal).toContain('if (activeRegenTask) return null');
    });

    test('편집기: 진행 카드를 쓰고, 끝났을 때 같은 글이 열려 있을 때만 본문을 다시 싣는다', () => {
      const fn = braceBlock(editor, 'async function runEditorRegenerate');
      expect(fn).toContain('startRegenTask(');
      expect(fn).toContain('task.done(');
      expect(fn).toContain('task.fail(');
      // 그 사이 다른 글을 열었으면 엉뚱한 글 위에 덮어 싣지 않는다
      expect(fn).toContain('session.postId === targetPostId');
    });

    test('발행글 목록: 진행 카드를 쓰고, 중복 시작은 안내 후 물러난다', () => {
      const fn = braceBlock(posts, 'async function regeneratePostAt');
      expect(fn).toContain('startRegenTask(');
      expect(fn).toContain('task.done(');
      expect(fn).toContain('task.fail(');
      expect(fn).toContain('if (!task)');
    });
  });
});

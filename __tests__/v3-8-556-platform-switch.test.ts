/**
 * v3.8.556 — 발행할 곳(플랫폼)을 나중에 바꾼다
 *
 * 사장님: "플랫폼을 블로그스팟으로 하다 실패했는데 원하는 플랫폼이 워드프레스거든.
 *          대기콘텐츠를 플랫폼변경해서 재발행 가능하게 해주고, 생성된 글목록에서도
 *          플랫폼 변경해서 수정발행이 가능하도록 … 드롭다운 추가해주고"
 *
 * ## 이 테스트가 지키는 것
 *
 * 발행 플랫폼을 정하는 곳은 `publishGeneratedContent` 하나이고, 그 함수는
 * **payload.platform / targetPlatform / blogPlatform 만** 읽는다.
 * 그런데 재발행 대기열은 `{ platform, payload }` 처럼 최상위로 넘겨 왔다 —
 * 최상위 값은 아무도 안 읽으므로, 드롭다운만 붙이면 **화면만 바뀌고 발행은
 * 옛 플랫폼으로 나간다.** 에러도 안 난다. 이 저장소가 다섯 번 겪은 그 사고다.
 *
 * 그래서 UI 마크업이 아니라 **어느 키가 어디로 흘러가는가**를 잠근다.
 * id·class 는 "만드는 쪽"과 "찾는 쪽"을 서로 대조해 실존까지 확인한다 —
 * 없는 id 를 querySelector 하면 null 이 되어 조용히 무동작이 된다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const preview  = read('electron/ui/modules/preview.js');
const editor   = read('electron/ui/modules/editor.js');
const postList = read('electron/ui/modules/published-posts.js');
const mainTs   = read('electron/main.ts');
const coreIdx  = read('src/core/index.ts');

/** 발행 코드가 실제로 읽는 세 키 — 하나라도 빠지면 조용히 옛 플랫폼으로 나간다 */
const PLATFORM_KEYS = ['platform', 'targetPlatform', 'blogPlatform'];

// ══════════════════════════════════════════════════════════
describe('① 전제 — 발행 플랫폼은 payload 로만 정해진다', () => {
  it('publishGeneratedContent 는 payload 에서만 플랫폼을 읽는다 (이 전제가 깨지면 아래가 전부 무의미)', () => {
    const picker = blockBetween(coreIdx, 'let platform = payload?.platform', 'console.log(\'[PUBLISH] publishGeneratedContent 호출\')');
    expect(picker).toContain('payload?.platform');
    expect(picker).toContain('payload?.targetPlatform');
    expect(picker).toContain('payload?.blogPlatform');
  });

  it("'blogger' 를 'blogspot' 으로 바꿔 받는다 — 글목록 탭의 kind 가 'blogger' 라서 필요하다", () => {
    expect(coreIdx).toContain("if (platform === 'blogger') {");
  });
});

// ══════════════════════════════════════════════════════════
describe('② publish-content — 최상위 platform 을 payload 로 올린다', () => {
  const handler = braceBlock(mainTs, "ipcMain.handle('publish-content'");

  it('⭐ 최상위 platform 이 오면 payload 의 세 키를 전부 덮는다', () => {
    const lift = blockBetween(handler, 'const explicitPlatform', 'onLog(\'[PROGRESS] 25%');
    for (const key of PLATFORM_KEYS) {
      expect(lift).toContain(`.${key} = normalized`);
    }
  });

  it("'blogger' 는 'blogspot' 으로 정규화한다 (알 수 없는 플랫폼 오류 방지)", () => {
    const lift = blockBetween(handler, 'const explicitPlatform', 'onLog(\'[PROGRESS] 25%');
    expect(lift).toContain("explicitPlatform === 'blogger' ? 'blogspot'");
  });

  it('최상위가 비어 있으면 아무것도 덮지 않는다 — 기존 호출자 3곳은 payload 로만 넘긴다', () => {
    const lift = blockBetween(handler, 'const explicitPlatform', 'onLog(\'[PROGRESS] 25%');
    expect(lift).toContain('if (explicitPlatform) {');
  });

  it('플랫폼이 바뀌면 로그로 남긴다 — 조용히 바뀌면 나중에 원인을 못 찾는다', () => {
    const lift = blockBetween(handler, 'const explicitPlatform', 'onLog(\'[PROGRESS] 25%');
    expect(lift).toContain('플랫폼 변경');
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 발행 대기 콘텐츠 — 배너에서 플랫폼을 고른다', () => {
  it('⭐ 배너가 만드는 class 와 찾는 class 가 같다 (없는 class 면 조용히 무동작)', () => {
    expect(preview).toContain('class="republishPlatformSel"');
    expect(preview).toContain(".republishPlatformSel')");
  });

  it('세 플랫폼을 모두 고를 수 있다', () => {
    const list = blockBetween(preview, 'export const REPUBLISH_PLATFORMS', 'export function normalizeRepublishPlatform');
    for (const key of ['blogspot', 'wordpress', 'tistory']) {
      expect(list).toContain(`key: '${key}'`);
    }
  });

  it('⭐ buildRepublishData 가 payload 의 세 키를 전부 채운다 (여기가 진짜 배선)', () => {
    const build = braceBlock(preview, 'export function buildRepublishData');
    for (const key of PLATFORM_KEYS) {
      expect(build).toContain(`${key}: platform`);
    }
    // 원래 payload 를 버리지 않는다 — 카테고리·공개설정 등이 날아가면 안 된다
    expect(build).toContain('...(item?.payload || {})');
  });

  it('⭐ 재발행 버튼이 buildRepublishData 를 쓴다 (옛 조립을 그대로 두면 무동작이 된다)', () => {
    const btn = blockBetween(preview, ".republishBtn').forEach", ".republishDeleteBtn').forEach");
    expect(btn).toContain('buildRepublishData(item, picked)');
    // 최상위만 넘기던 옛 모양이 남아 있으면 안 된다
    expect(btn).not.toContain('platform: item.platform,');
  });

  it('고른 값을 그 자리에서 대기열에 저장한다 — 안 그러면 앱을 껐다 켜면 사라진다', () => {
    const onChange = blockBetween(preview, ".republishPlatformSel').forEach", ".republishEditBtn').forEach");
    expect(onChange).toContain("localStorage.setItem('pendingRepublishQueue'");
    for (const key of PLATFORM_KEYS) {
      expect(onChange).toContain(`${key}: picked`);
    }
  });

  it("저장된 'blogger' 도 'blogspot' 으로 받아준다 (옛 항목 호환)", () => {
    const norm = braceBlock(preview, 'export function normalizeRepublishPlatform');
    expect(norm).toContain("raw === 'blogger'");
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 편집기 — 미리보기 수정 화면의 발행할 곳 드롭다운', () => {
  it('⭐ 마크업이 만드는 id 와 querySelector 가 찾는 id 가 같다', () => {
    expect(editor).toContain('id="veTargetPlatform"');
    expect(editor).toContain("overlay.querySelector('#veTargetPlatform')");
    expect(editor).toContain('id="veTargetPlatformWrap"');
    expect(editor).toContain("overlay.querySelector('#veTargetPlatformWrap')");
  });

  it('⭐ 드롭다운에 실제로 값이 채워진다 — 빈 select 는 눌러도 아무 일이 없다', () => {
    const open = braceBlock(editor, 'if (session.platformPickable) {');
    expect(open).toContain('refs.targetPlatform.innerHTML');
    expect(open).toContain('EDITOR_PLATFORMS');
    expect(open).toContain("refs.targetPlatformWrap.style.display = 'inline-flex'");
  });

  it('대기열 글과 발행된 글에서만 보인다 (생성 직후·파일 편집은 고를 것이 없다)', () => {
    expect(editor).toContain("platformPickable: kind === 'republish' || !!getPublishedSource(kind)");
  });

  it('바꾸면 그 자리에서 버튼 문구가 바뀐다 — 누르기 전에 새 발행임을 알아야 한다', () => {
    expect(editor).toContain("modalRefs.targetPlatform?.addEventListener('change'");
    const label = braceBlock(editor, 'function refreshSaveButtonLabel');
    expect(label).toContain('isCrossPlatformPublish()');
    expect(label).toContain('새 글 발행');
    expect(label).toContain('🚀 수정발행하기');
  });

  it('⭐ 대기열 글을 저장하면 고른 플랫폼이 payload 까지 새겨진다', () => {
    const save = blockBetween(editor, "} else if (session.kind === 'republish') {", '} else if (getPublishedSource(session.kind) && isCrossPlatformPublish())');
    expect(save).toContain('const pickedPlatform = selectedEditorPlatform()');
    for (const key of PLATFORM_KEYS) {
      expect(save).toContain(`${key}: pickedPlatform`);
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('⑤ 글목록 — 다른 플랫폼을 고르면 수정이 아니라 새 글이다', () => {
  const cross = blockBetween(
    editor,
    '} else if (getPublishedSource(session.kind) && isCrossPlatformPublish()) {',
    '} else if (getPublishedSource(session.kind)) {',
  );

  it('⭐ 수정 채널이 아니라 일반 발행 경로로 간다 (대상 플랫폼엔 그 글의 postId 가 없다)', () => {
    expect(cross).toContain("invoke('publish-content'");
    expect(cross).not.toContain('published.updateChannel');
  });

  it('⭐ payload 의 세 키를 전부 채워 보낸다', () => {
    for (const key of PLATFORM_KEYS) {
      expect(cross).toContain(`${key}: target`);
    }
  });

  it('대상 플랫폼의 접속 설정을 같은 소스에서 실어 보낸다 (글목록과 어긋나면 인증 실패가 난다)', () => {
    expect(cross).toContain('window.__buildPublishedPlatformPayload?.(target)');
  });

  it('⭐ 원본을 지우지 않는다 (사장님 확정: 원본 유지 · 새 글)', () => {
    expect(cross).not.toContain('deleteChannel');
    expect(cross).not.toContain('delete-post');
    // 확인창과 완료 안내 모두 "원래 글은 그대로" 를 말해야 한다
    expect(cross).toContain('지우지 않고 그대로 둡니다');
    expect(cross).toContain('그대로 있습니다');
  });

  it('같은 플랫폼이면 예전처럼 수정발행이다 (회귀 방지)', () => {
    const same = blockBetween(editor, '} else if (getPublishedSource(session.kind)) {', "} else if (session.kind === 'file')");
    expect(same).toContain('published.updateChannel');
    expect(same).toContain('수정발행할까요?');
  });

  it('글목록 안내가 이 기능을 알려준다 — 드롭다운이 편집기 안에 있어 모르면 못 찾는다', () => {
    expect(postList).toContain('발행할 곳');
    expect(postList).toContain('새 글로');
  });
});

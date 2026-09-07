/**
 * v3.8.693 — 비평 무한루프 끊기 + 편집기에서는 "수정만"
 *
 * 사장님:
 *   "비평개선해서 고치고 다시 비평누르면 똑같은 지적이 또뜨는데 이러면 처음 수정할떄
 *    수정한이유가 없자나 이것도 비용이청구되는데 또 수정하고 비평하고 또 지적하고
 *    무한루프라고 한번 수정할떄 확실하게 수정되게하라고"
 *   "수정발행이아니라 수정만하게하라니까?? 수정발행하기는 전부다 고치고나서 내가 마지막에 누를꺼야"
 *
 * ## 루프가 생긴 두 갈래
 * ① improveDraft 가 모델을 **한 번만** 부르고, 결과가 규칙(분량·이미지·링크·주소 유지)을
 *    어기면 그냥 포기하고 원본을 뒀다 → 그 구간의 지적은 다음 비평에 **반드시** 또 나온다.
 *    모델은 무엇을 어겼는지 모른 채 한 번에 끝내야 했다.
 * ② 편집기 비평이 **이력을 안 넘겼다**. 발행글 경로에는 critique-history 가 있는데
 *    편집기 경로는 매번 백지에서 시작해 방금 고친 것도 다시 지적했다.
 *    buildCritiquePrompt 는 예전부터 `resolved`("다시 말하지 마세요")를 받는데 늘 빈 배열이었다.
 *
 * ## 그리고 문구가 사실과 달랐다
 * 모달은 편집기에서 불려도 "수정발행" 이라 적고, 끝나면 "이미 블로그에 반영됐습니다"
 * 라고 말했다. 편집기는 발행하지 않는다 — 발행은 저장 버튼이 한다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const draft = read('src/core/final/editor-draft.ts');
const modal = read('electron/ui/modules/post-critique-modal.js');
const editor = read('electron/ui/modules/editor.js');
const main = read('electron/main.ts');

describe('① 한 번 고칠 때 확실하게 — 거절되면 이유를 알려주고 다시 시킨다', () => {
  const fn = draft.slice(draft.indexOf('export async function improveDraft'));

  test('⭐ 1차가 거절되면 재시도한다 (예전엔 그냥 포기했다)', () => {
    expect(fn).toContain('if (!verdict.accepted) {');
    // 재시도 프롬프트에 **어긴 이유**가 들어가야 한다 — 안 알려주면 또 같은 실수를 한다
    expect(fn).toContain('반려됐습니다 — 이유: ${verdict.reason}');
  });

  test('⭐ 재시도 프롬프트가 지켜야 할 규칙을 짚어 준다', () => {
    const retry = fn.slice(fn.indexOf('반려됐습니다'), fn.indexOf('반려됐습니다') + 700);
    expect(retry).toContain('이미지');
    expect(retry).toContain('링크');
    expect(retry).toContain('분량');
  });

  test('⭐ 성공하면 추가 호출이 없다 — 비용은 실패했을 때만 든다', () => {
    // 첫 호출 → 판정 → (실패일 때만) 두 번째 호출 순서여야 한다
    const first = fn.indexOf('let raw = await input.callModel(basePrompt)');
    const judge = fn.indexOf('let verdict = acceptRevisedSection');
    const guard = fn.indexOf('if (!verdict.accepted) {');
    const second = fn.indexOf('raw = await input.callModel(retryPrompt)');
    expect(first).toBeGreaterThan(-1);
    expect(judge).toBeGreaterThan(first);
    expect(guard).toBeGreaterThan(judge);
    expect(second).toBeGreaterThan(guard);
  });

  /**
   * v3.8.700 에서 호출 자리가 하나 늘었다 — **비용이 느는 변경이라 의도를 여기 못 박는다.**
   *
   * 사장님 요구가 둘이고 서로 당긴다:
   *   "이것도 비용이 청구되는데"      → 적게 부를 것
   *   "한번 수정할때 확실하게"        → 정말 고쳐질 것
   *
   * 그래서 **필요할 때만** 는다. 사다리는 정확히 세 칸이고 네 칸째는 없다:
   *   ① 첫 시도                       (늘 1회)
   *   ② 규칙 위반이면 이유를 주고 재시도 (실패했을 때만)
   *   ③ 지적이 아직 남았으면 그 구간만  (남았을 때만, 구간 단위)
   * 잘 고쳐지면 ②③ 은 돌지 않으므로 평소 비용은 예전과 같다.
   */
  test('⭐ 사다리는 세 칸까지다 — 네 번째는 없다', () => {
    expect(fn).toContain('(2회 시도)');
    expect((fn.match(/await input\.callModel\(/g) || []).length).toBe(3);
  });

  test('⭐ ②③ 은 조건이 맞을 때만 돈다 — 평소 비용은 그대로다', () => {
    expect(fn).toContain('if (!verdict.accepted) {');          // ② 규칙 위반일 때만
    expect(fn).toContain('if (stillPresent.length && revisions.length) {');   // ③ 남았을 때만
  });
});

describe('② 이미 고친 것은 다시 지적하지 않는다', () => {
  test('⭐ critiqueDraft 가 resolved 를 받는다', () => {
    expect(draft).toContain('resolved?: string[];');
  });

  test('⭐ 그걸 프롬프트에 실제로 넘긴다 (빈 배열 고정이 아니다)', () => {
    expect(draft).toContain('buildCritiquePrompt({ title, html, codeIssues, competitors, resolved })');
    expect(draft).not.toContain('competitors, resolved: [] }');
  });

  test('⭐ 프롬프트에 "다시 말하지 마세요" 통로가 실재한다', () => {
    const critique = read('src/core/final/post-critique.ts');
    expect(critique).toContain('이미 고친 것 (다시 말하지 마세요)');
  });

  test('⭐ IPC 가 편집기에서 받아 넘긴다 (배선이 끊기면 조용히 무효다)', () => {
    expect(main).toContain('resolved: Array.isArray(args?.resolved)');
    expect(editor).toContain('resolved: session.resolvedIssues');
  });

  test('⭐ 실제로 고쳐진 것만 기억한다 — 그대로 둔 구간은 또 지적돼야 맞다', () => {
    const handler = editor.slice(editor.indexOf("modalRefs.critiqueBtn?.addEventListener"));
    const body = handler.slice(0, 3000);
    expect(body).toContain('(res.revisedDetail || []).flatMap');
    // revised > 0 인 가지 안에서만 쌓는다
    expect(body.indexOf('res.revised > 0')).toBeLessThan(body.indexOf('session.resolvedIssues = [...new Set'));
  });

  test('기억은 무한정 쌓이지 않는다 (프롬프트가 길어지면 비용이 는다)', () => {
    expect(editor).toContain('.slice(-40)');
  });
});

describe('③ 편집기에서는 "수정" 이지 "수정발행" 이 아니다', () => {
  test('⭐ 모달이 모드를 받는다', () => {
    expect(modal).toContain('export function showCritiqueModal(critique, onApply, onRecritique, opts = {})');
    expect(modal).toContain("const editorMode = opts?.mode === 'editor'");
    expect(modal).toContain("const applyVerb = editorMode ? '수정' : '수정발행'");
  });

  test('⭐ 버튼 문구가 모드를 따른다 — 문자열 안에 갇히면 그대로 출력된다', () => {
    // 작은따옴표 문자열 안의 ${applyVerb} 는 치환되지 않는다. 백틱이어야 한다.
    expect(modal).toContain('선택한 항목 ${applyVerb}</button>`}');
    expect(modal).toContain('`✍️ ${n}건 ${applyVerb}`');
  });

  test('⭐ 편집기 모드에서는 "발행됐다" 고 말하지 않는다', () => {
    expect(modal).toContain('아직 발행되지 않았습니다.');
    expect(modal).toContain('편집기에 반영했습니다. 확인 뒤 저장 버튼으로 발행하세요.');
  });

  test('⭐ 결과 화면도 모드를 받는다 (안 받으면 "같은 주소에 반영" 이라 말한다)', () => {
    expect(modal).toContain('function resultView(res, picked, editorMode = false)');
    expect(modal).toContain('resultView(res || {}, picked, editorMode)');
  });

  test('⭐ 편집기가 mode 를 실제로 넘긴다', () => {
    expect(editor).toContain("{ mode: 'editor' })");
  });

  test('글목록(발행) 경로는 예전 그대로다 — 거긴 진짜 발행한다', () => {
    const published = read('electron/ui/modules/published-posts.js');
    // mode 를 안 넘기므로 기본값(publish)으로 동작한다
    expect(published).toContain('showCritiqueModal(');
    expect(published).not.toContain("mode: 'editor'");
  });
});

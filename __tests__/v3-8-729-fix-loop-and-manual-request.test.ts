/**
 * v3.8.729 — ① "이렇게 고쳐줘"가 무시되던 것 ② 비평→수정 뒤 같은 지적이 또 나오던 것
 *            ③ 되돌리기 버튼 둘·이 영역 이미지 버튼 정리 ④ 밖에서 가져온 HTML 의 스킨 보존
 *
 * 사장님:
 *   "편집기에서 이렇게 고쳐줘 버튼을 누르고 고칠 사항을 입력했는데도 불구하고 인식을 못하면서 수정을 안 해주거든"
 *   "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 수정을 시켰는데도 똑같은 지적이 또 나와.
 *    수정하는데도 API 비용이 들기 때문에 이러면 절대 안 되는데"
 *   "되돌리기 버튼이 두 개인데 작동하는 버튼만 남기고 하나는 없애줘. 이 영역 이미지 버튼 없어도 될 것 같은데"
 *   "외부에서 가져온 글이 있다면 억지로 앱에 있는 스킨으로 씌우려 하지 말고 외부에서 가져온 스킨을 그대로 쓰게 냅둬"
 *
 * ## ① 재현 (v3.8.728 dist 로 실측)
 * 편집기가 보내는 요청에는 sectionIndex 가 없다 → `undefined < 0` 은 false → 없는 구간 `undefined` 를
 * 고치려다 **모델 호출 0회 · revised 0** 으로 끝나고 "고친 곳이 없습니다"를 띄웠다.
 * 소스 문자열만 보던 v3.8.725 테스트는 이걸 못 잡았다 — 그래서 여기서는 **실제로 돌린다.**
 */
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import postcss from 'postcss';
import { improveDraft, critiqueDraft } from '../src/core/final/editor-draft';
import { reviseByRequest, trimToMarkup, isCuttingRequest, allowsMediaLoss } from '../src/core/final/manual-revision';
import { parseVerification, verifySelectedIssues, buildVerificationPrompt } from '../src/core/final/revision-verification';
import {
  issueKey, rewriteAbility, annotateFixability, dropResolvedLookalikes, issueSimilarity, acceptRevisedSection, diagnosePost,
  type CritiqueIssue,
} from '../src/core/final/post-critique';
import { shouldPreserveOriginalStyles, hasAuthoredStyles, looksLikeAppArticle, flattenDocumentForPost } from '../src/core/final/style-preservation';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const issue = (over: Partial<CritiqueIssue>): CritiqueIssue => ({
  id: 'ai-0', area: 'structure', severity: 'high', title: '지적', detail: '', evidence: '', fix: '', sectionIndex: -1, origin: 'ai', ...over,
});

const ARTICLE = [
  '<p>원래 문장입니다. 이 글은 든든전세 4차 모집을 다룹니다. 자격과 일정을 먼저 봅니다.</p>',
  '<h2>신청 자격</h2><p>무주택 세대구성원이면 됩니다. 소득 기준은 없습니다. 자산 기준은 공고문 표를 봅니다.</p>',
  '<h2>일정</h2><p>접수는 9월 20일부터입니다. 서류는 온라인으로 냅니다. 결과는 10월에 나옵니다.</p>',
].join('\n');

describe('① "이렇게 고쳐줘" — 요청이 실제로 모델에 닿고 본문에 반영된다', () => {
  test('⭐ sectionIndex 없이 온 직접 요청도 글 전체를 고친다 (예전엔 호출 0회였다)', async () => {
    const prompts: string[] = [];
    const res = await improveDraft({
      title: '테스트',
      html: ARTICLE,
      issues: [{ id: `user-request-${Date.now()}`, area: 'whole', severity: 'high', title: '작성자가 직접 요청한 수정', detail: '첫 문단의 "원래 문장"을 "고친 문장"으로 바꿔 주세요', evidence: '' } as any],
      callModel: async (prompt) => {
        prompts.push(prompt);
        if (prompt.includes('검수자')) return '[{"id":"' + prompt.match(/user-request-\d+/)![0] + '","resolved":true,"evidence":"고친 문장입니다"}]';
        return ARTICLE.replace('원래 문장', '고친 문장');
      },
    });
    expect(prompts.length).toBe(2);                       // 수정 1회 + 검수 1회
    expect(prompts[0]).toContain('작성자의 수정 요청');
    expect(prompts[0]).toContain('첫 문단의 "원래 문장"');
    expect(prompts[0]).toContain('# 전체 원문 HTML');
    expect(res.revised).toBe(1);
    expect(res.html).toContain('고친 문장');
    expect(res.actuallyFixed).toEqual(['작성자가 직접 요청한 수정']);
    expect(res.stillPresent).toEqual([]);
  });

  test('⭐ 편집기가 보내는 요청 모양 — sectionIndex:-1 · fix 동봉 (undefined 가 다시 들어오지 않게)', () => {
    const editor = read('electron/ui/modules/editor.js');
    const fn = blockBetween(editor, "modalRefs.askFixBtn?.addEventListener", 'modalRefs.revertBtn.addEventListener');
    expect(fn).toContain('sectionIndex: -1');
    expect(fn).toContain('fix: request');
    expect(fn).toContain("id: `user-request-${Date.now()}`");
    // 안 고쳐졌을 때 이유를 그대로 보여준다
    expect(fn).toContain('res.skipped[0]');
  });

  test('⭐ 요청하지 않은 <style> 이 바뀌면 받지 않는다 — 밖에서 가져온 스킨을 지킨다', async () => {
    const styled = '<style>.custom p{font-size:27px}</style>' + ARTICLE;
    const res = await reviseByRequest({
      title: '테스트', html: styled,
      issues: [issue({ id: 'user-request-1', title: '작성자가 직접 요청한 수정', detail: '첫 문단을 부드럽게' })],
      callModel: async () => '<style>.custom p{font-size:12px}</style>' + ARTICLE.replace('원래 문장', '부드러운 문장'),
    });
    expect(res.revised).toBe(0);
    expect(res.skipped[0]).toContain('원본 CSS');
    expect(res.html).toBe(styled);
  });

  test('⭐ 1차가 반려되면 이유를 붙여 한 번 더 — 세 번째는 없다', async () => {
    let calls = 0;
    const res = await reviseByRequest({
      title: '테스트', html: ARTICLE,
      issues: [issue({ id: 'user-request-2', title: '작성자가 직접 요청한 수정', detail: '첫 문단을 부드럽게' })],
      callModel: async (prompt) => {
        calls += 1;
        if (calls === 1) return '<p>짧게</p>';                         // 분량 반려
        expect(prompt).toContain('반려됐습니다 — 이유:');
        return '<p>너무 짧아요</p>';                                     // 또 반려 → 끝
      },
    });
    expect(calls).toBe(2);
    expect(res.revised).toBe(0);
    expect(res.skipped[0]).toContain('분량');
  });

  test('"이미지 빼 줘" 같은 요청일 때만 이미지·링크가 줄어도 받는다', () => {
    expect(allowsMediaLoss('두 번째 이미지는 지워 주세요')).toBe(true);
    expect(allowsMediaLoss('첫 문단을 부드럽게')).toBe(false);
    expect(isCuttingRequest('3번 소제목의 표는 지우고 문장으로')).toBe(true);
    expect(isCuttingRequest('예시를 하나 더 넣어 주세요')).toBe(false);
  });

  test('앞뒤에 붙은 설명은 걷어내고 마크업만 남긴다', () => {
    expect(trimToMarkup('다음은 수정본입니다:\n<p>본문</p>\n이상입니다.')).toBe('<p>본문</p>');
    expect(trimToMarkup('```html\n<!doctype html><html><body><p>a</p></body></html>\n```')).toBe('<!doctype html><html><body><p>a</p></body></html>');
  });
});

describe('② 같은 지적이 또 나오지 않게 — 세 부품', () => {
  test('⭐ issueKey: 순번·숫자가 바뀌어도 같은 지적은 같은 이름표', () => {
    const a = issue({ id: 'audit-term-flood-3', title: '"환급" 가 12번 나옵니다 (1,000자당 4.1회)', evidence: '환급 환급 환급 문장', origin: 'code' });
    const b = issue({ id: 'audit-term-flood-2', title: '"환급" 가 9번 나옵니다 (1,000자당 3.0회)', evidence: '환급 환급 환급 문장', origin: 'code' });
    const c = issue({ id: 'audit-term-flood-2', title: '"보증금" 가 9번 나옵니다 (1,000자당 3.0회)', evidence: '보증금 문장', origin: 'code' });
    expect(issueKey(a)).toBe(issueKey(b));
    expect(issueKey(a)).not.toBe(issueKey(c));
    expect(issueKey(issue({ id: 'substance-vague', title: '책임 회피·얼버무림 표현이 많습니다' }))).toBe('substance-vague|책임 회피·얼버무림 표현이 많습니다');
  });

  test('⭐ 못 고치는 지적은 부르지 않는다 — 이미지 0장·링크 0개는 버튼을 가리킨다', async () => {
    let calls = 0;
    const res = await improveDraft({
      title: '테스트', html: ARTICLE,
      issues: [
        issue({ id: 'structure-noimage', title: '이미지가 한 장도 없습니다', origin: 'code' }),
        issue({ id: 'cta-none', title: '다음 행동으로 보내는 링크가 하나도 없습니다', origin: 'code' }),
      ],
      callModel: async () => { calls += 1; return ARTICLE; },
    });
    expect(calls).toBe(0);
    expect(res.revised).toBe(0);
    expect(res.skipped.join('\n')).toContain('🖼️ 이미지');
    expect(res.skipped.join('\n')).toContain('CTA 다시 생성');
    expect(rewriteAbility({ id: 'structure-noimage', title: '' }).fixable).toBe(false);
    expect(rewriteAbility({ id: 'audit-cross-section-echo-1', title: '' }).fixable).toBe(true);
    const annotated = annotateFixability([issue({ id: 'cta-none' }), issue({ id: 'ai-1' })]);
    expect(annotated[0]!.fixable).toBe(false);
    expect(annotated[0]!.fixHint).toContain('CTA');
    expect(annotated[1]!.fixable).toBe(true);
  });

  test('⭐ 답을 고치라는 지적이면 답 블록의 글을 바꿔도 받는다 — 블록이 사라지면 여전히 반려', () => {
    const original = { index: 0, heading: '(도입부)', html: '<p class="answer-first-q">되나요?</p><p class="answer-first-a">상황에 따라 다릅니다.</p><p>본문 문장입니다. 길게 씁니다.</p>' };
    const edited = '<p class="answer-first-q">되나요?</p><p class="answer-first-a">무주택이면 됩니다.</p><p>본문 문장입니다. 길게 씁니다.</p>';
    expect(acceptRevisedSection(edited, original, {}).reason).toBe('답변 블록이 바뀌었습니다');
    expect(acceptRevisedSection(edited, original, { allowAnswerEdit: true }).accepted).toBe(true);
    const gone = '<p>되나요? 무주택이면 됩니다.</p><p>본문 문장입니다. 길게 씁니다. 더 씁니다.</p>';
    expect(acceptRevisedSection(gone, original, { allowAnswerEdit: true }).reason).toBe('답변 블록이 사라졌습니다');
  });

  test('⭐ 고친 뒤 이름표로 다시 잰다 — 남았으면 그 구간만 한 번 더, 그래도 남으면 숨기지 않는다', async () => {
    // 훈계조 "~해서는 안 됩니다" 3번 → style-scolding (코드 진단, 이름표로 재는 지적. 정리기가 지우지 않는다)
    const scold = '서류를 늦게 제출해서는 안 됩니다. 기한을 무시해서는 안 됩니다. 조건을 대충 확인해서는 안 됩니다.';
    const broken = '<p>도입부 문장입니다. 충분히 길게 적어 둡니다.</p>'
      + `<h2>자격</h2><p>${scold} 그 밖의 조건은 공고를 봅니다. 길게 적습니다.</p>`;
    const found = diagnosePost({ title: 't', html: broken, competitors: [] }).find((i) => i.id === 'style-scolding');
    expect(found).toBeTruthy();
    const prompts: string[] = [];
    const res = await improveDraft({
      title: 't', html: broken, issues: [found!],
      callModel: async (prompt) => { prompts.push(prompt); return `<h2>자격</h2><p>${scold} 그 밖의 조건은 공고를 봅니다. 길게 적습니다. 한 문장 더.</p>`; },
    });
    expect(prompts.length).toBe(2);                                   // 1차 + "그대로 남아 있습니다" 재시도
    expect(prompts[1]).toContain('그대로 남아 있습니다');
    expect(res.stillPresent).toEqual([found!.title]);
    expect(res.actuallyFixed).toEqual([]);

    const fixed = await improveDraft({
      title: 't', html: broken, issues: [found!],
      callModel: async () => '<h2>자격</h2><p>서류는 9월 30일까지 냅니다. 기한이 지나면 접수가 안 됩니다. 조건은 공고 3쪽 표에 있습니다. 그 밖의 조건은 공고를 봅니다. 길게 적습니다. 한 문장 더.</p>',
    });
    expect(fixed.actuallyFixed).toEqual([found!.title]);
    expect(fixed.stillPresent).toEqual([]);
  });

  test('⭐ 코드로 못 재는 지적은 바뀐 구간만 넘겨 검수 1회 — 표현만 바뀐 것은 해결이 아니다', async () => {
    const prompts: string[] = [];
    const ai = issue({ id: 'ai-0', title: '자격 절에 소득 기준이 없습니다', fix: '소득 기준을 적으세요', sectionIndex: 1 });
    const res = await improveDraft({
      title: 't', html: ARTICLE, issues: [ai],
      callModel: async (prompt) => {
        prompts.push(prompt);
        if (prompt.includes('검수자')) return '[{"id":"ai-0","resolved":false,"evidence":""}]';
        return '<h2>신청 자격</h2><p>무주택 세대구성원이면 됩니다. 소득 기준은 따로 없다고 적혀 있습니다. 자산 기준은 공고문 표를 봅니다. 한 문장 더 적습니다.</p>';
      },
    });
    expect(prompts.length).toBe(2);
    expect(prompts[1]).toContain('[고치기 전]');
    expect(prompts[1]).toContain('[고친 뒤]');
    expect(prompts[1]).toContain('<h2>');                            // 속성·표 수정도 검수할 수 있게 원문 구간 전달
    expect(res.revised).toBe(1);
    expect(res.stillPresent).toEqual([ai.title]);
  });

  test('⭐ 잘 고쳐지면 구간당 1회 — 반려됐을 때만 이유를 붙여 한 번 더', async () => {
    let calls = 0;
    const ai = issue({ id: 'ai-0', title: '일정 절이 얇습니다', fix: '일정을 더 적으세요', sectionIndex: 2 });
    const ok = await improveDraft({
      title: 't', html: ARTICLE, issues: [ai],
      callModel: async (prompt) => {
        calls += 1;
        if (prompt.includes('검수자')) return '[{"id":"ai-0","resolved":true,"evidence":"결과는 10월 15일에 발표됩니다."}]';
        return '<h2>일정</h2><p>접수는 9월 20일부터입니다. 서류는 온라인으로 냅니다. 결과는 10월 15일에 발표됩니다. 계약은 11월입니다.</p>';
      },
    });
    expect(calls).toBe(2);                                            // 수정 1 + 검수 1
    expect(ok.actuallyFixed).toEqual([ai.title]);

    calls = 0;
    const retried = await improveDraft({
      title: 't', html: ARTICLE, issues: [ai],
      callModel: async (prompt) => {
        calls += 1;
        if (prompt.includes('검수자')) return '[]';
        if (calls === 1) return '<h2>일정</h2><p>짧게.</p>';           // 분량 반려
        expect(prompt).toContain('반려됐습니다 — 이유:');
        return '<h2>일정</h2><p>접수는 9월 20일부터입니다. 서류는 온라인으로 냅니다. 결과는 10월 15일에 발표됩니다. 계약은 11월입니다.</p>';
      },
    });
    expect(calls).toBe(3);                                            // 수정 1 + 재시도 1 + 검수 1
    expect(retried.revised).toBe(1);
  });

  test('⭐ 검수 답이 없거나 깨지면 해결로 치지 않는다', async () => {
    expect(parseVerification('설명…\n[{"id":"a","resolved":true,"evidence":"x"}] 끝')).toEqual([{ id: 'a', resolved: true, evidence: 'x' }]);
    expect(parseVerification('json 아님')).toEqual([]);
    const none = await verifySelectedIssues({ title: 't', changes: [{ heading: 'h', before: 'a', after: 'b' }], issues: [issue({ id: 'ai-0' })], callModel: async () => 'null' });
    expect(none).toEqual([]);
    const noEvidence = await verifySelectedIssues({ title: 't', changes: [{ heading: 'h', before: 'a', after: 'b' }], issues: [issue({ id: 'ai-0' })], callModel: async () => '[{"id":"ai-0","resolved":true}]' });
    expect(noEvidence).toEqual([]);
    let called = 0;
    await verifySelectedIssues({ title: 't', changes: [{ heading: 'h', before: 'same', after: 'same' }], issues: [issue({ id: 'ai-0' })], callModel: async () => { called += 1; return '[]'; } });
    expect(called).toBe(0);                                           // 바뀐 구간이 없으면 부르지 않는다
    expect(buildVerificationPrompt({ title: 't', changes: [{ heading: 'h', before: 'a', after: 'b' }], issues: [issue({ id: 'ai-0', title: 'x' })] })).toContain('"id":"ai-0"');
  });

  test('⭐ 이미 고친 것과 말만 다른 AI 지적은 코드가 거른다 (호출 0회)', () => {
    expect(issueSimilarity('결론에 판정 문장이 없습니다', '결론에 판정 문장이 없습니다')).toBe(1);
    const { kept, dropped } = dropResolvedLookalikes([
      issue({ id: 'ai-0', title: '마무리에 판정 문장이 없습니다', fix: '결론 첫 문장에서 답하세요' }),
      issue({ id: 'ai-1', title: '접수 기간이 본문에 없습니다', fix: '일정을 적으세요' }),
      issue({ id: 'substance-vague', title: '책임 회피·얼버무림 표현이 많습니다', origin: 'code' }),
    ], ['결론에 판정 문장이 없습니다']);
    expect(dropped.map((d) => d.id)).toEqual(['ai-0']);
    expect(kept.map((k) => k.id)).toEqual(['ai-1', 'substance-vague']);   // 코드 진단은 거르지 않는다 — 다시 재면 된다
  });

  test('⭐ critiqueDraft 가 그 체를 쓰고, fixable 표를 붙여 보낸다', async () => {
    const html = '<p>짧은 글. 사실이 없다.</p><h2>절</h2><p>내용이 얇다.</p>';
    const r = await critiqueDraft({
      title: 't', html, resolved: ['결론에 판정 문장이 없습니다'],
      callModel: async () => '[{"severity":"high","title":"결론에 판정 문장이 없습니다","detail":"","evidence":"","fix":"","sectionIndex":-1},{"severity":"low","title":"표가 없습니다","detail":"","evidence":"","fix":"","sectionIndex":1}]',
    });
    const ai = r.issues.filter((i) => i.origin === 'ai');
    expect(ai.map((i) => i.title)).toEqual(['표가 없습니다']);
    expect(r.issues.every((i) => typeof (i as any).fixable === 'boolean')).toBe(true);
    const noimage = r.issues.find((i) => i.id === 'structure-noimage') as any;
    expect(noimage?.fixable).toBe(false);
  });

  test('⭐ 발행글 비평·개선 경로도 같은 부품을 쓴다 — 두 벌로 갈라지면 한쪽만 고쳐진다', () => {
    const main = read('electron/main.ts');
    const critique = blockBetween(main, "ipcMain.handle('critique-published-post'", "ipcMain.handle('apply-post-improvement'");
    expect(critique).toContain('critique.dropResolvedLookalikes(aiIssues, alreadyFixed)');
    expect(critique).toContain('critique.annotateFixability([...codeIssues, ...aiIssues])');
    const apply = blockBetween(main, "ipcMain.handle('apply-post-improvement'", "ipcMain.handle('wordpress-update-post'");
    expect(apply).toContain("require('../dist/core/final/editor-draft')");
    expect(apply).toContain('improveDraft({');
    expect(apply).not.toContain('callGeminiWithRetry(');           // 옛 별도 루프가 사라졌다
    const modal = read('electron/ui/modules/post-critique-modal.js');
    expect(modal).toContain('const locked = issue.fixable === false');
    expect(modal).toContain("${locked ? 'disabled' : ''}");
    expect(modal).toContain('수정 버튼으로는 못 고칩니다');
  });
});

describe('③ 편집기 버튼 정리 — 되돌리기는 하나, 이 영역 이미지는 없다', () => {
  const editor = read('electron/ui/modules/editor.js');

  test('⭐ 되돌리기 버튼은 veUndoBtn 하나뿐이다', () => {
    expect(editor).not.toContain('id="veUndoImageOpBtn"');
    expect(editor).toContain('id="veUndoBtn"');
    expect((editor.match(/>↩️ 되돌리기</g) || []).length).toBe(1);
    expect(editor).not.toContain('undoImageOp(');
  });

  test('⭐ 이 영역 이미지 버튼과 그 배선이 없다 — 이미지는 [🖼️ 이미지]·[🖼️ 썸네일 넣기] 로', () => {
    expect(editor).not.toContain('id="veSectionImgBtn"');
    expect(editor).not.toContain('#veSectionImgBtn');
    expect(editor).not.toContain("generateEditorImage('section')");
    expect(editor).toContain('id="veInsertImageBtn"');
    expect(editor).toContain('id="veThumbInsertBtn"');
  });

  test('이미지·링크·표 작업이 통합 되돌리기 스택에 쌓인다', () => {
    expect(editor).toContain("onBeforeChange: () => pushUndo('이미지·링크·광고 편집')");
    expect(read('electron/ui/modules/editor-images.js')).toContain('if (state.onBeforeChange) { state.onBeforeChange(); return; }');
  });
});

describe('④ 밖에서 가져온 HTML 은 그 스킨 그대로 발행한다', () => {
  const doc = '<!doctype html><html lang="ko"><head><title>t</title><meta name="description" content="d"><style>.custom p{font-size:27px}</style><link rel="stylesheet" href="https://x/y.css"></head><body class="custom" style="padding:7px"><p>원래 문장</p></body></html>';

  test('⭐ 판정 — 자기 <style>·stylesheet 가 있고 앱 표식이 없으면 지킨다', () => {
    expect(hasAuthoredStyles(doc)).toBe(true);
    expect(hasAuthoredStyles('<p style="color:red">인라인 하나</p>')).toBe(false);   // 인라인 하나로는 판정하지 않는다
    expect(shouldPreserveOriginalStyles(doc)).toBe(true);
    expect(shouldPreserveOriginalStyles('<p>맨 글</p>')).toBe(false);
    expect(shouldPreserveOriginalStyles('<p>맨 글</p>', true)).toBe(true);
    // 앱이 만든 글은 <style> 이 있어도 앱 글이다 — 에이전트 글(v3.8.606 스킨)이 스킨을 잃으면 안 된다
    const app = '<style>.bgpt-content p{}</style><article class="bgpt-wp-ready bgpt-content"><p style="margin:0">a</p></article>';
    expect(looksLikeAppArticle(app)).toBe(true);
    expect(shouldPreserveOriginalStyles(app)).toBe(false);
  });

  test('⭐ 통째 문서는 head 의 스타일시트만 살리고 body 를 감싼 <div> 로 편다', () => {
    const flat = flattenDocumentForPost(doc);
    expect(flat.flattened).toBe(true);
    const $ = cheerio.load(flat.html);
    const rule = postcss.parse($('style').text()).first as postcss.Rule;
    expect($(rule.selector).text()).toBe('원래 문장');
    expect(rule.nodes[0]!.toString()).toBe('font-size:27px');
    expect(flat.html).toContain('<link rel="stylesheet" href="https://x/y.css">');
    expect($('.orbit-import.custom').attr('style')).toBe('padding:7px');
    expect($('.orbit-import.custom > p').text()).toBe('원래 문장');
    expect(flat.html).not.toContain('<title>');
    expect(flat.html).not.toContain('<meta');
    expect(flattenDocumentForPost('<p>조각</p>')).toEqual({ html: '<p>조각</p>', flattened: false });
  });

  test('⭐ 에이전트 스킨은 그대로다 — 초안이 인라인 style 하나에 스킨을 생략하던 회귀를 되돌렸다', () => {
    const skin = read('src/core/final/agent-skin.ts');
    expect(skin).not.toContain('hasAuthoredStyles');
  });

  test('⭐ 발행기 배선 — 블로그스팟·워드프레스 둘 다 지키고 펴서 보낸다', () => {
    const blogger = read('src/core/blogger-publisher.js');
    expect(blogger).toContain("require('./final/style-preservation')");
    expect(blogger).toContain('const preserveOriginalStyles = shouldPreserveOriginalStyles(html, payload?.preserveOriginalStyles)');
    expect(blogger).toContain('flattenDocumentForPost(html)');
    expect(blogger).toContain('if (!preserveOriginalStyles && body.content');
    const wp = read('src/wordpress/wordpress-publisher.ts');
    expect(wp).toContain("from '../core/final/style-preservation'");
    expect((wp.match(/flattenDocumentForPost\(/g) || []).length).toBe(2);   // publish() · publishToWordPress()
    // v3.8.749: "핵 옵션" CSS 자체를 뺐다 — 가져온 HTML 에 앱 CSS 가 붙을 자리가 아예 없다
    expect(wp).not.toMatch(/wordpressNuclearCSS/);
    expect(read('src/core/index.ts')).toContain('preserveOriginalStyles: payload?.preserveOriginalStyles');
  });

  test('⭐ 편집기는 파일·붙여넣기 글에만 표를 단다 — 앱이 만든 글은 예전처럼 발행기 스킨을 거친다', () => {
    const editor = read('electron/ui/modules/editor.js');
    const save = blockBetween(editor, 'async function saveCurrentSession(saveAs)', 'function hideModalAfterSave');
    expect(save).toContain("const externalSkin = session.kind === 'file' || session.kind === 'paste'");
    expect(save).toContain('const skinFlag = externalSkin ? { preserveOriginalStyles: true } : {}');
    expect((save.match(/\.\.\.skinFlag/g) || []).length).toBe(3);
    expect(save).not.toContain('preserveOriginalStyles: true,');
  });

  test('applyInlineStyles 는 밖에서 온 글(<style> 동봉)을 건드리지 않는다', () => {
    const { applyInlineStyles } = require('../src/core/blogger-publisher');
    const external = '<style>.custom p{font-size:27px}</style><div class="custom"><p>원래 문장</p></div>';
    expect(applyInlineStyles(external)).toBe(external);
    const app = '<div class="max-mode-article"><p>본문</p></div>';
    expect(applyInlineStyles(app)).not.toBe(app);
  });
});

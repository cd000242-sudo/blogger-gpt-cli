/**
 * v3.8.750 — 「비평 개선」 버튼 CONVERGENCE FIX
 *
 * 원칙: "비평 개선 버튼은 더 나은 표현을 끝없이 찾아주는 기능이 아니다.
 *        실제 발행 문제를 찾아 그 문제만 고치고, 해결되면 반드시 멈춰야 한다."
 *
 * 감사 실측(2026-09-23): 5543 은 7건 → 고침 → 8건(새 3건) → 5건, 5515 는 17 → 17 → 9 → 8 → 8 → 8.
 * 선택 개선·근거 필요 지적이 「반드시」로 떴고, 두 번째 비평이 AI 비평을 다시 돌렸고,
 * 수정이 구간을 통째로 다시 써 새 지적을 만들었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { critiqueDraft, improveDraft } from '../src/core/final/editor-draft';
import {
  classifyIssue, stableIssueIdOf, findMetaLeaks, leakIssues, recheckChain, settleAfterEdit, openChain, buttonDiagnose,
  canContinueChain, fingerprint, PUBLISHABLE_HEADLINE, CONVERGED_MESSAGE,
} from '../src/core/final/critique-convergence';
import { removeEmptySection, parseBlockAnswers } from '../src/core/final/critique-targeted-edit';
import { leafBlocks, blockSentences } from '../src/core/final/leaf-blocks';
import { rewriteAbility, summarizeCritique, issueKey, type CritiqueIssue } from '../src/core/final/post-critique';
import { stableIssueId } from '../src/core/final/critique-history';
import { blockBetween } from './helpers/source-block';

const TITLE = '실손보험 입원 거절 이의신청 방법';
const LEAK = '제공된 근거에는 각 보험사의 세부 심사 기준이 제시돼 있지 않으므로 이 부분은 따로 확인이 필요합니다.';
const S1 = '입원이 필요했다는 판단은 주치의 소견서가 가장 강한 근거가 됩니다.';
const S3 = '소견서에는 입원 기간과 치료 내용이 함께 적혀야 합니다.';
const DEADLINE = '보험사는 청구서를 받은 날부터 3영업일 안에 지급 여부를 알려야 하고, 조사가 필요하면 30일까지 늘릴 수 있습니다.';

const P = {
  intro: '<p>실손보험 입원 치료비를 청구했다가 통원 기준으로 깎였다면 먼저 거절 통지서의 사유 문구를 읽어야 합니다. 통지서에는 적용한 약관 조항과 심사 판단이 적혀 있습니다. 이 문구가 이의신청의 출발점이 됩니다.</p>',
  deadline: `<p>${DEADLINE} 통지서가 오면 날짜부터 적어 두는 것이 좋습니다. 사유 문구는 사진으로 남겨 둡니다.</p>`,
  leak: `<p>${S1} ${LEAK} ${S3}</p>`,
  clean: `<p>${S1} ${S3}</p>`,
  order1: '<p>이의신청은 보험사 고객센터에 서면으로 먼저 냅니다. 답이 없거나 같은 결론이면 금융감독원 민원으로 넘어갑니다. 민원 접수 뒤에는 보험사가 다시 검토한 결과를 알려 줍니다.</p>',
  order2: '<p>서면에는 청구 번호와 거절 날짜, 다시 봐 달라는 이유를 한 장으로 정리합니다. 소견서 사본을 붙이면 검토가 빨라집니다. 전화 상담 내용도 날짜와 함께 적어 둡니다.</p>',
  docs: '<p>준비할 서류는 진단서, 입원 확인서, 진료비 세부 내역서 세 가지입니다. 병원 원무과에서 한 번에 발급받을 수 있습니다. 발급 비용은 병원마다 다릅니다.</p>',
};
function article(opts: { leak?: boolean; extra?: string } = {}): string {
  return [
    P.intro,
    '<h2>1. 거절 사유 확인</h2>', P.deadline, opts.leak === false ? P.clean : P.leak,
    '<h2>2. 이의신청 순서</h2>', P.order1, P.order2,
    '<h2>3. 서류 준비</h2>', P.docs, opts.extra || '',
  ].join('\n');
}

/** 편집 프롬프트에서 [B1] 문단들을 꺼낸다 */
function blocksIn(prompt: string): Array<{ id: string; inner: string }> {
  return [...prompt.matchAll(/^\[(B\d+)\]\n([\s\S]*?)\n {2}(?:지적 1|\()/gm)].map((m) => ({ id: m[1]!, inner: m[2]! }));
}
/** 문단을 이렇게 고쳐 오는 가짜 편집기 */
const editWith = (fn: (inner: string) => string, extra: Array<{ id: string; html: string }> = []) => async (prompt: string) =>
  JSON.stringify({ blocks: [...blocksIn(prompt).map((b) => ({ id: b.id, html: fn(b.inner) })), ...extra] });
const noModel = async (): Promise<string> => { throw new Error('모델을 부르면 안 됩니다'); };
const paragraphs = (html: string): string[] => html.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) || [];

const code = (over: Partial<CritiqueIssue>): CritiqueIssue => ({
  id: 'x', area: 'structure', severity: 'medium', title: 't', detail: '', evidence: '', fix: '', sectionIndex: -1, origin: 'code', ...over,
});

describe('① 분류 — BLOCKING 은 심각도와 별개다', () => {
  const body = article().replace(/<[^>]+>/g, ' ');

  test('⭐ 작성 과정 누출은 BLOCKING, 표현·반복은 OPTIONAL, 근거가 있어야 풀리는 것은 NEEDS_NEW_EVIDENCE', () => {
    expect(classifyIssue(code({ id: 'audit-writing-process-leak-3' }), body)).toBe('BLOCKING');
    expect(classifyIssue(code({ id: 'answer-missing' }), body)).toBe('BLOCKING');
    expect(classifyIssue(code({ id: 'audit-empty-section-2' }), body)).toBe('BLOCKING');
    for (const id of ['audit-cross-section-echo-4', 'audit-tone-mix-7', 'audit-glued-sentence-3', 'audit-term-flood-12', 'audit-deferral-flood-2', 'quality-paragraphs']) {
      expect([id, classifyIssue(code({ id, severity: 'high' }), body)]).toEqual([id, 'OPTIONAL']);
    }
    for (const id of ['substance-facts', 'quality-sources', 'quality-sourceSuspicion', 'quality-length', 'competitor-gap', 'audit-no-legal-basis-6']) {
      expect([id, classifyIssue(code({ id, severity: 'high' }), body)]).toEqual([id, 'NEEDS_NEW_EVIDENCE']);
    }
  });

  test('⭐ AI 는 blocking:true 만으로 BLOCKING 이 못 된다 — 종류가 발행 결함이고 근거 문장이 본문에 글자 그대로 있어야 한다', () => {
    const ai = (over: Partial<CritiqueIssue>) => code({ id: 'ai-0', origin: 'ai', blocking: true, aiType: 'unsupported-claim', evidence: DEADLINE, ...over });
    expect(classifyIssue(ai({}), body)).toBe('BLOCKING');
    expect(classifyIssue(ai({ evidence: '보험사는 사흘 안에 알려야 한다고 적었습니다' }), body)).toBe('OPTIONAL');   // 바꿔 말한 근거
    expect(classifyIssue(ai({ aiType: 'style' }), body)).toBe('OPTIONAL');
    expect(classifyIssue(ai({ blocking: false, aiType: 'needs-evidence' }), body)).toBe('NEEDS_NEW_EVIDENCE');
    expect(classifyIssue(ai({ blocking: false, aiType: '', title: '사례가 부족합니다', fix: '실제 사례를 추가하세요' }), body)).toBe('NEEDS_NEW_EVIDENCE');
  });

  test('⭐ rewriteAbility 기본값은 그대로 — 버튼 모드(targeted)에서만 근거 필요 지적을 잠근다', () => {
    expect(rewriteAbility({ id: 'substance-facts', title: '' }).fixable).toBe(true);            // 자동 경로(발행 전 자가 수정)는 예전 그대로
    const targeted = rewriteAbility({ id: 'substance-facts', title: '' }, { targeted: true });
    expect(targeted).toMatchObject({ fixable: false, reason: 'NEEDS_NEW_EVIDENCE' });
    expect(targeted.hint).toContain('근거를 추가해 다시 생성해야 하는 항목');
    expect(rewriteAbility({ id: 'audit-cross-section-echo-2', title: '' }, { targeted: true }).fixable).toBe(true);
  });

  test('「반드시 고칠 것」 요약은 심각도 high 가 아니라 blocking 을 센다', () => {
    const graded = [code({ severity: 'high', blocking: false }), code({ severity: 'low', blocking: true })];
    expect(summarizeCritique(graded)).toContain('반드시 고칠 것 1건');
    expect(summarizeCritique([code({ severity: 'high' })])).toContain('반드시 고칠 것 1건');   // 예전 호출은 그대로
  });
});

describe('② 이름표 — 순번이 바뀌어도 같은 지적 (test 4)', () => {
  test('⭐ audit 순번·AI 순번을 떼고 잰다 (issueKey)', () => {
    const echo = { title: '"1번째 구간" 과 "2-1. 기록 중심 이의신청 순서" 이 같은 말을 합니다', evidence: '앞: 소견서가 가장 강한 근거\n뒤: 소견서가 가장 강한 근거' };
    expect(stableIssueIdOf(code({ id: 'audit-cross-section-echo-3', ...echo }))).toBe(stableIssueIdOf(code({ id: 'audit-cross-section-echo-7', ...echo })));
    expect(stableIssueIdOf(code({ id: 'audit-cross-section-echo-3', ...echo }))).toBe(issueKey(code({ id: 'audit-cross-section-echo-3', ...echo })));
    expect(stableIssueIdOf(code({ id: 'ai-0', origin: 'ai', title: '기한이 틀렸습니다' }))).toBe(stableIssueIdOf(code({ id: 'ai-4', origin: 'ai', title: '기한이 틀렸습니다' })));
  });

  test('⭐ 비평 이력(critique-history)도 audit 순번을 이름표로 쓰지 않는다', () => {
    const echo = { title: '"1번째 구간" 과 "4-1. 청구 전에 읽을 약관 항목" 이 같은 말을 합니다', evidence: '앞: 같은 문장\n뒤: 같은 문장' };
    expect(stableIssueId({ id: 'audit-cross-section-echo-5', ...echo })).toBe(stableIssueId({ id: 'audit-cross-section-echo-2', ...echo }));
    expect(stableIssueId({ id: 'substance-facts', title: '구체적인 사실이 부족합니다' })).toBe('substance-facts');   // 고정 id 는 그대로
  });

  test('⭐ 순번이 밀려도 이어서 확인에서 "새 지적"이 아니라 같은 OPEN 이다', () => {
    const html = article();
    const first = openChain({ title: TITLE, html, issues: buttonDiagnose({ title: TITLE, html }) });
    const leak = first.issues.find((i) => i.blocking)!;
    const renumbered = { ...first.chain, issues: first.chain.issues.map((ci) => ({ ...ci, id: ci.id.replace(/-\d+$/, '-99') })) };
    const again = recheckChain({ title: TITLE, html, chain: renumbered });
    const same = again.issues.find((i) => i.stableIssueId === leak.stableIssueId)!;
    expect(same.state).toBe('OPEN');
    expect(again.convergence.newOptionalIgnored).toBe(0);
    expect(again.issues).toHaveLength(first.issues.length);
  });
});

describe('③ 첫 비평 — 선택 개선만 있으면 발행 가능 (test 2)', () => {
  test('⭐ OPTIONAL·근거 필요만 남은 글: 자동 수정 대상 0 · "발행 가능 — 남은 항목은 선택 개선입니다."', async () => {
    const r = await critiqueDraft({ title: TITLE, html: article({ leak: false }), callModel: async () => '[]' });
    expect(r.convergence!.converged).toBe(true);
    expect(r.convergence!.headline).toBe(PUBLISHABLE_HEADLINE);
    expect(r.convergence!.message).toBe(CONVERGED_MESSAGE);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues.some((i: any) => i.blocking)).toBe(false);
    expect(r.issues.some((i: any) => i.autoSelect)).toBe(false);          // 모달이 미리 체크할 것이 없다
    expect(r.summary).toContain('반드시 고칠 것 0건');
    // 점수는 발행을 막는 결함만으로 — "발행 가능"인데 0점이 나오면 점수를 올리려 선택 개선을 끝없이 고치게 된다
    expect(r.score).toBe(100);
    expect(r.summary).toContain('점수 100점');
  });

  test('⭐ 누출이 있는 글: 누출만 BLOCKING 으로 미리 골라지고, 근거 필요 지적은 잠긴다', async () => {
    const r = await critiqueDraft({ title: TITLE, html: article(), callModel: async () => '[]' });
    expect(r.convergence!.converged).toBe(false);
    const picked = r.issues.filter((i: any) => i.autoSelect);
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ issueClass: 'BLOCKING', state: 'OPEN', fixable: true, sectionIndex: 1 });
    const needs = r.issues.filter((i: any) => i.issueClass === 'NEEDS_NEW_EVIDENCE');
    expect(needs.length).toBeGreaterThan(0);
    expect(needs.every((i: any) => i.fixable === false && /근거를 추가해 다시 생성해야 하는 항목/.test(i.fixHint))).toBe(true);
    expect(r.score).toBe(82);                                           // 반드시 1건(18점)만 깎는다
  });
});

describe('④ 지적된 문단만 고친다 (mode: critiqueTargeted)', () => {
  test('⭐ test 1 — BLOCKING → 수정 → RESOLVED → 종료 (두 번째 비평은 AI 호출 0회)', async () => {
    const html0 = article();
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const picked = c1.issues.filter((i: any) => i.autoSelect);
    const prompts: string[] = [];
    const r: any = await improveDraft({
      title: TITLE, html: html0, issues: picked, mode: 'critiqueTargeted', chain: c1.chain,
      callModel: async (p) => { prompts.push(p); return editWith((inner) => inner.replace(`${LEAK} `, ''))(p); },
    });
    expect(prompts).toHaveLength(1);                                     // 구간 하나, 한 번
    expect(prompts[0]).toContain('# 고칠 문단');
    expect(r.html).not.toContain(LEAK);
    expect(r.actuallyFixed).toEqual([picked[0]!.title]);
    expect(r.chain.issues.find((ci: any) => ci.stableIssueId === (picked[0] as any).stableIssueId).state).toBe('RESOLVED');
    expect(r.convergence.converged).toBe(true);

    const spy = jest.fn(async () => '[]');
    const c2 = await critiqueDraft({ title: TITLE, html: r.html, chain: r.chain, callModel: spy });
    expect(spy).not.toHaveBeenCalled();
    expect(c2.convergence).toMatchObject({ converged: true, headline: PUBLISHABLE_HEADLINE, message: CONVERGED_MESSAGE, fullCritique: false });
    expect(c2.resolvedIssues!.map((i) => i.stableIssueId)).toEqual([(picked[0] as any).stableIssueId]);
    expect(c2.issues.some((i: any) => i.blocking)).toBe(false);
  });

  test('⭐ test 3 — 근거가 있어야 풀리는 지적은 편집기로 보내지 않는다 (호출 0회)', async () => {
    const html0 = article({ leak: false });
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const needs = c1.issues.filter((i: any) => i.issueClass === 'NEEDS_NEW_EVIDENCE');
    const ai = code({ id: 'ai-0', origin: 'ai', aiType: 'needs-evidence', title: '경쟁글보다 사례가 적습니다', evidence: S1 });
    const r = await improveDraft({ title: TITLE, html: html0, issues: [...needs, ai], mode: 'critiqueTargeted', chain: c1.chain, callModel: noModel });
    expect(r.html).toBe(html0);
    expect(r.revised).toBe(0);
    expect(r.skipped.filter((s) => s.includes('근거를 추가해 다시 생성해야 하는 항목'))).toHaveLength(needs.length + 1);
  });

  test('⭐ test 5 — 지적되지 않은 문단은 바이트 하나 안 바뀐다 (목록 밖 id 는 버린다)', async () => {
    const html0 = article();
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const r: any = await improveDraft({
      title: TITLE, html: html0, issues: c1.issues.filter((i: any) => i.autoSelect), mode: 'critiqueTargeted', chain: c1.chain,
      callModel: editWith((inner) => inner.replace(`${LEAK} `, ''), [{ id: 'B7', html: '다른 문단을 몰래 고쳤습니다.' }]),
    });
    const untouched = paragraphs(html0).filter((p) => !p.includes(LEAK));
    expect(untouched.every((p) => r.html.includes(p))).toBe(true);
    expect(r.html).not.toContain('몰래');
    expect(r.preservation.untouchedKept).toBe(r.preservation.untouchedTotal);
    expect(r.preservation.blocksTargeted).toBe(1);
    expect(r.preservation.sentencesTotal - r.preservation.sentencesKept).toBe(1);   // 지운 누출 문장 하나뿐
  });

  test('⭐ 문단을 통째로 새로 쓰면 버린다 — 고치기이지 다시 쓰기가 아니다', async () => {
    const html0 = article();
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const r = await improveDraft({
      title: TITLE, html: html0, issues: c1.issues.filter((i: any) => i.autoSelect), mode: 'critiqueTargeted', chain: c1.chain,
      callModel: editWith(() => '소견서는 입원의 필요성을 보여 주는 서류입니다. 병원에서 발급받아 제출하면 됩니다.'),
    });
    expect(r.html).toBe(html0);
    expect(r.skipped.join('\n')).toContain('지적과 관계없는 문장까지 바꿨습니다');
  });

  test('⭐ test 7 — 고친 결과가 새 BLOCKING 을 만들면 그 구간은 원문을 지킨다 (REGRESSION)', async () => {
    const html0 = article();
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const picked = c1.issues.filter((i: any) => i.autoSelect);
    const r: any = await improveDraft({
      title: TITLE, html: html0, issues: picked, mode: 'critiqueTargeted', chain: c1.chain,
      callModel: editWith(() => `${S1} undefined ${S3}`),
    });
    expect(r.html).toBe(html0);
    expect(r.regressions).toHaveLength(1);
    expect(r.regressions[0].titles.join(' ')).toContain('코드 치환 찌꺼기');
    expect(r.actuallyFixed).toEqual([]);
    expect(r.stillPresent).toContain(picked[0]!.title);
    expect(r.convergence.converged).toBe(false);
  });

  test('⭐ test 8 — 편집기가 쓴 작성 과정 문장은 막는다 (두 번 시도 뒤 원문)', async () => {
    const html0 = article();
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const prompts: string[] = [];
    const r = await improveDraft({
      title: TITLE, html: html0, issues: c1.issues.filter((i: any) => i.autoSelect), mode: 'critiqueTargeted', chain: c1.chain,
      callModel: async (p) => { prompts.push(p); return editWith((inner) => inner.replace(LEAK, '이 구간의 자료만으로 확인할 수 없습니다.'))(p); },
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('작성 과정·자료 한계를 말하는 문장이 들어갔습니다');
    expect(r.html).toBe(html0);
    expect(r.skipped.join('\n')).toContain('(2회 시도)');
  });

  test('⭐ 누출 감지 — 지시서의 다섯 문장은 잡고, 독자 상황은 잡지 않는다', () => {
    for (const s of [
      '이 구간의 자료만으로 확인할 수 없습니다.',
      '자료에 없으므로 작성할 수 없습니다.',
      '근거가 부족합니다.',
      '해당 수치는 임의로 적으면 안 됩니다.',
      '이 글에서는 확인할 수 없습니다.',
    ]) expect([s, findMetaLeaks(`통지서를 먼저 읽습니다. ${s}`).length]).toEqual([s, 1]);
    for (const s of ['보험사가 제시한 거절 근거가 부족합니다.', '소득 구간에 따라 보험료가 다릅니다.', '공단 자료에 없으므로 따로 신청해야 합니다.']) {
      expect([s, findMetaLeaks(s).length]).toEqual([s, 0]);
    }
    const leaks = leakIssues(`<p>통지서를 읽습니다. 근거가 부족합니다.</p><h2>1. 순서</h2><p>${LEAK} 서면으로 냅니다.</p>`);
    expect(leaks.map((i) => i.sectionIndex)).toEqual([0, 1]);
  });

  test('⭐ 마침표 없는 소제목 아래의 누출도 문단에서 찾아 고친다 (5515 재생에서 찾은 구멍)', async () => {
    const leak2 = '제공된 근거에는 부결 뒤 재신청까지 기다려야 하는 기간이 나와 있지 않습니다.';
    const html0 = article({ extra: `<h3>재신청 시점은 확인이 필요해요</h3><p>${leak2} 조회 기록은 남습니다. 다음 신청은 서류를 갖춘 뒤에 합니다.</p>` });
    expect(blockSentences(html0)).toContain(leak2);                     // 소제목과 붙은 "문장"이 아니다
    expect(leakIssues(html0).map((l) => l.evidence)).toEqual([LEAK, leak2]);
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const picked = c1.issues.filter((i: any) => i.autoSelect);
    expect(picked).toHaveLength(2);
    const r: any = await improveDraft({
      title: TITLE, html: html0, issues: picked, mode: 'critiqueTargeted', chain: c1.chain,
      callModel: editWith((inner) => inner.replace(`${LEAK} `, '').replace(`${leak2} `, '')),
    });
    expect(r.actuallyFixed).toHaveLength(2);
    expect(r.convergence.converged).toBe(true);
  });

  test('⭐ AI BLOCKING — 근거 문장을 지우면 검수 1회로 해결을 확인한다', async () => {
    const html0 = article({ leak: false });
    const aiRaw = JSON.stringify([{ severity: 'high', blocking: true, type: 'unsupported-claim', title: '지급 기한의 근거가 없습니다', detail: '', evidence: DEADLINE, fix: '근거를 붙이세요', sectionIndex: 1 }]);
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => aiRaw });
    const ai = c1.issues.find((i: any) => i.origin === 'ai') as any;
    expect(ai).toMatchObject({ issueClass: 'BLOCKING', autoSelect: true });
    const prompts: string[] = [];
    const r: any = await improveDraft({
      title: TITLE, html: html0, issues: [ai], mode: 'critiqueTargeted', chain: c1.chain,
      callModel: async (p) => {
        prompts.push(p);
        // 지운 문장은 beforeEvidence 로 — 검수는 "실제로 바뀐 원문" 인용이 있어야 해결로 친다
        if (p.includes('수정 결과 검수자')) return JSON.stringify([{ id: ai.id, resolved: true, evidence: '통지서가 오면 날짜부터 적어 두는 것이 좋습니다.', beforeEvidence: DEADLINE }]);
        return editWith((inner) => inner.replace(`${DEADLINE} `, ''))(p);
      },
    });
    expect(prompts).toHaveLength(2);                                     // 편집 1 + 검수 1
    expect(r.html).not.toContain(DEADLINE);
    expect(r.actuallyFixed).toEqual([ai.title]);
    expect(r.convergence.converged).toBe(true);
  });

  test('⭐ 빈 절은 모델 없이 절째 뺀다 — 목차 항목도 함께', async () => {
    const html0 = `<ul class="toc"><li>1. 거절 사유 확인</li><li>4. 공식 안내 경로</li></ul>${article({ leak: false, extra: '<h2>4. 공식 안내 경로</h2><div class="content"></div>' })}`;
    const c1 = await critiqueDraft({ title: TITLE, html: html0, callModel: async () => '[]' });
    const empty = c1.issues.filter((i: any) => i.autoSelect);
    expect(empty.map((i) => i.title)).toEqual(['절이 비어 있습니다: "4. 공식 안내 경로"']);
    const r: any = await improveDraft({ title: TITLE, html: html0, issues: empty, mode: 'critiqueTargeted', chain: c1.chain, callModel: noModel });
    expect(r.html).not.toContain('4. 공식 안내 경로');
    expect(r.actuallyFixed).toHaveLength(1);
    expect(r.convergence.converged).toBe(true);
    expect(removeEmptySection(article(), '1. 거절 사유 확인')).toBeNull();   // 내용 있는 절은 안 뺀다
  });
});

describe('⑤ 이어서 확인 — AI 없이 BLOCKING 만 잰다', () => {
  test('⭐ test 9 — 체인이 있으면 두 번째 비평은 AI 를 부르지 않는다', async () => {
    const c1 = await critiqueDraft({ title: TITLE, html: article(), callModel: async () => '[]' });
    const spy = jest.fn(async () => '[]');
    const c2 = await critiqueDraft({ title: TITLE, html: article(), chain: c1.chain, callModel: spy });
    expect(spy).not.toHaveBeenCalled();
    expect(c2.aiSkipped).toBe(true);
    expect(c2.convergence!.fullCritique).toBe(false);
    expect(c2.roundCount).toBe(2);
  });

  test('⭐ test 10 — 「전체 다시 비평」을 눌렀을 때만 AI 비평을 다시 돈다', async () => {
    const c1 = await critiqueDraft({ title: TITLE, html: article(), callModel: async () => '[]' });
    const spy = jest.fn(async () => '[]');
    const c2 = await critiqueDraft({ title: TITLE, html: article(), chain: c1.chain, fullRecritique: true, callModel: spy });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(c2.convergence!.fullCritique).toBe(true);
    expect(c2.roundCount).toBe(2);                                      // 같은 체인을 잇는다
  });

  test('⭐ test 11 — BLOCKING 0 이면 끝, 같은 글을 다시 눌러도 새 선택 항목을 찾지 않는다', () => {
    const html = article({ leak: false });
    const first = openChain({ title: TITLE, html, issues: buttonDiagnose({ title: TITLE, html }) });
    expect(first.convergence.converged).toBe(true);
    const again = recheckChain({ title: TITLE, html, chain: first.chain });
    const third = recheckChain({ title: TITLE, html, chain: again.chain });
    expect(third.convergence).toMatchObject({ converged: true, headline: PUBLISHABLE_HEADLINE, message: CONVERGED_MESSAGE, critiqueRound: 3 });
    expect(third.issues.map((i) => i.stableIssueId)).toEqual(first.issues.map((i) => i.stableIssueId));
    expect(canContinueChain(third.chain, { title: TITLE, html })).toBe(true);
    expect(third.chain.articleFingerprint).toBe(fingerprint(html));
  });

  test('⭐ test 6 — 수정이 만든 새 BLOCKING 은 REGRESSED, 해결됐다가 돌아온 것도 REGRESSED', () => {
    const html0 = article();
    const first = openChain({ title: TITLE, html: html0, issues: buttonDiagnose({ title: TITLE, html: html0 }) });
    const leakKey = first.issues.find((i) => i.blocking)!.stableIssueId;
    // 버튼 수정이 누출은 지웠지만 같은 구간에 찌꺼기를 남긴 본문 (되돌림을 거치지 않고 들어온 경우)
    const bad = html0.replace(P.leak, `<p>${S1} 그래서$1 ${S3}</p>`);
    const settled = settleAfterEdit({ title: TITLE, html: bad, chain: first.chain, revisedSections: [1] });
    const artifact = settled.issues.find((i) => /코드 치환 찌꺼기/.test(i.title))!;
    expect(artifact).toMatchObject({ issueClass: 'BLOCKING', state: 'REGRESSED' });
    expect(settled.chain.issues.find((ci) => ci.stableIssueId === leakKey)!.state).toBe('RESOLVED');
    expect(settled.convergence.converged).toBe(false);
    expect(settled.convergence.counts.regressed).toBe(1);

    // 누출이 해결된 체인에 누출이 되돌아오면
    const clean = settleAfterEdit({ title: TITLE, html: html0.replace(P.leak, P.clean), chain: first.chain, revisedSections: [1] });
    expect(clean.convergence.converged).toBe(true);
    const back = recheckChain({ title: TITLE, html: html0, chain: clean.chain });
    expect(back.issues.find((i) => i.stableIssueId === leakKey)!.state).toBe('REGRESSED');
    expect(back.convergence.converged).toBe(false);
  });

  test('다른 글이면 체인을 잇지 않는다 (첫 비평부터)', () => {
    const first = openChain({ title: TITLE, html: article(), issues: [] });
    expect(canContinueChain(first.chain, { title: '자동차보험 할증 기준', html: '<h2>할증</h2><p>다른 글</p>' })).toBe(false);
    expect(canContinueChain({ version: 9 }, { title: TITLE, html: article() })).toBe(false);
    expect(canContinueChain('망가진 값', { title: TITLE, html: article() })).toBe(false);
  });
});

describe('⑥ 문단 부품', () => {
  test('잎 문단만 — 다른 블록을 품은 것은 문단이 아니다', () => {
    const html = '<div class="answer-first"><p class="answer-first-q">질문</p><p class="answer-first-a">답입니다</p></div><ul><li><p>항목</p></li><li>그냥 항목</li></ul><table><tr><td>셀</td></tr></table>';
    expect(leafBlocks(html).map((b) => `${b.tag}:${b.text}`)).toEqual(['p:질문', 'p:답입니다', 'p:항목', 'li:그냥 항목', 'td:셀']);
  });

  test('모델 답은 {"blocks":[…]} 도, 배열도, 코드블록도 읽는다 — 아니면 null', () => {
    expect(parseBlockAnswers('```json\n{"blocks":[{"id":"B1","html":"a"}]}\n```')!.get('B1')).toBe('a');
    expect(parseBlockAnswers('[{"id":"B2","html":""}]')!.get('B2')).toBe('');
    expect(parseBlockAnswers('고칠 게 없습니다')).toBeNull();
  });
});

describe('⑦ 자동 경로는 그대로 (test 12 · 13)', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  test('⭐ mode 없이 부르면 예전 구간 다시 쓰기 그대로다 (발행 전 자가 수정 97% 경로)', async () => {
    const prompts: string[] = [];
    const html0 = article();
    await improveDraft({
      title: TITLE, html: html0, verify: false,
      issues: [code({ id: 'audit-writing-process-leak-3', severity: 'high', title: '글 쓰는 과정이 독자에게 새어 나왔습니다', evidence: LEAK, sectionIndex: 1 })],
      callModel: async (p) => { prompts.push(p); return 'garbage'; },
    });
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]).toContain('# 지금 이 구간의 HTML');
    expect(prompts[0]).not.toContain('# 고칠 문단');
  });

  test('⭐ 발행 전 자가 수정·자동 품질 루프는 버튼 모드를 넘기지 않는다', () => {
    const selfFix = read('src/core/final/pre-publish-fix.ts');
    expect(selfFix).toContain('improveDraft({');
    expect(selfFix).not.toContain('critiqueTargeted');
    const loop = read('src/core/final/critique-loop.ts');
    expect(loop).not.toMatch(/critique-convergence|critique-targeted-edit|critiqueTargeted/);
  });

  test('사람이 직접 적은 요청(이렇게 고쳐줘)은 버튼 모드여도 글 전체 수정으로 간다', () => {
    const draft = read('src/core/final/editor-draft.ts');
    expect(draft).toContain("input.mode === 'critiqueTargeted' && !(input.issues || []).some((issue) => String(issue?.id || '').startsWith('user-request-'))");
  });
});

describe('⑧ 배선 — 없는 값·없는 채널은 조용히 죽는다', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const main = read('electron/main.ts');
  const editor = read('electron/ui/modules/editor.js');
  const modal = read('electron/ui/modules/post-critique-modal.js');

  test('⭐ 편집기 IPC 가 체인·전체 다시 비평·버튼 모드를 넘긴다', () => {
    const critique = blockBetween(main, "ipcMain.handle('critique-editor-html'", "ipcMain.handle('improve-editor-html'");
    expect(critique).toContain('chain: args?.chain');
    expect(critique).toContain('fullRecritique: args?.fullRecritique === true');
    const improve = blockBetween(main, "ipcMain.handle('improve-editor-html'", "ipcMain.handle('generate-editor-image'");
    expect(improve).toContain("mode: args?.mode === 'critiqueTargeted' ? 'critiqueTargeted' : undefined");
    expect(improve).toContain('chain: args?.chain');
  });

  test('⭐ 발행글 비평은 체인 파일로 이어서 확인하고, 수정은 버튼 모드로 한다', () => {
    const critique = blockBetween(main, "ipcMain.handle('critique-published-post'", "ipcMain.handle('apply-post-improvement'");
    expect(critique).toContain("require('../dist/core/final/critique-convergence')");
    expect(critique).toContain('convergence.recheckChain(');
    expect(critique).toContain('convergence.openChain(');
    expect(critique).toContain('convergence.saveChainFile(critiqueChainPath()');
    expect(critique).toContain('!args?.fullRecritique');
    const apply = blockBetween(main, "ipcMain.handle('apply-post-improvement'", "ipcMain.handle('wordpress-list-posts'");
    expect(apply).toContain("mode: 'critiqueTargeted'");
    expect(apply).toContain('convergence.saveChainFile(critiqueChainPath()');
    expect(main).toContain("const critiqueChainPath = (): string => path.join(app.getPath('userData'), 'critique-chains.json');");
  });

  test('⭐ 편집기 — 비평 모달의 수정만 버튼 모드, 「이렇게 고쳐줘」는 아니다', () => {
    const critique = editor.slice(editor.indexOf('modalRefs.critiqueBtn?.addEventListener'), editor.indexOf('modalRefs.regenCtaBtn?.addEventListener'));
    expect(critique).toContain('chain: session.critiqueChain || null');
    expect(critique).toContain("mode: 'critiqueTargeted'");
    expect(critique).toContain('session.critiqueChain = critique.chain || null');
    expect(critique).toContain('if (res.chain) session.critiqueChain = res.chain');
    const askFix = editor.slice(editor.indexOf('modalRefs.askFixBtn?.addEventListener'), editor.indexOf('modalRefs.revertBtn.addEventListener'));
    expect(askFix).not.toContain('critiqueTargeted');
    expect(editor).toContain('session.critiqueChain = null');       // 원본으로 되돌리면 체인도 버린다
  });

  test('⭐ 모달 — 반드시/선택/근거 필요로 나누고, 미리 체크는 autoSelect 만', () => {
    expect(modal).toContain("const checked = !locked && (graded ? issue.autoSelect === true : issue.severity === 'high') ? 'checked' : '';");
    for (const label of ['반드시 고칠 것', '선택 개선', '근거가 필요한 항목', '해결된 반드시 고칠 것']) expect(modal).toContain(label);
    expect(modal).toContain('critique?.convergence');
    expect(modal).toContain('id="pcFull"');
    expect(modal).toContain('전체 다시 비평');
  });

  test('⭐ 글목록·비서도 같은 모달·같은 기준을 쓴다', () => {
    const published = read('electron/ui/modules/published-posts.js');
    expect(published).toContain('onFullRecritique: () => critiquePostAt(index, { full: true })');
    expect(published).toContain('fullRecritique: opts?.full === true');
    const assistant = read('electron/ui/modules/assistant.js');
    const run = assistant.slice(assistant.indexOf('async function runCritiqueLatest'), assistant.indexOf('async function applyCritiqueFixes'));
    expect(run).toContain('i.autoSelect');
    expect(run).toContain('res.convergence');
  });
});

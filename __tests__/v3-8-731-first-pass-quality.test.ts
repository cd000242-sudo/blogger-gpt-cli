/**
 * v3.8.731 — 첫 생성 점수 올리기: ① 발행 전 자가 수정이 실제로 고친다 ② 초안 감사 목록을 보강에 싣는다
 *
 * 사장님: "글을 한번 쓸 때 LLM 이 비평하더라도 수정할 게 없고 100점에 가깝게 글을 쓰게 못하니?"
 *
 * 장부 실측(9/6~9/15, 40편): 첫 생성 중앙값 82점 · 구간 반복 59건 1위 · 자가 수정은 33편에서 돌았는데 2편만 고침.
 * 못 고친 이유는 관문이었다 — 구간 반복은 "지우라"는 처방인데 "분량 90% 미만이면 반려", 200자 미만 구간은 무조건 반려,
 * 답 블록 수정 금지, 반려돼도 재시도 없음.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fixBeforePublish, toCritiqueIssue, inspectBeforePublish } from '../src/core/final/pre-publish-fix';
import { auditDraft, buildDraftFixBlock, draftToHtml, compareDraftAudits, describeDraftFindings, DRAFT_FIX_KINDS } from '../src/core/final/draft-audit';
import { isCuttingIssue, acceptRevisedSection, issueKey, diagnosePost } from '../src/core/final/post-critique';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 두 절이 같은 말을 하는 글 — 실제 장부의 1위 결함 모양 */
const ECHO = '<p>도입부입니다. 보증금을 돌려받지 못한 세입자가 무엇을 먼저 해야 하는지 정리합니다. 충분히 긴 도입부 문장입니다.</p>'
  + '<h2>임차권등기명령 신청</h2><p>임차권등기명령은 이사를 가도 대항력과 우선변제권이 유지되는 제도입니다. 신청은 주택 소재지 지방법원에 합니다. 등기가 완료된 뒤에 이사해야 안전합니다.</p>'
  + '<h2>보증금 반환 소송</h2><p>임차권등기명령은 이사를 가도 대항력과 우선변제권이 유지되는 제도입니다. 소송은 지급명령으로 시작할 수 있습니다. 판결 뒤 강제집행으로 넘어갑니다.</p>';

describe('① 발행 전 자가 수정 — 구간 반복을 실제로 지운다', () => {
  test('⭐ 하네스 결함 id 가 diagnosePost 와 같은 이름표를 낸다 — 재측정이 같은 결함을 알아본다', () => {
    const report = inspectBeforePublish({ title: '보증금 못 받으면 어떻게 하나', html: ECHO });
    const echo = report.fixable.find((f) => f.kind === 'cross-section-echo');
    expect(echo).toBeTruthy();
    // 세 번째 원인: 근거가 "앞: …\n뒤: …" 꼴이라 어느 구간에서도 못 찾아 늘 -1(글 전체) → 도입부를 고쳤다.
    // 고칠 곳은 뒤 절(2번)이다 — 같은 문장이 1번 절에도 있으니 앞에서부터 찾으면 1번이 잡힌다
    expect(echo!.sectionIndex).toBe(2);
    const issue = toCritiqueIssue(echo!);
    expect(issue.id).toBe('audit-cross-section-echo-0');
    const fromDiagnose = diagnosePost({ title: '보증금 못 받으면 어떻게 하나', html: ECHO, competitors: [] })
      .find((i) => i.id.startsWith('audit-cross-section-echo'));
    expect(fromDiagnose).toBeTruthy();
    expect(issueKey(issue)).toBe(issueKey(fromDiagnose!));
  });

  test('⭐ 구간 반복·절차 반복은 "빼는 수정" — 짧아져도 받는다', () => {
    expect(isCuttingIssue({ id: 'audit-cross-section-echo-2', title: '', fix: '' })).toBe(true);
    expect(isCuttingIssue({ id: 'pre-procedure-repeat', title: '', fix: '' })).toBe(true);
    expect(isCuttingIssue({ id: 'audit-no-legal-basis-1', title: '', fix: '' })).toBe(false);
  });

  test('⭐ 겹치는 문장을 지운 답이 관문을 지나 발행본에 반영된다 (예전엔 "분량이 줄었습니다"로 반려)', async () => {
    const prompts: string[] = [];
    const out = await fixBeforePublish(
      { title: '보증금 못 받으면 어떻게 하나', html: ECHO },
      async (prompt) => {
        prompts.push(prompt);
        // 뒤 절의 겹치는 문장을 지우고 그 절만의 말을 조금 보탠다 — 분량은 90% 아래로 준다
        return '<h2>보증금 반환 소송</h2><p>소송은 지급명령으로 시작할 수 있습니다. 판결 뒤 강제집행으로 넘어갑니다. 비용은 인지대와 송달료입니다.</p>';
      },
    );
    expect(out.revised).toBe(1);
    expect(out.calls).toBeLessThanOrEqual(2);   // 반영 1회 + 남은 흐름 결함으로 1회 더(예산 안)
    expect(out.html).not.toContain('<h2>보증금 반환 소송</h2><p>임차권등기명령은');
    expect(out.html).toContain('비용은 인지대와 송달료입니다');
    // 상대 절의 평문을 비교용으로 실어 보낸다 — 어디와 겹치는지 모르면 못 고친다
    expect(prompts[0]).toContain('지적이 가리키는 다른 구간의 내용');
    expect(out.notes.join('\n')).toContain('다시 썼습니다');
  });

  test('⭐ 반려되면 이유를 붙여 한 번 더 — 그래도 안 되면 원본, 사유가 notes 에 남는다', async () => {
    let calls = 0;
    const out = await fixBeforePublish(
      { title: '보증금 못 받으면 어떻게 하나', html: ECHO },
      async (prompt) => {
        calls += 1;
        if (calls >= 2) expect(prompt).toContain('반려됐습니다 — 이유:');
        return '<p>너무 짧게.</p>';   // 소제목이 사라짐 → 반려
      },
    );
    expect(out.revised).toBe(0);
    expect(out.html).toBe(ECHO);
    expect(calls).toBe(2);
    expect(out.notes.join('\n')).toContain('원본 유지');
  });

  test('본문이 아닌 답은 원본이 비어 있어도 받지 않는다', () => {
    const empty = { index: 0, heading: '(도입부)', html: '' };
    expect(acceptRevisedSection('음... 잘 모르겠습니다', empty, {}).reason).toBe('본문 HTML 이 아닙니다');
    expect(acceptRevisedSection('<p>제목의 질문에 답하면, 됩니다.</p>', empty, {}).accepted).toBe(true);
  });

  test('⭐ 장부에 반려 사유가 남는다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('notes: outcome.notes.slice(0, 6)');
    expect(orch).toContain('preflightNotes: pre.notes.map(String).slice(0, 6)');
    expect(read('src/core/final/publish-ledger.ts')).toContain('preflightNotes?: string[];');
    const fix = read('src/core/final/pre-publish-fix.ts');
    expect(fix).toContain("require('./editor-draft')");
    expect(fix).toContain('verify: false');
    expect(blockBetween(fix, "export async function fixBeforePublish(", "// eslint-disable-next-line")).not.toContain("judgeImproved(");   // 글 전체용 200자 하한을 구간에 걸던 버그
  });
});

describe('② 초안 감사 — 보강 호출에 문장째 인용한 목록을 싣는다 (호출 0회)', () => {
  const draft = {
    introduction: '<p>도입부입니다. 보증금을 돌려받지 못한 세입자가 무엇을 먼저 해야 하는지 정리합니다.</p>',
    sections: [
      { h2: '임차권등기명령 신청', h3Sections: [{ h3: '신청 방법', content: '<p>임차권등기명령은 이사를 가도 대항력과 우선변제권이 유지되는 제도입니다. 신청은 주택 소재지 지방법원에 합니다. 등기가 완료된 뒤에 이사해야 안전합니다.</p>' }] },
      { h2: '보증금 반환 소송', h3Sections: [{ h3: '소송 절차', content: '<p>임차권등기명령은 이사를 가도 대항력과 우선변제권이 유지되는 제도입니다. 소송은 지급명령으로 시작할 수 있습니다.</p>' }] },
    ],
    conclusion: '<p>정리하면 등기부터 하고 소송으로 갑니다.</p>',
  };

  test('⭐ 초안 JSON 을 발행본 뼈대로 펴서 같은 하네스로 잰다', () => {
    const html = draftToHtml(draft);
    expect(html).toContain('<h2>임차권등기명령 신청</h2>');
    expect(html).toContain('<h3>신청 방법</h3>');
    expect(html).toContain('<div class="conclusion">');
    expect(html).not.toContain('<h2>마무리</h2>');
    const audit = auditDraft(draft);
    expect(audit.findings.some((f) => f.kind === 'cross-section-echo')).toBe(true);
    expect(audit.findings.every((f) => DRAFT_FIX_KINDS.has(f.kind))).toBe(true);
    expect(DRAFT_FIX_KINDS.has('no-legal-basis')).toBe(false);   // 조문을 지어내게 하지 않는다
  });

  test('⭐ 고칠 목록은 근거 문장을 그대로 인용한다', () => {
    const audit = auditDraft(draft);
    const block = buildDraftFixBlock(audit.findings);
    expect(block).toContain('[코드 감사 — 반드시 고칠 목록]');
    expect(block).toContain('[구간 반복]');
    expect(block).toContain('임차권등기명령은 이사를 가도');
    expect(block).toContain('고칠 방향:');
    expect(buildDraftFixBlock([])).toBe('');
    expect(describeDraftFindings(audit.findings)).toContain('구간 반복');
  });

  test('보강 뒤 결함이 늘면 폐기 신호를 낸다', () => {
    const before = auditDraft(draft);
    const fixed = auditDraft({ ...draft, sections: [draft.sections[0]!, { h2: '보증금 반환 소송', h3Sections: [{ h3: '소송 절차', content: '<p>소송은 지급명령으로 시작할 수 있습니다. 판결 뒤 강제집행으로 넘어갑니다.</p>' }] }] });
    expect(compareDraftAudits(before, fixed).worse).toBe(false);
    expect(fixed.findings.length).toBeLessThan(before.findings.length);
    expect(compareDraftAudits(fixed, before).worse).toBe(true);
  });

  test('⭐ 배선 — 감사 결함이 보강을 부르고, 목록이 프롬프트에 들어가고, 뒤에 다시 재서 장부에 남긴다', () => {
    const gen = read('src/core/final/generation.ts');
    const block = blockBetween(gen, "const { auditDraft, buildDraftFixBlock, compareDraftAudits, describeDraftFindings } = require('./draft-audit')", 'v3.8.429 — 본문이 빈 채로 조용히 나가지 않게 한다.');
    expect(block).toContain('if (!skipBoost && (lowQuality || threadBefore.length > 0 || draftAudit.findings.length > 0)) {');
    expect(block).toContain('${buildDraftFixBlock(draftAudit.findings)}');
    expect(block).toContain('const audited = auditDraft(candidate, { question: thread?.question })');
    expect(block).toContain('if (compared.worse) reasons.push(compared.summary)');
    expect(block).toContain("(globalThis as any).__lastDraftAudit = { before: draftAudit.findings.length, after: audited.findings.length }");
    // 감사 결함만으로 부른 보강을 "실 위반 그대로(0)" 로 반려하지 않는다
    expect(block).toContain('threadBefore.length > 0 && threadAfter.length >= threadBefore.length');
    expect(read('src/core/final/orchestration.ts')).toContain('draftAuditBefore: Number((globalThis as any).__lastDraftAudit.before) || 0');
  });
});

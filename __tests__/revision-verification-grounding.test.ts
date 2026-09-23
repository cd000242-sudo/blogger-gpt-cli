import { buildVerificationPrompt, verifySelectedIssues } from '../src/core/final/revision-verification';
import { reviseByRequest } from '../src/core/final/manual-revision';
import type { CritiqueIssue } from '../src/core/final/post-critique';

const issue: CritiqueIssue = {
  id: 'user-request-1', area: 'style', severity: 'high', title: '작성자가 직접 요청한 수정',
  detail: '마지막 문장의 날짜를 고쳐 주세요.', evidence: '', fix: '', sectionIndex: -1, origin: 'ai',
};
const verify = (answer: any, before = '<p>변하지 않은 설명입니다.</p><p>접수는 9월 20일입니다.</p>', after = '<p>변하지 않은 설명입니다.</p><p>접수는 9월 25일입니다.</p>') => verifySelectedIssues({
  title: '글', changes: [{ heading: '본문', before, after }], issues: [issue],
  callModel: async () => JSON.stringify(answer),
});

describe('수정 검수는 전체 요청과 실제 변경 근거를 확인한다', () => {
  test('긴 요청의 마지막 조건과 2,500자 뒤의 본문도 검수에 전달한다', () => {
    const detail = '앞의 조건은 그대로 유지하세요. '.repeat(30) + '마지막 표 색상도 바꿔 주세요.';
    const before = '공통 본문 '.repeat(600) + '접수는 9월 20일입니다.';
    const after = '공통 본문 '.repeat(600) + '접수는 9월 25일입니다.';
    const prompt = buildVerificationPrompt({ title: '글', changes: [{ heading: '끝', before, after }], issues: [{ ...issue, detail, fix: detail, evidence: before }] });
    expect(prompt).toContain(detail);
    expect(prompt).toContain(before);
    expect(prompt).toContain(after);
  });

  test.each([
    { evidence: '요청한 부분을 전부 수정했습니다.' },
    { evidence: '접수는 9월 30일입니다.' },
    { evidence: '변하지 않은 설명입니다.' },
    { evidence: { explanation: '수정함' } },
  ])('resolved:true여도 존재하지 않거나 바뀌지 않은 근거는 해결로 인정하지 않는다: %j', async (fields) => {
    expect(await verify([{ id: issue.id, resolved: true, ...fields }])).toEqual([]);
  });

  test('새 문장을 실제 원문에서 확인한 경우만 인정한다', async () => {
    expect(await verify([{ id: issue.id, resolved: true, evidence: '접수는 9월 25일입니다.' }])).toEqual([issue.id]);
  });

  test('삭제 수정은 실제로 없어진 이전 원문을 검증한다', async () => {
    const before = '<p>유지할 문장입니다.</p><p>삭제해야 하는 반복 문장입니다.</p>';
    const after = '<p>유지할 문장입니다.</p>';
    const answer = [{ id: issue.id, resolved: true, evidence: '', beforeEvidence: '삭제해야 하는 반복 문장입니다.' }];
    expect(await verify(answer, before, after)).toEqual([issue.id]);
    expect(await verify(answer, before, `${before}<p>추가했습니다.</p>`)).toEqual([]);
  });

  test('중복 판정이나 검수 실패는 미해결로 남긴다', async () => {
    const answer = { id: issue.id, resolved: true, evidence: '접수는 9월 25일입니다.' };
    expect(await verify([answer, answer])).toEqual([]);
  });

  test('CSS만 바뀌어도 자동 성공 처리하지 않고 실제 HTML로 검수한다', async () => {
    const html = '<style>.box{color:red}</style><p class="box">같은 본문입니다.</p>';
    const changed = html.replace('color:red', 'color:blue');
    const prompts: string[] = [];
    const result = await reviseByRequest({
      title: '글', html, issues: [{ ...issue, detail: '색상을 초록색으로 바꿔 주세요.' }],
      callModel: async (prompt) => {
        prompts.push(prompt);
        return prompt.includes('검수자') ? JSON.stringify([{ id: issue.id, resolved: false, evidence: '' }]) : changed;
      },
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain(changed);
    expect(result.actuallyFixed).toEqual([]);
    expect(result.stillPresent).toEqual([issue.title]);
  });

  test('본문 글자가 같아도 요청한 HTML 속성 변경은 검수 후 해결된다', async () => {
    const html = '<p style="color:red">같은 본문입니다.</p>';
    const changed = html.replace('color:red', 'color:blue');
    const result = await reviseByRequest({
      title: '글', html, issues: [{ ...issue, detail: '색상을 파란색으로 바꿔 주세요.' }],
      callModel: async (prompt) => prompt.includes('검수자')
        ? JSON.stringify([{ id: issue.id, resolved: true, evidence: '<p style="color:blue">같은 본문입니다.</p>' }]) : changed,
    });
    expect(result.actuallyFixed).toEqual([issue.title]);
  });

  test('긴 본문 끝에 새 H2를 추가한 경우도 누락하지 않는다', async () => {
    const html = `<h2>첫 절</h2><p>${'기존 본문을 유지합니다. '.repeat(250)}</p>`;
    const changed = html + '<h2>마지막 안내</h2><p>접수 마감일은 9월 25일입니다.</p>';
    let calls = 0;
    const result = await reviseByRequest({
      title: '글', html, issues: [{ ...issue, detail: '마지막 안내 구간을 추가하세요.' }],
      callModel: async (prompt) => {
        calls++;
        if (!prompt.includes('검수자')) return changed;
        expect(prompt).toContain(changed);
        return JSON.stringify([{ id: issue.id, resolved: true, evidence: '접수 마감일은 9월 25일입니다.' }]);
      },
    });
    expect(calls).toBe(2);
    expect(result.actuallyFixed).toEqual([issue.title]);
  });

  test('검수를 끄면 비용 없이 미해결로 남긴다', async () => {
    let calls = 0;
    const html = '<p>원래 본문입니다.</p>';
    const result = await reviseByRequest({ title: '글', html, issues: [issue], verify: false,
      callModel: async () => { calls++; return '<p>고친 본문입니다.</p>'; },
    });
    expect(calls).toBe(1);
    expect(result.actuallyFixed).toEqual([]);
  });
});

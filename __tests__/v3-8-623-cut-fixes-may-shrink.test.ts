/**
 * v3.8.623 — 빼는 수정은 짧아져도 된다.
 *
 * 사장님: "1번 분량 규칙 완화 다음 릴리스로 가자"
 *
 * 되풀이·얼버무림·상투구를 고치라면서 "분량을 줄이지 마세요"를 같이 걸어 두면
 * 모델은 뺀 자리를 새 문장으로 메운다. 그 새 문장이 다음 비평에서 또 잡혔다.
 * 빼는 게 목적인 수정은 짧아지는 게 정상이다. 단 바닥은 둔다 — 60% 아래면 통째 삭제다.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isCuttingIssue,
  buildSectionRevisionPrompt,
  acceptRevisedSection,
  judgeImproved,
  type CritiqueIssue,
  type PostSection,
} from '../src/core/final/post-critique';

const issue = (over: Partial<CritiqueIssue>): CritiqueIssue => ({
  id: 'ai-0',
  area: 'structure',
  severity: 'medium',
  title: '제목',
  detail: '',
  evidence: '',
  fix: '',
  sectionIndex: 1,
  origin: 'ai',
  ...over,
});

const para = (n: number, seed = '문장'): string =>
  Array.from({ length: n }, (_, i) => `<p>${seed} ${i + 1} 은 보험금 청구 서류를 제출한 뒤 보름 안에 결과가 나온다는 이야기다.</p>`).join('');

const section: PostSection = { index: 2, heading: '청구 절차', html: `<h2>청구 절차</h2>${para(10)}` };

describe('① 어떤 지적이 "빼는 수정"인가', () => {
  it('코드 진단 — 되풀이·얼버무림·상투구는 빼는 수정', () => {
    expect(isCuttingIssue(issue({ id: 'redundancy-repeat' }))).toBe(true);
    expect(isCuttingIssue(issue({ id: 'substance-vague' }))).toBe(true);
    expect(isCuttingIssue(issue({ id: 'substance-cliche' }))).toBe(true);
  });

  it('코드 진단 — 사실 부족·답 없음·CTA 없음은 채우는 수정', () => {
    expect(isCuttingIssue(issue({ id: 'substance-facts', fix: '모르는 수치는 그 문장을 삭제합니다' }))).toBe(false);
    expect(isCuttingIssue(issue({ id: 'answer-missing' }))).toBe(false);
    expect(isCuttingIssue(issue({ id: 'cta-none' }))).toBe(false);
  });

  it('AI 지적 — 제목이나 고칠 방향에 되풀이·군더더기·장황이 있으면 빼는 수정', () => {
    expect(isCuttingIssue(issue({ title: '같은 설명이 세 구간에서 반복됩니다' }))).toBe(true);
    expect(isCuttingIssue(issue({ title: '도입부가 장황합니다', fix: '군더더기를 빼세요' }))).toBe(true);
    expect(isCuttingIssue(issue({ title: '신청 기한이 본문에 없습니다', fix: '기한을 적으세요' }))).toBe(false);
  });
});

describe('② 프롬프트 — 빼는 수정이면 "줄이지 마세요"를 걸지 않는다', () => {
  it('채우는 수정: 기존 규칙 그대로', () => {
    const prompt = buildSectionRevisionPrompt({
      title: 't', section, issues: [issue({ id: 'substance-facts' })], wholePostIssues: [],
    });
    expect(prompt).toContain('분량을 줄이지 마세요');
    expect(prompt).not.toContain('빼는 것');
  });

  it('빼는 수정: 짧아져도 된다 · 빈자리를 메우지 말라 · 바닥은 60%', () => {
    const prompt = buildSectionRevisionPrompt({
      title: 't', section, issues: [issue({ id: 'redundancy-repeat' })], wholePostIssues: [],
    });
    expect(prompt).not.toContain('분량을 줄이지 마세요');
    expect(prompt).toContain('빼는 것');
    expect(prompt).toContain('메우지 마세요');
    expect(prompt).toContain('60%');
  });

  it('글 전체 지적이 빼는 수정이어도 같은 규칙', () => {
    const prompt = buildSectionRevisionPrompt({
      title: 't', section, issues: [], wholePostIssues: [issue({ title: '같은 말이 반복됩니다', sectionIndex: -1 })],
    });
    expect(prompt).toContain('빼는 것');
  });
});

describe('③ 구간 받아들이기 — 바닥이 두 개', () => {
  const shorter = (ratio: number): string => `<h2>청구 절차</h2>${para(Math.round(10 * ratio))}`;

  it('채우는 수정은 여전히 90% 아래면 거절', () => {
    expect(acceptRevisedSection(shorter(0.7), section).accepted).toBe(false);
    expect(acceptRevisedSection(shorter(0.7), section, { cutting: false }).accepted).toBe(false);
  });

  it('빼는 수정은 70% 로 줄어도 받아들인다', () => {
    const v = acceptRevisedSection(shorter(0.7), section, { cutting: true });
    expect(v.accepted).toBe(true);
    expect(v.html).toBe(shorter(0.7));
  });

  it('빼는 수정이라도 60% 아래면 거절 — 통째 삭제는 수정이 아니다', () => {
    const v = acceptRevisedSection(shorter(0.4), section, { cutting: true });
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain('60%');
  });

  it('빼는 수정이라도 이미지·링크·H2 규칙은 그대로', () => {
    const withImg: PostSection = { ...section, html: `<h2>청구 절차</h2><img src="a.jpg" alt="">${para(10)}` };
    expect(acceptRevisedSection(shorter(0.8), withImg, { cutting: true }).reason).toContain('이미지');
  });
});

describe('④ 글 전체 관문', () => {
  const post = (n: number): string => `<p>도입</p><h2>a</h2>${para(n, '가')}<h2>b</h2>${para(n, '나')}`;

  it('채우는 수정: 10% 넘게 짧으면 거절', () => {
    expect(judgeImproved(post(8), post(10)).ok).toBe(false);
  });

  it('빼는 수정: 20% 짧아도 통과, 25% 넘게 짧으면 거절', () => {
    expect(judgeImproved(post(8), post(10), { cutting: true }).ok).toBe(true);
    expect(judgeImproved(post(7), post(10), { cutting: true }).ok).toBe(false);
  });
});

describe('⑤ 배선 — main.ts 가 실제로 이 스위치를 넘긴다', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');
  const handler = main.slice(main.indexOf("ipcMain.handle('apply-post-improvement'"));

  it('구간 판정과 전체 관문 둘 다 cutting 을 받는다', () => {
    expect(handler).toMatch(/acceptRevisedSection\(raw, section, \{ cutting/);
    expect(handler).toMatch(/judgeImproved\(nextHtml, previousHtml, \{\s*cutting/);
    expect(handler).toContain('isCuttingIssue');
  });
});

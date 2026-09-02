/**
 * v3.8.624 — 코드 진단이 깨끗하면 AI 비평을 부르지 않는다.
 *
 * 사장님: "비평개선은 api키로 사용되는거니?" → "잡고 릴리즈까지 진행"
 *
 * 모듈 머리말은 v3.8.619 부터 "코드 진단이 깨끗하면 AI 비평 호출도 의미가 없다"고 적어 뒀는데
 * 실제 코드는 늘 한 번 불렀다. 억지로 찾게 하면 지어낸 지적이 나오고 키 비용만 든다.
 * 이제 진단 0건이면 호출 0회로 "고칠 것 없음"을 낸다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { shouldCallAiCritique, summarizeCritique, type CritiqueIssue } from '../src/core/final/post-critique';

const issue = (over: Partial<CritiqueIssue> = {}): CritiqueIssue => ({
  id: 'substance-facts',
  area: 'substance',
  severity: 'high',
  title: '구체적인 사실이 부족합니다',
  detail: '',
  evidence: '',
  fix: '',
  sectionIndex: 1,
  origin: 'code',
  ...over,
});

describe('① 부를지 말지', () => {
  it('코드 진단 0건 → 부르지 않는다, 이유에 "호출 0회"', () => {
    const d = shouldCallAiCritique([]);
    expect(d.call).toBe(false);
    expect(d.reason).toContain('0회');
  });

  it('코드 진단이 하나라도 있으면 부른다', () => {
    expect(shouldCallAiCritique([issue()]).call).toBe(true);
    expect(shouldCallAiCritique([issue({ id: 'redundancy-repeat', severity: 'low' })]).call).toBe(true);
  });

  it('배열이 아니어도 죽지 않는다', () => {
    expect(shouldCallAiCritique(undefined as any).call).toBe(false);
  });
});

describe('② 요약 문구 — 안 불렀으면 "모두 통과"라고 거짓말하지 않는다', () => {
  it('기존: 둘 다 통과', () => {
    expect(summarizeCritique([])).toContain('코드 진단·비평 모두');
  });

  it('AI 를 건너뛴 경우: 진단 0건 · 호출 0회', () => {
    const text = summarizeCritique([], { aiSkipped: true });
    expect(text).toContain('0건');
    expect(text).toContain('0회');
    expect(text).not.toContain('비평 모두');
  });

  it('지적이 있으면 옵션과 무관하게 건수 요약', () => {
    expect(summarizeCritique([issue()], { aiSkipped: true })).toContain('총 1건');
  });
});

describe('③ 배선 — main.ts 와 모달이 실제로 스위치를 쓴다', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'electron', 'main.ts'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'electron', 'ui', 'modules', 'post-critique-modal.js'), 'utf8');

  it('critique-published-post 가 shouldCallAiCritique 로 갈라서 aiSkipped 를 돌려준다', () => {
    const start = main.indexOf("ipcMain.handle('critique-published-post'");
    const end = main.indexOf("ipcMain.handle('apply-post-improvement'");
    const handler = main.slice(start, end);
    expect(handler).toContain('critique.shouldCallAiCritique(codeIssues)');
    expect(handler).toMatch(/aiSkipped:/);
    expect(handler).toMatch(/summarizeCritique\(issues, \{ aiSkipped/);
    // 부르지 않기로 했으면 callGeminiWithRetry 로 가지 않는다
    expect(handler).toMatch(/if \(!decision\.call\)/);
  });

  it('모달은 aiSkipped 일 때 "AI 비평은 부르지 않았습니다"를 보여준다', () => {
    expect(modal).toContain('critique?.aiSkipped');
    expect(modal).toContain('AI 비평은 부르지 않았습니다');
  });
});

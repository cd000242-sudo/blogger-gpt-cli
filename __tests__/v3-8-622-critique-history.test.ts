/**
 * v3.8.622 — 비평은 지난 회차를 기억하고, 개선 결과는 모달에 남는다.
 *
 * 사장님 신고: "체크하고 글 수정발행 다시 했는데 다시 비평개선 누르면 새로운 게 자꾸 생기거든.
 *               분명 비평한 대로 수정개선한 건데"
 * → 원인 넷을 각각 못 박는다.
 *   ① AI 지적 id 가 순번(`ai-0`)이라 회차가 바뀌면 같은 문제가 다른 항목이 됐다
 *   ② 이력이 없어 "이미 고친 것"을 AI 에게 알려줄 수 없었다
 *   ③ 화면에 "왜 지금 나왔는지"가 없었다
 *   ④ 개선 결과가 모달에 안 남아 다음 비평과 이어지지 않았다
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  stableIssueId,
  loadHistoryFile,
  saveHistoryFile,
  historyOf,
  recordRaised,
  recordApplied,
  provenanceOf,
  annotateIssues,
  resolvedTitles,
  similarTitles,
} from '../src/core/final/critique-history';
import { buildCritiquePrompt } from '../src/core/final/post-critique';

const issue = (over: any = {}) => ({
  id: 'ai-0',
  area: 'structure',
  severity: 'medium',
  title: '신청 기한이 본문 어디에도 없습니다',
  detail: '',
  evidence: '자세한 내용은 공식 홈페이지에서 확인하세요.',
  fix: '',
  sectionIndex: 2,
  origin: 'ai',
  ...over,
});

describe('① 이름표 — 회차가 달라도 같은 문제면 같은 값', () => {
  it('AI 지적의 순번 id 는 쓰지 않는다', () => {
    const first = stableIssueId(issue({ id: 'ai-0' }));
    const second = stableIssueId(issue({ id: 'ai-4' }));
    expect(first).toBe(second);
    expect(first).toMatch(/^ai:[0-9a-f]{10}$/);
  });

  it('코드 진단의 고정 id 는 그대로 쓴다', () => {
    expect(stableIssueId({ id: 'substance-facts', title: '구체적인 사실이 부족합니다' })).toBe('substance-facts');
    expect(stableIssueId({ id: 'quality-length', title: '분량 미달' })).toBe('quality-length');
  });

  it('제목이 다르면 다른 지적이다', () => {
    expect(stableIssueId(issue())).not.toBe(stableIssueId(issue({ title: '표가 없습니다' })));
  });

  it('근거 문장의 공백·대소문자 차이로는 갈라지지 않는다', () => {
    const a = stableIssueId(issue({ evidence: '자세한 내용은  공식 홈페이지에서 확인하세요.' }));
    const b = stableIssueId(issue({ evidence: '자세한 내용은 공식 홈페이지에서 확인하세요.' }));
    expect(a).toBe(b);
  });
});

describe('② 이력 저장 — 깨져 있으면 없는 것으로 친다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-history-'));
  const file = path.join(dir, 'nested', 'critique-history.json');

  it('없는 파일은 빈 이력', () => {
    expect(loadHistoryFile(path.join(dir, 'nope.json'))).toEqual({});
  });

  it('깨진 JSON 도 던지지 않는다', () => {
    const broken = path.join(dir, 'broken.json');
    fs.writeFileSync(broken, '{{{ not json');
    expect(loadHistoryFile(broken)).toEqual({});
  });

  it('폴더가 없어도 만들어 저장하고 다시 읽힌다', () => {
    const saved = saveHistoryFile(file, { p1: { postId: 'p1', rounds: [] } });
    expect(saved).toBe(true);
    expect(historyOf(loadHistoryFile(file), 'p1').rounds).toEqual([]);
  });

  it('회차를 기록하면 이름표와 제목이 남는다', () => {
    const next = recordRaised({}, 'p9', { score: 55, issues: [issue()], at: '2026-09-01T00:00:00.000Z' });
    const round = historyOf(next, 'p9').rounds[0]!;
    expect(round.raised).toEqual([stableIssueId(issue())]);
    expect(round.applied).toEqual([]);
    expect(round.titles?.[stableIssueId(issue())]).toBe('신청 기한이 본문 어디에도 없습니다');
  });

  it('개선 결과는 새 회차가 아니라 최근 회차에 붙는다', () => {
    const raised = recordRaised({}, 'p9', { score: 55, issues: [issue()] });
    const applied = recordApplied(raised, 'p9', {
      issues: [issue()],
      revisedSections: [2],
      skipped: ['3. 신청 방법: 분량이 줄었습니다'],
    });
    const rounds = historyOf(applied, 'p9').rounds;
    expect(rounds).toHaveLength(1);
    expect(rounds[0]!.applied).toEqual([stableIssueId(issue())]);
    expect(rounds[0]!.revisedSections).toEqual([2]);
    expect(rounds[0]!.skipped).toHaveLength(1);
  });

  it('원본 이력을 바꾸지 않는다(불변)', () => {
    const before = recordRaised({}, 'p9', { score: 55, issues: [issue()] });
    const snapshot = JSON.stringify(before);
    recordApplied(before, 'p9', { issues: [issue()], revisedSections: [2], skipped: [] });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('③ 왜 지금 나왔는가', () => {
  it('첫 비평이면 "이 글의 첫 비평"', () => {
    const p = provenanceOf(issue(), { postId: 'p', rounds: [] });
    expect(p.status).toBe('new');
    expect(p.statusNote).toContain('첫 비평');
  });

  it('지난번에도 나왔는데 안 골랐으면 again', () => {
    const file = recordRaised({}, 'p', { score: 50, issues: [issue()] });
    const p = provenanceOf(issue(), historyOf(file, 'p'));
    expect(p.status).toBe('again');
    expect(p.seenCount).toBe(2);
    expect(p.statusNote).toContain('고르지 않으셨습니다');
  });

  it('고쳐서 발행했는데 또 나오면 regressed — 그 구간을 실제로 고쳤다고 말해준다', () => {
    const raised = recordRaised({}, 'p', { score: 50, issues: [issue()], at: '2026-08-20T00:00:00.000Z' });
    const file = recordApplied(raised, 'p', { issues: [issue()], revisedSections: [2], skipped: [] });
    const p = provenanceOf(issue(), historyOf(file, 'p'));
    expect(p.status).toBe('regressed');
    expect(p.statusNote).toContain('8월 20일');
    expect(p.statusNote).toContain('또 잡혔습니다');
  });

  it('골랐지만 그 구간이 규칙에 걸려 안 고쳐졌으면 그렇게 말해준다', () => {
    const raised = recordRaised({}, 'p', { score: 50, issues: [issue()] });
    const file = recordApplied(raised, 'p', {
      issues: [issue()],
      revisedSections: [],          // 이 구간은 버려졌다
      skipped: ['2. 대상: 분량이 줄었습니다'],
    });
    const p = provenanceOf(issue(), historyOf(file, 'p'));
    expect(p.status).toBe('regressed');
    expect(p.statusNote).toContain('원본 그대로');
  });

  it('직전 개선으로 다시 쓴 구간에서 처음 나온 지적은 side-effect', () => {
    const raised = recordRaised({}, 'p', { score: 50, issues: [issue({ title: '다른 문제' })] });
    const file = recordApplied(raised, 'p', {
      issues: [issue({ title: '다른 문제' })],
      revisedSections: [2],
      skipped: [],
    });
    const p = provenanceOf(issue({ title: '되풀이가 많습니다', sectionIndex: 2 }), historyOf(file, 'p'));
    expect(p.status).toBe('side-effect');
    expect(p.statusNote).toContain('새로 생긴 지적');
  });

  it('손대지 않은 구간의 새 지적은 그냥 new', () => {
    const raised = recordRaised({}, 'p', { score: 50, issues: [issue()] });
    const file = recordApplied(raised, 'p', { issues: [issue()], revisedSections: [2], skipped: [] });
    const p = provenanceOf(issue({ title: '표가 없습니다', sectionIndex: 5 }), historyOf(file, 'p'));
    expect(p.status).toBe('new');
    expect(p.statusNote).toContain('처음 나온 지적');
  });

  /**
   * 사장님: "한번 수정하고 나면 다시 비평했을 때 새로운 게 안 나와야 정상 아니니"
   * AI 는 같은 지적을 매번 조금씩 다르게 쓴다. 이름표만 믿으면 고친 지적이 "새 지적"으로 둔갑한다.
   */
  it('고친 지적을 AI 가 말만 바꿔 다시 내면 새 지적이 아니라 "고쳤는데 또"', () => {
    const fixed = issue({ title: '신청 기한이 본문 어디에도 없습니다' });
    const raised = recordRaised({}, 'p', { score: 50, issues: [fixed], at: '2026-08-20T00:00:00.000Z' });
    const file = recordApplied(raised, 'p', { issues: [fixed], revisedSections: [2], skipped: [] });

    const reworded = issue({ title: '신청 기한 정보가 본문에 빠져 있습니다', evidence: '다른 근거 문장' });
    expect(stableIssueId(reworded)).not.toBe(stableIssueId(fixed));   // 이름표는 다르다

    const p = provenanceOf(reworded, historyOf(file, 'p'));
    expect(p.status).toBe('regressed');
    expect(p.statusNote).toContain('8월 20일');
    expect(p.statusNote).toContain('말만 다릅니다');
    expect(p.statusNote).toContain('신청 기한이 본문 어디에도 없습니다');
  });

  it('similarTitles — 조사가 붙어도 같은 낱말, 어디에나 나오는 말은 근거가 안 된다', () => {
    expect(similarTitles('신청 기한이 본문 어디에도 없습니다', '신청 마감 기한 정보가 본문에 빠져 있습니다')).toBe(true);
    // "본문·없습니다" 만 겹치는 건 같은 지적이 아니다
    expect(similarTitles('신청 기한이 본문에 없습니다', '비교 표가 본문에 없습니다')).toBe(false);
    // 한 낱말만 겹쳐도 아니다 — "신청 기한" 과 "신청 방법" 은 다른 문제
    expect(similarTitles('신청 기한이 없습니다', '신청 방법이 없습니다')).toBe(false);
    expect(similarTitles('', '아무거나')).toBe(false);
  });

  it('낱말이 안 겹치면 정말 새 지적이다', () => {
    const fixed = issue({ title: '신청 기한이 본문 어디에도 없습니다' });
    const raised = recordRaised({}, 'p', { score: 50, issues: [fixed] });
    const file = recordApplied(raised, 'p', { issues: [fixed], revisedSections: [2], skipped: [] });
    const other = issue({ title: '비교 표가 하나도 없습니다', sectionIndex: 4 });
    expect(provenanceOf(other, historyOf(file, 'p')).status).toBe('new');
  });

  it('annotateIssues 는 원본 필드를 지우지 않고 판정만 얹는다', () => {
    const [out] = annotateIssues([issue()], { postId: 'p', rounds: [] });
    expect(out.title).toBe('신청 기한이 본문 어디에도 없습니다');
    expect(out.sectionIndex).toBe(2);
    expect(out.status).toBe('new');
    expect(typeof out.statusNote).toBe('string');
    expect(out.statusNote.length).toBeGreaterThan(0);
  });
});

describe('④ 이미 고친 것은 AI 에게 알려준다', () => {
  it('resolvedTitles 는 고쳐서 발행한 지적의 제목만 돌려준다', () => {
    const raised = recordRaised({}, 'p', {
      score: 40,
      issues: [issue(), issue({ title: '표가 없습니다', evidence: '' })],
    });
    const file = recordApplied(raised, 'p', { issues: [issue()], revisedSections: [2], skipped: [] });
    expect(resolvedTitles(historyOf(file, 'p'))).toEqual(['신청 기한이 본문 어디에도 없습니다']);
  });

  it('고른 적이 없으면 빈 목록', () => {
    const file = recordRaised({}, 'p', { score: 40, issues: [issue()] });
    expect(resolvedTitles(historyOf(file, 'p'))).toEqual([]);
  });

  it('비평 프롬프트에 "이미 고친 것" 구간이 실린다', () => {
    const prompt = buildCritiquePrompt({
      title: '소상공인 무료 보험',
      html: '<h2>대상</h2><p>본문</p>',
      codeIssues: [],
      resolved: ['신청 기한이 본문 어디에도 없습니다'],
    });
    expect(prompt).toContain('# 지난 비평에서 지적하고 이미 고친 것');
    expect(prompt).toContain('· 신청 기한이 본문 어디에도 없습니다');
    expect(prompt).toContain('찾을 게 없으면');
  });

  it('고친 게 없으면 그 구간을 넣지 않는다 — 빈 목록으로 헷갈리게 하지 않는다', () => {
    const prompt = buildCritiquePrompt({
      title: '소상공인 무료 보험',
      html: '<h2>대상</h2><p>본문</p>',
      codeIssues: [],
    });
    expect(prompt).not.toContain('# 지난 비평에서 지적하고 이미 고친 것');
  });
});

/**
 * 배선 — 없는 함수·없는 필드를 부르면 기능이 조용히 죽는다(과거 5회 재발).
 * 화면과 메인 프로세스가 실제로 같은 이름을 쓰는지 파일에서 확인한다.
 */
describe('⑤ 배선', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('메인 프로세스가 이력을 읽고·판정하고·저장한다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain("require('../dist/core/final/critique-history')");
    expect(main).toContain('history.loadHistoryFile(critiqueHistoryPath())');
    expect(main).toContain('history.annotateIssues(rawIssues, postHistory)');
    expect(main).toContain('history.recordRaised(');
    expect(main).toContain('history.recordApplied(');
    expect(main).toContain('resolved: alreadyFixed');
  });

  it('개선 핸들러가 모달에 보여줄 상세를 돌려준다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('revisedDetail');
    expect(main).toContain('roundCount');
    expect(main).toContain('resolvedCount');
  });

  it('모달이 판정 배지와 결과 화면을 그린다', () => {
    const modal = read('electron/ui/modules/post-critique-modal.js');
    expect(modal).toContain('issue.statusNote');
    expect(modal).toContain('STATUS[issue.status]');
    expect(modal).toContain('function resultView');
    expect(modal).toContain('res.revisedDetail');
    // 결과를 그리려면 모달이 닫히면 안 된다
    expect(modal).toContain("overlay.querySelector('#pcFooter')");
    expect(modal).toContain('pcAgain');
  });

  it('판정 4종에 모두 화면 라벨이 있다', () => {
    const modal = read('electron/ui/modules/post-critique-modal.js');
    for (const key of ['new', 'again', 'regressed', 'side-effect']) {
      expect(modal).toMatch(new RegExp(`['"]?${key}['"]?\\s*:\\s*\\{`));
    }
  });

  it('글목록이 개선 결과를 모달에 돌려주고 재비평을 연결한다', () => {
    const ui = read('electron/ui/modules/published-posts.js');
    expect(ui).toContain('return res;');
    expect(ui).toContain('() => critiquePostAt(index)');
  });
});

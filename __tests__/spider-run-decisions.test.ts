/**
 * 거미줄 종합글 — 실행 결과 판단 (중지·시간 초과 · 길이 재시도 · 직전 초안 보존 · 제목 후보 · 끝 잘림 · 화면 설정 읽기)
 *
 * 전부 순수 함수를 실제로 돌려 확인한다. 문자열 단언은 spider-handler-wiring.test.ts 가 맡는다.
 * 실제 LLM·Agent·앱·네트워크는 부르지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { braceBlock } from './helpers/source-block';
import {
  judgeSpiderAgentRun,
  shouldRetrySpiderGeneration,
  chooseSpiderDraft,
  runSpiderDraftLoop,
  judgeSpiderCompleteness,
  resolveSpiderTitle,
  buildSpiderFailure,
  SPIDER_GENERIC_TITLE_KEYS,
} from '../src/core/spider';

const UI = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/internal-links.js'), 'utf8');
const LONG_HTML = `<div class="sw-cornerstone"><h2>하나</h2><p>${'가나다 '.repeat(200)}</p></div>`;
const ctx = { providerLabel: 'Claude Code', timeoutMinutes: 25 };

describe('judgeSpiderAgentRun — 중지·시간 초과로 끊긴 글은 길어도 실패', () => {
  it('사용자가 중지했으면 article.html 이 길어도 실패다', () => {
    const r = judgeSpiderAgentRun({ canceled: true }, LONG_HTML.repeat(3), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('canceled'); expect(r.error).toContain('중지'); expect(r.error).toContain('Claude Code'); }
  });
  it('시간 초과도 길이와 무관하게 실패이고 제한 시간(분)을 알려 준다', () => {
    const r = judgeSpiderAgentRun({ timedOut: true }, LONG_HTML.repeat(3), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('timedOut'); expect(r.error).toContain('25분'); expect(r.error).toContain('끝까지 써지지 않았습니다'); }
  });
  it('중지가 시간 초과보다 먼저 보고된다', () => {
    const r = judgeSpiderAgentRun({ canceled: true, timedOut: true }, LONG_HTML, ctx);
    expect(!r.ok && r.reason).toBe('canceled');
  });
  it('정상 종료 + 500자 이상이면 통과, 짧으면 실패', () => {
    expect(judgeSpiderAgentRun({}, LONG_HTML, ctx).ok).toBe(true);
    const short = judgeSpiderAgentRun({}, '짧음', ctx);
    expect(!short.ok && short.reason).toBe('short');
  });
  it('실패 응답에는 "발행하지 않았습니다" 가 들어간다', () => {
    const r = judgeSpiderAgentRun({ timedOut: true }, LONG_HTML, ctx);
    const f = buildSpiderFailure({ stage: 'generate', cause: !r.ok ? r.error : '', mode: 'agent', providerLabel: 'Claude Code' });
    expect(f.error).toContain('발행하지 않았습니다');
  });
});

describe('shouldRetrySpiderGeneration / runSpiderDraftLoop', () => {
  const SHORT = '<h2>a</h2><p>짧은 글</p>';
  it('Agent 모드는 길이 때문에 다시 돌리지 않는다 — 경고만 남기고 그 초안으로 간다', async () => {
    expect(shouldRetrySpiderGeneration({ mode: 'agent', plainLen: 10, h2Count: 0, retriesDone: 0 })).toBe(false);
    const regenerate = jest.fn();
    const r = await runSpiderDraftLoop({ mode: 'agent', first: SHORT, regenerate, log: () => {} });
    expect(regenerate).not.toHaveBeenCalled();
    expect(r.draft).toBe(SHORT);
    expect(r.retries).toBe(0);
    expect(r.warnings.join(' ')).toContain('짧습니다');
  });
  it('API 모드는 기존대로 평문 3000자 미만 또는 H2 3개 미만이면 최대 2회 다시 부른다', async () => {
    expect(shouldRetrySpiderGeneration({ mode: 'api', plainLen: 2999, h2Count: 5, retriesDone: 0 })).toBe(true);
    expect(shouldRetrySpiderGeneration({ mode: 'api', plainLen: 5000, h2Count: 2, retriesDone: 1 })).toBe(true);
    expect(shouldRetrySpiderGeneration({ mode: 'api', plainLen: 100, h2Count: 0, retriesDone: 2 })).toBe(false);
    expect(shouldRetrySpiderGeneration({ mode: 'api', plainLen: 5000, h2Count: 3, retriesDone: 0 })).toBe(false);
    const regenerate = jest.fn().mockResolvedValueOnce(SHORT + 'x').mockResolvedValueOnce(SHORT + 'y');
    const r = await runSpiderDraftLoop({ mode: 'api', first: SHORT, regenerate, log: () => {} });
    expect(regenerate).toHaveBeenCalledTimes(2);
    expect(regenerate.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(r.draft).toBe(SHORT + 'y'); // 기존 동작: 재시도 결과가 이어받는다
  });
  it('재시도가 충분한 글을 돌려주면 그것을 쓰고 더 부르지 않는다', async () => {
    const good = `<h2>1</h2><h2>2</h2><h2>3</h2><p>${'가'.repeat(3200)}</p>`;
    const regenerate = jest.fn().mockResolvedValue(good);
    const r = await runSpiderDraftLoop({ mode: 'api', first: SHORT, regenerate, log: () => {} });
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(r.draft).toBe(good);
    expect(r.warnings).toEqual([]);
  });
  it('재시도가 실패(예외)하면 직전의 정상 초안으로 진행한다 — 던지지 않는다', async () => {
    const first = `<h2>1</h2><h2>2</h2><p>${'가'.repeat(1500)}</p>`;
    const regenerate = jest.fn().mockRejectedValue(new Error('429 quota key=AIzaSyD-FAKEKEYFORTESTONLY1234567890abcd'));
    const logs: string[] = [];
    const r = await runSpiderDraftLoop({ mode: 'api', first, regenerate, log: (m) => logs.push(m) });
    expect(r.draft).toBe(first);
    expect(regenerate).toHaveBeenCalledTimes(1); // 같은 실패를 되풀이하지 않는다
    expect(r.warnings.join(' ')).toContain('직전 초안');
    expect(logs.join('\n')).not.toContain('AIzaSyD');
  });
  it('재시도가 빈 글을 돌려줘도 직전 초안을 버리지 않는다', () => {
    const prev = `<p>${'가'.repeat(900)}</p>`;
    expect(chooseSpiderDraft(prev, '')).toEqual({ draft: prev, kept: true });
    expect(chooseSpiderDraft(prev, null)).toEqual({ draft: prev, kept: true });
    expect(chooseSpiderDraft(prev, '<style>.a{}</style>')).toEqual({ draft: prev, kept: true });
    const next = `<p>${'나'.repeat(900)}</p>`;
    expect(chooseSpiderDraft(prev, next)).toEqual({ draft: next, kept: false });
  });
});

describe('resolveSpiderTitle — 후보 배열에서 쓸 수 있는 첫 값', () => {
  it("H1 이 일반어이거나 비어 있고 메타 제목이 정상이면 메타 제목을 쓴다", () => {
    expect(resolveSpiderTitle({ userTitle: '', aiTitles: ['종합 가이드', '청년 지원금 한눈에 정리'] })).toEqual({ ok: true, title: '청년 지원금 한눈에 정리', source: 'ai' });
    expect(resolveSpiderTitle({ userTitle: '', aiTitles: ['', '메타 제목'] })).toEqual({ ok: true, title: '메타 제목', source: 'ai' });
  });
  it('H1 이 정상이면 H1 이 먼저, 사용자 제목은 언제나 최우선', () => {
    expect(resolveSpiderTitle({ aiTitles: ['H1 제목', '메타 제목'] })).toMatchObject({ title: 'H1 제목' });
    expect(resolveSpiderTitle({ userTitle: '내 제목', aiTitles: ['H1 제목'] })).toMatchObject({ title: '내 제목', source: 'user' });
  });
  it('후보가 전부 비었거나 일반어면 멈춘다', () => {
    expect(resolveSpiderTitle({ userTitle: '', aiTitles: ['', '거미줄치기 통합글', undefined] }).ok).toBe(false);
  });
});

describe('judgeSpiderCompleteness — 구조 신호만 실패(hard), 오탐 쉬운 신호는 경고(soft)', () => {
  const ok = `<div class="sw-cornerstone"><h2>1</h2><ul><li>가</li></ul><p>끝맺음입니다.</p></div>`;
  it('닫힌 정상 글은 신호가 없다', () => {
    expect(judgeSpiderCompleteness(ok)).toEqual({ hard: [], soft: [] });
  });
  it('목록이 열린 채 끝나면 hard', () => {
    expect(judgeSpiderCompleteness('<div><h2>1</h2><ul><li>가</li><li>나').hard.length).toBeGreaterThan(0);
  });
  it('표가 닫히지 않으면 hard', () => {
    expect(judgeSpiderCompleteness('<div><table><tr><td>a</td></tr></div>').hard.join(' ')).toContain('table');
  });
  it('태그 한가운데서 끊기면 hard', () => {
    expect(judgeSpiderCompleteness(`${ok}<a href="https://exa`).hard.length).toBeGreaterThan(0);
  });
  it('여는 div 가 3개 넘게 안 닫히면 hard, 1개 부족은 hard 가 아니다', () => {
    expect(judgeSpiderCompleteness('<div><div><div><div><p>가.</p>').hard.length).toBeGreaterThan(0);
    expect(judgeSpiderCompleteness('<div><div><p>가나다.</p></div>').hard).toEqual([]);
  });
  it('</section> 처럼 목록 밖 태그로 끝나는 글은 실패가 아니라 경고만이다 (오탐 가능성이 큼)', () => {
    const r = judgeSpiderCompleteness('<section><h2>1</h2><p>끝맺음입니다.</p></section>');
    expect(r.hard).toEqual([]);
    expect(r.soft.length).toBeGreaterThan(0);
  });
  it('문장부호 없이 한글로 끝나면 경고만', () => {
    const r = judgeSpiderCompleteness('<div><p>마지막 문장이 끝나지 않았습니다</p></div>');
    expect(r.hard).toEqual([]);
    expect(r.soft.length).toBeGreaterThan(0);
  });
});

describe('failure — 403 이 든 모든 오류를 Gemini 키 안내로 덮지 않는다', () => {
  it('이미지 단계의 403 은 Gemini 키 안내가 아니다', () => {
    const f = buildSpiderFailure({ stage: 'image', cause: new Error('403 Forbidden from image host'), mode: 'api' });
    expect(f.error).not.toContain('Gemini API 키');
  });
  it('숫자 안에 든 403(14039)은 인증 오류로 보지 않는다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: new Error('item 14039 failed'), mode: 'api' });
    expect(f.error).not.toContain('Gemini API 키가 맞는지');
  });
  it('엔진·글 생성 단계의 Gemini 인증 오류는 키 안내가 붙는다', () => {
    expect(buildSpiderFailure({ stage: 'engine', cause: new Error('[403 ] API Key not valid'), mode: 'api' }).error).toContain('Gemini API 키');
    expect(buildSpiderFailure({ stage: 'generate', cause: new Error('403 unregistered callers'), mode: 'api' }).error).toContain('Gemini API 키');
  });
  it('원인이 아주 길어도 "할 일" 줄이 마지막에 그대로 남는다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: new Error('가'.repeat(3000)), mode: 'agent', providerLabel: 'Codex' });
    const lines = f.error.split('\n');
    expect(lines[lines.length - 1]).toMatch(/^할 일: .*다시 시도해 주세요/);
    expect(lines[1].length).toBeLessThan(200);
  });
});

describe('일반어 목록 — 화면(internal-links.js)과 title.ts 가 같다', () => {
  it('SW_GENERIC_TITLES 와 SPIDER_GENERIC_TITLE_KEYS 가 같은 집합이다', () => {
    const m = UI.match(/const SW_GENERIC_TITLES = (\[[^\]]*\]);/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-new-func
    const uiList: string[] = new Function(`return ${m![1]};`)();
    expect([...uiList].sort()).toEqual([...SPIDER_GENERIC_TITLE_KEYS].sort());
  });
});

describe('화면 — 실행 방식 설정 읽기와 완료 문구', () => {
  const load = () => {
    const names = ['_swReadStoredSetting', '_swReadEngineSettings', '_swCompletionDetail'];
    const src = names.map((n) => braceBlock(UI, `function ${n}`)).join('\n');
    // eslint-disable-next-line no-new-func
    return new Function('localStorage', `${src}\nreturn { _swReadEngineSettings, _swCompletionDetail };`) as (ls: any) => any;
  };
  const store = (data: Record<string, string>) => ({ getItem: (k: string) => (k in data ? data[k] : null) });
  it('JSON 이든 원문 문자열이든 agent 선택을 잃지 않는다 (조용히 API 로 바뀌지 않는다)', () => {
    expect(load()(store({ leadernamExecutionMode: '"agent"', leadernamActiveAgentProvider: '"claude"' }))._swReadEngineSettings()).toEqual({ executionMode: 'agent', agentProvider: 'claude' });
    expect(load()(store({ leadernamExecutionMode: 'agent', leadernamActiveAgentProvider: 'claude' }))._swReadEngineSettings()).toEqual({ executionMode: 'agent', agentProvider: 'claude' });
  });
  it('저장값이 없으면 API · codex (기존 기본값)', () => {
    expect(load()(store({}))._swReadEngineSettings()).toEqual({ executionMode: 'api', agentProvider: 'codex' });
  });
  it('저장소를 읽지 못하면 삼키지 않고 던진다 — 호출부가 멈추고 알린다', () => {
    const broken = { getItem: () => { throw new Error('blocked'); } };
    expect(() => load()(broken)._swReadEngineSettings()).toThrow();
  });
  it('완료 문구에 경고가 줄바꿈으로 붙는다', () => {
    const { _swCompletionDetail } = load()(store({}));
    expect(_swCompletionDetail('모든 작업이 끝났습니다', [])).toBe('모든 작업이 끝났습니다');
    expect(_swCompletionDetail('모든 작업이 끝났습니다', ['본문이 짧습니다'])).toBe('모든 작업이 끝났습니다\n⚠️ 본문이 짧습니다');
  });
});

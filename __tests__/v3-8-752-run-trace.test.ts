const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

import {
  startRunTrace,
  newRunId,
  RUN_ID_PATTERN,
  currentTrace,
  runWithTrace,
  bindActiveTrace,
  unbindActiveTrace,
  noopTrace,
  redact,
  diffSentences,
  pruneTraceDirs,
  appendPublishAttempt,
  isTraceEnabled,
  type RunTracer,
} from '../src/core/final/run-trace';
import { replayRun } from '../src/core/final/run-trace-replay';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.752 (감사 F14) — 단계별 산출물 보존.
 *
 * "답 상자의 조건이 어디서 사라졌나" 에 아무도 답할 수 없었다. 검색·패킷·초안·삭제 전후가 어디에도 없었다.
 * 지시서 §5: 관측만 한다(켜고 끄는 것이 결과를 바꾸면 안 된다) · 절대 던지지 않는다 · 로컬만 · 비밀 없이 · 부분 저장을 전체라 하지 않는다.
 */
describe('v3.8.752 run-trace', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-traces-')); });

  const open = (over: Partial<{ runId: string; enabled: boolean; requested: Record<string, unknown> }> = {}): RunTracer =>
    startRunTrace({ runId: over.runId || newRunId(), enabled: over.enabled ?? true, requested: over.requested || {}, dir: root });

  const files = (t: RunTracer) => fs.readdirSync(t.dir!) as string[];
  const manifest = (t: RunTracer) => JSON.parse(fs.readFileSync(path.join(t.dir!, 'manifest.json'), 'utf8'));
  const events = (t: RunTracer) => fs.readFileSync(path.join(t.dir!, 'events.jsonl'), 'utf8').trim().split('\n').map((l: string) => JSON.parse(l));

  /** 가짜 파이프라인 — "모델 호출" 을 세고, 캡처를 부르며, 결과를 돌려준다. 실제 LLM 없음 */
  function fakePipeline(trace: RunTracer, calls: { n: number }): { title: string; html: string; prompt: string } {
    const prompt = `키워드: 청년미래적금\n근거: 월 70만원 한도`;
    trace.snapshot('writer.prompt', prompt, { ext: 'txt' });
    calls.n += 1;                                                     // 호출 1
    const draft = { introduction: '월 70만원 한도 내 자유납입입니다. 개인소득 6천만원 이하만 가입됩니다.', sections: [] };
    trace.snapshot('writer.draft.parsed', draft);
    const filtered = { ...draft, introduction: '월 70만원 한도 내 자유납입입니다.' };
    trace.change('fact-filter', { fn: 'sanitizeArticleFactClaims', beforeText: draft.introduction, afterText: filtered.introduction, reason: '근거 불일치 1건' });
    trace.check('validateArticleQuality', { status: 'RUN', result: { score: 100 }, changedAfter: true });
    calls.n += 1;                                                     // 호출 2 (자가 수정)
    const html = `<h1>제목</h1><p>${filtered.introduction}</p>`;
    trace.snapshot('html.final', html, { ext: 'html' });
    trace.finish('OK');
    return { title: '제목', html, prompt };
  }

  /** 테스트 13 — 캡처 ON/OFF 가 결과·호출 수·프롬프트를 바꾸지 않는다 */
  test('캡처 ON 과 OFF 의 생성 결과가 같다', () => {
    const off = { n: 0 };
    const on = { n: 0 };
    const resultOff = fakePipeline(startRunTrace({ runId: newRunId(), enabled: false, dir: root }), off);
    const tracer = open();
    const resultOn = fakePipeline(tracer, on);
    expect(resultOn).toEqual(resultOff);
    expect(on.n).toBe(off.n);
    expect(fs.readdirSync(root)).toHaveLength(1);                     // OFF 는 폴더를 만들지 않았다
    expect(files(tracer)).toEqual(expect.arrayContaining(['manifest.json', 'events.jsonl', 'checks.jsonl']));
    // 아무 데도 매지 않은 문맥은 NOOP — 아무것도 쓰지 않고 null 을 준다
    expect(currentTrace().enabled).toBe(false);
    expect(currentTrace().snapshot('x', 'y')).toBeNull();
    expect(isTraceEnabled({ runTrace: true })).toBe(true);
    expect(isTraceEnabled({})).toBe(process.env['RUN_TRACE'] === '1');
  });

  /** 테스트 14 — 삭제 전후 diff 가 남는다 */
  test('삭제 전후 문장이 남는다', () => {
    const t = open();
    fakePipeline(t, { n: 0 });
    const change = events(t).find((e: any) => e.kind === 'change' && e.stage === 'fact-filter');
    expect(change.removed).toEqual(['개인소득 6천만원 이하만 가입됩니다.']);
    expect(change.added).toEqual([]);
    expect(change.reason).toBe('근거 불일치 1건');
    expect(change.judgeable).toBe(true);
    // 사유가 없으면 '세부 사유 미제공' — diff 는 그래도 남는다
    t.change('unknown', { beforeText: '가 나 다라마바.', afterText: '가 나.' } as any);
    expect(diffSentences('첫 문장입니다. 둘째 문장입니다.', '첫 문장입니다.')).toMatchObject({ removed: ['둘째 문장입니다.'], added: [] });
  });

  /** 테스트 15 — 답 상자 조립 → 자가 수정 순서가 복원된다 (사건 seq 오름차순 · 소스 순서) */
  test('답 상자 → 자가 수정 순서', () => {
    const t = open();
    t.snapshot('answer-box.build', { answer: 'A' });
    t.snapshot('html.before-preflight', '<p>A</p>', { ext: 'html' });
    t.change('pre-publish-fix', { fn: 'fixBeforePublish', beforeText: 'A 문장입니다.', afterText: 'B 문장입니다.', reason: '구간 1개' });
    t.finish('OK');
    const ids = manifest(t).snapshots.map((s: any) => s.stage);
    expect(ids.indexOf('answer-box.build')).toBeLessThan(ids.indexOf('html.before-preflight'));
    const seqs = events(t).map((e: any) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    const src = read('src/core/final/orchestration.ts');
    expect(src.indexOf("trace.snapshot('answer-box.build'")).toBeLessThan(src.indexOf("trace.snapshot('html.before-preflight'"));
    expect(src.indexOf("trace.snapshot('html.before-preflight'")).toBeLessThan(src.indexOf("trace.snapshot('article.visible'"));
  });

  /** 테스트 16 — 동시 run 이 섞이지 않는다 */
  test('동시 run 격리', async () => {
    const a = open({ runId: '20260929-000001-aaaaaa' });
    const b = open({ runId: '20260929-000002-bbbbbb' });
    const tick = () => new Promise((r) => setTimeout(r, 5));
    await Promise.all([
      runWithTrace(a, async () => { await tick(); currentTrace().snapshot('who', 'A'); await tick(); currentTrace().event('e', { who: 'A' }); }),
      runWithTrace(b, async () => { currentTrace().snapshot('who', 'B'); await tick(); await tick(); currentTrace().event('e', { who: 'B' }); }),
    ]);
    expect(fs.readFileSync(path.join(a.dir!, '001-who.txt'), 'utf8')).toBe('A');
    expect(fs.readFileSync(path.join(b.dir!, '001-who.txt'), 'utf8')).toBe('B');
    expect(events(a).map((e: any) => e.who)).toEqual(['A']);
    expect(events(b).map((e: any) => e.who)).toEqual(['B']);
    // 엔진 락 안의 활성 tracer 도 떼면 NOOP 으로 돌아간다
    bindActiveTrace(a);
    expect(currentTrace()).toBe(a);
    unbindActiveTrace(a);
    expect(currentTrace()).toBe(noopTrace());
  });

  /** 테스트 17 — 스냅샷은 그 순간의 값. 뒤에서 객체를 고쳐도 파일은 안 바뀐다 */
  test('스냅샷 불변', () => {
    const t = open();
    const obj: any = { answer: '월 70만원 한도 내 자유납입', rows: [['a']] };
    const ref = t.snapshot('summary-table.raw', obj)!;
    obj.answer = '월 70만원을 5년 내내 납입할 수 있는 경우에만';
    obj.rows[0].push('b');
    const body = fs.readFileSync(path.join(t.dir!, ref.file), 'utf8');
    expect(JSON.parse(body).answer).toBe('월 70만원 한도 내 자유납입');
    expect(JSON.parse(body).rows).toEqual([['a']]);
    expect(crypto.createHash('sha1').update(body, 'utf8').digest('hex')).toBe(ref.sha1);
    expect(manifest(t).snapshots[0].sha1).toBe(ref.sha1);
  });

  /** 테스트 18 — 저장 실패·용량 초과: 글은 그대로, 캡처만 불완전 표시 */
  test('저장 실패는 캡처 불완전으로 남고 글을 버리지 않는다', () => {
    // (a) 폴더를 못 만들면 NOOP — 파이프라인은 정상 결과
    const blocked = path.join(root, 'file-not-dir');
    fs.writeFileSync(blocked, 'x');
    const noop = startRunTrace({ runId: newRunId(), enabled: true, dir: blocked });
    expect(noop.enabled).toBe(false);
    expect(fakePipeline(noop, { n: 0 }).title).toBe('제목');

    // (b) 용량 상한 초과 — 스냅샷은 stored:false · SIZE_CAP, 상태 PARTIAL, 함수는 던지지 않는다
    const before = process.env['RUN_TRACE_MAX_MB'];
    process.env['RUN_TRACE_MAX_MB'] = '0.001';
    try {
      const t = open();
      const big = t.snapshot('html.final', 'x'.repeat(4096), { ext: 'html' })!;
      expect(big.stored).toBe(false);
      expect(big.reason).toBe('SIZE_CAP');
      expect(fs.existsSync(path.join(t.dir!, big.file))).toBe(false);
      t.finish('OK');
      const m = manifest(t);
      expect(m.capture.status).toBe('PARTIAL');
      expect(m.capture.failures.join(' ')).toContain('SIZE_CAP');
      expect(m.snapshots[0]).toMatchObject({ stored: false, reason: 'SIZE_CAP' });
    } finally {
      if (before === undefined) delete process.env['RUN_TRACE_MAX_MB']; else process.env['RUN_TRACE_MAX_MB'] = before;
    }

    // (c) 폴더가 중간에 사라져도 던지지 않는다
    const gone = open();
    fs.rmSync(gone.dir!, { recursive: true, force: true });
    expect(() => gone.snapshot('late', { a: 1 })).not.toThrow();
    expect(gone.snapshot('late2', { a: 1 })!.stored).toBe(false);
    expect(() => gone.event('x')).not.toThrow();
    expect(() => gone.finish('OK')).not.toThrow();
  });

  /** 테스트 19 — 키·토큰·쿠키·Authorization·전체 환경변수는 저장하지 않는다 */
  test('민감정보 미저장', () => {
    process.env['__RUN_TRACE_SENTINEL'] = 'SENTINEL_ENV_VALUE_9f8e7d';
    const t = open({ requested: { keyword: '청년미래적금', apiKey: 'sk-abcdefghijklmnopqrstuvwxyz0123' } });
    t.snapshot('request.payload', {
      topic: '청년미래적금 비교', keyword: '청년미래적금',
      bloggerAccessToken: 'ya29.a0AfB_byC1234567890abcdefghijklmnop', bloggerRefreshToken: '1//0gABCDEFGHIJKLMNOPQRSTUVWXYZ12345',
      naverClientSecret: 'nsecret123', openaiKey: 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ', wpPassword: 'wp-pass', cookie: 'a=b',
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' },
      nested: { note: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234' },
    });
    t.snapshot('writer.prompt', '본문에 sk-abcdefghijklmnopqrstuvwxyz0123 이 섞였다', { ext: 'txt' });
    t.finish('OK');
    const all = files(t).map((f) => fs.readFileSync(path.join(t.dir!, f), 'utf8')).join('\n');
    for (const secret of ['ya29.a0AfB', '1//0gABCDEF', 'nsecret123', 'sk-proj-ABCDEF', 'wp-pass', 'a=b', 'eyJhbGciOiJIUzI1NiJ9', 'sk-abcdefghijklmnopqrstuvwxyz0123', 'SENTINEL_ENV_VALUE_9f8e7d']) {
      expect(all).not.toContain(secret);
    }
    expect(all).toContain('청년미래적금');                   // keyword 는 남는다(…word 는 key 가 아니다)
    expect(all).toContain('[REDACTED]');
    expect(redact({ keyword: 'k', apiKey: 'v', list: [{ token: 't' }] })).toEqual({ keyword: 'k', apiKey: '[REDACTED]', list: [{ token: '[REDACTED]' }] });
    delete process.env['__RUN_TRACE_SENTINEL'];
  });

  /** 테스트 20 — 실제 호출 입력 == 저장된 Writer 입력 (재조립 없음) */
  test('저장된 Writer 프롬프트가 호출 인자와 같다', () => {
    const t = open();
    const prompt = '키워드: 보험금 지급지연\n[FACT EVIDENCE]\n- id=E1 …\n규칙: 근거 밖 수치 금지';
    const ref = t.snapshot('writer.prompt', prompt, { ext: 'txt' })!;
    expect(fs.readFileSync(path.join(t.dir!, ref.file), 'utf8')).toBe(prompt);
    // generation.ts: 스냅샷 인자와 호출 인자가 같은 변수(diet.text)이고, 스냅샷이 호출 바로 앞이다
    const gen = read('src/core/final/generation.ts');
    const at = gen.indexOf("runTrace.snapshot('writer.prompt', diet.text");
    const call = gen.indexOf('callGeminiWithGrounding(diet.text, 1, false, undefined', at);
    expect(at).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(at);
    expect(gen.slice(at, call)).not.toMatch(/diet\.text\s*=|prompt\s*=/);
    expect(gen).toContain("runTrace.snapshot('writer.response.raw', String(response ?? '')");
    expect(gen).toContain("runTrace.snapshot('writer.boost.prompt', improvePrompt");
  });

  /** 테스트 21 — 예외로 중단돼도 그때까지의 스냅샷은 남는다 */
  test('예외 중단 시 이전 스냅샷 보존', async () => {
    const t = open();
    await expect(runWithTrace(t, async () => {
      currentTrace().snapshot('search.results', { documents: [{ title: 'a' }] });
      currentTrace().snapshot('packet.raw', { facts: ['f'] });
      throw new Error('LLM 섹션 생성 실패');
    })).rejects.toThrow('LLM 섹션 생성 실패');
    t.finish('FAILED', { error: 'LLM 섹션 생성 실패' });
    expect(files(t)).toEqual(expect.arrayContaining(['001-search.results.json', '002-packet.raw.json']));
    const m = manifest(t);
    expect(m.outcome).toBe('FAILED');
    expect(m.error).toBe('LLM 섹션 생성 실패');
    expect(m.snapshots).toHaveLength(2);
    // orchestration 의 바깥 catch 가 FAILED/CANCELED 로 닫고 finally 에서 뗀다
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain("trace.finish((error as any)?.canceled === true ? 'CANCELED' : 'FAILED'");
    expect(src).toContain('traceMod.unbindActiveTrace(trace)');
  });

  /** 테스트 22 — 재생 도구는 네트워크 없이 run 폴더만 읽는다 */
  test('재생 도구는 오프라인', () => {
    const t = open({ runId: '20260929-234647-0ab1c2' });
    fakePipeline(t, { n: 0 });
    appendPublishAttempt(t.runId, { platform: 'blogspot', ok: false, error: 'invalid_grant' }, root);
    appendPublishAttempt(t.runId, { platform: 'wordpress', ok: true, url: 'https://leadernam.com/x' }, root);
    const r = replayRun(t.dir!);
    expect(r.text).toContain('run 20260929-234647-0ab1c2');
    expect(r.text).toContain('지운 문장 1');
    expect(r.text).toContain('− 개인소득 6천만원 이하만 가입됩니다.');
    expect(r.text).toContain('validateArticleQuality · RUN');
    expect(r.text).toContain('발행 시도 2건');
    expect(r.text).toContain('wordpress · 성공 · https://leadernam.com/x');
    expect(r.attempts).toHaveLength(2);
    expect(manifest(t).counts.publishAttempts).toBe(2);
    // 없는 run 에는 붙이지 않는다(캡처 OFF 였던 실행)
    expect(appendPublishAttempt('20260101-000000-000000', { ok: true }, root)).toBe(false);
    for (const file of ['src/core/final/run-trace-replay.ts', 'scripts/run-trace-replay.js', 'src/core/final/run-trace.ts']) {
      const s = read(file);
      expect(s).not.toMatch(/require\(['"](https?|axios|node-fetch|undici)['"]\)|naver-search-client|llm-caller|callGemini/);
    }
  });

  test('보존 정책은 run 폴더만 · .keep · 감사 원본은 건드리지 않는다', () => {
    for (const name of ['20260901-000000-000001', '20260902-000000-000002', '20260903-000000-000003', 'audit-원본-2026-09-29', 'notes.txt']) {
      if (name.endsWith('.txt')) fs.writeFileSync(path.join(root, name), 'x');
      else fs.mkdirSync(path.join(root, name));
    }
    fs.writeFileSync(path.join(root, '20260901-000000-000001', '.keep'), '');
    const removed = pruneTraceDirs(root, 1);
    expect(removed).toEqual(['20260902-000000-000002']);
    expect(fs.existsSync(path.join(root, '20260901-000000-000001'))).toBe(true);
    expect(fs.existsSync(path.join(root, '20260903-000000-000003'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'audit-원본-2026-09-29'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'notes.txt'))).toBe(true);
    expect(RUN_ID_PATTERN.test(newRunId())).toBe(true);
  });
});

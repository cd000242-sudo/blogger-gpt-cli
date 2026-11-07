/**
 * v3.8.768 — Codex 구독 이미지 엔진 (사장님 요청 2026-11-07, 네이버 앱 src/image/codex 이식).
 *
 * 실제 Codex 호출은 하지 않는다(유료·계정 사용). 가짜 spawn 이 ~/.codex 와 같은 모양의
 * generated_images/<thread>/ 폴더에 파일을 써 주는 방식으로 명령 조립과 파일 수거를 시험한다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCodexImageInstruction, withCodexAspectRatio,
} from '../src/core/codex-image/codexImageInstruction';
import {
  extractCodexErrorText, listGeneratedImages, parseCodexThreadId, resolveCodexHome,
} from '../src/core/codex-image/codexImageFiles';
import {
  runCodexImageSession, CODEX_IMAGE_DEFAULT_MODEL, type CodexSpawnRequest, type CodexSpawnResult,
} from '../src/core/codex-image/codexImageSession';
import { CodexImageError, classifyCodexImageFailure } from '../src/core/codex-image/codexImageErrors';
import { subscriptionEnv } from '../src/core/codex-image/codexImageRuntime';
import { assessCodexImageReadiness } from '../src/core/codex-image/codexImageReadiness';
import { centerCropBox, fitCodexImageToRatio } from '../src/core/codex-image/codexImageFrame';
import {
  makeCodexImage, resetCodexImageEngineState, CODEX_IMAGE_CONCURRENCY, type CodexImageEngineDeps,
} from '../src/core/codex-image/codexImageEngine';
import { runImageGenerationQueued } from '../src/core/image-generation-queue';

const THREAD = '019aa000-1111-7222-8333-444455556666';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-codex-home-'));
  resetCodexImageEngineState();
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

const thread = (id = THREAD): string => `${JSON.stringify({ type: 'thread.started', thread_id: id })}\n`;

/** 가짜 codex: 요청을 기록하고, 원하면 generated_images/<thread>/ 에 파일을 쓴다. */
function fakeCodex(behaviour: (request: CodexSpawnRequest) => Partial<CodexSpawnResult> & { write?: boolean }) {
  const calls: CodexSpawnRequest[] = [];
  const seenCwd: string[] = [];
  const spawn = async (request: CodexSpawnRequest): Promise<CodexSpawnResult> => {
    calls.push(request);
    seenCwd.push(request.cwd);
    const out = behaviour(request);
    if (out.write) {
      const dir = path.join(home, 'generated_images', THREAD);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `exec-${calls.length}.png`), PNG_1X1);
    }
    return { code: 0, stdout: thread(), stderr: '', timedOut: false, aborted: false, ...out };
  };
  const deps = { spawn, command: () => 'codex-fake', env: () => ({ CODEX_HOME: home }) as NodeJS.ProcessEnv, now: () => Date.now() };
  return { calls, seenCwd, deps };
}

describe('지시문', () => {
  test('프롬프트를 한 글자도 바꾸지 않고 image_gen 도구에 넘기라고 한다', () => {
    const text = buildCodexImageInstruction('벚꽃 길을 걷는 사람, 따뜻한 오후');
    expect(text).toContain('image_gen');
    expect(text).toContain('한 글자도 바꾸지 말고');
    expect(text).toContain('"벚꽃 길을 걷는 사람, 따뜻한 오후"');
  });

  test('빈 프롬프트는 작업 폴더를 만들기 전에 거절한다', () => {
    expect(() => buildCodexImageInstruction('   ')).toThrow(/비어 있습니다/);
  });

  test('비율 줄: 기본 16:9, 모르는 값도 16:9', () => {
    expect(withCodexAspectRatio('a cat')).toContain('ASPECT RATIO: wide landscape 16:9');
    expect(withCodexAspectRatio('a cat', '1:1')).toContain('square 1:1');
    expect(withCodexAspectRatio('a cat', 'weird')).toContain('16:9');
  });
});

describe('실행 결과 읽기', () => {
  test('thread id: thread.started 이벤트에서만, 폴더 이름으로 안전한 값만', () => {
    expect(parseCodexThreadId(thread())).toBe(THREAD);
    expect(parseCodexThreadId(thread('../../etc'))).toBeUndefined();
    expect(parseCodexThreadId('not json\n{"type":"item.completed"}')).toBeUndefined();
  });

  test('오류 이벤트 글만 모은다(프롬프트에 든 quota 같은 낱말에 속지 않는다)', () => {
    const stdout = [
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'quota usage limit' } }),
      JSON.stringify({ type: 'error', message: 'You have hit your usage limit' }),
      JSON.stringify({ type: 'turn.failed', error: { message: 'stream disconnected' } }),
    ].join('\n');
    expect(extractCodexErrorText(stdout)).toBe('You have hit your usage limit\nstream disconnected');
  });

  test('CODEX_HOME 이 있으면 그것, 없으면 사용자 폴더의 .codex', () => {
    expect(resolveCodexHome({ CODEX_HOME: 'D:\\custom\\codex' })).toBe('D:\\custom\\codex');
    expect(resolveCodexHome({ USERPROFILE: 'C:\\Users\\a' })).toBe(path.join('C:\\Users\\a', '.codex'));
  });

  test('결과 폴더: 시작 시각 이후 파일만, 오래된 순서로. 폴더가 없으면 빈 목록', async () => {
    const dir = path.join(home, 'generated_images', THREAD);
    fs.mkdirSync(dir, { recursive: true });
    const stale = path.join(dir, 'old.png');
    const fresh = path.join(dir, 'new.png');
    fs.writeFileSync(stale, PNG_1X1);
    fs.writeFileSync(fresh, PNG_1X1);
    fs.writeFileSync(path.join(dir, 'note.txt'), 'x');
    const past = new Date(Date.now() - 3_600_000);
    fs.utimesSync(stale, past, past);
    expect(await listGeneratedImages(dir, Date.now() - 60_000)).toEqual([fresh]);
    expect(await listGeneratedImages(path.join(home, 'nope'), 0)).toEqual([]);
  });
});

describe('실행 환경', () => {
  test('구독 실행은 API 키를 지우고 나머지(CODEX_HOME 포함)는 그대로 둔다', () => {
    const env = subscriptionEnv({ OPENAI_API_KEY: 'k1', CODEX_API_KEY: 'k2', ANTHROPIC_API_KEY: 'k3', PATH: 'p', CODEX_HOME: 'h' });
    expect(env['OPENAI_API_KEY']).toBeUndefined();
    expect(env['CODEX_API_KEY']).toBeUndefined();
    expect(env['ANTHROPIC_API_KEY']).toBeUndefined();
    expect(env['PATH']).toBe('p');
    expect(env['CODEX_HOME']).toBe('h');
  });
});

describe('한 장 세션 (가짜 codex)', () => {
  test('명령 조립: 이 PC 로그인 그대로(--ignore-user-config, 로그인 폴더 복사 없음) · 지시문은 stdin', async () => {
    const codex = fakeCodex(() => ({ write: true }));
    const result = await runCodexImageSession('벚꽃 길 일러스트', codex.deps);
    const request = codex.calls[0] as CodexSpawnRequest;
    expect(request.command).toBe('codex-fake');
    expect(request.args.slice(0, 5)).toEqual(['exec', '--skip-git-repo-check', '--ignore-user-config', '-m', CODEX_IMAGE_DEFAULT_MODEL]);
    expect(request.args).toEqual(expect.arrayContaining(['-c', 'model_reasoning_effort=low', '--json', '-C', request.cwd]));
    expect(request.stdin).toBe(buildCodexImageInstruction('벚꽃 길 일러스트'));
    expect(result.threadId).toBe(THREAD);
    expect(result.files).toHaveLength(1);
    expect(fs.existsSync(result.files[0] as string)).toBe(true);
  });

  test('모델을 지정하면 그것이 이긴다', async () => {
    const codex = fakeCodex(() => ({ write: true }));
    await runCodexImageSession('x', codex.deps, { model: 'gpt-6.1-terra' });
    expect((codex.calls[0] as CodexSpawnRequest).args).toContain('gpt-6.1-terra');
  });

  test('끝나면 임시 작업 폴더를 지운다', async () => {
    const codex = fakeCodex(() => ({ write: true }));
    await runCodexImageSession('x', codex.deps);
    expect(fs.existsSync(codex.seenCwd[0] as string)).toBe(false);
  });

  test.each([
    ['로그인 만료', { code: 1, stderr: 'ERROR: 401 invalid_refresh_token' }, 'not_logged_in', /연결/],
    ['사용 한도', { code: 1, stderr: 'You have hit your usage limit' }, 'rate_limited', /한도/],
    ['설치 안 됨', { code: null, spawnError: 'spawn codex ENOENT' }, 'not_installed', /설치/],
    ['시간 초과', { code: null, timedOut: true }, 'timeout', /제한 시간/],
    ['사용자 중지', { code: null, aborted: true }, 'aborted', /중지/],
  ] as const)('%s → %s', async (_name, outcome, code, message) => {
    const codex = fakeCodex(() => ({ ...outcome }));
    const error = await runCodexImageSession('x', codex.deps).catch((e) => e);
    expect(error).toBeInstanceOf(CodexImageError);
    expect(error.code).toBe(code);
    expect(error.message).toMatch(message);
  });

  test('실패 문구는 다른 엔진으로 바꾸지 않았다고 말한다(자동 폴백 금지)', async () => {
    const codex = fakeCodex(() => ({ code: 1, stderr: 'invalid_refresh_token' }));
    const error = await runCodexImageSession('x', codex.deps).catch((e) => e);
    expect(error.message).toContain('다른 이미지 엔진으로 바꾸지 않았습니다');
  });

  test('종료 코드 0 인데 thread id 가 없으면 폴더를 못 찾는다고 말한다', async () => {
    const codex = fakeCodex(() => ({ stdout: '' }));
    const error = await runCodexImageSession('x', codex.deps).catch((e) => e);
    expect(error.code).toBe('empty_output');
    expect(error.message).toContain('thread id');
  });

  test('종료 코드 0 이고 thread 는 있는데 파일이 없으면 이미지 못 받음', async () => {
    const codex = fakeCodex(() => ({ write: false }));
    const error = await runCodexImageSession('x', codex.deps).catch((e) => e);
    expect(error.code).toBe('empty_output');
    expect(error.message).toContain('이미지 파일을 받지 못했습니다');
  });

  test('종료 코드 0 이어도 오류 이벤트(한도)만 있고 파일이 없으면 그 오류로 실패', async () => {
    const stdout = thread() + JSON.stringify({ type: 'error', message: 'usage limit reached' });
    const codex = fakeCodex(() => ({ stdout }));
    const error = await runCodexImageSession('x', codex.deps).catch((e) => e);
    expect(error.code).toBe('rate_limited');
  });

  test('분류기: 문구 → 종류', () => {
    expect(classifyCodexImageFailure('Please log in again')).toBe('not_logged_in');
    expect(classifyCodexImageFailure('429 Too Many Requests')).toBe('rate_limited');
    expect(classifyCodexImageFailure('model gpt-x does not exist')).toBe('model_unavailable');
    expect(classifyCodexImageFailure('something odd')).toBe('nonzero_exit');
  });
});

describe('연결 상태 판정 (메인 프로세스가 사실만 넘긴다)', () => {
  const base = { installed: true, usable: true, loginFilePresent: true };
  test('모두 갖춰지면 통과', () => {
    expect(assessCodexImageReadiness(base)).toBeNull();
    expect(assessCodexImageReadiness({ ...base, systemProfileStatus: 'ready' })).toBeNull();
    expect(assessCodexImageReadiness({ ...base, systemProfileStatus: 'unknown' })).toBeNull();
  });
  test('설치 안 됨 · 업데이트 필요 · 로그인 파일 없음 · 서버가 로그인을 거절', () => {
    expect(assessCodexImageReadiness({ ...base, installed: false, usable: false })?.code).toBe('not_installed');
    expect(assessCodexImageReadiness({ ...base, usable: false, binaryError: 'please update codex' })?.code).toBe('update_required');
    expect(assessCodexImageReadiness({ ...base, loginFilePresent: false })?.code).toBe('not_logged_in');
    expect(assessCodexImageReadiness({ ...base, systemProfileStatus: 'needs-login' })?.code).toBe('not_logged_in');
    expect(assessCodexImageReadiness({ ...base, loginFilePresent: false })?.message).toContain('연결');
  });
});

describe('화면 비율 맞춤', () => {
  test('이미 16:9 근처면 자르지 않고, 정사각형이면 가운데 16:9 로 자른다', () => {
    expect(centerCropBox(1672, 941, 16 / 9)).toBeNull();
    expect(centerCropBox(1254, 1254, 16 / 9)).toEqual({ left: 0, top: 274, width: 1254, height: 705 });
  });
  test('실제 이미지를 자른다(sharp), 못 읽는 파일은 그대로 통과', async () => {
    const sharp = (await import('sharp')).default;
    const square = await sharp({ create: { width: 160, height: 160, channels: 3, background: '#336699' } }).png().toBuffer();
    const fitted = await fitCodexImageToRatio(square, '16:9');
    expect(fitted.cropped).toBe(true);
    const meta = await sharp(fitted.buffer).metadata();
    expect(meta.width).toBe(160);
    expect(meta.height).toBe(90);
    const junk = Buffer.from('not an image');
    const passed = await fitCodexImageToRatio(junk, '16:9');
    expect(passed.cropped).toBe(false);
    expect(passed.buffer).toBe(junk);
  });
});

function engineDeps(overrides: Partial<CodexImageEngineDeps> = {}): Partial<CodexImageEngineDeps> {
  return {
    assertReady: async () => { /* ready */ },
    readFile: async () => PNG_1X1,
    isCanceled: () => false,
    cancelSignal: () => undefined,
    runSession: async () => {
      const dir = path.join(home, 'generated_images', THREAD);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'exec-x.png');
      fs.writeFileSync(file, PNG_1X1);
      return { threadId: THREAD, files: [file], model: 'gpt-6-luna' };
    },
    ...overrides,
  };
}

describe('엔진 (동시 4장 · 자동 폴백 없음)', () => {
  test('성공하면 data URL 로 돌려준다', async () => {
    const result = await makeCodexImage('a lake', { aspectRatio: '1:1' }, engineDeps());
    expect(result.ok).toBe(true);
    expect(result.dataUrl).toBe(`data:image/png;base64,${PNG_1X1.toString('base64')}`);
    expect(result.model).toBe('gpt-6-luna');
  });

  test('세션에는 비율 줄이 붙은 프롬프트를 넘긴다', async () => {
    const prompts: string[] = [];
    await makeCodexImage('a lake', {}, engineDeps({ runSession: async (prompt) => { prompts.push(prompt); return { threadId: THREAD, files: ['x.png'], model: 'm' }; } }));
    expect(prompts[0]).toContain('a lake');
    expect(prompts[0]).toContain('ASPECT RATIO: wide landscape 16:9');
  });

  test('8장을 한꺼번에 요청해도 동시에 도는 세션은 4개까지', async () => {
    expect(CODEX_IMAGE_CONCURRENCY).toBe(4);
    let active = 0;
    let peak = 0;
    const deps = engineDeps({
      runSession: async () => {
        active += 1; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return { threadId: THREAD, files: ['x.png'], model: 'm' };
      },
    });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => makeCodexImage(`p${i}`, {}, deps)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(peak).toBe(4);
  });

  test('연결 확인은 한 번만 하고 잠시 기억한다', async () => {
    let checks = 0;
    const deps = engineDeps({ assertReady: async () => { checks += 1; } });
    await Promise.all([makeCodexImage('a', {}, deps), makeCodexImage('b', {}, deps), makeCodexImage('c', {}, deps)]);
    await makeCodexImage('d', {}, deps);
    expect(checks).toBe(1);
  });

  test('연결이 안 돼 있으면 세션을 시작하지 않고 연결 안내를 돌려준다', async () => {
    const connect = new CodexImageError('not_logged_in', 'Codex 구독 이미지는 Codex 연결이 필요합니다 — 설정에서 [Agent 계정 연결]. 다른 이미지 엔진으로 바꾸지 않았습니다.');
    let sessions = 0;
    const result = await makeCodexImage('a', {}, engineDeps({
      assertReady: async () => { throw connect; },
      runSession: async () => { sessions += 1; return { threadId: THREAD, files: ['x'], model: 'm' }; },
    }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('연결이 필요합니다');
    expect(sessions).toBe(0);
  });

  test('PC 전체에 해당하는 실패(로그인·한도)는 기다리던 장들을 같은 이유로 바로 실패시킨다', async () => {
    let sessions = 0;
    const dead = new CodexImageError('rate_limited', 'Codex 구독 이미지를 지금은 쓸 수 없습니다 — 구독 사용 한도에 도달했습니다.');
    const deps = engineDeps({
      runSession: async () => {
        sessions += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw dead;
      },
    });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => makeCodexImage(`p${i}`, {}, deps)));
    expect(results.every((r) => !r.ok && /한도/.test(r.error || ''))).toBe(true);
    expect(sessions).toBe(CODEX_IMAGE_CONCURRENCY); // 이미 시작한 4개뿐, 나머지 4장은 세션을 만들지 않았다
  });

  test('실패 뒤 사용자가 연결을 고치고 새로 요청하면 다시 시도한다(옛 실패에 막히지 않는다)', async () => {
    const dead = new CodexImageError('not_logged_in', '연결 필요');
    const failing = await makeCodexImage('a', {}, engineDeps({ runSession: async () => { throw dead; } }));
    expect(failing.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const again = await makeCodexImage('a', {}, engineDeps());
    expect(again.ok).toBe(true);
  });

  test('한 장만 실패한 일반 오류는 다른 장에 번지지 않고, 같은 요청을 다시 보내지도 않는다', async () => {
    let calls = 0;
    const plain = new CodexImageError('empty_output', '이미지 파일을 받지 못했습니다');
    const deps = engineDeps({
      runSession: async () => {
        calls += 1;
        if (calls === 1) throw plain;
        return { threadId: THREAD, files: ['x.png'], model: 'm' };
      },
    });
    const first = await makeCodexImage('a', {}, deps);
    const second = await makeCodexImage('b', {}, deps);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(calls).toBe(2);
  });

  test('중지: 시작 전이면 세션 없이 CANCELED_BY_USER, 세션 도중 중지돼도 같은 값', async () => {
    let sessions = 0;
    const before = await makeCodexImage('a', {}, engineDeps({ isCanceled: () => true, runSession: async () => { sessions += 1; return { threadId: THREAD, files: ['x'], model: 'm' }; } }));
    expect(before).toMatchObject({ ok: false, error: 'CANCELED_BY_USER' });
    expect(sessions).toBe(0);
    const during = await makeCodexImage('a', {}, engineDeps({ runSession: async () => { throw new CodexImageError('aborted', '중지'); } }));
    expect(during).toMatchObject({ ok: false, error: 'CANCELED_BY_USER' });
  });
});

describe('공통 큐: Codex 이미지는 줄 서지 않고 엔진의 4칸 제한만 받는다', () => {
  test('4개 작업이 동시에 시작된다', async () => {
    const started: number[] = [];
    const releases: Array<() => void> = [];
    const jobs = [0, 1, 2, 3].map((i) => runImageGenerationQueued({ engine: 'codex-image' }, () => new Promise<number>((resolve) => {
      started.push(i);
      releases.push(() => resolve(i));
    })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started).toHaveLength(4); // 큐에 줄 서 있었다면 1개만 시작됐을 것이다
    releases.forEach((release) => release());
    expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3]);
  });
});

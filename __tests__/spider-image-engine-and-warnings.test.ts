/**
 * 거미줄 종합글 — 이미지 엔진 전달·저장, 0장 경고 (묶음 E)
 *
 * · 화면 select(swThumbnailEngine / swH2ImageEngine) → payload → 핸들러 → dispatcher 까지 값이 그대로 가는지.
 * · 거미줄 탭 엔진 칸은 저장이 없어 앱을 다시 켜면 nanobanana2 로 돌아갔다 (글포스팅 v3.8.769 와 같은 꼴로 고친다).
 * · 이미지를 만들기로 했는데 0장·일부만이면 warnings 로 화면 완료 문구에 보인다 (실패로 막지는 않는다).
 * 실제 LLM·이미지 엔진·앱은 부르지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';
import { buildSpiderImageWarnings, sanitizeSpiderImageErrors } from '../src/core/spider';
import { normalizeImageEngine } from '../src/core/imageDispatcher';

const MAIN = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8');
const UI = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/internal-links.js'), 'utf8');
const HTML = fs.readFileSync(path.join(process.cwd(), 'electron/ui/index.html'), 'utf8');
const HANDLER = blockBetween(
  MAIN,
  "ipcMain.handle('generate-internal-consistency', async",
  "ipcMain.handle('save-image-as-png'",
);

const stats = (over: Partial<{ thumbnail: boolean; h2Generated: number; h2Failed: number; errors: string[] }> = {}) => ({
  thumbnail: false, h2Generated: 0, h2Failed: 0, errors: [] as string[], ...over,
});
const base = { imagePolicy: 'all', thumbEngine: 'gptimage2', h2Engine: 'gptimage2' };

describe('E.3 buildSpiderImageWarnings — 조용히 넘기지 않는다', () => {
  it('이미지 정책이 none 이면 경고가 없다', () => {
    expect(buildSpiderImageWarnings({ ...base, imagePolicy: 'none', stats: stats() })).toEqual([]);
  });
  it('모두 성공하면 경고가 없다', () => {
    expect(buildSpiderImageWarnings({ ...base, stats: stats({ thumbnail: true, h2Generated: 4 }) })).toEqual([]);
  });
  it('0장이면 엔진 오류 문구와 함께 한 줄로 알린다', () => {
    const w = buildSpiderImageWarnings({ ...base, stats: stats({ h2Failed: 2, errors: ['썸네일 생성 실패: 429 quota', 'H2 1 실패: 429 quota'] }) });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/^이미지가 0장입니다 — 엔진 오류: 썸네일 생성 실패: 429 quota/);
    expect(w[0]).toMatch(/gptimage2/);
  });
  it('일부만 들어가면 몇 장 중 몇 장인지 알린다', () => {
    const w = buildSpiderImageWarnings({ ...base, stats: stats({ thumbnail: true, h2Generated: 2, h2Failed: 3, errors: ['H2 3 실패: 시간 초과'] }) });
    expect(w.join('\n')).toMatch(/본문 이미지 5장 중 2장만/);
    expect(w.join('\n')).toMatch(/시간 초과/);
  });
  it('썸네일만 빠졌으면 썸네일을 짚는다', () => {
    const w = buildSpiderImageWarnings({ ...base, stats: stats({ thumbnail: false, h2Generated: 3, errors: ['썸네일 예외: boom'] }) });
    expect(w.join('\n')).toMatch(/썸네일이 들어가지 않았습니다/);
  });
  it('썸네일만 정책에서는 본문 이미지를 기대하지 않는다', () => {
    expect(buildSpiderImageWarnings({ ...base, imagePolicy: 'thumbnail-only', stats: stats({ thumbnail: true }) })).toEqual([]);
  });
  it('엔진이 none 이면 그 칸은 기대하지 않는다', () => {
    expect(buildSpiderImageWarnings({ imagePolicy: 'all', thumbEngine: 'none', h2Engine: 'none', stats: stats() })).toEqual([]);
  });
  it('호스팅 폴백 안내(이미지는 있음)는 실패 원인으로 세지 않는다', () => {
    const w = buildSpiderImageWarnings({ ...base, stats: stats({ h2Failed: 1, errors: ['썸네일 호스팅 폴백: passthrough (발행기에서 추가 업로드를 시도합니다)', 'H2 1 실패: 진짜 원인'] }) });
    expect(w[0]).toMatch(/진짜 원인/);
    expect(w[0]).not.toMatch(/호스팅 폴백/);
  });
  it('경고 문구에 키·토큰이 섞이지 않는다', () => {
    const key = 'AIza' + 'B'.repeat(35);
    const w = buildSpiderImageWarnings({ ...base, stats: stats({ errors: [`H2 1 예외: 403 key=${key} Bearer abcdefghijklmnop`] }) });
    expect(w.join('\n')).not.toContain(key);
    expect(w.join('\n')).not.toMatch(/Bearer abcdefghijklmnop/);
  });
});

describe('E.3 sanitizeSpiderImageErrors — imageStats.errors 에 비밀이 없다', () => {
  it('키·토큰을 가리고 한 줄 200자로 줄인다', () => {
    const key = 'AIza' + 'C'.repeat(35);
    const out = sanitizeSpiderImageErrors([`H2 1 예외: ?key=${key}\n두 번째 줄`, 'x'.repeat(500)]);
    expect(out[0]).not.toContain(key);
    expect(out[0]).not.toContain('\n');
    expect(out[1].length).toBeLessThanOrEqual(201);
  });
  it('문자열이 아닌 값도 죽지 않는다', () => {
    expect(sanitizeSpiderImageErrors([undefined as any, null as any, 3 as any])).toEqual(['undefined', 'null', '3'].map(() => expect.any(String)));
  });
});

describe('E.1 엔진 전달 — 화면 → payload → 핸들러 → dispatcher', () => {
  it('화면 select 의 모든 선택지는 dispatcher 가 그 이름 그대로 알아본다 (조용한 치환 없음)', () => {
    for (const id of ['swThumbnailEngine', 'swH2ImageEngine']) {
      const select = HTML.match(new RegExp(`<select id="${id}"[\\s\\S]*?</select>`))![0];
      const values = [...select.matchAll(/<option(?![^>]*disabled)[^>]*value="([^"]+)"/g)].map((m) => m[1]);
      expect(values.length).toBeGreaterThan(8);
      for (const v of values) expect(normalizeImageEngine(v)).toBe(v);
    }
  });
  it('화면은 select 값을 그대로 payload 에 싣는다 (기본값은 빈 값일 때만)', () => {
    expect(UI).toMatch(/const imageThumbnailEngine = \(thumbEngineSel && thumbEngineSel\.value\) \|\| 'nanobanana2';/);
    expect(UI).toMatch(/const imageH2Engine = \(h2EngineSel && h2EngineSel\.value\) \|\| 'nanobanana2';/);
    expect(UI).toMatch(/\n\s+imageThumbnailEngine,\n\s+imageH2Engine,\n/);
  });
  it('핸들러는 payload 값을 변환 없이 dispatcher 첫 인자로 넘긴다', () => {
    expect(HANDLER).toMatch(/const thumbEngine = \(payload\.imageThumbnailEngine \|\| 'nanobanana2'\)\.toLowerCase\(\);/);
    expect(HANDLER).toMatch(/const h2Engine = \(payload\.imageH2Engine \|\| 'nanobanana2'\)\.toLowerCase\(\);/);
    expect(HANDLER).toMatch(/dispatchThumbnailGeneration\(\s*thumbEngine,/);
    expect(HANDLER).toMatch(/dispatchH2ImageGeneration\(\s*h2Engine,/);
    expect((HANDLER.match(/thumbEngine\s*=/g) || []).length).toBe(1);
    expect((HANDLER.match(/h2Engine\s*=/g) || []).length).toBe(1);
  });
});

describe('E.2 거미줄 탭 이미지 엔진 저장·복원 (값 변환 없이 저장, 복원은 option 이 있을 때만)', () => {
  type Opt = { value: string; disabled?: boolean };
  const makeEnv = (stored: Record<string, string>) => {
    const listeners: Record<string, Array<(e: any) => void>> = {};
    const mk = (id: string, options: Opt[]) => ({
      id, options, value: 'nanobanana2',
      addEventListener: (type: string, fn: (e: any) => void) => { (listeners[id + ':' + type] ||= []).push(fn); },
    });
    const selects: Record<string, any> = {
      swThumbnailEngine: mk('swThumbnailEngine', [{ value: 'codex-image' }, { value: 'nanobanana2' }, { value: 'gptimage2' }, { value: 'locked', disabled: true }]),
      swH2ImageEngine: mk('swH2ImageEngine', [{ value: 'codex-image' }, { value: 'nanobanana2' }, { value: 'gptimage2' }]),
    };
    const store = { ...stored };
    const localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    };
    const document = { getElementById: (id: string) => selects[id] || null };
    const cardCalls: number[] = [];
    const win = { _spiderWebUpdateEngineCards: () => { cardCalls.push(1); } };
    const names = ['_swRememberImageEngine', '_swRestoreImageEngine', '_swInitImageEngineMemory'];
    const consts = (UI.match(/const SW_THUMB_ENGINE_KEY = [^;]+;/) || [''])[0] + '\n' + (UI.match(/const SW_H2_ENGINE_KEY = [^;]+;/) || [''])[0];
    // braceBlock returns the whole "function name(...) { ... }" text starting at the marker
    const fns = names.map((n) => braceBlock(UI, `function ${n}`));
    // eslint-disable-next-line no-new-func
    const api = new Function('localStorage', 'document', 'window', `${consts}\n${fns.join('\n')}\nreturn { ${names.join(', ')}, SW_THUMB_ENGINE_KEY, SW_H2_ENGINE_KEY };`)(localStorage, document, win);
    return { api, store, selects, listeners, cardCalls };
  };

  it('저장값이 있고 그 항목이 있으면 되돌린다 (두 칸 따로)', () => {
    const env = makeEnv({ leadernamSpiderThumbnailEngine: 'gptimage2', leadernamSpiderH2ImageEngine: 'codex-image' });
    env.api._swInitImageEngineMemory();
    expect(env.selects.swThumbnailEngine.value).toBe('gptimage2');
    expect(env.selects.swH2ImageEngine.value).toBe('codex-image');
    expect(env.cardCalls.length).toBeGreaterThan(0);
  });
  it('저장값이 없거나, 항목이 사라졌거나, 잠긴 항목이면 건드리지 않는다', () => {
    const none = makeEnv({});
    none.api._swInitImageEngineMemory();
    expect(none.selects.swThumbnailEngine.value).toBe('nanobanana2');
    const gone = makeEnv({ leadernamSpiderThumbnailEngine: 'removed-engine', leadernamSpiderH2ImageEngine: 'removed-engine' });
    gone.api._swInitImageEngineMemory();
    expect(gone.selects.swThumbnailEngine.value).toBe('nanobanana2');
    const locked = makeEnv({ leadernamSpiderThumbnailEngine: 'locked' });
    locked.api._swInitImageEngineMemory();
    expect(locked.selects.swThumbnailEngine.value).toBe('nanobanana2');
  });
  it('바꾸면 값 그대로 저장한다 (변환 없음, 빈 값은 저장 안 함)', () => {
    const env = makeEnv({});
    env.api._swInitImageEngineMemory();
    const fire = env.listeners['swThumbnailEngine:change'][0];
    fire({ target: { value: 'codex-image' } });
    expect(env.store.leadernamSpiderThumbnailEngine).toBe('codex-image');
    fire({ target: { value: '' } });
    expect(env.store.leadernamSpiderThumbnailEngine).toBe('codex-image');
    env.listeners['swH2ImageEngine:change'][0]({ target: { value: 'gptimage2' } });
    expect(env.store.leadernamSpiderH2ImageEngine).toBe('gptimage2');
  });
  it('저장 공간이 막혀 있어도 죽지 않는다', () => {
    const env = makeEnv({});
    expect(() => env.api._swRememberImageEngine('k', 'v')).not.toThrow();
  });
  it('모듈 초기화(initModule)가 복원을 부른다 — 글포스팅 키와 섞이지 않는다', () => {
    expect(braceBlock(UI, 'function initModule')).toMatch(/_swInitImageEngineMemory\(\)/);
    expect(UI).toMatch(/const SW_THUMB_ENGINE_KEY = 'leadernamSpiderThumbnailEngine';/);
    expect(UI).toMatch(/const SW_H2_ENGINE_KEY = 'leadernamSpiderH2ImageEngine';/);
  });
});

describe('E.3 핸들러 배선 — 이미지 단계 뒤, 태그/메타 단계 앞에서 warnings 로', () => {
  it('오류 문구를 가린 뒤 경고를 spiderWarnings 에 넣는다', () => {
    const sanitize = HANDLER.indexOf('spider.sanitizeSpiderImageErrors(');
    const warn = HANDLER.indexOf('spider.buildSpiderImageWarnings(');
    expect(sanitize).toBeGreaterThan(0);
    expect(warn).toBeGreaterThan(sanitize);
    expect(warn).toBeGreaterThan(HANDLER.indexOf('이미지 정책 = none, 이미지 생성 스킵'));
    expect(warn).toBeLessThan(HANDLER.indexOf("spiderStage = 'meta'"));
    // between building the warnings and the next stage
    expect(blockBetween(HANDLER, 'spider.buildSpiderImageWarnings(', "spiderStage = 'meta'")).toMatch(/spiderWarnings\.push\(/);
  });
  it('이미지 부족은 실패 응답이 아니라 경고다 (성공 응답은 여전히 한 곳)', () => {
    expect((HANDLER.match(/success:\s*true/g) || []).length).toBe(1);
  });
});

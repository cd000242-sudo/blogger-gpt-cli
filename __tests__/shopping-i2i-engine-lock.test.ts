/**
 * 쇼핑모드는 i2i 되는 엔진만 (v3.8.411)
 *
 * 사용자 실측(2026-08-02) — 발행 로그 그대로:
 *   🎯 이미지 소스: nanobanana2 (원본: nanobanana2)
 *   [IMG-1~8] ⚠️ Nano Banana 2 실패: BILLING_REQUIRED
 *   💳 소제목 이미지 8장이 같은 상품 사진으로 채워졌습니다
 *   📊 nanobanana2: 2/19 (11%) · gptimage2: 16/16 (100%)
 *
 * 사용자 지시:
 *   "무조건 나노바나나2로 돌리지 말고 이미지2이미지가 되는 엔진만 사용 가능하게 하고
 *    나머지는 쇼핑모드에서 사용 못하게 비활성화하면 되잖아"
 *   "다른 모드에서도 활성화되면 절대 안 돼"
 *
 * 배운 것: **키가 있다 ≠ 쓸 수 있다.**
 *   nanobanana2 는 키가 멀쩡히 있는데 빌링이 없어 8번 연속 실패했다.
 *   키만 보고 고르면 같은 실패를 반복한다. 오늘 실제로 성공한 기록을 봐야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const uiHtml = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');

jest.mock('../src/core/engine-stats', () => ({
  getSuccessRate: (engine: string) => {
    // 사용자 로그의 실제 수치
    const table: Record<string, number> = { nanobanana2: 11, gptimage2: 100, gptimage1: 100 };
    return engine in table ? table[engine]! : null;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pickI2iEngine, engineSupportsI2i } = require('../src/core/imageDispatcher');

const BOTH_KEYS = { GEMINI_API_KEY: 'x'.repeat(40), OPENAI_API_KEY: 'y'.repeat(50) };

describe('바꿔야 할 때는 오늘 성공한 엔진을 고른다', () => {
  it('⭐ 무조건 나노바나나2로 가지 않는다 — 11% 짜리를 100% 보다 앞세우지 않는다', () => {
    const r = pickI2iEngine('imagefx', BOTH_KEYS);
    expect(r.switched).toBe(true);
    expect(r.engine).toBe('gptimage2');          // 예전엔 nanobanana2 였다
  });

  it('⭐ 사용자가 고른 엔진이 쓸 수 있으면 통계와 무관하게 그대로 둔다', () => {
    // 성공률이 낮아도 사용자의 선택이다 — 멋대로 바꾸면 그게 더 나쁘다
    expect(pickI2iEngine('nanobanana2', BOTH_KEYS)).toMatchObject({ engine: 'nanobanana2', switched: false });
    expect(pickI2iEngine('gptimage2', BOTH_KEYS)).toMatchObject({ engine: 'gptimage2', switched: false });
  });

  it('왜 바꿨는지 이유를 준다', () => {
    expect(pickI2iEngine('flow', BOTH_KEYS).reason).toContain('상품 사진을 참고할 수 없습니다');
  });

  it('⭐ 바꾼 엔진은 반드시 i2i 가능한 것이다', () => {
    ['imagefx', 'flow', 'crawled', 'custom'].forEach((e) => {
      expect(engineSupportsI2i(pickI2iEngine(e, BOTH_KEYS).engine)).toBe(true);
    });
  });

  it('통계를 못 읽어도 선택은 계속된다 (통계가 발행을 막지 않는다)', () => {
    jest.isolateModules(() => {
      jest.doMock('../src/core/engine-stats', () => { throw new Error('읽기 실패'); });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pickI2iEngine: pick } = require('../src/core/imageDispatcher');
      const r = pick('imagefx', BOTH_KEYS);
      expect(r.switched).toBe(true);
      expect(engineSupportsI2i(r.engine)).toBe(true);
    });
  });
});

describe('UI — 쇼핑모드에서만 i2i 불가 엔진을 잠근다', () => {
  it('⭐ i2i 불가 엔진에 자물쇠를 건다', () => {
    expect(uiHtml).toContain("opt.dataset.i2iBlocked = '1'");
    expect(uiHtml).toContain('상품 사진을 참고할 수 없어 쇼핑모드에서 쓸 수 없습니다');
  });

  it('⭐ 다른 모드로 나가면 반드시 푼다 — 잠금이 새어나가면 안 된다', () => {
    expect(uiHtml).toContain("} else if (opt.dataset.i2iBlocked === '1') {");
    expect(uiHtml).toContain('opt.disabled = false;');
    expect(uiHtml).toContain('delete opt.dataset.i2iBlocked;');
  });

  it('⭐ 우리가 잠근 것만 푼다 — 구분선을 풀면 구분선이 선택지가 된다', () => {
    // <option disabled> 구분선이 여러 개 있다. 전부 풀면 그게 골라진다.
    expect(uiHtml).toContain("if (!opt.value) return;");
    expect(uiHtml).toMatch(/구분선은 건드리지 않는다/);
  });

  it('⭐ 이미 고른 엔진이 막혔으면 쓸 수 있는 것으로 옮겨준다', () => {
    expect(uiHtml).toContain("h2.selectedOptions[0]?.dataset?.i2iBlocked === '1'");
  });

  it("'상품 사진 그대로' 전략의 crawled 는 남긴다", () => {
    expect(uiHtml).toContain("opt.value === 'crawled'");
  });

  it('⭐ UI 판정이 백엔드 판정과 같은 목록이다', () => {
    // 두 곳이 어긋나면 UI 에선 고를 수 있는데 백엔드가 몰래 바꾸는 상태가 된다
    const uiList = uiHtml.match(/const I2I_OK = \/\^\(([^)]+)\)/)?.[1];
    expect(uiList).toBeTruthy();
    uiList!.split('|').forEach((engine) => {
      expect(engineSupportsI2i(engine)).toBe(true);
    });
  });

  it('쇼핑모드가 아닐 때는 잠그지 않는다', () => {
    expect(uiHtml).toContain('if (isShopping) {');
  });
});

/**
 * 고른 엔진이 앱을 껐다 켜도 남아 있어야 한다 (v3.8.411)
 *
 * 사용자 보고: "지피티 이미지 2로 선택했는데 또 나노바나나2로 폴백됐어"
 *
 * 폴백이 아니었다 — **저장이 없었다.**
 * 실측 로그: 15:40:33 앱 초기화 → 15:41:19 발행 → "원본: nanobanana2".
 * 이 select 는 어디에도 저장되지 않아서 재시작하면
 * HTML 기본값 <option value="nanobanana2" selected> 로 조용히 돌아갔다.
 *
 * 소스 문자열이 아니라 **실제 함수를 재시작 상황에 돌려서** 검증한다.
 */
describe('소제목 이미지 엔진 선택이 재시작을 버틴다', () => {
  const scriptSrc = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'script.js'), 'utf8');

  const build = (options: Array<{ value: string; disabled?: boolean }>, current: string) => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    };
    const sel = { options, value: current };
    const doc = { getElementById: (id: string) => (id === 'h2ImageSource' ? sel : null) };
    const code = `const H2_ENGINE_KEY='leadernamH2ImageSource';
${braceBlock(scriptSrc, 'function rememberH2ImageSource')}
${braceBlock(scriptSrc, 'function restoreH2ImageSource')}`;
    // eslint-disable-next-line no-new-func
    const api = new Function('document', 'localStorage', 'console', 'handleH2ImageSourceChange',
      `${code}; return { remember: rememberH2ImageSource, restore: restoreH2ImageSource };`)(
      doc, storage, { log() {} }, undefined);
    return { api, sel, store };
  };

  const ALL = ['nanobanana', 'nanobanana2', 'gptimage1', 'gptimage2', 'prodia', 'crawled']
    .map((value) => ({ value, disabled: false }));

  it('⭐ 실측 재현 — 재시작 후에도 고른 엔진이 남는다', () => {
    const { api, sel } = build(ALL, 'nanobanana2');
    api.remember('gptimage2');
    sel.value = 'nanobanana2';            // 앱 재시작 → HTML 기본값으로 리셋
    api.restore();
    expect(sel.value).toBe('gptimage2');
  });

  it('저장된 적이 없으면 기본값을 건드리지 않는다', () => {
    const { api, sel } = build(ALL, 'nanobanana2');
    api.restore();
    expect(sel.value).toBe('nanobanana2');
  });

  it('⭐ 저장된 항목이 사라졌으면 복원하지 않는다', () => {
    const { api, sel } = build(ALL, 'nanobanana2');
    api.remember('gptimage2');
    sel.options = ALL.filter((o) => o.value !== 'gptimage2');
    api.restore();
    expect(sel.value).toBe('nanobanana2');
  });

  it('⭐ 잠긴 항목이면 복원하지 않는다 — 쇼핑모드 잠금을 뚫으면 안 된다', () => {
    const { api, sel } = build(ALL, 'nanobanana2');
    api.remember('gptimage2');
    sel.options = ALL.map((o) => (o.value === 'gptimage2' ? { ...o, disabled: true } : o));
    api.restore();
    expect(sel.value).toBe('nanobanana2');
  });

  it('빈 값은 저장하지 않는다', () => {
    const { api, store } = build(ALL, 'nanobanana2');
    api.remember('');
    expect(store['leadernamH2ImageSource']).toBeUndefined();
  });

  it('시작할 때 복원이 실제로 불린다', () => {
    const main = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'main.js'), 'utf8');
    expect(main).toContain('window.restoreH2ImageSource()');
  });

  it('바꿀 때마다 저장한다', () => {
    expect(scriptSrc).toContain('rememberH2ImageSource(selectedSource)');
  });
});

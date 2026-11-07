/**
 * v3.8.767 — 새 설치 기본값(글 = 에이전트 모드 Claude Code)과 API 모델 최신화 (사장님 결정 2026-11-07).
 *
 * 모델/단가 (공식, 2026-11-07):
 *   gpt-6.1-terra $1/$5 · gpt-6.1-sol $2/$10 · gpt-6-luna $0.10/$0.50 · gpt-6-astra $10/$50 (유지)
 *   gemini-3.8-flash $0.75/$3.75 (2027-01-01 부터 $1.50/$7.50) · gemini-4-argon $2/$10 (12/1 부터 $4/$20)
 *   gemini-3.5-flash 는 10/8 폐기.
 * `value` 키(openai-gpt41 등)는 사용자 저장 설정 키라 그대로 두고 modelId·표시·단가만 바뀐다.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { findTier, DEFAULT_TIER_VALUE, tierCostKrw, resolveDefaultTierValue } from '../src/core/llm/pricing';
import { VISION_MODELS, routeTextToVision } from '../src/core/url-image-crawler/visionRouter';

const root = path.join(__dirname, '..');
const read = (...parts: string[]): string => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('OpenAI 티어 — 키는 그대로, 모델·단가만 GPT-6 계열로', () => {
  test.each([
    ['openai-gpt41', 'gpt-6.1-terra', 1, 5, 'GPT-6.1 Terra'],
    ['openai-gpt4o', 'gpt-6.1-sol', 2, 10, 'GPT-6.1 Sol'],
    ['openai-gpt4o-mini', 'gpt-6-luna', 0.1, 0.5, 'GPT-6 Luna'],
    ['openai-gpt6-astra', 'gpt-6-astra', 10, 50, 'GPT-6 Astra'],
  ])('%s → %s (입력 $%s / 출력 $%s)', (value, modelId, input, output, title) => {
    const tier = findTier(value);
    expect(tier?.modelId).toBe(modelId);
    expect(tier?.title).toBe(title);
    expect(tier?.usdPer1M?.input).toBe(input);
    expect(tier?.usdPer1M?.output).toBe(output);
  });

  test('화면 금액은 단가에서 계산한 값과 같다(선언값이 어긋나면 안 된다)', () => {
    for (const value of ['openai-gpt41', 'openai-gpt4o', 'openai-gpt4o-mini', 'gemini-2.5-flash', 'gemini-2.5-pro']) {
      const tier = findTier(value)!;
      expect(tier.costKrw).toBe(tierCostKrw(tier));
    }
  });

  test('옛 GPT-5.6 이름으로 저장돼 있어도 같은 티어로 읽힌다(fallback 에 남김)', () => {
    expect(findTier('gpt-5.6-terra')?.modelId).toBe('gpt-6.1-terra');
  });
});

describe('Gemini 티어 — 3.8 Flash 가 기본, 최상위 칸은 4 Argon, 3.5 는 폐기', () => {
  test('3.8 Flash 단가 $0.75/$3.75', () => {
    const tier = findTier('gemini-2.5-flash')!;
    expect(tier.modelId).toBe('gemini-3.8-flash');
    expect(tier.usdPer1M).toMatchObject({ input: 0.75, output: 3.75 });
    expect(tier.default).toBe(true);
  });

  test('최상위 칸(저장 키 gemini-2.5-pro) = Gemini 4 Argon $2/$10 · 비용 큼 표시', () => {
    const tier = findTier('gemini-2.5-pro')!;
    expect(tier.modelId).toBe('gemini-4-argon');
    expect(tier.title).toBe('Gemini 4 Argon');
    expect(tier.usdPer1M).toMatchObject({ input: 2, output: 10 });
    expect(tier.description).toMatch(/비용 큼/);
    expect(tier.costKrw).toBeGreaterThan(findTier('gemini-2.5-flash')!.costKrw);
  });

  test('폐기된 3.5 Flash 는 더 이상 최상위(Argon) 로 가지 않고 3.8 Flash 가 받는다', () => {
    expect(findTier('gemini-3.5-flash')?.modelId).toBe('gemini-3.8-flash');
    expect(findTier('gemini-3.6-flash')?.modelId).toBe('gemini-3.8-flash');
  });

  test('기본 티어 값', () => {
    expect(DEFAULT_TIER_VALUE).toBe('gemini-3.8-flash');
    const before = process.env['AI_PROVIDER'];
    process.env['AI_PROVIDER'] = 'gemini';
    try {
      expect(findTier(resolveDefaultTierValue())?.modelId).toBe('gemini-3.8-flash');
    } finally {
      if (before === undefined) delete process.env['AI_PROVIDER']; else process.env['AI_PROVIDER'] = before;
    }
  });
});

describe('그 밖의 기본 모델 자리', () => {
  test('제공자별 대표 모델 표(orchestration · engine-selection)에 폐기된 3.5 가 없다', () => {
    expect(read('src', 'core', 'final', 'orchestration.ts')).toMatch(/gemini: 'gemini-3\.8-flash'/);
    expect(read('src', 'core', 'final', 'engine-selection.ts')).toMatch(/gemini: 'gemini-3\.8-flash'/);
  });

  test('gemini-engine 체인에서 폐기된 3.5 를 뺐다', () => {
    const src = read('src', 'core', 'final', 'gemini-engine.ts');
    expect(src).not.toMatch(/'gemini-3\.5-flash'/);
    expect(src).toMatch(/GEMINI_BASE_MODELS\[0\] \|\| 'gemini-3\.8-flash'/);
  });

  test('키 점검 모델', () => {
    const src = read('src', 'core', 'api-key-checker.ts');
    expect(src).not.toMatch(/gemini-3\.5-flash/);
    expect(src).toMatch(/model: 'gemini-3\.8-flash'/);
    expect(src).toMatch(/model: 'gpt-6\.1-terra'/);
  });

  test('llm-caller OpenAI 모델 순서와 빠른 형제 모델', () => {
    const src = read('src', 'core', 'llm', 'llm-caller.ts');
    expect(src).toMatch(/models: \['gpt-6\.1-terra', 'gpt-6-luna', 'gpt-6\.1-sol'\]/);
    expect(src).toMatch(/'gpt-6\.1-terra': 'gpt-6-luna'/);
  });

  test('비전 라우팅', () => {
    expect(VISION_MODELS.GEMINI_FLASH).toBe('gemini-3.8-flash');
    expect(VISION_MODELS.GEMINI_PRO).not.toBe('gemini-3.5-flash');
    expect(VISION_MODELS.OPENAI_41).toBe('gpt-6.1-terra');
    expect(VISION_MODELS.OPENAI_41_MINI).toBe('gpt-6-luna');
    expect(routeTextToVision('gpt-6.1-sol').model).toBe('gpt-6.1-terra');
    expect(routeTextToVision('gpt-6-luna').model).toBe('gpt-6-luna');
    expect(routeTextToVision('gemini-3.8-flash').model).toBe('gemini-3.8-flash');
  });

  test('main.ts 의 Gemini 모델 목록 · 기본 textGenerator 에 3.5 가 없다', () => {
    const src = read('electron', 'main.ts');
    expect(src).not.toMatch(/'gemini-3\.5-flash'/);
  });
});

describe('설정 화면(index.html · script.js) 라벨과 금액', () => {
  const html = read('electron', 'ui', 'index.html');
  const script = read('electron', 'ui', 'script.js');

  test.each([
    ['GPT-6 Luna', 'data-cost="4"', '~₩4/글'],
    ['GPT-6.1 Terra', 'data-cost="38"', '~₩38/글'],
    ['GPT-6.1 Sol', 'data-cost="76"', '~₩76/글'],
    ['Gemini 3.8 Flash', 'data-cost="29"', '~₩29/글'],
    ['Gemini 4 Argon', 'data-cost="76"', '~₩76/글'],
  ])('%s 카드', (label, cost, perPost) => {
    expect(html).toContain(label);
    expect(html).toContain(cost);
    expect(html).toContain(perPost);
  });

  test('폐기·옛 이름 카드는 없다', () => {
    expect(html).not.toMatch(/GPT-5\.6 (Luna|Terra|Sol)<\/span>/);
    expect(html).not.toContain('2026-11-21까지 프로모션가');
    expect(html).not.toMatch(/<span[^>]*>🧠 Gemini 3\.5 Flash<\/span>/);
  });

  test('상단 배지 표(script.js)가 새 이름을 쓴다', () => {
    expect(script).toMatch(/'openai-gpt41': \{ label: 'OpenAI GPT-6\.1 Terra'/);
    expect(script).toMatch(/'openai-gpt4o': \{ label: 'OpenAI GPT-6\.1 Sol'/);
    expect(script).toMatch(/'openai-gpt4o-mini': \{ label: 'OpenAI GPT-6 Luna'/);
    expect(script).toMatch(/'gemini-2\.5-pro': \{ label: 'Gemini 4 Argon'/);
    expect(script).toMatch(/'gemini-4-argon': \{ label: 'Gemini 4 Argon'/);
    expect(script).toMatch(/'gpt-6\.1-terra': \{ label: 'OpenAI GPT-6\.1 Terra'/);
  });
});

describe('새 설치 기본 = 에이전트 + Claude (저장값은 유지)', () => {
  const source = read('electron', 'ui', 'modules', 'execution-defaults.js');

  function run(initial: Record<string, string>): Record<string, string> {
    const store: Record<string, string> = { ...initial };
    const localStorage = {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => { store[key] = String(value); },
    };
    const sandbox: Record<string, unknown> = { localStorage, window: {} };
    vm.runInNewContext(source, sandbox);
    return store;
  }

  test('아무것도 저장돼 있지 않으면 에이전트 + Claude 를 심는다(리더 코드가 읽는 JSON 형식)', () => {
    const store = run({});
    expect(JSON.parse(store['leadernamExecutionMode'] as string)).toBe('agent');
    expect(JSON.parse(store['leadernamActiveAgentProvider'] as string)).toBe('claude');
  });

  test('이미 API 모드로 저장한 사용자는 그대로', () => {
    const store = run({ leadernamExecutionMode: '"api"' });
    expect(store['leadernamExecutionMode']).toBe('"api"');
  });

  test('이미 Codex 로 저장한 사용자는 그대로 — 모드만 비어 있어도 제공자는 건드리지 않는다', () => {
    const store = run({ leadernamExecutionMode: '"agent"', leadernamActiveAgentProvider: '"codex"' });
    expect(store['leadernamActiveAgentProvider']).toBe('"codex"');
    const onlyProvider = run({ leadernamActiveAgentProvider: '"gemini"' });
    expect(onlyProvider['leadernamActiveAgentProvider']).toBe('"gemini"');
  });

  test('index.html 이 이 파일을 다른 스크립트보다 먼저(head) 불러온다', () => {
    const html = read('electron', 'ui', 'index.html');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain('./modules/execution-defaults.js');
  });
});

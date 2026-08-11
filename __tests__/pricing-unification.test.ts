/**
 * 금액 단일 출처 + 반자동 발행 회귀 테스트 (v3.8.392)
 *
 * ── 사고 1: 금액이 세 곳에서 전부 달랐다 (2026-07-31 실측) ──
 *   Gemini 3.5 Flash    pricing.ts costKrw=80 / index.html data-cost=20 / 화면 라벨 "~₩20/글"
 *   Gemini Flash-Lite   costKrw=15 / data-cost=15 / 화면 라벨 "~₩12/글"
 *   근본 원인: 토큰 단가가 없어 **어느 숫자도 검증할 수 없었다.**
 *   화면이 자기 숫자를 하드코딩해 들고 있으니 백엔드를 고쳐도 따라오지 않았다.
 *
 * ── 사고 2: 반자동 발행 버튼이 처음 화면에서 안 보였다 ──
 *   v3.8.334  veRefreshEntryButton 도입 — 그때는 "생성된 글 편집" 진입점이라
 *             글이 없으면 숨기는 게 맞았다.
 *   v3.8.357  "반자동 발행 (편집 후 발행)" 시작 버튼으로 재설계 — 숨김 로직은 그대로.
 *   → 글을 아직 안 만든 정상 시작 상태에서 5일간 접근 불가였다.
 *     startSemiAutoPublish 는 기존 글이 없으면 키워드로 새로 생성하는 정상 진입점이다.
 */
import {
  TIER_MODELS, COST_MODEL, deriveCostKrw, tierCostKrw, formatTierCost, getPricingTable, findTier,
  DEFAULT_TIER_VALUE,
} from '../src/core/llm/pricing';
import { braceBlock } from './helpers/source-block';

describe('금액 계산 — 검증 가능한 산식', () => {
  it('토큰 단가로 계산한다 (입력 15K + 출력 1.2K, 재시도 1.3배, ₩1,400)', () => {
    // GPT-5.6 Luna 인하가 (0.015×0.2 + 0.0012×1.2) × 1.3 × 1400 = ₩8
    expect(deriveCostKrw({ input: 0.20, output: 1.20, source: 'test' }, 999)).toBe(8);
  });

  it('단가를 모르면 선언값을 그대로 쓴다 — 모르는 숫자를 지어내지 않는다', () => {
    expect(deriveCostKrw(undefined, 42)).toBe(42);
  });

  it('산식 상수가 문서화돼 있다', () => {
    expect(COST_MODEL.inputTokens).toBe(15_000);
    expect(COST_MODEL.outputTokens).toBe(1_200);
    expect(COST_MODEL.retryFactor).toBe(1.3);
    expect(COST_MODEL.usdToKrw).toBe(1_400);
  });
});

describe('GPT-5.6 가격 인하 반영 (2026-07-30)', () => {
  const byTitle = (t: string) => TIER_MODELS.find(m => m.title === t)!;

  it('Luna — 입력 $1→$0.20, 출력 $6→$1.20 (80% 인하)', () => {
    const luna = byTitle('GPT-5.6 Luna');
    expect(luna.usdPer1M).toEqual(expect.objectContaining({ input: 0.20, output: 1.20 }));
    expect(tierCostKrw(luna)).toBe(8);
  });

  it('Terra — 입력 $2.5→$2, 출력 $15→$12 (20% 인하)', () => {
    const terra = byTitle('GPT-5.6 Terra');
    expect(terra.usdPer1M).toEqual(expect.objectContaining({ input: 2, output: 12 }));
    expect(tierCostKrw(terra)).toBe(81);
  });

  it('Sol — 인하 대상 아님 ($5/$30 유지)', () => {
    const sol = byTitle('GPT-5.6 Sol');
    expect(sol.usdPer1M).toEqual(expect.objectContaining({ input: 5, output: 30 }));
  });

  it('Luna 가 Terra 보다 싸다 — 인하 후에도 티어 순서가 유지된다', () => {
    expect(tierCostKrw(byTitle('GPT-5.6 Luna'))).toBeLessThan(tierCostKrw(byTitle('GPT-5.6 Terra')));
    expect(tierCostKrw(byTitle('GPT-5.6 Terra'))).toBeLessThan(tierCostKrw(byTitle('GPT-5.6 Sol')));
  });

  it('단가에는 출처가 반드시 붙는다 — 근거 없는 숫자를 막는다', () => {
    TIER_MODELS.filter(t => t.usdPer1M).forEach((t) => {
      expect(String(t.usdPer1M!.source).length).toBeGreaterThan(10);
    });
  });

  it('선언 costKrw 와 계산값이 어긋나지 않는다 — 단가를 아는 모델 한정', () => {
    TIER_MODELS.filter(t => t.usdPer1M).forEach((t) => {
      expect(t.costKrw).toBe(tierCostKrw(t));
    });
  });
});

describe('표시 문자열 — 화면마다 포맷이 갈리지 않게 한 곳에서 만든다', () => {
  it('금액 라벨 형식이 일정하다', () => {
    TIER_MODELS.forEach(t => expect(formatTierCost(t)).toMatch(/^~₩[\d,]+\/글$/));
  });

  it('네 자리 이상이면 천 단위 구분자를 넣는다', () => {
    // 현재 최고가(Fable 5 = ₩735)는 세 자리라 구분자가 없다.
    // 단가가 오르거나 산식이 바뀌어 네 자리가 됐을 때를 위한 포맷 검증.
    // exactOptionalPropertyTypes — usdPer1M 은 undefined 대입이 아니라 키 자체를 뺀다
    const { usdPer1M, ...base } = TIER_MODELS.find(t => t.title === 'Claude Fable 5')!;
    void usdPer1M;
    expect(formatTierCost({ ...base, costKrw: 1234 })).toBe('~₩1,234/글');
  });
});

describe('렌더러로 넘기는 금액표', () => {
  const table = getPricingTable();

  it('모든 티어를 담는다', () => {
    expect(table).toHaveLength(TIER_MODELS.length);
  });

  it('화면이 쓸 값이 전부 들어있다 — UI 가 자기 숫자를 만들 필요가 없다', () => {
    table.forEach((row) => {
      expect(row.value).toBeTruthy();
      expect(row.title).toBeTruthy();
      expect(typeof row.costKrw).toBe('number');
      expect(row.costLabel).toMatch(/₩/);
      expect(row.priceSource).toBeTruthy();
      expect(typeof row.derived).toBe('boolean');
    });
  });

  it('계산값인지 선언값인지 구분해 알려준다', () => {
    expect(table.find(r => r.title === 'GPT-5.6 Luna')?.derived).toBe(true);
    // v3.8.483: Gemini 도 공식 단가를 넣어 이제 계산값이다.
    //   단가를 아직 모르는 모델(Claude 등)만 선언값으로 남는다.
    expect(table.find(r => r.title === 'Gemini 3.6 Flash')?.derived).toBe(true);
    expect(table.find(r => r.title === 'Claude Sonnet 5')?.derived).toBe(false);
  });

  it('findTier 가 UI value 와 modelId 양쪽으로 찾는다', () => {
    expect(findTier('openai-gpt4o-mini')?.title).toBe('GPT-5.6 Luna');
    expect(findTier('gpt-5.6-luna')?.title).toBe('GPT-5.6 Luna');
  });
});

describe('배선 — 화면이 백엔드 값을 읽는다', () => {
  const read = (...p: string[]) =>
    require('fs').readFileSync(require('path').join(__dirname, '..', ...p), 'utf8');

  it('IPC 로 금액표를 내려준다', () => {
    expect(read('electron', 'main.ts')).toContain("ipcMain.handle('pricing:table'");
  });

  it('동기화 모듈이 카드 라벨과 data-cost 를 함께 덮어쓴다', () => {
    const sync = read('electron', 'ui', 'modules', 'pricing-sync.js');
    expect(sync).toContain("card.setAttribute('data-cost'");
    expect(sync).toContain('costEl.textContent = tier.costLabel');
  });

  it('상단 현재 배지도 같은 값으로 맞춘다', () => {
    expect(read('electron', 'ui', 'modules', 'pricing-sync.js')).toContain('textEngineCurrent');
  });

  it('동기화 실패가 화면을 망가뜨리지 않는다', () => {
    const sync = read('electron', 'ui', 'modules', 'pricing-sync.js');
    expect(sync).toContain('try {');
    expect(sync).toContain('catch');
    expect(sync).toContain('화면 기존 값 유지');
  });

  it('시작 시 동기화를 건다', () => {
    expect(read('electron', 'ui', 'modules', 'main.js')).toContain('initPricingSync');
  });
});

describe('반자동 발행 버튼 회귀 (v3.8.357~391 동안 안 보였다)', () => {
  const main = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'electron', 'ui', 'modules', 'main.js'), 'utf8');

  it('생성된 글이 없어도 버튼을 숨기지 않는다', () => {
    const i = main.indexOf('window.veRefreshEntryButton');
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(main, 'window.veRefreshEntryButton');
    expect(block).toContain("btn.style.display = 'inline-flex'");
    expect(block).not.toMatch(/display\s*=\s*has\s*\?/);
  });

  it('상태에 따라 라벨만 바꾼다', () => {
    const i = main.indexOf('window.veRefreshEntryButton');
    const block = braceBlock(main, 'window.veRefreshEntryButton');
    expect(block).toContain('반자동 발행 (편집 후 발행)');
    expect(block).toContain('생성된 글 편집하러 가기');
  });

  it('index.html 에 버튼이 살아있다', () => {
    const html = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'electron', 'ui', 'index.html'), 'utf8');
    expect(html).toContain('id="editGeneratedBtn"');
    expect(html).toContain('window.startSemiAutoPublish');
  });
});

/**
 * v3.8.483 — 기본 티어가 `default: true` 항목을 정확히 가리키는지.
 *
 * DEFAULT_TIER_VALUE 는 findTier 가 **modelId 로도** 찾는다. 3.6 도입으로
 * 'gemini-3.5-flash' 가 프리미엄 항목의 modelId 가 되면서, 상수를 안 바꾸면
 * 기본값이 균형이 아니라 프리미엄을 가리키게 됐다 — 기본 모델이 조용히 바뀌는 사고다.
 */
describe('기본 티어 정합성', () => {
  it('DEFAULT_TIER_VALUE 가 default:true 인 항목을 가리킨다', () => {
    const declaredDefault = TIER_MODELS.find(t => t.default === true);
    expect(declaredDefault).toBeDefined();
    expect(findTier(DEFAULT_TIER_VALUE)?.value).toBe(declaredDefault!.value);
  });

  it('default:true 는 하나뿐이다', () => {
    expect(TIER_MODELS.filter(t => t.default === true)).toHaveLength(1);
  });
});

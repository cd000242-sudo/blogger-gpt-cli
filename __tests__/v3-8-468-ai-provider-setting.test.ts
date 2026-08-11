/**
 * v3.8.468 — `.env` 의 AI_PROVIDER 설정이 무시되던 문제
 *
 * v3.8.446 이 "payload 에 모델이 없으면 설정값을 쓴다" 는 안전망을 넣었는데,
 * 그 설정값을 `process.env.AI_PROVIDER` 에서만 읽었다.
 * 그런데 앱 어디에서도 그 환경변수를 세우지 않는다 — 전수 확인했다.
 * 결과: 사용자가 .env 에 `AI_PROVIDER=openai` 를 넣어 두어도 기본값이 늘
 * `gemini-3.5-flash` 였다. **안전망이 있는데 작동하지 않는 상태였다.**
 *
 * 실측(2026-08-06, 유사도 측정 스크립트를 돌리다 발견):
 *   .env 의 AI_PROVIDER = openai
 *   resolveDefaultProvider() → gemini      ← 설정 무시
 *
 * 사용자는 이전에도 같은 종류의 사고를 겪었다 — "왜자꾸 기준을 제미나이로
 * 잡는지 모르겠네", "제미나이를 누가 마음대로 테스트하라고 했냐".
 * 쓰지 않는 제공자로 요청이 나가면 비용과 신뢰 양쪽이 깨진다.
 */
import * as fs from 'fs';
import * as path from 'path';

const pricingSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/llm/pricing.ts'),
  'utf-8',
);

/** 설정 파일을 흉내 낸 상태로 pricing 모듈을 새로 읽는다 */
function loadPricingWith(envFileValue: string | null) {
  jest.resetModules();
  jest.doMock('../src/env', () => ({
    loadEnvFromFile: () => (envFileValue === null ? {} : { AI_PROVIDER: envFileValue }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../src/core/llm/pricing');
}

describe('① 설정 파일의 제공자가 실제로 반영된다', () => {
  const original = process.env['AI_PROVIDER'];

  beforeEach(() => { delete process.env['AI_PROVIDER']; });
  afterEach(() => {
    if (original === undefined) delete process.env['AI_PROVIDER'];
    else process.env['AI_PROVIDER'] = original;
    jest.dontMock('../src/env');
    jest.resetModules();
  });

  it('⭐⭐ .env 에 openai 면 기본 제공자가 openai 다 (예전엔 gemini 였다)', () => {
    const pricing = loadPricingWith('openai');
    expect(pricing.resolveDefaultProvider()).toBe('openai');
    expect(pricing.resolveDefaultTierValue()).toBe('openai-gpt41');
  });

  it('⭐ 다른 제공자도 그대로 반영된다', () => {
    expect(loadPricingWith('claude').resolveDefaultProvider()).toBe('claude');
    expect(loadPricingWith('perplexity').resolveDefaultProvider()).toBe('perplexity');
    expect(loadPricingWith('gemini').resolveDefaultProvider()).toBe('gemini');
  });

  it('⭐⭐ 환경변수가 있으면 그쪽이 우선한다 (덮어쓰기 가능해야 한다)', () => {
    const pricing = loadPricingWith('openai');
    process.env['AI_PROVIDER'] = 'claude';
    expect(pricing.resolveDefaultProvider()).toBe('claude');
  });

  /**
   * v3.8.483 — 기본 모델 값을 하드코딩하지 않는다.
   *   이 테스트가 지키려는 것은 "설정이 없거나 이상하면 **기본값으로** 떨어진다" 이지
   *   특정 모델 이름이 아니다. 3.6 도입 때 이 단언들이 깨지면서 드러났다.
   */
  it('⭐ 설정이 아예 없으면 기본값 그대로 (동작이 바뀌면 안 된다)', () => {
    const pricing = loadPricingWith(null);
    expect(pricing.resolveDefaultTierValue()).toBe(pricing.DEFAULT_TIER_VALUE);
  });

  it('⭐ 알 수 없는 값이면 기본값으로 떨어진다', () => {
    const pricing = loadPricingWith('무슨제공자');
    expect(pricing.resolveDefaultTierValue()).toBe(pricing.DEFAULT_TIER_VALUE);
  });

  it('⭐ 설정 읽기가 실패해도 예외를 던지지 않는다 (생성이 멈추면 안 된다)', () => {
    jest.resetModules();
    jest.doMock('../src/env', () => ({
      loadEnvFromFile: () => { throw new Error('읽기 실패'); },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pricing = require('../src/core/llm/pricing');
    expect(() => pricing.resolveDefaultTierValue()).not.toThrow();
    expect(pricing.resolveDefaultTierValue()).toBe(pricing.DEFAULT_TIER_VALUE);
  });
});

describe('② 소스에 원인이 되살아나지 않는다', () => {
  it('⭐⭐ process.env 만 보고 끝내지 않는다', () => {
    expect(pricingSrc).toContain('function readProviderFromSettings()');
    expect(pricingSrc).toContain('loadEnvFromFile');
    // 예전처럼 환경변수만 읽고 바로 매핑하면 설정이 다시 무시된다
    expect(pricingSrc).not.toMatch(
      /resolveDefaultTierValue\(\): string \{\s*const p = String\(process\.env\['AI_PROVIDER'\]/,
    );
  });
});

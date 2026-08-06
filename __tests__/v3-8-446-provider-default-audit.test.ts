/**
 * v3.8.446 — Gemini 하드코딩 전수 정리
 *
 * 사용자 지적: "제미나이 충전을 못해서 안쓴다고" (.env 는 AI_PROVIDER=openai)
 * 그런데 모델이 안 정해진 모든 경로가 Gemini 로 떨어지고 있었다. 뿌리는
 * pricing.ts 의 DEFAULT_TIER_VALUE = 'gemini-3.5-flash' 였고, 거기서
 * getCurrentTier · deriveProvider · gemini-engine · vision 이 전부 파생됐다.
 *
 * 실제 API 를 호출하지 않는다 — 기본값 결정 로직만 검사한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveDefaultTierValue, resolveDefaultProvider, deriveProvider, findTier } from '../src/core/llm/pricing';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const orch = read('src/core/final/orchestration.ts');
const engine = read('src/core/final/gemini-engine.ts');
const scorer = read('src/core/url-image-crawler/imageRelevanceScorer.ts');
const urlCrawler = read('src/core/url-image-crawler/index.ts');
const vision = read('src/core/affiliate/detail-image-vision.ts');

describe('① 기본값의 뿌리 — AI_PROVIDER 설정을 따른다', () => {
  const prev = process.env['AI_PROVIDER'];
  afterEach(() => {
    if (prev === undefined) delete process.env['AI_PROVIDER'];
    else process.env['AI_PROVIDER'] = prev;
  });

  it('⭐⭐ AI_PROVIDER=openai 면 기본 티어도 openai', () => {
    process.env['AI_PROVIDER'] = 'openai';
    expect(findTier(resolveDefaultTierValue())?.provider).toBe('openai');
    expect(resolveDefaultProvider()).toBe('openai');
  });

  it('⭐ claude·perplexity 도 각각 따라간다', () => {
    process.env['AI_PROVIDER'] = 'claude';
    expect(resolveDefaultProvider()).toBe('claude');
    process.env['AI_PROVIDER'] = 'perplexity';
    expect(resolveDefaultProvider()).toBe('perplexity');
  });

  /**
   * v3.8.468 — 이 테스트는 두 가지 이유로 고쳤다.
   *
   * ① 환경변수가 없을 때 **설정 파일도 본다**(v3.8.468). 원래 v3.8.446 이
   *    노리던 게 "사용자 설정을 따른다" 였는데, 환경변수를 세우는 코드가
   *    앱 어디에도 없어서 그 안전망이 한 번도 작동하지 않았다.
   *    실측(2026-08-06): 설정 AI_PROVIDER=openai · resolveDefaultProvider() → gemini
   * ② 예전 단정은 **개발자 PC 의 실제 설정 파일**을 읽어서 기계마다 결과가 달랐다.
   *    설정을 흉내 내 격리한다 — 테스트는 어디서 돌려도 같은 답이 나와야 한다.
   */
  it('⭐ 설정도 환경변수도 없으면 예전 기본값으로 돌아간다 (회귀 안전)', () => {
    jest.resetModules();
    jest.doMock('../src/env', () => ({ loadEnvFromFile: () => ({}) }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const isolated = require('../src/core/llm/pricing');
    delete process.env['AI_PROVIDER'];
    expect(isolated.resolveDefaultTierValue()).toBe('gemini-3.5-flash');
    process.env['AI_PROVIDER'] = '이상한값';
    expect(isolated.resolveDefaultTierValue()).toBe('gemini-3.5-flash');
    jest.dontMock('../src/env');
    jest.resetModules();
  });

  it('⭐⭐ 환경변수가 없으면 설정 파일의 제공자를 따른다 (v3.8.468)', () => {
    jest.resetModules();
    jest.doMock('../src/env', () => ({ loadEnvFromFile: () => ({ AI_PROVIDER: 'openai' }) }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const isolated = require('../src/core/llm/pricing');
    delete process.env['AI_PROVIDER'];
    expect(isolated.resolveDefaultProvider()).toBe('openai');
    jest.dontMock('../src/env');
    jest.resetModules();
  });

  it('⭐ 모델명을 알아보면 그 제공자를 그대로 쓴다 (설정보다 우선)', () => {
    process.env['AI_PROVIDER'] = 'openai';
    expect(deriveProvider('claude-sonnet')).toBe('claude');
    expect(deriveProvider('gemini-3.5-flash')).toBe('gemini');
  });
});

describe('② 하드코딩된 gemini 기본값이 남아 있지 않다', () => {
  it('⭐⭐ gemini-engine 이 설정을 본다', () => {
    expect(engine).not.toContain("process.env['PRIMARY_TEXT_MODEL'] || DEFAULT_TIER_VALUE");
    expect(engine).toContain("process.env['PRIMARY_TEXT_MODEL'] || resolveDefaultTierValue()");
    expect(engine).toContain("tier?.provider ?? resolveDefaultProvider()");
  });

  it('⭐⭐ URL 이미지 크롤러가 설정을 본다', () => {
    expect(urlCrawler).not.toContain("opts.textGenerator || 'gemini-3.5-flash'");
    expect(urlCrawler).toContain('resolveDefaultTierValue()');
  });

  it('⭐⭐ orchestration 의 URL 이미지 경로가 설정을 본다', () => {
    expect(orch).not.toContain("payload.provider || 'gemini-3.5-flash'");
  });

  it('⭐⭐ vision 라우팅에 gemini 하드코딩이 없다 (v3.8.445)', () => {
    expect(vision).not.toContain("String(opts.textGenerator || 'gemini')");
    expect(vision).toContain('resolveRouting');
  });
});

describe('③ 키가 없을 때의 대체가 gemini 우선이 아니다', () => {
  it('⭐⭐ 이미지 점수 산정도 키 있는 쪽으로 옮긴다', () => {
    // 예전: 라우팅 실패 시 무조건 gemini
    const fn = scorer.slice(scorer.indexOf('function pickStrategy('), scorer.indexOf('async function scoreOne('));
    const openaiAt = fn.indexOf('keys.openai) return openaiStrategy(VISION_MODELS');
    const geminiAt = fn.indexOf('keys.gemini) return geminiStrategy(VISION_MODELS');
    expect(openaiAt).toBeGreaterThan(-1);
    expect(geminiAt).toBeGreaterThan(-1);
    // 실제로 쓰는 제공자를 먼저 본다
    expect(openaiAt).toBeLessThan(geminiAt);
  });
});

describe('④ payload 에 모델이 없어도 설정으로 채운다 (3순위 구멍)', () => {
  it('⭐⭐ 3순위 분기가 생겼다', () => {
    expect(orch).toContain("} else if (!process.env['PRIMARY_TEXT_MODEL']) {");
    expect(orch).toContain('AI 엔진 (설정값)');
  });
});

describe('⑤ vision HTTP 오류를 조용히 넘기지 않는다', () => {
  it('⭐⭐ 상태 코드를 본다', () => {
    expect(vision).toContain('res.statusCode');
    expect(vision).toContain('status >= 400');
  });

  it('⭐ JSON 이 아닌 오류 응답도 이유를 남긴다', () => {
    expect(vision).toContain('응답을 해석하지 못했습니다');
  });
});

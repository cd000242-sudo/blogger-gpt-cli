/**
 * 🎯 이미지 디스패처 복원력(resilience) 자체검증 — v3.6.0
 *
 * 목표: "거의 실패 없는 이미지 생성"을 1000회 몬테카를로로 증명한다.
 *   - ImageFX/Flow(브라우저) 제거 후, 전 엔진이 공식 API + 로컬 placeholder 최종 안전망.
 *   - 각 API 엔진을 현실적 단일-시도 실패 확률로 모킹, 시드 PRNG로 1000회 반복.
 *   - 디스패처(1순위 재시도 → 신뢰성 폴백 → 로컬 placeholder)가 이미지를 반환한 비율 측정.
 *   - 임계치: = 100% (placeholder 최종 안전망으로 이미지는 항상 존재).
 *   - 부가: 원격 엔진만으로의 성공률(placeholder 제외)도 ≥ 95% 임을 확인 → 폴백 체인 자체가 강함.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mockRng = { next: mulberry32(0x9e3779b9) };

// 엔진별 단일-시도 실패 확률 (현실적 추정 — preview/인증 엔진을 약간 높게)
const FAIL_PROB: Record<string, number> = {
  'gemini-2.5-flash-image': 0.08,
  'gemini-3.1-flash-image-preview': 0.07,
  'gemini-3-pro-image-preview': 0.1,
  'gpt-image-1': 0.08,
  'gpt-image-2': 0.12,
  prodia: 0.06,
  deepinfra: 0.08,
};

function mockOutcome(key: string, dataTag: string): { ok: boolean; dataUrl: string; error?: string } {
  const p = FAIL_PROB[key] ?? 0.1;
  if (mockRng.next() < p) {
    return { ok: false, dataUrl: '', error: `SIM_TRANSIENT_FAIL(${key})` };
  }
  return { ok: true, dataUrl: `data:image/png;base64,${dataTag}` };
}

// ── 외부 의존성 mock ──
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(async (_p: string, _k: string, opts: any) =>
    mockOutcome(opts?.modelId || 'gemini-2.5-flash-image', 'NANO'),
  ),
  makeDeepInfraThumbnail: jest.fn(async () => mockOutcome('deepinfra', 'DEEP')),
  makeGptImageThumbnail: jest.fn(async (_p: string, _k: string, opts: any) =>
    mockOutcome(opts?.modelId || 'gpt-image-1', 'GPT'),
  ),
  makeProdiaThumbnail: jest.fn(async () => mockOutcome('prodia', 'PRODIA')),
}));
jest.mock('../src/core/imagePromptInference', () => ({
  inferImagePrompt: jest.fn(async (prompt: string) => ({ prompt, provider: 'mock', cached: true })),
}));
jest.mock('../src/env', () => ({
  loadEnvFromFile: jest.fn(() => ({
    geminiKey: 'test-gemini-key-1234567890',
    deepInfraApiKey: 'test-deepinfra-key-1234567890',
    openaiKey: 'test-openai-key-1234567890',
    OPENAI_API_KEY: 'test-openai-key-1234567890',
    prodiaApiKey: 'test-prodia-key-1234567890',
    PRODIA_API_KEY: 'test-prodia-key-1234567890',
  })),
}));
jest.mock('../src/core/image-error-classifier', () => ({
  classifyImageError: jest.fn(() => ({
    category: 'network',
    bypassable: true,
    cooldownMs: 0,
    userMessage: 'sim transient',
  })),
  categoryLabel: jest.fn(() => 'network'),
}));
jest.mock('../src/core/engine-stats', () => ({
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
}));
// v3.8.111부터 모든 엔진 시도가 공통 큐를 지나며 엔진별 "안정화 대기"(최대 8초)를 실제로 잠든다.
//   이 테스트는 폴백 체인 로직을 검증하는 것이지 페이싱을 검증하는 게 아니고,
//   1000회 × 8초는 물리적으로 불가능하므로 큐는 통과만 시킨다. (페이싱 자체는 별도 테스트 대상)
jest.mock('../src/core/image-generation-queue', () => ({
  runImageGenerationQueued: jest.fn(async (_meta: unknown, task: () => Promise<unknown>) => task()),
  describeImageEnginePacing: jest.fn(() => 'test'),
}));

import { dispatchH2ImageGeneration, dispatchThumbnailGeneration } from '../src/core/imageDispatcher';

// v3.8.104부터 placeholder 직전에 pollinations.ai 무료 fallback을 실제로 호출한다.
//   모킹하지 않으면 1000회 몬테카를로가 매번 실물 네트워크(타임아웃 30초)를 타서
//   테스트가 통째로 타임아웃된다. 기본값은 "네트워크 없음"으로 두고,
//   pollinations 경로를 검증하는 테스트만 성공 응답으로 갈아끼운다.
const POLLINATIONS_PNG = Buffer.from('89504e470d0a1a0a', 'hex');
let mockFetch: jest.Mock;

function setPollinationsReachable(): void {
  mockFetch.mockImplementation(async () => ({
    ok: true,
    arrayBuffer: async () => POLLINATIONS_PNG,
    headers: { get: () => 'image/jpeg' },
  }));
}

beforeEach(() => {
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
  delete process.env['STRICT_THUMBNAIL_ENGINE'];
  mockFetch = jest.fn(async () => { throw new Error('SIM_NETWORK_DOWN'); });
  (global as any).fetch = mockFetch;
});

// 사용자가 고를 수 있는 1순위 엔진 (v3.6.0: 전부 API 엔진)
const SELECTABLE_ENGINES = [
  'nanobanana',
  'nanobanana2',
  'nanobananapro',
  'gptimage1',
  'gptimage2',
  'prodia',
  'deepinfra',
];

describe('이미지 디스패처 복원력 — 1000회 몬테카를로 (보장형 폴백 + 로컬 안전망)', () => {
  it('1000회 무작위 엔진 선택 → 이미지 100% 보장, 원격 성공률(placeholder 제외) ≥ 95%', async () => {
    mockRng.next = mulberry32(0x1234abcd);

    const RUNS = 1000;
    let success = 0;
    let remoteSuccess = 0; // placeholder 아닌 진짜 엔진 성공
    let placeholderUsed = 0;
    let rescuedByFallback = 0;

    for (let i = 0; i < RUNS; i++) {
      const chosen = SELECTABLE_ENGINES[i % SELECTABLE_ENGINES.length]!;
      const result = await dispatchH2ImageGeneration(chosen, `주제 ${i}`, '키워드');
      if (result.ok) {
        success++;
        if (/placeholder/.test(result.source)) placeholderUsed++;
        else {
          remoteSuccess++;
          if (/폴백/.test(result.source)) rescuedByFallback++;
        }
      }
    }

    const rate = success / RUNS;
    const remoteRate = remoteSuccess / RUNS;
    console.log(
      `[RESILIENCE] 전체 ${(rate * 100).toFixed(2)}% (${success}/${RUNS}), ` +
        `원격 ${(remoteRate * 100).toFixed(2)}%, 폴백 회복 ${rescuedByFallback}, placeholder ${placeholderUsed}`,
    );

    expect(rate).toBe(1); // 로컬 placeholder 최종 안전망 → 이미지 항상 존재
    expect(remoteRate).toBeGreaterThanOrEqual(0.95); // 폴백 체인 자체가 강함
  }, 60000);

  it('1000회 — 가장 취약한 엔진(gptimage2, 인증 이슈 잦음)만 1순위로 골라도 100% 보장', async () => {
    mockRng.next = mulberry32(0x55aa55aa);

    const RUNS = 1000;
    let success = 0;
    for (let i = 0; i < RUNS; i++) {
      const result = await dispatchH2ImageGeneration('gptimage2', `주제 ${i}`, '키워드');
      if (result.ok) success++;
    }
    const rate = success / RUNS;
    console.log(`[RESILIENCE-WEAK] gptimage2 1순위 1000회 → ${(rate * 100).toFixed(2)}% 성공`);
    expect(rate).toBe(1);
  }, 60000);

  it('썸네일 1000회 무작위 선택 → 100% 보장', async () => {
    mockRng.next = mulberry32(0x0badf00d);

    const RUNS = 1000;
    let success = 0;
    for (let i = 0; i < RUNS; i++) {
      const chosen = SELECTABLE_ENGINES[(i * 3) % SELECTABLE_ENGINES.length]!;
      const result = await dispatchThumbnailGeneration(chosen, `제목 ${i}`, '키워드');
      if (result.ok) success++;
    }
    const rate = success / RUNS;
    console.log(`[RESILIENCE-THUMB] 썸네일 1000회 → ${(rate * 100).toFixed(2)}% 성공`);
    expect(rate).toBe(1);
  }, 60000);

  it('최종 안전망: 모든 원격 엔진이 100% 다운이어도 로컬 placeholder 로 이미지 보장 (ok:true)', async () => {
    const {
      makeNanoBananaProThumbnail,
      makeDeepInfraThumbnail,
      makeGptImageThumbnail,
      makeProdiaThumbnail,
    } = require('../src/thumbnail');
    const allFail = async () => ({ ok: false, dataUrl: '', error: 'SIM_TRANSIENT_FAIL(forced)' });
    (makeNanoBananaProThumbnail as jest.Mock).mockImplementation(allFail);
    (makeDeepInfraThumbnail as jest.Mock).mockImplementation(allFail);
    (makeGptImageThumbnail as jest.Mock).mockImplementation(allFail);
    (makeProdiaThumbnail as jest.Mock).mockImplementation(allFail);

    const h2 = await dispatchH2ImageGeneration('nanobanana2', 'test', 'kw');
    expect(h2.ok).toBe(true);
    expect(h2.source).toMatch(/placeholder/);
    expect(h2.dataUrl).toMatch(/^data:image\/png;base64,/);

    const thumb = await dispatchThumbnailGeneration('nanobanana2', '제목', 'kw');
    expect(thumb.ok).toBe(true);
    expect(thumb.source).toMatch(/placeholder/);
  }, 30000);

  // v3.8.104: placeholder 직전 단계 — 무료 pollinations가 살아 있으면 그 이미지를 쓴다.
  //   회색 placeholder보다 실제 이미지가 낫기 때문. 순서가 뒤바뀌면 사용자가 보는 결과가 나빠진다.
  it('모든 유료 엔진 실패 시 placeholder보다 pollinations 무료 이미지를 우선한다', async () => {
    const {
      makeNanoBananaProThumbnail,
      makeDeepInfraThumbnail,
      makeGptImageThumbnail,
      makeProdiaThumbnail,
    } = require('../src/thumbnail');
    const allFail = async () => ({ ok: false, dataUrl: '', error: 'SIM_TRANSIENT_FAIL(forced)' });
    (makeNanoBananaProThumbnail as jest.Mock).mockImplementation(allFail);
    (makeDeepInfraThumbnail as jest.Mock).mockImplementation(allFail);
    (makeGptImageThumbnail as jest.Mock).mockImplementation(allFail);
    (makeProdiaThumbnail as jest.Mock).mockImplementation(allFail);
    setPollinationsReachable();

    const result = await dispatchH2ImageGeneration('nanobanana2', 'test', 'kw');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Pollinations/i);
    expect(result.source).not.toMatch(/placeholder/);
    expect(mockFetch).toHaveBeenCalled();
  }, 30000);

  it('엄격 모드(STRICT)에서는 placeholder 미적용 — 실패 시 throw (엔진 고정 의도 존중)', async () => {
    const { makeNanoBananaProThumbnail } = require('../src/thumbnail');
    (makeNanoBananaProThumbnail as jest.Mock).mockImplementation(async () => ({
      ok: false,
      dataUrl: '',
      error: 'SIM_FAIL',
    }));
    process.env['STRICT_H2_IMAGE_ENGINE'] = 'true';

    await expect(dispatchH2ImageGeneration('nanobanana2', 'test', 'kw')).rejects.toThrow(
      /STRICT_ENGINE_FAILED/,
    );
  }, 30000);
});

/**
 * AI 이미지 선정성 검사 — 모든 엔진이 지나는 한 곳(imageDispatcher 의 tryEngine)과 마지막 무료 대체(pollinations)에 걸렸는가.
 * 걸린 이미지는 글에 들어가지 않고, 다른 엔진·대체 이미지로 넘어간다(글은 멈추지 않는다).
 */
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(),
  makeDeepInfraThumbnail: jest.fn(),
  makeGptImageThumbnail: jest.fn(),
  makeProdiaThumbnail: jest.fn(),
  makeLeonardoPhoenixImage: jest.fn(),
}));
jest.mock('../src/core/flowGenerator', () => ({ makeFlowImage: jest.fn() }));
jest.mock('../src/core/dropshotGenerator', () => ({ makeDropshotImage: jest.fn() }));
jest.mock('../src/core/image-generation-queue', () => ({
  runImageGenerationQueued: jest.fn(async (_meta: unknown, task: () => Promise<unknown>) => task()),
}));
jest.mock('../src/core/imagePromptInference', () => ({
  inferImagePrompt: jest.fn(async (prompt: string) => ({ prompt, provider: 'mock', cached: true })),
}));
jest.mock('../src/env', () => ({
  loadEnvFromFile: jest.fn(() => ({
    geminiKey: 'test-gemini-key-1234567890',
    openaiKey: 'test-openai-key-1234567890',
    OPENAI_API_KEY: 'test-openai-key-1234567890',
    prodiaApiKey: 'test-prodia-key-1234567890',
    PRODIA_API_KEY: 'test-prodia-key-1234567890',
  })),
}));
jest.mock('../src/core/engine-stats', () => ({ recordSuccess: jest.fn(), recordFailure: jest.fn() }));
/** 'UNSAFE!' 가 든 이미지만 걸린다고 치는 가짜 검사기(실제 moderation 은 image-moderation.test.ts 가 본다) */
jest.mock('../src/core/image-moderation', () => {
  const actual = jest.requireActual('../src/core/image-moderation');
  return {
    ...actual,
    moderateGeneratedImage: jest.fn(async (url: string) => (String(url).includes('UNSAFE!')
      ? { checked: true, flagged: true, categories: ['sexual'] }
      : { checked: true, flagged: false, categories: [] })),
  };
});

import { dispatchH2ImageGeneration, dispatchThumbnailGeneration } from '../src/core/imageDispatcher';
import { makeNanoBananaProThumbnail, makeProdiaThumbnail } from '../src/thumbnail';
import { moderateGeneratedImage } from '../src/core/image-moderation';

const mockNano = makeNanoBananaProThumbnail as jest.MockedFunction<typeof makeNanoBananaProThumbnail>;
const mockProdia = makeProdiaThumbnail as jest.MockedFunction<typeof makeProdiaThumbnail>;
const mockModerate = moderateGeneratedImage as jest.MockedFunction<typeof moderateGeneratedImage>;

const realFetch = (global as any).fetch;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
  delete process.env['STRICT_THUMBNAIL_ENGINE'];
  (global as any).fetch = jest.fn(async () => { throw new Error('network disabled in test'); });
});
afterAll(() => { (global as any).fetch = realFetch; });

describe('엔진이 만든 이미지가 걸리면', () => {
  test('본문 이미지: 걸린 그림은 넣지 않고 다음 엔진(대체) 그림을 쓴다', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UNSAFE!_NANO' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GOOD_PRODIA' } as any);
    const logs: string[] = [];
    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw', (m) => logs.push(m));
    expect(result.ok).toBe(true);
    expect(result.dataUrl).toBe('data:image/png;base64,GOOD_PRODIA');
    expect(result.dataUrl).not.toContain('UNSAFE!');
    expect(mockModerate).toHaveBeenCalledWith('data:image/png;base64,UNSAFE!_NANO', expect.anything());
    expect(logs.some((l) => l.includes('안전 검사') && l.includes('sexual'))).toBe(true);
  });

  test('썸네일도 같은 문을 지난다', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UNSAFE!_THUMB' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GOOD_THUMB' } as any);
    const result = await dispatchThumbnailGeneration('nanobanana', 'test', 'kw');
    expect(result.dataUrl).not.toContain('UNSAFE!');
  });

  test('깨끗한 이미지는 그대로 쓴다(검사 1회)', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GOOD_NANO' } as any);
    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw');
    expect(result.dataUrl).toBe('data:image/png;base64,GOOD_NANO');
    expect(mockModerate).toHaveBeenCalledTimes(1);
  });

  test('모든 엔진이 걸리고 무료 대체(pollinations)까지 걸리면 로컬 기본 그림으로 — 걸린 그림은 끝내 안 들어간다', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UNSAFE!_1' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UNSAFE!_2' } as any);
    // pollinations 응답 — 'UNSAFE!' 를 base64 로 담아 검사기가 걸리게 한다
    (global as any).fetch = jest.fn(async () => new Response(Buffer.from('xxUNSAFE!xx'), { status: 200, headers: { 'content-type': 'image/UNSAFE!' } }));
    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw');
    expect(result.ok).toBe(true);
    expect(result.dataUrl).not.toContain('UNSAFE!');
    expect(result.source).toContain('placeholder');
  });
});

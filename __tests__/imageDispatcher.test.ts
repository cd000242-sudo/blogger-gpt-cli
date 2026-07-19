/**
 * imageDispatcher — v3.6.0 계약 검증
 *
 * 검증 포인트:
 *   1. 기본 = 보장형 폴백 (명시 선택 실패해도 신뢰성 API 폴백으로 이미지 보장)
 *   2. 'auto'/빈값 = 키 인식 신뢰성 1순위(nanobanana2)
 *   3. Flow 정식 지원 — 레거시 imagefx 값도 Flow로 graceful redirect
 *   4. 엄격 모드는 STRICT_* env opt-in 으로만 (폴백 차단 + STRICT_ENGINE_FAILED throw)
 *   5. 신규 엔진(나노바나나 3종 / GPT 2종 / Prodia) modelId·라벨 정확성
 */

// ── 외부 의존성 mock ──
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(),
  makeDeepInfraThumbnail: jest.fn(),
  makeGptImageThumbnail: jest.fn(),
  makeProdiaThumbnail: jest.fn(),
  makeLeonardoPhoenixImage: jest.fn(),
}));
jest.mock('../src/core/flowGenerator', () => ({
  makeFlowImage: jest.fn(),
}));
jest.mock('../src/core/dropshotGenerator', () => ({
  makeDropshotImage: jest.fn(),
}));
jest.mock('../src/core/image-generation-queue', () => ({
  runImageGenerationQueued: jest.fn(async (_meta: unknown, task: () => Promise<unknown>) => task()),
}));
jest.mock('../src/core/imagePromptInference', () => ({
  inferImagePrompt: jest.fn(async (prompt: string) => ({
    prompt,
    provider: 'mock',
    cached: true,
  })),
}));
jest.mock('../src/env', () => ({
  loadEnvFromFile: jest.fn(() => ({
    geminiKey: 'test-gemini-key-1234567890',
    deepInfraApiKey: 'test-deepinfra-key-1234567890',
    openaiKey: 'test-openai-key-1234567890',
    OPENAI_API_KEY: 'test-openai-key-1234567890',
    prodiaApiKey: 'test-prodia-key-1234567890',
    PRODIA_API_KEY: 'test-prodia-key-1234567890',
    leonardoKey: 'test-leonardo-key-1234567890',
  })),
}));
jest.mock('../src/core/image-error-classifier', () => ({
  classifyImageError: jest.fn(() => ({
    category: 'network',
    bypassable: true,
    cooldownMs: 0,
    userMessage: 'mock error',
  })),
  categoryLabel: jest.fn(() => 'mock-category'),
}));
jest.mock('../src/core/engine-stats', () => ({
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
}));

import {
  dispatchH2ImageGeneration,
  dispatchThumbnailGeneration,
  SUPPORTED_IMAGE_ENGINES,
  normalizeImageEngine,
} from '../src/core/imageDispatcher';
import {
  makeNanoBananaProThumbnail,
  makeGptImageThumbnail,
  makeProdiaThumbnail,
  makeDeepInfraThumbnail,
  makeLeonardoPhoenixImage,
} from '../src/thumbnail';
import { makeFlowImage } from '../src/core/flowGenerator';
import { makeDropshotImage } from '../src/core/dropshotGenerator';

const mockNano = makeNanoBananaProThumbnail as jest.MockedFunction<typeof makeNanoBananaProThumbnail>;
const mockGpt = makeGptImageThumbnail as jest.MockedFunction<typeof makeGptImageThumbnail>;
const mockProdia = makeProdiaThumbnail as jest.MockedFunction<typeof makeProdiaThumbnail>;
const mockDeep = makeDeepInfraThumbnail as jest.MockedFunction<typeof makeDeepInfraThumbnail>;
const mockLeonardo = makeLeonardoPhoenixImage as jest.MockedFunction<typeof makeLeonardoPhoenixImage>;
const mockFlow = makeFlowImage as jest.MockedFunction<typeof makeFlowImage>;
const mockDropshot = makeDropshotImage as jest.MockedFunction<typeof makeDropshotImage>;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
  delete process.env['STRICT_THUMBNAIL_ENGINE'];
});

describe('dispatchH2ImageGeneration — 보장형 폴백 (v3.6.0 기본)', () => {
  it('명시 선택 "nanobanana" + 실패 → prodia 폴백으로 이미지 보장 (차단 안 함)', async () => {
    mockNano.mockResolvedValue({ ok: false, dataUrl: '', error: 'GEMINI_QUOTA_EXCEEDED' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA_FB' } as any);

    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Prodia/);
    expect(result.source).toMatch(/폴백/);
    expect(mockProdia).toHaveBeenCalled();
  });

  it('"auto" → 키 인식 신뢰성 1순위(nanobanana2) 실패 시 prodia 폴백', async () => {
    mockNano.mockResolvedValue({ ok: false, dataUrl: '', error: 'GEMINI_TIMEOUT' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,FALLBACK' } as any);

    const result = await dispatchH2ImageGeneration('auto', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.dataUrl).toBe('data:image/png;base64,FALLBACK');
    expect(mockNano).toHaveBeenCalled(); // nanobanana2 1순위 시도
    expect(mockProdia).toHaveBeenCalled(); // prodia 폴백
  });

  it('빈 문자열 입력 → "auto" 와 동일하게 nanobanana2 1순위', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,OK' } as any);

    const result = await dispatchH2ImageGeneration('', 'test', 'kw');
    expect(result.ok).toBe(true);
    expect(result.source).toBe('Nano Banana 2');
    expect(mockNano).toHaveBeenCalled();
  });

  it('Flow 정식 엔진과 레거시 "imagefx" 별칭이 동일한 Flow 생성 경로를 사용', async () => {
    mockFlow.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,FLOW', modelUsed: 'mock-flow' } as any);

    const r1 = await dispatchH2ImageGeneration('flow', 'test', 'kw');
    const r2 = await dispatchH2ImageGeneration('imagefx', 'test', 'kw');

    expect(r1.ok).toBe(true);
    expect(r1.source).toContain('Flow');
    expect(r2.ok).toBe(true);
    expect(r2.source).toContain('Flow');
    expect(mockFlow).toHaveBeenCalledTimes(2);
  });

  it('"none" → 즉시 빈 결과 반환 (엔진 호출 없음)', async () => {
    const result = await dispatchH2ImageGeneration('none', 'test', 'kw');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/스킵/);
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockProdia).not.toHaveBeenCalled();
  });
});

describe('글포스팅 선택 가능 이미지 엔진 매트릭스', () => {
  it('API·브라우저 기반 엔진 모두 H2와 썸네일 디스패처에서 정상 반환', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NANO' } as any);
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA' } as any);
    mockDeep.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,DEEP' } as any);
    mockLeonardo.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,LEONARDO' } as any);
    mockFlow.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,FLOW', modelUsed: 'mock-flow' } as any);
    mockDropshot.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,DROPSHOT' } as any);

    const engines = [
      'nanobanana',
      'nanobanana2',
      'nanobananapro',
      'gptimage1',
      'gptimage2',
      'prodia',
      'deepinfra',
      'leonardo',
      'flow',
      'dropshot-nanobanana-pro',
    ];

    for (const engine of engines) {
      expect(SUPPORTED_IMAGE_ENGINES).toContain(engine);
      const h2 = await dispatchH2ImageGeneration(engine, `${engine} section`, 'keyword', undefined, undefined, {
        allowFreeTrialPublishing: true,
      });
      const thumbnail = await dispatchThumbnailGeneration(engine, `${engine} title`, 'keyword', undefined, {
        allowFreeTrialPublishing: true,
      });
      expect(h2.ok).toBe(true);
      expect(thumbnail.ok).toBe(true);
    }
  });
});

describe('dispatchThumbnailGeneration — 보장형 폴백 (v3.6.0 기본)', () => {
  it('명시 선택 "nanobanana" 실패 → 폴백으로 썸네일 보장 (차단 안 함)', async () => {
    mockNano.mockResolvedValue({ ok: false, dataUrl: '', error: 'GEMINI_FAIL' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,THUMB_FB' } as any);

    const result = await dispatchThumbnailGeneration('nanobanana', 'title', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/폴백/);
    expect(mockProdia).toHaveBeenCalled();
  });

  it('"auto" → nanobanana2 성공 시 그대로 반환', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,T' } as any);

    const result = await dispatchThumbnailGeneration('auto', 'title', 'kw');

    expect(result.ok).toBe(true);
    expect(mockNano).toHaveBeenCalled();
  });

  it('명시 선택 "prodia" 성공 → 그대로 반환 (폴백 안 함)', async () => {
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA_OK' } as any);

    const result = await dispatchThumbnailGeneration('prodia', 'title', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Prodia/);
    expect(mockNano).not.toHaveBeenCalled();
  });
});

describe('에러 메시지 상세화 + 엄격 모드 opt-in (v3.6.0)', () => {
  it('명시 "nanobanana" 실패(엄격 썸네일 모드) → onLog 에 원본 에러 전달 + 폴백 차단', async () => {
    process.env['STRICT_THUMBNAIL_ENGINE'] = 'true';
    mockNano.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'GEMINI_DETAIL: 응답 파싱 실패 상세 메시지',
    } as any);

    const logs: string[] = [];
    const result = await dispatchThumbnailGeneration('nanobanana', 'title', 'kw', (msg) => logs.push(msg));

    expect(result.ok).toBe(false);
    expect(logs.join('\n')).toMatch(/GEMINI_DETAIL|응답 파싱 실패/);
    expect(mockProdia).not.toHaveBeenCalled(); // 폴백 차단
  });

  it('STRICT_H2_IMAGE_ENGINE=true + nanobananapro 실패 → STRICT_ENGINE_FAILED throw (폴백 차단)', async () => {
    process.env['STRICT_H2_IMAGE_ENGINE'] = 'true';
    mockNano.mockResolvedValue({ ok: false, dataUrl: '', error: 'BILLING_REQUIRED' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,X' } as any);

    await expect(
      dispatchH2ImageGeneration('nanobananapro', 'test', 'kw'),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);

    expect(mockProdia).not.toHaveBeenCalled(); // 폴백 차단
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 현재 엔진 별칭/지원 범위 검증
// ═══════════════════════════════════════════════════════════════════════════

describe('Flow/Leonardo 정식 지원과 레거시 별칭', () => {
  it('SUPPORTED_IMAGE_ENGINES에는 Flow/Leonardo가 있고 imagefx 별칭은 노출하지 않음', () => {
    expect(SUPPORTED_IMAGE_ENGINES).not.toContain('imagefx');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('flow');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('leonardo');
  });

  it('레거시 ImageFX 계열은 Flow로, 제거된 Pollinations 선택은 nanobanana2로 정규화', () => {
    expect(normalizeImageEngine('imagefx')).toBe('flow');
    expect(normalizeImageEngine('flow')).toBe('flow');
    expect(normalizeImageEngine('labs-flow')).toBe('flow');
    expect(normalizeImageEngine('leonardo')).toBe('leonardo');
    expect(normalizeImageEngine('pollinations')).toBe('nanobanana2');
    expect(normalizeImageEngine('auto')).toBe('nanobanana2');
    expect(normalizeImageEngine('')).toBe('nanobanana2');
    expect(normalizeImageEngine('알수없는엔진')).toBe('nanobanana2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v3.5.88 — 나노바나나 3종
// ═══════════════════════════════════════════════════════════════════════════

describe('v3.5.88 신규 엔진 — 나노바나나 3종', () => {
  it('SUPPORTED_IMAGE_ENGINES에 nanobanana/nanobanana2/nanobananapro 모두 포함', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobanana');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobanana2');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobananapro');
  });

  it('normalizeImageEngine — nanobananapro는 nanobanana로 흡수되지 않음 (정식 분리)', () => {
    expect(normalizeImageEngine('nanobananapro')).toBe('nanobananapro');
    expect(normalizeImageEngine('nanobanana2')).toBe('nanobanana2');
    expect(normalizeImageEngine('nano-banana-pro')).toBe('nanobananapro');
    expect(normalizeImageEngine('nanobanana-2')).toBe('nanobanana2');
  });

  it('nanobanana 선택 → modelId="gemini-2.5-flash-image"로 호출 (저비용)', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NB1' } as any);

    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/2\.5 저비용/);
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-2.5-flash-image' }),
    );
  });

  it('nanobanana2 선택 → modelId="gemini-3.1-flash-image-preview" 호출', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NB2' } as any);

    const result = await dispatchH2ImageGeneration('nanobanana2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Nano Banana 2');
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-3.1-flash-image-preview' }),
    );
  });

  it('nanobananapro 선택 → modelId="gemini-3-pro-image-preview" 호출', async () => {
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NBP' } as any);

    const result = await dispatchH2ImageGeneration('nanobananapro', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Nano Banana Pro');
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-3-pro-image-preview' }),
    );
  });

  it('nanobananapro 실패 → 보장형 폴백 (prodia로 회복, 차단 안 함)', async () => {
    mockNano.mockResolvedValue({ ok: false, dataUrl: '', error: 'BILLING_REQUIRED' } as any);
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA_FB' } as any);

    const result = await dispatchH2ImageGeneration('nanobananapro', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Prodia/);
    expect(mockProdia).toHaveBeenCalled();
  });
});

describe('v3.5.88 신규 엔진 — GPT 이미지 1/2', () => {
  it('SUPPORTED_IMAGE_ENGINES에 gptimage1/gptimage2 포함', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('gptimage1');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('gptimage2');
  });

  it('덕테이프 별칭이 gptimage2로 정규화됨', () => {
    expect(normalizeImageEngine('ducktape')).toBe('gptimage2');
    expect(normalizeImageEngine('덕테이프')).toBe('gptimage2');
    expect(normalizeImageEngine('gpt-image-2')).toBe('gptimage2');
    expect(normalizeImageEngine('gpt-image-1')).toBe('gptimage1');
  });

  it('gptimage1 선택 → makeGptImageThumbnail({modelId:"gpt-image-1", quality:"medium"}) 호출', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT1' } as any);

    const result = await dispatchH2ImageGeneration('gptimage1', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 1 · medium');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-1', quality: 'medium' }),
    );
  });

  it('gptimage1 + quality=low 전달 → API에 그대로 전달됨', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT1LOW' } as any);

    const result = await dispatchH2ImageGeneration(
      'gptimage1', 'test', 'kw', undefined, undefined, { gptImageQuality: 'low' },
    );
    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 1 · low');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-1', quality: 'low' }),
    );
  });

  it('gptimage2 + quality=high 전달 → 라벨/옵션 모두 high', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT2HIGH' } as any);

    const result = await dispatchH2ImageGeneration(
      'gptimage2', 'test', 'kw', undefined, undefined, { gptImageQuality: 'high' },
    );
    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 2 (덕테이프) · high');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-2', quality: 'high' }),
    );
  });

  it('gptimage2(덕테이프) 인증 미완료 → 보장형 폴백 (nanobanana로 회복)', async () => {
    mockGpt.mockResolvedValue({
      ok: false,
      error: 'OPENAI_VERIFICATION_REQUIRED: gpt-image-2는 OpenAI 신분증 인증이 필요합니다.',
    } as any);
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NANO_FB' } as any);

    const result = await dispatchH2ImageGeneration('gptimage2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(mockNano).toHaveBeenCalled();
  });

  it('gptimage2 성공 → "GPT Image 2 (덕테이프) · medium" source 라벨', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT2' } as any);

    const result = await dispatchH2ImageGeneration('gptimage2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 2 (덕테이프) · medium');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-2', quality: 'medium' }),
    );
  });

  it('썸네일에서 gptimage1은 이미지 텍스트 모드를 끄고 호출', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT1_THUMB' } as any);

    const result = await dispatchThumbnailGeneration('gptimage1', '한글 제목', '키워드');

    expect(result.ok).toBe(true);
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-1', isThumbnail: false }),
    );
  });

  it('썸네일에서 gptimage2는 이미지 텍스트 모드를 허용', async () => {
    mockGpt.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,GPT2_THUMB' } as any);

    const result = await dispatchThumbnailGeneration('gptimage2', '한글 제목', '키워드');

    expect(result.ok).toBe(true);
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-2', isThumbnail: true }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v3.5.90 — Prodia FLUX schnell
// ═══════════════════════════════════════════════════════════════════════════

describe('v3.5.90 신규 엔진 — Prodia FLUX schnell', () => {
  it('SUPPORTED_IMAGE_ENGINES에 prodia 포함', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('prodia');
  });

  it('flux-schnell 별칭이 prodia로 정규화됨', () => {
    expect(normalizeImageEngine('flux-schnell')).toBe('prodia');
    expect(normalizeImageEngine('fluxschnell')).toBe('prodia');
  });

  it('prodia 선택 → makeProdiaThumbnail({model:"flux-schnell", steps:4}) 호출', async () => {
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA' } as any);

    const result = await dispatchH2ImageGeneration('prodia', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Prodia FLUX schnell');
    expect(mockProdia).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ model: 'flux-schnell', steps: 4 }),
    );
  });

  it('prodia 실패 → 보장형 폴백 (nanobanana로 회복, 차단 안 함)', async () => {
    mockProdia.mockResolvedValue({ ok: false, error: 'PRODIA_HTTP_429: rate limited' } as any);
    mockNano.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,NANO_FB' } as any);

    const result = await dispatchH2ImageGeneration('prodia', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(mockNano).toHaveBeenCalled();
  });

  it('deepinfra 폴백 경로 — prodia/nano 모두 실패 시 deepinfra 시도', async () => {
    mockNano.mockResolvedValue({ ok: false, error: 'fail' } as any);
    mockProdia.mockResolvedValue({ ok: false, error: 'fail' } as any);
    mockDeep.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,DEEP' } as any);

    const result = await dispatchH2ImageGeneration('nanobanana2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/DeepInfra/);
    expect(mockDeep).toHaveBeenCalled();
  });

  it('prodia 썸네일 프롬프트에는 한글/영문 텍스트 금지 규칙을 추가', async () => {
    mockProdia.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,PRODIA_TEXTLESS' } as any);

    const result = await dispatchThumbnailGeneration('prodia', '한글 제목', '키워드');

    expect(result.ok).toBe(true);
    expect(mockProdia).toHaveBeenCalledWith(
      expect.stringContaining('NO Korean text'),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('deepinfra는 텍스트 오버레이를 끄고 프롬프트에도 텍스트 금지 규칙을 추가', async () => {
    mockDeep.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,DEEP_TEXTLESS' } as any);

    const result = await dispatchH2ImageGeneration('deepinfra', '섹션 이미지', '키워드');

    expect(result.ok).toBe(true);
    expect(mockDeep).toHaveBeenCalledWith(
      expect.stringContaining('NO Korean text'),
      expect.any(String),
      expect.objectContaining({ skipOverlay: true }),
    );
  });
});

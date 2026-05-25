/**
 * imageDispatcher 폴백 차단 + 에러 메시지 상세화 검증 (v3.5.87)
 *
 * 검증 포인트:
 *   1. H2: 사용자 명시 선택 시 폴백 차단 (STRICT_ENGINE_FAILED throw)
 *   2. H2: 'auto' 선택 시 기존 폴백 체인 동작
 *   3. H2: 'none' 선택 시 즉시 빈 결과
 *   4. 썸네일: 명시 선택 실패 시 폴백 차단 + 원인 메시지 포함
 *   5. 썸네일: 'auto' 실패 시 폴백 체인 동작
 *   6. 에러 메시지 상세화: Flow 실패 시 result.error 가 최종 error 에 포함됨
 */

// ── 외부 의존성 mock ──
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(),
  makeDeepInfraThumbnail: jest.fn(),
  makeGptImageThumbnail: jest.fn(),
  makeProdiaThumbnail: jest.fn(),
}));
jest.mock('../src/core/imageFxGenerator', () => ({
  makeImageFxImage: jest.fn(),
  ensurePage: jest.fn(),
}));
jest.mock('../src/core/flowGenerator', () => ({
  makeFlowImage: jest.fn(),
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
import { makeFlowImage } from '../src/core/flowGenerator';
import { makeImageFxImage } from '../src/core/imageFxGenerator';
import { makeNanoBananaProThumbnail, makeGptImageThumbnail, makeProdiaThumbnail } from '../src/thumbnail';

const mockFlow = makeFlowImage as jest.MockedFunction<typeof makeFlowImage>;
const mockImageFx = makeImageFxImage as jest.MockedFunction<typeof makeImageFxImage>;
const mockNano = makeNanoBananaProThumbnail as jest.MockedFunction<typeof makeNanoBananaProThumbnail>;
const mockGpt = makeGptImageThumbnail as jest.MockedFunction<typeof makeGptImageThumbnail>;
const mockProdia = makeProdiaThumbnail as jest.MockedFunction<typeof makeProdiaThumbnail>;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
  delete process.env['STRICT_THUMBNAIL_ENGINE'];
});

describe('dispatchH2ImageGeneration — 폴백 차단 (v3.5.87)', () => {
  it('명시 선택 "flow" + Flow 실패 → STRICT_ENGINE_FAILED throw (폴백 안 함)', async () => {
    mockFlow.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'FLOW_RESPONSE_PARSE: 응답 파싱 실패',
    });

    await expect(
      dispatchH2ImageGeneration('flow', 'test prompt', 'keyword'),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);

    // 폴백 엔진은 절대 호출되면 안 됨
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
    // Flow 는 strict 모드에서 최대 3회 재시도
    expect(mockFlow).toHaveBeenCalled();
  });

  it('명시 선택 "nanobanana" + 실패 → STRICT_ENGINE_FAILED throw', async () => {
    mockNano.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'GEMINI_QUOTA_EXCEEDED',
    } as any);

    await expect(
      dispatchH2ImageGeneration('nanobanana', 'test', 'kw'),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);

    expect(mockFlow).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
  });

  it('"auto" 선택 + 1순위 실패 → 폴백 체인 동작', async () => {
    // 'auto' 는 normalizeImageEngine 에서 'imagefx' 로 치환됨 (명시 아님)
    mockImageFx.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'IMAGEFX_TIMEOUT',
    });
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,FALLBACK',
    } as any);

    const result = await dispatchH2ImageGeneration('auto', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.dataUrl).toBe('data:image/png;base64,FALLBACK');
    // 1순위 ImageFX 시도 후 폴백으로 nanobanana 호출됨
    expect(mockImageFx).toHaveBeenCalled();
    expect(mockNano).toHaveBeenCalled();
  });

  it('빈 문자열 입력 → "auto" 와 동일하게 폴백 체인 허용', async () => {
    mockImageFx.mockResolvedValue({ ok: false, dataUrl: '', error: 'fail' });
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,OK',
    } as any);

    const result = await dispatchH2ImageGeneration('', 'test', 'kw');
    expect(result.ok).toBe(true);
    expect(mockNano).toHaveBeenCalled();
  });

  it('"none" → 즉시 빈 결과 반환 (엔진 호출 없음)', async () => {
    const result = await dispatchH2ImageGeneration('none', 'test', 'kw');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/스킵/);
    expect(mockFlow).not.toHaveBeenCalled();
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
  });
});

describe('dispatchThumbnailGeneration — 폴백 차단 (v3.5.87)', () => {
  it('명시 선택 "flow" + 실패 → 폴백 없이 ok:false, 원인 메시지 포함', async () => {
    mockFlow.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'FLOW_BLOCKED: reCAPTCHA 감지',
    });

    const result = await dispatchThumbnailGeneration('flow', 'title', 'kw');

    expect(result.ok).toBe(false);
    // 사유가 error 에 포함되어야 함 (사용자 요구)
    expect(result.error).toMatch(/FLOW_BLOCKED|reCAPTCHA/);
    // 폴백 엔진은 절대 호출 안 됨
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
  });

  it('"auto" + 1순위 실패 → 폴백 체인으로 nanobanana 시도', async () => {
    mockImageFx.mockResolvedValue({ ok: false, dataUrl: '', error: 'fail' });
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,FALLBACK',
    } as any);

    const result = await dispatchThumbnailGeneration('auto', 'title', 'kw');

    expect(result.ok).toBe(true);
    expect(mockNano).toHaveBeenCalled();
  });

  it('명시 선택 "flow" 성공 → 그대로 반환', async () => {
    mockFlow.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,FLOW_OK',
      modelUsed: 'NARWHAL',
    });

    const result = await dispatchThumbnailGeneration('flow', 'title', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Flow/);
    expect(mockNano).not.toHaveBeenCalled();
  });
});

describe('에러 메시지 상세화 (v3.5.87)', () => {
  it('명시 "flow" 실패 → 사용자 onLog 콜백에 원본 에러 전달', async () => {
    mockFlow.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'FLOW_NO_FIFEURL: 응답 파싱 실패 상세 메시지',
    });

    const logs: string[] = [];
    const result = await dispatchThumbnailGeneration(
      'flow',
      'title',
      'kw',
      (msg) => logs.push(msg),
    );

    expect(result.ok).toBe(false);
    // onLog 에 원본 사유가 전달되어야 함 (기존: "Flow 실패" 만 전달됨)
    const joined = logs.join('\n');
    expect(joined).toMatch(/FLOW_NO_FIFEURL|응답 파싱 실패/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v3.5.88 — 나노바나나 3종 + GPT 이미지 2종 신규 엔진 케이스
// ═══════════════════════════════════════════════════════════════════════════

describe('v3.5.88 신규 엔진 — 나노바나나 3종', () => {
  it('SUPPORTED_IMAGE_ENGINES에 nanobanana/nanobanana2/nanobananapro 모두 포함', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobanana');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobanana2');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('nanobananapro');
  });

  it('normalizeImageEngine — nanobananapro는 더 이상 nanobanana로 흡수되지 않음 (정식 분리)', () => {
    expect(normalizeImageEngine('nanobananapro')).toBe('nanobananapro');
    expect(normalizeImageEngine('nanobanana2')).toBe('nanobanana2');
    expect(normalizeImageEngine('nano-banana-pro')).toBe('nanobananapro');
    expect(normalizeImageEngine('nanobanana-2')).toBe('nanobanana2');
  });

  it('nanobanana 선택 → modelId="gemini-2.5-flash-image"로 호출 (저비용)', async () => {
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,NB1',
    } as any);

    const result = await dispatchH2ImageGeneration('nanobanana', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/2\.5 저비용/);
    // makeNanoBananaProThumbnail에 modelId가 전달됐는지 검증
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-2.5-flash-image' }),
    );
  });

  it('nanobanana2 선택 → modelId="gemini-3.1-flash-image-preview" 호출 (Pro 품질·Flash 가격)', async () => {
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,NB2',
    } as any);

    const result = await dispatchH2ImageGeneration('nanobanana2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Nano Banana 2');
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-3.1-flash-image-preview' }),
    );
  });

  it('nanobananapro 선택 → modelId="gemini-3-pro-image-preview" 호출 (Pro 모델)', async () => {
    mockNano.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,NBP',
    } as any);

    const result = await dispatchH2ImageGeneration('nanobananapro', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Nano Banana Pro');
    expect(mockNano).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gemini-3-pro-image-preview' }),
    );
  });

  it('nanobananapro 실패 → 폴백 차단 (사용자 명시 선택 = strict)', async () => {
    mockNano.mockResolvedValue({
      ok: false,
      dataUrl: '',
      error: 'BILLING_REQUIRED',
    } as any);

    await expect(
      dispatchH2ImageGeneration('nanobananapro', 'test', 'kw'),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);
    // 다른 nanobanana 모델로 폴백되면 안 됨
    expect(mockFlow).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
    expect(mockGpt).not.toHaveBeenCalled();
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

  it('gptimage1 선택 → makeGptImageThumbnail({modelId:"gpt-image-1"}) 호출', async () => {
    mockGpt.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,GPT1',
    } as any);

    const result = await dispatchH2ImageGeneration('gptimage1', 'test', 'kw');

    expect(result.ok).toBe(true);
    // v3.5.89: quality 표시가 source 라벨에 포함됨 — 기본값 'medium'
    expect(result.source).toBe('GPT Image 1 · medium');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-1', quality: 'medium' }),
    );
  });

  it('gptimage1 + quality=low 전달 → API에 그대로 전달됨', async () => {
    mockGpt.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,GPT1LOW',
    } as any);

    const result = await dispatchH2ImageGeneration(
      'gptimage1',
      'test',
      'kw',
      undefined,
      undefined,
      { gptImageQuality: 'low' },
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
    mockGpt.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,GPT2HIGH',
    } as any);

    const result = await dispatchH2ImageGeneration(
      'gptimage2',
      'test',
      'kw',
      undefined,
      undefined,
      { gptImageQuality: 'high' },
    );
    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 2 (덕테이프) · high');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-2', quality: 'high' }),
    );
  });

  it('gptimage2(덕테이프) 인증 미완료 → OPENAI_VERIFICATION_REQUIRED 에러 + 폴백 차단', async () => {
    mockGpt.mockResolvedValue({
      ok: false,
      error: 'OPENAI_VERIFICATION_REQUIRED: gpt-image-2는 OpenAI 신분증 인증이 필요합니다.',
    } as any);

    const logs: string[] = [];
    await expect(
      dispatchH2ImageGeneration('gptimage2', 'test', 'kw', (m) => logs.push(m)),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);
    // 다른 엔진으로 폴백되면 안 됨
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
  });

  it('gptimage2 성공 → "GPT Image 2 (덕테이프) · medium" source 라벨', async () => {
    mockGpt.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,GPT2',
    } as any);

    const result = await dispatchH2ImageGeneration('gptimage2', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('GPT Image 2 (덕테이프) · medium');
    expect(mockGpt).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ modelId: 'gpt-image-2', quality: 'medium' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v3.5.90 — Prodia FLUX schnell (가성비 챔피언)
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
    mockProdia.mockResolvedValue({
      ok: true,
      dataUrl: 'data:image/png;base64,PRODIA',
    } as any);

    const result = await dispatchH2ImageGeneration('prodia', 'test', 'kw');

    expect(result.ok).toBe(true);
    expect(result.source).toBe('Prodia FLUX schnell');
    expect(mockProdia).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ model: 'flux-schnell', steps: 4 }),
    );
  });

  it('prodia 실패 → 폴백 차단 (사용자 명시 선택 = strict)', async () => {
    mockProdia.mockResolvedValue({
      ok: false,
      error: 'PRODIA_HTTP_429: rate limited',
    } as any);

    await expect(
      dispatchH2ImageGeneration('prodia', 'test', 'kw'),
    ).rejects.toThrow(/STRICT_ENGINE_FAILED/);
    // 다른 엔진으로 폴백되지 않음
    expect(mockNano).not.toHaveBeenCalled();
    expect(mockImageFx).not.toHaveBeenCalled();
    expect(mockGpt).not.toHaveBeenCalled();
  });
});

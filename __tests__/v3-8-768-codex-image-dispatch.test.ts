/**
 * v3.8.768 — Codex 구독 이미지 엔진을 디스패처·화면·메인에 연결한 배선 시험.
 * 엔진 본체(명령 조립·파일 수거)는 v3-8-768-codex-image-engine.test.ts 가 가짜 세션으로 시험한다.
 * 여기서는 엔진 본체를 가짜로 바꿔, 디스패처가 (1) 이 엔진을 알고 (2) 글자 규칙을 프롬프트에 넣고
 * (3) 실패해도 다른(유료) 엔진으로 자동 전환하지 않는지를 본다.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockMakeCodexImage = jest.fn();
jest.mock('../src/core/codex-image/codexImageEngine', () => ({
  makeCodexImage: (...args: unknown[]) => mockMakeCodexImage(...args),
}));

const mockNano = jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,NANO' }));
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: (...args: unknown[]) => (mockNano as any)(...args),
  makeDeepInfraThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,DEEP' })),
  makeGptImageThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,GPT' })),
  makeProdiaThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,PRODIA' })),
}));
jest.mock('../src/core/imagePromptInference', () => ({
  inferImagePrompt: jest.fn(async (prompt: string) => ({ prompt, provider: 'mock', cached: true })),
}));
// 유료 API 키가 전부 있는 PC: 자동 폴백이 살아 있다면 여기서 반드시 다른 엔진이 불린다.
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
jest.mock('../src/core/engine-stats', () => ({ recordSuccess: jest.fn(), recordFailure: jest.fn() }));
jest.mock('../src/core/image-generation-queue', () => ({
  runImageGenerationQueued: jest.fn(async (_meta: unknown, task: () => Promise<unknown>) => task()),
  describeImageEnginePacing: jest.fn(() => 'test'),
}));

import {
  SUPPORTED_IMAGE_ENGINES, normalizeImageEngine, engineAllowsImageText, pickI2iEngine,
  dispatchH2ImageGeneration, dispatchThumbnailGeneration,
} from '../src/core/imageDispatcher';

const root = path.join(__dirname, '..');
const read = (...parts: string[]): string => fs.readFileSync(path.join(root, ...parts), 'utf8');

const CONNECT = 'Codex 구독 이미지는 Codex 연결이 필요합니다 — 설정에서 [Agent 계정 연결]. 다른 이미지 엔진으로 바꾸지 않았습니다.';

beforeEach(() => {
  mockMakeCodexImage.mockReset();
  mockNano.mockClear();
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
  delete process.env['STRICT_THUMBNAIL_ENGINE'];
});

describe('엔진 등록', () => {
  test('지원 목록 · 별칭 · 글자 가능', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('codex-image');
    expect(normalizeImageEngine('codex-image')).toBe('codex-image');
    expect(normalizeImageEngine('Codex')).toBe('codex-image');
    expect(normalizeImageEngine('codeximage')).toBe('codex-image');
    expect(engineAllowsImageText('codex-image')).toBe(true);
  });

  test('쇼핑 모드에서도 유료 API 엔진으로 몰래 바꾸지 않는다(상품 사진을 못 쓰더라도)', () => {
    const env = { geminiKey: 'test-gemini-key-1234567890' };
    expect(pickI2iEngine('codex-image', env)).toEqual({ engine: 'codex-image', switched: false, reason: '' });
  });
});

describe('디스패처', () => {
  test('본문 이미지: 성공하면 Codex 출처로 돌려주고 글자 금지 규칙을 프롬프트에 넣는다', async () => {
    mockMakeCodexImage.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,CODEX', model: 'gpt-6-luna' });
    const result = await dispatchH2ImageGeneration('codex-image', '봄 벚꽃 길', '벚꽃');
    expect(result.ok).toBe(true);
    expect(result.dataUrl).toBe('data:image/png;base64,CODEX');
    expect(result.source).toContain('Codex 구독 이미지');
    const [prompt, options] = mockMakeCodexImage.mock.calls[0] as [string, { aspectRatio: string }];
    expect(prompt).toContain('NO Korean text');
    expect(options.aspectRatio).toBe('16:9');
  });

  test('썸네일: 제목을 그대로 그리라는 오버레이 규칙, "텍스트 없이" 를 켜면 글자 금지', async () => {
    mockMakeCodexImage.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,CODEX' });
    await dispatchThumbnailGeneration('codex-image', '2026 실업급여 조건 총정리', '실업급여');
    const withTitle = (mockMakeCodexImage.mock.calls[0] as [string])[0];
    expect(withTitle).toContain('TEXT OVERLAY (MANDATORY)');
    expect(withTitle).toContain('2026 실업급여 조건 총정리');

    mockMakeCodexImage.mockClear();
    await dispatchThumbnailGeneration('codex-image', '2026 실업급여 조건 총정리', '실업급여', undefined, { thumbnailNoText: true } as any);
    const noText = (mockMakeCodexImage.mock.calls[0] as [string])[0];
    expect(noText).not.toContain('TEXT OVERLAY');
    expect(noText).toContain('NO Korean text');
  });

  test.each([
    ['본문', () => dispatchH2ImageGeneration('codex-image', '봄 벚꽃 길', '벚꽃')],
    ['썸네일', () => dispatchThumbnailGeneration('codex-image', '봄 벚꽃 길', '벚꽃')],
  ])('%s: 실패해도 다른 엔진으로 자동 전환하지 않고, 같은 요청을 다시 보내지 않고, 연결 안내를 그대로 돌려준다', async (_name, run) => {
    mockMakeCodexImage.mockResolvedValue({ ok: false, dataUrl: '', error: CONNECT });
    const result = await run();
    expect(result.ok).toBe(false);
    expect(result.error).toBe(CONNECT);
    expect(mockMakeCodexImage).toHaveBeenCalledTimes(1);
    expect(mockNano).not.toHaveBeenCalled(); // 나노바나나/프로디아/딥인프라/GPT 모두 키가 있는데도 불리지 않는다
  });

  test('사용자 중지는 중지 신호 그대로(오류 안내 줄을 만들지 않는다)', async () => {
    mockMakeCodexImage.mockResolvedValue({ ok: false, dataUrl: '', error: 'CANCELED_BY_USER' });
    const logs: string[] = [];
    const result = await dispatchH2ImageGeneration('codex-image', 'x', 'y', (m) => logs.push(m));
    expect(result.error).toBe('CANCELED_BY_USER');
    expect(logs.join('\n')).not.toContain('Codex 구독 이미지 실패');
  });

  test('실패 로그에 안내 문구와 "자동 전환하지 않음" 이 남는다', async () => {
    mockMakeCodexImage.mockResolvedValue({ ok: false, dataUrl: '', error: CONNECT });
    const logs: string[] = [];
    await dispatchH2ImageGeneration('codex-image', 'x', 'y', (m) => logs.push(m));
    expect(logs.join('\n')).toContain('연결이 필요합니다');
    expect(logs.join('\n')).toContain('자동 전환하지 않습니다');
  });
});

describe('화면 · 메인 배선', () => {
  const html = read('electron', 'ui', 'index.html');
  const selectBlock = (id: string): string => {
    const start = html.indexOf(`<select id="${id}"`);
    return html.slice(start, html.indexOf('</select>', start));
  };

  test.each(['thumbnailType', 'h2ImageSource', 'scheduleThumbnailMode', 'thumbnailGenAiEngine', 'swThumbnailEngine', 'swH2ImageEngine'])(
    '#%s 목록에 Codex 구독 이미지가 있다', (id) => {
      expect(selectBlock(id)).toContain('value="codex-image"');
    });

  test.each(['thumbnailType', 'h2ImageSource'])('#%s 의 기본 선택이 Codex 구독 이미지다(나노바나나2 의 selected 는 없다)', (id) => {
    const block = selectBlock(id);
    expect(block).toMatch(/<option value="codex-image" selected>/);
    expect(block).not.toMatch(/<option value="nanobanana2" selected>/);
  });

  test('다중계정: 계정 카드 목록 · 고급 설정 목록 · 기본값', () => {
    expect(html).toMatch(/value="codex-image" \$\{\(!account\.settings\.imageSource \|\| account\.settings\.imageSource === 'codex-image'\) \? 'selected' : ''\}/);
    expect(html).not.toMatch(/\$\{\(!account\.settings\.imageSource \|\| account\.settings\.imageSource === 'nanobanana2'\)/);
    const multi = read('electron', 'ui', 'modules', 'multi-account.js');
    expect(multi).toContain("['codex-image', 'Codex 구독 이미지']");
    expect(multi).not.toMatch(/\|\| 'nanobanana2'/);
    expect(multi).toMatch(/imageSource: defaults\.thumbnailSource \|\| 'codex-image'/);
  });

  test('연속발행 대기열: 목록 4곳 + 이름표 + 새 항목 기본값', () => {
    const queue = read('electron', 'ui', 'modules', 'publish-queue.js');
    expect(queue.match(/value="codex-image"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(queue).toContain("'codex-image': 'Codex 구독'");
    expect(queue).toMatch(/if \(!raw \|\| raw === 'auto'\) return 'codex-image'/);
  });

  test('비용표: 추가 비용 0원', () => {
    const script = read('electron', 'ui', 'script.js');
    expect(script).toMatch(/'codex-image': 0,\s*\/\/ v3\.8\.768/);
    expect(script.match(/'codex-image': 0/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('에이전트 실행 준비 확인이 이 엔진을 연결 확인 채널로 점검한다', () => {
    const ws = read('electron', 'ui', 'modules', 'codex-workshop.js');
    expect(ws).toContain("kind: 'codex-image'");
    expect(ws).toContain("'codex-image:check-ready'");
  });

  test('메인: 실행 환경 등록 + 연결 확인 채널(../dist 경로, API 키는 지움)', () => {
    const main = read('electron', 'main.ts');
    expect(main).toContain("require('../dist/core/codex-image/codexImageRuntime')");
    expect(main).toContain("require('../dist/core/codex-image/codexImageReadiness')");
    expect(main).toContain("ipcMain.handle('codex-image:check-ready'");
    expect(main).toContain('setCodexImageRuntime(');
    expect(main).not.toMatch(/require\('\.\.\/src\/core\/codex-image/);
  });
});

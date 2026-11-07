/**
 * v3.8.770 — 연속발행·다중계정의 "제목(썸네일) 글자 / 소제목 글자" 체크.
 *
 * 구조(조사 결과):
 *  - 썸네일 글자: 기존 키 thumbnailNoText(API 경로) / thumbnailTextIncluded·thumbnailIncludeText(Agent 경로)를 그대로 쓴다.
 *  - 소제목 글자: 기존에 false 로 박혀 있던 h2TextIncluded 를 실제 값으로 쓴다 (새 키 없음).
 *  - 생성기: 소제목 이미지는 원래 글자 금지 → extra.sectionImageText 가 켜진 글자 가능 엔진만 글자를 허용한다.
 * 기본값은 전부 예전 동작(썸네일 글자 포함 · 소제목 글자 없음)이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { linesAfter } from './helpers/source-block';

const mockNano = jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,NANO' }));
const mockCodex = jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,CODEX' }));
jest.mock('../src/core/codex-image/codexImageEngine', () => ({
  makeCodexImage: (...args: unknown[]) => (mockCodex as any)(...args),
}));
jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: (...args: unknown[]) => (mockNano as any)(...args),
  makeDeepInfraThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,DEEP' })),
  makeGptImageThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,GPT' })),
  makeProdiaThumbnail: jest.fn(async () => ({ ok: true, dataUrl: 'data:image/png;base64,PRODIA' })),
}));
jest.mock('../src/core/imagePromptInference', () => ({
  inferImagePrompt: jest.fn(async (prompt: string) => ({ prompt, provider: 'mock', cached: true })),
}));
jest.mock('../src/env', () => ({
  loadEnvFromFile: jest.fn(() => ({ geminiKey: 'test-gemini-key-1234567890', deepInfraApiKey: 'test-deepinfra-key-1234567890' })),
}));
jest.mock('../src/core/engine-stats', () => ({ recordSuccess: jest.fn(), recordFailure: jest.fn() }));
jest.mock('../src/core/image-generation-queue', () => ({
  runImageGenerationQueued: jest.fn(async (_meta: unknown, task: () => Promise<unknown>) => task()),
  describeImageEnginePacing: jest.fn(() => 'test'),
}));

import { dispatchH2ImageGeneration } from '../src/core/imageDispatcher';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

beforeEach(() => {
  mockNano.mockClear();
  mockCodex.mockClear();
  delete process.env['STRICT_H2_IMAGE_ENGINE'];
});

describe('① 생성기: 소제목 글자는 켰을 때만, 글자 가능 엔진에서만', () => {
  test('기본(끔): 소제목 이미지는 예전처럼 글자 금지', async () => {
    await dispatchH2ImageGeneration('codex-image', '신청 방법 총정리', '신청');
    const prompt = (mockCodex.mock.calls[0] as unknown as [string])[0];
    expect(prompt).toContain('NO Korean text');
    expect(prompt).not.toContain('TEXT OVERLAY');
  });

  test('켬: 깨끗한 소제목을 그대로 그리라는 규칙이 들어간다 (변주 문구는 글자로 새지 않는다)', async () => {
    await dispatchH2ImageGeneration(
      'codex-image', '신청 방법 총정리 [Section 2 of 6: MUST show a unique scene]', '신청', undefined, undefined,
      { sectionImageText: true, sectionImageTitle: '신청 방법 총정리' },
    );
    const prompt = (mockCodex.mock.calls[0] as unknown as [string])[0];
    expect(prompt).toContain('TEXT OVERLAY (MANDATORY)');
    expect(prompt).toContain('"신청 방법 총정리"');
    expect(prompt).not.toContain('Section 2 of 6" as');
    expect(prompt).not.toMatch(/Render the exact KOREAN title "[^"]*Section/);
  });

  test('켬 + 나노바나나: 글자 허용 구도(isThumbnail)로 부르고 제목은 깨끗한 소제목이다', async () => {
    await dispatchH2ImageGeneration(
      'nanobanana2', '비용 안내 [Section 3 of 6]', '비용', undefined, undefined,
      { sectionImageText: true, sectionImageTitle: '비용 안내' },
    );
    const args = mockNano.mock.calls[0] as unknown as [string, string, { isThumbnail: boolean; noTextOverlay: boolean }];
    expect(args[0]).toBe('비용 안내');
    expect(args[2].isThumbnail).toBe(true);
    expect(args[2].noTextOverlay).toBe(false);
  });

  test('끔 + 나노바나나: 예전과 같이 소제목 구도(isThumbnail=false)', async () => {
    await dispatchH2ImageGeneration('nanobanana2', '비용 안내', '비용');
    const args = mockNano.mock.calls[0] as unknown as [string, string, { isThumbnail: boolean }];
    expect(args[0]).toBe('비용 안내');
    expect(args[2].isThumbnail).toBe(false);
  });

  test('글자를 못 그리는 엔진(deepinfra)은 켜도 그대로 글자 금지', async () => {
    const { makeDeepInfraThumbnail } = jest.requireMock('../src/thumbnail');
    await dispatchH2ImageGeneration('deepinfra', '비용 안내', '비용', undefined, undefined, { sectionImageText: true, sectionImageTitle: '비용 안내' });
    const [prompt] = (makeDeepInfraThumbnail as jest.Mock).mock.calls[0] as [string];
    expect(prompt).toContain('NO');
  });
});

describe('② 배선: 대기열', () => {
  const Q = read('electron/ui/modules/publish-queue.js');

  test('항목 모델: 썸네일은 기존 thumbnailNoText, 소제목은 h2TextIncluded', () => {
    expect(Q).toContain('h2TextIncluded: snap.h2TextIncluded === true,');
    expect(Q).toContain('h2TextIncluded: item.h2TextIncluded,');
    expect(Q).toContain('if (force || item.h2TextIncluded == null) item.h2TextIncluded = snap.h2TextIncluded;');
  });

  test('payload: 두 경로(API·Agent)가 쓰는 이름으로 모두 싣는다', () => {
    expect(Q).toContain('thumbnailTextIncluded: !item.thumbnailNoText,');
    expect(Q).toContain('thumbnailIncludeText: !item.thumbnailNoText,');
    expect(Q).toContain('h2TextIncluded: item.h2TextIncluded === true,');
  });

  test('카드·일괄 바: 체크와 일괄 적용 칸이 있고 값을 항목에 쓴다', () => {
    expect(Q).toContain('class="pq-item-thumb-text"');
    expect(Q).toContain('class="pq-item-h2-text"');
    expect(Q).toContain("item.thumbnailNoText = !e.target.checked;");
    expect(Q).toContain("item.h2TextIncluded = e.target.checked;");
    expect(Q).toContain('id="pq-bulk-thumb-text"');
    expect(Q).toContain('id="pq-bulk-h2-text"');
    expect(Q).toContain("if (bulkThumbText) item.thumbnailNoText = bulkThumbText === 'off';");
    expect(Q).toContain("if (bulkH2Text) item.h2TextIncluded = bulkH2Text === 'on';");
  });

  test('예약 실행: 저장된 값이 있으면 그대로 쓴다 (없으면 키를 넘기지 않는다)', () => {
    const S = read('electron/ui/script.js');
    expect(S).toContain('const storedH2TextIncluded = schedule.h2TextIncluded ?? storedPayload.h2TextIncluded;');
    expect(S).toContain('...scheduleImageTextOverride,');
  });
});

describe('③ 배선: 다중계정', () => {
  const M = read('electron/ui/modules/multi-account.js');
  const MAIN = read('electron/main.ts');

  test('화면: 체크 두 개가 상세 설정 카드에 있다', () => {
    expect(M).toContain('id="multiThumbnailText"');
    expect(M).toContain('id="multiH2Text"');
  });

  test('payload: 고른 값이 API·Agent 이름 모두로 실린다', () => {
    expect(M).toContain('thumbnailNoText: !thumbnailTextIncluded,');
    expect(M).toContain('thumbnailTextIncluded,');
    expect(M).toContain('thumbnailIncludeText: thumbnailTextIncluded,');
    expect(M).toContain('h2TextIncluded,');
  });

  test('main.ts 핸들러가 필드를 골라 담으므로 이름을 직접 적어야 한다', () => {
    const block = linesAfter(MAIN, "ipcMain.handle('run-multi-account-post'", 220);
    expect(block).toContain('thumbnailNoText?: boolean;');
    expect(block).toContain('h2TextIncluded?: boolean;');
    expect(block).toContain('thumbnailNoText: payload.thumbnailNoText === true,');
    expect(block).toContain('h2TextIncluded: payload.h2TextIncluded === true,');
  });
});

describe('④ 배선: Agent 이미지 경로', () => {
  test('Agent 소제목 이미지: 켰을 때만 글자 프롬프트, 호출에 소제목을 싣는다', () => {
    const W = read('electron/ui/modules/codex-workshop.js');
    expect(W).toContain('const h2TextIncluded = payload.h2TextIncluded === true;');
    expect(W).toContain('buildAgentH2ImagePrompt(h2Text, topic, h2TextIncluded)');
    expect(W).toContain('sectionImageTitle');
  });

  test('batch-image-generate 가 소제목 글자 값을 생성기 extra 로 넘긴다', () => {
    const MAIN = read('electron/main.ts');
    expect(MAIN).toContain('extra.sectionImageText = true;');
    expect(MAIN).toContain('extra.sectionImageTitle = String(payload.sectionImageTitle');
  });
});

describe('⑤ 생성기 입구: orchestration', () => {
  test('payload.h2TextIncluded === true 일 때만 소제목 호출에 싣는다', () => {
    const O = read('src/core/final/orchestration.ts');
    expect(O).toContain('if (payload.h2TextIncluded === true) {');
    expect(O).toContain('dispatchExtra.sectionImageText = true;');
    expect(O).toContain('dispatchExtra.sectionImageTitle = section.h2;');
  });
});

// ────────────────────────────────────────────────────────────
// ⑥ 대기열 모듈을 실제로 돌려 화면 → 항목 → payload 를 본다
// ────────────────────────────────────────────────────────────
function loadQueue(fields: Record<string, string>, checks: Record<string, boolean>, agentMode?: Record<string, unknown>) {
  const els: Record<string, any> = {};
  Object.entries(fields).forEach(([id, value]) => { els[id] = { value, textContent: '', style: {}, options: [] }; });
  Object.entries(checks).forEach(([id, checked]) => { els[id] = { checked, value: '', style: {}, options: [] }; });
  const document = {
    getElementById: (id: string) => els[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [] as any[],
  };
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  const win: any = agentMode ? { getAgentImageSettingsMode: () => agentMode } : {};
  const src = read('electron/ui/modules/publish-queue.js').replace(/^import[^\n]*\n/m, '').replace(/^export /gm, '');
  const expose = '; return { STATE, getCurrentQueueSnapshot, buildQueuePayloadOverrides, addCurrent };';
  // eslint-disable-next-line no-new-func
  return new Function('window', 'document', 'localStorage', 'alert', 'confirm', 'console', src + expose)(
    win, document, localStorage, () => undefined, () => true, console,
  );
}

describe('⑥ 대기열 실행 왕복', () => {
  const stamp = new Date().toISOString();

  test('기본: 썸네일 글자 있음 · 소제목 글자 없음 (예전 동작 그대로)', () => {
    const api = loadQueue({ keywordInput: '키워드A' }, { thumbnailNoText: false });
    api.addCurrent();
    const p = api.buildQueuePayloadOverrides(api.STATE.keywords[0], stamp);
    expect(p.thumbnailNoText).toBe(false);
    expect(p.thumbnailTextIncluded).toBe(true);
    expect(p.thumbnailIncludeText).toBe(true);
    expect(p.h2TextIncluded).toBe(false);
  });

  test('단일 화면의 "텍스트 없이" 체크는 대기열 기본값으로 이어진다', () => {
    const api = loadQueue({ keywordInput: '키워드A' }, { thumbnailNoText: true });
    api.addCurrent();
    const p = api.buildQueuePayloadOverrides(api.STATE.keywords[0], stamp);
    expect(p.thumbnailNoText).toBe(true);
    expect(p.thumbnailTextIncluded).toBe(false);
  });

  test('Agent 모드에서 패널이 "미포함"이면 대기열 기본값도 미포함 (예전 동작 유지)', () => {
    const api = loadQueue({ keywordInput: '키워드A' }, { thumbnailNoText: false }, { isAgentMode: true, thumbnailTextIncluded: false });
    api.addCurrent();
    const p = api.buildQueuePayloadOverrides(api.STATE.keywords[0], stamp);
    expect(p.thumbnailTextIncluded).toBe(false);
    expect(p.thumbnailNoText).toBe(true);
  });

  test('항목별로 고친 값이 각자의 payload 로 간다', () => {
    const api = loadQueue({ keywordInput: '키워드A\n키워드B' }, { thumbnailNoText: false });
    api.addCurrent();
    api.STATE.keywords[0].h2TextIncluded = true;      // 카드에서 소제목 글자 켬
    api.STATE.keywords[1].thumbnailNoText = true;     // 카드에서 제목 글자 끔
    const p0 = api.buildQueuePayloadOverrides(api.STATE.keywords[0], stamp);
    const p1 = api.buildQueuePayloadOverrides(api.STATE.keywords[1], stamp);
    expect(p0.h2TextIncluded).toBe(true);
    expect(p0.thumbnailTextIncluded).toBe(true);
    expect(p1.h2TextIncluded).toBe(false);
    expect(p1.thumbnailTextIncluded).toBe(false);
    expect(p1.thumbnailNoText).toBe(true);
  });
});

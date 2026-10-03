jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(), makeGptImageThumbnail: jest.fn(),
  makeProdiaThumbnail: jest.fn(), applyBottomTextOverlay: jest.fn(),
}));
jest.mock('../src/env', () => ({ loadEnvFromFile: () => ({
  GEMINI_API_KEY: 'test-gemini-key-1234', OPENAI_API_KEY: 'test-openai-key-1234', PRODIA_API_KEY: 'test-prodia-key-1234',
}) }));
jest.mock('../src/utils/license-tier-manager', () => ({ checkImageGenAccess: jest.fn() }));
jest.mock('../src/core/image-generation-queue', () => ({ runImageGenerationQueued: (_: unknown, task: () => unknown) => task() }));
jest.mock('../src/core/imagePromptInference', () => ({ inferImagePrompt: jest.fn(async (prompt: string) => ({ prompt, cached: true })) }));
jest.mock('../src/core/engine-stats', () => ({ recordSuccess: jest.fn(), recordFailure: jest.fn() }));
jest.mock('../src/core/final/image-aspect', () => ({ PUBLISH_ASPECT_RATIO: 16 / 9, padDataUrlToAspect: async (data: string) => data }));

import { generateEditorImage } from '../src/core/final/editor-image';
import { makeGptImageThumbnail, makeNanoBananaProThumbnail, makeProdiaThumbnail, applyBottomTextOverlay } from '../src/thumbnail';
import { checkImageGenAccess } from '../src/utils/license-tier-manager';
import { resetImageDispatcherEnvCache } from '../src/core/imageDispatcher';

const upload = jest.fn(async () => 'https://images.example/editor.png');
const log = jest.fn();
const dataUrl = 'data:image/png;base64,bW9ja2Vk';
const result = { ok: true, dataUrl };
beforeEach(() => {
  jest.clearAllMocks();
  resetImageDispatcherEnvCache();
  (checkImageGenAccess as jest.Mock).mockReturnValue({ allowed: true });
  (makeGptImageThumbnail as jest.Mock).mockResolvedValue(result);
  (makeNanoBananaProThumbnail as jest.Mock).mockResolvedValue(result);
  (makeProdiaThumbnail as jest.Mock).mockResolvedValue(result);
  (applyBottomTextOverlay as jest.Mock).mockResolvedValue('data:image/png;base64,dGV4dA==');
});

describe('편집기 이미지 생성의 모델·텍스트·호출 계약', () => {
  test.each([['gptimage25flare', 'gpt-image-2.5-flare'], ['gptimage25sunburst', 'gpt-image-2.5-sunburst'], ['gptimage2', 'gpt-image-2']])(
    '%s 썸네일은 선택 모델과 텍스트 포함을 실제 생성기에 전달한다', async (engine, modelId) => {
      const made = await generateEditorImage({ title: '모집 신청 안내', kind: 'thumbnail', thumbnailText: true,
        payload: { h2ImageSource: engine, thumbnailSource: 'nanobanana', gptImageQuality: 'low' },
      }, {}, log, { upload });
      expect(made.ok).toBe(true);
      expect(makeGptImageThumbnail).toHaveBeenCalledWith('모집 신청 안내', '모집 신청 안내', expect.objectContaining({ modelId, isThumbnail: true, quality: 'low' }));
      expect(makeNanoBananaProThumbnail).not.toHaveBeenCalled();
      expect(applyBottomTextOverlay).not.toHaveBeenCalled();
      expect(checkImageGenAccess).toHaveBeenCalledWith({ allowFreeTrialPublishing: true });
    },
  );

  test('텍스트 해제시 GPT 썸네일의 글자 생성 경로를 끈다', async () => {
    await generateEditorImage({ title: '제목', kind: 'thumbnail', thumbnailText: false, payload: { imageSource: 'gptimage25flare' } }, {}, log, { upload });
    expect(makeGptImageThumbnail).toHaveBeenCalledWith('제목', '제목', expect.objectContaining({ isThumbnail: false }));
    expect(applyBottomTextOverlay).not.toHaveBeenCalled();
  });

  test.each([true, false])('Nano Banana 썸네일 텍스트=%s는 noTextOverlay에 반영된다', async (thumbnailText) => {
    await generateEditorImage({ title: '제목', thumbnailText, payload: { imageSource: 'nanobanana2' } }, {}, log, { upload });
    expect(makeNanoBananaProThumbnail).toHaveBeenCalledWith('제목', '제목', expect.objectContaining({ isThumbnail: true, noTextOverlay: !thumbnailText }));
  });

  test('본문은 체크박스와 무관하게 소제목을 반영한 무문자 이미지다', async () => {
    await generateEditorImage({ title: '신청 안내', kind: 'section', sectionTitle: '제출 서류', thumbnailText: true, payload: { imageSource: 'gptimage25flare' } }, {}, log, { upload });
    expect(makeGptImageThumbnail).toHaveBeenCalledWith(expect.stringContaining('제출 서류'), '신청 안내', expect.objectContaining({ isThumbnail: false }));
    expect(applyBottomTextOverlay).not.toHaveBeenCalled();
  });

  test('텍스트 비지원 엔진도 다른 AI로 바꾸지 않고 로컬 제목 합성을 한다', async () => {
    const made = await generateEditorImage({ title: '입주 신청', thumbnailText: true, payload: { imageSource: 'prodia' } }, {}, log, { upload });
    expect(made.ok).toBe(true);
    expect(makeProdiaThumbnail).toHaveBeenCalledTimes(1);
    expect(applyBottomTextOverlay).toHaveBeenCalledWith(dataUrl, '입주 신청', 1280, 720);
    expect(upload).toHaveBeenCalledWith('data:image/png;base64,dGV4dA==', 'editor');
    expect(makeGptImageThumbnail).not.toHaveBeenCalled();
    expect(makeNanoBananaProThumbnail).not.toHaveBeenCalled();
  });

  test('로컬 제목 합성은 실제 PNG를 만들고 한글·특수문자를 처리한다 (네트워크 없음)', async () => {
    const sharp = require('sharp');
    const actual = jest.requireActual('../src/thumbnail');
    const background = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#446688' } }).png().toBuffer();
    const data = await actual.applyBottomTextOverlay(`data:image/png;base64,${background.toString('base64')}`, '신청 안내 & 서류 <확인>', 1280, 720);
    const output = Buffer.from(data.split(',')[1], 'base64');
    expect(await sharp(output).metadata()).toMatchObject({ format: 'png', width: 1280, height: 720 });
    expect(output.equals(background)).toBe(false);
    expect(makeGptImageThumbnail).not.toHaveBeenCalled();
  });

  test('자동 엔진도 텍스트 포함을 보장하도록 무문자 생성 후 로컬 합성한다', async () => {
    const made = await generateEditorImage({ title: '자동 엔진 제목', thumbnailText: true, payload: { imageSource: 'auto' } }, {}, log, { upload });
    expect(made.ok).toBe(true);
    expect(makeNanoBananaProThumbnail).toHaveBeenCalledWith('자동 엔진 제목', '자동 엔진 제목', expect.objectContaining({ noTextOverlay: true }));
    expect(applyBottomTextOverlay).toHaveBeenCalledWith(dataUrl, '자동 엔진 제목', 1280, 720);
  });

  test.each(['thumbnail', 'section'] as const)('%s 실패시 추가 시도·타엔진·업로드를 하지 않는다', async (kind) => {
    (makeGptImageThumbnail as jest.Mock).mockResolvedValue({ ok: false, error: 'API budget exhausted' });
    const made = await generateEditorImage({ title: '제목', kind, sectionTitle: '서류', payload: { imageSource: 'gptimage25flare' } }, {}, log, { upload });
    expect(made.ok).toBe(false);
    expect(makeGptImageThumbnail).toHaveBeenCalledTimes(1);
    expect(makeNanoBananaProThumbnail).not.toHaveBeenCalled();
    expect(makeProdiaThumbnail).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('라이선스 차단시 이미지 생성 없이 반환한다', async () => {
    (checkImageGenAccess as jest.Mock).mockReturnValue({ allowed: false, reason: 'expired', message: '사용 기간 만료' });
    const made = await generateEditorImage({ title: '제목', payload: { imageSource: 'gptimage25flare' } }, {}, log, { upload });
    expect(made).toMatchObject({ ok: false, error: 'PAYMENT_REQUIRED:expired' });
    expect(makeGptImageThumbnail).not.toHaveBeenCalled();
  });

  test.each([
    { title: '' }, { title: 'a'.repeat(1001) }, { title: '제목', kind: 'section' },
    { title: '제목', kind: 'wrong' }, { title: '제목', thumbnailText: 'false' },
  ])('잘못된 입력은 생성 이전에 거절한다: %j', async (args) => {
    expect((await generateEditorImage(args as any, {}, log, { upload })).ok).toBe(false);
    expect(makeGptImageThumbnail).not.toHaveBeenCalled();
    expect(makeNanoBananaProThumbnail).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('생성 후 후처리 실패는 생성 비용 없이 이어 처리한다', () => {
  const request = { title: '다시 처리할 제목', thumbnailText: true, payload: { imageSource: 'prodia' } };
  const deps = () => ({
    thumbnail: jest.fn(async () => ({ ok: true, dataUrl, source: 'Prodia' })),
    overlay: jest.fn(async () => 'data:image/png;base64,Y29tcG9zZWQ='),
    upload: jest.fn(async () => 'https://images.example/recovered.png'),
  });

  test('합성 실패 후 토큰으로 재시도해도 유료 생성은 한 번뿐이다', async () => {
    const d = deps();
    d.overlay.mockRejectedValueOnce(new Error('temporary overlay error'));
    const failed = await generateEditorImage(request, {}, log, d);
    expect(failed.ok).toBe(false);
    expect(failed.retryToken).toEqual(expect.any(String));
    const success = await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d);
    expect(success.ok).toBe(true);
    expect(d.thumbnail).toHaveBeenCalledTimes(1);
    expect(d.overlay).toHaveBeenCalledTimes(2);
    expect(d.upload).toHaveBeenCalledTimes(1);
    // Consumed tokens cannot silently trigger a newly paid generation.
    expect((await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d)).ok).toBe(false);
    expect(d.thumbnail).toHaveBeenCalledTimes(1);
  });

  test('합성 후 업로드 실패는 합성한 원본을 보관하고 업로드만 재시도한다', async () => {
    const d = deps();
    d.upload.mockRejectedValueOnce(new Error('temporary upload error'));
    const failed = await generateEditorImage(request, {}, log, d);
    expect(failed.retryToken).toEqual(expect.any(String));
    const success = await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d);
    expect(success.ok).toBe(true);
    expect(d.thumbnail).toHaveBeenCalledTimes(1);
    expect(d.overlay).toHaveBeenCalledTimes(1);
    expect(d.upload).toHaveBeenNthCalledWith(2, 'data:image/png;base64,Y29tcG9zZWQ=', 'editor');
  });

  test('업로드가 빈 URL을 반환해도 기존 생성 이미지를 이어 쓴다', async () => {
    const d = deps();
    d.upload.mockResolvedValueOnce('');
    const failed = await generateEditorImage(request, {}, log, d);
    expect((await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d)).ok).toBe(true);
    expect(d.thumbnail).toHaveBeenCalledTimes(1);
  });

  test.each([
    { title: '다른 제목' }, { kind: 'section', sectionTitle: '다른 절' },
    { thumbnailText: false }, { payload: { imageSource: 'gptimage25flare' } },
  ])('다른 요청에서는 캐시를 재사용하거나 새로 생성하지 않는다: %j', async (changed) => {
    const d = deps();
    d.upload.mockRejectedValueOnce(new Error('offline'));
    const failed = await generateEditorImage(request, {}, log, d);
    const mismatch = await generateEditorImage({ ...request, ...changed, retryToken: failed.retryToken } as any, {}, log, d);
    expect(mismatch).toMatchObject({ ok: false, retryToken: failed.retryToken });
    expect(mismatch.error).toContain('설정이 다릅니다');
    expect(d.thumbnail).toHaveBeenCalledTimes(1);
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect((await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d)).ok).toBe(true);
  });

  test('1시간 지난 토큰은 유료 생성으로 전환하지 않는다', async () => {
    const d = deps();
    d.upload.mockRejectedValueOnce(new Error('offline'));
    const failed = await generateEditorImage(request, {}, log, d);
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1);
    try {
      const expired = await generateEditorImage({ ...request, retryToken: failed.retryToken }, {}, log, d);
      expect(expired.ok).toBe(false);
      expect(expired.error).toContain('만료');
      expect(d.thumbnail).toHaveBeenCalledTimes(1);
    } finally { clock.mockRestore(); }
  });

  test('미완료 이미지 보관은 최대 4개이며 오래된 토큰도 새 생성으로 전환하지 않는다', async () => {
    const d = deps();
    d.upload.mockRejectedValue(new Error('offline'));
    const failed = [];
    for (let i = 0; i < 5; i++) failed.push(await generateEditorImage({ ...request, title: `제목 ${i}` }, {}, log, d));
    const missing = await generateEditorImage({ ...request, title: '제목 0', retryToken: failed[0]!.retryToken }, {}, log, d);
    expect(missing.ok).toBe(false);
    expect(d.thumbnail).toHaveBeenCalledTimes(5);
  });
});

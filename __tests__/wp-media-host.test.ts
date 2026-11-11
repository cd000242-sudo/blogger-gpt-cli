jest.mock('../src/thumbnail', () => ({
  makeNanoBananaProThumbnail: jest.fn(), makeGptImageThumbnail: jest.fn(),
  makeProdiaThumbnail: jest.fn(), applyBottomTextOverlay: jest.fn(),
}));
jest.mock('../src/env', () => ({ loadEnvFromFile: () => ({}) }));
jest.mock('../src/utils/license-tier-manager', () => ({ checkImageGenAccess: jest.fn() }));

import { pickWpMediaCreds, uploadDataUrlToWpMedia, wpMediaProvider } from '../src/core/final/wp-media-host';
import { generateEditorImage } from '../src/core/final/editor-image';
import * as fs from 'fs';
import * as path from 'path';

const dataUrl = 'data:image/png;base64,bW9ja2Vk';
const creds = { siteUrl: 'https://wp.example', username: 'test-user', password: 'test-secret-pass' };
const BASIC = Buffer.from('test-user:test-secret-pass').toString('base64');

describe('pickWpMediaCreds — 워드프레스 자격증명 읽기', () => {
  it('화면 payload 키(wordpress*)에서 읽고 사이트 주소 끝 슬래시를 뗀다', () => {
    expect(pickWpMediaCreds({ wordpressSiteUrl: ' https://wp.example/// ', wordpressUsername: 'u', wordpressPassword: 'p' }))
      .toEqual({ siteUrl: 'https://wp.example', username: 'u', password: 'p' });
  });
  it('.env 키(WORDPRESS_*)도 읽고, 앞 출처가 우선한다 (종합글 핸들러가 읽던 키와 같다)', () => {
    expect(pickWpMediaCreds({ wordpressSiteUrl: 'https://a.example' }, { WORDPRESS_SITE_URL: 'https://b.example', WORDPRESS_USERNAME: 'u', WORDPRESS_PASSWORD: 'p' }))
      .toEqual({ siteUrl: 'https://a.example', username: 'u', password: 'p' });
  });
  it('하나라도 비면 null', () => {
    expect(pickWpMediaCreds({ wordpressSiteUrl: 'https://a.example', wordpressUsername: 'u' })).toBeNull();
    expect(pickWpMediaCreds({}, undefined)).toBeNull();
  });
});

describe('uploadDataUrlToWpMedia — media 엔드포인트 업로드 (종합글 핸들러가 하던 그대로)', () => {
  const okPost = () => jest.fn(async () => ({ data: { source_url: 'https://wp.example/wp-content/uploads/x.png' } }));

  it('/wp-json/wp/v2/media 로 이미지 바이트와 헤더를 보내고 source_url 을 돌려준다', async () => {
    const post = okPost();
    const url = await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', platform: 'wordpress', post });
    expect(url).toBe('https://wp.example/wp-content/uploads/x.png');
    expect(post).toHaveBeenCalledTimes(1);
    const [endpoint, body, config] = (post.mock.calls[0] as unknown) as [string, Buffer, any];
    expect(endpoint).toBe('https://wp.example/wp-json/wp/v2/media');
    expect(body.toString()).toBe('mocked');
    expect(config.headers['Content-Type']).toBe('image/png');
    expect(config.headers['Content-Disposition']).toMatch(/^attachment; filename="editor-\d+\.png"$/);
    expect(config.headers.Authorization).toBe(`Basic ${BASIC}`);
    expect(config.timeout).toBe(60000);
  });

  it('source_url 이 없으면 guid.rendered 를 쓴다', async () => {
    const post = jest.fn(async () => ({ data: { guid: { rendered: 'https://wp.example/g.png' } } }));
    expect(await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', post })).toBe('https://wp.example/g.png');
  });

  it('첫 시도가 실패하면 한 번 더, 두 번 다 실패하면 null (호출자가 외부 호스팅으로 넘어간다)', async () => {
    const flaky = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { source_url: 'https://wp.example/second.png' } });
    expect(await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', post: flaky, retryDelayMs: 0 })).toBe('https://wp.example/second.png');
    expect(flaky).toHaveBeenCalledTimes(2);

    const dead = jest.fn(async () => { throw new Error('403'); });
    expect(await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', post: dead, retryDelayMs: 0 })).toBeNull();
    expect(dead).toHaveBeenCalledTimes(2);
  });

  it('이미지 data URL 이 아니면 요청 없이 null', async () => {
    const post = okPost();
    expect(await uploadDataUrlToWpMedia('https://x.example/a.png', creds, { label: 'editor', post })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('로그에 비밀번호·Authorization 값이 없다', async () => {
    const logs: string[] = [];
    for (const name of ['log', 'warn', 'error'] as const) {
      jest.spyOn(console, name).mockImplementation((...args: unknown[]) => { logs.push(args.join(' ')); });
    }
    await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', post: okPost() });
    await uploadDataUrlToWpMedia(dataUrl, creds, { label: 'editor', post: jest.fn(async () => { throw new Error('boom'); }), retryDelayMs: 0 });
    const dump = logs.join('\n');
    expect(dump).not.toContain('test-secret-pass');
    expect(dump).not.toContain(BASIC);
    jest.restoreAllMocks();
  });

  it('provider 이름: 워드프레스 글이면 wp-media, 다른 플랫폼이 빌려 쓰면 wp-media-hotlink', () => {
    expect(wpMediaProvider('wordpress')).toBe('wp-media');
    expect(wpMediaProvider('blogger')).toBe('wp-media-hotlink');
    expect(wpMediaProvider('')).toBe('wp-media-hotlink');
  });
});

describe('편집기 이미지 다시 생성 — 워드프레스 글이면 워드프레스 미디어에 먼저 올린다', () => {
  const log = jest.fn();
  const thumbnail = jest.fn(async () => ({ ok: true, dataUrl, source: 'mock' })) as any;
  const upload = jest.fn(async () => 'https://iili.io/external.png');
  const wpUpload = jest.fn(async () => 'https://wp.example/wp-content/uploads/editor.png');
  const wpPayload = { platform: 'wordpress', wordpressSiteUrl: creds.siteUrl, wordpressUsername: creds.username, wordpressPassword: creds.password, imageSource: 'nanobanana2' };
  const run = (payload: Record<string, unknown>, env: Record<string, string> = {}) =>
    generateEditorImage({ title: '종합 가이드', kind: 'thumbnail', thumbnailText: false, payload }, env, log, { thumbnail, upload, wpUpload });

  beforeEach(() => { jest.clearAllMocks(); });

  it('워드프레스 + 자격증명 → media 업로드가 먼저, 외부 호스팅은 안 부른다, provider 는 wp-media', async () => {
    const made: any = await run(wpPayload);
    expect(made.ok).toBe(true);
    expect(wpUpload).toHaveBeenCalledTimes(1);
    expect(wpUpload).toHaveBeenCalledWith(dataUrl, creds, expect.objectContaining({ label: 'editor', platform: 'wordpress' }));
    expect(upload).not.toHaveBeenCalled();
    expect(made.url).toBe('https://wp.example/wp-content/uploads/editor.png');
    expect(made.provider).toBe('wp-media');
    expect(made.html).toContain('https://wp.example/wp-content/uploads/editor.png');
    expect(made).not.toHaveProperty('warning');
  });

  it('워드프레스 업로드가 실패하면 기존 외부 호스팅으로 넘어가고, 어디에 올라갔는지(provider)와 경고를 돌려준다', async () => {
    wpUpload.mockResolvedValueOnce(null as any);
    const made: any = await run(wpPayload);
    expect(made.ok).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(made.url).toBe('https://iili.io/external.png');
    expect(made.provider).toBe('external');
    expect(made.warning).toMatch(/워드프레스/);
  });

  it.each(['blogger', 'tistory', '', undefined])('플랫폼이 %p 이면 자격증명이 있어도 예전과 같다 (외부 호스팅만)', async (platform) => {
    const made: any = await run({ ...wpPayload, platform });
    expect(wpUpload).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(made.url).toBe('https://iili.io/external.png');
    expect(made.provider).toBe('external');
    expect(made).not.toHaveProperty('warning');
  });

  it('워드프레스여도 자격증명이 넘어오지 않으면 예전과 같다', async () => {
    const made: any = await run({ platform: 'wordpress', imageSource: 'nanobanana2' }, { WORDPRESS_SITE_URL: 'https://env.example', WORDPRESS_USERNAME: 'e', WORDPRESS_PASSWORD: 'e' });
    expect(wpUpload).not.toHaveBeenCalled();
    expect(made.provider).toBe('external');
  });
});

describe('종합글 핸들러(_hostGeneratedImage) — 같은 모듈을 쓰고 순서는 그대로', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf8');
  const start = main.indexOf('async function _hostGeneratedImage');
  const body = main.slice(start, main.indexOf('const imageStats:', start));

  it('워드프레스 미디어 업로드를 공유 모듈로 부르고, 직접 axios.post 하지 않는다', () => {
    expect(body).toContain('wp-media-host');
    expect(body).toContain('uploadDataUrlToWpMedia(');
    expect(body).not.toContain('/wp-json/wp/v2/media');
  });

  it('순서: 워드프레스 미디어 → 외부 호스팅 → 데이터 URI (예전과 같다)', () => {
    const wp = body.indexOf('uploadDataUrlToWpMedia(');
    const external = body.indexOf('uploadBase64ToImageHost');
    const dataUri = body.indexOf("provider: 'datauri-publish-fallback'");
    expect(wp).toBeGreaterThan(-1);
    expect(external).toBeGreaterThan(wp);
    expect(dataUri).toBeGreaterThan(external);
    expect(body).toContain('wpMediaProvider(targetPlatform)');
  });

  it('wordpress-rehost-image IPC 는 만들지 않았다 (호출처 없는 채널을 막는 v3-8-701 규칙)', () => {
    expect(main).not.toContain("ipcMain.handle('wordpress-rehost-image'");
  });
});

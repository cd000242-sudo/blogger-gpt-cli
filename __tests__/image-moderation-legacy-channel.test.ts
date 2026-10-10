/**
 * AI 이미지 선정성 검사 — 옛 창구 `generate-ai-image`(반자동·썸네일 화면이 DALL·E/gpt-image 를 직접 부르는 길)에도 건다.
 * 이 길은 imageDispatcher 를 거치지 않는다. 실제 main.js 의 그 처리 코드를 떼어 가짜 OpenAI·가짜 검사기로 돌려 본다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

function loadHandler(verdict: { flagged: boolean; categories: string[] } | 'throw') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-image-'));
  fs.writeFileSync(path.join(dir, '.env'), 'DALLE_API_KEY=sk-test-dalle-key-1234567890', 'utf-8');
  const handlers: Record<string, (evt: unknown, p: any) => Promise<any>> = {};
  const moderationCalls: Array<{ url: string; key: string }> = [];
  const fakeRequire = (id: string) => {
    if (id === '../dist/core/image-moderation') {
      return {
        moderateGeneratedImage: async (url: string, opts: { env: Record<string, string> }) => {
          moderationCalls.push({ url, key: opts?.env?.['OPENAI_API_KEY'] || '' });
          if (verdict === 'throw') throw new Error('boom');
          return { checked: true, ...verdict };
        },
      };
    }
    return require(id);
  };
  const fakeFetch = async () => new Response(JSON.stringify({ data: [{ b64_json: 'QUJD' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const block = `${blockBetween(read('electron', 'main.js'), "safeRegisterHandler('generate-ai-image'", '\n});')}\n});`;
  // eslint-disable-next-line no-new-func
  new Function('safeRegisterHandler', 'electron_1', 'path', 'fs', 'fetch', 'require', 'console', block)(
    (ch: string, fn: any) => { handlers[ch] = fn; },
    { app: { getPath: () => dir } }, path, fs, fakeFetch, fakeRequire, { log() {}, warn() {}, error() {} },
  );
  return { handler: handlers['generate-ai-image']!, moderationCalls, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('옛 창구 generate-ai-image', () => {
  test('걸리면 그림을 돌려주지 않고 다시 만들라고 알린다', async () => {
    const h = loadHandler({ flagged: true, categories: ['sexual'] });
    try {
      const r = await h.handler(null, { prompt: '테스트', type: 'dalle' });
      expect(r.success).toBe(false);
      expect(r.error).toContain('안전 검사');
      expect(r.imageUrl).toBeUndefined();
      expect(h.moderationCalls).toEqual([{ url: 'data:image/png;base64,QUJD', key: 'sk-test-dalle-key-1234567890' }]);   // 이 창구의 OpenAI 키로 검사
    } finally { h.cleanup(); }
  });

  test('깨끗하면 그대로 돌려준다', async () => {
    const h = loadHandler({ flagged: false, categories: [] });
    try {
      const r = await h.handler(null, { prompt: '테스트', type: 'dalle' });
      expect(r).toMatchObject({ success: true, imageUrl: 'data:image/png;base64,QUJD' });
    } finally { h.cleanup(); }
  });

  test('검사 자체가 실패하면 그림은 막지 않는다', async () => {
    const h = loadHandler('throw');
    try {
      const r = await h.handler(null, { prompt: '테스트', type: 'dalle' });
      expect(r.success).toBe(true);
    } finally { h.cleanup(); }
  });

  test('main.ts 원본에도 같은 검사가 있다(main.js 와 짝)', () => {
    const block = blockBetween(read('electron', 'main.ts'), "safeRegisterHandler('generate-ai-image'", "} else if (type === 'pixel' || type === 'pexels') {");
    expect(block).toContain("require('../dist/core/image-moderation')");
    expect(block).toContain('moderateGeneratedImage(imageUrl, { env: { OPENAI_API_KEY: dalleApiKey } })');
  });
});

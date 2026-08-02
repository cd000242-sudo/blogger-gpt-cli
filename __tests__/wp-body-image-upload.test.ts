/**
 * 본문 이미지 0개 회귀 테스트 (v3.8.387)
 *
 * 사고 (실측 2026-07-30, leadernam.com 발행글 323편 전수 조사):
 *   본문 이미지 0개 = 141/323편 (43.7%). 07-26 이후로는 10편 연속 0개.
 *   그런데 대표 이미지(featured_media)는 전 글 정상이었다.
 *
 *   원인: 썸네일은 wpApi.uploadMedia(자체 미디어)로 올라가는데, 본문 이미지만
 *        무료 외부 호스트(imgbb/imghippo/freeimage/catbox) 5곳에 의존했다.
 *        그 호스트들이 함께 막히면 orchestration 이 이미지를 통째로 버렸다
 *        (orchestration.ts: "모든 호스팅 실패 → 이미지 제거").
 *        원래 Blogger API 400 을 막으려던 정책인데, 자체 미디어가 있는
 *        워드프레스에까지 그대로 적용된 것이 문제였다.
 *
 *   증거: 본문 이미지가 있는 글의 src 는 iili.io(외부 무료 호스트)였고,
 *        썸네일만 leadernam.com/wp-content/uploads 였다.
 *
 * 원칙: 어떤 실패도 발행을 막지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { WordPressPublisher } from '../src/wordpress/wordpress-publisher';
import { braceBlock, linesAfter } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');

/** 1KB 이상으로 디코드되는 진짜 같은 base64 (업로드 대상 판정을 통과해야 한다) */
const bigBase64 = 'data:image/png;base64,' + Buffer.alloc(2048, 7).toString('base64');
const bigBase64Jpg = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 9).toString('base64');

type MediaCall = { filename: string; bytes: number };

function makePublisher(behavior: (call: MediaCall) => any) {
  const publisher = new WordPressPublisher({
    siteUrl: 'https://example.com',
    username: 'u',
    applicationPassword: 'p',
  } as any);
  const calls: MediaCall[] = [];
  (publisher as any).wpApi = {
    uploadMedia: async (buf: ArrayBuffer, filename: string) => {
      const call = { filename, bytes: buf.byteLength };
      calls.push(call);
      return behavior(call);
    },
  };
  const run = (html: string, title?: string) =>
    (publisher as any).uploadInlineBase64Images(html, title) as Promise<string>;
  return { run, calls };
}

const okMedia = (n = 1) => ({ id: n, source_url: `https://example.com/wp-content/uploads/img-${n}.png` });

describe('본문 base64 이미지를 워드프레스 미디어로 올린다', () => {
  it('base64 src 가 업로드된 실제 URL로 바뀐다', async () => {
    const { run, calls } = makePublisher(() => okMedia(1));
    const html = `<p>앞</p><img src="${bigBase64}" alt="테스트"><p>뒤</p>`;
    const out = await run(html, '제목');

    expect(out).toContain('https://example.com/wp-content/uploads/img-1.png');
    expect(out).not.toContain('data:image');
    expect(calls).toHaveLength(1);
    // alt 등 다른 속성은 보존돼야 한다 (src 만 교체)
    expect(out).toContain('alt="테스트"');
    expect(out).toContain('<p>앞</p>');
    expect(out).toContain('<p>뒤</p>');
  });

  it('여러 장을 모두 올린다', async () => {
    let n = 0;
    const { run, calls } = makePublisher(() => okMedia(++n));
    const html = `<img src="${bigBase64}"><h2>중간</h2><img src="${bigBase64Jpg}">`;
    const out = await run(html);

    expect(calls).toHaveLength(2);
    expect(out).toContain('img-1.png');
    expect(out).toContain('img-2.png');
    expect(out).not.toContain('data:image');
    expect(out).toContain('<h2>중간</h2>');
  });

  it('확장자를 mime 에서 뽑고 jpeg → jpg 로 정규화한다', async () => {
    const { run, calls } = makePublisher(() => okMedia());
    await run(`<img src="${bigBase64Jpg}">`);
    expect(calls[0]?.filename).toMatch(/\.jpg$/);
    expect(calls[0]?.filename).toContain('-body-1.');
  });

  it('디코드된 실제 바이트를 올린다 (base64 문자열이 아니라)', async () => {
    const { run, calls } = makePublisher(() => okMedia());
    await run(`<img src="${bigBase64}">`);
    expect(calls[0]?.bytes).toBe(2048);
  });
});

describe('실패해도 발행을 막지 않는다 — 이게 최우선 원칙', () => {
  it('업로드가 throw 해도 예외를 밖으로 내보내지 않는다', async () => {
    const { run } = makePublisher(() => { throw new Error('402 결제 필요'); });
    await expect(run(`<img src="${bigBase64}">`)).resolves.toEqual(expect.any(String));
  });

  it('업로드 실패한 img 는 태그만 제거하고 본문은 살린다', async () => {
    const { run } = makePublisher(() => { throw new Error('네트워크 끊김'); });
    const out = await run(`<p>본문 유지</p><img src="${bigBase64}">`);
    expect(out).toContain('<p>본문 유지</p>');
    expect(out).not.toContain('data:image');   // 거대한 data URI 를 남기지 않는다
    expect(out).not.toContain('<img');
  });

  it('source_url 이 없는 응답도 실패로 처리한다', async () => {
    const { run } = makePublisher(() => ({ id: 5 }));
    const out = await run(`<p>ok</p><img src="${bigBase64}">`);
    expect(out).toContain('<p>ok</p>');
    expect(out).not.toContain('data:image');
  });

  it('한 장이 실패해도 나머지는 정상 업로드된다', async () => {
    let n = 0;
    const { run, calls } = makePublisher(() => {
      n += 1;
      if (n === 1) throw new Error('첫 장 실패');
      return okMedia(2);
    });
    const out = await run(`<img src="${bigBase64}"><img src="${bigBase64Jpg}">`);
    expect(calls).toHaveLength(2);
    expect(out).toContain('img-2.png');
    expect(out).not.toContain('data:image');
  });
});

describe('불필요한 업로드를 하지 않는다 — 비용·시간 낭비 방지', () => {
  it('base64 가 없으면 업로드를 시도조차 안 하고 원문을 그대로 돌려준다', async () => {
    const { run, calls } = makePublisher(() => okMedia());
    const html = '<p>글</p><img src="https://cdn.example.com/a.png">';
    const out = await run(html);
    expect(out).toBe(html);
    expect(calls).toHaveLength(0);
  });

  it('200자 이하 placeholder base64 는 올리지 않는다', async () => {
    const { run, calls } = makePublisher(() => okMedia());
    const tiny = 'data:image/png;base64,' + 'A'.repeat(40);
    const out = await run(`<img src="${tiny}">`);
    expect(calls).toHaveLength(0);
    expect(out).toContain(tiny);   // 기존 sanitizer 가 처리할 몫으로 남긴다
  });

  it('같은 이미지가 두 번 쓰이면 한 번만 올린다', async () => {
    const { run, calls } = makePublisher(() => okMedia(1));
    const out = await run(`<img src="${bigBase64}"><h2>중간</h2><img src="${bigBase64}">`);
    expect(calls).toHaveLength(1);                                  // 업로드는 1회
    expect(out.split('img-1.png').length - 1).toBe(2);              // 두 자리 모두 치환
    expect(out).not.toContain('data:image');
  });

  it('중복 이미지가 실패했을 때도 재시도하지 않는다', async () => {
    const { run, calls } = makePublisher(() => { throw new Error('실패'); });
    const out = await run(`<img src="${bigBase64}"><img src="${bigBase64}">`);
    expect(calls).toHaveLength(1);
    expect(out).not.toContain('<img');
  });

  it('디코드 결과가 1KB 미만이면 올리지 않는다 (깨진 데이터)', async () => {
    const { run } = makePublisher(() => okMedia());
    const small = 'data:image/png;base64,' + Buffer.alloc(300, 1).toString('base64');
    const out = await run(`<p>keep</p><img src="${small}">`);
    expect(out).toContain('<p>keep</p>');
    expect(out).not.toContain('data:image');   // 실패 처리 → 태그 제거
  });
});

describe('orchestration 배선 — 워드프레스만 base64 를 넘긴다', () => {
  const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('워드프레스면 base64 를 버리지 않고 그대로 넘긴다', () => {
    const i = orch.indexOf('외부 호스팅 전부 실패 → 워드프레스 미디어 업로드로 위임');
    expect(i).toBeGreaterThan(-1);
    // 표식이 로그 문자열이라 뒤 첫 중괄호가 엉뚱하다 — 바로 다음 줄들을 본다
    expect(linesAfter(orch, '외부 호스팅 전부 실패 → 워드프레스 미디어 업로드로 위임', 4)).toContain('return img;');
  });

  it('플랫폼 조건이 워드프레스로 한정돼 있다', () => {
    expect(orch).toContain("if (platform === 'wordpress')");
  });

  it('Blogger/티스토리는 기존대로 제거한다 — base64 본문은 API 400 을 낸다', () => {
    expect(orch).toContain('이미지 제거');
    expect(orch).toContain('Blogger 400 방지');
  });

  it('퍼블리셔가 발행 전에 변환 단계를 호출한다', () => {
    const pub = fs.readFileSync(path.join(ROOT, 'src', 'wordpress', 'wordpress-publisher.ts'), 'utf8');
    expect(pub).toContain('await this.uploadInlineBase64Images(optimizedContent, options.title)');
    // 대표 이미지 결정보다 먼저 돌아야 http URL 을 후보로 쓸 수 있다
    expect(pub.indexOf('uploadInlineBase64Images(optimizedContent'))
      .toBeLessThan(pub.indexOf('let featuredMediaId'));
  });
});

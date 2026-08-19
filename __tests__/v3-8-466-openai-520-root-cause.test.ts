/**
 * v3.8.466 — OpenAI 520
 *
 * 사용자 지적: "다른 엔진이 아니라 할당량이 있는데 왜 520 오류가 생기냐는거지
 * 이 오류가 안 생기게 하라는거야".
 *
 * ## 먼저, 사용자의 그 실패는 우리 잘못이 아니었다
 * 확인 결과 그 글은 **정보성 글 + 썸네일 AI 자동 생성** 이었다. 그 조합은
 * 참고 이미지가 0장이라 요청이 작은 JSON 하나다. 큐도 한 건씩 순차(8초 간격)로
 * 돈다. 즉 우리가 보낸 요청에는 문제가 없었고, 520 은 OpenAI 엣지가 낸 값이다.
 * 빈도도 "안 나다가 10번 중 1번 꼴" — 전형적인 일시 장애다. 없앨 수 없다.
 *
 * → 그래서 **사용자가 볼 일이 없게** 만든다: 일시 장애로 분류되면 같은 엔진으로
 *   5회까지 버틴다(엔진을 바꾸지 않는다 — 사용자가 원한 게 그것이다).
 *   10회 중 1회 실패라면 5회 재시도로 10만분의 1이 된다. 실패한 요청은
 *   과금되지 않으므로 비용도 늘지 않는다.
 *
 * ## 다만 조사 중에 진짜 지뢰를 하나 찾았다 (다른 조합에서 터진다)
 * 참고 이미지를 쓰는 경우(쇼핑 모드의 상품 사진, "내 폴더 이미지" 썸네일)에는
 * 그림을 **원본 그대로** 실어 보냈다 — 장당 8MB 허용 × 최대 3장 = 24MB.
 * `data:` 주소는 크기 검사조차 없었고, 요청 타임아웃도 없었다.
 * 실측(1500x1500 사진형 3장): 19.32MB → 1.27MB (93% 감소).
 */
import * as fs from 'fs';
import * as path from 'path';
import { fetchImagesAsBlobs } from '../src/thumbnail';
import { blockBetween } from './helpers/source-block';

const thumbnail = fs.readFileSync(path.join(__dirname, '..', 'src/thumbnail.ts'), 'utf-8');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

/** 상세페이지 상품 사진과 비슷한 크기의 사진형 PNG */
async function bigProductPng(size = 1500): Promise<Buffer> {
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (Math.sin(i * 0.29) * 127 + 128) ^ (i % 239);
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

describe('① 참고 이미지를 줄여서 보낸다', () => {
  it('⭐⭐ 상품 사진 3장이 요청에서 수 MB 로 떨어진다', async () => {
    const png = await bigProductPng();
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    expect(png.length).toBeGreaterThan(3 * 1024 * 1024);   // 원본은 실제로 크다

    const blobs = await fetchImagesAsBlobs([dataUrl, dataUrl, dataUrl]);
    expect(blobs).toHaveLength(3);

    const total = blobs.reduce((a, b) => a + b.size, 0);
    expect(total).toBeLessThan(3 * 1024 * 1024);           // 예전엔 19MB 였다
    expect(total).toBeLessThan(png.length);                // 원본 1장보다도 작다
  }, 120000);

  it('⭐⭐ 줄여도 그림은 남는다 (빈 껍데기를 보내면 i2i 가 무의미하다)', async () => {
    const png = await bigProductPng(1400);
    const blobs = await fetchImagesAsBlobs([`data:image/png;base64,${png.toString('base64')}`]);
    expect(blobs).toHaveLength(1);

    const buf = Buffer.from(await blobs[0]!.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(1024);          // 참고용으로 충분한 해상도
    expect(buf.length).toBeGreaterThan(10 * 1024);
  }, 120000);

  it('⭐ 이미 가벼운 사진(200KB 미만)은 그대로 보낸다 — 괜히 다시 인코딩하지 않는다', async () => {
    const small = await bigProductPng(160);
    expect(small.length).toBeLessThan(200 * 1024);
    const blobs = await fetchImagesAsBlobs([`data:image/png;base64,${small.toString('base64')}`]);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.size).toBe(small.length);
  }, 60000);

  it('⭐ 200KB 를 넘으면 참고용으로 줄인다 (요청 크기가 쌓이면 520 이 난다)', async () => {
    const mid = await bigProductPng(300);
    expect(mid.length).toBeGreaterThan(200 * 1024);
    const blobs = await fetchImagesAsBlobs([`data:image/png;base64,${mid.toString('base64')}`]);
    expect(blobs[0]!.size).toBeLessThan(mid.length);
  }, 60000);
});

describe('② 소스에 원인 차단이 남아 있다', () => {
  it('⭐⭐ data: 주소에도 크기 상한을 건다 (예전에는 검사가 없었다)', () => {
    const fn = blockBetween(thumbnail, 'export async function fetchImagesAsBlobs(', 'if (savedTotal > 0) {');
    const dataBranch = blockBetween(fn, "u.startsWith('data:image/')", "if (!/^https?:");
    expect(dataBranch).toContain('MAX_SEND_BYTES');
  });

  it('⭐⭐ 참고 이미지는 1024px 로 줄여서 보낸다', () => {
    expect(thumbnail).toContain('optimizeImageBuffer(buf, mime, { maxWidth: 1024');
  });

  it('⭐⭐ OpenAI 요청에 타임아웃이 있다 (멈춘 업로드가 엣지에서 끊기면 520 이다)', () => {
    // 길이가 아니라 경계로 자른다 (__tests__/helpers/source-block.ts 규칙)
    // v3.8.531: 두 요청이 doFetch 안으로 들어가며 if/else 표식이 사라졌다 —
    //   edits 블록은 다음 fetch 시작까지, generations 블록은 doFetch 호출부까지가 경계다.
    const editsCall = blockBetween(thumbnail, "fetch('https://api.openai.com/v1/images/edits'", "fetch('https://api.openai.com/v1/images/generations'");
    const genCall = blockBetween(thumbnail, "fetch('https://api.openai.com/v1/images/generations'", '\n    let res = await doFetch();');
    expect(editsCall).toContain('AbortSignal.timeout(');
    expect(genCall).toContain('AbortSignal.timeout(');
  });

  it('⭐ 못 줄여도 발행은 계속된다 (압축 실패가 생성을 막으면 안 된다)', () => {
    const fn = thumbnail.slice(thumbnail.indexOf('const shrink = async'), thumbnail.indexOf('const MAX_SEND_BYTES'));
    expect(fn).toContain('return { buf, mime };');
  });
});

/**
 * ③ 520 은 OpenAI 쪽에서 나는 값이라 우리가 없앨 수 없다.
 *    대신 **사용자가 볼 일이 없게** 만든다 — 같은 엔진으로 끈질기게 다시 한다.
 *    사용자 실측: "안 나다가 10번 중 1번 꼴로 난다" · "다른 엔진이 아니라".
 */
describe('③ 일시 장애는 엔진을 바꾸지 않고 버틴다', () => {
  const dispatcher = fs.readFileSync(path.join(__dirname, '..', 'src/core/imageDispatcher.ts'), 'utf-8');

  it('⭐⭐ 일시 장애로 분류되면 재시도 횟수를 늘린다', () => {
    expect(dispatcher).toContain('const TRANSIENT_CATEGORIES = new Set(');
    expect(dispatcher).toContain('if (TRANSIENT_CATEGORIES.has(classification.category)) maxRetries = 5;');
  });

  it('⭐⭐ 520 이 그 목록에 실제로 들어가는 분류다', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { classifyImageError } = require('../src/core/image-error-classifier');
    const c = classifyImageError('GPT Image 2 (덕테이프) 실패: OPENAI_HTTP_520: <!DOCTYPE html>');
    expect(['server_overload', 'server_internal', 'server_timeout', 'network_error']).toContain(c.category);
  });

  it('⭐ 고정된 3회 상수가 남아 있지 않다 (한쪽만 고치면 어긋난다)', () => {
    expect(dispatcher).not.toContain('MAX_STRICT_RETRIES');
  });
});

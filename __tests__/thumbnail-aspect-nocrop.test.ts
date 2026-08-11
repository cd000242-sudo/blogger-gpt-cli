/**
 * v3.8.472 회귀 — 워드프레스 썸네일 위아래 잘림.
 *
 * OpenAI Images API 는 16:9 를 못 만든다(landscape 최대 1536x1024 = 3:2).
 * 발행 경로는 전부 16:9 하드 크롭이라 그대로 넘기면 위아래가 잘렸다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  computePaddedCanvas,
  readImageSize,
  padBufferToAspect,
  PUBLISH_ASPECT_RATIO,
} from '../src/core/final/image-aspect';

describe('computePaddedCanvas — 자르지 않고 넓힌다', () => {
  it('GPT Image 의 1536x1024(3:2) 를 16:9 캔버스로 넓힌다', () => {
    const canvas = computePaddedCanvas(1536, 1024, PUBLISH_ASPECT_RATIO);

    expect(canvas).not.toBeNull();
    // 세로는 그대로 — 위아래를 잘라내지 않았다는 뜻이다.
    expect(canvas!.canvasHeight).toBe(1024);
    expect(canvas!.canvasWidth).toBe(1820);
    expect(canvas!.canvasWidth / canvas!.canvasHeight).toBeCloseTo(PUBLISH_ASPECT_RATIO, 2);
  });

  it('캔버스는 항상 원본 이상이다 — 어떤 비율이 와도 잘라내지 않는다', () => {
    for (const [w, h] of [[1536, 1024], [1024, 1024], [800, 1600], [1920, 1080], [3000, 500]]) {
      const canvas = computePaddedCanvas(w!, h!, PUBLISH_ASPECT_RATIO);
      if (!canvas) continue;
      expect(canvas.canvasWidth).toBeGreaterThanOrEqual(w!);
      expect(canvas.canvasHeight).toBeGreaterThanOrEqual(h!);
    }
  });

  it('이미 16:9 면 손대지 않는다 (불필요한 재인코딩 방지)', () => {
    expect(computePaddedCanvas(1920, 1080, PUBLISH_ASPECT_RATIO)).toBeNull();
    expect(computePaddedCanvas(1280, 720, PUBLISH_ASPECT_RATIO)).toBeNull();
  });

  it('잘못된 입력에는 null 을 돌려준다 (발행을 막지 않는다)', () => {
    expect(computePaddedCanvas(0, 1024, PUBLISH_ASPECT_RATIO)).toBeNull();
    expect(computePaddedCanvas(1536, 0, PUBLISH_ASPECT_RATIO)).toBeNull();
    expect(computePaddedCanvas(NaN, 1024, PUBLISH_ASPECT_RATIO)).toBeNull();
  });
});

describe('readImageSize — sharp 없이 헤더만 읽는다 (v3.8.474 성능 회귀 잠금)', () => {
  /** 1536x1024 PNG 헤더 (시그니처 + IHDR) */
  const pngHeader = (w: number, h: number): Buffer => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(0x89504e47, 0);
    buf.writeUInt32BE(0x0d0a1a0a, 4);
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    return buf;
  };

  it('PNG 헤더에서 크기를 읽는다', () => {
    expect(readImageSize(pngHeader(1536, 1024))).toEqual({ width: 1536, height: 1024 });
  });

  it('이미지가 아니면 null — 여기서 끊겨야 sharp 가 안 깨어난다', () => {
    expect(readImageSize(Buffer.from('not an image at all, just some bytes here'))).toBeNull();
    expect(readImageSize(Buffer.alloc(4))).toBeNull();
  });

  it('가짜 버퍼는 sharp 를 부르지 않고 즉시 null (1000회 몬테카를로가 타임아웃하던 원인)', async () => {
    const junk = Buffer.from('x'.repeat(4096));
    const started = Date.now();
    for (let i = 0; i < 200; i++) {
      expect(await padBufferToAspect(junk, PUBLISH_ASPECT_RATIO)).toBeNull();
    }
    // sharp 를 200번 깨웠다면 초 단위로 걸린다. 헤더 선별이면 밀리초다.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('이미 16:9 인 PNG 도 sharp 없이 걸러진다', async () => {
    expect(await padBufferToAspect(pngHeader(1920, 1080), PUBLISH_ASPECT_RATIO)).toBeNull();
  });
});

describe('발행 경로 배선', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

  it('GPT Image 결과는 디스패처에서 16:9 로 정규화된다', () => {
    const dispatcher = read('src/core/imageDispatcher.ts');
    expect(dispatcher).toMatch(/padDataUrlToAspect\(result\.dataUrl,\s*PUBLISH_ASPECT_RATIO/);
  });

  it('워드프레스 주입 CSS 가 대표 이미지를 cover 로 자르지 않는다', () => {
    const css = read('src/wordpress/wordpress-publisher.ts');
    const thumbRule = css.slice(
      css.indexOf('.wp-styled-content .bgpt-thumbnail-box img'),
      css.indexOf('.wp-styled-content .bgpt-thumbnail-box img') + 400,
    );
    expect(thumbRule).toMatch(/object-fit:\s*contain/);
    expect(thumbRule).not.toMatch(/object-fit:\s*cover/);
  });
});

/**
 * v3.8.472 회귀 — 워드프레스 썸네일 위아래 잘림.
 *
 * OpenAI Images API 는 16:9 를 못 만든다(landscape 최대 1536x1024 = 3:2).
 * 발행 경로는 전부 16:9 하드 크롭이라 그대로 넘기면 위아래가 잘렸다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { computePaddedCanvas, PUBLISH_ASPECT_RATIO } from '../src/core/final/image-aspect';

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

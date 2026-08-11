/**
 * v3.8.477 — 구글 디스커버 카드 자격 자가진단.
 *
 * 실측 2026-08-11 로 확인한 것:
 *   워드프레스(leadernam.com)  max-image-preview:large · og:image · og:title **전부 있음** → 손댈 것 없음
 *   블로거(blogger.googleblog.com)  둘 다 **없음** → 그런데 Blogger API 는 글 본문만 다루고
 *     테마 HTML 을 바꾸는 공개 API 가 없다. **코드로 못 고친다** → 알리기라도 한다.
 *
 * 이미지 최적화는 줄이기만 하고 키우지 않으므로(withoutEnlargement) 원본이 작으면
 * 작은 채로 나가 디스커버 카드에서 탈락한다. 특히 크롤한 상품 사진.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  checkDiscoverReadiness,
  DISCOVER_MIN_WIDTH,
  DISCOVER_MIN_PIXELS,
} from '../src/core/final/discover-readiness';

/** PNG 시그니처 + IHDR 만 담은 최소 버퍼 → data URL */
const pngDataUrl = (w: number, h: number): string => {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return `data:image/png;base64,${buf.toString('base64')}`;
};

describe('checkDiscoverReadiness — 썸네일 크기', () => {
  it('v3.8.472 가 만드는 1820x1024 는 통과한다', () => {
    expect(checkDiscoverReadiness({ thumbnailDataUrl: pngDataUrl(1820, 1024), platform: 'wordpress' })).toEqual([]);
  });

  it('최적화 후 크기(1200x675)도 통과한다 — 기준을 정확히 만족', () => {
    expect(1200).toBeGreaterThanOrEqual(DISCOVER_MIN_WIDTH);
    expect(1200 * 675).toBeGreaterThan(DISCOVER_MIN_PIXELS);
    expect(checkDiscoverReadiness({ thumbnailDataUrl: pngDataUrl(1200, 675), platform: 'wordpress' })).toEqual([]);
  });

  it('작은 수집 사진은 경고한다 (확대는 안 하므로 작은 채로 나간다)', () => {
    const warnings = checkDiscoverReadiness({ thumbnailDataUrl: pngDataUrl(640, 480), platform: 'wordpress' });
    expect(warnings.map(w => w.code)).toContain('thumbnail-too-small');
    expect(warnings[0]!.message).toContain('640x480');
  });

  it('폭은 충분해도 총 픽셀이 모자라면 경고한다', () => {
    const warnings = checkDiscoverReadiness({ thumbnailDataUrl: pngDataUrl(1200, 200), platform: 'wordpress' });
    expect(warnings.map(w => w.code)).toContain('thumbnail-too-small');
  });

  it('크기를 못 읽으면 못 읽었다고 한다 (조용히 통과시키지 않는다)', () => {
    const junk = `data:image/png;base64,${Buffer.from('not a real png at all').toString('base64')}`;
    expect(checkDiscoverReadiness({ thumbnailDataUrl: junk, platform: 'wordpress' }).map(w => w.code))
      .toContain('thumbnail-unknown');
  });

  it('썸네일이 없으면 크기 경고를 만들지 않는다', () => {
    expect(checkDiscoverReadiness({ thumbnailDataUrl: '', platform: 'wordpress' })).toEqual([]);
    expect(checkDiscoverReadiness({})).toEqual([]);
  });
});

describe('checkDiscoverReadiness — 플랫폼', () => {
  it('블로그스팟은 테마 head 메타를 직접 넣어야 한다고 알린다', () => {
    const warnings = checkDiscoverReadiness({ platform: 'blogspot' });
    const found = warnings.find(w => w.code === 'blogspot-head-meta');
    expect(found).toBeDefined();
    expect(found!.message).toContain('max-image-preview:large');
    expect(found!.message).toContain('테마');
  });

  it('워드프레스는 이미 갖추고 있으므로 잔소리하지 않는다 (실측 확인)', () => {
    expect(checkDiscoverReadiness({ platform: 'wordpress' }).map(w => w.code))
      .not.toContain('blogspot-head-meta');
  });

  it('진단은 절대 던지지 않는다 — 발행을 막으면 안 된다', () => {
    expect(() => checkDiscoverReadiness({ thumbnailDataUrl: null as any, platform: null as any })).not.toThrow();
  });
});

describe('배선', () => {
  const orchestration = readFileSync(join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');

  it('업로드 전 data URL 을 잡아둔다 (업로드 후엔 크기를 못 잰다)', () => {
    expect(orchestration).toContain('let thumbnailProbeDataUrl');
    expect(orchestration).toContain('thumbnailProbeDataUrl = thumbResult.dataUrl');
    expect(orchestration).toContain('thumbnailProbeDataUrl = asData');
  });

  it('진단 결과를 로그로 알리고 발행은 계속한다', () => {
    expect(orchestration).toContain('checkDiscoverReadiness');
    expect(orchestration).toContain('🔎 디스커버:');
  });
});

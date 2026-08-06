/**
 * v3.8.465 — 사용자 요청 2건
 *
 *   ① "왜 어떤모드이든 쿠팡 공정위 문구가 하드코딩되어있나요?? 수정해주세요"
 *   ② "이미지 용량이 크면 페이지 렌더링하는데 오래걸리거든 이러면 이탈률이
 *      발생할수있어 … 이미지용량을 최소화시킬방법이있을까"
 */
import * as fs from 'fs';
import * as path from 'path';
import { enforceAffiliateCompliance } from '../src/core/affiliate/compliance';
import { optimizeImageBuffer, optimizeDataUrl } from '../src/core/final/image-optimize';

const root = path.join(__dirname, '..');
const orchestration = fs.readFileSync(path.join(root, 'src/core/final/orchestration.ts'), 'utf-8');
const helpers = fs.readFileSync(path.join(root, 'src/core/final/image-helpers.ts'), 'utf-8');

const COUPANG_DISCLOSURE = '쿠팡 파트너스 활동의 일환';

describe('① 쿠팡 고지문은 쿠팡 글에만 붙는다', () => {
  /**
   * 원인: isCoupangArticle 이 "제휴 링크가 하나도 없으면 쿠팡 글" 로 판정했다.
   * 그 조건은 쇼핑 모드에서 "링크는 없지만 키워드로 찾은 쿠팡 상품이 수익원"
   * 이라는 뜻이었는데, 정보성 글·애드센스 글도 링크가 없으니 그대로 참이 됐다.
   * 그러면 제휴 컴플라이언스(쇼핑 모드 밖에서 돈다)가 제휴사를 쿠팡으로 잡고
   * 본문 최상단에 대가성 문구를 꽂았다.
   */
  it('⭐⭐ 링크 없는 글을 쿠팡 글로 보려면 쇼핑 모드여야 한다', () => {
    expect(orchestration).toContain('(isCoupangShoppingMode && !hasSpecificProductLink)');
    // 예전 판정(모드 무관)이 남아 있으면 안 된다
    expect(orchestration).not.toMatch(/:\s*\(!!coupangLink \|\| !hasSpecificProductLink\)/);
  });

  it('⭐⭐ 제휴 링크가 하나도 없으면 고지문을 넣지 않는다', () => {
    const html = '<h1>전기요금 절약하는 법</h1><p>여름철 에어컨 사용 요령을 정리했습니다.</p>';
    const result = enforceAffiliateCompliance(html, 'coupang');
    expect(result.html).not.toContain(COUPANG_DISCLOSURE);
    expect(result.html).toBe(html);
  });

  it('⭐⭐ 진짜 쿠팡 링크가 있으면 고지문이 들어간다 (기능은 살아 있어야 한다)', () => {
    const html = '<h1>공기청정기 추천</h1><p><a href="https://link.coupang.com/a/abcd">최저가 보기</a></p>';
    const result = enforceAffiliateCompliance(html, 'coupang');
    expect(result.html).toContain(COUPANG_DISCLOSURE);
    // 고지문은 본문 맨 위에 있어야 한다 (쿠팡 가이드)
    expect(result.html.indexOf(COUPANG_DISCLOSURE)).toBeLessThan(result.html.indexOf('<h1>'));
  });

  it('⭐⭐ 토스 글에 쿠팡 고지문이 섞이지 않는다', () => {
    const html = '<h1>와인 추천</h1><p><a href="https://toss.im/shopping/x">보러가기</a></p>';
    const result = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(result.html).not.toContain(COUPANG_DISCLOSURE);
    expect(result.html).toContain('토스쇼핑');
  });

  it('⭐ 링크가 없어 고지문을 못 넣었으면 사람이 볼 수 있게 알린다', () => {
    const result = enforceAffiliateCompliance('<h1>제목</h1><p>본문</p>', 'coupang');
    expect(result.warnings.join(' ')).toContain('링크가 본문에 없어');
  });
});

describe('② 이미지 용량 최소화', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sharp = require('sharp');

  /** 사진처럼 압축이 잘 안 되는 이미지를 만든다 (평탄한 그라디언트는 비현실적으로 잘 줄어든다) */
  async function makePhotoPng(w: number, h: number, alpha = false): Promise<Buffer> {
    const ch = alpha ? 4 : 3;
    const raw = Buffer.alloc(w * h * ch);
    for (let i = 0; i < raw.length; i += 1) raw[i] = (Math.sin(i * 0.31) * 127 + 128) ^ (i % 241);
    // 진짜로 비치는 픽셀을 섞는다 — 전부 불투명하면 인코더가 알파를 떼어낸다
    if (alpha) for (let i = 3; i < raw.length; i += 4) raw[i] = (i % 8 === 3) ? 0 : 255;
    return sharp(raw, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  }

  it('⭐⭐ AI 이미지 크기(1024px PNG)를 절반 이하로 줄인다', async () => {
    const png = await makePhotoPng(1024, 1024);
    const result = await optimizeImageBuffer(png, 'image/png');
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(result.buffer.length).toBeLessThan(png.length / 2);
  }, 30000);

  it('⭐⭐ 본문 폭보다 크면 1200px 로 줄인다', async () => {
    const png = await makePhotoPng(2400, 1200);
    const result = await optimizeImageBuffer(png, 'image/png');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(1200);
  }, 30000);

  it('⭐⭐ 투명한 이미지는 JPEG 로 바꾸지 않는다 (투명이 검게 칠해진다)', async () => {
    const png = await makePhotoPng(1024, 1024, true);
    const result = await optimizeImageBuffer(png, 'image/png');
    expect(result.mime).not.toBe('image/jpeg');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.hasAlpha).toBe(true);
  }, 30000);

  /**
   * 사용자 명시: "제품을 사용하는 gif라면 분명 큰도움이 되니까".
   * 정지 이미지로 바꾸면 그 가치가 사라지므로 손대지 않는다.
   */
  it('⭐⭐ 움직이는 GIF 는 건드리지 않는다', async () => {
    /**
     * GIF89a 를 규격대로 직접 만든다 (sharp 는 raw 입력에서 여러 프레임을 못 만든다).
     * 프레임마다 붙는 Graphic Control Extension(0x21 0xF9 0x04)이 판정 기준이다.
     * 크기 때문에 건너뛴 게 아님을 확실히 하려고 주석 블록으로 60KB 를 넘긴다.
     */
    const header = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61,       // "GIF89a"
      0x02, 0x00, 0x02, 0x00, 0x80, 0x00, 0x00, // 2x2, 전역 색상표 있음
      0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF,       // 검정 · 흰색
    ]);
    const frame = Buffer.from([
      0x21, 0xF9, 0x04, 0x00, 0x0A, 0x00, 0x00, 0x00,             // GCE (프레임 표식)
      0x2C, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, // 이미지 서술자
      0x02, 0x02, 0x44, 0x01, 0x00,                                // LZW 데이터
    ]);
    const padChunk = Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.alloc(255, 0x41)]);
    const padding = Buffer.concat([
      ...Array.from({ length: 260 }, () => padChunk), Buffer.from([0x00]),
    ]);
    const gif = Buffer.concat([header, frame, frame, Buffer.from([0x21]), padding, Buffer.from([0x3B])]);
    expect(gif.length).toBeGreaterThan(60 * 1024);

    const result = await optimizeImageBuffer(gif, 'image/gif');
    expect(result.savedBytes).toBe(0);
    expect(result.buffer).toBe(gif);
  }, 30000);

  it('⭐ 이미 작은 이미지는 화질만 깎이므로 손대지 않는다', async () => {
    const small = await makePhotoPng(120, 120);
    const result = await optimizeImageBuffer(small, 'image/png');
    expect(result.savedBytes).toBe(0);
  }, 30000);

  it('⭐ 이미지가 아닌 문자열은 그대로 돌려준다 (예외를 던지지 않는다)', async () => {
    const r = await optimizeDataUrl('https://example.com/a.jpg');
    expect(r.dataUrl).toBe('https://example.com/a.jpg');
    expect(r.savedBytes).toBe(0);
  });
});

describe('③ 최적화가 업로드 경로 전체에 걸린다', () => {
  it('⭐⭐ 호스팅 함수가 올리기 전에 최적화한다', () => {
    const fn = helpers.slice(
      helpers.indexOf('export async function uploadBase64ToImageHost('),
      helpers.indexOf('// 🛒 쇼핑 크롤러 동적 임포트'),
    );
    expect(fn).toContain("await import('./image-optimize')");
    const optIdx = fn.indexOf('optimizeDataUrl(');
    const firstUpload = fn.indexOf('await tryCloudinary(');
    expect(optIdx).toBeGreaterThan(-1);
    expect(firstUpload).toBeGreaterThan(-1);
    expect(optIdx).toBeLessThan(firstUpload);
  });

  it('⭐⭐ 모든 호스트가 최적화본을 쓴다 (한 곳만 원본이면 조용히 반쪽이 된다)', () => {
    const fn = helpers.slice(
      helpers.indexOf('export async function uploadBase64ToImageHost('),
      helpers.indexOf('// 🛒 쇼핑 크롤러 동적 임포트'),
    );
    // 최적화 블록 이후에는 원본 변수를 쓰면 안 된다 (주석에는 경위가 남아 있다)
    const after = fn.slice(fn.indexOf('const mimeMatch'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(after).not.toContain('base64Data');
  });

  it('⭐ sharp 가 없어도 발행이 멈추지 않는다', () => {
    const opt = fs.readFileSync(path.join(root, 'src/core/final/image-optimize.ts'), 'utf-8');
    expect(opt).toContain('sharpModule = null');
    expect(opt).toContain("reason: 'sharp 없음'");
  });
});

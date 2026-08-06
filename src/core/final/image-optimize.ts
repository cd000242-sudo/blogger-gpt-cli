/**
 * 🗜️ 이미지 용량 최소화 (v3.8.465)
 *
 * 사용자 지적: "이미지 용량이 크면 페이지 렌더링하는데 오래걸리거든 이러면
 * 이탈률이 발생할수있어 이거 이미지 생성이나 수집하고나면 이미지용량을
 * 최소화시킬방법이있을까".
 *
 * AI 로 만든 이미지는 1024x1024 PNG 로 나오는데 사진형이면 3MB 가 넘는다.
 * 한 글에 이미지가 8~10장이면 30MB 다 — 모바일에서 첫 화면이 뜨기 전에 나간다.
 *
 * ## 무엇을 하는가
 *   1) 블로그 본문 폭(700~900px)보다 큰 것은 1200px 로 줄인다 (레티나 여유 포함)
 *   2) WebP·JPEG 로 각각 인코딩해 **더 작은 쪽**을 쓴다
 *   3) 촬영정보(EXIF) 같은 메타데이터를 턴다
 *
 * ## 무엇을 건드리지 않는가
 *   · 움직이는 GIF — 사용자가 "제품을 사용하는 gif라면 분명 큰도움이 되니까" 라고
 *     명시했다. 정지 이미지로 바꾸면 그 가치가 사라진다.
 *   · 이미 충분히 작은 이미지 — 줄여봐야 얻는 게 없고 화질만 깎인다.
 *   · 줄인 결과가 원본보다 크면 원본을 그대로 쓴다.
 *
 * sharp 는 네이티브 모듈이라 못 불러올 수 있다(설치 손상 등). 그때는 원본을
 * 그대로 돌려준다 — **압축은 최적화지 필수 단계가 아니다. 발행을 막지 않는다.**
 */

/** 블로그 본문 폭의 약 1.5배 — 레티나에서도 또렷하고, 이보다 크면 낭비다 */
const MAX_WIDTH = 1200;

/** 이보다 작으면 손대지 않는다 (줄여도 얻는 게 없다) */
const SKIP_UNDER_BYTES = 60 * 1024;

let sharpModule: any | null | undefined;

function loadSharp(): any | null {
  if (sharpModule !== undefined) return sharpModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpModule = require('sharp');
  } catch (e: any) {
    console.warn('[IMAGE-OPT] sharp 를 불러오지 못했습니다 — 원본 그대로 사용합니다:', String(e?.message || e).slice(0, 80));
    sharpModule = null;
  }
  return sharpModule;
}

export interface OptimizeResult {
  buffer: Buffer;
  mime: string;
  /** 원본 대비 줄어든 바이트 (0 이면 손대지 않았다는 뜻) */
  savedBytes: number;
  reason?: string;
}

/** 움직이는 GIF 인가 — 프레임이 2개 이상이면 애니메이션이다 */
function isAnimatedGif(buf: Buffer): boolean {
  if (buf.length < 6) return false;
  if (buf.subarray(0, 3).toString('ascii') !== 'GIF') return false;
  let frames = 0;
  for (let i = 0; i < buf.length - 2 && frames < 2; i += 1) {
    // 0x21 0xF9 0x04 = Graphic Control Extension — 프레임마다 하나씩 붙는다
    if (buf[i] === 0x21 && buf[i + 1] === 0xF9 && buf[i + 2] === 0x04) frames += 1;
  }
  // 압축 데이터 안에서 우연히 이 패턴이 나올 수도 있다 — 그러면 압축을 건너뛸 뿐이라 안전하다
  return frames >= 2;
}

/**
 * 이미지 버퍼를 웹에 올리기 좋은 크기로 줄인다.
 * 실패하거나 이득이 없으면 원본을 그대로 돌려준다 — 예외를 던지지 않는다.
 */
export async function optimizeImageBuffer(input: Buffer, inputMime = 'image/png'): Promise<OptimizeResult> {
  const original: OptimizeResult = { buffer: input, mime: inputMime, savedBytes: 0 };
  if (!input || input.length === 0) return { ...original, reason: '빈 버퍼' };
  if (isAnimatedGif(input)) return { ...original, reason: '움직이는 GIF — 그대로 둔다' };
  if (input.length < SKIP_UNDER_BYTES) return { ...original, reason: '이미 충분히 작다' };

  const sharp = loadSharp();
  if (!sharp) return { ...original, reason: 'sharp 없음' };

  try {
    const meta = await sharp(input).metadata();
    if (meta.pages && meta.pages > 1) {
      return { ...original, reason: '여러 프레임(애니메이션) — 그대로 둔다' };
    }

    const base = () => sharp(input)
      .rotate()                                             // EXIF 회전 정보를 실제로 적용하고 태그는 버린다
      .resize({ width: MAX_WIDTH, withoutEnlargement: true });

    /**
     * 투명한 부분이 있으면 JPEG 는 쓸 수 없다 — 투명이 검게 칠해진다.
     * 그 경우 WebP 만 후보다 (WebP 는 알파를 지원한다).
     */
    const hasAlpha = !!meta.hasAlpha;
    const candidates: Array<{ mime: string; buf: Buffer }> = [];

    const webp = await base().webp({ quality: 82 }).toBuffer();
    candidates.push({ mime: 'image/webp', buf: webp });

    if (!hasAlpha) {
      const jpeg = await base().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      candidates.push({ mime: 'image/jpeg', buf: jpeg });
    }

    const best = candidates.reduce((a, b) => (b.buf.length < a.buf.length ? b : a));

    // 줄인 결과가 원본보다 크면 의미가 없다 (이미 최적화된 JPEG 등)
    if (best.buf.length >= input.length) {
      return { ...original, reason: '원본이 이미 더 작다' };
    }

    return {
      buffer: best.buf,
      mime: best.mime,
      savedBytes: input.length - best.buf.length,
    };
  } catch (e: any) {
    console.warn('[IMAGE-OPT] 최적화 실패 — 원본 그대로 사용합니다:', String(e?.message || e).slice(0, 80));
    return { ...original, reason: '처리 실패' };
  }
}

/** `data:image/...;base64,...` 문자열을 최적화한다. 형식이 아니면 그대로 돌려준다. */
export async function optimizeDataUrl(dataUrl: string): Promise<{ dataUrl: string; savedBytes: number }> {
  const m = String(dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) return { dataUrl, savedBytes: 0 };

  const buf = Buffer.from(m[2]!, 'base64');
  const result = await optimizeImageBuffer(buf, m[1]!);
  if (result.savedBytes <= 0) return { dataUrl, savedBytes: 0 };

  return {
    dataUrl: `data:${result.mime};base64,${result.buffer.toString('base64')}`,
    savedBytes: result.savedBytes,
  };
}

/** 로그용 — 바이트를 읽기 좋은 단위로 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

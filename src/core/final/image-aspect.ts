/**
 * 🖼️ 이미지 가로세로비 정규화 (v3.8.472)
 *
 * 사용자 보고: "워드프레스 썸네일 이미지가 위아래가 짤립니다."
 *
 * ## 왜 잘렸나
 * 발행 경로 전체가 **AI 썸네일은 16:9 로 나온다**는 전제로 짜여 있다:
 *   · orchestration `bgpt-thumbnail-box`  → aspect-ratio:16/9 + object-fit:cover
 *   · wordpress-publisher 주입 CSS        → 같은 규칙을 !important 로 다시 씌운다
 *   · 워드프레스 테마의 대표 이미지 자리   → 보통 16:9 로 하드 크롭
 * 그런데 OpenAI Images API 에는 16:9 사이즈가 없다. imageDispatcher 는 landscape
 * 중 유일한 선택지인 **1536x1024(3:2)** 를 쓴다. 3:2 를 16:9 상자에 cover 로 넣으면
 * 위아래가 각각 7.8%(합계 15.6%) 잘려 나간다 — 인물 머리와 상단 카피가 사라진다.
 *
 * ## 어떻게 고치나
 * CSS 로는 못 막는다(워드프레스가 인라인 style 을 지우고, 테마 크롭은 우리 손 밖이다).
 * 그래서 **이미지 자체를 진짜 16:9 로 만든다.** 그러면 아래 어느 소비자도 자를 게 없다.
 *
 * 자르지 않고 **넓힌다**: 원본은 한 픽셀도 건드리지 않고 캔버스만 키운 뒤,
 * 남는 양옆을 원본을 흐리게 확대한 배경으로 채운다(레터박스 대신 블러 배경 —
 * 회색 띠보다 훨씬 자연스럽다). 실패하면 원본을 그대로 돌려준다 — 발행을 막지 않는다.
 */

/** 이 오차 안이면 이미 목표 비율로 본다 (1536x1024 는 0.844 라 여기 안 걸린다) */
const RATIO_TOLERANCE = 0.02;

/** 배경 블러 강도 — 원본 경계가 눈에 띄지 않을 정도 */
const BACKGROUND_BLUR_SIGMA = 24;

let sharpModule: any | null | undefined;

function loadSharp(): any | null {
  if (sharpModule !== undefined) return sharpModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpModule = require('sharp');
  } catch (e: any) {
    console.warn('[ASPECT] sharp 를 불러오지 못했습니다 — 원본 비율 그대로 사용합니다:', String(e?.message || e).slice(0, 80));
    sharpModule = null;
  }
  return sharpModule;
}

/**
 * 목표 비율에 맞는 캔버스 크기를 구한다. **항상 원본보다 크거나 같다** — 자르지 않는다.
 */
export function computePaddedCanvas(
  width: number,
  height: number,
  targetRatio: number,
): { canvasWidth: number; canvasHeight: number } | null {
  if (!(width > 0) || !(height > 0) || !(targetRatio > 0)) return null;

  const currentRatio = width / height;
  if (Math.abs(currentRatio - targetRatio) / targetRatio <= RATIO_TOLERANCE) return null;

  // 원본이 목표보다 좁으면(세로로 김) 좌우를 넓히고, 넓으면 위아래를 넓힌다.
  return currentRatio < targetRatio
    ? { canvasWidth: Math.round(height * targetRatio), canvasHeight: height }
    : { canvasWidth: width, canvasHeight: Math.round(width / targetRatio) };
}

/**
 * 이미지 버퍼를 목표 비율 캔버스에 **잘라내지 않고** 담는다.
 * 이미 목표 비율이거나 처리에 실패하면 null 을 돌려준다(호출부는 원본을 쓴다).
 */
export async function padBufferToAspect(
  input: Buffer,
  targetRatio: number,
): Promise<{ buffer: Buffer; mime: string; canvasWidth: number; canvasHeight: number } | null> {
  const sharp = loadSharp();
  if (!sharp || !input || input.length === 0) return null;

  try {
    const meta = await sharp(input).metadata();
    // 움직이는 이미지는 손대지 않는다 — 프레임이 깨진다.
    if (meta.pages && meta.pages > 1) return null;

    const canvas = computePaddedCanvas(Number(meta.width), Number(meta.height), targetRatio);
    if (!canvas) return null;

    const { canvasWidth, canvasHeight } = canvas;

    // 배경 = 원본을 캔버스 전체에 꽉 채워 자른 뒤 흐리게 한 것. 여기서 잘린 건 배경일 뿐,
    // 그 위에 원본 전체가 그대로 얹히므로 보여야 할 내용은 하나도 사라지지 않는다.
    const background = await sharp(input)
      .resize(canvasWidth, canvasHeight, { fit: 'cover', position: 'center' })
      .blur(BACKGROUND_BLUR_SIGMA)
      .toBuffer();

    const composed = await sharp(background)
      .composite([{ input, gravity: 'center' }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return { buffer: composed, mime: 'image/jpeg', canvasWidth, canvasHeight };
  } catch (e: any) {
    console.warn('[ASPECT] 비율 정규화 실패 — 원본 그대로 사용합니다:', String(e?.message || e).slice(0, 80));
    return null;
  }
}

/**
 * `data:image/...;base64,...` 를 목표 비율로 정규화한다.
 * 데이터 URL 이 아니거나 이미 목표 비율이면 **받은 문자열을 그대로** 돌려준다.
 */
export async function padDataUrlToAspect(
  dataUrl: string,
  targetRatio: number,
  label = 'image',
): Promise<string> {
  const m = String(dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) return dataUrl;

  const result = await padBufferToAspect(Buffer.from(m[2]!, 'base64'), targetRatio);
  if (!result) return dataUrl;

  console.log(`[ASPECT] ✅ ${label} → ${result.canvasWidth}x${result.canvasHeight} 로 넓힘 (잘라내지 않음)`);
  return `data:${result.mime};base64,${result.buffer.toString('base64')}`;
}

/** 발행 경로 전체가 전제하는 비율 */
export const PUBLISH_ASPECT_RATIO = 16 / 9;

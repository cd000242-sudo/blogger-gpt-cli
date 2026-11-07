// src/core/codex-image/codexImageFrame.ts
// Codex image_gen takes no size argument and does not always honour the ratio line (the Naver app measured 16:9 for
// most "square" requests). The saved file is centre-cropped to the requested frame (default 16:9, the blog frame).
// Anything sharp cannot read is passed through unchanged: an image is never lost over its frame.

const RATIOS: Readonly<Record<string, number>> = Object.freeze({ '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16, '4:3': 4 / 3, '3:4': 3 / 4 });
const TOLERANCE = 0.02;

export function codexTargetRatio(ratio: unknown): { key: string; value: number } {
  const key = Object.prototype.hasOwnProperty.call(RATIOS, String(ratio ?? '')) ? String(ratio) : '16:9';
  return { key, value: RATIOS[key] as number };
}

/** The largest centred box with the target ratio, or null when the image is already within 2% of it. */
export function centerCropBox(width: number, height: number, target: number): { left: number; top: number; width: number; height: number } | null {
  if (!(width > 0 && height > 0 && target > 0)) return null;
  if (Math.abs(width / height - target) / target <= TOLERANCE) return null;
  const cropWidth = Math.min(width, Math.round(height * target));
  const cropHeight = Math.min(height, Math.round(width / target));
  return { left: Math.floor((width - cropWidth) / 2), top: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight };
}

export async function fitCodexImageToRatio(buffer: Buffer, ratio: unknown): Promise<{ buffer: Buffer; cropped: boolean; from: string; to: string }> {
  const { value } = codexTargetRatio(ratio);
  try {
    // Loaded here so a machine without the native sharp binary can still use every other engine.
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const from = `${meta.width}x${meta.height}`;
    const box = centerCropBox(Number(meta.width), Number(meta.height), value);
    if (!box) return { buffer, cropped: false, from, to: from };
    const out = await sharp(buffer).extract(box).toBuffer();
    return { buffer: out, cropped: true, from, to: `${box.width}x${box.height}` };
  } catch {
    return { buffer, cropped: false, from: 'unknown', to: 'unknown' };
  }
}

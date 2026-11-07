// src/core/codex-image/codexImageInstruction.ts
// The instruction handed to `codex exec` (on stdin). It tells the model to pass the prompt to the image_gen tool
// untouched: the dispatcher already decided what to draw, the model must not rewrite or "improve" it.
// Ported from the Naver app (src/image/codex/codexImageInstruction.ts), single-image form only: one session = one image.

const SINGLE_HEAD = '이미지 생성 도구(image_gen.imagegen)에 아래 프롬프트를 한 글자도 바꾸지 말고 그대로 넘겨 이미지 1장만 만드세요. 다른 작업이나 설명은 하지 마세요. 프롬프트: ';

// image_gen takes no size argument, so the frame comes from the prompt text. Orbit blog images are 16:9 by default.
const ASPECT_FRAMES: Readonly<Record<string, string>> = Object.freeze({
  '16:9': 'wide landscape 16:9',
  '1:1': 'square 1:1 (1024x1024). Keep the main subject and all text inside the central square',
  '9:16': 'tall portrait 9:16',
  '4:3': 'landscape 4:3',
  '3:4': 'portrait 3:4',
});

export const DEFAULT_CODEX_IMAGE_RATIO = '16:9';

/** Appends the ratio line the image tool reads. Unknown ratios fall back to 16:9. */
export function withCodexAspectRatio(prompt: string, ratio: unknown = DEFAULT_CODEX_IMAGE_RATIO): string {
  const key = Object.prototype.hasOwnProperty.call(ASPECT_FRAMES, String(ratio ?? '')) ? String(ratio) : DEFAULT_CODEX_IMAGE_RATIO;
  return `${String(prompt ?? '').trim()}\nASPECT RATIO: ${ASPECT_FRAMES[key]}. Compose for this frame; keep every subject and all text inside it.`;
}

/** The stdin text for one image. Quotes inside the prompt are kept as they are (the prompt is passed verbatim). */
export function buildCodexImageInstruction(prompt: string): string {
  const clean = String(prompt ?? '').trim();
  if (!clean) throw new Error('Codex 구독 이미지에 넘길 프롬프트가 비어 있습니다.');
  return `${SINGLE_HEAD}"${clean}"`;
}

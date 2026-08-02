/**
 * 진짜 i2i — 참고 이미지를 실제로 넘긴다 (v3.8.407)
 *
 * 사용자 지적(2026-08-02):
 *   "드롭샷 말고 기존에 한글 되면서 이미지2이미지 되는 건 나노바나나랑 GPT 이미지2 말곤 안 된다니까"
 *   "우리 썸네일을 가져오잖아? 그 이미지를 참고 이미지로 쓰면 되잖아. 순서 바꿔주고"
 *   "쇼핑모드로는 반자동 발행해도 썸네일은 돈 안 드니까 수집해서 대표이미지를 넣게 해줘"
 *
 * 조사 결과 (엔진별 i2i 지원):
 *   나노바나나 1·2·Pro  Gemini generateContent — parts 에 inlineData 동봉 → 가능
 *   GPT 이미지 1·2      images/generations 는 불가, images/edits 라야 가능
 *   Prodia              jobType 이 전부 ...txt2img.v1 (현재 설정으로는 불가)
 *   DeepInfra FLUX-2    요청 본문에 이미지 입력 필드 없음
 *   ImageFX / Flow      UI 자동화 — 불가
 *   Dropshot            가능 (사용자 기간 만료)
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';
import { buildGeminiReferenceParts, fetchImagesAsBlobs } from '../src/thumbnail';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const thumb = read('src', 'thumbnail.ts');
const dispatcher = read('src', 'core', 'imageDispatcher.ts');
const orch = read('src', 'core', 'final', 'orchestration.ts');

const PNG_DATA_URL = `data:image/png;base64,${Buffer.from('x'.repeat(300)).toString('base64')}`;

describe('참고 이미지 → Gemini parts', () => {
  it('⭐ dataURL 을 inlineData 로 바꾼다', async () => {
    const parts = await buildGeminiReferenceParts([PNG_DATA_URL]);
    expect(parts).toHaveLength(1);
    expect(parts[0].inlineData.mimeType).toBe('image/png');
    expect(typeof parts[0].inlineData.data).toBe('string');
  });

  it('⭐ 최대 3장까지만 쓴다 (더 넣으면 모델이 산만해지고 요청도 커진다)', async () => {
    const many = Array(6).fill(PNG_DATA_URL);
    expect(await buildGeminiReferenceParts(many)).toHaveLength(3);
  });

  it('⭐ 잘못된 입력에 안전하다 — 참고 사진 때문에 생성이 막히면 안 된다', async () => {
    expect(await buildGeminiReferenceParts([])).toEqual([]);
    expect(await buildGeminiReferenceParts(undefined)).toEqual([]);
    expect(await buildGeminiReferenceParts(['그냥텍스트', 'ftp://x/y.png'])).toEqual([]);
  });
});

describe('참고 이미지 → OpenAI Blob', () => {
  it('dataURL 을 Blob 으로 바꾼다', async () => {
    const blobs = await fetchImagesAsBlobs([PNG_DATA_URL]);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.type).toBe('image/png');
  });

  it('빈 입력·잘못된 입력에 안전하다', async () => {
    expect(await fetchImagesAsBlobs([])).toEqual([]);
    expect(await fetchImagesAsBlobs(['nope'])).toEqual([]);
  });
});

describe('나노바나나 i2i 배선', () => {
  it('⭐ 참고 이미지가 있으면 parts 배열로 부른다 (예전엔 텍스트만 넘겼다)', () => {
    expect(thumb).toContain('const refParts = await buildGeminiReferenceParts(referenceImages)');
    expect(thumb).toContain('model.generateContent(genRequest)');
  });

  it('참고 사진을 "실제 제품"으로 쓰라고 지시한다', () => {
    expect(thumb).toContain('Use the reference photo above as the actual product');
  });

  it('디스패처가 나노바나나에 참고 이미지를 넘긴다', () => {
    const block = blockBetween(dispatcher, 'v3.8.407 — 나노바나나도 i2i', 'if (result.ok)');
    expect(block).toContain('referenceImageList');
    expect(block).toContain('referenceImages: nbRefs');
  });
});

describe('GPT 이미지 i2i 배선', () => {
  it('⭐ 참고 이미지가 있으면 images/edits 로 간다 (generations 는 이미지를 못 받는다)', () => {
    expect(thumb).toContain('https://api.openai.com/v1/images/edits');
    expect(thumb).toContain('const gptRefs = await fetchImagesAsBlobs(options.referenceImages)');
  });

  it('참고 이미지가 없으면 예전처럼 generations 를 쓴다', () => {
    expect(thumb).toContain('https://api.openai.com/v1/images/generations');
  });

  it('디스패처가 GPT 이미지에 참고 이미지를 넘긴다', () => {
    const block = blockBetween(dispatcher, 'v3.8.407 — GPT Image 도 i2i', 'if (result.ok)');
    expect(block).toContain('referenceImages: gptRefs');
  });
});

describe('순서 — 썸네일을 소제목 이미지의 톤 기준으로', () => {
  it('⭐ 소제목 이미지 루프보다 먼저 참고 이미지를 정한다', () => {
    const refAt = orch.indexOf('toneReferenceImage');
    const loopAt = orch.indexOf('const imageGenStartTime');
    expect(refAt).toBeGreaterThan(-1);
    expect(refAt).toBeLessThan(loopAt);      // 순서가 뒤집히면 참고할 게 없다
  });

  it('일반 이미지 생성에도 참고 이미지를 넘긴다', () => {
    expect(orch).toContain('dispatchExtra.referenceImageList = [toneReferenceImage]');
  });

  it('쇼핑모드는 건드리지 않는다 — 이미 상품 사진을 참고로 쓴다', () => {
    expect(orch).toContain("if (!(payload as any).productImages?.length)");
  });
});

describe('반자동 쇼핑모드 — 썸네일은 공짜니까 넣는다', () => {
  it('⭐ 소제목 이미지를 꺼도 수집 상품 사진이 있으면 썸네일은 살린다', () => {
    expect(orch).toContain('const hasCollectedProductImage');
    expect(orch).toContain('&& !hasCollectedProductImage');
  });

  it('왜 살리는지 알린다 (추가 비용 없음)', () => {
    expect(orch).toContain('썸네일은 넣습니다 (추가 비용 없음)');
  });

  it('쇼핑모드가 아니면 예전 동작 그대로', () => {
    // 고정 길이 슬라이스 금지 — 선언부터 thumbnailDisabled 계산까지를 경계로 잡는다
    const block = blockBetween(orch, 'const hasCollectedProductImage', 'const thumbnailDisabled');
    expect(block).toContain("contentMode === 'shopping'");
  });
});

/**
 * Prodia · DeepInfra i2i (v3.8.408)
 *
 * 사용자: "가능하다면 가능하게 만들어주면 되지 않니?"
 *
 * 문서 확인(2026-08-02):
 *   Prodia    inference.flux.dev.img2img.v1 / .schnell.img2img.v1 실재.
 *             multipart 로 job 설정 JSON + 이미지 파일.
 *   DeepInfra FLUX-2-dev 는 txt2img 전용. 이미지 입력은 FLUX.1-Kontext-dev 가 받는다.
 *             multipart 로 `image` 필드.
 *   Leonardo  가능하나 2단계 — 이미지 업로드로 ID 를 받아 init_image_id 로 넘겨야 한다.
 *             (사용자 환경에 Leonardo 키가 없어 후순위)
 */
describe('Prodia i2i', () => {
  it('⭐ 참고 이미지가 있으면 img2img 작업 타입으로 바꾼다', () => {
    expect(thumb).toContain('inference.flux.dev.img2img.v1');
    expect(thumb).toContain('inference.flux.schnell.img2img.v1');
  });

  it('참고 이미지가 없으면 기존 txt2img 그대로', () => {
    expect(thumb).toContain('inference.flux.schnell.txt2img.v1');
  });

  it('⭐ img2img 는 multipart 로 보낸다 (JSON 으로는 이미지를 못 싣는다)', () => {
    const block = blockBetween(thumb, 'v3.8.408 — Prodia 도 i2i', '2. 작업 완료 대기');
    expect(block).toContain('new FormData()');
    expect(block).toContain("form.append('job'");
    expect(block).toContain("form.append('input'");
  });

  it('디스패처가 Prodia 에 참고 이미지를 넘긴다', () => {
    expect(dispatcher).toContain('v3.8.408: Prodia 도 img2img');
    expect(dispatcher).toContain('referenceImages: prodiaRefs');
  });
});

describe('DeepInfra i2i', () => {
  it('⭐ i2i 일 때 FLUX.1-Kontext-dev 로 갈아탄다 (FLUX-2-dev 는 이미지를 못 받는다)', () => {
    expect(thumb).toContain('FLUX-1-Kontext-dev');
    expect(thumb).toContain('FLUX-2-dev');
  });

  it('⭐ multipart 의 image 필드로 보낸다', () => {
    const block = blockBetween(thumb, 'v3.8.408 — DeepInfra 도 i2i', 'if (!response.ok)');
    expect(block).toContain("form.append('image'");
    expect(block).toContain('new FormData()');
  });

  it('참고 이미지가 없으면 기존 JSON 경로 그대로', () => {
    const block = blockBetween(thumb, 'v3.8.408 — DeepInfra 도 i2i', 'if (!response.ok)');
    expect(block).toContain('JSON.stringify(requestBody)');
  });

  it('디스패처가 DeepInfra 에 참고 이미지를 넘긴다', () => {
    expect(dispatcher).toContain('referenceImages: diRefs');
  });
});

describe('i2i 지원 엔진 정리', () => {
  it('⭐ 네 엔진 계열 모두 참고 이미지를 받는다', () => {
    // 나노바나나(Gemini) · GPT 이미지(OpenAI) · Prodia · DeepInfra
    expect(dispatcher).toContain('referenceImages: nbRefs');
    expect(dispatcher).toContain('referenceImages: gptRefs');
    expect(dispatcher).toContain('referenceImages: prodiaRefs');
    expect(dispatcher).toContain('referenceImages: diRefs');
  });

  it('참고 이미지가 없으면 어느 엔진이든 예전 경로를 쓴다', () => {
    // 조건부 전개(...(refs?.length ? {...} : {}))라 없으면 옵션 자체가 안 붙는다
    expect((dispatcher.match(/\?\.length \? \{ referenceImages/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});

/**
 * 쇼핑모드는 i2i 되는 엔진으로 (v3.8.409)
 *
 * 사용자 요구: "쇼핑모드는 가능한 모델로 생성되게끔 조치를 취해놓으면 되지 않니?"
 *
 * ImageFX·Flow 는 브라우저 조작이라 이미지를 못 넣고, 'crawled'·'custom' 은 생성 엔진이 아니다.
 * 그런 엔진이면 상품 사진이 통째로 무시되고, 생성이 실패하면
 * 1장뿐인 상품 사진이 소제목마다 반복돼 글이 고장 난 것처럼 보인다(사용자가 겪은 증상).
 */
import { engineSupportsI2i, pickI2iEngine } from '../src/core/imageDispatcher';

describe('i2i 가능 엔진 판정', () => {
  it('⭐ 참고 이미지를 실제로 쓰는 엔진만 true', () => {
    ['nanobanana', 'nanobanana2', 'nanobananapro', 'gptimage1', 'gptimage2', 'prodia', 'deepinfra', 'dropshot']
      .forEach((e) => expect(engineSupportsI2i(e)).toBe(true));
  });

  it('⭐ 브라우저 조작 엔진과 비생성 값은 false', () => {
    ['imagefx', 'flow', 'crawled', 'custom', 'none', 'leonardo', '']
      .forEach((e) => expect(engineSupportsI2i(e)).toBe(false));
  });
});

describe('쇼핑모드 엔진 자동 전환', () => {
  const env = { GEMINI_API_KEY: 'x'.repeat(40), OPENAI_API_KEY: 'y'.repeat(50) };

  it('⭐ 이미 가능한 엔진은 그대로 둔다 (멋대로 바꾸지 않는다)', () => {
    expect(pickI2iEngine('nanobanana2', env)).toMatchObject({ engine: 'nanobanana2', switched: false });
    expect(pickI2iEngine('gptimage2', env)).toMatchObject({ engine: 'gptimage2', switched: false });
  });

  it('⭐ i2i 불가 엔진이면 가능한 것으로 바꾼다', () => {
    ['imagefx', 'flow', 'crawled'].forEach((e) => {
      const r = pickI2iEngine(e, env);
      expect(r.switched).toBe(true);
      expect(engineSupportsI2i(r.engine)).toBe(true);
    });
  });

  it('⭐ 왜 바꿨는지 이유를 준다 (조용히 바꾸지 않는다)', () => {
    expect(pickI2iEngine('imagefx', env).reason).toContain('상품 사진을 참고할 수 없습니다');
  });

  it('⭐ 키가 있는 엔진만 고른다', () => {
    // Gemini 키만 있으면 OpenAI 계열로 가지 않는다
    const geminiOnly = { GEMINI_API_KEY: 'x'.repeat(40) };
    expect(pickI2iEngine('imagefx', geminiOnly).engine).toMatch(/^nanobanana/);
  });

  it('⭐ 결과는 항상 i2i 가능한 엔진이거나 입력 그대로다 (엉뚱한 엔진으로 튀지 않는다)', () => {
    // 빈 env 를 넘겨도 engineKeyAvailable 은 실제 .env 를 함께 본다(운영 동작).
    // 그래서 "키가 하나도 없는 상황"은 여기서 흉내낼 수 없다.
    // 대신 **어떤 입력에도 결과가 안전한지**를 본다.
    ['imagefx', 'flow', 'crawled', 'custom', '', 'nanobanana2'].forEach((e) => {
      const r = pickI2iEngine(e, {});
      expect(engineSupportsI2i(r.engine) || r.engine === e).toBe(true);
    });
  });

  it('orchestration 이 이 판정을 쓴다', () => {
    expect(orch).toContain('pickI2iEngine');
    expect(orch).toContain('i2iPick.switched');
  });
});

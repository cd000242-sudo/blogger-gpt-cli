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

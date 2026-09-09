const fs = require('fs');
const path = require('path');

import { SUPPORTED_IMAGE_ENGINES, normalizeImageEngine, engineSupportsI2i } from '../src/core/imageDispatcher';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.709 — GPT 이미지 2.5 (2026-09-08 OpenAI 출시) 배선.
 *
 * API 모델은 둘: gpt-image-2.5-flare(기본 추천 — gpt-image-2 대비 품질↑·지연 50%↓)
 *              gpt-image-2.5-sunburst(프리미엄 — 편집 제어 정밀, 느림).
 * 가격은 토큰 단가가 gpt-image-2의 정확히 2배.
 *
 * 이 테스트는 기능이 아니라 **배선 실존**을 잰다 — 없는 id·미배선은 에러 없이
 * 조용히 통과한다는 게 이 저장소에서 6번 재발한 사고라서(v3.8.656 등),
 * 엔진 등록 → 디스패치 케이스 → UI 옵션 → 비용표까지 한 줄씩 확인한다.
 */
describe('v3.8.709 GPT 이미지 2.5 배선', () => {
  test('엔진 목록에 flare·sunburst 가 등록됐다', () => {
    expect(SUPPORTED_IMAGE_ENGINES).toContain('gptimage25flare');
    expect(SUPPORTED_IMAGE_ENGINES).toContain('gptimage25sunburst');
  });

  test('별칭이 정규화된다 — 무접미사는 OpenAI 기본 추천인 flare 로', () => {
    expect(normalizeImageEngine('gpt-image-2.5')).toBe('gptimage25flare');
    expect(normalizeImageEngine('gpt-image-2.5-flare')).toBe('gptimage25flare');
    expect(normalizeImageEngine('gpt-image-2.5-sunburst')).toBe('gptimage25sunburst');
    expect(normalizeImageEngine('플레어')).toBe('gptimage25flare');
    expect(normalizeImageEngine('선버스트')).toBe('gptimage25sunburst');
  });

  test('i2i(images/edits) 지원으로 분류된다 — 쇼핑모드 상품 사진 참조가 걸린다', () => {
    expect(engineSupportsI2i('gptimage25flare')).toBe(true);
    expect(engineSupportsI2i('gptimage25sunburst')).toBe(true);
  });

  test('디스패처에 실제 케이스와 OpenAI 모델 id 가 배선됐다', () => {
    const src = read('src/core/imageDispatcher.ts');
    expect(src).toContain("case 'gptimage25flare':");
    expect(src).toContain("case 'gptimage25sunburst':");
    expect(src).toContain("'gpt-image-2.5-flare'");
    expect(src).toContain("'gpt-image-2.5-sunburst'");
  });

  test('UI 드롭다운에 두 엔진이 실제로 존재한다 (썸네일·소제목·배치 등)', () => {
    const html = read('electron/ui/index.html');
    const flareCount = (html.match(/value="gptimage25flare"/g) || []).length;
    const sunburstCount = (html.match(/value="gptimage25sunburst"/g) || []).length;
    // 기존 gptimage2 가 있던 select 7곳 전부에 들어가야 한다
    expect(flareCount).toBeGreaterThanOrEqual(7);
    expect(sunburstCount).toBeGreaterThanOrEqual(7);
  });

  test('비용표·라벨이 배선됐다 — 비용 미리보기가 0원으로 조용히 죽지 않는다', () => {
    const script = read('electron/ui/script.js');
    expect(script).toContain("'gptimage25flare-medium'");
    expect(script).toContain("'gptimage25sunburst-high'");
    expect(script).toContain("'gptimage25flare': 112");

    const queue = read('electron/ui/modules/publish-queue.js');
    expect(queue).toContain('gptimage25flare');

    const cardnews = read('electron/ui/modules/cardnews.js');
    expect(cardnews).toContain("'gptimage25flare'");
  });
});

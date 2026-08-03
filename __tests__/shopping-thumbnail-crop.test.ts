/**
 * 쇼핑 썸네일 — 크롤한 실제 상품 사진은 잘라내지 않는다 (v3.8.428)
 *
 * 사용자 보고: "토스 쉐어링크는 썸네일 수집은 잘했는데 짤려서 나오네요"
 *
 * 원인: 썸네일 박스가 aspect-ratio:16/9 고정 + object-fit:cover였다.
 *   AI 생성 썸네일은 이미 16:9로 뽑히니 cover가 문제없지만, 토스 og:image처럼
 *   원본 비율이 제각각인(세로 인물 사진 등) 크롤 이미지는 cover가 위·아래(또는
 *   양옆)를 잘라낸다 — 실측 스크린샷에서 사람 머리가 잘려 나갔다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('썸네일 이미지가 크롤 상품 사진인지 추적한다', () => {
  it('⭐ thumbnailFromProductPhoto 플래그를 선언한다 (기본값 false)', () => {
    expect(orch).toContain('let thumbnailFromProductPhoto = false;');
  });

  it('⭐ useProductImages 분기(수집 이미지를 썸네일로 쓰는 경로)에서 플래그를 켠다', () => {
    const block = braceBlock(orch, 'if (!thumbnailUrl && useProductImages) {');
    expect(block).toContain('thumbnailFromProductPhoto = true;');
  });

  it('AI 생성 썸네일 경로(dispatchThumbnailGeneration)는 플래그를 건드리지 않는다', () => {
    // dispatchThumbnailGeneration 호출부터 그 결과 처리 블록까지 플래그 대입이 없어야
    // AI 생성 썸네일이 실수로 contain 취급되는 회귀를 막는다.
    const start = orch.indexOf('const thumbResult = await dispatchThumbnailGeneration(\n          thumbnailSource,');
    expect(start).toBeGreaterThan(-1);
    const end = orch.indexOf('const endTime = Date.now();', start);
    expect(end).toBeGreaterThan(start);
    expect(orch.slice(start, end)).not.toContain('thumbnailFromProductPhoto =');
  });
});

describe('썸네일 렌더 — 크롤 사진은 contain, AI 생성은 cover 그대로', () => {
  it('⭐ thumbFit을 플래그에 따라 분기한다', () => {
    expect(orch).toContain("const thumbFit = thumbnailFromProductPhoto ? 'contain' : 'cover';");
  });

  it('⭐ <img> 태그가 하드코딩된 cover 대신 thumbFit 변수를 쓴다', () => {
    const block = braceBlock(orch, "// 💰 썸네일 — 풀블리드 (패딩/그림자 없음)\n    if (thumbnailUrl) {");
    expect(block).toContain('object-fit:${thumbFit} !important');
    // 예전처럼 하드코딩된 cover가 이 img 태그 자체에는 남아있지 않아야 한다
    expect(block).not.toMatch(/object-fit:cover !important/);
  });

  it('박스 자체는 16:9·overflow:hidden 그대로다 — 레이아웃 크기는 안 바뀐다', () => {
    expect(orch).toContain('class="bgpt-thumbnail-box" style="width:100% !important;aspect-ratio:16/9 !important;margin:0;padding:0;overflow:hidden !important;');
  });
});

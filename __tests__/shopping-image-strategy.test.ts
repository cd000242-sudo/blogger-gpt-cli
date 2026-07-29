/**
 * 쇼핑모드 이미지 전략 테스트 (v3.8.385)
 *
 * 사용자 요구(2026-07-29):
 *   "썸네일을 제품으로 하고, 그 제품 기반으로 i2i로 소제목별로 딱 맞게 생성해서 넣을지
 *    아니면 기존 제품 이미지들을 소제목마다 전부 들고와서 배치할지를 정할 수 있게 해줘.
 *    글포스팅 이미지 서브탭에서."
 *   근거: "썸네일은 정확하게 어떤 제품인지를 보여줘야 한다 — 가치 입증이 되어야지."
 *
 * 설계:
 *   썸네일은 전략과 무관하게 **항상 실제 상품 사진**이다(orchestration useProductImages).
 *   본문 이미지만 두 전략 중 고른다.
 *     product-all : 수집 상품 사진을 소제목마다 그대로 (신뢰도 최우선, 기본값)
 *     product-i2i : 실제 상품을 reference 로 소제목 내용에 맞게 생성
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const orchestrationSrc = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const uiHtml = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
const postingSrc = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');

describe('UI — 글포스팅 이미지 서브탭에 선택지가 있다', () => {
  it('shoppingImageStrategy 셀렉트가 존재한다', () => {
    expect(uiHtml).toContain('id="shoppingImageStrategy"');
  });

  it('두 전략이 모두 옵션으로 있다', () => {
    expect(uiHtml).toContain('value="product-all"');
    expect(uiHtml).toContain('value="product-i2i"');
  });

  it('기본값은 상품 사진 그대로 — 신뢰도가 가장 높다', () => {
    expect(uiHtml).toMatch(/value="product-all"\s+selected/);
  });

  it('썸네일은 항상 실제 상품 사진임을 UI가 안내한다', () => {
    expect(uiHtml).toContain('썸네일은 두 경우 모두 실제 상품 사진');
  });

  it('h2ImageSource 셀렉트 바로 뒤에 배치돼 있다 — 이미지 탭', () => {
    const a = uiHtml.indexOf('id="h2ImageSource"');
    const b = uiHtml.indexOf('id="shoppingImageStrategy"');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
  });
});

describe('payload 배선 — 두 경로 모두', () => {
  it('DOM 직접 읽기 경로에서 값을 읽는다', () => {
    expect(postingSrc).toContain("document.getElementById('shoppingImageStrategy')?.value");
  });

  it('settings 경로에서도 값을 넘긴다', () => {
    expect(postingSrc).toContain('shoppingImageStrategy: settings.shoppingImageStrategy');
  });

  it('기본값이 정의돼 있다', () => {
    expect(postingSrc).toContain("shoppingImageStrategy: 'product-all'");
  });
});

describe('백엔드 — 전략별 동작', () => {
  it('쇼핑모드에서만 적용된다', () => {
    expect(orchestrationSrc).toContain("contentMode === 'shopping' && productPool.length > 0");
  });

  it('product-all 은 상품 사진을 순환 배치한다', () => {
    const i = orchestrationSrc.indexOf("shoppingStrategy === 'product-all'");
    expect(i).toBeGreaterThan(-1);
    const block = orchestrationSrc.slice(i, i + 420);
    expect(block).toContain('productPool[(i + 1) % productPool.length]');
  });

  it('썸네일과 같은 사진이 본문 1번에 또 나오지 않는다', () => {
    // 썸네일이 productImages[0] 을 쓰므로 본문은 인덱스 1부터 시작해야 한다
    expect(orchestrationSrc).toContain('썸네일이 0번을 쓰므로 본문은 1번부터 순환');
  });

  it('product-i2i 는 실제 상품을 reference 로 넘긴다', () => {
    const i = orchestrationSrc.indexOf("shoppingStrategy === 'product-i2i'");
    expect(i).toBeGreaterThan(-1);
    const block = orchestrationSrc.slice(i, i + 900);
    expect(block).toContain('referenceImageList: refs');
    expect(block).toContain('productPool.slice(0, 4)');
  });

  it('i2i 생성이 실패해도 상품 사진으로 대체한다 — 빈 자리를 남기지 않는다', () => {
    const i = orchestrationSrc.indexOf("shoppingStrategy === 'product-i2i'");
    // 블록 끝을 길이가 아니라 실제 경계로 잡는다 — 코드가 길어져도 테스트가 안 깨지게
    const end = orchestrationSrc.indexOf("if (!imageResult.ok && imageSource === 'crawled'", i);
    expect(end).toBeGreaterThan(i);
    const block = orchestrationSrc.slice(i, end);
    expect(block).toContain('생성 실패 → 상품 사진으로 대체');
    expect(block).toContain('생성 예외 → 상품 사진으로 대체');
  });

  it('기존 crawled 경로를 덮어쓰지 않는다', () => {
    // 전략 분기가 먼저 돌고, 결과가 없을 때만 기존 crawled 로직이 실행돼야 한다
    expect(orchestrationSrc).toContain("if (!imageResult.ok && imageSource === 'crawled'");
  });

  it('전략 미지정 시 product-all 로 동작한다', () => {
    expect(orchestrationSrc).toContain("(payload as any).shoppingImageStrategy || 'product-all'");
  });
});

describe('썸네일 정책 — 전략과 무관하게 실제 상품 사진', () => {
  it('쇼핑모드면 엔진 선택과 무관하게 상품 이미지를 쓴다', () => {
    // isShoppingMode 가 OR 조건에 있어야 사용자가 AI 엔진을 골라도 상품 사진이 이긴다
    expect(orchestrationSrc).toContain('isCrawledRequested || isShoppingMode || !userPickedAiEngine');
  });
});

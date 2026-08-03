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
import { braceBlock, blockBetween } from './helpers/source-block';

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

  /**
   * v3.8.401 — 기본값을 바꿨다. 실측 근거:
   *   쿠팡 오픈 API 응답의 이미지 필드는 productImage **1개뿐**이다.
   *   1장으로 소제목 5개를 채우면 같은 사진이 5번 반복된다.
   *   사용자 지적: "1장만 수집 가능하다면 상품 기반 생성만 가능해야 정상이네"
   */
  it('⭐ 기본값은 상품 기반 생성 — 수집 이미지가 1장뿐이라 반복 배치는 성립하지 않는다', () => {
    expect(uiHtml).toMatch(/value="product-i2i"\s+selected/);
    expect(uiHtml).not.toMatch(/value="product-all"\s+selected/);
  });

  /**
   * v3.8.442 에 정책이 바뀌었다.
   *   이전: 기본값 고정 product-i2i (쿠팡 대표컷 1장이 반복 배치되는 걸 막으려고).
   *   현재: 'auto' — **확보한 사진 장수**로 정한다. 쿠팡(1장)은 그대로 i2i 로
   *         떨어지고, 토스·네이버(v3.8.440 부터 15장 확보)는 실제 사진을 쓴다.
   * 근거: 구글 2026-03 코어 업데이트가 실사용 사진을 랭킹 요소로 올렸고,
   *       네이버는 스톡/생성 이미지에 감점을 준다.
   * 옛 기본값의 취지(1장짜리는 반복 배치 금지)는 장수 임계값이 그대로 지킨다.
   */
  it('⭐ 기본값은 auto — 사진 장수로 정하고, 1장짜리는 여전히 AI 생성으로 간다', () => {
    const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
    expect(posting).toContain("shoppingImageStrategy: 'auto'");
    // 옛 고정 기본값이 되살아나면 사진이 15장 있어도 AI 생성컷이 나간다
    expect(posting).not.toContain("shoppingImageStrategy: 'product-i2i'");
  });

  it('⭐⭐ 직접 고른 값만 payload 에 실린다 (안 고르면 auto 로 백엔드가 판단)', () => {
    const posting = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'modules', 'posting.js'), 'utf8');
    // 이 게이트가 없으면 select 가 늘 값을 갖고 있어 백엔드 자동 판단이 죽는다
    expect(posting).toContain('window.__strategyUserPicked');
  });

  it('⭐ 수집 사진을 못 쓰는 제휴사(쿠팡)면 product-all 옵션을 잠근다', () => {
    /**
     * v3.8.435: 기준이 "수집 장수 < 2" → "제휴사"로 바뀌었다.
     *   장수는 발행을 한 번 돌려야 정해지는 값이라, 설정 화면에서는 늘 1로 잡혀
     *   토스·네이버인데도 옵션이 영원히 잠겨 있었다(사용자 지적).
     *   제휴사를 고르는 순간 답이 나와 있으므로 그걸로 판정한다.
     */
    expect(uiHtml).toContain('const allDisabled = isShopping && !canUseCollected;');
    expect(uiHtml).toContain('쿠팡은 상품 페이지 수집이 막혀 있어 사용할 수 없습니다');
  });

  it('⭐ 상품 기반 생성을 골랐는데 소제목이 crawled 로 고정되던 버그가 없다', () => {
    // 예전: if (isShopping) { h2.value = 'crawled' } — 전략과 무관하게 강제됐다
    expect(uiHtml).not.toMatch(/if \(isShopping\) \{\s*const h2 = document\.getElementById\('h2ImageSource'\)/);
    expect(uiHtml).toContain('__preShoppingH2Source');       // 되돌릴 값을 기억한다
  });

  it('⭐ i2i 인데 못 하는 엔진이면 가능한 엔진으로 바꾼다', () => {
    // v3.8.409: 정규식 하드코딩을 pickI2iEngine 으로 대체했다.
    //   이제 'crawled' 뿐 아니라 imagefx·flow 처럼 구조적으로 i2i 가 안 되는 엔진도 잡고,
    //   **키가 있는** 엔진 중에서 고른다. 판정 자체는 i2i-reference-images.test.ts 가 검증한다.
    const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain('const i2iEngine =');
    expect(orch).toContain('pickI2iEngine');
    expect(orch).toContain('i2iPick.switched');
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
    // v3.8.401: 수집 이미지가 1장뿐이라 product-all 이 기본값이면 같은 사진이 반복된다
    // v3.8.442: 그 판단을 고정값이 아니라 **확보한 사진 장수**로 한다 (auto).
    //   사진이 1장이면 여전히 AI 생성으로 가므로 v3.8.401 의 취지는 그대로 지켜진다.
    expect(postingSrc).toContain("shoppingImageStrategy: 'auto'");
  });
});

describe('백엔드 — 전략별 동작', () => {
  it('쇼핑모드에서만 적용된다', () => {
    expect(orchestrationSrc).toContain("contentMode === 'shopping' && productPool.length > 0");
  });

  it('product-all 은 안 쓴 상품 사진부터 배치한다', () => {
    /**
     * ⚠️ 이 테스트는 v3.8.439 까지 `productPool[(i + 1) % productPool.length]` 를
     *   검사하며 **통과하고 있었지만 이유가 틀렸다.** product-all 블록에서 그 순환은
     *   v3.8.437 에 이미 제거됐는데, braceBlock 이 else-if 사슬을 한 구문으로 보고
     *   뒤따르는 product-i2i 블록(거기엔 폴백으로 순환이 남아 있다)까지 함께
     *   집어왔기 때문이다. 즉 없는 것을 있다고 통과시키고 있었다.
     *   범위를 product-all 블록으로 정확히 잘라 실제 동작을 검사한다.
     */
    const block = blockBetween(
      orchestrationSrc,
      "if (shoppingStrategy === 'product-all') {",
      "} else if (shoppingStrategy === 'product-i2i')",
    );
    expect(block).toContain('!usedProductImages.has(imgKey(u))');
    expect(block).not.toContain('productPool[(i + 1) % productPool.length]');
  });

  it('썸네일과 같은 사진이 본문 1번에 또 나오지 않는다', () => {
    /**
     * v3.8.437: 방식이 "1번부터 순환" → "안 쓴 것부터 고르기"로 바뀌었다.
     *   (순환은 섹션 수 > 사진 수면 반드시 중복됐다 — 사용자 실측)
     *   확인할 것은 그대로다: 썸네일이 쓰는 0번이 본문에 다시 나오면 안 된다.
     *   → 0번을 미리 '사용함'으로 표시해 두는 것으로 보장한다.
     */
    expect(orchestrationSrc).toContain('const thumbCandidate = ((payload.productImages as string[] | undefined) || [])[0];');
    // v3.8.439: 래핑 주소와 원본이 같은 파일임을 알아보도록 정규화 키를 쓴다
    expect(orchestrationSrc).toContain('usedProductImages.add(imgKey(thumbCandidate))');
  });

  it('product-i2i 는 실제 상품을 reference 로 넘긴다', () => {
    const i = orchestrationSrc.indexOf("shoppingStrategy === 'product-i2i'");
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(orchestrationSrc, "shoppingStrategy === 'product-i2i'");
    expect(block).toContain('referenceImageList: refs');
    expect(block).toContain('productPool.slice(0, 4)');
  });

  it('i2i 생성이 실패해도 상품 사진으로 대체한다 — 빈 자리를 남기지 않는다', () => {
    const i = orchestrationSrc.indexOf("shoppingStrategy === 'product-i2i'");
    // 블록 끝을 길이가 아니라 실제 경계로 잡는다 — 코드가 길어져도 테스트가 안 깨지게
    // v3.8.440: 경계 조건에 !leaveBlank 가 끼어들었다. 바뀌기 쉬운 부분을 뺀 짧은 표식으로 잡는다.
    const end = orchestrationSrc.indexOf("imageSource === 'crawled' && payload.productImages?.length", i);
    expect(end).toBeGreaterThan(i);
    const block = orchestrationSrc.slice(i, end);
    expect(block).toContain('생성 실패 → 상품 사진으로 대체');
    expect(block).toContain('생성 예외 → 상품 사진으로 대체');
  });

  it('기존 crawled 경로를 덮어쓰지 않는다', () => {
    // 전략 분기가 먼저 돌고, 결과가 없을 때만 기존 crawled 로직이 실행돼야 한다
    // v3.8.440: 여기에 !leaveBlank 가 추가됐다 (의도적으로 비운 자리는 건너뛴다)
    expect(orchestrationSrc).toContain("if (!imageResult.ok && !leaveBlank && imageSource === 'crawled'");
  });

  /**
   * v3.8.442 — 미지정이면 확보한 사진 장수로 정한다.
   * 옛 규칙("무조건 product-i2i")의 목적은 **사진 1장이 소제목마다 반복되는 것**을
   * 막는 데 있었다. 그 목적은 장수 임계값이 그대로 지킨다 — 오히려 더 정확하다.
   */
  it('⭐ 전략 미지정이면 사진 장수로 정한다 (1장 반복 배치로 떨어지지 않는다)', () => {
    expect(orchestrationSrc).toContain("const rawStrategy = String((payload as any).shoppingImageStrategy || '').trim();");
    expect(orchestrationSrc).toContain("rawStrategy === 'auto' ? '' : rawStrategy");
    const block = blockBetween(orchestrationSrc, 'const rawStrategy =', 'const productPool =');
    const m = block.match(/collectedPhotoCount\s*>=\s*(\d+)\s*\?\s*'product-all'\s*:\s*'product-i2i'/);
    expect(m).not.toBeNull();
    // 임계값이 2 이하로 내려가면 쿠팡 대표컷 1장짜리가 product-all 로 새어들어간다
    expect(Number(m![1])).toBeGreaterThanOrEqual(3);
  });
});

describe('썸네일 정책 — 전략과 무관하게 실제 상품 사진', () => {
  it('쇼핑모드면 엔진 선택과 무관하게 상품 이미지를 쓴다', () => {
    // isShoppingMode 가 OR 조건에 있어야 사용자가 AI 엔진을 골라도 상품 사진이 이긴다
    expect(orchestrationSrc).toContain('isCrawledRequested || isShoppingMode || !userPickedAiEngine');
  });
});

/**
 * 선택한 엔진으로 상품 기반 생성 (v3.8.406)
 *
 * 사용자 보고(2026-08-02):
 *   "소제목 이미지를 이미지 엔진으로 AI 생성하게끔 한다 했는데 왜 무시됐나요"
 *   "드롭샷은 기간 끝나서 내가 못 써. 선택한 이미지 생성 엔진으로 생성되게 해달라고"
 *
 * 원인 — imageDispatcher.ts 378행 주석 그대로:
 *   "v3.6.0: dropshot 엔진의 i2i 모드 — reference 이미지 URL 배열.
 *    **다른 엔진(nanobanana 등)은 무시한다.**"
 *   즉 참고 이미지를 실제로 쓰는 엔진은 dropshot 하나뿐이었다.
 *   사용자는 gptimage2 를 썼으니 상품을 전혀 안 보고 그렸고,
 *   실패하면 1장뿐인 상품 사진이 소제목마다 반복됐다(= 전부 썸네일처럼 보임).
 *
 * 조치: 상품명·카테고리를 **프롬프트에 실어** 보낸다. 엔진을 가리지 않는다.
 */
describe('상품 기반 생성이 엔진을 가리지 않는다', () => {
  const block = braceBlock(orchestrationSrc, "shoppingStrategy === 'product-i2i'");

  it('⭐ 상품명을 프롬프트에 싣는다 (참고 이미지를 무시하는 엔진에서도 통한다)', () => {
    expect(block).toContain('const productHint =');
    expect(block).toContain('제품이 실제로 쓰이는 장면');
  });

  it('⭐ 소제목 대신 상품 힌트를 디스패처에 넘긴다', () => {
    expect(block).toContain('i2iEngine,\n                  productHint,');
  });

  it('상품명 출처를 세 갈래로 찾는다 (제휴 상품 → 확정 상품명 → API 검색)', () => {
    expect(block).toContain('affiliateProducts?.[0]?.title');
    expect(block).toContain('resolvedProductName');
    expect(block).toContain('coupangProducts?.[0]?.productName');
  });

  it('상품명이 없으면 예전처럼 소제목만 쓴다 (동작을 깨지 않는다)', () => {
    expect(block).toContain(': section.h2;');
  });

  it('⭐ 사용자가 고른 엔진을 그대로 쓴다 (dropshot 강제 없음)', () => {
    expect(block).toContain('i2iEngine');
    expect(block).not.toContain("'dropshot-nanobanana-pro'");
  });

  it('무엇을 반영했는지 로그로 알린다', () => {
    // v3.8.432: 상품명 + 실제 특징(크기·착용 방식)을 함께 반영하게 되면서 로그 문구가 바뀌었다
    expect(block).toContain('🎨 상품 기반 생성');
    expect(block).toContain('실제 특징');
  });

  it('⭐ UI 문구가 사실과 맞는다 — "실제 상품을 참고해"는 거짓이었다', () => {
    // v3.8.435: 셀렉트 → 라디오로 바뀌며 문구가 짧아졌다. 뜻은 그대로다.
    expect(uiHtml).toContain('상품 정보를 반영해 소제목별로 새 이미지를 만듭니다');
    expect(uiHtml).not.toContain('실제 상품을 참고해 소제목별로 새로 생성');
  });
});

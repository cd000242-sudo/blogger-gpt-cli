/**
 * v3.8.440 — 사용자 보고 4건 회귀 방지
 *
 * 원문:
 *   "토스 쇼핑은 상세정보의 이미지먼저 수집해주고 추론하면서 제품이미지가없는
 *    이미지는 제외하고 제품이미지가있는이미지 위주로 수집해줘 그리고 부족하다면
 *    리뷰이미지를 들고오도록 수정해줘 만약 그래도 부족하다면 공란으로 놔둬
 *    이미지를 편집할수있으니까 따로넣으면되
 *    / 플랫폼변경이 설정에서 선택하면 바로바로 바뀌는게 너무 늦거든? … 티스토리를
 *    선택했는데 안바껴서 워드프레스로 발행이되었어
 *    / 원하는 위치에 커서를 두고 이미지 삽입버튼눌러서 이미지를 넣었는데 제일
 *    하단에 이미지가 생성이되네 … 그리고 링크삽입하는게 없고 글자크기나
 *    하이라이트 그리고 박스추가 등등 기능이 많이 빠져있어 추가해줘"
 *
 * 소스 텍스트를 검사하는 구조 테스트다. 이 앱의 결함은 대부분 "고쳤는데 그
 * 코드가 실행 경로에 없다"는 형태로 나타나므로, 배선 자체를 못으로 박아 둔다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const crawl = read('src/core/affiliate/crawl.ts');
const vision = read('src/core/affiliate/detail-image-vision.ts');
const orch = read('src/core/final/orchestration.ts');
const indexHtml = read('electron/ui/index.html');
const editor = read('electron/ui/modules/editor.js');
const editorImages = read('electron/ui/modules/editor-images.js');

describe('①-0 스트리밍 청크 안의 상세 HTML 을 읽는다 (0장 문제의 진짜 원인)', () => {
  /**
   * 실측(2026-08-04, https://toss.im/_m/bMxjrwji):
   *   진짜 <img> 태그는 3개뿐(로고·대표사진·리뷰 1장)이고, 판매자 상세컷 14장은
   *   self.__next_f 청크 안에 `\u003cimg src=…` 로 **이스케이프된 채** 들어 있다.
   *   그래서 상세컷을 0장 찾고 엉뚱하게 리뷰 사진으로 보충하고 있었다.
   *   되돌린 뒤 같은 페이지에서 15장을 확보한 것을 확인했다.
   */
  const { unescapeStreamedHtml, extractDetailImageUrls } = require('../src/core/affiliate/crawl');

  it('⭐⭐ 이스케이프된 <img> 를 되돌린다', () => {
    const streamed = 'self.__next_f.push([1,"\\u003cimg src=\\"https://shopping.toss.im/2d4/live/product/1/a.jpg\\" /\\u003e"])';
    expect(unescapeStreamedHtml(streamed)).toContain('<img src="https://shopping.toss.im/2d4/live/product/1/a.jpg"');
  });

  it('⭐⭐ 이스케이프된 상세컷도 실제로 수집된다', () => {
    const streamed = 'self.__next_f.push([1,"\\u003cimg src=\\"https://shopping.toss.im/2d4/live/product/1/a.jpg\\" /\\u003e'
      + '\\u003cimg src=\\"https://shopping.toss.im/179/live/product/1/b.jpg\\" /\\u003e"])';
    const urls = extractDetailImageUrls(streamed, 'https://shopping.toss.im/2ce/live/product/9/thumb.jpg');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe('https://shopping.toss.im/2d4/live/product/1/a.jpg');
  });

  it('⭐ 되돌린 뒤에도 대표사진·리뷰사진·아이콘 필터는 그대로 산다', () => {
    const streamed = 'self.__next_f.push([1,"'
      + '\\u003cimg src=\\"https://shopping.toss.im/2ce/live/product/9/thumb.jpg\\" /\\u003e'      // 대표사진
      + '\\u003cimg src=\\"https://shopping.toss.im/product.review/r1.jpeg\\" /\\u003e'            // 리뷰사진
      + '\\u003cimg src=\\"https://static.toss.im/icon-toss-logo.png\\" /\\u003e'                  // 로고
      + '\\u003cimg src=\\"https://shopping.toss.im/2d4/live/product/1/a.jpg\\" /\\u003e"])';      // 진짜 상세컷
    const urls = extractDetailImageUrls(streamed, 'https://shopping.toss.im/2ce/live/product/9/thumb.jpg');
    expect(urls).toEqual(['https://shopping.toss.im/2d4/live/product/1/a.jpg']);
  });
});

describe('① 토스 이미지 수집 — 판매자 상세컷 우선, 리뷰는 보충', () => {
  it('⭐ 판매자 상세컷을 먼저 모은다', () => {
    expect(crawl).toContain('const sellerImages = extractDetailImageUrls(html, ogImage);');
  });

  it('⭐ 판매자 사진이 모자랄 때만 리뷰 사진으로 보충한다', () => {
    const block = blockBetween(crawl, 'const sellerImages = extractDetailImageUrls(html, ogImage);', '// v3.8.438: 후기도 같은 HTML');
    expect(block).toContain('if (sellerImages.length < MIN_DETAIL_IMAGES)');
    expect(block).toContain('extractReviewImageUrls(html,');
    // 필요한 만큼만 — 저작권 노출을 최소로 유지한다
    expect(block).toContain('reviewPhotos.slice(0, need)');
  });

  it('⭐ 리뷰 사진 추출기는 리뷰 경로만 고른다', () => {
    const fn = blockBetween(vision.length ? crawl : crawl, 'export function extractReviewImageUrls(', '\nexport function extractDetailImageUrls(');
    expect(fn).toContain('REVIEW_IMAGE_PATH.test(key)');
    expect(fn).toContain('NON_PRODUCT_IMAGE.test(key)');
    // 이미 쓴 사진(썸네일·판매자컷)과 겹치면 안 된다
    expect(fn).toContain('canonicalImageKey');
  });

  it('⭐ 한 장도 못 구하면 그렇다고 로그로 알린다 (조용히 넘어가지 않는다)', () => {
    expect(crawl).toContain('쓸 만한 상품 사진을 찾지 못했습니다');
  });
});

describe('② 상품이 안 보이는 사진 제외 — 같은 vision 호출에서 판정', () => {
  it('⭐ 프롬프트가 hasProduct 를 묻는다', () => {
    expect(vision).toContain('"hasProduct"');
    expect(vision).toContain('상품이 안 보이는 사진');
  });

  it('⭐ 호출 횟수는 그대로다 (이미지 1장당 1회)', () => {
    // 판정을 위해 별도 루프/호출을 추가하지 않았는지 본다
    const matches = vision.match(/await askVision\(/g) || [];
    expect(matches.length).toBe(1);
  });

  it('⭐ 판정이 없으면 사용한다 (기본값 true — 멀쩡한 사진을 버리지 않는다)', () => {
    expect(vision).toContain('obj?.hasProduct === false ? false : true');
  });

  it('⭐ 상품이 안 보이는 사진은 소제목 삽화로 배치하지 않는다', () => {
    const block = blockBetween(vision, 'export function buildPlacementMap(', 'export function filterProductPhotos(');
    expect(block).toContain('r.hasProduct === false) continue;');
  });

  it('⭐ 전부 걸러지면 원본을 그대로 쓴다 (오판 하나로 사진이 사라지면 안 된다)', () => {
    const fn = blockBetween(vision, 'export function filterProductPhotos(', '\n/**\n * 뽑아낸 사실을');
    expect(fn).toContain('kept.length > 0 ? kept : urls');
  });

  it('⭐⭐ 필터가 실제로 배선돼 있다 (payload.productImages 를 갱신한다)', () => {
    // "고쳤는데 실행 경로에 없다"를 막는 핵심 가드
    expect(orch).toContain('filterProductPhotos');
    const block = blockBetween(orch, 'const beforeFilter = ((payload.productImages', 'const placements = buildPlacementMap(');
    expect(block).toContain('(payload as any).productImages = kept;');
  });
});

describe('③ 사진이 모자라면 비워 둔다 — 재사용도, 유료 생성도 안 한다', () => {
  it('⭐ product-all 에서 소진되면 leaveBlank 를 세운다', () => {
    const block = blockBetween(orch, "if (shoppingStrategy === 'product-all') {", "} else if (shoppingStrategy === 'product-i2i')");
    expect(block).toContain('leaveBlank = true;');
  });

  it('⭐⭐ leaveBlank 면 이후 유료 생성 경로를 전부 건너뛴다', () => {
    // 이게 빠지면 "비워 둔다"고 해놓고 유료 이미지가 생성돼 비용이 청구된다
    expect(orch).toContain("if (!imageResult.ok && !leaveBlank && imageSource === 'crawled'");
    expect(orch).toContain("if (!imageResult.ok && !leaveBlank && (imageSource === 'crawled-ai-nanobananapro'");
    expect(orch).toContain('if (!imageResult.ok && !leaveBlank) {');
  });

  it('⭐ 빈 자리로 두더라도 진행률 집계는 건너뛰지 않는다', () => {
    // early return 이면 completedCount 가 안 올라 진행바가 멈춘 것처럼 보인다
    const block = blockBetween(orch, "if (shoppingStrategy === 'product-all') {", "} else if (shoppingStrategy === 'product-i2i')");
    expect(block).not.toContain("return { dataUrl: '', source: '' };");
  });

  it('⭐ 렌더 단계는 빈 이미지를 그냥 건너뛴다', () => {
    expect(orch).toContain('const finalImageUrl = processedImageUrls[idx];');
    expect(orch).toContain('if (finalImageUrl) {');
  });
});

describe('④ 플랫폼 전환이 즉시 반영된다', () => {
  it('⭐⭐ 3개 플랫폼을 전부 다룬다 (2개 가정이 티스토리를 워드프레스로 만들었다)', () => {
    expect(indexHtml).toContain("const ALL_PLATFORMS = ['blogger', 'wordpress', 'tistory'];");
    // 예전의 2개 가정 — 되살아나면 같은 사고가 난다
    expect(indexHtml).not.toContain("const otherPlatform = platform === 'blogger' ? 'wordpress' : 'blogger';");
  });

  it('⭐ 티스토리를 고르면 티스토리 박스가 켜진다', () => {
    const fn = blockBetween(indexHtml, 'function selectPlatform(', '\n    function ');
    expect(fn).toContain("platform === 'tistory' ? 'tistory-on' : 'off'");
  });

  it('⭐ 라디오 상태를 3개 모두 실제로 맞춘다', () => {
    const fn = blockBetween(indexHtml, 'function selectPlatform(', '\n    function ');
    expect(fn).toContain("r.checked = (p === platform)");
  });

  it('⭐ change 이벤트를 쏴서 구독자들이 즉시 따라오게 한다', () => {
    const fn = blockBetween(indexHtml, 'function selectPlatform(', '\n    function ');
    expect(fn).toContain("dispatchEvent(new Event('change'");
  });

  it('⭐ 헤더 배지에 티스토리 분기가 있다 (없으면 워드프레스라고 거짓 표시)', () => {
    expect(indexHtml).toContain("platform === 'tistory'");
    expect(indexHtml).toContain('tistory-on');
  });
});

describe('⑤ 편집기 — 커서 위치에 이미지 삽입', () => {
  it('⭐ 마지막 커서 위치를 기억한다', () => {
    expect(editorImages).toContain('lastCaretBlock');
    expect(editorImages).toContain('rememberCaret');
  });

  it('⭐⭐ 툴바 클릭으로 선택이 사라져도 기억해 둔 위치를 쓴다', () => {
    // 버튼이 iframe 밖에 있어 클릭하는 순간 선택이 풀린다 — 이게 하단 삽입의 원인이었다
    expect(editorImages).toContain('isConnected');
  });

  it('⭐ 커서 추적을 실제 이벤트에 걸어 둔다', () => {
    for (const ev of ['keyup', 'mouseup', 'selectionchange', 'click']) {
      expect(editorImages).toContain(ev);
    }
  });
});

describe('⑥ 편집기 서식 도구 — 링크·글자크기·하이라이트·박스', () => {
  it('⭐ 서식 바가 존재한다', () => {
    expect(editor).toContain('veFormatBar');
    expect(editor).toContain('data-vefmt');
  });

  it('⭐ 요청한 기능이 모두 있다', () => {
    for (const kind of ['link', 'unlink', 'size-up', 'size-down', 'hl-yellow', 'box-gray', 'box-tip', 'box-warn', 'quote']) {
      expect(editor).toContain(`data-vefmt="${kind}"`);
    }
  });

  it('⭐⭐ 버튼이 applyFormat 에 실제로 연결돼 있다', () => {
    // id 만 만들어 두고 배선을 빠뜨리는 실수가 이 저장소에서 반복됐다
    expect(editor).toContain('function applyFormat(');
    expect(editor).toContain('applyFormat(doc,');
  });

  it('⭐⭐ mousedown 에서 기본동작을 막는다 (안 막으면 선택이 풀려 서식이 안 먹는다)', () => {
    const bar = blockBetween(editor, "data-vefmt", 'function applyFormat(');
    expect(bar).toContain('mousedown');
    expect(bar).toContain('preventDefault()');
  });

  it('⭐ 목록 변환은 줄 단위로 li 를 만든다', () => {
    const block = blockBetween(editor, "case 'ul':", "default:");
    expect(block).toContain('<li style=');
    expect(block).toContain('split(/\\r?\\n/)');
  });
});

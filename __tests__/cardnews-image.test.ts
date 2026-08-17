/**
 * 카드뉴스 이미지 모드 — v3.8.498
 *
 * 이미지 호출 자체는 돈이 드니 테스트하지 않는다.
 * 여기서 지키는 것은 "조용히 다르게 동작하지 않는가" 세 가지다.
 *   ① 글자를 못 그리는 엔진에 full 을 주면 backdrop 으로 내려가는가
 *   ② 배경 프롬프트가 글자 자리를 비우라고 지시하는가
 *   ③ full 프롬프트에 넣어야 할 글자가 원문 그대로 들어가는가
 */
import {
  normalizeCardImageMode,
  resolveCardImageMode,
  buildBackdropPrompt,
  buildFullCardPrompt,
  buildVisualTheme,
  CARD_IMAGE_ENGINES,
  DEFAULT_CARD_ENGINE,
} from '../src/core/cardnews/card-image';
import { renderCardHtml } from '../src/core/cardnews/card-template';
import type { CardItem } from '../src/core/cardnews/card-plan';

const card: CardItem = {
  kind: 'hook',
  title: '문자 안 왔어도 세금 냅니다',
  body: '국세청 안내문 못 받았어도 대상이면 8월 31일 넘길 때 가산세 뭅니다.',
  alt: '세금 안내문',
};

describe('모드 정규화', () => {
  it('빈 값·이상한 값은 backdrop 으로', () => {
    expect(normalizeCardImageMode(undefined)).toBe('backdrop');
    expect(normalizeCardImageMode('')).toBe('backdrop');
    expect(normalizeCardImageMode('아무말')).toBe('backdrop');
  });

  it('full·none 은 그대로 읽는다', () => {
    expect(normalizeCardImageMode('full')).toBe('full');
    expect(normalizeCardImageMode('FULL')).toBe('full');
    expect(normalizeCardImageMode('none')).toBe('none');
  });
});

describe('엔진과 모드의 조합', () => {
  it('글자를 못 그리는 엔진에 full 을 주면 backdrop 으로 내린다', () => {
    expect(resolveCardImageMode('full', 'nanobanana2')).toBe('backdrop');
    expect(resolveCardImageMode('full', 'gptimage1')).toBe('backdrop');
  });

  it('글자를 그리는 엔진에서는 full 이 유지된다', () => {
    expect(resolveCardImageMode('full', 'gptimage2')).toBe('full');
    expect(resolveCardImageMode('full', 'dropshot-nanobanana-pro')).toBe('full');
  });

  it("엔진이 'none' 이면 모드와 무관하게 이미지를 안 만든다", () => {
    expect(resolveCardImageMode('full', 'none')).toBe('none');
    expect(resolveCardImageMode('backdrop', 'none')).toBe('none');
  });

  it('기본 엔진은 목록 안에 실제로 있어야 한다', () => {
    expect(CARD_IMAGE_ENGINES.some((e) => e.value === DEFAULT_CARD_ENGINE)).toBe(true);
  });
});

describe('배경 프롬프트', () => {
  it('글자 자리를 비우라고 지시한다 — 안 그러면 얼굴 위에 글자가 얹힌다', () => {
    const p = buildBackdropPrompt(card, '양도소득세');
    expect(p.toLowerCase()).toContain('text overlay');
    expect(p.toLowerCase()).toMatch(/uncluttered|calm/);
  });

  it('카드 종류마다 다른 장면을 지시한다', () => {
    const hook = buildBackdropPrompt({ ...card, kind: 'hook' }, 'k');
    const save = buildBackdropPrompt({ ...card, kind: 'save' }, 'k');
    expect(hook).not.toBe(save);
  });

  it('같은 키워드면 톤이 같아야 7장이 한 벌로 보인다', () => {
    expect(buildVisualTheme('양도소득세')).toBe(buildVisualTheme('양도소득세'));
  });
});

describe('카드 전체 AI 프롬프트', () => {
  it('넣어야 할 글자를 원문 그대로 박는다', () => {
    const p = buildFullCardPrompt(card, '양도소득세', { index: 0, total: 7, ratio: '4:5' });
    expect(p).toContain(card.title);
    expect(p).toContain(card.body);
  });

  it('숫자를 바꾸지 말라고 못 박는다 — 날짜가 틀리면 사실 오류다', () => {
    const p = buildFullCardPrompt(card, 'k', { index: 0, total: 7, ratio: '4:5' });
    expect(p.toLowerCase()).toContain('every digit');
  });
});

describe('템플릿 — 배경 유무', () => {
  const opts = { format: 'insta45' as const, index: 0, total: 7, keyword: '양도소득세' };

  it('배경이 없으면 지금까지 쓰던 그라데이션으로 그린다', () => {
    const html = renderCardHtml(card, opts);
    expect(html).toContain('linear-gradient');
    expect(html).not.toContain('url("data:');
  });

  it('배경이 있으면 이미지 위에 어둠 막을 깐다 — 흰 글씨가 사라지면 안 된다', () => {
    const html = renderCardHtml(card, { ...opts, backdrop: 'data:image/png;base64,AAAA' });
    expect(html).toContain('url("data:image/png;base64,AAAA")');
    expect(html).toContain('rgba(8,12,20,0.90)');
    expect(html).toContain('text-shadow');
  });

  it('쪽번호와 안내가 붙어 보이지 않게 사이가 벌어져 있다', () => {
    const html = renderCardHtml(card, opts);
    const footer = html.slice(html.indexOf('.footer {'), html.indexOf('.pager'));
    expect(footer).toMatch(/gap:\s*\d+px/);
  });

  it('마지막 장에는 "밀어서 계속"이 없다', () => {
    const last = renderCardHtml(card, { ...opts, index: 6, total: 7 });
    expect(last).not.toContain('밀어서 계속');
  });

  it('저장 카드는 눈에 띄게 강조한다 — 저장수가 배포를 결정한다', () => {
    const html = renderCardHtml({ ...card, kind: 'save' }, opts);
    expect(html).toContain('class="body keep"');
  });

  it('글자는 이스케이프해서 넣는다', () => {
    const html = renderCardHtml({ ...card, title: '<script>x</script>' }, opts);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('카드 전체 AI 모드 — 글자를 두 번 그리면 안 된다', () => {
  const { renderImageOnlyHtml, CARD_FORMATS } = require('../src/core/cardnews/card-template');

  it('그림만 놓고 글자도 어둠 막도 얹지 않는다', () => {
    const html = renderImageOnlyHtml('data:image/png;base64,ZZZ', CARD_FORMATS.insta45);
    expect(html).toContain('data:image/png;base64,ZZZ');
    expect(html).not.toContain(card.title);   // AI 가 그린 글자 위에 또 얹으면 겹친다
    expect(html).not.toContain('rgba(8,12,20');
    expect(html).not.toContain('밀어서 계속');
  });

  it('규격 크기를 그대로 지킨다 — 안 맞으면 업로드에서 또 잘린다', () => {
    const insta = renderImageOnlyHtml('data:x', CARD_FORMATS.insta45);
    const kakao = renderImageOnlyHtml('data:x', CARD_FORMATS.kakao11);
    expect(insta).toContain('width:1080px; height:1350px');
    expect(kakao).toContain('width:1080px; height:1080px');
  });

  it('글자 카드를 cover 로 자르지 않는다 — 좌우 3분의 2가 잘려나간 실사고', () => {
    const html = renderImageOnlyHtml('data:x', CARD_FORMATS.insta45);
    expect(html).toContain('object-fit:contain');
    expect(html).not.toContain('object-fit:cover');
    // 남는 자리는 카드와 같은 어두운 바탕으로 (흰 띠가 생기면 더 흉하다)
    expect(html).toContain('background:#0b1220');
  });
});

describe('v3.8.503 — 카드 이미지는 세로로 뽑는다', () => {
  const fs = require('fs');
  const path = require('path');
  const dispatcher = fs.readFileSync(path.join(__dirname, '..', 'src/core/imageDispatcher.ts'), 'utf-8');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');

  it('디스패처가 방향 힌트를 받는다 — 예전엔 1536x1024(가로) 고정이었다', () => {
    expect(dispatcher).toContain("imageAspect?: 'portrait' | 'square' | 'landscape'");
    expect(dispatcher).toContain("aspect === 'portrait' ? '1024x1536'");
    expect(dispatcher).toContain("aspect === 'square' ? '1024x1024'");
  });

  it('세로·정사각 요청엔 16:9 정규화를 건너뛴다 — 하면 도로 가로가 된다', () => {
    expect(dispatcher).toMatch(/if \(aspect !== 'landscape'\) \{/);
  });

  it('카드뉴스가 방향을 실제로 넘긴다 — 안 넘기면 기본값(가로)으로 되돌아간다', () => {
    expect(mainTs).toContain("imageAspect: opts.ratio === '1:1' ? 'square' : 'portrait'");
  });

  it('미리보기를 누르면 크게 본다 — 132px 로는 글자 검수가 안 된다', () => {
    const ui = fs.readFileSync(path.join(__dirname, '..', 'electron/ui/modules/cardnews.js'), 'utf-8');
    expect(ui).toContain('function openLightbox');
    expect(ui).toContain("addEventListener('click', () => openLightbox(img.src))");
    expect(ui).toContain('zoom-in');
  });
});

describe('v3.8.517 — 렌더 크래시 수정 + 순차 미리보기', () => {
  const fs = require('fs');
  const path = require('path');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'electron/ui/modules/cardnews.js'), 'utf-8');

  it('카드 렌더는 data: URL 이 아니라 임시 파일 로드 — ERR_INVALID_URL(-300) 재발 방지', () => {
    // 배경 이미지가 크면 data: URL 이 크로미움 길이 한도를 넘어 조용히 죽는다 (실사고)
    expect(mainTs).not.toContain("loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(cardHtml)");
    expect(mainTs).toContain('.render.html');
    expect(mainTs).toContain('hiddenWin.loadFile(renderHtmlFile)');
  });

  it('카드가 완성될 때마다 card-done 이벤트로 파일 경로를 흘려보낸다', () => {
    expect(mainTs).toContain("phase: 'card-done'");
    expect(mainTs).toMatch(/card-done'[^}]*file/);
  });

  it('UI 는 card-done 을 받아 순차 미리보기를 붙이고, 새 실행 시 비운다', () => {
    expect(ui).toContain("p?.phase === 'card-done'");
    expect(ui).toContain('function _appendLivePreview');
    expect(ui).toContain('function _clearLivePreview');
    expect(ui).toContain("p.format === 'instagram'");   // 규격당 1장만 (중복 방지)
    expect(ui).toContain('data-card');                   // 같은 카드 중복 방지
    expect(ui).toContain('window.cnOpenLightbox = openLightbox');
  });
});

describe('v3.8.518 — 상품 카드뉴스 (구매 유도)', () => {
  const fs = require('fs');
  const path = require('path');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'electron/ui/modules/cardnews.js'), 'utf-8');
  const { buildCardPlanPrompt } = require('../src/core/cardnews/card-plan');

  it("모드 'product' 가 정규화되고, 엔진 설정과 무관하게 유지된다 (AI 미사용)", () => {
    expect(normalizeCardImageMode('product')).toBe('product');
    // 엔진이 뭐든 product 는 product — backdrop/none 으로 새면 AI 를 부르거나 사진을 잃는다
    expect(resolveCardImageMode('product' as any, 'gptimage2')).toBe('product');
    expect(resolveCardImageMode('product' as any, 'none')).toBe('product');
    expect(resolveCardImageMode('product' as any, 'nanobanana2')).toBe('product');
  });

  it('상품 프롬프트는 구매 심리 순서를 강제하고 정보글 프롬프트와 다르다', () => {
    const product = buildCardPlanPrompt('식기세척기', '제목', '본문', { productMode: true });
    const article = buildCardPlanPrompt('식기세척기', '제목', '본문');
    expect(product).not.toBe(article);
    expect(product).toContain('구매 심리 순서');
    expect(product).toContain('상품명 금지');     // 1장은 문제 제기부터
    expect(product).toContain('체크리스트');       // save 카드 = 구매 전 체크
    expect(product).toContain('과장·최상급');      // 허위·과장 금지
    expect(product).toContain('12자 이내');        // 사진 위 글자라 더 짧게
  });

  it('상품 모드는 makeCardImage 를 부르지 않고 본문 사진을 배경으로 쓴다', () => {
    const handler = mainTs.slice(mainTs.indexOf("ipcMain.handle('cardnews:create'"));
    const productBlock = handler.slice(handler.indexOf('if (isProduct)'), handler.indexOf('} else if (!isFull'));
    expect(productBlock).toContain('collectProductPhotos');
    expect(productBlock).not.toContain('makeCardImage'); // AI 호출 0 = 비용 0
    expect(productBlock).toContain('photos[i % photos.length]'); // 사진이 모자라면 순환
  });

  it('사진 수집기는 아이콘·로고·트래킹 픽셀을 거르고 이미지 타입만 받는다', () => {
    const fn = mainTs.slice(mainTs.indexOf('async function collectProductPhotos'), mainTs.indexOf("ipcMain.handle('cardnews:create'"));
    expect(fn).toMatch(/icon\|logo\|badge/);
    expect(fn).toMatch(/\^image\\\/\/i\.test\(type\)/);  // content-type 이 이미지인지 검사
    expect(fn).toContain('12000');          // 12KB 미만은 아이콘으로 간주
  });

  it('UI 에 상품 모드가 있고, 선택 시 엔진 설명 대신 미사용 안내가 뜬다', () => {
    expect(ui).toContain("value: 'product'");
    expect(ui).toContain('상품 카드');
    expect(ui).toContain("state.mode === 'product'");
    expect(ui).toContain('이미지 엔진 설정은 사용하지 않습니다');
  });
});

describe('v3.8.520 — 상품 i2i (실물 기반 배경 다듬기)', () => {
  const fs = require('fs');
  const path = require('path');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'electron/ui/modules/cardnews.js'), 'utf-8');
  const { buildProductI2iPrompt } = require('../src/core/cardnews/card-image');

  const card = { kind: 'hook', title: '제목', body: '본문', alt: 'alt' } as any;

  it("모드 'product-i2i' 가 정규화되고 유지된다", () => {
    expect(normalizeCardImageMode('product-i2i')).toBe('product-i2i');
    expect(resolveCardImageMode('product-i2i' as any, 'gptimage2')).toBe('product-i2i');
    expect(resolveCardImageMode('product-i2i' as any, 'nanobanana2')).toBe('product-i2i');
  });

  it("엔진이 'none' 이면 실물 사진 모드로 내린다 — 상품 글에서 사진까지 잃으면 안 된다", () => {
    expect(resolveCardImageMode('product-i2i' as any, 'none')).toBe('product');
    expect(resolveCardImageMode('product-i2i' as any, 'skip')).toBe('product');
  });

  it('프롬프트가 상품 실물 보존을 못박는다 — 형태·라벨이 바뀌면 실사용컷의 이점이 사라진다', () => {
    const p = buildProductI2iPrompt(card, '식기세척기');
    expect(p).toContain('provided product photo as the base image');
    expect(p).toMatch(/MUST KEEP EXACTLY/);
    expect(p).toMatch(/label, logo/);
    expect(p).toMatch(/ONLY CHANGE the surroundings/);
    expect(p).toContain('No added text');            // 글자는 앱이 얹는다
    expect(p).toContain('upper-left third');          // 글자 자리 비우기
  });

  it('참고 이미지가 실제로 실린다 — 이게 빠지면 그냥 AI 생성컷이라 역신호가 된다', () => {
    const fn = mainTs.slice(mainTs.indexOf('async function makeCardImage'), mainTs.indexOf("ipcMain.handle('cardnews:create'"));
    expect(fn).toContain('buildProductI2iPrompt');
    expect(fn).toContain('referenceImageList: [opts.referenceImage]');
    expect(fn).toContain('isProductI2i && opts.referenceImage'); // 사진 없으면 i2i 로 안 보낸다
  });

  it('사진을 못 찾으면 i2i 를 건너뛴다 (AI 생성컷 방지) + 실패 시 실물 사진 폴백', () => {
    const handler = mainTs.slice(mainTs.indexOf("ipcMain.handle('cardnews:create'"));
    const block = handler.slice(handler.indexOf('if (isProductI2i)'), handler.indexOf('} else if (isProduct)'));
    expect(block).toContain('collectProductPhotos');
    expect(block).toContain('i2i 를 건너뜁니다');
    expect(block).toContain('made || reference');   // 생성 실패 → 실물 사진
    expect(block).toContain('pickI2iEngine');        // i2i 가능한 엔진으로 자동 전환
  });

  it('i2i 실패가 성공으로 둔갑하지 않는다 — 폴백 사진을 생성 성공으로 세면 실패가 숨는다', () => {
    expect(mainTs).toContain('let i2iMadeCount = 0');
    expect(mainTs).toContain('if (made) i2iMadeCount++');
    expect(mainTs).toContain('isProductI2i ? i2iMadeCount : shared.filter(Boolean).length');
  });

  it('UI 에 i2i 모드가 있고 과금·엔진 전환을 미리 알려준다', () => {
    expect(ui).toContain("value: 'product-i2i'");
    expect(ui).toContain('장당 과금');
    expect(ui).toContain("state.mode === 'product-i2i'");
    expect(ui).toContain('참고 이미지를 못 넣습니다');
  });
});

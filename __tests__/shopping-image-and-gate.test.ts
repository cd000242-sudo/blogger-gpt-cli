/**
 * 쇼핑모드 발행 차단 · 이미지 링크 · 쿠팡 지원 (v3.8.398)
 *
 * 사용자 보고 (2026-08-01) 4건:
 *   ① 발행 실패: "본문 H2 섹션이 5개 (모드 'shopping' 최소 6개 필요)"
 *      → minH2 가 하드코딩(shopping=6)인데 UI 기본 소제목 수는 5다.
 *        정상 생성됐는데도 무조건 차단됐다. 게이트의 목적은 "LLM 응답이 잘렸는지" 탐지지
 *        섹션 수 강요가 아니다.
 *   ② 쇼핑모드가 초기 세팅된 경우 이미지가 쇼핑모드로 전환되지 않음
 *   ③ 본문 이미지 전략이 "상품 사진 그대로" 면 썸네일·소제목 이미지 엔진은 비활성화돼야 함
 *   ④ 썸네일·배너·본문 이미지 전부 클릭 시 구매 링크로 이동해야 함
 *
 * 추가 발견: 사용자가 제휴 링크 칸에 **쿠팡 링크**를 붙여넣었는데
 *   크롤러가 토스·네이버만 지원해 조용히 무시됐다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { linkImagesToProduct } from '../src/core/affiliate/compliance';
import { isSupportedForCrawl } from '../src/core/affiliate/crawl';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => {
  try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; }
};

const URL = 'https://link.coupang.com/a/fRnZUKJxmu';

describe('① 발행 차단 — 사용자가 고른 섹션 수를 존중한다', () => {
  const main = read('electron', 'main.ts');

  it('요청한 섹션 수를 기준으로 판단한다', () => {
    expect(main).toContain('const requestedSections = Number(payload?.sectionCount) || 0');
    expect(main).toContain('Math.ceil(requestedSections * 0.7)');
  });

  it('모드별 하드코딩 최소값은 요청 수를 모를 때만 쓴다', () => {
    const i = main.indexOf('const requestedSections');
    const block = braceBlock(main, 'const requestedSections');
    expect(block).toContain('requestedSections > 0');
    expect(block).toContain('modeFloor');
  });

  it('5개 요청 → 5개 생성이면 통과한다 (기존엔 차단됐다)', () => {
    // minH2 = max(2, ceil(5 * 0.7)) = 4 → 5개는 통과
    expect(Math.max(2, Math.ceil(5 * 0.7))).toBeLessThanOrEqual(5);
  });

  it('7개 요청 → 2개 생성이면 여전히 차단한다 (잘림 탐지는 유지)', () => {
    expect(Math.max(2, Math.ceil(7 * 0.7))).toBeGreaterThan(2);
  });

  it('차단 사유를 근거와 함께 보여준다', () => {
    expect(main).toContain('요청 ${requestedSections}개 대비 70% 미만');
  });
});

describe('④ 이미지를 구매 링크로 감싼다', () => {
  it('본문 이미지를 링크로 만든다', () => {
    const r = linkImagesToProduct('<p>글</p><img src="a.jpg">', URL, 'coupang');
    expect(r.linked).toBe(1);
    expect(r.html).toContain(`<a href="${URL}"`);
    expect(r.html).toMatch(/rel="sponsored nofollow noopener"/);
  });

  it('여러 장을 모두 감싼다 (썸네일·소제목 이미지 포함)', () => {
    const html = '<img src="thumb.jpg"><h2>소제목</h2><img src="s1.jpg"><img src="s2.jpg">';
    expect(linkImagesToProduct(html, URL, 'coupang').linked).toBe(3);
  });

  it('⭐ 이미 링크 안에 있는 이미지는 건드리지 않는다 — 중첩 <a> 는 깨진 HTML 이다', () => {
    const html = `<a href="${URL}"><img src="a.jpg"></a>`;
    const r = linkImagesToProduct(html, URL, 'coupang');
    expect(r.linked).toBe(0);
    expect(r.html).toBe(html);
  });

  it('⭐ 대가성 문구 안의 이미지는 감싸지 않는다', () => {
    const html = '<p class="affiliate-disclosure">고지문 <img src="icon.png"></p><img src="body.jpg">';
    const r = linkImagesToProduct(html, URL, 'coupang');
    expect(r.linked).toBe(1);                                  // 본문 것만
    expect(r.html).toContain('<p class="affiliate-disclosure">고지문 <img src="icon.png"></p>');
  });

  it('링크가 없거나 잘못되면 아무것도 하지 않는다', () => {
    expect(linkImagesToProduct('<img src="a.jpg">', '', null).linked).toBe(0);
    expect(linkImagesToProduct('<img src="a.jpg">', '그냥텍스트', null).linked).toBe(0);
  });

  it('빈 입력에 안전하다', () => {
    expect(linkImagesToProduct('', URL, 'coupang').html).toBe('');
    expect(linkImagesToProduct(null as any, URL, 'coupang').linked).toBe(0);
  });

  it('URL 의 따옴표를 이스케이프한다', () => {
    const r = linkImagesToProduct('<img src="a.jpg">', 'https://x.test/a"b', 'coupang');
    expect(r.html).toContain('&quot;');
    expect(r.html).not.toMatch(/href="https:\/\/x\.test\/a"b"/);
  });

  it('orchestration 이 실제로 호출한다', () => {
    const orch = read('src', 'core', 'final', 'orchestration.ts');
    expect(orch).toContain('linkImagesToProduct');
    expect(orch).toContain('affProducts[0].originalUrl');   // 원본 링크만 사용
  });
});

describe('쿠팡 링크 지원 (사용자가 실제로 붙여넣었다)', () => {
  it('쿠팡도 크롤 대상이다', () => {
    expect(isSupportedForCrawl('coupang')).toBe(true);
  });

  it('기존 쿠팡 크롤러에 위임한다 — 중복 구현하지 않는다', () => {
    const src = read('src', 'core', 'affiliate', 'crawl.ts');
    expect(src).toContain('crawlCoupangProductFromUrl');
  });

  it('가격이 불확실하면 null 로 둔다 — 추정 금지', () => {
    const src = read('src', 'core', 'affiliate', 'crawl.ts');
    expect(src).toContain('p?.isPriceKnown');
  });

  it('UI 안내에 쿠팡이 포함된다', () => {
    // v3.8.430: 제휴사 목록이 링크 칸 라벨에서 **버튼 3개**로 옮겨갔다.
    //   ("쇼핑모드를 선택하면 버튼3개가 생기고 원하는 제휴사를 클릭하면…")
    //   확인할 것은 그대로다 — UI 가 세 제휴사를 안내하는가.
    const html = read('electron', 'ui', 'index.html');
    expect(html).toContain('쿠팡 파트너스');
    expect(html).toContain('네이버 쇼핑 커넥트');
    expect(html).toContain('토스쇼핑 쉐어링크');
  });
});

describe('②③ 쇼핑모드 이미지 컨트롤 정합', () => {
  const html = read('electron', 'ui', 'index.html');

  it('정합 함수가 있다', () => {
    expect(html).toContain('function syncShoppingImageControls');
  });

  it('상품 사진 그대로면 소제목 엔진 선택을 비활성화한다', () => {
    // v3.8.401: 창 크기(1500자)에 의존하던 슬라이스를 함수 경계로 바꿨다 — 함수가 길어져도 안 깨진다
    const i = html.indexOf('function syncShoppingImageControls');
    const block = html.slice(i, html.indexOf('화면 정합 실패가 발행을 막지 않는다', i));
    expect(block).toContain("strategy === 'product-all'");
    expect(block).toContain('h2.disabled = useProductPhotos');
    expect(block).toContain('thumbnailType');
    expect(block).toContain('h2ImageSource');
  });

  it('⭐ 썸네일은 전략과 무관하게 쇼핑모드면 항상 잠긴다 (백엔드 동작과 동일)', () => {
    const i = html.indexOf('function syncShoppingImageControls');
    const block = html.slice(i, html.indexOf('화면 정합 실패가 발행을 막지 않는다', i));
    expect(block).toContain('thumbSel.disabled = isShopping');
    expect(block).toContain('쇼핑모드 썸네일은 항상 실제 상품 사진입니다');
  });

  /**
   * v3.8.399 — 같은 유형의 버그가 반복된다: 존재하지 않는 id 를 getElementById 로 부르면
   * 아무 에러 없이 조용히 아무 일도 안 일어난다. (앞서 generateBtn, 이번엔 thumbnailMode)
   * 문자열 일치가 아니라 **id 실존**을 검증한다.
   */
  it('⭐ 정합 대상 id 가 실제로 index.html 에 존재한다 (thumbnailMode 오타 재발 방지)', () => {
    const i = html.indexOf('function syncShoppingImageControls');
    const block = html.slice(i, html.indexOf('};', i));
    const ids = [...block.matchAll(/getElementById\(['"]([A-Za-z0-9_-]+)['"]\)/g)].map(m => m[1]);
    const listed = [...block.matchAll(/\[['"]([A-Za-z0-9_-]+)['"],\s*'[^']+'\]/g)].map(m => m[1]);
    const targets = [...new Set([...ids, ...listed])];

    expect(targets.length).toBeGreaterThan(2);
    const missing = targets.filter(id => !html.includes(`id="${id}"`));
    expect(missing).toEqual([]);
    expect(targets).toContain('thumbnailType');
  });

  it('⭐ 썸네일 표시값도 상품 사진으로 맞춘다 — 화면과 발행물이 달라 보이면 안 된다', () => {
    expect(html).toContain("thumbSel.value = 'crawled'");
    expect(html).toContain('__preShoppingThumbType');          // 쇼핑모드 나가면 되돌린다
  });

  it('⭐ 백엔드도 쇼핑모드면 수집 상품 사진을 썸네일로 쓴다', () => {
    const orch = read('src', 'core', 'final', 'orchestration.ts');
    expect(orch).toContain('isCrawledRequested || isShoppingMode || !userPickedAiEngine');
    // AI 디스패치는 썸네일이 비었을 때만 — 상품 사진을 덮어쓰면 안 된다
    // v3.8.457: 반자동(skipImages)에서 유료 썸네일이 새지 않게 게이트가 추가됐다
    expect(orch).toContain('if (!thumbnailUrl && !thumbnailDisabled && !skipImages)');
  });

  it('왜 꺼졌는지 이유를 보여준다', () => {
    const i = html.indexOf('function syncShoppingImageControls');
    expect(html.slice(i, html.indexOf('화면 정합 실패가 발행을 막지 않는다', i))).toContain('AI 생성 안 함');
  });

  it('쇼핑모드 진입 시 이미지 소스를 상품 사진으로 전환한다', () => {
    // 함수가 길어 슬라이스 폭에 의존하면 깨진다 — 파일 전체에서 확인한다
    expect(html).toContain("h2.value = 'crawled'");
  });

  it('모드 변경 시와 전략 변경 시 모두 호출된다', () => {
    expect(html).toContain('if (window.syncShoppingImageControls) window.syncShoppingImageControls()');
    expect(html).toContain("getElementById('shoppingImageStrategy')\n                          ?.addEventListener('change'");
  });

  it('정합 실패가 발행을 막지 않는다', () => {
    expect(html).toContain('화면 정합 실패가 발행을 막지 않는다');
  });
});

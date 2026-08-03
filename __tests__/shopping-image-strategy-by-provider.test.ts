/**
 * 이미지 전략을 **제휴사 기준**으로 연다 (v3.8.435)
 *
 * 사용자 지적(2026-08-03):
 *   "토스 쉐어링크랑 네이버 쇼핑 커넥트를 선택하면 수집한 이미지 사용가능하게
 *    활성화시켜져야되는거아닌가요? 그리고 쿠팡은 AI 생성이미지만 가능하니까
 *    그렇게 하네스를 맞추고 토스쇼핑이랑 네이버쇼핑은 라디오로 선택가능하게 해줘"
 *
 * 예전 기준은 "수집 이미지 2장 이상"이었는데, 그 값은 **발행을 한 번 돌려야**
 * 정해진다. 설정 화면에서는 늘 1로 잡혀 옵션이 영원히 잠겨 있었다.
 * 제휴사를 고르는 순간 답은 이미 나와 있다 —
 *   쿠팡: 상품 페이지 수집 차단 → 대표 1장뿐 → AI 생성만
 *   토스/네이버: 상세 사진 다수 수집(v3.8.431) → 그대로 사용 가능
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('① 활성/비활성 기준이 제휴사다', () => {
  it('⭐ 토스·네이버면 수집 사진 사용이 열린다', () => {
    const fn = braceBlock(html, 'window.syncShoppingImageControls = function syncShoppingImageControls()');
    expect(fn).toContain("const canUseCollected = provider === 'toss-sharelink' || provider === 'naver-shopping-connect';");
  });

  it('⭐ 쿠팡이면 잠기고 AI 생성으로 되돌린다', () => {
    const fn = braceBlock(html, 'window.syncShoppingImageControls = function syncShoppingImageControls()');
    expect(fn).toContain('const allDisabled = isShopping && !canUseCollected;');
    expect(fn).toContain("strategySel.value = 'product-i2i';");
  });

  it('⭐ 발행 전에는 알 수 없는 "수집 장수" 기준을 더 이상 쓰지 않는다', () => {
    const fn = braceBlock(html, 'window.syncShoppingImageControls = function syncShoppingImageControls()');
    expect(fn).not.toContain('__shoppingCollectedImageCount ?? 1');
    expect(fn).not.toContain('collected < 2');
  });

  it('⭐ 제휴사를 바꾸면 전략 가부가 즉시 다시 계산된다', () => {
    const fn = braceBlock(html, 'function selectAffiliateProvider(provider) {');
    expect(fn).toContain('window.syncShoppingImageControls');
  });
});

describe('② 라디오 UI — 제휴사 색을 따르는 미니멀 스타일', () => {
  it('⭐ 라디오 두 개가 실존한다', () => {
    expect(html).toContain('id="shoppingStrategyRadios"');
    expect(html).toContain('data-strategy="product-all"');
    expect(html).toContain('data-strategy="product-i2i"');
    expect((html.match(/name="shoppingImageStrategy"/g) || []).length).toBe(2);
  });

  it('⭐ 강조색이 제휴사 색과 같은 출처를 쓴다 (버튼과 시각적으로 이어진다)', () => {
    const fn = braceBlock(html, 'window.__syncStrategyRadios = function __syncStrategyRadios(provider, allDisabled)');
    expect(fn).toContain('AFFILIATE_PROVIDER_ACCENT[provider]');
  });

  it('⭐ 잠긴 옵션은 이유를 보여준다 (그냥 회색이면 왜 안 되는지 모른다)', () => {
    const fn = braceBlock(html, 'window.__syncStrategyRadios = function __syncStrategyRadios(provider, allDisabled)');
    expect(fn).toContain('쿠팡은 상품 페이지 수집이 막혀 있어 사용할 수 없습니다');
  });

  it('⭐ 값의 출처는 기존 select 그대로다 — payload·대기열 배선을 안 건드린다', () => {
    // 라디오는 화면일 뿐이고, 실제 값은 hidden select 가 들고 있어야
    // posting.js / publish-queue.js 가 예전처럼 읽는다.
    expect(html).toContain('<select id="shoppingImageStrategy" style="display:none;">');
    const clickHandler = blockBetween(html, "const box = e.target?.closest?.('#shoppingStrategyRadios", '});');
    expect(clickHandler).toContain("getElementById('shoppingImageStrategy')");
    expect(clickHandler).toContain('sel.value = value;');
  });

  it('잠긴 항목은 클릭해도 값이 바뀌지 않는다', () => {
    const clickHandler = blockBetween(html, "const box = e.target?.closest?.('#shoppingStrategyRadios", '});');
    expect(clickHandler).toContain("box.style.cursor === 'not-allowed'");
  });
});

describe('③ 백엔드 — 열어준 옵션이 실제로 성립한다', () => {
  /**
   * 화면에서 '수집 사진 그대로'를 열어줘도, 백엔드가 대표 이미지 1장만 담으면
   * 소제목마다 같은 사진이 반복된다. 옵션을 여는 것과 재료를 채우는 것은 별개다.
   */
  it('⭐ 사전 크롤 경로가 대표 + 상세 사진을 함께 담는다', () => {
    expect(orch).toContain('...products.flatMap((p) => (p.detailImageUrls || [])),');
  });

  it('⭐ 뒤쪽 크롤 경로도 똑같이 담는다 (경로에 따라 결과가 달라지면 안 된다)', () => {
    expect(orch).toContain('...products.flatMap(p => (p.detailImageUrls || [])),');
  });

  it('⭐ 같은 사진이 두 번 들어가지 않는다 (쿼리스트링 달라도 같은 파일)', () => {
    expect(orch).toContain("const k = String(u || '').split('?')[0];");
  });

  it('⭐ 대표 사진이 맨 앞이다 — 썸네일이 0번을 쓴다', () => {
    const idx = orch.indexOf('const seenImg = new Set<string>();');
    expect(idx).toBeGreaterThan(-1);
    const block = blockBetween(orch.slice(idx), 'const imgs = [', '].filter(');
    // 대표(imageUrl)가 상세(detailImageUrls)보다 먼저 나와야 한다
    expect(block.indexOf('p.imageUrl')).toBeLessThan(block.indexOf('detailImageUrls'));
  });
});

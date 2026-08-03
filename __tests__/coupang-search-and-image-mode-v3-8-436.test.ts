/**
 * 실측 로그에서 잡은 결함 2건 (v3.8.436)
 *
 * 사용자 실측(2026-08-03, 토스 쉐어링크 발행 로그):
 *   🏷️ 제휴사: toss-sharelink (사용자 선택 — 링크 추측 안 함)
 *   🛒 쿠팡 파트너스 API: 실제 상품 데이터 조회 중...     ← ①
 *   ✅ 쿠팡 상품 5개 수집 완료 (할루시네이션 방지)         ← ①
 *   ✅ shopping 모드: 8개 섹션 구조 적용                  ← ②
 *
 * ① 토스 글인데 쿠팡 상품을 검색했다. 게다가 그 결과가 formatProductsForPrompt 로
 *    **본문 프롬프트 재료**로 들어간다 — 토스 글 본문이 남의 쿠팡 상품을 설명하게 된다.
 *    v3.8.432 는 고지문·위젯만 막았고 검색 자체는 그대로였다.
 * ② 섹션이 8개인데 이미지 배치 모드 문구는 "본문 5장 / 홀수 1·3·5번"으로 고정이었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');

describe('① 쿠팡 글이 아니면 쿠팡 상품을 검색조차 하지 않는다', () => {
  it('⭐ 검색 블록이 isCoupangArticle 로 먼저 막힌다', () => {
    expect(orch).toContain('if (!isCoupangArticle) {');
    expect(orch).toContain('쿠팡 글이 아니라 쿠팡 상품 검색을 건너뜁니다');
  });

  it('⭐ 건너뛰면 프롬프트에도 안 들어간다 (본문이 남의 상품을 설명하지 않는다)', () => {
    // formatProductsForPrompt 는 검색이 성공한 경우에만 호출돼야 한다.
    // 건너뛰는 분기 바로 뒤가 else if 여야 한다 — 즉 아래 검색 코드가 실행되지 않는다.
    const after = blockBetween(orch, '쿠팡 글이 아니라 쿠팡 상품 검색을 건너뜁니다', 'searchCoupangProducts(');
    expect(after).toContain('} else if (coupangAccessKey && coupangSecretKey');
  });

  it('⭐ 판정은 한 곳에서만 한다 (두 곳이면 한쪽만 고치는 사고가 난다)', () => {
    // 선언 1회 + 재할당 0회
    expect((orch.match(/const isCoupangArticle = explicitProvider/g) || []).length).toBe(1);
    expect(orch).not.toContain('let isCoupangArticle = false;');
    expect(orch).not.toMatch(/\n\s+isCoupangArticle = explicitProvider/);
  });

  it('⭐ 판정이 제휴 링크 파싱 직후에 있다 — 쿠팡 검색보다 앞선다', () => {
    const declIdx = orch.indexOf('const isCoupangArticle = explicitProvider');
    // ⚠️ 문구만으로 찾으면 이 수정을 설명하는 **주석**이 먼저 잡힌다(실제로 그랬다).
    //   실행되는 코드(onLog 호출)를 가리키도록 좁힌다.
    const searchIdx = orch.indexOf("onLog?.('[PROGRESS] 41% - 🛒 쿠팡 파트너스 API");
    expect(declIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(-1);
    expect(declIdx).toBeLessThan(searchIdx);
  });

  it('고지문·위젯 차단(v3.8.432)은 그대로 같은 판정을 쓴다', () => {
    expect(orch).toContain('const hasProducts = isCoupangArticle && Array.isArray(coupangProducts)');
    expect(orch).toContain('} else if (isCoupangArticle && coupangLink) {');
  });
});

describe('② 이미지 배치 모드 문구가 실제 소제목 수를 따른다', () => {
  it('⭐ 문구 재계산 함수가 있다', () => {
    expect(html).toContain('window.__syncH2ImageModeLabels = function __syncH2ImageModeLabels()');
  });

  it('⭐ 모드별 고정 섹션 수를 안다 (쇼핑 8 · 페러프레이징 6)', () => {
    expect(html).toContain('const MODE_FIXED_SECTIONS = { shopping: 8, paraphrasing: 6 };');
  });

  it('⭐ 홀수·짝수 번호를 총 개수에서 실제로 계산한다', () => {
    const fn = braceBlock(html, 'window.__syncH2ImageModeLabels = function __syncH2ImageModeLabels()');
    expect(fn).toContain('for (let i = 1; i <= total; i += 1)');
    expect(fn).toContain('odds.join');
    expect(fn).toContain('evens.join');
    expect(fn).toContain('본문 ${odds.length}장');
  });

  it('⭐ 모드가 바뀌면 문구도 다시 쓴다', () => {
    const fn = braceBlock(html, 'function syncContentModeSections(mode) {');
    expect(fn).toContain('__syncH2ImageModeLabels');
  });

  it('⭐ 소제목 개수를 바꿔도 따라간다', () => {
    expect(html).toContain("if (e.target?.id === 'sectionCount' || e.target?.id === 'contentMode')");
  });

  it('⭐ value 는 그대로다 — 백엔드 배선을 건드리지 않는다', () => {
    for (const v of ['all', 'odd', 'even', 'thumbnail-only', 'none']) {
      expect(html).toContain(`<option value="${v}"`);
    }
    const fn = braceBlock(html, 'window.__syncH2ImageModeLabels = function __syncH2ImageModeLabels()');
    // 텍스트만 바꾸고 value 는 안 건드린다
    expect(fn).toContain('opt.textContent = text;');
    expect(fn).not.toContain('opt.value =');
  });
});

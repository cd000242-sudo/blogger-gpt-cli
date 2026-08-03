/**
 * "사용자가 특정 상품 링크를 줬는가"는 제휴사와 무관하다 (v3.8.429)
 *
 * 사용자 보고(2026-08-03, 토스 쉐어링크 발행글): "cta 문구도 중복이있습니다"
 *
 * 원인: 제휴사와 무관한 판정 3곳이 전부 coupangLink(쿠팡 URL 정규식 매치)로
 *   대신 판정되고 있었다. 그래서 토스·네이버 링크를 넣은 글은 "링크를 안 준 글"로
 *   취급됐다:
 *     ① 상단 텍스트 CTA 생략 → 안 먹혀서 이미지 CTA 카드와 중복 (사용자가 본 증상)
 *     ② "추천 상품 한눈에 보기" 위젯 생략 → 안 먹혀서 키워드로 검색된 **쿠팡** 상품
 *        8개가 토스 글에 붙을 수 있었다 (내 링크 대신 남의 상품을 누르게 된다)
 *     ③ "사진을 누르면 판매 페이지로 갑니다" 안내 → 쿠팡 글에만 나갔다
 *
 * 반면 대가성 문구·enforceCoupangCompliance는 **진짜로 쿠팡 전용 규정**이므로
 * 그대로 coupangLink 판정을 유지해야 한다 — 이것도 함께 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const orch = fs.readFileSync(path.join(ROOT, 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

describe('제휴사 중립 판정 변수', () => {
  it('⭐ hasSpecificProductLink를 제휴 링크 전체(affiliateAll) 기준으로 정의한다', () => {
    expect(orch).toContain('const hasSpecificProductLink = affiliateAll.length > 0;');
  });

  it('coupangLink는 여전히 쿠팡 전용 판정으로 남아 있다 (쿠팡 컴플라이언스용)', () => {
    // v3.8.430: 사용자가 제휴사를 직접 고르게 되면서 "태그 우선 → 정규식 폴백" 삼항이 됐다.
    //   확인할 것은 그대로다 — 쿠팡 전용 판정이 살아 있고, 태그가 없는 구버전 payload 도
    //   예전과 똑같이 동작하는가.
    expect(orch).toContain('const coupangLink = explicitProvider');
    expect(orch).toContain("affiliateAll.find((u) => /coupang\\.com|coupa\\.ng/i.test(u))");
  });
});

describe('① 상단 텍스트 CTA 중복 — 제휴사 무관하게 생략한다', () => {
  it('⭐ 쇼핑 + 특정 상품 링크면 상단 텍스트 CTA를 생략한다 (coupangLink 아님)', () => {
    expect(orch).toContain("} else if (contentMode === 'shopping' && hasSpecificProductLink) {");
  });

  it('⭐ 예전의 쿠팡 전용 조건은 더 이상 남아 있지 않다', () => {
    expect(orch).not.toContain("} else if (contentMode === 'shopping' && coupangLink) {");
  });
});

describe('② "추천 상품 한눈에 보기" 위젯 — 링크를 준 글에는 제휴사 무관하게 생략', () => {
  it('⭐ 위젯 렌더 조건이 hasSpecificProductLink 기준이다', () => {
    expect(orch).toContain('if (!hasSpecificProductLink) {');
    expect(orch).not.toContain('if (!coupangLink) {');
  });

  it('위젯 생략 시 renderCoupangProductBlock을 부르지 않는다', () => {
    const block = braceBlock(orch, 'if (!hasSpecificProductLink) {');
    expect(block).toContain('renderCoupangProductBlock(coupangProducts)');
  });
});

describe('③ 이미지 클릭 안내 — 제휴사 무관하게 표시', () => {
  it('⭐ 안내문 조건이 hasSpecificProductLink 기준이다', () => {
    // v3.8.432: 안내문이 <p> 한 줄 → 테두리 3px 박스(<div>)로 바뀌었다. 조건은 그대로다.
    const block = braceBlock(orch, 'if (hasSpecificProductLink) {\n        // v3.8.432');
    expect(block).toContain('이 글의 사진을 누르면');
    expect(block).toContain('border:3px solid');
  });
});

describe('쿠팡 전용 규정은 그대로 쿠팡 판정을 쓴다 (넓히면 안 되는 것)', () => {
  it('⭐ 대가성 문구·컴플라이언스 폴백 분기는 여전히 coupangLink로 판정한다', () => {
    // "키워드 검색 결과는 없지만 사용자 쿠팡 링크는 있다" 분기 — 쿠팡 고지문이 필요한 경우다.
    // v3.8.432: 여기에 isCoupangArticle 조건이 **추가**됐다. 토스 글인데 쿠팡 고지문이
    //   붙던 사고(사용자 실측) 때문이다. coupangLink 판정 자체는 그대로 살아 있어야 한다.
    expect(orch).toContain('} else if (isCoupangArticle && coupangLink) {');
    const block = braceBlock(orch, '} else if (isCoupangArticle && coupangLink) {');
    expect(block).toContain('renderCoupangDisclosureBanner()');
    expect(block).toContain('enforceCoupangCompliance(html)');
  });

  it('쿠팡 상품명 사전 해석 분기도 그대로 coupangLink를 쓴다 (v3.8.403 경로)', () => {
    expect(orch).toContain("if (coupangLink && String((payload as any).contentMode || '') === 'shopping') {");
  });
});

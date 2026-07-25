/**
 * 쿠팡 파트너스 「대가성 문구 표기 권장 가이드」 준수 회귀 테스트 (v3.8.375)
 *
 * 가이드 요건:
 *   (1) 게시물의 제목 또는 첫 부분에 본문과 구별되게 표기
 *   (2) 글자 크기를 본문보다 크게 하거나 눈에 띄는 색으로 변경
 *   (3) 조건부/불확정적 표현 없이 경제적 이해관계를 명확히 기재
 *   (+) 태그·링크·이미지 다음에 작성하면 안 됨
 *
 * 위반 사례(가이드 명시): "소정의 수수료를 지급받을 수 있음", "제공받을 수 있습니다"
 */

import { renderCoupangDisclosureBanner, renderCoupangProductBlock, enforceCoupangCompliance } from '../src/core/coupang-partners';

/** 가이드가 금지한 조건부/불확정 표현 */
const CONDITIONAL_PATTERNS = [
  /받을\s*수\s*있습니다/,
  /지급받을\s*수\s*있/,
  /제공받을\s*수\s*있/,
  /소정의/,
];

const BODY_FONT_SIZE = 16; // wp-styled-content 본문 기준

describe('쿠팡 대가성 문구 배너 — 가이드 준수 (v3.8.375)', () => {
  const banner = renderCoupangDisclosureBanner();

  it('가이드가 제시한 확정형 문구를 그대로 사용한다', () => {
    expect(banner).toContain('이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.');
  });

  it('(3) 조건부·불확정적 표현을 쓰지 않는다', () => {
    CONDITIONAL_PATTERNS.forEach(p => expect(banner).not.toMatch(p));
  });

  it('(2) 글자 크기가 본문(16px)보다 크다', () => {
    const m = banner.match(/font-size\s*:\s*(\d+)px/);
    expect(m).not.toBeNull();
    expect(parseInt(m![1]!, 10)).toBeGreaterThan(BODY_FONT_SIZE);
  });

  it('(2) 눈에 띄는 색을 쓴다 (흐린 회색 금지)', () => {
    const m = banner.match(/color\s*:\s*(#[0-9a-f]{3,6})/i);
    expect(m).not.toBeNull();
    // 기존 위반값이던 회색 계열이면 실패
    expect(m![1]!.toLowerCase()).not.toBe('#6b7280');
    expect(m![1]!.toLowerCase()).not.toBe('#9ca3af');
  });

  it('(1) 본문과 구별되는 시각 요소를 갖는다 (테두리/배경/굵기)', () => {
    expect(banner).toMatch(/border-left|background/);
    expect(banner).toMatch(/font-weight\s*:\s*(bold|[6-9]00)/);
  });

  it('문구 안에 이미지나 링크를 포함하지 않는다 (문구가 링크 뒤로 밀리는 것 방지)', () => {
    expect(banner).not.toMatch(/<img|<a\s/i);
  });
});

describe('쿠팡 상품 블록 — 내부 문구도 확정형 (v3.8.375)', () => {
  const block = renderCoupangProductBlock([
    { productName: '테스트 상품', productPrice: 10000, productImage: 'https://example.com/a.jpg', productUrl: 'https://link.coupang.com/a/abc' } as any,
  ]);

  it('조건부 표현을 쓰지 않는다', () => {
    CONDITIONAL_PATTERNS.forEach(p => expect(block).not.toMatch(p));
  });

  it('"아래 상품은"이 아니라 게시물 전체를 지칭한다', () => {
    expect(block).not.toContain('아래 상품은 쿠팡 파트너스');
    expect(block).toContain('이 포스팅은 쿠팡 파트너스 활동의 일환으로');
  });

  it('제휴 링크에 rel="nofollow sponsored"가 붙는다', () => {
    expect(block).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(block).toMatch(/rel="[^"]*nofollow[^"]*"/);
  });
});

describe('enforceCoupangCompliance — LLM이 쓴 본문까지 강제 (v3.8.375)', () => {
  it('LLM이 쓴 조건부 고지문을 확정형 문장으로 교체한다', () => {
    const html = '<p>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 소정의 수수료를 지급받을 수 있습니다.</p>';
    const { html: out, fixes } = enforceCoupangCompliance(html);
    CONDITIONAL_PATTERNS.forEach(p => expect(out).not.toMatch(p));
    expect(out).toContain('이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.');
    expect(fixes.length).toBeGreaterThan(0);
  });

  it('"수수료를 받을 수 있습니다" 같은 부분 표현도 교정한다', () => {
    const { html: out } = enforceCoupangCompliance('<p>구매 시 수수료를 받을 수 있습니다.</p>');
    expect(out).toContain('수수료를 제공받습니다');
    expect(out).not.toMatch(/받을\s*수\s*있습니다/);
  });

  it('rel 없는 쿠팡 링크에 nofollow sponsored를 붙인다', () => {
    const html = '<a href="https://link.coupang.com/a/abc">상품 보기</a>';
    const { html: out } = enforceCoupangCompliance(html);
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(out).toContain('href="https://link.coupang.com/a/abc"');
    expect(out).toContain('>상품 보기</a>');
  });

  it('기존 rel이 있으면 값을 보존하며 병합한다', () => {
    const { html: out } = enforceCoupangCompliance('<a rel="noopener" href="https://coupa.ng/xyz">링크</a>');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*sponsored[^"]*"/);
    // rel 속성이 중복 출력되면 안 됨
    expect((out.match(/rel=/g) || []).length).toBe(1);
  });

  it('쿠팡이 아닌 링크는 건드리지 않는다', () => {
    const html = '<a href="https://www.gov.kr/portal">정부24</a>';
    expect(enforceCoupangCompliance(html).html).toBe(html);
  });

  it('이미 준수 중인 HTML은 그대로 둔다 (fixes 없음)', () => {
    const clean = renderCoupangDisclosureBanner();
    const { html: out, fixes } = enforceCoupangCompliance(clean);
    expect(out).toBe(clean);
    expect(fixes).toEqual([]);
  });

  it('빈 입력에 안전하다', () => {
    expect(enforceCoupangCompliance('').html).toBe('');
  });
});

describe('배너 배치 규칙 — 이미지·링크보다 앞 (v3.8.375)', () => {
  it('본문 최상단에 놓이면 첫 이미지·첫 링크보다 앞선다', () => {
    // orchestration이 조립하는 순서를 모사: H1 → 대가성 문구 → 썸네일/본문
    const assembled =
      '<h1 class="post-title">테스트 제목</h1>' +
      renderCoupangDisclosureBanner() +
      '<img src="https://example.com/thumb.jpg" alt="t" />' +
      '<p>본문입니다.</p>' +
      renderCoupangProductBlock([
        { productName: 'P', productPrice: 1000, productImage: 'https://example.com/p.jpg', productUrl: 'https://link.coupang.com/a/x' } as any,
      ]);

    const discPos = assembled.indexOf('이 포스팅은 쿠팡 파트너스');
    const imgPos = assembled.search(/<img\b/i);
    const linkPos = assembled.search(/link\.coupang\.com/);

    expect(discPos).toBeGreaterThan(-1);
    expect(discPos).toBeLessThan(imgPos);
    expect(discPos).toBeLessThan(linkPos);
  });
});

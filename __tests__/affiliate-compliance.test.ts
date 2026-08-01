/**
 * 제휴 운영정책 강제 테스트 (v3.8.395)
 *
 * 원문 근거 (2026-08-01 크롤 확인):
 *   네이버 https://blog.naver.com/brandconnect-creator/223763365056
 *   토스   https://sharelink-docs.toss.im/help/policy
 *
 * ⚠️ 가장 중요한 함정: **세 제휴사의 고지 문구가 서로 다르다.**
 *   쿠팡·토스 "이에 따른 일정액의 수수료를 제공받습니다"
 *   네이버     "판매 발생 시 수수료를 제공받습니다"
 *   기존 쿠팡 코드의 전역 치환을 네이버에 적용하면 공식 문구가 훼손된다.
 *   이 테스트가 그 교차 오염을 막는다.
 */
import {
  AFFILIATE_POLICIES, getPolicy, detectProvidersFromHtml,
} from '../src/core/affiliate/policies';
import {
  enforceAffiliateCompliance, renderDisclosure, applyTitleMark,
} from '../src/core/affiliate/compliance';

const link = (id: 'coupang' | 'naver' | 'toss') => ({
  coupang: 'https://link.coupang.com/a/xxxx',
  naver: 'https://naver.me/I5w1Dexp',
  toss: 'https://toss.im/_m/bMxjrwji',
}[id]);

const body = (id: 'coupang' | 'naver' | 'toss') =>
  `<p>본문입니다.</p><a href="${link(id)}">상품 보러가기</a><p>마무리.</p>`;

describe('공식 고지 문구 — 원문 그대로', () => {
  it('네이버는 "판매 발생 시" 다 (쿠팡·토스와 다르다)', () => {
    expect(AFFILIATE_POLICIES['naver-shopping-connect'].disclosure)
      .toBe('이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.');
  });

  it('토스는 "이에 따른 일정액의" 다', () => {
    expect(AFFILIATE_POLICIES['toss-sharelink'].disclosure)
      .toBe('이 포스팅은 토스쇼핑 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.');
  });

  it('토스는 ✱ 접두 기호를 쓴다 (공식 예시 형식)', () => {
    expect(AFFILIATE_POLICIES['toss-sharelink'].disclosurePrefix).toBe('✱ ');
  });

  it('쿠팡은 기존 검증된 문구를 유지한다', () => {
    expect(AFFILIATE_POLICIES.coupang.disclosure)
      .toBe('이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.');
  });

  it('세 문구가 서로 다르다 — 하나로 뭉뚱그리면 위반이다', () => {
    const texts = Object.values(AFFILIATE_POLICIES).map(p => p.disclosure);
    expect(new Set(texts).size).toBe(3);
  });

  it('모든 정책에 원문 출처와 확인일이 있다', () => {
    Object.values(AFFILIATE_POLICIES).forEach((p) => {
      expect(p.policyUrl).toMatch(/^https?:\/\//);
      expect(p.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('모르는 제휴사는 undefined — 임의 폴백으로 틀린 문구를 내보내지 않는다', () => {
    expect(getPolicy('unknown-program')).toBeUndefined();
    expect(getPolicy('')).toBeUndefined();
    expect(getPolicy(null)).toBeUndefined();
  });
});

describe('교차 오염 방지 — 제휴사별 교정 규칙이 서로를 침범하지 않는다', () => {
  it('네이버 글에 쿠팡식 "일정액" 치환이 일어나지 않는다', () => {
    const html = `<p>이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.</p>${body('naver')}`;
    const r = enforceAffiliateCompliance(html, 'naver-shopping-connect');
    expect(r.html).toContain('판매 발생 시 수수료를 제공받습니다');
    expect(r.html).not.toContain('네이버 쇼핑 커넥트 활동의 일환으로, 이에 따른 일정액의');
  });

  it('네이버 조건부 표현은 네이버 공식 문구로만 교정된다', () => {
    const html = `<p>이 포스팅은 네이버 쇼핑 커넥트 활동으로 수수료를 받을 수 있습니다.</p>${body('naver')}`;
    const r = enforceAffiliateCompliance(html, 'naver-shopping-connect');
    expect(r.html).toContain('판매 발생 시 수수료를 제공받습니다');
    expect(r.html).not.toContain('받을 수 있습니다');
  });

  it('토스 조건부 표현은 토스 공식 문구로 교정된다', () => {
    const html = `<p>이 포스팅은 토스쇼핑 쉐어링크 활동으로 수수료를 지급받을 수 있습니다.</p>${body('toss')}`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.html).toContain('이에 따른 일정액의 수수료를 제공받습니다');
  });

  it('쿠팡 규칙이 네이버 문구를 건드리지 않는다', () => {
    const html = `<p>이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.</p>${body('coupang')}`;
    const r = enforceAffiliateCompliance(html, 'coupang');
    expect(r.html).toContain('판매 발생 시 수수료를 제공받습니다');   // 원문 보존
  });
});

describe('대가성 문구 — 없으면 자동 삽입 (차단하지 않는다)', () => {
  it('문구가 없으면 본문 최상단에 넣는다', () => {
    const r = enforceAffiliateCompliance(body('toss'), 'toss-sharelink');
    expect(r.html.indexOf('affiliate-disclosure')).toBeLessThan(r.html.indexOf('본문입니다'));
    expect(r.fixes.some(f => f.includes('대가성 문구 자동 삽입'))).toBe(true);
  });

  it('이미 있으면 중복해서 넣지 않는다', () => {
    const once = enforceAffiliateCompliance(body('naver'), 'naver-shopping-connect').html;
    const twice = enforceAffiliateCompliance(once, 'naver-shopping-connect').html;
    const core = AFFILIATE_POLICIES['naver-shopping-connect'].disclosure.replace(/\s+/g, '');
    const flat = twice.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    expect(flat.split(core).length - 1).toBe(1);
  });

  it('스타일이 달라도 문구가 있으면 인정한다', () => {
    const html = `<div>이 포스팅은 토스쇼핑 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>${body('toss')}`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.fixes.some(f => f.includes('자동 삽입'))).toBe(false);
  });

  it('접기(details) 안에 있으면 최상단에 다시 넣는다 — 토스 정책 명시 위반', () => {
    const inner = AFFILIATE_POLICIES['toss-sharelink'].disclosure;
    const html = `<details><summary>자세히 보기</summary><p>${inner}</p></details>${body('toss')}`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.warnings.some(w => w.includes('접기'))).toBe(true);
    expect(r.html.startsWith('<p class="affiliate-disclosure"')).toBe(true);
  });

  it('고지문 블록에 제휴사 식별자가 붙는다 (사후 점검용)', () => {
    expect(renderDisclosure(AFFILIATE_POLICIES['toss-sharelink']))
      .toContain('data-affiliate-provider="toss-sharelink"');
  });
});

describe('링크 취급 — URL 을 절대 변조하지 않는다 (토스: 계약 해지 사유)', () => {
  it('href 값이 그대로 보존된다', () => {
    const url = 'https://toss.shopping/t/2526906561?k=7ab0e43f-e76f-419f-a094-864e77987e69&referrer=affiliate';
    const r = enforceAffiliateCompliance(`<a href="${url}">상품</a>`, 'toss-sharelink');
    expect(r.html).toContain(`href="${url}"`);
  });

  it('추적 파라미터가 잘리지 않는다', () => {
    const url = 'https://smartstore.naver.com/singlegadget/products/13655762284?NaPm=ct%3Dx%7Cci%3Daffiliate';
    const r = enforceAffiliateCompliance(`<a href="${url}">상품</a>`, 'naver-shopping-connect');
    expect(r.html).toContain('NaPm=ct%3Dx%7Cci%3Daffiliate');
  });
});

describe('rel="sponsored nofollow" — 구글 요구사항', () => {
  it('제휴 링크에 부여한다', () => {
    const r = enforceAffiliateCompliance(body('toss'), 'toss-sharelink');
    expect(r.html).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(r.html).toMatch(/rel="[^"]*nofollow[^"]*"/);
  });

  it('기존 rel 값을 보존하며 추가한다', () => {
    const r = enforceAffiliateCompliance(
      `<a href="${link('toss')}" rel="noopener">상품</a>`, 'toss-sharelink');
    const rel = r.html.match(/rel="([^"]*)"/)?.[1] || '';
    ['noopener', 'sponsored', 'nofollow'].forEach(t => expect(rel).toContain(t));
  });

  it('제휴사가 아닌 링크는 건드리지 않는다', () => {
    const r = enforceAffiliateCompliance(
      `<a href="https://example.com">일반</a>${body('toss')}`, 'toss-sharelink');
    expect(r.html).toContain('<a href="https://example.com">일반</a>');
  });

  it('이미 충족된 링크는 다시 고치지 않는다', () => {
    const html = `<a href="${link('toss')}" rel="sponsored nofollow">상품</a>`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.fixes.some(f => f.includes('rel='))).toBe(false);
  });
});

describe('금지 광고 형태 제거 (토스 정책 명시)', () => {
  it('플로팅 배너(position:fixed)를 없앤다', () => {
    const html = `<div style="position:fixed;bottom:0"><a href="${link('toss')}">지금 구매</a></div>`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.html).toContain('position:static');
    expect(r.fixes.some(f => f.includes('플로팅 배너'))).toBe(true);
  });

  it('sticky 도 막는다', () => {
    const html = `<div style="position:sticky;top:0"><a href="${link('toss')}">구매</a></div>`;
    expect(enforceAffiliateCompliance(html, 'toss-sharelink').html).toContain('position:static');
  });

  it('자동 이동 스크립트를 제거한다 — 무효 클릭 유발', () => {
    const html = `<script>setTimeout(()=>{location.href='${link('toss')}'},100)</script>${body('toss')}`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.html).not.toContain('location.href');
    expect(r.fixes.some(f => f.includes('자동 이동'))).toBe(true);
  });

  it('본문 가림 오버레이를 완화한다', () => {
    const html = `<div style="z-index:99999;position:absolute"><a href="${link('toss')}">구매</a></div>`;
    const r = enforceAffiliateCompliance(html, 'toss-sharelink');
    expect(r.html).toContain('z-index:1');
  });

  it('제휴 링크가 없는 요소의 스타일은 건드리지 않는다', () => {
    const html = `<div style="position:fixed">일반 배너</div>${body('toss')}`;
    expect(enforceAffiliateCompliance(html, 'toss-sharelink').html).toContain('position:fixed');
  });
});

describe('제휴사 자동 탐지', () => {
  it('본문 링크로 제휴사를 알아낸다', () => {
    expect(detectProvidersFromHtml(body('naver'))).toEqual(['naver-shopping-connect']);
    expect(detectProvidersFromHtml(body('toss'))).toEqual(['toss-sharelink']);
  });

  it('href 밖의 도메인 언급은 링크로 치지 않는다', () => {
    expect(detectProvidersFromHtml('<p>toss.im 에서 샀어요</p>')).toEqual([]);
  });

  it('혼용이면 경고하되 발행은 계속한다', () => {
    const html = body('toss') + body('naver');
    const r = enforceAffiliateCompliance(html, null);
    expect(r.warnings.some(w => w.includes('한 제휴사만'))).toBe(true);
    expect(r.html.length).toBeGreaterThan(0);
    expect(r.provider).toBeTruthy();
  });

  it('제휴 글이 아니면 아무것도 하지 않는다', () => {
    const html = '<p>평범한 글</p>';
    const r = enforceAffiliateCompliance(html, null);
    expect(r.html).toBe(html);
    expect(r.provider).toBeNull();
  });
});

describe('네이버 #7 블로그 가이드 추가 요건 (2026-08-01 원문 확인)', () => {
  // 원문: blog.naver.com/brandconnect-creator/223763367552
  //   "블로그의 경우 ... 각 게시글 제목 앞, 본문 최상단에 대가성 문구를 삽입해야 합니다."
  //   "❌ 이미지에 삽입되어 있거나, 태그 사이에 작성하는 등 식별이 어려운 경우"
  //   "❌ 쇼핑 커넥트 링크와 대가성 문구 삽입 시에는 #내돈내산 기능을 사용할 수 없습니다"
  //   "내용과 관련 없는 링크를 대량으로 삽입하는 등 어뷰징 활동 시 불이익"
  const naver = 'naver-shopping-connect' as const;

  it('네이버는 제목 표시를 요구한다', () => {
    expect(AFFILIATE_POLICIES[naver].requiresTitleMark).toBe(true);
    expect(applyTitleMark('전세 보증금 올리는 법', naver)).toBe('[제휴] 전세 보증금 올리는 법');
  });

  it('제목에 전체 문장을 넣지 않는다 — 넣으면 검색 노출이 망가진다', () => {
    const marked = applyTitleMark('제목', naver);
    expect(marked.length).toBeLessThan(20);
    expect(marked).not.toContain('수수료를 제공받습니다');
  });

  it('이미 표시가 있으면 중복하지 않는다', () => {
    expect(applyTitleMark('[제휴] 제목', naver)).toBe('[제휴] 제목');
  });

  it('토스·쿠팡은 제목을 건드리지 않는다 (정책상 본문 최상단으로 충분)', () => {
    expect(applyTitleMark('제목', 'toss-sharelink')).toBe('제목');
    expect(applyTitleMark('제목', 'coupang')).toBe('제목');
  });

  it('제휴사 미지정이면 제목을 그대로 둔다', () => {
    expect(applyTitleMark('제목', null)).toBe('제목');
  });

  it('이미지 alt 안의 고지문을 경고한다 — 식별 불가로 위반', () => {
    const html = `<img src="x.png" alt="이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로">${body('naver')}`;
    const r = enforceAffiliateCompliance(html, naver);
    expect(r.warnings.some(w => w.includes('이미지 alt'))).toBe(true);
  });

  it('#내돈내산 병용을 경고한다', () => {
    const r = enforceAffiliateCompliance(`<p>#내돈내산 후기</p>${body('naver')}`, naver);
    expect(r.warnings.some(w => w.includes('내돈내산'))).toBe(true);
  });

  it('링크 과다를 경고한다 — 어뷰징 불이익 방지', () => {
    const many = Array.from({ length: 7 }, () => `<a href="${link('naver')}">상품</a>`).join('');
    const r = enforceAffiliateCompliance(many, naver);
    expect(r.warnings.some(w => w.includes('어뷰징'))).toBe(true);
  });

  it('권장 개수 이내면 경고하지 않는다', () => {
    const few = Array.from({ length: 3 }, () => `<a href="${link('naver')}">상품</a>`).join('');
    const r = enforceAffiliateCompliance(few, naver);
    expect(r.warnings.some(w => w.includes('어뷰징'))).toBe(false);
  });

  it('경고는 경고일 뿐 — 발행을 막지 않는다', () => {
    const html = `<p>#내돈내산</p>${body('naver')}`;
    const r = enforceAffiliateCompliance(html, naver);
    expect(r.html.length).toBeGreaterThan(0);
    expect(r.provider).toBe(naver);
  });
});

describe('절대 발행을 막지 않는다', () => {
  it('빈 입력에 안전하다', () => {
    expect(enforceAffiliateCompliance('', 'toss-sharelink').html).toBe('');
    expect(enforceAffiliateCompliance(null as any, 'toss-sharelink').html).toBe('');
  });

  it('반환값에 차단 신호가 없다 — 경고만 있다', () => {
    const r = enforceAffiliateCompliance(body('toss'), 'toss-sharelink');
    expect(Object.keys(r)).not.toContain('blocked');
    expect(Object.keys(r)).not.toContain('pass');
    expect(Object.keys(r).sort()).toEqual(['fixes', 'html', 'provider', 'warnings']);
  });

  it('깨진 HTML 에도 throw 하지 않는다', () => {
    expect(() => enforceAffiliateCompliance('<a href=', 'toss-sharelink')).not.toThrow();
    expect(() => enforceAffiliateCompliance('<div><p>', 'naver-shopping-connect')).not.toThrow();
  });
});

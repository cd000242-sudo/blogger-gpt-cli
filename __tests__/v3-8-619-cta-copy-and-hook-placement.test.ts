/**
 * v3.8.619 — CTA 세 가지 실사고
 *
 * 사장님 질문: "후킹멘트와 버튼 텍스트 그리고 연결한 링크 자체가 의도한 대로 나오는지 궁금해"
 * 재보니 셋 다 어긋나 있었다.
 *
 *   ① 이름 사전에 기관이 없어 버튼이 "🔗 공식 사이트 바로가기" 로 추락
 *   ② 이름을 못 찾으면 훅도 "운영 기관의 원문 안내로 이어집니다" — 누를 이유가 없다
 *   ③ 훅 <p> 가 짧아서 다음 본문 문단과 합쳐지며 **CTA 박스 밖으로 밀려남**
 *      → 박스엔 버튼만 남고, 본문 한복판에 굵은 비문이 박힌다
 */

import { buildCtaCopy, siteNameFromUrl, officialKindOf } from '../src/cta/cta-copy';
import { normalizeParagraphs } from '../src/core/final/paragraph-normalizer';

describe('① 기관 이름 사전 — 실제 접속으로 확인한 이름', () => {
  it('금융·정책 글에 자주 나오는 기관을 이름으로 부른다', () => {
    expect(siteNameFromUrl('https://www.fsc.go.kr/no010101/84617')).toBe('금융위원회');
    expect(siteNameFromUrl('https://www.mpm.go.kr')).toBe('인사혁신처');
    expect(siteNameFromUrl('https://www.bok.or.kr')).toBe('한국은행');
    expect(siteNameFromUrl('https://www.hf.go.kr')).toBe('한국주택금융공사');
  });

  it('하위 도메인이어도 상위에서 찾는다', () => {
    expect(siteNameFromUrl('https://eiec.kdi.re.kr/policy/materialView.do?num=264303')).toBe('KDI 경제교육·정보센터');
  });

  it('개편된 이름을 쓴다 — 옛 이름으로 부르지 않는다', () => {
    expect(siteNameFromUrl('https://kostat.go.kr')).toBe('국가데이터처');
    expect(siteNameFromUrl('https://me.go.kr')).toBe('기후에너지환경부');
  });

  it('이름이 들어가면 버튼이 목적지를 말한다', () => {
    const copy = buildCtaCopy({ url: 'https://www.fsc.go.kr/no010101/84617' });
    expect(copy.buttonText).toContain('금융위원회');
    expect(copy.buttonText).not.toBe('🔗 공식 사이트 바로가기');
    expect(copy.hookingMessage).toContain('금융위원회');
  });
});

describe('② 이름을 몰라도 주소가 성격을 말해 준다', () => {
  it('도메인으로 기관 성격을 읽는다', () => {
    expect(officialKindOf('https://www.example.go.kr/notice')).toBe('정부기관');
    expect(officialKindOf('https://www.example.or.kr')).toBe('공공기관');
    expect(officialKindOf('https://lab.example.re.kr')).toBe('연구기관');
  });

  it('확실하지 않은 도메인에는 아무 말도 붙이지 않는다', () => {
    expect(officialKindOf('https://www.example.co.kr')).toBe('');
    expect(officialKindOf('https://example.com')).toBe('');
    expect(officialKindOf('')).toBe('');
  });

  it('모르는 정부 도메인이어도 "공식 사이트"보다는 말을 한다', () => {
    const copy = buildCtaCopy({ url: 'https://www.newagency.go.kr/apply' });
    expect(copy.buttonText).toContain('정부기관');
    expect(copy.buttonText).not.toBe('🔗 공식 사이트 바로가기');
    expect(copy.hookingMessage).not.toBe('운영 기관의 원문 안내로 이어집니다.');
  });

  it('아무 단서도 없으면 예전 폴백 그대로 — 지어내지 않는다', () => {
    const copy = buildCtaCopy({ url: 'https://example.com/page' });
    expect(copy.buttonText).toBe('🔗 공식 사이트 바로가기');
  });
});

describe('③ CTA 훅은 본문과 합쳐지지 않는다 (실측 회귀)', () => {
  /**
   * 실사고 재현: 훅은 한 줄(60자 미만)이라 "짧은 문단"으로 잡혀 다음 본문과 합쳐졌고,
   * 그 과정에서 CTA 박스 밖으로 밀려났다. 발행글에 이렇게 나갔다:
   *   <p class="cta-hook">운영 기관의 원문 안내로 이어집니다. 주담대 한도는 연소득에…</p>
   */
  const BODY = '주담대 한도는 연소득에 DSR 비율을 적용한 뒤 기존 대출 원리금을 빼고 계산하는 흐름으로 이해하면 됩니다. 계약 전에 금융회사에 심사금리를 물어보는 편이 빠릅니다.';

  it('훅 문단이 다음 본문 문단을 삼키지 않는다', () => {
    const html = [
      '<div class="cta-box">',
      '<p class="cta-hook"><strong>금융위원회가 안내하는 원문입니다.</strong></p>',
      '<div class="cta-action-stack"><a class="cta-btn" href="https://www.fsc.go.kr">금융위원회에서 확인</a></div>',
      '</div>',
      `<p class="article-p">${BODY}</p>`,
    ].join('');

    const result = normalizeParagraphs(html);
    expect(result.html).toContain('<p class="cta-hook"><strong>금융위원회가 안내하는 원문입니다.</strong></p>');
    expect(result.html).not.toMatch(/class="cta-hook"[^>]*>[^<]*<strong>[^<]*<\/strong>\s*주담대 한도는/);
  });

  it('훅과 버튼이 같은 박스 안에 남는다', () => {
    const html = [
      '<div class="cta-box">',
      '<p class="cta-hook"><strong>한국은행이 안내하는 원문입니다.</strong></p>',
      '<div class="cta-action-stack"><a class="cta-btn" href="https://www.bok.or.kr">한국은행에서 확인</a></div>',
      '</div>',
      `<p class="article-p">${BODY}</p>`,
    ].join('');

    const box = normalizeParagraphs(html).html.match(/<div class="cta-box">[\s\S]*?<\/div>\s*<\/div>/);
    expect(box).not.toBeNull();
    expect(box![0]).toContain('cta-hook');
    expect(box![0]).toContain('cta-btn');
  });

  it('CTA 가 아닌 짧은 문단은 예전처럼 합친다', () => {
    const html = ['<p>짧은 문단입니다.</p>', `<p>${BODY}</p>`].join('');
    expect(normalizeParagraphs(html).merged).toBeGreaterThan(0);
  });
});

describe('조사가 틀리면 사람이 쓴 글로 안 읽힌다', () => {
  it('받침에 따라 이/가를 고른다', () => {
    // 정부기관·공공기관·연구기관은 모두 받침이 있어 "이"
    ['https://a.go.kr', 'https://a.or.kr', 'https://a.re.kr'].forEach((url) => {
      const hook = buildCtaCopy({ url }).hookingMessage;
      expect(hook).toMatch(/기관이 안내하는/);
      expect(hook).not.toMatch(/기관가/);
    });
  });
});

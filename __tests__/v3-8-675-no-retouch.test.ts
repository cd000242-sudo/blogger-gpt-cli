const fs = require('fs');
const path = require('path');

import { isContextuallySafeCtaUrl } from '../src/core/final/generation';
import { analyzeArticleContext } from '../src/cta/action-link-harness';
import { dropDeferralSentences, buildAnswerBlock } from '../src/core/final/answer-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.675 — 사장님: "리터치를 수동으로 또 하면 자동화를 쓰는 이유가 없어."
 * 오늘 라이브 2편에서 사람이 봐야 했던 세 곳을 코드가 잡는다:
 *  ① CTA 오배송 — 정부 도메인을 "키워드에 신청·민원이 없다" 고 막아 맞는 페이지를 버리고 카탈로그가 엉뚱한 기관을 골랐다
 *  ② 답 상자의 회피 문장 — "…절차도 함께 확인해요" 가 답 셋 중 하나였다
 *  ③ 글이 지목한 기관에 "계속됐는지처" 같은 쓰레기가 섞였다
 */
describe('v3.8.675 리터치 없이 — CTA 오배송 · 답 상자 회피 · 기관 이름 쓰레기', () => {
  const KW = '주택연금 가입자가 사망했는데 배우자가 승계받지 못하는 경우';

  test('① 정부·공공 도메인은 분류가 없어도 통과, 분류가 어긋나는 민간 도메인은 여전히 차단', () => {
    expect(isContextuallySafeCtaUrl('https://www.hf.go.kr/ko/sub03/sub03_02_05_07.do', KW, 'internal')).toBe(true);
    expect(isContextuallySafeCtaUrl('https://www.childsupport.or.kr/lay1/program/S1T8C14/selfdiagnosis/intro.do', '양육비 선지급 탈락 사유', 'internal')).toBe(true);
    // 보험 글에 삼성화재 홈 — finance 분류인데 키워드에 금융·보험이 없으면 막는다 (v3.8.522 의 목적 그대로)
    expect(isContextuallySafeCtaUrl('https://www.samsungfire.com/', KW, 'internal')).toBe(false);
    // 세금 도메인은 세금 키워드일 때만
    expect(isContextuallySafeCtaUrl('https://www.hometax.go.kr/', KW, 'internal')).toBe(false);
    expect(isContextuallySafeCtaUrl('https://www.hometax.go.kr/', '종합소득세 신고 기한', 'internal')).toBe(true);
    // 검색·블로그·다운로드 주소는 그대로 차단
    expect(isContextuallySafeCtaUrl('https://search.naver.com/search.naver?query=x', KW)).toBe(false);
    expect(isContextuallySafeCtaUrl('https://www.fss.or.kr/fss/cmmn/file/fileDown.do?atchFileId=1', '금융 민원')).toBe(false);
  });

  test('① 카탈로그 폴백은 글이 지목한 기관과 다르면 붙이지 않는다 (배선)', () => {
    const g = read('src/core/final/generation.ts');
    expect(g).toContain("require('./official-sources').resolveAgency(catalogLink.url)");
    expect(g).toContain('카탈로그 기관 불일치로 미부착');
    expect(g).toContain('if (catalogLink && !catalogAgencyMismatch) {');
    // 지목 기관이 없으면(빈 배열) 예전처럼 카탈로그를 쓴다 — 관문은 있을 때만
    expect(g).toContain('ctaArticleAgencies.length > 0');
  });

  test('② 답 상자에서 회피 문장만 뺀다 — 전부 회피면 상자를 안 만든다', () => {
    const a = '대상 자녀는 18세 이하예요. 신청월 직전 3개월 평균 수령액이 자녀 1명당 월 20만원보다 적은지 봐요. 양육비이행관리원 이행확보 절차도 함께 확인해요.';
    expect(dropDeferralSentences(a)).toBe('대상 자녀는 18세 이하예요. 신청월 직전 3개월 평균 수령액이 자녀 1명당 월 20만원보다 적은지 봐요.');
    expect(dropDeferralSentences('가입 당시 지정된 배우자만 승계돼요. 6개월 안에 채무인수를 마쳐야 해요.')).toBe('가입 당시 지정된 배우자만 승계돼요. 6개월 안에 채무인수를 마쳐야 해요.');
    expect(dropDeferralSentences('공식 안내를 확인하세요. 기관에 문의하세요.')).toBe('');
    expect(dropDeferralSentences('공식 안내를 확인하세요.')).toBe('공식 안내를 확인하세요.');   // 한 문장은 손대지 않는다 (상자 자체는 길이 문턱이 거른다)
    const html = buildAnswerBlock({ keyword: '양육비 선지급', question: '탈락 요건은', answer: a, basis: '' });
    expect(html).toContain('18세 이하예요');
    expect(html).not.toContain('함께 확인해요');
    expect(buildAnswerBlock({ keyword: 'k', question: 'q', answer: '먼저 공식 안내를 확인하세요. 그 다음 기관에 문의하세요. 자세한 것은 담당자에게 확인하세요.', basis: '' })).toBe('');
  });

  test('③ 글이 지목한 기관에 용언 꼬리("계속됐는지처")가 섞이지 않는다', () => {
    const content = '한국주택금융공사 안내를 봅니다. 한국주택금융공사 기준입니다. 절차가 계속됐는지처 확인합니다. 한국주택금융공사가 정합니다.';
    const ctx = analyzeArticleContext({ keyword: KW, content });
    expect(ctx.agencies).toContain('한국주택금융공사');
    expect(ctx.agencies.some((a) => /됐는지/.test(a))).toBe(false);
  });
});

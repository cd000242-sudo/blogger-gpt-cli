/**
 * v3.8.615 — 확신 0.95 로 찾아 둔 목적지를 버리지 않는다
 *
 * 사장님: "API로 하니까 오히려 CTA가 하나도 안나오는글이있던데 의도한건가요?"
 *         "에드센스모드는 그렇다쳐도 지금 SEO모드로 돌렷는데 안나왔는데"
 *
 * ## 실측 (발행글 5451 "기한이익상실 통지", SEO 모드로 재현)
 *   [SMART-CTA] 🧭 목적지: 금융감독원 (확신 0.95)      ← 제대로 찾았다
 *   [CTA] ✅ 공식 사이트 확인됨: …/fileDown.do?atchFileId=…  ← 2MB 첨부파일
 *   [CTA] 🚫 주제-링크 불일치로 차단
 *   [CTA] ⚠️ 공식 사이트 매핑도 없음 — CTA 생략
 *   → CTA 0 개
 *
 * 폴백 표가 **글 키워드만** 봤다. 제목에 "금융감독원" 이 없으니 표를 못 탔고,
 * 라우터가 이미 찾아 둔 답은 쓰이지도 못한 채 버려졌다.
 */
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/generation.ts'),
  'utf-8',
);

describe('라우터가 짚은 기관을 쓴다', () => {
  test('글 키워드만 보지 않는다', () => {
    expect(src).toContain('const findFallbackSite');
    expect(src).toMatch(/findFallbackSite\(\[keyword, routerSite, \.\.\.ctaArticleAgencies\]\)/);
  });

  test('라우터 목적지를 가져온다', () => {
    expect(src).toMatch(/const routerSite = \(await ensureSmartTarget\(\)\)\?\.site/);
  });

  test('키워드가 아닌 경로로 걸렸으면 로그로 남긴다', () => {
    expect(src).toContain('라우터·본문이 지목한 기관으로 폴백 매칭');
  });

  test('사고를 낸 그 기관이 표에 있다', () => {
    expect(src).toContain('금융감독원');
    expect(src).toContain('기한이익상실');
    expect(src).toContain('https://www.fss.or.kr/fss/main/main.do');
  });

  test('분쟁·감독 기관을 함께 넣었다', () => {
    for (const site of ['한국소비자원', '국민권익위', '예금보험공사', '소상공인시장진흥공단']) {
      expect(src).toContain(site);
    }
  });
});

describe('첨부파일 내려받기 주소는 CTA 가 될 수 없다', () => {
  test('다운로드 엔드포인트를 막는다', () => {
    expect(src).toMatch(/file\(down\|Down\)\\\.do/);
    expect(src).toContain('atchfileid=');
  });

  test('문서 CTA 자체를 막는 게 아니라는 걸 적어 둔다', () => {
    expect(src).toContain('detectDocumentCta 가 다루는');
  });
});

describe('막는 규칙이 실제 주소에 걸린다', () => {
  /** 소스에 박아 둔 그 정규식을 그대로 떼어 와 시험한다 */
  const DOWNLOAD_RE = /\/file(down|Down)\.do|atchfileid=|\/cmmn\/file\/|downloadfile\.do|filedownload\.do/i;

  test('사고를 낸 실제 주소를 잡는다', () => {
    const real = 'https://www.fss.or.kr/fss/cmmn/file/fileDown.do?atchFileId=b409683b4fa245bc83b4f0b397a30096&fileSn=2';
    expect(DOWNLOAD_RE.test(real.toLowerCase())).toBe(true);
  });

  test('멀쩡한 기관 주소는 통과한다', () => {
    for (const ok of [
      'https://www.fss.or.kr/fss/main/main.do',
      'https://www.gov.kr/portal/main/nologin',
      'https://ols.semas.or.kr/',
    ]) {
      expect(DOWNLOAD_RE.test(ok.toLowerCase())).toBe(false);
    }
  });
});

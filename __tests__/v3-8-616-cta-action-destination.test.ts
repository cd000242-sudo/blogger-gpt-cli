/**
 * v3.8.616 — 어떤 주제든 **행동 화면**으로 묶는다
 *
 * 사장님:
 *   "행동을 유발시키려면 CTA가 제대로되어있어야되 그냥 홈으로 보내면안된다고…
 *    근로장려금 신청방법이나 사람들이 왜 검색을 하겠냐고 그 신청을 어디서 하는지
 *    모르니까 검색을 하는 거 아냐"
 *   "어떤주제이던지 자동으로 잘묶어줘야되"
 *
 * ## 실측으로 드러난 것 (2026-08-31)
 *   "근로장려금 신청방법"      → 정부24 **홈**            ← 어디서 신청하는지 답 못 함
 *   "자동차 과태료 조회"        → **롯데렌터카**           ← 상업 오배송 (홈보다 나쁘다)
 *   "전세보증금 반환보증 가입"  → **부동산114**            ← 상업 오배송
 * 카탈로그의 넓은 태그(자동차·부동산)가 상업 사이트를 뽑았고 judgeCtaHost 는 카탈로그면 통과시켰다.
 *
 * ## 고친 뒤 (같은 키워드 재실행)
 *   근로장려금 신청방법 → 홈택스에서 신청하기
 *   자동차 과태료 조회  → 경찰청 이파인에서 조회하기
 *   전세보증금 반환보증 → SH 서울주택도시공사에서 가입하기
 */
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/generation.ts'),
  'utf-8',
);

describe('홈으로 보내지 않는다', () => {
  test('홈 주소를 알아본다', () => {
    expect(src).toContain('const looksLikeHomeUrl');
  });

  test('돌려주기 직전에 한 번 더 검사한다 — 앞단계가 홈을 채택해도 잡힌다', () => {
    expect(src).toMatch(/return await upgradeHomeCtas\(safeCTAs/);
  });

  test('버튼이 무엇을 하는지 말한다 (바로가기 아님)', () => {
    expect(src).toMatch(/\$\{label\}에서 \$\{doing\}하기/);
  });

  test('신청과 조회를 구분한다', () => {
    expect(src).toContain("wantsCheckNow ? '조회'");
  });
});

describe('공공 주제에 상업 사이트를 물리지 않는다', () => {
  test('공공 주제인지 본다', () => {
    expect(src).toContain('function looksPublicTopic');
  });

  test('기관 도메인이 아니면 교체를 시도한다', () => {
    expect(src).toContain('const wrongHost = publicTopic && !isInstitutionalHost(cta.url)');
  });

  test('끝내 못 바꾸면 버튼을 뺀다 — 오배송보다 없는 게 낫다', () => {
    expect(src).toContain('공공 주제 오배송을 대체하지 못해 CTA 를 뺍니다');
  });
});

describe('표에 없는 주제도 자동으로 묶는다', () => {
  test('기관 행동 화면을 새로 찾아온다', () => {
    expect(src).toContain('async function findInstitutionalActionPage');
  });

  test('기관 도메인·비홈·비첨부만 고른다', () => {
    const fn = src.slice(src.indexOf('async function findInstitutionalActionPage'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    expect(body).toContain('isInstitutionalHost(link)');
    expect(body).toContain('looksLikeHomeUrl(link)');
    expect(body).toContain('atchfileid=');
  });

  test('라벨을 목적지에서 만든다 — 라우터 이름과 실제가 다를 수 있다', () => {
    expect(src).toContain('function agencyLabelFromUrl');
    expect(src).toContain('label = agencyLabelFromUrl(picked.url)');
  });

  test('찾은 곳이 어디인지 로그로 남긴다', () => {
    expect(src).toContain('기관 행동 화면으로 교체');
  });
});

describe('공공 주제 판정이 실제 주제에 걸린다', () => {
  /** 소스에 박아 둔 그 정규식을 그대로 떼어 와 시험한다 */
  const PUBLIC_RE = /신청|접수|지원금|보조금|장려금|급여|수당|과태료|범칙금|세금|환급|공제|연금|보험료|증명서|발급|민원|등록|면허|보증|청약|보훈|복지|국세|지방세|고용|산재|건강보험|정부|공단|공사|청\b|부\b|위원회/;

  test.each([
    '근로장려금 신청방법',
    '자동차 과태료 조회',
    '전세보증금 반환보증 가입',
    '실업급여 신청 조건',
  ])('%s 는 공공 주제다', (kw) => {
    expect(PUBLIC_RE.test(kw)).toBe(true);
  });

  test.each([
    '캠핑 의자 추천',
    '제주도 3박4일 코스',
  ])('%s 는 공공 주제가 아니다', (kw) => {
    expect(PUBLIC_RE.test(kw)).toBe(false);
  });
});

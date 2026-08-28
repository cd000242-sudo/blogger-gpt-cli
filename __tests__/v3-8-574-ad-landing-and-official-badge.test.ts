/**
 * v3.8.574 — 광고 랜딩을 CTA 로 쓰던 문제 + "공식 권장" 배지 오용
 *
 * ## 사장님이 LLM 비평으로 잡아낸 사고 (2026-08-28)
 * "2026년 도수치료 실비보험 청구 거절" 글의 CTA 가 이랬다:
 *
 *   배지: 공식 권장
 *   주소: https://www.lawthedream.com/insurance?utm_source=naver&utm_medium=cpc
 *           &n_media=27758&n_query=보험사부지급&n_rank=1&n_ad_group=grp-...
 *
 * **사설 법률업체의 네이버 파워링크 광고 랜딩**이다. 세 가지가 동시에 잘못이다:
 *   1. 사설 업체를 "공식"이라 표기 — 독자를 속인다
 *   2. 광고 랜딩으로 보내면 **광고주 예산을 태운다**(클릭당 과금)
 *   3. 광고 URL 은 캠페인이 끝나면 죽는다
 *
 * 전수 조사 결과: 광고 URL 2편 · "공식 권장" 배지 오용 11편
 * (현대차·KB손해보험 다이렉트·사설 법률업체·개인 사이트에까지 붙어 있었다)
 */
import * as fs from 'fs';
import * as path from 'path';
import { hasAdTracking, isOfficialDestination, judgeCtaHost, describeHostVerdict } from '../src/cta/host-trust';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 실제로 글에 박혀 있던 주소 */
const AD_URL = 'https://www.lawthedream.com/insurance?utm_source=naver&utm_medium=cpc'
  + '&utm_content=Bo_main_PC_06&n_media=27758&n_query=%EB%B3%B4%ED%97%98&n_rank=1&n_ad_group=grp-a001';

describe('① 광고 추적 파라미터를 알아본다', () => {
  test('실제 사고 주소를 잡는다', () => {
    expect(hasAdTracking(AD_URL)).toBe(true);
  });

  test('네이버·구글·페이스북 광고 파라미터를 두루 잡는다', () => {
    for (const u of [
      'https://a.kr/x?utm_source=naver',
      'https://a.kr/x?gclid=abc123',
      'https://a.kr/x?fbclid=abc123',
      'https://a.kr/x?n_media=123',
      'https://a.kr/x?n_rank=1',
      'https://a.kr/x?NaPm=ct%3D1',
      'https://a.kr/x?foo=1&msclkid=zz',
    ]) expect(hasAdTracking(u)).toBe(true);
  });

  /** 넓게 잡으면 멀쩡한 공식 딥링크가 죽는다 — 실제로 쓰는 주소들로 확인한다 */
  test('멀쩡한 공식 주소는 안 잡는다', () => {
    for (const u of [
      'https://www.fss.or.kr/fss/main/contents.do?menuNo=200520',
      'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015',
      'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=41',
      'https://etk.srail.kr/hpg/hra/01/selectScheduleList.do?pageId=TK0101010000',
      'https://www.bokjiro.go.kr/ssis-tbu/twatbz/mkclAsis/mkclPage.do',
      'https://www.wetax.go.kr/',
      '',
    ]) expect(hasAdTracking(u)).toBe(false);
  });
});

describe('② 광고 랜딩은 CTA 후보에서 버린다', () => {
  test('기관 도메인이어도 광고 파라미터가 붙으면 거절', () => {
    const v = judgeCtaHost('https://www.gov.kr/foo?utm_source=naver&n_rank=1', '지원금');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('ad-tracking');
    expect(describeHostVerdict(v)).toContain('광고');
  });

  test('실제 사고 주소가 거절된다', () => {
    const v = judgeCtaHost(AD_URL, '도수치료 실비보험 청구 거절', ['금융감독원'], '법률상담');
    expect(v.ok).toBe(false);
  });

  test('광고 파라미터가 없으면 예전처럼 판정한다 (과잉 차단 금지)', () => {
    expect(judgeCtaHost('https://www.fss.or.kr/fss/main/contents.do?menuNo=200520', '보험 민원').ok).toBe(true);
    expect(judgeCtaHost('https://www.gov.kr/portal/main', '민원').ok).toBe(true);
  });
});

describe('③ "공식"이라 부를 수 있는 곳만 공식이다', () => {
  test('공공·기관 도메인은 공식', () => {
    for (const u of ['https://www.fss.or.kr/x/y', 'https://www.gov.kr/a', 'https://hometax.go.kr/z']) {
      expect(isOfficialDestination(u)).toBe(true);
    }
  });

  /** 실측에서 "공식 권장"이 잘못 붙어 있던 곳들 */
  test('민간 기업·사설 업체는 공식이 아니다', () => {
    for (const u of [
      'https://www.lawthedream.com/insurance',      // 사설 법률업체
      'https://direct.kbinsure.co.kr/home',         // 보험사 다이렉트 판매
      'https://www.hyundai.com/kr/ko',              // 자동차 회사
      'https://postmate.waffle-gl.org/x',           // 개인 사이트
    ]) expect(isOfficialDestination(u)).toBe(false);
  });

  test('광고 랜딩은 도메인과 무관하게 공식이 아니다', () => {
    expect(isOfficialDestination('https://www.gov.kr/a?utm_source=naver')).toBe(false);
    expect(isOfficialDestination(AD_URL)).toBe(false);
  });

  test('빈 값·깨진 주소에 걸려 넘어지지 않는다', () => {
    expect(isOfficialDestination('')).toBe(false);
    expect(isOfficialDestination('not-a-url')).toBe(false);
  });
});

describe('④ 배선 — 배지가 목적지를 보고 붙는다', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('무조건 "공식 권장"을 붙이던 코드가 사라졌다', () => {
    expect(orch).not.toContain("badge: sectionCta.searchFallback ? '직접 확인' : '공식 권장'");
  });

  test('목적지를 보고 배지를 정한다', () => {
    expect(orch).toContain("import { isOfficialDestination } from '../../cta/host-trust'");
    expect(orch).toContain('isOfficialDestination(sectionCta.url)');
    // 공식이 아니면 정직한 다른 문구를 쓴다 (배지를 아예 없애면 박스가 허전해진다)
    expect(orch).toContain("'참고 링크'");
  });
});

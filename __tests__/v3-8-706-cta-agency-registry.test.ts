/**
 * v3.8.706 — CTA 목적지가 **어느 주제든** 맞게 나오도록: 자라는 기관 레지스트리 + 호스트·낱말 검산
 *
 * 사장님: "CTA는 어떤주제던지 완벽하게나와야되거든" · "이러한 시드가 방대해야되지않니?"
 *         "하드코딩시키지말고 그떄그떄 추론해서 판단해서 넣게해야지"
 *
 * 2026-09-07 실측(15주제 중 6곳 정답): 네 가지 원인이 있었고 각각 코드 한 곳씩 짝이 있다.
 *   ① 정부24 라 정해 놓고 금천구청 페이지  → preferredHost(레지스트리) + 기관 호스트 먼저 + 기관 홈 폴백
 *   ② 월세 세액공제 → 교육비 세액공제 페이지 → mustHave(AI 가 정한 필수 낱말)
 *   ③ 김치찌개 → 식품안전나라                → "없음" 이 정식 판정(none)
 *   ④ 비짓제주(.net) 가 unknown-host 로 제외   → trustedHosts → 'registry'
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const callGeminiWithRetry = jest.fn();
jest.mock('../src/core/final/gemini-engine', () => ({
  callGeminiWithRetry: (...args: unknown[]) => callGeminiWithRetry(...args),
}));

import {
  configureAgencyRegistry,
  learnAgency,
  lookupAgency,
  listLearnedAgencies,
  resolveAgencyHost,
  agencyNameAppears,
  isOnHost,
} from '../src/cta/agency-registry';
import { judgeCtaHost, apexHost, sameSite } from '../src/cta/host-trust';
import { gateCtaDestination } from '../src/cta/destination-gate';
import { missingMustHave, onPreferredHost } from '../src/cta/action-link-harness';
import { regenerateCta } from '../src/cta/regenerate';
import { resolveSmartCtaDecision, clearSmartCtaCache } from '../src/cta/smart-cta';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

let tmpDir = '';
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-registry-'));
  configureAgencyRegistry({ storePath: path.join(tmpDir, 'registry.json') });
  callGeminiWithRetry.mockReset();
  clearSmartCtaCache();
});
afterEach(() => {
  configureAgencyRegistry({ storePath: null });
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

/** URL 에 포함된 조각으로 HTML 을 고르는 페처 — 홈 주소의 꼬리 슬래시·www 차이를 신경 쓰지 않게 */
const fetcherFor = (pages: Array<[string, string]>) => async (url: string) => {
  const hit = pages.find(([frag]) => url.includes(frag));
  return { ok: !!hit, html: hit ? hit[1] : '', finalUrl: url };
};

describe('① 레지스트리 — 이름을 호스트로 바꾸고, 배운 것을 기억한다', () => {
  test('이름 조각 판정 — 괄호·공백·범용 낱말은 무시한다', () => {
    expect(agencyNameAppears('경찰청교통민원24(이파인) - 메인', '이파인')).toBe(true);
    expect(agencyNameAppears('<title>임신육아종합포털 아이사랑</title>', '아이사랑')).toBe(true);
    expect(agencyNameAppears('금천구청 홈페이지', '정부24')).toBe(false);
    expect(isOnHost('https://www.gov.kr/mw/AA020.do', 'gov.kr')).toBe(true);
    expect(isOnHost('https://plus.gov.kr/x', 'gov.kr')).toBe(true);
    expect(isOnHost('https://www.geumcheon.go.kr/passport', 'gov.kr')).toBe(false);
  });

  test('learnAgency 는 파일에 남고, lookup 은 정확 → 포함 순으로 찾는다', () => {
    learnAgency({ name: '가상시험포털', host: 'test-agency.example.kr', url: 'https://test-agency.example.kr/' });
    expect(listLearnedAgencies()).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, 'registry.json'), 'utf-8')).entries).toHaveLength(1);

    expect(lookupAgency('가상시험포털')?.host).toBe('test-agency.example.kr');
    expect(lookupAgency('가상시험포털(구 시험청)')?.host).toBe('test-agency.example.kr');
    expect(lookupAgency('없음')).toBeNull();

    // 같은 이름을 다시 배우면 덧붙이지 않고 바꾼다
    learnAgency({ name: '가상시험포털', host: 'new.example.kr', url: 'https://new.example.kr/' });
    expect(listLearnedAgencies()).toHaveLength(1);
    expect(lookupAgency('가상시험포털')?.host).toBe('new.example.kr');
  });

  test('⭐ 모르는 이름은 검색 → 홈을 열어 이름 확인 → 배운다 (.go.kr 이 아니어도)', async () => {
    const search = jest.fn(async (q: string) => q.includes('가상관광포털')
      ? [
        { url: 'https://blog.naver.com/someone/123', title: '가상관광포털 후기' },
        { url: 'https://www.visit-test.net/kr/', title: '가상관광포털 - 공식 관광정보' },
        { url: 'https://www.visit-test.net/kr/detail/view?cid=1', title: '가상관광포털 명소' },
      ]
      : []);
    const fetchPage = fetcherFor([['visit-test.net', '<html><title>가상관광포털</title><body>가상관광포털 공식 관광정보</body></html>']]);

    const entry = await resolveAgencyHost({ name: '가상관광포털', search, fetchPage });
    expect(entry?.host).toBe('visit-test.net');
    expect(entry?.source).toBe('learned');
    expect(listLearnedAgencies().map((e) => e.name)).toEqual(['가상관광포털']);

    // 두 번째는 검색하지 않는다 — 사전에서 0회
    search.mockClear();
    const again = await resolveAgencyHost({ name: '가상관광포털', search, fetchPage });
    expect(again?.host).toBe('visit-test.net');
    expect(search).not.toHaveBeenCalled();
  });

  test('제목에 이름이 없는 결과만 나오면 null — 그리고 잠시 다시 묻지 않는다', async () => {
    const search = jest.fn(async () => [{ url: 'https://www.somewhere.go.kr/', title: '어느 시청' }]);
    const fetchPage = fetcherFor([]);
    expect(await resolveAgencyHost({ name: '가상미상기관', search, fetchPage })).toBeNull();
    expect(listLearnedAgencies()).toHaveLength(0);
    search.mockClear();
    expect(await resolveAgencyHost({ name: '가상미상기관', search, fetchPage })).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  test('⭐ 호스트 비교는 등록 도메인(apex) 기준 — ta.ksd.or.kr 를 배웠어도 www.ksd.or.kr 화면을 받는다', () => {
    expect(apexHost('https://ta.ksd.or.kr/x')).toBe('ksd.or.kr');
    expect(apexHost('www.geumcheon.go.kr')).toBe('geumcheon.go.kr');
    expect(apexHost('https://korean.visitseoul.net/')).toBe('visitseoul.net');
    expect(apexHost('m.academyinfo.go.kr')).toBe('academyinfo.go.kr');
    expect(sameSite('https://www.ksd.or.kr/ko/about', 'ta.ksd.or.kr')).toBe(true);
    expect(sameSite('https://www.geumcheon.go.kr/passport', 'gov.kr')).toBe(false);
    expect(sameSite('https://plus.gov.kr/', 'www.gov.kr')).toBe(true);
    expect(isOnHost('https://www.ksd.or.kr/ko/about', 'ta.ksd.or.kr')).toBe(true);
    expect(onPreferredHost('https://www.kotsa.or.kr/portal/', 'main.kotsa.or.kr')).toBe(true);
  });

  /**
   * 시드 생성(263곳)에서 실제로 걸린 오답 — 한국철도공사 → koraillabor.kr(노조), 예금보험공사 → kdic.saramin.co.kr(채용관).
   * 둘 다 제목에 기관 이름이 있고 홈 본문에도 이름이 있어 옛 규칙을 통과했다.
   */
  test('⭐ 노조·채용관은 그 기관의 집이 아니다 — 제목에 이름이 있어도 턴다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://kdic.saramin.co.kr/', title: '예금보험공사 채용' },
      { url: 'https://www.koraillabor-test.kr/', title: '한국철도공사 노동조합' },
      { url: 'https://www.kdic-test.or.kr/', title: '예금보험공사' },
    ]);
    const fetchPage = fetcherFor([
      ['kdic.saramin.co.kr', '<title>예금보험공사 채용 홈</title><body>예금보험공사 인재채용</body>'],
      ['kdic-test.or.kr', '<title>예금보험공사</title><body>예금보험공사 예금자보호</body>'],
    ]);
    // fresh: 시드에 (틀린) 예금보험공사 항목이 있어도 검색으로만 본다
    const entry = await resolveAgencyHost({ name: '예금보험공사', search, fetchPage, learn: false, fresh: true });
    expect(entry?.host).toBe('kdic-test.or.kr');
  });

  /**
   * 실측(어카운트인포): 금융위 보도자료가 제목 일치 2건으로 점수 1등 — 하지만 홈 제목은 "금융위원회"고
   * 검색 결과에 fsc.go.kr 홈 주소는 없다. 이런 1등은 떨어져야 하고, 홈 <title> 에 이름이 있는 2등이 받는다.
   */
  test('⭐ 보도자료만 많은 1등은 떨어지고 홈 제목에 이름이 있는 2등을 받는다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.fsc-test.go.kr/no010101/81526', title: '9.26일부터 가상서비스 앱·홈페이지를 통해 휴면카드를 일괄 조회' },
      { url: 'https://www.fsc-test.go.kr/no040101?cnId=2455', title: "'가상서비스'에서 휴면카드 조회·해지 한 번에!" },
      { url: 'https://www.svc-test.or.kr/', title: '가상서비스 - 계좌정보통합관리' },
    ]);
    const fetchPage = fetcherFor([
      ['fsc-test.go.kr', '<title>금융위원회</title><body>보도자료 목록</body>'],
      ['svc-test.or.kr', '<title>가상서비스</title><body>계좌 조회</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상서비스', search, fetchPage, learn: false });
    expect(entry?.host).toBe('svc-test.or.kr');
  });

  /** 실측(크레딧포유·경찰민원포털): "X 홈페이지 바로가기 (https://…)" 중계 블로그가 제목 일치로 1등이 됐다 */
  test('⭐ "바로가기" 중계 블로그는 턴다 — 제목이 이름 그 자체인 홈 주소를 받는다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.credit-test.or.kr:2443/', title: '본인신용정보 열람서비스' },
      { url: 'https://relay-test.co.kr/162', title: '가상포유 홈페이지 – 마스인포' },
      { url: 'https://spam-test.kr/%EA%B0%80%EC%83%81%ED%8F%AC%EC%9C%A0/', title: '가상포유 홈페이지 바로가기 www.credit-test.or.kr' },
      { url: 'https://www.credit-test.or.kr:2443/info/x.do', title: '가상포유 - 신용정보조회' },
      { url: 'https://home-test.kr/', title: '가상포유' },
    ]);
    const fetchPage = fetcherFor([
      ['relay-test.co.kr', '<title>가상포유 홈페이지 – 마스인포</title><body>가상포유 홈페이지 주소는</body>'],
      ['home-test.kr', '<title>승차권 예약 - 국민철도</title><body>예매</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상포유', search, fetchPage, learn: false });
    // home-test.kr 는 검색 제목이 이름 그 자체인 홈 주소 → 홈 <title> 에 이름이 없어도 받는다(SRT 실측)
    expect(entry?.host).toBe('home-test.kr');

    // 중계 글(/162)만 남는 모양 — 글 번호는 홈이 아니니 그 호스트의 진짜 홈(/)을 열어 보고, 거기 이름이 없으면 거절
    const relayOnly = jest.fn(async () => [{ url: 'https://relay-test.co.kr/162', title: '가상포유 홈페이지 – 마스인포' }]);
    const relayFetch = fetcherFor([
      ['relay-test.co.kr/162', '<title>가상포유 홈페이지 – 마스인포</title><body>주소는</body>'],
      ['relay-test.co.kr', '<title>마스인포</title><body>생활정보 블로그 가상포유 홈페이지 글</body>'],
    ]);
    expect(await resolveAgencyHost({ name: '가상포유2', search: relayOnly, fetchPage: relayFetch, learn: false })).toBeNull();
  });

  test('⭐ 중계 글 둘 이상이 같은 주소를 적으면 그 주소를 믿는다 — 기관 화면 제목엔 이름이 없어도 (크레딧포유 실측)', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.credit-test.or.kr:2443/', title: '본인신용정보 열람서비스' },
      { url: 'https://relay-a.kr/%ED%81%AC%EB%A0%88/', title: '가상포유3 홈페이지 바로가기 https://www.credit-test.or.kr/' },
      { url: 'https://relay-b.kr/%ED%81%AC%EB%A0%88/', title: '가상포유3 홈페이지 www.credit-test.or.kr 한국 신용 정보 조회' },
      // ?p=397 은 홈이 아니다 — 글 제목에 이름이 있어도 그 호스트의 진짜 홈(/)을 열어 본다
      { url: 'http://spam-test.com.np/?p=397', title: '가상포유3 대부업 조회' },
    ]);
    const fetchPage = fetcherFor([
      ['spam-test.com.np/?p=397', '<title>가상포유3 대부업 조회 | 올드피씨</title>'],
      ['spam-test.com.np', '<title>올드피씨</title><body>컴퓨터 이야기</body>'],
      ['credit-test.or.kr', '<title>본인신용정보 열람서비스</title><body>신용정보 조회</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상포유3', search, fetchPage, learn: false });
    expect(entry?.host).toBe('credit-test.or.kr');

    // 중계 글 하나만 가리키면 증거가 아니다
    const one = jest.fn(async () => [{ url: 'https://relay-a.kr/%ED%81%AC%EB%A0%88/', title: '가상포유4 홈페이지 바로가기 https://www.lone-test.or.kr/' }]);
    expect(await resolveAgencyHost({ name: '가상포유4', search: one, fetchPage: fetcherFor([['lone-test.or.kr', '<title>열람</title>']]), learn: false })).toBeNull();
  });

  test('⭐ 제목이 이름 그 자체인 홈(/www/main.do)은 하위 서비스 화면이 여럿 나와도 먼저 본다 (외교부 → 여권안내 실측)', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.mofa-test.go.kr/www/main.do', title: '가상외교부' },
      { url: 'https://www.pass-test.go.kr/', title: '가상외교부 여권안내' },
      { url: 'https://www.pass-test.go.kr/home/kor/contents.do?menuPos=32', title: '가상외교부 여권안내 홈페이지 [여권 사진]' },
      { url: 'https://www.pass-test.go.kr/home/kor/contents.do?menuPos=1', title: '가상외교부 여권안내 홈페이지 [최초 발급]' },
      { url: 'https://www.pass-test.go.kr/home/kor/romanize/index.do', title: '가상외교부 여권안내 홈페이지 [로마자]' },
    ]);
    const fetchPage = fetcherFor([
      ['mofa-test.go.kr', '<title>가상외교부</title><body>외교</body>'],
      ['pass-test.go.kr', '<title>가상외교부 여권안내 홈페이지</title><body>여권</body>'],
    ]);
    // fresh — 시드의 "포함" 조회가 '가상외교부' 에서 '외교부' 를 찍어 주는 것을 막고 검색 규칙만 본다
    const entry = await resolveAgencyHost({ name: '가상외교부', search, fetchPage, learn: false, fresh: true });
    expect(entry?.host).toBe('mofa-test.go.kr');
  });

  test('⭐ 국회 상임위(*.na.go.kr)는 기관이 아니다 — "과학기술정보방송통신위원회"가 방송통신위원회로 잡히던 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://science-test.na.go.kr:444/', title: '과학기술정보가상통신위원회' },
      { url: 'https://science-test.na.go.kr/x.do', title: '과학기술정보가상통신위원회 의사일정' },
    ]);
    const fetchPage = fetcherFor([['science-test', '<title>과학기술정보가상통신위원회</title><body>국회</body>']]);
    expect(await resolveAgencyHost({ name: '가상통신위원회', search, fetchPage, learn: false, fresh: true })).toBeNull();
    // 앞에 다른 글자가 붙어도 낱말 경계로 자르지 않는다 — "대검찰청"·"TS한국교통안전공단"은 검찰청·한국교통안전공단의 집이다 (경계를 세웠다가 넷을 놓친 실측)
    const search2 = jest.fn(async () => [{ url: 'https://www.kotsa-test.or.kr/', title: 'TS가상교통안전공단' }]);
    const entry = await resolveAgencyHost({ name: '가상교통안전공단', search: search2, fetchPage: fetcherFor([['kotsa-test', '<title>TS가상교통안전공단</title>']]), learn: false, fresh: true });
    expect(entry?.host).toBe('kotsa-test.or.kr');
  });

  test('⭐ 열리지 않는 홈은 제목이 이름 그 자체여도 받지 않는다 — 강원특별자치도 → office365.gwe.go.kr(fetch failed) 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://office365.gwe-test.go.kr/', title: '가상특별자치도교육청-교육용오피스지원시스템' },
      { url: 'https://www.gwe-test.go.kr/', title: '가상특별자치도교육청' },
      { url: 'https://www.gwe-test.go.kr/main/', title: '가상특별자치도교육청 소식' },
      { url: 'https://state.gwd-test.go.kr/', title: '가상특별자치도청' },
    ]);
    const fetchPage = fetcherFor([
      ['gwd-test.go.kr', '<title>가상특별자치도청</title><body>도정</body>'],
      // gwe-test 는 열리지 않는다(등록 없음 → fetcherFor 가 ok:false)
    ]);
    const entry = await resolveAgencyHost({ name: '가상특별자치도', search, fetchPage, learn: false, fresh: true });
    // "이름+청" 제목의 홈은 제목 일치로 앞서고, 교육청은 다른 기관이라 이름 그 자체가 아니다
    expect(entry?.host).toBe('state.gwd-test.go.kr');
  });

  test('⭐ 한 등기 도메인에 홈이 여럿이면 제목에 이름이 있는 홈을 연다 — 고용보험은 ei.work24(고용보험 - 고용24)이지 www.work24(고용24)가 아니다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.work24-test.go.kr/', title: '가상24' },
      { url: 'https://ei.work24-test.go.kr/', title: '가상보험 - 가상24' },
      { url: 'https://www.work24-test.go.kr/cm/z/a.do', title: '고용정책 상세 - 자영업자 가상보험' },
    ]);
    const fetchPage = fetcherFor([
      ['ei.work24-test.go.kr', '<title>가상보험 - 가상24</title><body>가입</body>'],
      ['www.work24-test.go.kr', '<title>가상24</title><body>일자리</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상보험', search, fetchPage, learn: false, fresh: true });
    expect(entry?.host).toBe('ei.work24-test.go.kr');
  });

  test('⭐ 홈이 여럿이고 등급이 같으면 뿌리(www)부터 연다 — 한국공항공사는 park.airport(주차)가 아니라 www.airport 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://park.airport-test.co.kr/', title: '전국공항 주차홈페이지' },
      { url: 'https://www.airport-test.co.kr/', title: 'KAC가상공항공사' },
      { url: 'https://www.airport-test.co.kr/gimpo/index.do', title: '김포공항 - 가상공항공사' },
    ]);
    const fetchPage = fetcherFor([
      ['park.airport-test.co.kr', '<title>전국공항 주차홈페이지</title><body>주차 요금</body>'],
      ['www.airport-test.co.kr', '<title>KAC가상공항공사</title><body>공항 안내</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상공항공사', search, fetchPage, learn: false, fresh: true });
    expect(entry?.url).toBe('https://www.airport-test.co.kr/');
  });

  test('⭐ 제목이 이름 그 자체인 홈을 열었는데 이름이 안 보이면 다음 홈을 연다 — 나라장터 bddm(빈 제목) → www(나라장터 국가종합전자조달) 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.pps-test.go.kr/', title: '조달청' },
      { url: 'https://www.g2b-test.go.kr/', title: '가상장터 국가종합전자조달' },
      { url: 'https://bddm.g2b-test.go.kr/', title: '가상장터' },
    ]);
    const fetchPage = fetcherFor([
      ['bddm.g2b-test.go.kr', '<title></title><body></body>'],
      ['www.g2b-test.go.kr', '<title>가상장터 국가종합전자조달</title><body>입찰</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상장터', search, fetchPage, learn: false, fresh: true });
    expect(entry?.url).toBe('https://www.g2b-test.go.kr/');
  });

  test('⭐ 뿌리 홈이 비어 보여도(JS) 하위 도메인이 이름을 확인해 줬으면 뿌리를 적는다 — 우정사업본부 www(빈 제목) vs jodal(조달센터) 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.koreapost-test.go.kr/', title: '가상사업본부' },
      { url: 'https://kphi.koreapost-test.go.kr/', title: '우정인재개발원' },
      { url: 'https://jodal.koreapost-test.go.kr/kpost/index.do', title: '가상사업본부 - 우정사업조달센터' },
      { url: 'http://www.koreapost-test.go.kr/132/index.do', title: '서울도봉우체국 - 가상사업본부' },
    ]);
    const fetchPage = fetcherFor([
      ['jodal.koreapost-test.go.kr', '<title>가상사업본부</title><body>조달</body>'],
      ['www.koreapost-test.go.kr/', '<title></title><body></body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상사업본부', search, fetchPage, learn: false, fresh: true });
    expect(entry?.url).toBe('https://www.koreapost-test.go.kr/');
  });

  test('⭐ 제목이 이름 전체인 하위 홈이 이름 조각만 단 뿌리 홈을 이긴다 — 국토교통부 실거래가 공개시스템은 www.molit(부처 홈)이 아니라 rt.molit 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://rt.molit-test.go.kr/', title: '가상교통부 실거래가공개시스템' },
      { url: 'https://www.molit-test.go.kr/', title: '가상교통부' },
      { url: 'https://rtms.molit-test.go.kr/', title: '부동산거래관리시스템 - 메인화면' },
    ]);
    const fetchPage = fetcherFor([
      ['www.molit-test.go.kr', '<title>www.molit-test.go.kr</title><body></body>'],
      ['rt.molit-test.go.kr', '<title>가상교통부 실거래가 공개시스템</title><body>실거래가</body>'],
      ['rtms.molit-test.go.kr', '<title></title><body></body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상교통부 실거래가 공개시스템', search, fetchPage, learn: false, fresh: true });
    expect(entry?.url).toBe('https://rt.molit-test.go.kr/');
  });

  test('⭐ 이름이 바뀐 서비스 — 검색이 한 집을 과반으로 가리키는데 제목엔 새 이름뿐이면 그 집을 받는다(동물보호관리시스템 → 국가동물보호정보시스템 실측)', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.animal-test.go.kr/front/index.do', title: '국가동물보호정보시스템' },
      { url: 'https://www.animal-test.go.kr/front/awtis/public/publicAllList.do', title: '국가동물보호정보시스템 - 구조동물' },
      { url: 'https://www.animal-test.go.kr/front/awtis/protection/protectionList.do', title: '국가동물보호정보시스템 - 보호동물' },
      { url: 'https://www.animal-test.go.kr/front/awtis/record/recordList.do', title: '국가동물보호정보시스템 - 등록' },
      { url: 'https://www.animal-test.go.kr/front/board/boardList.do', title: '국가동물보호정보시스템 - 공지' },
      { url: 'https://www.animal-test.go.kr/front/awtis/mgr/mgrList.do', title: '국가동물보호정보시스템 - 관리' },
      { url: 'https://www.animal-test.go.kr/', title: '국가동물보호정보시스템' },
      { url: 'https://www.jbvma-test.or.kr/bbs/board.php?bo_table=notice&wr_id=3', title: '동물보호관리시스템 홈페이지 안내' },
      { url: 'https://www.mafra-test.go.kr/', title: '농림축산식품부' },
    ]);
    const fetchPage = fetcherFor([
      ['www.animal-test.go.kr/', '<title>국가동물보호정보시스템</title><body>동물등록 조회</body>'],
      ['jbvma-test.or.kr', '<title>가상수의사회</title><body>동물보호관리시스템 안내</body>'],
    ]);
    const say: string[] = [];
    const entry = await resolveAgencyHost({ name: '동물보호관리시스템', search, fetchPage, learn: false, fresh: true, onLog: (m) => say.push(m) });
    expect(entry?.url).toBe('https://www.animal-test.go.kr/');
    expect(say.join('\n')).toMatch(/과반\(7\/\d건\)/);
  });

  test('⭐ 뿌리 홈이 결과에 있는데 안 열리면 이름만 달린 하위 홈으로 대신하지 않는다 — 한국장애인고용공단이 고용개발원(edi.kead)으로 적혔던 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.kead-test.or.kr/', title: '가상고용공단' },
      { url: 'https://edi.kead-test.or.kr/', title: '가상고용공단 고용개발원' },
      { url: 'https://www.kead-test.or.kr/campus/', title: '가상고용공단 직업능력개발원' },
      { url: 'https://cyedu.kead-test.or.kr/', title: '가상고용공단 EDI사이버연수원' },
    ]);
    const fetchPage = fetcherFor([
      ['edi.kead-test.or.kr', '<title>가상고용공단 고용개발원입니다.</title><body>연구</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상고용공단', search, fetchPage, learn: false, fresh: true });
    expect(entry).toBeNull();
  });

  test('⭐ 과반 규칙은 제목에 이름이 있던 집을 되살리지 않는다 — 보도자료 많은 금융위가 어카운트인포 검색을 과반으로 이겨도 홈에 이름이 없으면 null', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.fsc-test.go.kr/no010101/12', title: '가상인포 서비스 개편 - 가상금융위원회' },
      { url: 'https://www.fsc-test.go.kr/no010101/13', title: '가상인포 이용 안내 - 가상금융위원회' },
      { url: 'https://www.fsc-test.go.kr/no010101/14', title: '가상인포 확대 - 가상금융위원회' },
      { url: 'https://www.fsc-test.go.kr/no010101/15', title: '가상인포 통계 - 가상금융위원회' },
      { url: 'https://www.bank-test.co.kr/notice/1', title: '가상은행 공지' },
    ]);
    const fetchPage = fetcherFor([
      ['www.fsc-test.go.kr/', '<title>가상금융위원회</title><body>새소식</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상인포', search, fetchPage, learn: false, fresh: true });
    expect(entry).toBeNull();
  });

  test('⭐ 과반이라도 제목과 이름이 네 글자 이상 이어 겹치지 않으면 남이다 — "금융민원센터" 검색을 금감원 보도자료가 과반으로 채워도 받지 않는다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.fss-test.or.kr/', title: '가상감독원' },
      { url: 'https://www.fss-test.or.kr/fss/bbs/1', title: '불법금융신고센터 - 가상감독원' },
      { url: 'https://www.fss-test.or.kr/fss/bbs/2', title: '증권불공정거래신고센터 - 가상감독원' },
      { url: 'https://www.fss-test.or.kr/fss/bbs/3', title: '보험사기신고센터 - 가상감독원' },
      { url: 'https://www.easylaw-test.go.kr/a', title: '금융 민원 절차' },
    ]);
    const fetchPage = fetcherFor([['www.fss-test.or.kr/', '<title>가상감독원</title><body>민원</body>']]);
    const entry = await resolveAgencyHost({ name: '금융민원센터', search, fetchPage, learn: false, fresh: true });
    expect(entry).toBeNull();
  });

  test('⭐ 어느 홈에도 이름이 안 보이면 열린 사이트 뿌리 홈을 받는다 — 전자소송은 ecfs.scourt(빈 화면)이지 www.scourt/portal/main.jsp 가 아니다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://ecfs.scourt-test.go.kr/', title: '가상소송포털' },
      { url: 'https://ecfs.scourt-test.go.kr/psp/index.on?m=PSP004M01', title: '통합검색 - 가상소송포털' },
      { url: 'https://www.scourt-test.go.kr/portal/main.jsp', title: '대한민국 법원 대국민서비스' },
      { url: 'https://ecfs.scourt-test.go.kr/psp/index.on?m=PSP720M02', title: '가상소송준비 - 가상소송포털' },
    ]);
    const fetchPage = fetcherFor([
      ['www.scourt-test.go.kr', '<title>����</title><body>��</body>'],
      ['ecfs.scourt-test.go.kr', '<title></title><body></body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상소송', search, fetchPage, learn: false, fresh: true });
    expect(entry?.url).toBe('https://ecfs.scourt-test.go.kr/');
  });

  test('⭐ 적는 주소는 검색이 준 깨끗한 주소다 — 세션 토큰(?bodyDataKey=…·;jsessionid=…)이 붙은 최종 주소는 다음 독자에게 낡는다', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.g2b-test.go.kr/', title: '가상장터 국가종합전자조달' },
      { url: 'https://www.kmedi-test.or.kr/web/index.do;jsessionid=ABC123', title: '가상의료분쟁조정중재원' },
    ]);
    const fetchPage = async (url: string) => ({
      ok: true,
      html: url.includes('g2b') ? '<title>가상장터</title>' : '<title>가상의료분쟁조정중재원</title>',
      finalUrl: url.includes('g2b') ? `${url}?bodyDataKey=65c71a0e&key=AAAAMD96ayZxnh_LZFZr877LlUWNY5Fb` : url,
    });
    const g2b = await resolveAgencyHost({ name: '가상장터', search, fetchPage, learn: false, fresh: true });
    expect(g2b?.url).toBe('https://www.g2b-test.go.kr/');
    const kmedi = await resolveAgencyHost({ name: '가상의료분쟁조정중재원', search, fetchPage, learn: false, fresh: true });
    expect(kmedi?.url).toBe('https://www.kmedi-test.or.kr/web/index.do');
  });

  test('⭐ 하위 사이트 홈(/icheon/main.do)만 있는 호스트는 "이름 안 보임" 규칙으로 받지 않는다 — 워크넷은 중계 글이 가리킨 고용24 실측', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.work24-test.go.kr/', title: '고용24' },
      { url: 'https://m.work-test.go.kr/jobCourseMain.do', title: '고용24 가상넷 모바일 > 직업진로' },
      { url: 'https://www.work-test.go.kr/empInfo/list.do', title: '지역가상넷 - 직업심리검사 결과처리시스템' },
      { url: 'https://gyeonggi.work-test.go.kr/icheon/main.do', title: '이천일자리센터' },
      { url: 'https://mexckorea-test.kr/worknet/', title: '가상넷 홈페이지 바로가기 https://www.work24-test.go.kr' },
      { url: 'https://gang-e-test.com/worknet-work24/', title: '가상넷 홈페이지 바로가기(고용24, www.work24-test.go.kr)' },
    ]);
    const fetchPage = fetcherFor([
      ['gyeonggi.work-test.go.kr', '<title>이천일자리센터</title><body>구인 구직</body>'],
      ['www.work24-test.go.kr', '<title>고용24</title><body>일자리</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상넷', search, fetchPage, learn: false, fresh: true });
    expect(entry?.host).toBe('work24-test.go.kr');
  });

  test('⭐ 네이버TV·유튜브·페이스북 채널은 기관의 집이 아니다 — 제목이 이름 그 자체여도 (국민건강보험공단 → tv.naver.com 실측)', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.nhis-test.or.kr/', title: '가상건강보험' },
      { url: 'https://tv.naver.com/nhis', title: '가상건강보험공단' },
      { url: 'https://www.youtube.com/@nhis', title: '가상건강보험공단' },
      { url: 'https://www.facebook.com/nhis.korea', title: '가상건강보험공단 - Facebook' },
      { url: 'https://www.nhis-test.or.kr/nhis/minwon/a.do', title: '서비스찾기 - 가상건강보험공단' },
    ]);
    const fetchPage = fetcherFor([
      ['tv.naver.com', '<title>가상건강보험공단 - 네이버 TV</title>'],
      ['nhis-test.or.kr', '<title>가상건강보험</title><body>가상건강보험공단 민원</body>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상건강보험공단', search, fetchPage, learn: false, fresh: true });
    expect(entry?.host).toBe('nhis-test.or.kr');
  });

  test('⭐ 한 기관의 하위 도메인들은 한 집으로 센다 — 홈 제목이 깨져(EUC-KR) 읽히지 않아도 제목 일치가 모이면 받는다 (대한상공회의소 실측)', async () => {
    const search = jest.fn(async () => [
      { url: 'https://www.korcham-test.net/', title: '코참넷' },
      { url: 'https://license.korcham-test.net/indexmain.jsp', title: '가상상공회의소 자격평가사업단' },
      { url: 'https://license.korcham-test.net/ex/examInfo1.do', title: '가상상공회의소 원서접수' },
      { url: 'https://www.korchamhrd-test.net/', title: '가상상공회의소 인력개발사업단HRD포털' },
      { url: 'https://cert.korcham-test.net/', title: '가상상공회의소 원산지증명센터' },
    ]);
    const fetchPage = fetcherFor([
      ['cert.korcham-test.net', '<title>가상상공회의소 원산지증명센터</title><body>원산지</body>'],
      ['korcham-test.net', '<title>����</title><body>��</body>'],
      ['korchamhrd-test.net', '<title>가상상공회의소 인력개발사업단HRD포털</title>'],
    ]);
    const entry = await resolveAgencyHost({ name: '가상상공회의소', search, fetchPage, learn: false, fresh: true });
    // 이름은 cert(원산지증명센터)가 확인해 줬지만 독자는 뿌리 홈으로 보낸다
    expect(entry?.url).toBe('https://www.korcham-test.net/');
  });

  test('⭐ 낯선 도메인은 홈 <title> 에 이름이 있어야 받는다 — 본문에 이름만 적힌 협력사 홈은 거절', async () => {
    const search = jest.fn(async () => [{ url: 'https://partner-test.com/', title: '가상기관B 안내' }]);
    const fetchPage = fetcherFor([['partner-test.com', '<title>파트너사</title><body>가상기관B 와 협력합니다</body>']]);
    expect(await resolveAgencyHost({ name: '가상기관B', search, fetchPage, learn: false })).toBeNull();
  });

  test('fresh 는 사전을 건너뛰고 검색으로만 본다 — 시드 생성이 옛 값을 베끼지 않게', async () => {
    learnAgency({ name: '가상기관A', host: 'old.example.kr', url: 'https://old.example.kr/' });
    const search = jest.fn(async () => [{ url: 'https://new.example.kr/', title: '가상기관A 공식' }]);
    const fetchPage = fetcherFor([['new.example.kr', '<title>가상기관A</title>']]);
    const entry = await resolveAgencyHost({ name: '가상기관A', search, fetchPage, fresh: true, learn: false });
    expect(search).toHaveBeenCalled();
    expect(entry?.host).toBe('new.example.kr');
    // learn:false 였으니 사전은 그대로
    expect(lookupAgency('가상기관A')?.host).toBe('old.example.kr');
  });
});

describe('④ host-trust — 레지스트리가 확인한 호스트는 .go.kr 이 아니어도 통과', () => {
  test('visitjeju.net 꼴의 낯선 공공 포털', () => {
    // 실측 그대로: 본문이 지목한 기관 목록에 비짓제주가 없고(글은 "제주관광공사"라 적었다) 제목도 명소 이름이었다
    const url = 'https://www.visitjeju.net/kr/detail/view?contentsid=CONT_1';
    expect(judgeCtaHost(url, '제주 여행', ['제주관광공사'], '성산일출봉').ok).toBe(false);
    const trusted = judgeCtaHost(url, '제주 여행', ['제주관광공사'], '성산일출봉', { trustedHosts: ['visitjeju.net'] });
    expect(trusted).toEqual({ ok: true, reason: 'registry' });
    // 하위 도메인도 같은 집
    expect(judgeCtaHost('https://m.visitjeju.net/kr/', 'k', [], '', { trustedHosts: ['visitjeju.net'] }).ok).toBe(true);
    // 다른 호스트는 여전히 막힌다
    expect(judgeCtaHost('https://www.visitjeju.example.com/x', 'k', [], '', { trustedHosts: ['visitjeju.net'] }).ok).toBe(false);
  });
});

const 신청화면 = (title: string, body: string) =>
  `<html><title>${title}</title><body><h1>${title}</h1><p>${body}</p><form><button type="submit">신청하기</button></form></body></html>`;

describe('①② 게이트 — 다른 호스트·필수 낱말 없음은 action 으로 올리지 않는다', () => {
  test('missingMustHave / onPreferredHost 의 세 값', () => {
    expect(missingMustHave('월세 세액공제 신청', undefined)).toBeNull();
    expect(missingMustHave('월세 세액공제 신청', ['월세', '세액공제'])).toEqual([]);
    expect(missingMustHave('교육비 세액공제 신청', ['월세', '세액공제'])).toEqual(['월세']);
    expect(missingMustHave('월세 세액 공제', ['월세', '세액공제'])).toEqual([]);   // 띄어쓰기 차이는 같은 말
    expect(onPreferredHost('https://www.gov.kr/x', undefined)).toBeNull();
    expect(onPreferredHost('https://www.gov.kr/x', 'gov.kr')).toBe(true);
    expect(onPreferredHost('https://www.geumcheon.go.kr/x', 'gov.kr')).toBe(false);
  });

  test('⭐ 정부24 라 했는데 금천구청 페이지 — action 이 아니라 guide 까지만', async () => {
    const url = 'https://www.geumcheon.go.kr/passport/apply.do';
    const html = 신청화면('여권 재발급 신청', '여권 재발급 온라인 신청하기 금천구청');
    const free = await gateCtaDestination({ url, keyword: '여권 재발급 온라인 신청', intent: '신청', fetchPage: fetcherFor([[url, html]]) });
    expect(free.ok && free.stage).toBe('action');

    const capped = await gateCtaDestination({
      url, keyword: '여권 재발급 온라인 신청', intent: '신청', fetchPage: fetcherFor([[url, html]]), preferredHost: 'gov.kr',
    });
    expect(capped.ok && capped.stage).toBe('guide');
    expect(capped.reasons.join(' ')).toContain('gov.kr');
  });

  test('⭐ 월세 세액공제 글이 홈택스 교육비 세액공제 페이지로 — guide 까지만', async () => {
    const url = 'https://www.hometax.go.kr/edu/deduction.do';
    const html = 신청화면('교육비 세액공제 신청', '교육비 세액공제 신청하기 홈택스');
    const v = await gateCtaDestination({
      url, keyword: '월세 세액공제 신청', intent: '신청', fetchPage: fetcherFor([[url, html]]), mustHave: ['월세', '세액공제'],
    });
    expect(v.ok && v.stage).toBe('guide');
    expect(v.reasons.join(' ')).toContain('월세');
  });

  test('필수 낱말이 다 있고 같은 호스트면 action 그대로', async () => {
    const url = 'https://www.hometax.go.kr/rent/deduction.do';
    const html = 신청화면('월세 세액공제 신청', '월세 세액공제 신청하기 홈택스');
    const v = await gateCtaDestination({
      url, keyword: '월세 세액공제 신청', intent: '신청', fetchPage: fetcherFor([[url, html]]),
      mustHave: ['월세', '세액공제'], preferredHost: 'hometax.go.kr',
    });
    expect(v.ok && v.stage).toBe('action');
  });
});

describe('① regenerate — 지목 기관 호스트에서 먼저 찾고, 없으면 그 기관 홈으로', () => {
  const 정부24홈 = '<html><title>정부24</title><body>정부24 대한민국 정부 대표 포털 서비스 신청 민원</body></html>';
  const 정부24여권 = 신청화면('여권 재발급 신청 | 정부24', '여권 재발급 온라인 신청하기 정부24');
  const 금천여권 = 신청화면('여권 재발급 신청 - 금천구청', '여권 재발급 온라인 신청하기 금천구청');
  const 정부24안내 = '<html><title>여권 안내 | 정부24</title><body>여권 재발급 제도 안내 정부24. 준비물과 수수료를 안내합니다.</body></html>';
  const smartTarget = {
    site: '정부24', action: '여권 재발급 신청', buttonLabel: '정부24에서 여권 재발급 신청', searchQuery: '정부24 여권 재발급 신청', mustHave: ['여권'],
  };
  const 본문 = '만료된 여권은 정부24에서 온라인으로 재발급 신청할 수 있다. 사진을 올리고 수령 기관을 고른다.';
  const 홈검색 = (q: string) => q.includes('홈페이지') || q === '정부24'
    ? [{ url: 'https://www.gov.kr/portal/main', title: '정부24' }, { url: 'https://www.gov.kr/', title: '정부24 - 대한민국 정부 대표 포털' }]
    : null;

  test('⭐ 다른 기관 딥링크가 먼저 나와도 지목 기관 호스트의 행동 화면을 고른다', async () => {
    const opened: string[] = [];
    const r = await regenerateCta({
      keyword: '여권 재발급 온라인 신청 방법',
      articleText: 본문,
      smartTarget,
      search: async (q) => 홈검색(q) || [
        { url: 'https://www.geumcheon.go.kr/passport/apply.do', title: '여권 재발급 신청 - 금천구청' },
        { url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000016', title: '여권 재발급 신청 | 정부24' },
      ],
      fetchPage: async (url) => {
        opened.push(url);
        return fetcherFor([['gov.kr/mw/', 정부24여권], ['geumcheon', 금천여권], ['gov.kr', 정부24홈]])(url);
      },
    });
    expect(r.ok).toBe(true);
    // 시드는 실측이라 정부24 가 plus.gov.kr 로 옮겨 가면 그 값이 온다 — 비교는 등기 도메인
    expect(apexHost(r.preferredHost || '')).toBe('gov.kr');
    expect(r.picked?.url).toContain('gov.kr/mw/');
    expect(r.picked?.stage).toBe('action');
    // 금천구청 페이지는 열어 보지도 않았다 — 기관 호스트에서 답이 났으니
    expect(opened.some((u) => u.includes('geumcheon'))).toBe(false);
  });

  test('⭐ 기관 호스트엔 안내 화면뿐이고 다른 기관엔 행동 화면이 있어도 — 기관 쪽 안내를 고른다', async () => {
    const r = await regenerateCta({
      keyword: '여권 재발급 온라인 신청 방법',
      articleText: 본문,
      smartTarget,
      search: async (q) => 홈검색(q) || [
        { url: 'https://www.geumcheon.go.kr/passport/apply.do', title: '여권 재발급 신청 - 금천구청' },
        { url: 'https://www.gov.kr/portal/service/passport/guide', title: '여권 안내 | 정부24' },
      ],
      fetchPage: fetcherFor([['passport/guide', 정부24안내], ['geumcheon', 금천여권], ['gov.kr', 정부24홈]]),
    });
    expect(r.ok).toBe(true);
    expect(r.picked?.url).toContain('gov.kr/portal/service/passport/guide');
    expect(r.picked?.stage).toBe('guide');
  });

  test('⭐ 기관 호스트 후보가 없으면 "기관 + 주제어"로 한 번 더 찾고, 그래도 없으면 기관 홈으로', async () => {
    const queries: string[] = [];
    const r = await regenerateCta({
      keyword: '여권 재발급 온라인 신청 방법',
      articleText: 본문,
      smartTarget,
      search: async (q) => {
        queries.push(q);
        return 홈검색(q) || [{ url: 'https://www.geumcheon.go.kr/passport/apply.do', title: '여권 재발급 신청 - 금천구청' }];
      },
      fetchPage: fetcherFor([['geumcheon', 금천여권], ['gov.kr', 정부24홈]]),
    });
    expect(queries).toContain('정부24 여권 재발급');
    expect(r.ok).toBe(true);
    expect(r.picked?.url).toMatch(/gov\.kr/);
    expect(r.picked?.stage).toBe('guide');
    expect(r.picked?.url).not.toContain('geumcheon');
  });

  /**
   * 2026-09-08 실측: AI 는 "금융민원센터"(서비스 이름)를 정했는데 사전이 못 풀어 기준 없이 판정 → easylaw 안내글.
   * 글이 지목한 기관(금융감독원)은 사전에 있었다 — 그걸 **약한 기준**으로 쓴다.
   */
  const 약한기준본문 = '하지정맥류 수술 뒤 실손보험 입원 거절을 받았다. 가상감독원 분쟁조정을 신청하면 가상감독원 이 심사한다.';
  const 약한기준목적지 = { site: '가상민원센터', action: '분쟁조정 신청', buttonLabel: '분쟁조정 신청', searchQuery: '가상민원센터 분쟁조정 신청' };
  const 안내글 = '<html><title>가상감독원을 통한 분쟁조정</title><body>금융분쟁 해결 방법을 안내합니다. 자율적 분쟁조정제도의 절차와 준비 서류.</body></html>';

  test('⭐ 서비스 이름은 못 풀어도 글의 기관은 풀린다 — 다른 호스트에 안내글뿐이면 그 기관 홈으로', async () => {
    learnAgency({ name: '가상감독원', host: 'fss-test.or.kr', url: 'https://www.fss-test.or.kr/' });
    const r = await regenerateCta({
      keyword: '하지정맥류 실손 입원 거절 분쟁조정 신청',
      articleText: 약한기준본문,
      smartTarget: 약한기준목적지,
      search: async () => [{ url: 'https://www.easylaw-test.go.kr/CSP/CnpClsMain.laf?csmSeq=572', title: '가상감독원을 통한 분쟁조정' }],
      fetchPage: fetcherFor([['easylaw-test', 안내글]]),
    });
    expect(r.ok).toBe(true);
    expect(r.preferredHost).toBe('fss-test.or.kr');
    expect(r.picked?.url).toBe('https://www.fss-test.or.kr/');
    expect(r.picked?.stage).toBe('guide');
    expect(r.log.join('\n')).toContain('약한 기준');
  });

  test('⭐ 약한 기준은 약하다 — 다른 호스트에 행동 화면이 있으면 그쪽이 기관 홈을 이긴다', async () => {
    learnAgency({ name: '가상감독원', host: 'fss-test.or.kr', url: 'https://www.fss-test.or.kr/' });
    const 신청 = 신청화면('분쟁조정 신청', '하지정맥류 실손 분쟁조정 신청하기 가상조정원');
    const r = await regenerateCta({
      keyword: '하지정맥류 실손 입원 거절 분쟁조정 신청',
      articleText: 약한기준본문,
      smartTarget: 약한기준목적지,
      // 홈 모양이 아닌 깊은 주소 — 홈 모양이면 v3.8.522 오배송 규칙이 먼저 턴다(그건 이 규칙과 무관하다)
      search: async () => [{ url: 'https://www.kmedi-test.or.kr/dispute/mediation/apply.do?step=1', title: '분쟁조정 신청' }],
      fetchPage: fetcherFor([['kmedi-test', 신청]]),
    });
    expect(r.ok).toBe(true);
    expect(r.picked?.url).toBe('https://www.kmedi-test.or.kr/dispute/mediation/apply.do?step=1');
    expect(r.picked?.stage).toBe('action');
  });

  test('noDestination — 검색하지 않고 none 으로 돌려준다 (기존 버튼은 건드리지 않는다)', async () => {
    const search = jest.fn(async () => []);
    const r = await regenerateCta({
      keyword: '김치찌개 맛있게 끓이는 법', articleText: '신김치를 볶는다', noDestination: true, search, fetchPage: fetcherFor([]),
    });
    expect(r.none).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.picked).toBeNull();
    expect(search).not.toHaveBeenCalled();
    expect(r.log.join(' ')).toContain('행동이 없습니다');
  });
});

describe('③ smart-cta — "없음"은 정식 판정이고, mustHave 를 함께 정한다', () => {
  test('없음 → none:true (실패가 아니다)', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"없음","confidence":0.9}');
    const d = await resolveSmartCtaDecision({ keyword: '김치찌개 맛있게 끓이는 법' });
    expect(d).toEqual({ target: null, none: true, confidence: 0.9 });
  });

  test('실패(빈 응답) → none:false — 예전처럼 검색 경로로 물러난다', async () => {
    callGeminiWithRetry.mockResolvedValue('');
    const d = await resolveSmartCtaDecision({ keyword: '아무 글' });
    expect(d.none).toBe(false);
    expect(d.target).toBeNull();
  });

  test('mustHave 는 3개까지·2자 이상·URL 아닌 것만', async () => {
    callGeminiWithRetry.mockResolvedValue(
      '{"site":"홈택스","action":"월세 세액공제 신청","buttonLabel":"홈택스에서 월세 공제 신청","mustHave":["월세","세액공제","a","www.hometax.go.kr","연말정산","간소화"],"confidence":0.9}',
    );
    const d = await resolveSmartCtaDecision({ keyword: '연말정산 월세 세액공제' });
    expect(d.none).toBe(false);
    expect(d.target?.site).toBe('홈택스');
    expect(d.target?.mustHave).toEqual(['월세', '세액공제', '연말정산']);
  });

  test('프롬프트가 없음·서비스 이름·mustHave 규칙을 담는다', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"없음","confidence":0}');
    await resolveSmartCtaDecision({ keyword: 'k' });
    const prompt = String(callGeminiWithRetry.mock.calls[0]![0]);
    expect(prompt).toContain('바로 할 행동이 없는 글');
    expect(prompt).toContain('이파인');
    expect(prompt).toContain('mustHave');
  });
});

describe('배선 — 발행 경로와 편집기 경로가 새 판정을 실제로 쓴다 (id 실존 규칙)', () => {
  const gen = read('src/core/final/generation.ts');
  const main = read('electron/main.ts');
  const seedSrc = read('src/cta/agency-seed.ts');

  test('generation.ts — 없음 판정이 검색·매핑 폴백을 전부 막는다', () => {
    expect(gen).toContain("require('../../cta/smart-cta')");
    expect(gen).toContain('resolveSmartCtaDecision');
    expect(gen).toContain('smartTargetNone = !!decision?.none');
    // 2·3·4단계와 최후 매핑이 모두 ctaNone 을 본다
    expect(gen.match(/safeCTAs\.length === 0 && !ctaNone/g)?.length).toBeGreaterThanOrEqual(4);
  });

  test('generation.ts — 1단계 AI 주소를 지목 기관 호스트로 검산하고, 2단계는 기관 호스트 먼저', () => {
    expect(gen).toContain('resolveCtaAgencyHost(aiAgencyName)');
    expect(gen).toContain('preferredHost: aiAgency?.host');
    expect(gen).toContain('preferredHost: preferredAgency?.host');
    expect(gen).toContain('mustHave: smartTarget?.mustHave');
    expect(gen).toContain("'registry'");
  });

  test('main.ts — 편집기 CTA 다시 생성·일괄 교체가 none 을 존중한다', () => {
    expect(main).toContain("const { resolveSmartCtaDecision } = require('../dist/cta/smart-cta')");
    expect(main).not.toContain('resolveSmartCtaTarget');
    expect(main.match(/noDestination,/g)?.length).toBeGreaterThanOrEqual(2);
    expect(main).toContain('if (result.none)');
  });

  test('시드는 생성 파일이고 손으로 적은 주소가 아니다', () => {
    expect(seedSrc).toContain('생성 파일이다');
    expect(seedSrc).toContain('scripts/cta-agency-bootstrap.js');
    expect(fs.existsSync(path.join(root, 'scripts/cta-agency-bootstrap.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts/cta-agency-names.js'))).toBe(true);
    // 시드에 적힌 항목은 전부 host·url·verifiedAt 을 갖는다
    const raw = seedSrc.match(/AGENCY_SEED[^=]*=\s*(\[[\s\S]*\]);/)![1]!;
    const entries = JSON.parse(raw.replace(/(?<=\{ |, )(name|host|url|verifiedAt):/g, '"$1":').replace(/,(\s*[\]}])/g, '$1'));
    for (const e of entries) {
      expect(typeof e.name).toBe('string');
      expect(e.host).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
      expect(e.url).toMatch(/^https?:\/\//);
      expect(e.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  test('실측 시드(docs/cta-eval/seed.json)와 채점 스크립트가 있고, 첫 15주제가 probe 태그로 남아 있다', () => {
    const seed = JSON.parse(read('docs/cta-eval/seed.json'));
    expect(seed.topics.length).toBeGreaterThanOrEqual(60);
    expect(seed.topics.filter((t: any) => (t.tags || []).includes('probe'))).toHaveLength(15);
    for (const t of seed.topics) {
      expect(typeof t.keyword).toBe('string');
      expect(typeof t.hint).toBe('string');
      expect(Array.isArray(t.expectHosts) && t.expectHosts.length > 0).toBe(true);
    }
    const script = read('scripts/cta-eval.js');
    // 앱과 같은 배선을 쓴다 — 옛 API(resolveSmartCtaTarget)로 돌리면 "없음" 판정이 빠진다
    expect(script).toContain('resolveSmartCtaDecision');
    expect(script).toContain('noDestination: none');
    expect(script).toContain('apexHost(');
  });
});

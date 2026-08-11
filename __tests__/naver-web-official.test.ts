/**
 * v3.8.476 — 공공기관 근거를 CSE 없이 만든다.
 *
 * CSE(Custom Search JSON API)는 신규 고객에게 발급이 막혔고(403 PERMISSION_DENIED)
 * 기존 고객도 2027-01-01 에 종료된다. official-sources 는 CSE 로만 돌기 때문에
 * 그대로 두면 공공기관 근거가 통째로 사라진다. 네이버 웹문서(webkr)로 대체한다 —
 * 이미 쓰는 네이버 검색 키 그대로라 추가 발급이 없다.
 *
 * 실측 2026-08-11 (webkr display=10, 기관 도메인 = go.kr · or.kr · re.kr):
 *   "청년 월세 지원"   기관 10/10 · "월 최대 20만원씩 최장 24개월간 월세를 지원합니다"
 *   "기초연금 수급자격" 기관  8/10 · "단독가구: 8억7,600만원 이하인 경우 지급대상"
 *   "전기차 보조금"    기관  7/10 · "2년 내 2만Km를 운행하지 않고 판매 시 환수금이 발생함"
 *   "치아교정 비용"    기관  0/10 (정부 주제가 아니면 안 나온다 — 정상)
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { buildOfficialSourcesFromWeb } from '../src/core/crawlers/official-from-web';
// content-crawler 에서 가져오면 p-limit(ESM) 때문에 스위트가 못 뜬다 — 의존성 없는 파일에서 가져온다
import { isOfficialDomain } from '../src/core/crawlers/official-domain';

describe('isOfficialDomain', () => {
  it('정부·공공기관·연구기관 도메인을 알아본다', () => {
    expect(isOfficialDomain('https://www.bokjiro.go.kr/ssis-tbu/index.do')).toBe(true);
    expect(isOfficialDomain('https://ev.or.kr/nportal/buySupprt')).toBe(true);
    expect(isOfficialDomain('http://kdi.re.kr/research')).toBe(true);
  });

  it('일반 상업 사이트는 기관이 아니다', () => {
    expect(isOfficialDomain('https://www.hyundai.com/kr/ko/e')).toBe(false);
    expect(isOfficialDomain('https://namu.wiki/w/치아교정')).toBe(false);
    expect(isOfficialDomain('https://blog.naver.com/abc/123')).toBe(false);
    expect(isOfficialDomain('')).toBe(false);
    // go.kr 이 도메인 끝이 아니면 안 된다 (가짜 방지)
    expect(isOfficialDomain('https://go.kr.evil.com/x')).toBe(false);
  });
});

describe('buildOfficialSourcesFromWeb', () => {
  const post = (url: string, content: string, source = 'naver-web-official') => ({ url, content, source });

  it('기관 스니펫에서 수치 문장을 뽑아 기관별로 묶는다 (복지로 실측)', () => {
    const sources = buildOfficialSourcesFromWeb([
      post('https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo.do',
        '고금리·고물가 등으로 경제적 어려움을 겪는 청년층의 주거비 부담 경감을 위해 월 최대 20만원씩 최장 24개월간 월세를 지원합니다(생애1회).'),
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0]!.agency).toBe('복지로');
    expect(sources[0]!.sentences.join(' ')).toContain('20만원');
    expect(sources[0]!.sentences.join(' ')).toContain('24개월');
  });

  it('기관 도메인이 아닌 항목은 무시한다', () => {
    expect(buildOfficialSourcesFromWeb([
      post('https://namu.wiki/w/x', '치아교정 비용은 보통 300만원에서 800만원 사이입니다.', 'naver-web'),
    ])).toEqual([]);
  });

  it('게시판 목록·진단 위젯은 숫자가 있어도 근거가 아니다 (실측 오탐 차단)', () => {
    const sources = buildOfficialSourcesFromWeb([
      post('https://www.childcare.go.kr/board',
        '제목: 2026년 지자체 출산지원금 업데이트 완료(2026.03.17), 등록일: 2026-03-17 ; 제목: 제주도 출산지원금, 등록일: 2026-03-17'),
      post('https://www.bokjiro.go.kr/diag',
        '청년월세지원진단 진단결과보기 청년월세지원 진단 조건 선택 1 주민등록상 출생년도 입력하세요.'),
    ]);

    expect(sources).toEqual([]);
  });

  it('알려지지 않은 기관은 도메인을 이름으로 쓴다 (빈 이름 금지)', () => {
    const sources = buildOfficialSourcesFromWeb([
      post('https://www.some-city.go.kr/notice',
        '전기화물차의 경우 2년 내 2만Km를 운행하지 않고 판매 시 환수금이 발생합니다.'),
    ]);

    expect(sources[0]!.agency).toBe('some-city.go.kr');
  });

  it('수치 문장이 하나도 없으면 빈 배열 — 아무것도 추가하지 않는다', () => {
    expect(buildOfficialSourcesFromWeb([
      post('https://www.bokjiro.go.kr/x', '복지로에 오신 것을 환영합니다.'),
    ])).toEqual([]);
    expect(buildOfficialSourcesFromWeb([])).toEqual([]);
  });
});

describe('배선', () => {
  const crawler = readFileSync(join(__dirname, '..', 'src/core/content-crawler.ts'), 'utf8');
  const orchestration = readFileSync(join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');

  it('webkr 이 병렬 수집에 들어간다', () => {
    expect(crawler).toContain('async crawlFromNaverWeb');
    expect(crawler).toContain('search/webkr.json');
    expect(orchestration).toContain('crawler.crawlFromNaverWeb(crawlerConfig)');
  });

  it('기관 문서를 앞쪽에 둔다 (프롬프트 예산이 잘려도 살아남게)', () => {
    expect(crawler).toContain("'naver-web-official'");
    expect(crawler).toContain('contents.sort(');
  });

  it('CSE 가 빈손일 때만 웹문서 기관 근거로 채운다 (CSE 결과를 덮지 않는다)', () => {
    expect(orchestration).toContain("if (!officialBlock && contentMode !== 'shopping')");
    expect(orchestration).toContain('buildOfficialSourcesFromWeb');
  });
});

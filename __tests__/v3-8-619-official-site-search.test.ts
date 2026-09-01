/**
 * v3.8.619 — 사전에 없는 기관을 검색으로 찾는다
 *
 * 사장님 요구: "어떤 주제로 글을 쓰든지 자동으로 완벽하게 버튼이 생기고 링크가 걸려야 돼요"
 *
 * 이름 사전(230곳)에 없으면 여전히 버튼이 0개가 된다. 그 구멍을 검색으로 메우되,
 * **검색 결과 페이지를 버튼에 걸지는 않는다** — 검색은 주소를 알아내는 수단이다.
 */

import {
  isUsableOfficialResult,
  pickOfficialSite,
  findOfficialUrlBySearch,
  resetOfficialSiteSearchCache,
  type SiteSearchHit,
} from '../src/cta/official-site-search';

const hit = (title: string, link: string, description = ''): SiteSearchHit => ({ title, link, description });

beforeEach(() => resetOfficialSiteSearchCache());

describe('쓸 수 있는 결과 가려내기', () => {
  it('공공기관 도메인은 쓴다', () => {
    expect(isUsableOfficialResult('https://www.mpm.go.kr')).toBe(true);
    expect(isUsableOfficialResult('https://www.nps.or.kr/html/main.jsp')).toBe(true);
  });

  it('블로그·카페는 버린다', () => {
    expect(isUsableOfficialResult('https://blog.naver.com/someone/12345')).toBe(false);
    expect(isUsableOfficialResult('https://cafe.naver.com/board/1')).toBe(false);
  });

  it('광고 랜딩은 버린다 — 광고주 예산을 태우고 캠페인이 끝나면 죽는다', () => {
    expect(isUsableOfficialResult('https://www.example.go.kr/apply?utm_source=naver&utm_medium=cpc')).toBe(false);
  });

  it('내려받기 주소는 버린다 — "바로가기"인데 파일이 떨어지면 안 된다', () => {
    expect(isUsableOfficialResult('https://www.example.go.kr/cmm/fms/FileDown.do?atchFileId=1')).toBe(false);
    expect(isUsableOfficialResult('https://www.example.go.kr/notice/2026.pdf')).toBe(false);
  });

  it('상업 사이트는 공식이 아니다', () => {
    expect(isUsableOfficialResult('https://www.somecompany.co.kr/insurance')).toBe(false);
  });

  it('http 는 쓰지 않는다', () => {
    expect(isUsableOfficialResult('http://www.example.go.kr')).toBe(false);
  });
});

describe('후보 고르기 — 순수 함수', () => {
  it('이름이 언급된 공공기관 결과를 고른다', () => {
    const picked = pickOfficialSite('인사혁신처', [
      hit('공무원 봉급 총정리 블로그', 'https://blog.naver.com/x/1'),
      hit('인사혁신처 대표 홈페이지', 'https://www.mpm.go.kr'),
      hit('다른 기관 보도자료', 'https://www.other.go.kr/news/2026/09/01'),
    ]);
    expect(picked).not.toBeNull();
    expect(picked!.url).toBe('https://www.mpm.go.kr');
  });

  it('홈에 가까운 주소를 고른다 — 깊은 페이지는 개편되면 죽는다', () => {
    const picked = pickOfficialSite('인사혁신처', [
      hit('인사혁신처 보도자료 상세', 'https://www.mpm.go.kr/mpm/news/press/2026/09/detail'),
      hit('인사혁신처', 'https://www.mpm.go.kr'),
    ]);
    expect(picked!.url).toBe('https://www.mpm.go.kr');
  });

  it('이름이 안 맞아도 공공기관뿐이면 그중에서 고른다', () => {
    const picked = pickOfficialSite('어떤기관', [hit('안내', 'https://www.example.go.kr')]);
    expect(picked).not.toBeNull();
    expect(picked!.reason).toContain('이름 일치 없음');
  });

  it('쓸 수 있는 결과가 없으면 null — 아무거나 걸지 않는다', () => {
    expect(pickOfficialSite('인사혁신처', [
      hit('블로그 정리', 'https://blog.naver.com/x/1'),
      hit('업체 광고', 'https://www.company.co.kr/ad?utm_source=naver'),
    ])).toBeNull();
    expect(pickOfficialSite('인사혁신처', [])).toBeNull();
  });

  it('설명에만 이름이 있어도 인정한다', () => {
    const picked = pickOfficialSite('인사혁신처', [
      hit('대표 홈페이지', 'https://www.mpm.go.kr', '인사혁신처가 운영하는 공식 사이트입니다'),
    ]);
    expect(picked!.url).toBe('https://www.mpm.go.kr');
  });
});

describe('검색으로 찾기 — 실패해도 던지지 않는다', () => {
  it('검색이 물어온 결과에서 공식 주소를 낸다', async () => {
    const search = async () => [hit('인사혁신처', 'https://www.mpm.go.kr')];
    const found = await findOfficialUrlBySearch('인사혁신처', search);
    expect(found!.url).toBe('https://www.mpm.go.kr');
  });

  it('검색이 터져도 null 을 돌려준다', async () => {
    const search = async () => { throw new Error('네트워크 실패'); };
    await expect(findOfficialUrlBySearch('인사혁신처', search)).resolves.toBeNull();
  });

  it('같은 이름은 두 번 검색하지 않는다', async () => {
    let calls = 0;
    const search = async () => { calls += 1; return [hit('인사혁신처', 'https://www.mpm.go.kr')]; };
    await findOfficialUrlBySearch('인사혁신처', search);
    await findOfficialUrlBySearch('인사혁신처', search);
    expect(calls).toBe(1);
  });

  it('검색 함수가 없으면 조용히 null', async () => {
    await expect(findOfficialUrlBySearch('인사혁신처', undefined as any)).resolves.toBeNull();
    await expect(findOfficialUrlBySearch('', async () => [])).resolves.toBeNull();
  });

  it('검색어에 "공식 홈페이지"를 붙여 묻는다', async () => {
    let asked = '';
    await findOfficialUrlBySearch('한국장학재단', async (q) => { asked = q; return []; });
    expect(asked).toBe('한국장학재단 공식 홈페이지');
  });
});

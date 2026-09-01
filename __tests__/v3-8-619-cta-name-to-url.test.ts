/**
 * v3.8.619 — 기관 이름을 주소로 바꾼다
 *
 * 사장님 요구: "어떤 주제로 글을 쓰든지 자동으로 완벽하게 버튼이 생기고 링크가 걸려야 돼요"
 *
 * 실측 사고: 2027년 공무원 봉급 글의 CTA 버튼이 0개였다. 목적지를 몰라서가 아니라,
 * 스마트 라우터가 지목한 "인사혁신처"를 **주소로 바꾸는 길이 없어서** 통째로 버린 것이다.
 */

import { resolveOfficialUrlByName, knowsOfficialName, officialNameIndexSize } from '../src/cta/name-to-url';

describe('이름 → 공식 주소', () => {
  it('실사고의 그 이름을 이제 해석한다', () => {
    const hit = resolveOfficialUrlByName('인사혁신처');
    expect(hit).not.toBeNull();
    expect(hit!.url).toContain('mpm.go.kr');
  });

  it('카탈로그와 호스트 이름표를 모두 뒤진다', () => {
    expect(resolveOfficialUrlByName('정부24')!.source).toBe('catalog');
    expect(resolveOfficialUrlByName('금융위원회')!.source).toBe('host-names');
  });

  it('한쪽이 다른 쪽을 품는 이름도 찾는다', () => {
    // "국민연금" ↔ "국민연금공단"
    expect(resolveOfficialUrlByName('국민연금공단')).not.toBeNull();
    expect(resolveOfficialUrlByName('KDI 경제교육정보센터')).not.toBeNull();
  });

  it('공백·중점·괄호 차이로 놓치지 않는다', () => {
    expect(resolveOfficialUrlByName(' 금융위원회 ')).not.toBeNull();
    expect(resolveOfficialUrlByName('KDI 경제교육·정보센터')).not.toBeNull();
  });

  it('모르는 이름은 지어내지 않고 null 을 돌려준다', () => {
    expect(resolveOfficialUrlByName('존재하지않는기관청')).toBeNull();
    expect(resolveOfficialUrlByName('')).toBeNull();
    expect(knowsOfficialName('아무기관')).toBe(false);
  });

  it('두 글자 이하 조각으로 엉뚱한 곳에 걸리지 않는다', () => {
    // "정부" 만으로 "정부24" 를 끌어오면 엉뚱한 목적지가 된다
    const hit = resolveOfficialUrlByName('정부');
    if (hit) expect(hit.name).toBe('정부');
  });

  it('돌려주는 주소는 모두 https 다', () => {
    ['인사혁신처', '금융위원회', '한국은행', '정부24', '복지로'].forEach((name) => {
      const hit = resolveOfficialUrlByName(name);
      expect(hit).not.toBeNull();
      expect(hit!.url).toMatch(/^https:\/\//);
    });
  });

  it('색인이 카탈로그보다 넓다 — 이름표까지 합쳐지므로', () => {
    expect(officialNameIndexSize()).toBeGreaterThan(198);
  });
});

/**
 * CTA 토지 오배송 수정 테스트 (v3.8.537)
 *
 * 실사고(2026-08-19, 발행글): "고양 그린벨트 109㎡ 토지거래허가 허가 안 나오는 경우"
 * 글의 CTA 가 **중고나라**로 나갔다 (사장님: "추론이 이상한데").
 *
 * 원인 실측:
 *  ① official-catalog 의 중고 3사 태그에 맨몸 "거래"가 있다 —
 *     "토지거래허가"의 '거래'가 부분 문자열로 걸려 +3 직접 신호를 받았다.
 *  ② 카탈로그에 토지이음(eum.go.kr)이 아예 없었다 — 이길 후보가 없었다.
 *  ③ 카테고리 감지에 토지·그린벨트·허가가 없어 공공(.go.kr) 가점도 못 받았다.
 *
 * 같은 무늬의 전과: '보험' 한 글자가 삼성화재로 (v3.8.362), 폴백 홈이
 * 삼성화재로 (v3.8.522). 맨몸 단어 태그는 부분 문자열 매칭과 만나면 사고가 된다.
 */
import { resolveOfficialLink } from '../src/cta/resolve';
import { OFFICIAL_CATALOG } from '../src/cta/official-catalog';

const pick = (query: string) => resolveOfficialLink({ query });
const hostOf = (u?: string) => { try { return new URL(String(u)).host.replace(/^www\./, ''); } catch { return ''; } };

describe('① 실사고 재현 잠금 — 토지 키워드는 중고장터로 가지 않는다', () => {
  const SECONDHAND = /joonggonara|bunjang|daangn/i;

  it('⭐ 사장님 발행 키워드 그대로 → 토지이음(eum.go.kr)', () => {
    const r = pick('고양 그린벨트 109㎡ 토지거래허가 허가 안 나오는 경우');
    expect(SECONDHAND.test(String(r?.url))).toBe(false);
    expect(hostOf(r?.url)).toBe('eum.go.kr');
  });

  it('토지 계열 변형들도 전부 토지이음', () => {
    for (const q of ['토지거래허가 신청', '그린벨트 해제 조건', '토지이용계획 확인 방법', '개발제한구역 행위허가']) {
      const r = pick(q);
      expect(SECONDHAND.test(String(r?.url))).toBe(false);
      expect(hostOf(r?.url)).toBe('eum.go.kr');
    }
  });

  it('주식거래·외환거래 같은 "거래" 포함 금융 키워드도 중고장터 금지', () => {
    for (const q of ['주식거래 수수료 비교', '외환거래 신고']) {
      const r = pick(q);
      expect(SECONDHAND.test(String(r?.url))).toBe(false);
    }
  });
});

describe('② 회귀 방지 — 진짜 중고거래 키워드는 계속 중고장터로 간다', () => {
  it('중고거래 명시 키워드는 중고 플랫폼 유지', () => {
    const r = pick('아이폰 중고거래 사기 예방');
    expect(/joonggonara|bunjang|daangn/i.test(String(r?.url))).toBe(true);
  });
});

describe('③ 원인 차단 — 맨몸 위험 태그 금지', () => {
  it('중고 3사 태그에 맨몸 "거래"/"판매"/"구매"가 없다 (부분 문자열 오매칭의 근원)', () => {
    const secondhand = OFFICIAL_CATALOG.filter((x) => /중고나라|번개장터|당근/.test(x.txt));
    expect(secondhand.length).toBeGreaterThanOrEqual(3);
    for (const item of secondhand) {
      expect(item.tags).not.toContain('거래');
      expect(item.tags).not.toContain('판매');
      expect(item.tags).not.toContain('구매');
      expect(item.tags).toContain('중고거래'); // 명시 신호는 유지
    }
  });

  it('토지이음이 카탈로그에 실존하고 토지 계열 태그를 가진다', () => {
    const eum = OFFICIAL_CATALOG.find((x) => /eum\.go\.kr/.test(x.url));
    expect(eum).toBeTruthy();
    for (const tag of ['토지이음', '토지거래허가', '그린벨트', '토지이용계획']) {
      expect(eum!.tags).toContain(tag);
    }
  });
});

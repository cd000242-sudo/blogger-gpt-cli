/**
 * 클러스터 키워드 분화 검사 (v3.8.383)
 *
 * 배경 (2026-07-28 실측): 같은 날 클러스터로 발행한 17편 중
 *   - 티빙(조회/보상/탈퇴/공식정보) 4편      → 본문 유사도 0.15~0.18  ✅ 정상 분화
 *   - 청년미래적금(가입조건/신청방법/은행…) 8편 → 본문 유사도 0.12~0.21  ✅ 정상 분화
 *   - 청년내일저축계좌(목돈마법/목돈마련완벽/비법/비밀) 5편 → 유사도 0.40~0.47 ❌ 중복
 *     (동일 문장 43개/164개 → 구글이 "중복 페이지, 다른 표준 선택"으로 색인 탈락)
 *
 * 원인: 앱의 스코프 강제(detectKeywordScope)는 키워드 끝의 한정자를 보고 본문을 좁힌다.
 *   하위 키워드가 '조회/보상/탈퇴'처럼 실제로 다른 측면이면 갈리지만,
 *   '목돈 마법 / 목돈 마련 완벽 / 비법'처럼 수식어만 다르면 좁힐 대상이 없어 같은 글이 나온다.
 *
 * 이 검사는 **생성 전에** 그 조합을 잡아 토큰 낭비와 색인 탈락을 동시에 막는다.
 */

import { analyzeKeywordCluster } from '../src/core/keyword-cluster-check';

describe('정상 클러스터는 통과시킨다 (오탐 방지)', () => {
  it('티빙 4편 — 조회/보상/탈퇴/공식정보는 서로 다른 측면', () => {
    const r = analyzeKeywordCluster([
      '티빙 개인정보 유출 조회',
      '티빙 개인정보 유출 보상',
      '티빙 개인정보 유출 탈퇴',
      '티빙 개인정보 유출 공식정보',
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('청년미래적금 6편 — 가입조건/신청방법/은행/이자 등은 서로 다른 측면', () => {
    const r = analyzeKeywordCluster([
      '청년미래적금 가입조건',
      '청년미래적금 신청방법',
      '청년미래적금 은행',
      '청년미래적금 이자',
      '청년미래적금 신청기간',
      '청년미래적금 환승',
    ]);
    expect(r.ok).toBe(true);
  });

  it('주제가 완전히 다른 키워드들은 당연히 통과', () => {
    const r = analyzeKeywordCluster(['전기차 보조금', '연말정산 환급금', '청년 월세 지원']);
    expect(r.ok).toBe(true);
  });

  it('키워드 1개면 검사 대상 아님', () => {
    expect(analyzeKeywordCluster(['청년내일저축계좌 비법']).ok).toBe(true);
  });
});

describe('수식어만 다른 조합을 잡는다 (실제 사고 재현)', () => {
  const 사고사례 = [
    '청년내일저축계좌 목돈 마법 가이드',
    '청년내일저축계좌 목돈 마련 완벽 가이드',
    '청년내일저축계좌 비법',
    '청년내일저축계좌 목돈 마련의 비밀',
  ];

  it('청년내일저축계좌 4편을 중복 위험으로 경고한다', () => {
    const r = analyzeKeywordCluster(사고사례);
    expect(r.ok).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('경고에 문제가 된 키워드들이 실제로 담긴다', () => {
    const r = analyzeKeywordCluster(사고사례);
    const risky = r.groups.filter(g => !g.distinct);
    expect(risky.length).toBeGreaterThan(0);
    expect(risky[0]!.keywords.length).toBeGreaterThanOrEqual(2);
  });

  it('완전히 같은 키워드 2개는 반드시 잡는다', () => {
    const r = analyzeKeywordCluster(['전기차 보조금 총정리', '전기차 보조금 총정리']);
    expect(r.ok).toBe(false);
  });

  it('수식어만 바뀐 2개도 잡는다 (완벽 가이드 vs 총정리)', () => {
    const r = analyzeKeywordCluster(['전기차 보조금 완벽 가이드', '전기차 보조금 총정리']);
    expect(r.ok).toBe(false);
  });

  it('경고 문구가 사용자에게 무엇을 하라고 알려준다', () => {
    const r = analyzeKeywordCluster(사고사례);
    expect(r.warnings.join(' ')).toMatch(/측면|한정자|다른/);
  });
});

describe('안전성 — 발행을 막으면 안 된다', () => {
  it('빈 배열/빈 문자열에 안전하다', () => {
    expect(() => analyzeKeywordCluster([])).not.toThrow();
    expect(() => analyzeKeywordCluster(['', '  '])).not.toThrow();
    expect(analyzeKeywordCluster([]).ok).toBe(true);
  });

  it('잘못된 입력에도 throw하지 않는다', () => {
    expect(() => analyzeKeywordCluster(null as any)).not.toThrow();
    expect(() => analyzeKeywordCluster([null, undefined, 123] as any)).not.toThrow();
  });

  it('결과는 경고일 뿐 차단 지시가 아니다 (ok=false여도 groups/warnings만 제공)', () => {
    const r = analyzeKeywordCluster(['전기차 보조금 가이드', '전기차 보조금 총정리']);
    expect(r).toHaveProperty('warnings');
    expect(r).toHaveProperty('groups');
    expect(Object.keys(r)).not.toContain('block');
  });
});
